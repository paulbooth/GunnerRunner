var http = require('http'),
io = require('socket.io'),
path = require('path'),
paperboy = require('paperboy');

var server = http.createServer(function(req, res) {
    paperboy.deliver(path.dirname(__filename), req, res);
    });

server.listen(80);
io = io.listen(server);
io.set('log level', 1);

var players = 0;
var pilotTaken = false;
var gunnerTaken = false;
var pilotClient = null, gunnerClient = null;
var waiting = [];
io.sockets.on('connection', function(socket) {
	    getNetworkIP(function (error, ip) {
			   console.log(ip);
			   if (error) {
			     console.log('error:', error);
			   }
			 }, false);
	    // usage example for getNetworkIP below
	    if (!pilotTaken) {
		pilotTaken = true;
		socket.emit('role', 'pilot');
	      socket.role = 'pilot';
		pilotSocket = socket;
		//socket.emit('background', "#000");
	      console.log('PILOT CONNECTED');
	    } else if (!gunnerTaken) {
		gunnerTaken = true;
		socket.emit('role', 'gunner');
		//socket.emit('background', "#0F0");
		gunnerSocket = socket;
	      socket.role = 'gunner';
	      console.log('GUNNER CONNECTED');
	    } else {
		socket.emit('role', 'waiting');
		waiting.push(socket);
		//socket.emit('background', "#F00");
		socket.emit('alert', 'too many players');
	    }

	    if (pilotTaken && gunnerTaken) {
		//pilotSocket.emit('background', "#FFF");
		//gunnerSocket.emit('background', "#FFF");
	      pilotSocket.emit('gameStart');
	      gunnerSocket.emit('gameStart');
	    }

		  socket.on('message', function(event) {
			  socket.broadcast.volatile.send(event);
		  });
		  socket.on('bounce', function() {
				socket.broadcast.emit('bounce');
			    });
		  socket.on('barrier', function(barrier) {
				socket.broadcast.emit('barrier', barrier);
			    });
		  socket.on('bullet', function(bullet) {
				socket.broadcast.volatile.emit('bullet', bullet);
			    });
		  socket.on('enemy', function(enemy) {
				socket.broadcast.emit('enemy', enemy);
			    });
		  socket.on('gameOver', function() {
				socket.broadcast.emit('gameOver');
			    });
		  socket.on('heal', function(amount) {
				socket.broadcast.emit('heal', amount);
			    });
		  socket.on('health', function(health) {
				socket.broadcast.emit('health', health);
			    });
		  socket.on('hurt', function(amount) {
				socket.broadcast.emit('hurt', amount);
			    });
	    socket.on('disconnect', function(event) {
			console.log('our ' + socket.role + " disconnected :'-(");
			if (socket.role === 'pilot') {
			  pilotTaken = false;
			    pilotSocket = null;
			} else if (socket.role === 'gunner') {
			  gunnerTaken = false;
			    gunnerSocket = null;
			} else {
			  console.log('Our...other guy... disconnected...');
			    var indx = waiting.indexOf(socket);
			    if (indx != -1) {
				waiting.splice(indx, 1);
			    }
			}
			if (socket.role == 'pilot'
			    || socket.role == 'gunner') {
			    if (waiting.length == 0) {
				//socket.broadcast.emit('background', "#0F0");
			    } else {
				waiting[0].emit('reconnect', socket.role);
				waiting.splice(0,1);
			    }
			}
		      });
	    /*setInterval(function() {
	     socket.send('message');
	     }, 5000); */
	  });

var getNetworkIP = (
    function () {
	var ignoreRE = /^(127\.0\.0\.1|::1|fe80(:1)?::1(%.*)?)$/i;

	var exec = require('child_process').exec;
	var cached;
	var command;
	var filterRE;

	switch (process.platform) {
	    // TODO: implement for OSs without ifconfig command
	case 'darwin':
	    command = 'ifconfig';
	    filterRE = /\binet\s+([^\s]+)/g;
	    // filterRE = /\binet6\s+([^\s]+)/g; // IPv6
	    break;
	default:
	    command = 'ifconfig';
	    filterRE = /\binet\b[^:]+:\s*([^\s]+)/g;
	    // filterRE = /\binet6[^:]+:\s*([^\s]+)/g; // IPv6
	    break;
	}

	return function (callback, bypassCache) {
	    // get cached value
	    if (cached && !bypassCache) {
		callback(null, cached);
		return;
	    }
	    // system call
	    exec(command, function (error, stdout, sterr) {
		     var ips = [];
		     // extract IPs
		     var matches = stdout.match(filterRE);
		     // JS has no lookbehind REs, so we need a trick
		     for (var i = 0; i < matches.length; i++) {
			 ips.push(matches[i].replace(filterRE, '$1'));
		     }

		     // filter BS
		     for (var i = 0, l = ips.length; i < l; i++) {
			 if (!ignoreRE.test(ips[i])) {
			     //if (!error) {
			     cached = ips[i];
			     //}
			     callback(error, ips[i]);
			     return;
			 }
		     }
		     // nothing found
		     callback(error, null);
		 });
	};
    })();