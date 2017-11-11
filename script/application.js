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

function main() {
  PIXI.loader
    .add("assets/treasureHunter.json")
    .load(setup);
}

var app;
function setup() {
  app = new PIXI.Application(800, 600, {backgroundColor : 0x000000});
  document.body.appendChild(app.view);

  app.renderer.view.style.position = "absolute";
  app.renderer.view.style.display = "block";
  app.renderer.autoResize = true;
  app.renderer.resize(window.innerWidth, window.innerHeight);

  console.log(app.stage);

  window.addEventListener("optimizedResize", function() {
    console.log('window is being resized');;
    app.renderer.resize(window.innerWidth, window.innerHeight);
  });

  var dungeonTexture = PIXI.utils.TextureCache["dungeon.png"];
  var dungeon = new PIXI.Sprite(dungeonTexture);
  app.stage.addChild(dungeon);

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

document.addEventListener("DOMContentLoaded", main)
