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


var app = new PIXI.Application(mapSize, mapSize, {backgroundColor : 0x000000});
var tileSize = 32;
var mapSize = tileSize * 64;  // 2048 x 2048 arena

function main() {
  PIXI.loader
    .add("assets/treasureHunter.json")
    .load(setup);
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

  renderInitialTiles()
  state = play;
  gameLoop()
};

function gameLoop() {
  requestAnimationFrame(gameLoop);
  state();
  app.renderer.render(app.stage);
}

function play() {
  // TODO
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
