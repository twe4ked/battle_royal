const PLAYER_MOVEMENT_SPEED = 5;
const PROJECTILE_SPEED = 20;
const TILE_SIZE = 32;
const MAP_SIZE = TILE_SIZE * 64;  // 2048 x 2048 arena

var app = new PIXI.Application(MAP_SIZE, MAP_SIZE, { backgroundColor: 0xfacade });
var gameTick = 0;
var player;
var projectiles = [];
var canShootNext = 0;
var world = {};
var otherPlayerSprites = new PIXI.Container();
var lootSprites = new PIXI.Container();
var tileContainer = new PIXI.Container();
var overlayContainer = new PIXI.Container();
var fogOfWarContainer = new PIXI.Container();
var currentPlayerContainer = new PIXI.Container();
var projectileContainer = new PIXI.Container();
var healthBar;
var playersRemainingMessage;
var hitboxSize = TILE_SIZE / 2;
var controls;
var outerFogOfWar;
var innerFogOfWar;

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

function setupControls() {
  var keyboard = function(keyCode) {
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
    };

    key.upHandler = function(event) {
      if (event.keyCode === key.code) {
        if (key.isDown && key.release) key.release();
        key.isDown = false;
        key.isUp = true;
      }
    };

    window.addEventListener("keydown", key.downHandler.bind(key), false);
    window.addEventListener("keyup", key.upHandler.bind(key), false);
    return key;
  }

  var controls = {
    leftKey: keyboard(37),
    upKey: keyboard(38),
    rightKey: keyboard(39),
    downKey: keyboard(40),
    spaceKey: keyboard(32),
    aKey: keyboard(65),
    wKey: keyboard(87),
    dKey: keyboard(68),
    sKey: keyboard(83)
  }

  controls.spaceKey.press = tryShoot;

  return controls;
}

function main() {
  PIXI.loader.add("assets/treasureHunter.json").load(setup);
}

function calculatePlayerVelocity() {
  var directionVector = {x: 0, y: 0}

  if (controls.aKey.isDown || controls.leftKey.isDown) { directionVector.x -= 1 }
  if (controls.dKey.isDown || controls.rightKey.isDown) { directionVector.x += 1 }
  if (controls.wKey.isDown || controls.upKey.isDown) { directionVector.y -= 1 }
  if (controls.sKey.isDown || controls.downKey.isDown) { directionVector.y += 1 }

  var squaredTerms = directionVector.x * directionVector.x + directionVector.y * directionVector.y
  var mag = Math.sqrt(squaredTerms)

  if (mag > 0) {
    player.direction = {x: directionVector.x / mag, y: directionVector.y / mag}
    player.lastDirection = player.direction
  } else {
    player.direction = {x: 0, y: 0}
  }

  player.vx = PLAYER_MOVEMENT_SPEED * player.direction.x
  player.vy = PLAYER_MOVEMENT_SPEED * player.direction.y
}

function setupHealthBar() {
  //Create the health bar
  healthBar = new PIXI.Container();
  healthBar.position.set(10, 10)

  //Create the black background rectangle
  var innerBar = new PIXI.Graphics();
  innerBar.beginFill(0x000000);
  innerBar.drawRect(0, 0, 130, 22);
  innerBar.endFill();
  healthBar.addChild(innerBar);

  //Create the front red rectangle
  var outerBar = new PIXI.Graphics();
  outerBar.beginFill(0xFF3300);
  outerBar.drawRect(1, 1, 128, 20);
  outerBar.endFill();
  healthBar.addChild(outerBar);
  message = new PIXI.Text(
    "Health",
    {fontFamily: "Futura", fontSize: "13px", fill: "white" }
  );
  message.x = 48;
  message.y = 2;

  healthBar.outer = outerBar;
  healthBar.message = message;

  healthBar.addChild(message);
  overlayContainer.addChild(healthBar);
}

function updatePlayersRemainingMessage() {
  if (world.playersRemainingCount === undefined) { return; }

  playersRemainingMessage.text = `Players Remaining: ${world.playersRemainingCount}`
}

function setupPlayersRemainingBar() {
  var bar = new PIXI.Container();
  bar.position.set(300, 10)

  var innerBar = new PIXI.Graphics();
  innerBar.beginFill(0x000000);
  innerBar.drawRect(0, 0, 130, 22);
  innerBar.endFill();
  bar.addChild(innerBar);

  playersRemainingMessage = new PIXI.Text(
    "",
    {fontFamily: "Futura", fontSize: "13px", fill: "white" }
  );

  updatePlayersRemainingMessage()

  innerBar.addChild(playersRemainingMessage)
  overlayContainer.addChild(bar)
}

