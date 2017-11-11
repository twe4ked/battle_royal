var app = require("express")();
var _ = require("lodash");
var http = require("http").Server(app);
var io = require("socket.io")(http);
var port = process.env.PORT || 3000;
var clients = {};
var loot = _.times(10, function() { return {x: _.random(0, 2047), y: _.random(0, 2047)} });

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

  socket.on("shotsFired", function(payload) {
    console.log("Shot fired!", payload)
    io.emit("shotsFired", payload)
  })

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
  io.emit("world_updated", {
    clients: clients,
    loot: loot
  });
}, 1000 / 60);

http.listen(port, function() {
  console.log("listening on *:" + port);
});
