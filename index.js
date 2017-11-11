var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var port = process.env.PORT || 3000;

app.get('*', function(req, res){
  if (req.path === "/") {
    res.sendFile(__dirname + '/index.html');
  } else {
    res.sendFile(__dirname + req.path);
  }
});

io.on('connection', function(socket){
  socket.on('game', function(message){
    console.log(message)
    io.emit('game', message);
  });
});

http.listen(port, function(){
  console.log('listening on *:' + port);
});
