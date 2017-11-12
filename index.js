var app = require("express")();
var _ = require("lodash");
var http = require("http").Server(app);
var io = require("socket.io")(http);
var port = process.env.PORT || 3000;
var clients = {};
var devMode = process.env.DEV == 'true';

function tile_multiplier() {
  if (devMode) {
    return 1;
  } else {
    return 16;
  }
}

const TILES_IN_BIG_TILE = 13;
const TILE_SIZE = 32;
const MAP_SIZE = (TILE_SIZE * ((TILES_IN_BIG_TILE * tile_multiplier()) + 2));
const DEV_MODE = devMode;

var deathCircle;

function DeathCircle(x, y, radius) {
  const PAUSED_MS = 5000
  const ACTIVE_MS = 2000
  const INITIAL_RADIUS = 300 // units of some kind?
  const INITIAL_X = 50 // units of some kind?
  const INITIAL_Y = 50 // units of some kind?
  const SHRINK_RATIO = 0.8

  x = x || INITIAL_X
  y = y || INITIAL_Y
  radius = radius || INITIAL_RADIUS

  var upcomingCircle;
  var calculateUpcomingCircle = () => {
    if (upcomingCircle === undefined) {
      upcomingCircle = new DeathCircle(x, y, radius * SHRINK_RATIO)
    }

    return upcomingCircle
  }

  var currentDimensions = () => {
    return {x: x, y: y, radius: radius}
  }

  return {
    x,
    y,
    radius,
    upcomingCircle: calculateUpcomingCircle,
    currentDimensions,
  }
}

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

  deathCircle = new DeathCircle()
  io.emit("roundStarted")
}

function playersRemaining() {
  return _.filter(clients, (client) => (client.alive))
}

function playersRemainingCount() {
  return playersRemaining().length
}

io.on("connection", function(socket) {
  socket.on("announce", function(player) {
    clients[player.id] = {
      id: player.id,
      socket: socket.id,
      alive: false,
      playerName: player.playerName
    };
    io.emit("worldSettings", {
      TILES_IN_BIG_TILE,
      TILE_SIZE,
      MAP_SIZE,
      DEV_MODE,
    }); 
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
      io.emit("roundEnded", {
        winner: playersRemaining()[0]
      })
    }
  });

  socket.on("disconnect", function() {
    var newClients = {}
    for (var client_id in clients) {
      if (clients[client_id].socket != socket.id) {
        newClients[client_id] = clients[client_id]
      } else {
        console.log(`Disconnecting "${clients[client_id].playerName}" (${socket.id})`)
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
    deathCircle: deathCircle.currentDimensions(),
    upcomingCircle: deathCircle.upcomingCircle().currentDimensions(),
  });
}, 1000 / 60);

http.listen(port, function() {
  resetRound()
  console.log("listening on *:" + port)
})