function worldUpdated(msg) {
  otherPlayerSprites.children = [];
  lootSprites.children = [];

  world = msg;
  for (var playerId in world.clients) {
    var entity = world.clients[playerId];

    if (entity.location) {
      if (playerId == player.id) {
        if(player.sprite === undefined) {
          player.sprite = new PIXI.Sprite(PIXI.utils.TextureCache["Player"]);
          player.sprite.anchor.set(0.5);
          player.sprite.x = entity.location.x;
          player.sprite.y = entity.location.y;

          currentPlayerContainer.addChild(player.sprite)
        }
      } else {
        sprite = new PIXI.Sprite(PIXI.utils.TextureCache["Blob"]);
        sprite.anchor.set(0.5);
        sprite.x = entity.location.x;
        sprite.y = entity.location.y;

        otherPlayerSprites.addChild(sprite);
      }
    }
  }

  for (var loot of world.loot) {
    sprite = new PIXI.Sprite(PIXI.utils.TextureCache["Loot"]);
    sprite.anchor.set(0.5);
    sprite.x = loot.x;
    sprite.y = loot.y;

    if (collision(sprite, player)) {
      socket.emit("gotLoot", {
        lootId: loot.id
      });
    }

    lootSprites.addChild(sprite);
  }

  updatePlayersRemainingMessage()
}

function shotsFired(projectile) {
  if (projectile.owner != player.id) {
    registerProjectile(projectile)
  }
}

function playerHit(msg) {
  if (msg.playerId == player.id) {
    reducePlayerHealth();
  }
}

function setup() {
  document.body.appendChild(app.view);

  app.renderer.view.style.position = "absolute";
  app.renderer.view.style.display = "block";
  app.renderer.autoResize = true;
  app.renderer.resize(window.innerWidth, window.innerHeight);

  window.addEventListener("optimizedResize", function() {
    app.renderer.resize(window.innerWidth, window.innerHeight);
  });

  setupStage();
  renderInitialTiles();

  player = {
    initialized: false,
    x: app.renderer.width / 2,
    y: app.renderer.height / 2,
    vx: 0,
    vy: 0,
    id: Math.random().toString(),
    width: PIXI.utils.TextureCache["Player"].width,
    height: PIXI.utils.TextureCache["Player"].height,
    direction: {x: 0, y: 0},
    lastDirection: {x: 0, y: 1}
  }

  controls = setupControls();
  setupHealthBar()
  setupPlayersRemainingBar()

  socket = io();
  socket.emit("announce", { name: player.id });

  socket.on("worldUpdated", worldUpdated)
  socket.on("shotsFired", shotsFired)
  socket.on("playerHit", playerHit)

  state = play;
  gameLoop();
}

function setupStage() {
  overlayContainer.width = window.innerWidth;
  overlayContainer.height = window.innerHeight;

  app.stage.addChild(tileContainer);
  app.stage.addChild(otherPlayerSprites);
  app.stage.addChild(lootSprites);
  app.stage.addChild(currentPlayerContainer);
  app.stage.addChild(projectileContainer);
  app.stage.addChild(fogOfWarContainer);
  app.stage.addChild(overlayContainer);
}

function gameLoop() {
  gameTick++;
  centreViewportOnPlayer();
  requestAnimationFrame(gameLoop);
  state();
  app.renderer.render(app.stage);
}

function play() {
  calculatePlayerVelocity()

  // Check if any projectiles have hit another player
  projectiles.forEach(function(projectile) {
    for (var playerId in world.clients) {
      if (playerId != projectile.owner && Math.abs(projectile.x -
            world.clients[playerId].location.x) <= hitboxSize &&
          Math.abs(projectile.y - world.clients[playerId].location.y) <=
          hitboxSize) {
        if(projectile.owner == player.id) {
          socket.emit("playerHit", { reporterId: player.id, playerId: playerId });
        }
        projectile.vx = 0;
        projectile.vy = 0;
        projectile.parent.removeChild(projectile)
      }
    }
  })

  if (!player.initialized || !(player.vx == 0 && player.vy == 0)) {
    player.initialized = true;

    if (isClippableAt(player.x + player.vx, player.y + player.vy)) {
      player.x += player.vx;
      player.y += player.vy;

      if (player.sprite) {
        player.sprite.x = player.x;
        player.sprite.y = player.y;

        if (outerFogOfWar === undefined) {
          innerFogOfWar = new PIXI.Graphics();
          innerFogOfWar.lineStyle(window.innerWidth / 7, 0x000000, 0.8);
          innerFogOfWar.beginFill(0x000000, 0);
          innerFogOfWar.drawCircle(0, 0, window.innerWidth / 3.5);
          innerFogOfWar.endFill();
          innerFogOfWar.x = player.x;
          innerFogOfWar.y = player.y;
          fogOfWarContainer.addChild(innerFogOfWar);

          outerFogOfWar = new PIXI.Graphics();
          outerFogOfWar.lineStyle(window.innerWidth / 3, 0x000000, 1);
          outerFogOfWar.beginFill(0x000000, 0.1);
          outerFogOfWar.drawCircle(0, 0, window.innerWidth / 2);
          outerFogOfWar.endFill();
          outerFogOfWar.x = player.x;
          outerFogOfWar.y = player.y;
          fogOfWarContainer.addChild(outerFogOfWar);

        } else {
          innerFogOfWar.x = player.x;
          innerFogOfWar.y = player.y;
          outerFogOfWar.x = player.x;
          outerFogOfWar.y = player.y;
        }
      }
    }

    socket.emit("moved", { id: player.id, x: player.x, y: player.y });
  }

  // Move projectiles that are in motion
  projectiles.forEach(function(projectile) {
    if (isClippableAt(projectile.x + projectile.vx, projectile.y + projectile.vy)) {
      projectile.x += projectile.vx;
      projectile.y += projectile.vy;
    } else {
      projectile.parent.removeChild(projectile)
      projectile.vx = 0;
      projectile.vy = 0;
    }
  })

  // remove projectiles that have collided with walls
  projectiles = projectiles.filter(function(projectile) {
    return !(projectile.vx == 0 && projectile.vy == 0)
  })
}

