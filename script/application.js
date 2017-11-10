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

var app;
function main() {
  app = new PIXI.Application(800, 600, {backgroundColor : 0x000000});
  document.body.appendChild(app.view);

  app.renderer.view.style.position = "absolute";
  app.renderer.view.style.display = "block";
  app.renderer.autoResize = true;
  app.renderer.resize(window.innerWidth, window.innerHeight);

  window.addEventListener("optimizedResize", function() {
    app.renderer.resize(window.innerWidth, window.innerHeight);
  });

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
