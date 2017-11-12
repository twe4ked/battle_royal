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
  const PAUSED_MS = 12000
  const ACTIVE_MS = 4000
  const INITIAL_RADIUS = 1.3 * (MAP_SIZE / 2)
  const INITIAL_X = MAP_SIZE / 2
  const INITIAL_Y = MAP_SIZE / 2
  const SHRINK_RATIO = 0.7

  x = x || INITIAL_X
  y = y || INITIAL_Y
  radius = radius || INITIAL_RADIUS

  var elapsed_ms = 0;
  var upcomingCircle;

  var calculateUpcomingCircle = () => {
    if (upcomingCircle === undefined) {
      upcomingRadius = radius * SHRINK_RATIO
      min_x = (x - radius + upcomingRadius)
      max_x = (x + radius - upcomingRadius)
      min_y = (y - radius + upcomingRadius)
      max_y = (y + radius - upcomingRadius)

      upcomingCircle = new DeathCircle(
        _.random(min_x, max_x),
        _.random(min_y, max_y),
        upcomingRadius,
      )
    }

    return upcomingCircle
  }

  var interpolate = (oldDimensions, newDimensions, progression) => {
    x_diff = newDimensions.x - oldDimensions.x
    y_diff = newDimensions.y - oldDimensions.y
    radius_diff = newDimensions.radius - oldDimensions.radius

    return {
      x: oldDimensions.x + x_diff * progression,
      y: oldDimensions.y + y_diff * progression,
      radius: oldDimensions.radius + radius_diff * progression,
    }
  }

  var currentDimensions = () => {
    oldDimensions = {x, y, radius}
    if (elapsed_ms < PAUSED_MS) {
      return oldDimensions
    } else {
      return interpolate(oldDimensions, upcomingCircle.currentDimensions(), (elapsed_ms - PAUSED_MS) / ACTIVE_MS)
    }
  }

  var tick = (time_ms) => {
    elapsed_ms += time_ms
  }

  var expired = () => {
    return elapsed_ms > (PAUSED_MS + ACTIVE_MS)
  }

  return {
    x,
    y,
    radius,
    upcomingCircle: calculateUpcomingCircle,
    currentDimensions,
    tick,
    expired,
  }
}

function newLoot() {
  return {
    id: Math.random().toString(),
    x: _.random((TILE_SIZE * 2), MAP_SIZE - (TILE_SIZE * 2)),
    y: _.random((TILE_SIZE * 2), MAP_SIZE - (TILE_SIZE * 2)),
  }
}

function newTree() {
  return {
    id: Math.random().toString(),
    x: _.random((TILE_SIZE * 2), MAP_SIZE - (TILE_SIZE * 2)),
    y: _.random((TILE_SIZE * 2), MAP_SIZE - (TILE_SIZE * 2)),
  }
}

// TODO: `loot` should be a hash with the `id` as the key.
var loot = _.times(50, function() { return newLoot(); });

// TODO: `trees` should scale according to map size
var trees = _.times(500, function() { return newTree(); });

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
      playerName: player.playerName,
      chicken_dinners: 0
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
      if (playersRemaining()[0] !== undefined) {
        playersRemaining()[0].chicken_dinners++
      }

      io.emit("roundEnded", {
        winner: playersRemaining()[0] || "No one"
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

SERVER_HZ = 60
setInterval(function() {
  let gameInProgress = playersRemainingCount() > 1

  deathCircle.tick(1000 / SERVER_HZ)
  if (deathCircle.expired()) { deathCircle = deathCircle.upcomingCircle() }

  io.emit("worldUpdated", {
    clients,
    trees,
    loot,
    allPlayersCount: Object.keys(clients).length,
    playersRemainingCount: playersRemainingCount(),
    gameInProgress,
    deathCircle: deathCircle.currentDimensions(),
    upcomingDeathCircle: deathCircle.upcomingCircle().currentDimensions(),
  });
}, 1000 / SERVER_HZ);

http.listen(port, function() {
  resetRound()
  console.log("listening on *:" + port)
})
