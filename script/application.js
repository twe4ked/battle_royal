var app = new PIXI.Application(mapSize, mapSize, { backgroundColor: 0x000000 });
var tileSize = 32;
var mapSize = tileSize * 64; // 2048 x 2048 arena

var throttle = function(type, name, obj) {
  obj = obj || window;
  var running = false;
  var func = function() {
    if (running) {
      return;
    }
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

function main() {
  PIXI.loader.add("assets/treasureHunter.json").load(setup);
}

var player;
var world;
var playerSprites = new PIXI.Container();
function setup() {
  document.body.appendChild(app.view);

  app.renderer.view.style.position = "absolute";
  app.renderer.view.style.display = "block";
  app.renderer.autoResize = true;
  app.renderer.resize(window.innerWidth, window.innerHeight);

  window.addEventListener("optimizedResize", function() {
    app.renderer.resize(window.innerWidth, window.innerHeight);
  });

  renderInitialTiles();

  player = {x: 0, y: 0, vx: 0, vy: 0, id: Math.random()}

  player.x = app.renderer.width / 2;
  player.y = app.renderer.height / 2;

  app.stage.addChild(playerSprites);

  var leftKey = keyboard(37),
    upKey = keyboard(38),
    rightKey = keyboard(39),
    downKey = keyboard(40);

  leftKey.press = function() {
    player.vx = -5
  };
  leftKey.release = function() {
    player.vx = 0;
  };

  upKey.press = function() {
    player.vy = -5
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
  socket.emit("announce", { name: player.id });
  socket.on("world_updated", function(msg) {
    playerSprites.children = [];

    world = msg;
    for (var playerId in world) {
      var entity = world[playerId];

      if (entity.location) {
        if (playerId == player.id) {
          sprite = new PIXI.Sprite(PIXI.utils.TextureCache["Player"]);
        } else {
          sprite = new PIXI.Sprite(PIXI.utils.TextureCache["Blob"]);
        }
        sprite.anchor.set(0.5);
        sprite.x = entity.location.x;
        sprite.y = entity.location.y;

        playerSprites.addChild(sprite);
      }
    }
  });

  state = play;
  gameLoop();
}

var gameTick = 0;

function gameLoop() {
  gameTick++;
  centreViewportOnPlayer();
  requestAnimationFrame(gameLoop);
  state();
  app.renderer.render(app.stage);
}

function play() {
  if (isClippableAt(player.x + player.vx, player.y + player.vy)) {
    player.x += player.vx;
    player.y += player.vy;
  }

  socket.emit("moved", { id: player.id, x: player.x, y: player.y });
}

function centreViewportOnPlayer() {
  var newX = app.renderer.screen.width / 2 - player.x;
  var newY = app.renderer.screen.height / 2 - player.y;

  app.stage.setTransform(newX, newY);
}

function renderInitialTiles() {
  var topLeftTileTexture = PIXI.utils.TextureCache["Top Left Tile"];
  var topTileTexture = PIXI.utils.TextureCache["Top Tile"];
  var topRightTileTexture = PIXI.utils.TextureCache["Top Right Tile"];
  var leftTileTexture = PIXI.utils.TextureCache["Left Tile"];
  var rightTileTexture = PIXI.utils.TextureCache["Right Tile"];
  var bottomLeftTileTexture = PIXI.utils.TextureCache["Bottom Left Tile"];
  var bottomRightTileTexture = PIXI.utils.TextureCache["Bottom Right Tile"];
  var bottomTileTexture = PIXI.utils.TextureCache["Bottom Tile"];
  var standardTileTexture = PIXI.utils.TextureCache["Standard Tile"];
  var tile = null;

  for (var x = 0; x < mapSize; x += tileSize) {
    for (var y = 0; y < mapSize; y += tileSize) {
      if (x == 0 && y == 0) {
        var tile = new PIXI.Sprite(topLeftTileTexture);
      } else if (y == 0 && x + tileSize >= mapSize) {
        var tile = new PIXI.Sprite(topRightTileTexture);
      } else if (y == 0) {
        var tile = new PIXI.Sprite(topTileTexture);
      } else if (y + tileSize >= mapSize && x + tileSize >= mapSize) {
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

      tile.x = x;
      tile.y = y;
      app.stage.addChild(tile);
    }
  }
}

function isClippableAt(x, y) {
  clippableSprites = ["Standard Tile"];

  // the getChildAt simply gets the sprite at the array Index we give, we can
  // calculate the array index from the given x and y values. The stage stores
  // all of the sprites in a single array so we need to mutliple the y value by
  // the offset of a row
  calculatedIndex =
    Math.floor(x / tileSize) + Math.floor(y / tileSize) * (mapSize / tileSize);
  spriteName = app.stage.getChildAt(calculatedIndex).texture.textureCacheIds[0];

  return clippableSprites.indexOf(spriteName) !== -1;
}

document.addEventListener("DOMContentLoaded", main);
