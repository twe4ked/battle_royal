var throttle = function(type, name, obj) {
  obj = obj || window;
  var running = false;
  var func = function() {
    if (running) { return; }
    running = true;
    requestAnimationFrame(function() {
      obj.dispatchEvent(new CustomEvent(name));
      running = false;
    });
  };
  obj.addEventListener(type, func);
};

throttle("resize", "optimizedResize");

function keyboard(keyCode) {
  var key = {};
  key.code = keyCode;
  key.isDown = false;
  key.isUp = true;
  key.press = undefined;
  key.release = undefined;

  key.downHandler = function(event) {
    if (event.keyCode === key.code) {
      if (key.isUp && key.press) key.press();
      key.isDown = true;
      key.isUp = false;
    }
    event.preventDefault();
  };

  key.upHandler = function(event) {
    if (event.keyCode === key.code) {
      if (key.isDown && key.release) key.release();
      key.isDown = false;
      key.isUp = true;
    }
    event.preventDefault();
  };

  window.addEventListener("keydown", key.downHandler.bind(key), false);
  window.addEventListener("keyup", key.upHandler.bind(key), false);
  return key;
}

var app = new PIXI.Application(mapSize, mapSize, {backgroundColor : 0x000000});
var tileSize = 32;
var mapSize = tileSize * 64;  // 2048 x 2048 arena

function main() {
  PIXI.loader
    .add("assets/treasureHunter.json")
    .load(setup);
}

var player;
function setup() {
  document.body.appendChild(app.view);

  app.renderer.view.style.position = "absolute";
  app.renderer.view.style.display = "block";
  app.renderer.autoResize = true;
  app.renderer.resize(window.innerWidth, window.innerHeight);

  window.addEventListener("optimizedResize", function() {
    app.renderer.resize(window.innerWidth, window.innerHeight);
  });

  renderInitialTiles()

  player = new PIXI.Sprite(PIXI.utils.TextureCache["explorer.png"]);
  player.vx = 0;
  player.vy = 0;
  player.anchor.set(0.5);

  player.x = app.renderer.width / 2;
  player.y = app.renderer.height / 2;

  app.stage.addChild(player);

  var leftKey = keyboard(37),
    upKey = keyboard(38),
    rightKey = keyboard(39),
    downKey = keyboard(40);

  leftKey.press = function() {
    player.vx = -5;
  };
  leftKey.release = function() {
    player.vx = 0;
  };

  upKey.press = function() {
    player.vy = -5;
  };
  upKey.release = function() {
    player.vy = 0;
  };

  rightKey.press = function() {
    player.vx = 5;
  };
  rightKey.release = function() {
    player.vx = 0;
  };

  downKey.press = function() {
    player.vy = 5;
  };
  downKey.release = function() {
    player.vy = 0;
  };

  socket = io();
  socket.on('game', function(msg) {
    console.log(msg)
  });

  state = play;
  gameLoop()
};

var i = 0;

function gameLoop() {
  i++;
  centreViewportOnPlayer();
  requestAnimationFrame(gameLoop);
  state();
  app.renderer.render(app.stage);
}

function play() {
  player.x += player.vx;
  player.y += player.vy;

  if (i % 60 == 0) {
    socket.emit('game', {name: window.location.hash});
  }
}

function centreViewportOnPlayer() {
  var newX = (app.renderer.screen.width / 2) - player.x
  var newY = (app.renderer.screen.height / 2) - player.y

  app.stage.setTransform(newX, newY)
}

function renderInitialTiles() {
  var topLeftTileTexture = PIXI.utils.TextureCache["top_left_tile.png"];
  var topTileTexture = PIXI.utils.TextureCache["top_tile.png"];
  var topRightTileTexture = PIXI.utils.TextureCache["top_right_tile.png"];
  var leftTileTexture = PIXI.utils.TextureCache["left_tile.png"];
  var rightTileTexture = PIXI.utils.TextureCache["right_tile.png"];
  var bottomLeftTileTexture = PIXI.utils.TextureCache["bottom_left_tile.png"];
  var bottomRightTileTexture = PIXI.utils.TextureCache["bottom_right_tile.png"];
  var bottomTileTexture = PIXI.utils.TextureCache["bottom_tile.png"];
  var standardTileTexture = PIXI.utils.TextureCache["standard_tile.png"];
  var tile =  null

  for(var x = 0; x < mapSize; x+= tileSize) {
    for(var y = 0; y < mapSize; y+= tileSize) {

      if (x == 0 && y == 0) {
        var tile = new PIXI.Sprite(topLeftTileTexture);
      } else if (y == 0 && x + tileSize >= mapSize) {
        var tile = new PIXI.Sprite(topRightTileTexture);
      } else if (y == 0) {
        var tile = new PIXI.Sprite(topTileTexture);
      } else if ((y + tileSize >= mapSize) && (x + tileSize >= mapSize)) {
        var tile = new PIXI.Sprite(bottomRightTileTexture);
      } else if (x + tileSize >= mapSize) {
        var tile = new PIXI.Sprite(rightTileTexture);
      } else if (x == 0 && y + tileSize >= mapSize) {
        var tile = new PIXI.Sprite(bottomLeftTileTexture);
      } else if (y + tileSize >= mapSize) {
        var tile = new PIXI.Sprite(bottomTileTexture);
      } else if (x == 0) {
        var tile = new PIXI.Sprite(leftTileTexture);
      } else {
        var tile = new PIXI.Sprite(standardTileTexture);
      }

      tile.x = x
      tile.y = y
      app.stage.addChild(tile);
    }
  }
}

document.addEventListener("DOMContentLoaded", main)
