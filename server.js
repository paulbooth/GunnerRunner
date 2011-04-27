var http = require('http'),
io = require('socket.io'),
path = require('path'),
paperboy = require('paperboy');

var players = 0;



server = http.createServer(function(req, res) {
    paperboy.deliver(path.dirname(__filename), req, res);
    });

server.listen(8080, '0.0.0.0');

var socket = io.listen(server);

var pilotTaken = false;
var gunnerTaken = false;
var pilotClient = null, gunnerClient = null;
var waiting = [];
socket.on('connection', function(client) {
	    /*getNetworkIP(function (error, ip) {
			   console.log(ip);
			   if (error) {
			     console.log('error:', error);
			   }
			 }, false);
	    // usage example for getNetworkIP below*/
	    if (!pilotTaken) {
	      client.send({'role': 'pilot'});
	      client.role = 'pilot';
		pilotClient = client;
	      pilotTaken = true;
		client.send({'background': "#0F0"});
	      console.log('PILOT CONNECTED');
	    } else if (!gunnerTaken) {
	      client.send({'role': 'gunner'});
		client.send({'background': "#0F0"});
		gunnerClient = client;
	      client.role = 'gunner';
	      gunnerTaken = true;
	      console.log('GUNNER CONNECTED');
	    } else {
		client.send({role:'waiting'});
		waiting.push(client);
		client.send({'background': "#F00"});
		client.send({alert:'too many players'});
	    }

	    if (pilotTaken && gunnerTaken) {
		pilotClient.send({'background': "#FFF"});
		gunnerClient.send({'background':"#FFF"});
	      pilotClient.send({'gameStart': true});
	      gunnerClient.send({'gameStart': true});
	    }

	    client.on('message', function(event) {
			client.broadcast(event);
			//console.log('client message: ' + event);
		      });
	    client.on('disconnect', function(event) {
			console.log('our ' + client.role + " disconnected :'-(");
			if (client.role === 'pilot') {
			  pilotTaken = false;
			    pilotClient = null;
			} else if (client.role === 'gunner') {
			  gunnerTaken = false;
			    gunnerClient = null;
			} else {
			  console.log('Our...other guy... disconnected...');
			}
			  if (client.role == 'pilot'
			      || client.role == 'gunner') {
			      if (waiting.length == 0) {
				  client.broadcast({'background': "#0F0"});
			      } else {
				  waiting[0].send({reconnect:client.role});
				  waiting.splice(0,1);
			      }

			  }

		      });
	    /*setInterval(function() {
	     client.send('message');
	     }, 5000); */
	  });

var getNetworkIP = (function () {
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