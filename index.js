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
    var player = { connected: true, name: player.name };
    clients[player.name] = player;

    console.log("All players:");

    for (var client in clients) {
      console.log(client);
    }
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

    io.emit("world_updated", clients);
  });

  socket.on("disconnect", function() {
    console.log(`should get rid of somebody..`);
  });
});

http.listen(port, function() {
  console.log("listening on *:" + port);
});
