var app = require("express")();
var http = require("http").Server(app);
var io = require("socket.io")(http);
var port = process.env.PORT || 3000;
var clients = {};

app.get("*", function(req, res) {
  if (req.path === "/") {
    res.sendFile(__dirname + "/index.html");
  } else {
    res.sendFile(__dirname + req.path);
  }
});

io.on("connection", function(socket) {
  socket.on("announce", function(player) {
    clients[player.name] = { name: player.name, socket: socket.id };
  });

  socket.on("moved", function(locationMsg) {
    player = clients[locationMsg.id];

    if (!player) {
      return;
    }

    player.location = {
      x: locationMsg.x,
      y: locationMsg.y
    };
  });

  socket.on("disconnect", function() {
    console.log(`Disconnecting ${socket.id}`)
    var newClients = {}
    for (var client_id in clients) {
      if (clients[client_id].socket != socket.id) {
        newClients[client_id] = clients[client_id]
      }
    }
    clients = newClients
  });
});

setInterval(function() {
  io.emit("world_updated", clients);
}, 1000 / 60);

http.listen(port, function() {
  console.log("listening on *:" + port);
});