function centreViewportOnPlayer() {
  var newX = app.renderer.screen.width / 2 - player.x;
  var newY = app.renderer.screen.height / 2 - player.y;

  app.stage.setTransform(newX, newY);
  overlayContainer.setTransform(player.x - app.renderer.screen.width / 2, player.y - app.renderer.screen.height / 2)
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

  for (var x = 0; x < MAP_SIZE; x += TILE_SIZE) {
    for (var y = 0; y < MAP_SIZE; y += TILE_SIZE) {
      if (x == 0 && y == 0) {
        var tile = new PIXI.Sprite(topLeftTileTexture);
      } else if (y == 0 && x + TILE_SIZE >= MAP_SIZE) {
        var tile = new PIXI.Sprite(topRightTileTexture);
      } else if (y == 0) {
        var tile = new PIXI.Sprite(topTileTexture);
      } else if (y + TILE_SIZE >= MAP_SIZE && x + TILE_SIZE >= MAP_SIZE) {
        var tile = new PIXI.Sprite(bottomRightTileTexture);
      } else if (x + TILE_SIZE >= MAP_SIZE) {
        var tile = new PIXI.Sprite(rightTileTexture);
      } else if (x == 0 && y + TILE_SIZE >= MAP_SIZE) {
        var tile = new PIXI.Sprite(bottomLeftTileTexture);
      } else if (y + TILE_SIZE >= MAP_SIZE) {
        var tile = new PIXI.Sprite(bottomTileTexture);
      } else if (x == 0) {
        var tile = new PIXI.Sprite(leftTileTexture);
      } else {
        var tile = new PIXI.Sprite(standardTileTexture);
      }

      tile.x = x;
      tile.y = y;

      tileContainer.addChild(tile);
    }
  }
}

function registerProjectile({x, y, vx, vy, owner}) {
  var sprite = new PIXI.Sprite(PIXI.utils.TextureCache["Projectile"]);
  sprite.x = x
  sprite.y = y
  sprite.vx = vx
  sprite.vy = vy
  sprite.owner = owner;

  sprite.anchor.set(0.5);

  projectileContainer.addChild(sprite)
  projectiles.push(sprite)
}

function calculateProjectileFromPlayer() {
  var projectile = {vx: 0, vy: 0}

  projectile.vx = player.lastDirection.x * PROJECTILE_SPEED
  projectile.vy = player.lastDirection.y * PROJECTILE_SPEED
  projectile.x = player.x
  projectile.y = player.y
  projectile.owner = player.id

  return projectile
}

function notifyServerOfShotFired(projectile) {
    socket.emit('shotsFired', {
      x: projectile.x,
      y: projectile.y,
      vx: projectile.vx,
      vy: projectile.vy,
      owner: player.id
    })
}

function tryShoot() {
  if (canShootNext <= gameTick) {
    projectile = calculateProjectileFromPlayer()
    registerProjectile(projectile)
    notifyServerOfShotFired(projectile)

    canShootNext = gameTick + 30;
  }
}

function reducePlayerHealth() {
  healthBar.outer.width -= 32;
  if (healthBar.outer.width == 0) {
    playerDead();
  }
}

function playerDead() {
  healthBar.message.text = " ☠️ ";
  showDeathScreen();
  socket.emit("playerDead", { playerId: player.id });
}

function showDeathScreen() {
  message = new PIXI.Text(
    "YOU DED\n" + "BETTER LUCK NEXT TIME!",
    {fontSize: "64px", fontFamily: "Comic Sans MS", fill: "white"}
  );

  message.x = 120;
  message.y = (app.screen.height - 180);
  overlayContainer.addChild(message);
}

function isClippableAt(x, y) {
  clippableSprites = ["Standard Tile"];

  // the getChildAt simply gets the sprite at the array Index we give, we can
  // calculate the array index from the given x and y values. The stage stores
  // all of the sprites in a single array so we need to mutliple the y value by
  // the offset of a row
  calculatedIndex = Math.floor(x / TILE_SIZE) + (Math.floor(y / TILE_SIZE) * (MAP_SIZE / TILE_SIZE));
  spriteName = tileContainer.getChildAt(calculatedIndex).texture.textureCacheIds[0];

  return clippableSprites.indexOf(spriteName) !== -1;
}

function collision(r1, r2) {
  return (
    r1.x < r2.x + r2.width &&
    r1.x + r1.width > r2.x &&
    r1.y < r2.y + r2.height &&
    r1.height + r1.y > r2.y
  );
}

document.addEventListener("DOMContentLoaded", main);
