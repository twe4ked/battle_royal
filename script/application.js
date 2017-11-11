var app = new PIXI.Application(mapSize, mapSize, { backgroundColor: 0xfacade });
var tileSize = 32;
var mapSize = tileSize * 64;  // 2048 x 2048 arena
var gameTick = 0;
var player;
var projectiles = [];
var canShootNext = 0;
var playerMovementSpeed = 5;
var projectileSpeed = 20;
var world = {};
var otherPlayerSprites = new PIXI.Container();
var lootSprites = new PIXI.Container();
var playerLastDirection = 'down';
var healthBar;
var playersRemainingMessage;
var overlayContainer;
var hitboxSize = tileSize / 2;

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

function main() {
  PIXI.loader.add("assets/treasureHunter.json").load(setup);
}

function setupKeyHandling() {
  var
    leftKey = keyboard(37),
    upKey = keyboard(38),
    rightKey = keyboard(39),
    downKey = keyboard(40),
    spaceKey = keyboard(32),
    aKey = keyboard(65),
    wKey = keyboard(87),
    dKey = keyboard(68),
    sKey = keyboard(83);

  spaceKey.press = tryShoot;

  aKey.press = leftKey.press = function() {
    player.vx = -playerMovementSpeed;
    playerLastDirection = 'left';
  }

  aKey.release = leftKey.release = function() {
    if (player.vx < 0) {
      player.vx = 0
    }
  };

  wKey.press = upKey.press = function() {
    player.vy = -playerMovementSpeed;
    playerLastDirection = 'up';
  };

  wKey.release = upKey.release = function() {
    if (player.vy < 0) {
      player.vy = 0;
    }
  };

  dKey.press = rightKey.press = function() {
    player.vx = playerMovementSpeed;
    playerLastDirection = 'right';
  };
  dKey.release = rightKey.release = function() {
    if (player.vx > 0) {
      player.vx = 0;
    }
  };

  sKey.press = downKey.press = function() {
    player.vy = playerMovementSpeed;
    playerLastDirection = 'down';
  };

  sKey.release = downKey.release = function() {
    if (player.vy > 0) {
      player.vy = 0;
    }
  };
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

  player = {
    x: app.renderer.width / 2,
    y: app.renderer.height / 2,
    vx: 0,
    vy: 0,
    id: Math.random().toString(),
    width: PIXI.utils.TextureCache["Player"].width,
    height: PIXI.utils.TextureCache["Player"].height,
  }

  app.stage.addChild(otherPlayerSprites);
  app.stage.addChild(lootSprites);

  overlayContainer = new PIXI.Container();
  overlayContainer.width = window.innerWidth;
  overlayContainer.height = window.innerHeight;
  app.stage.addChild(overlayContainer);

  setupKeyHandling();
  setupHealthBar()
  setupPlayersRemainingBar()

  socket = io();
  socket.emit("announce", { name: player.id });
  socket.on("worldUpdated", function(msg) {
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

            app.stage.addChild(player.sprite);
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
  });

  socket.on("shotsFired", function(projectile) {
    if (projectile.owner != player.id) {
      registerProjectile(projectile)
    }
  });

  socket.on("playerHit", function(msg) {
    if (msg.playerId == player.id) {
      reducePlayerHealth();
    }
  });

  state = play;
  gameLoop();
}

function gameLoop() {
  gameTick++;
  centreViewportOnPlayer();
  requestAnimationFrame(gameLoop);
  state();
  app.renderer.render(app.stage);
}

function play() {
  // Check if any projectiles have hit another player
  projectiles.forEach(function(projectile) {
    for (var playerId in world.clients) {
      if (playerId != projectile.owner && Math.abs(projectile.x -
            world.clients[playerId].location.x) <= hitboxSize &&
          Math.abs(projectile.y - world.clients[playerId].location.y) <=
          hitboxSize) {
        if(projectile.owner == player.id) {
          socket.emit("playerHit", { playerId: playerId });
        }
        projectile.vx = 0;
        projectile.vy = 0;
        projectile.parent.removeChild(projectile)
      }
    }
  })

  if (isClippableAt(player.x + player.vx, player.y + player.vy)) {
    player.x += player.vx;
    player.y += player.vy;

    if (player.sprite) {
      player.sprite.x = player.x;
      player.sprite.y = player.y;
    }
  }

  socket.emit("moved", { id: player.id, x: player.x, y: player.y });

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

function registerProjectile({x, y, vx, vy, owner}) {
  var sprite = new PIXI.Sprite(PIXI.utils.TextureCache["Projectile"]);
  sprite.x = x
  sprite.y = y
  sprite.vx = vx
  sprite.vy = vy
  sprite.owner = owner;

  sprite.anchor.set(0.5);

  app.stage.addChild(sprite)
  projectiles.push(sprite)
}

function calculateProjectileFromPlayer() {
  var projectile = {vx: 0, vy: 0}

  if (playerLastDirection == 'up') {
    projectile.vy = -projectileSpeed;
  } else if (playerLastDirection == 'down') {
    projectile.vy = projectileSpeed;
  } else if (playerLastDirection == 'left') {
    projectile.vx = -projectileSpeed;
  } else if (playerLastDirection == 'right') {
    projectile.vx = projectileSpeed;
  }

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
  socket.emit("playerDead", { playerId: player.id });
}

function isClippableAt(x, y) {
  clippableSprites = ["Standard Tile"];

  // the getChildAt simply gets the sprite at the array Index we give, we can
  // calculate the array index from the given x and y values. The stage stores
  // all of the sprites in a single array so we need to mutliple the y value by
  // the offset of a row
  calculatedIndex = Math.floor(x / tileSize) + (Math.floor(y / tileSize) * (mapSize / tileSize));
  spriteName = app.stage.getChildAt(calculatedIndex).texture.textureCacheIds[0];

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
