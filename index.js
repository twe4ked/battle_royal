var app = require("express")();
var _ = require("lodash");
var http = require("http").Server(app);
var io = require("socket.io")(http);
var port = process.env.PORT || 3000;
var clients = {};

function newLoot() {
  return {
    id: Math.random().toString(),
    x: _.random(0, 2047),
    y: _.random(0, 2047),
  }
}

// TODO: `loot` should be a hash with the `id` as the key.
var loot = _.times(10, function() { return newLoot(); });

app.get("*", function(req, res) {
  if (req.path === "/") {
    res.sendFile(__dirname + "/index.html");
  } else {
    res.sendFile(__dirname + req.path);
  }
});

function playerIsUnworthy(playerId) {
  player = clients[playerId]
  return (player === undefined || player.alive !== true)
}

function resetRound() {
  for (var client_id in clients) {
    clients[client_id].alive = true
  }

  io.emit("roundStarted")
}

function playersRemainingCount() {
  return _.filter(clients, (client) => (client.alive)).length
}

io.on("connection", function(socket) {
  socket.on("announce", function(player) {
    clients[player.name] = {
      name: player.name,
      socket: socket.id,
      alive: false,
      playerName: player.playerName
    };
  });

  socket.on("moved", function(locationMsg) {
    player = clients[locationMsg.id]
    if (player === undefined) { return }

    player.location = {
      x: locationMsg.x,
      y: locationMsg.y
    };
  });

  socket.on("shotsFired", function(payload) {
    if (playerIsUnworthy(payload.owner)) { return }

    io.emit("shotsFired", payload)
  });

  socket.on("gotLoot", function(payload) {
    newLoots = _.reject(loot, function(l) { return l.id === payload.lootId })
    newLoots.unshift(newLoot())
    loot = newLoots
  })

  socket.on("playerHit", function(msg) {
    if (playerIsUnworthy(msg.reporterId)) { return }

    clients[msg.playerId].health -= 1;
    io.emit("playerHit", msg);
  });

  socket.on("playerDead", function(msg) {
    clients[msg.playerId].health = 0;
    clients[msg.playerId].alive = false;
    io.emit("playerDead", msg);

    if (playersRemainingCount() <= 1) {
      io.emit("roundEnded")
    }
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

  socket.on("newRoundRequested", function() {
    resetRound()
  })
});

setInterval(function() {
  let gameInProgress = playersRemainingCount() > 1

  io.emit("worldUpdated", {
    clients,
    loot,
    allPlayersCount: Object.keys(clients).length,
    playersRemainingCount: playersRemainingCount(),
    gameInProgress,
  });
}, 1000 / 60);

http.listen(port, function() {
  console.log("listening on *:" + port);
});
