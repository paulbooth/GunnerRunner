var http = require('http'),
io = require('socket.io'),
path = require('path'),
express = require('express'),
app = express.createServer();
//paperboy = require('paperboy');

/*var server = http.createServer(function(req, res) {
  paperboy.deliver(path.dirname(__filename), req, res);
  });

  server.listen(80);*/

app.listen(1337);
app.configure(function(){
    //app.use(express.methodOverride());
    //app.use(express.bodyParser());
    //app.use(app.router);
    app.use(express.static(__dirname));
    app.use(express.errorHandler({dumpExceptions: true, showStack: true}));
});

app.get('*', function(req, res) {
    //writeObj(req.headers);
    if (req.params[0].split('/').length > 2) {
	res.send('Don\'t/use/those/slash/things/in/your/room/name!');
    } else if (req.params == '/' || req.params == '') {
	//res.sendfile(__dirname + '/hello.html');
	var gameLink = 'http://' + req.headers.host + '/' +
	    getRandomTrochee() + getRandomTrochee();
	res.send('<html><head><style>' +
		 '* {text-align:center; font-size:30px}' + 
		 '</style>' +
		 '<script type="text/javascript">\
\
  var _gaq = _gaq || [];\
  _gaq.push([\'_setAccount\', \'UA-22087329-3\']);\
  _gaq.push([\'_trackPageview\']);\
\
  (function() {\
    var ga = document.createElement(\'script\'); ga.type = \'text/javascript\'; ga.async = true;\
    ga.src = (\'https:\' == document.location.protocol ? \'https://ssl\' : \'http://www\') + \'.google-analytics.com/ga.js\';\
    var s = document.getElementsByTagName(\'script\')[0]; s.parentNode.insertBefore(ga, s);\
  })();\
\
</script>' +
		 '</head><body>' +
		 '<image src="gunnerrunnerlogo.png" width=100%/>' + 
		 '<p>Get a link from a friend, or share a link like this one:<p>' +
		 '<a href="' + gameLink + '">' + gameLink +
		 '</a></body></html>');
    } else {
	res.sendfile(__dirname + '/player.html');
    }
});

io = io.listen(app);
io.set('log level', 1);

var waiting = [];
var pairs = [];
io.sockets.on('connection', function(socket) {
    var address = socket.handshake.address;
    var urlParts = socket.handshake.headers.referer.split('/');
    var room = urlParts[urlParts.length - 1].toLowerCase();
    //console.log('room:' + room);
    console.log("New connection from " + address.address + ":" + address.port +
	       " in room " + room);
    var pilotTaken = false;
    var gunnerTaken = false;
    // we have an empty room!
    if (!pairs[room]) pairs[room] = [];
    var pair = pairs[room]; //getNextAvailablePair();
    socket.room = room;
    socket.pair = pair;
    for (var i = 0; i < pair.length; i++) {
	var otherplayer = pair[i];
	if (otherplayer != null) {
	    if (otherplayer.role == 'pilot') {
		pilotTaken = true;
	    } else if (otherplayer.role == 'gunner') {
		gunnerTaken = true;
	    }
	}
    }
    pair.push(socket);
    if (!pilotTaken) {
	socket.emit('role', 'pilot');
	socket.role = 'pilot';
	//pilotSocket = socket;
	//socket.emit('background', "#000");
	console.log('Pilot in room ' + room);
    } else if (!gunnerTaken) {
	gunnerTaken = true;
	socket.emit('role', 'gunner');
	//socket.emit('background', "#0F0");
	//gunnerSocket = socket;
	socket.role = 'gunner';
	console.log('Gunner in room ' + room);
    } else {
	socket.emit('role', 'waiting');
	//waiting.push(socket);
	//console.error('A waiter just tried to get served.');
	socket.emit('background', '#AFA');
	socket.emit('alert', 'The room ' + room + ' is full. Try another one!');
	socket.emit('lobby');
    }

    //if (pilotTaken && gunnerTaken) {
    if (pair.length == 2) {
	//pilotSocket.emit('background', "#FFF");
	//gunnerSocket.emit('background', "#FFF");
	//pilotSocket.emit('gameStart');
	//gunnerSocket.emit('gameStart');
	pair[0].emit('gameStart');
	pair[1].emit('gameStart');
	pair[0].gameStart = true;
	pair[1].gameStart = true;
	pair[0].otherPlayer = pair[1];
	pair[1].otherPlayer = pair[0];
    } else {
	socket.gameStart = false;
    }

    socket.on('message', function(event) {
	if (socket.gameStart) {
	    socket.otherPlayer.volatile.send(event);
	}
    });
    socket.on('bounce', function() {
	if (socket.gameStart) {
	    socket.otherPlayer.emit('bounce');
	}
    });
    socket.on('barrier', function(barrier) {
	if (socket.gameStart) {
	    socket.otherPlayer.emit('barrier', barrier);
	}
    });
    socket.on('bullet', function(bullet) {
	if (socket.gameStart) {
	    socket.otherPlayer.volatile.emit('bullet', bullet);
	}
    });
    socket.on('enemy', function(enemy) {
	if (socket.gameStart) {
	    socket.otherPlayer.emit('enemy', enemy);
	}
    });
    socket.on('expGain', function(amount) {
	if (socket.gameStart) {
	    socket.otherPlayer.emit('expGain', amount);
	}
    });
    socket.on('exp', function(amount) {
	if (socket.gameStart) {
	    socket.otherPlayer.emit('exp', amount);
	}
    });
    socket.on('gameOver', function() {
	if (socket.gameStart) {
	    socket.otherPlayer.emit('gameOver');
	}
    });
    socket.on('heal', function(amount) {
	if (socket.gameStart) {
	    socket.otherPlayer.emit('heal', amount);
	}
    });
    socket.on('health', function(health) {
	if (socket.gameStart) {
	    socket.otherPlayer.emit('health', health);
	}
    });
    socket.on('hurt', function(amount) {
	if (socket.gameStart) {
	    socket.otherPlayer.emit('hurt', amount);
	}
    });
    socket.on('levelUp', function(amount) {
	if (socket.gameStart) {
	    socket.otherPlayer.emit('levelUp');
	}
    });
    socket.on('recoil', function(recoilVector) {
	if (socket.gameStart) {
	    socket.otherPlayer.emit('recoil', recoilVector);
	}
    });
    socket.on('disconnect', function(event) {
	console.log('our ' + socket.role + " disconnected from room " + socket.room);
	var index = socket.pair.indexOf(socket);
	if (index == -1) { console.error('OH MY SWEET GOSH NOOOOO!!!: ' + socket.pair);}
	pair.splice(index, 1);
	if (socket.role == 'gunner' || socket.role == 'pilot') {
	    if (socket.otherPlayer) {
		socket.otherPlayer.gameStart = false;
	    }
	    for (var i = 0; i < pair.length; i++) {
		var otherSocket = pair[i];
		if (otherSocket.role == 'waiting') {
		    otherSocket.emit('reconnect', socket.role);
		} else {
		    otherSocket.emit('drawText', 'Abandoned!');
		}
	    }
	}
	if (pair.length == 0) {
	    delete pair;
	    delete pairs[socket.room];
	}
	//pair.map(function(socket) { });
	/*if (socket.role === 'pilot') {
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
	  }*/
    });
    /*setInterval(function() {
      socket.send('message');
      }, 5000); */
});

function getNextAvailablePair() {
    for(var i = 0; i<pairs.length; i++) {
	switch(pairs[i].length) {
	case 0: 
	    pairs.splice(i,1);
	    i--;
	    break;
	case 1: 
	    return pairs[i];
	case 2:
	    break;
	default:
	    console.error('Why does pair #' + i +' have a length of ' 
			  + pairs[i].length + '?');
	}
    }
    var newpair = [];
    pairs.push(newpair);
    return newpair;
}

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

function getRandomTrochee() {
    var trochees = ["mighty", "morphing", "zombie", "fighter", "epic", "bacon", "burger", "blaster", "teenage", "mutant", "ninja", "turtle", "killer", "laser", "raptor", "jesus", "deadly", "viper", "pirate", "monkey", "hobo", "kitty", "robot", "lady", "power", "ranger", "batman", "chocolate", "rain", "puppy", "dino", "wombat", "gator", "poison", "rocker", "skater", "hater", "techno", "viking", "slasher", "winning", "tiger", "magic", "crystal", "vortex", "tower", "mega", "super", "ultra", "giant", "titan", "satyr", "smasher", "ancient", "elvin", "armor", "legend", "hammer", "castle", "iron", "maiden", "diesel", "motor", "gameboy", "console", "muscle", "flexing", "fairy", "woman", "toxic", "baby", "only", "japan", "captain", "falcon", "missile", "raider", "eagle", "satan", "lion", "demon", "madness", "sparta", "awesome", "jungle", "dolphin", "hamster", "venom", "studded", "bracelet", "trojan", "radar", "rocket", "master", "twisted", "metal", "jacket", "double", "rainbow", "heavy", "dragon", "lava", "dungeon", "level", "seven", "night-elf", "druid", "dark-lord", "vader", "frodo", "bilbo", "gandalf", "mordor", "mealtime", "drunken", "pancakes", "butter", "batter", "numa", "comic", "questing", "hero", "carebear", "stewart", "david", "badger", "mushroon", "nazi", "youtube", "myspace", "facebook", "blogger", "google", "yahoo", "ebay", "twitter", "wiki", "tumblr", "reddit", "flickr", "online", "gamer", "leeroy", "jenkens", "doctor", "narwhal", "penguin", "christmas"];
    var trochee = trochees[Math.floor(Math.random()*trochees.length)];
    return trochee.charAt(0).toUpperCase() + trochee.slice(1);
}


// helper method to print out an object
function objToString(obj, message) {
  if (!message) { message = obj; }
  var details = "*****************" + "\n" + message + "\n";
  var fieldContents;
  for (var field in obj) {
    fieldContents = obj[field];
    if (typeof(fieldContents) == "function") {
      fieldContents = "(function)";
    } else
    details += "  " + field + ": " + fieldContents + "\n";
  }
      return details;
}

function writeObj(obj, message) {
    console.log(objToString(obj, message));
}