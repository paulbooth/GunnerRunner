var socket;
var maxTunnelRadius;

//sound
//play sound effects?
var soundEffects = true;
//play background music?
var backgroundMusic = true;
var backgroundMusicURL = "audio/beat.mp3"; // "audio/Grandaddy - Jed's Other Poem (Beautiful Ground).mp3";

// aesthetics graphics
var cartoonBarriers = false;
var cartoonTunnel = false;
var cartoonEnemies = false;
var cartoonHud = false;
var barrierAlpha = 1;//.6;
var numTunnelLines = 7;
var tunnelLineSpeed = Math.PI/200;
var drawTime = 1000/60;

// physics
var updateTime = 1000/30;
var focalDist = 60;// + Math.random() * 80;
var lightDist = 5000;

//for both players
var playerMaxHealth = 100;
var playerMaxExp = 100;
var playerRegen = 0;
var score = 0;

// for pilot
var acceleration = .5, backwardAcceleration = .5;
var expPerBarrier = 7.5;

// for gunner
// how much experience per enemy taken down
var expPerEnemy = 2.5;
// cooldown time for machine gun
var bulletTime = 10;
// how fast the mouse moves the cursor
var gunMouseTrailProp = .15;

// for bullets
// how many updates bullets last
var bulletLifeTime = 300;
// how much damage a bullet does to enemies
var bulletDamage = 10;
//how fast bullets move
var bulletSpeed = 100;
//how big the bullets are
var bulletRadius = .02;

//for enemy
//how much health enemies have
var enemyHealth = 20;
//probability of enemy appearance
var enemyChance = .08;
//how big are the enemies?
//.5 - 1.5 times this size
var enemySize = .25;//enemySize = .25 * maxTunnelRadius;
//how much damage does an enemy do?
var enemyDamage = 7;
// how fast is the enemy?
var enemySpeed = 40;

//for barrier
//fraction of speed to move backwards when hit barrier
var barrierBounce = .35;
//amount of speed increase through hole
var barrierBoost = 5;
//thickness of barrier
var barrierThickness = 50;
//max health of barrier
var barrierHealth = 67;
// how spread out the barriers are (.5 - 1.5 of this value.)
// TODO: make a barrierSpreadVariation to not be limited to .5-1.5 of this value
var barrierSpread = 2000;
// keeps track of the minimum spawn distance
// (the last barrier has to be closer to the player than this value
//  for a new barrier to spawn.)
var barrierMinSpawnDist = lightDist - barrierSpread;

/*
//keyboard movement speed
var keyboardSpeed = .05;
//using keyboardcontrols?
//use zero for no, set which key in onkeyboard
var keyboardControl = [];
var kbforward = 32, //space
kbback = 66, //b
kbleft = 37, // left arrow
kbup = 38, // up arrow
kbright = 39, // right arrow
kbdown = 40; // down arrow
*/

//friction
var friction = .99;
//pilot cutoff speed
//less than this is the same as 0
var cutoffSpeed = .001;

var initialLineAngle = 0;
var player;
var drawingContext;

var maincanvas;
var updateIntervalId;
var drawIntervalId;
var centerY;
var centerX;

var hudHeight, hudWidth;
var hudAlpha = .5;

var numAudioChannels = 10;
var audioChannels = new Array(numAudioChannels);
var currentAudioChannel = 0;

var mousePressed = false, leftMouse = true;
var wentOutMousePressed = false;

var backgroundMusicChannel = new Audio();

function playSound(sound, volume) {
    if (!soundEffects) {
	return;
    }
    //console.log(sound);
    var audioChannel = audioChannels[currentAudioChannel];
    if (volume) {
	if (volume < .01) return;
	audioChannel.volume = Math.min(volume,1);
    } else {
	audioChannel.volume = 1;
    }
    //console.log(audioChannel.volume);
    audioChannel.src = "audio/"+sound+".ogg";
    audioChannel.load();
    audioChannel.play();
    currentAudioChannel++;
    if (currentAudioChannel == numAudioChannels) {
	currentAudioChannel = 0;
    }
}

function startBackgroundMusic() {
    backgroundMusicChannel.src = backgroundMusicURL;
    backgroundMusicChannel.load();
    backgroundMusicChannel.play();
    backgroundMusicChannel.addEventListener('ended', function(){
						backgroundMusicChannel.load();
						backgroundMusicChannel.play();
					    }, false);

}

function drawCircle(context, x, y, r, borderstyle, fillstyle) {
    context.beginPath();
    // we could use  a better system.
    // can I set up context before the call?
    // seperate strokeCircle, fillCircle calls? JSON object?
    // syntax reminder: x, y, r, start_angle, end_angle, anticlockwise
    //console.log(x,y,r);
    context.arc(x, y, r, 0, Math.PI*2, false);
    context.closePath();
    if (borderstyle != null) {
	context.strokeStyle = borderstyle;
	//context.lineWidth = 2;
	context.stroke();
    }
    if (fillstyle != null) {
	context.fillStyle = fillstyle;
	context.fill();
    }
}

function adjustFor3D(r, dist) {
    return r * focalDist / (dist + focalDist);
}

function getColorAtDistance(dist) {
    return Math.floor(255
		      -255*
		      adjustFor3D(255 ,dist)
		      /adjustFor3D(255,0) );
}

function isPointInPoly(poly, pt){
    var c = false,  l = poly.length, j = l - 1;
    for(var i = -1; i < l; j = ++i)
	((poly[i].y <= pt.y && pt.y < poly[j].y) || (poly[j].y <= pt.y && pt.y < poly[i].y))
	&& (pt.x < (poly[j].x - poly[i].x) * (pt.y - poly[i].y) / (poly[j].y - poly[i].y) + poly[i].x)
	&& (c = !c);
    return c;
}

// send stuff through tubes to other players
// when json necessary
// waiting people aren't playing
function send(i) {
    if (player.role != 'waiting')
	socket.send(JSON.stringify(i));
}


// tell the other player to bounce
function sendBounce() {
    if (player.role != 'waiting')
	socket.emit('bounce');
}

// tell the other player about a barrier
// remember to stop updating the barrier after sending it.
function sendBarrier(barrier) {
    socket.emit('barrier', barrier);
}

// tell the other player about an enemy
// remember to stop updating the enemy after sending it.
function sendEnemy(enemy) {
    socket.emit('enemy', enemy);
}

// tell the other player to gain some exp
function sendExpGain(amount) {
    socket.emit('expGain', amount);
}

// tell the other player to just accept what this experience is
function sendExp() {
    socket.emit('exp', player.exp);
}

// tell the other player about a bullet
// remember to stop updating the bullet after sending it.
function sendBullet(bullet) {
    socket.emit('bullet', bullet);
}

function sendGameOver() {
    socket.emit('gameOver');
}

// tell the other player to heal
function sendHeal(amount) {
    socket.emit('heal', amount);
}

// tell the other player to just accept what this health is
function sendHealth() {
    socket.emit('health', player.health);
}

// tell the other player to feel the pain
function sendHurt(amount) {
    socket.emit('hurt', amount);
}

// tell the other player to level up
function sendLevelUp() {
    socket.emit('levelUp');
}

//barrier class
function Barrier() {
    //this.circles = circles;
    this.thickness = barrierThickness;
    this.barrierDist = lightDist;
    this.rotation = 0;
    this.rotationSpeed = Math.PI/50 * (Math.random() - .5) * 2;
    this.barrierBoost = barrierBoost;
    this.holes = [];//this.makeRandomHoles(); //[[.25,0,.75, .5, 1, -.01], [0,0,.25]];
    this.health = barrierHealth;
    this.damaged = 0;

    this.makeFlowerHoles = function() {
	var ringRadius = Math.random() * .2+.4;
	var holeRadius = Math.random() * ((.89-player.shipRadius) - ringRadius) + .1;
	var numHoles = Math.floor(Math.random() * 10) + 2;
	var angleInc = Math.PI * 2 / numHoles,
	angle = Math.random() * angleInc;
	for (var i = 0; i < numHoles; i++) {
	    var hole = [ringRadius, angle, holeRadius];
	    this.holes.push(hole);
	    angle += angleInc;
	}
    };

    this.makeSpacedHoles = function() {
	var ringRadius = Math.random() * .2 + .4;
	var holeRadius = Math.random() * .3 + .1;
	var numHoles = Math.floor(Math.random() * 3) + 2;
	var angleInc = Math.PI * 2 / numHoles,
	angle = Math.random() * angleInc;
	for (var i = 0; i < numHoles; i++) {
	    var hole = [ringRadius, angle, holeRadius];
	    this.holes.push(hole);
	    angle += angleInc;
	}
    };

    this.makeRandomHoles = function () {
	var numHoles = Math.floor(Math.random()*5) + 1;
	for (var i = 0; i < numHoles; i++) {
	    var posradius = Math.random()*.9;
	    var angle = Math.random() * 2 * Math.PI;
	    var holeradius = Math.random() * (.89 - posradius)+.1;
	    var hole = [posradius, angle, holeradius];
	    this.holes.push(hole);
	}
    };

    this.makeSpottedHoles = function () {
	var numHoles = Math.floor(Math.random()*50) + 10;
	for (var i = 0; i < numHoles; i++) {
	    var posradius = Math.random()*.9;
	    var angle = Math.random() * 2 * Math.PI;
	    var holeradius = Math.random() * (.1)+.1;
	    var hole = [posradius, angle, holeradius];
	    this.holes.push(hole);
	}
    };

    this.makeRandomBarrier = function () {
	var chooser = Math.random();
	if (Math.random() < .2) {
	    this.holes.push([0,0,1]);
	}
	if (chooser < .4) {//.4
	    this.makeRandomHoles();
	    //this.makeSpottedHoles(); These are really stupid.
	} else if (chooser < .6) {//.6
	    this.makeFlowerHoles();
	} else if (chooser < .8) {//.8
	    this.makeSpacedHoles();
	} else {
	    this.holes.push([0,0,1,Math.random()*.3,Math.random(), Math.random()*.1]);
	}
    };
    //this.makeRandomBarrier();
    /*
     this.holes = [];
     this.numholes = 1 + Math.floor(Math.random()*5);
     for (var i =0; i < this.numholes; i++) {
     this.holes.push([maxTunnelRadius/2, 2*Math.PI/(this.numholes) *i]);
     }*/
    // barrier hurt
    this.hurt = function(damage) {
	this.health -= damage;
	this.damaged = 1;
    };
    //barrier heal
    this.heal = function(health) {
	this.health += health;
    };

    this.drawBack = function(cameraX, cameraY) {
	var backDist = this.barrierDist + this.thickness;
	var barrierRadius = adjustFor3D(maxTunnelRadius, backDist);
	var barrierX = centerX
	    - adjustFor3D(cameraX, backDist);
	var barrierY = centerY
	    - adjustFor3D(cameraY, backDist);
	var color = Math.floor(getColorAtDistance(this.barrierDist)/2);


	drawingContext.beginPath();
	drawingContext.lineWidth = 1;

	drawingContext.fillStyle = 'rgba(' + [color, color, color].toString() + ',' + barrierAlpha + ')';;

	drawingContext.arc(barrierX, barrierY, barrierRadius, 0, Math.PI * 2, false);
	this.drawHoles(barrierX, barrierY, barrierRadius);
	/*
	 drawingContext.arc(barrierX+barrierRadius/2, barrierY, barrierRadius/4,  Math.PI * 2 - 0.01, 0,true);*/
	drawingContext.fill();
    };

    this.drawHoles = function(x,y,r) {
	for (var i = 0; i < this.holes.length; i++) {
	    var hole = this.holes[i], holerad;
	    if (hole.length > 3)
		holerad = (hole[4] * (hole[2] - hole[3]) + hole[3]) * r;
	    else
		holerad = hole[2] * r;
	    holex = x + hole[0] * Math.cos(hole[1] + this.rotation) * r,
	    holey = y + hole[0] * Math.sin(hole[1] + this.rotation) * r;

	    drawingContext.moveTo(holex + holerad, holey);
	    drawingContext.arc(holex, holey, holerad,  Math.PI * 2 - 0.01, 0,true);
	}

    };
    //barrier draw
    this.draw = function(cameraX, cameraY) {
	this.drawBack(cameraX, cameraY);
	var barrierRadius = adjustFor3D(maxTunnelRadius, this.barrierDist);
	var barrierX = centerX
	    - adjustFor3D(cameraX, this.barrierDist);
	var barrierY = centerY
	    - adjustFor3D(cameraY, this.barrierDist);
	var color = getColorAtDistance(this.barrierDist*.75);
	if (this.damaged > 0) {
	    color = Math.round( color * (1 - this.damaged));
	}

	drawingContext.beginPath();

	drawingContext.fillStyle = 'rgba(' + [color, color, color].toString() + ',' + barrierAlpha +')';

	drawingContext.arc(barrierX, barrierY, barrierRadius, 0, Math.PI * 2, false);
	this.drawHoles(barrierX, barrierY, barrierRadius);
	/*
	 drawingContext.arc(barrierX+barrierRadius/2, barrierY, barrierRadius/4,  Math.PI * 2 - 0.01, 0,true);*/
	drawingContext.fill();
	if (cartoonBarriers) {

	drawingContext.strokeStyle = "#000";
	    drawingContext.lineWidth
		= adjustFor3D(50,this.barrierDist);//3;//barrierRadius
	drawingContext.stroke();
	    }
    };

    // Barrier update
    this.update = function(vel) {
	if (this.damaged > 0) { this.damaged -= .1;}
	this.updateHoles();
	this.rotation = (this.rotation + this.rotationSpeed) % (Math.PI * 2);
	this.barrierDist = this.barrierDist - vel;
	return (this.health > 0);
    };

    this.updateHoles = function() {
	for (var i = 0; i < this.holes.length; i++) {
	    var hole = this.holes[i];
	    if (hole.length>5) {
		//are our holes growing?
		hole[4] += hole[5];
		//console.log(hole[3]);
		if (hole[4] > 1) {
		    hole[4] = 1;
		    hole[5] *= -1;
		} else if (hole[4] < 0) {
		    hole[4] = 0;
		    hole[5] *= -1;
		}
	    }
	}

    };

    this.checkForHit = function(shipX, shipY) {
	var hit = true;

	for (var i = 0; i < this.holes.length; i++) {
	    var hole = this.holes[i], holerad,
	    holex = hole[0] * Math.cos(hole[1] + this.rotation) * maxTunnelRadius,
	    holey = hole[0] * Math.sin(hole[1] + this.rotation) * maxTunnelRadius;
	    if (hole.length>3)
		holerad= (hole[4] * (hole[2] - hole[3]) + hole[3])
		* maxTunnelRadius;
	    else
		holerad = hole[2] * maxTunnelRadius;

	    if (Math.pow(shipX - holex, 2)
		+ Math.pow(shipY - holey, 2)
		<= Math.pow(holerad,2)) {
		if (hit)
		    hit = false;
		else
		    return true;
	    }
	}
	return hit;
    };
    this.getZ = function() {
	return this.barrierDist;
    };
}//end Barrier function



function Bullet(x,y,z,xs,ys,zs) {
    this.x = x;
    this.y = y;
    this.z = z;
    this.velX = xs;
    this.velY = ys;
    this.velZ = zs;
    this.lifeTime = bulletLifeTime;
    // Bullet draw
    this.draw = function(cameraX, cameraY) {
	drawingContext.lineWidth = adjustFor3D(bulletRadius * maxTunnelRadius,this.z)*.5;
	var color = getColorAtDistance(this.z/5);
	drawCircle(drawingContext,
		   centerX - adjustFor3D(cameraX, this.z) + adjustFor3D(this.x, this.z),
		   centerY - adjustFor3D(cameraY, this.z) + adjustFor3D(this.y,this.z),
		   adjustFor3D(bulletRadius * maxTunnelRadius, this.z),
		   'rgb(' + [0, 0, 0].toString() + ')',
		   'rgb(' + [color, color, color].toString() + ')');
    };
    //Bullet update
    this.update = function() {
	this.lifeTime--;
	if (this.lifeTime <= 0) return false;
	this.x += this.velX;
	this.y += this.velY;
	this.z += this.velZ - player.shipVel;
	var r = Math.sqrt(
	    Math.pow(this.x, 2)
		+ Math.pow( this.y, 2));

	if ( r > (1 - bulletRadius) * maxTunnelRadius && this.velX * this.x + this.velY * this.y > 0) {
	    this.x *= (1 - bulletRadius) * maxTunnelRadius/ r;
	    this.y *= (1 - bulletRadius) * maxTunnelRadius/ r;
	    var reflectX = this.x/r, reflectY = this.y/r;
	    /*var newVelX = (Math.pow(reflectX,2) - Math.pow(reflectY,2)) * this.velX + 2 * reflectX * reflectY * this.velY,
	     newVelY = (Math.pow(reflectY,2) - Math.pow(reflectX,2)) * this.velY + 2 * reflectX * reflectY * this.velX;
	     this.velX = newVelX/r;
	     this.velY = newVelY/r;*/
	    var newVelX = this.velX - 2 * (this.velX * reflectX+ this.velY * reflectY) * reflectX;
	    var newVelY = this.velY - 2 * (this.velX * reflectX+ this.velY * reflectY) * reflectY;
	    this.velX = newVelX;
	    this.velY = newVelY;
	    playSound("bigsh", adjustFor3D(1,this.z));
	}

	// bullet enemy
	// enemy bullet
	for (var i = 0; i < player.enemies.length; i++) {
	    var enemy = player.enemies[i];
	    if (this.z >= enemy.z
	       && this.z < enemy.z + Math.abs(this.z)
		&& (enemy.checkForHit(this.x,this.y))) {
		enemy.hurt(bulletDamage);
		if (enemy.health <= 0) {
		    player.enemies.splice(i,1);
		    player.expGain(expPerEnemy);
		}
		//enemy.damage()
		return false;// this hit, it dies!
	    }
	}

	for (var i = 0; i < player.barriers.length; i++) {
	    var barrier = player.barriers[i];
	    if (this.z >= barrier.barrierDist
		&& this.z < barrier.barrierDist
		+Math.max(barrier.thickness, Math.abs(this.velZ))) {
		if (barrier.checkForHit(this.x, this.y)) {
		    this.velZ *= -1;
		    if (this.velZ > 0) {
			this.z = barrier.barrierDist +barrier.thickness;
		    } else {
			this.z = barrier.barrierDist;
		    }
		    playSound("lilpow", adjustFor3D(1,this.z));
		}

		break;
	    }
	}
	return true;//still alive
    };
    this.getZ = function() {
	return this.z;
    };
}// end Bullet function

//enemy class
function Enemy(x,y,z,xs,ys,zs) {
    this.x = x;
    this.y = y;
    this.z = z;
    this.velX = xs;
    this.velY = ys;
    this.velZ = zs;
    this.health = enemyHealth;
    this.damage = enemyDamage;
    this.size = enemySize * ( Math.random()+.5);
    this.damaged = 0;

    // enemy hurt
    this.hurt = function (amount) {
	this.health -= amount;
	this.damaged = 1;
    }

    // enemy heal
    this.heal = function (amount) {
	this.health += amount;
    }

    //Enemy draw
    this.draw = function(cameraX, cameraY) {
//	drawingContext.lineWidth = 1;
	//drawingContext.fillRect(0,0,40,40);
	var colorValue = getColorAtDistance(this.z/(cartoonEnemies?2:10));
	if (this.damaged > 0) {
	    var color = 'rgb(' + 
		[Math.round(colorValue * (1 - this.damaged)), 
		 Math.round(255 * (1 - this.damaged)), 
		 Math.round(colorValue * (1 - this.damaged))].toString() + ')'
	} else {
	    
	    var color = 'rgb(' + [colorValue, 255, colorValue].toString() + ')'
	}
	//console.log(""+this.x/maxTunnelRadius+","+this.y/maxTunnelRadius+","+this.z);
	if (cartoonEnemies) {
	    drawingContext.lineWidth = adjustFor3D(50,this.z);
	}
	drawCircle(drawingContext,
		   centerX - adjustFor3D(cameraX, this.z) + adjustFor3D(this.x, this.z),
		   centerY - adjustFor3D(cameraY, this.z) + adjustFor3D(this.y,this.z),
		   adjustFor3D(this.size * maxTunnelRadius, this.z),
		   cartoonEnemies? 'rgb(' + [0, 0, 0].toString() + ')': null,
		   color);

    };
    //Enemy update
    this.update = function() {
	if (this.damaged > 0) {this.damaged -= .1; }
	this.velX += (Math.random() - .5) * 5;
	this.velY += (Math.random() - .5) * 5;
	this.x += this.velX;
	this.y += this.velY;
	this.z += this.velZ - player.shipVel;
	var r = Math.sqrt(
	    Math.pow(this.x, 2)
		+ Math.pow(this.y, 2));

	if ( r > maxTunnelRadius * (1 - this.size) && this.velX * this.x + this.velY * this.y > 0) {
	    this.x *= maxTunnelRadius * (1 - this.size) / r;
	    this.y *= maxTunnelRadius * (1 - this.size) / r;
	    var reflectX = this.x/r, reflectY = this.y/r;
	    /*var newVelX = (Math.pow(reflectX,2) - Math.pow(reflectY,2)) * this.velX + 2 * reflectX * reflectY * this.velY,
	     newVelY = (Math.pow(reflectY,2) - Math.pow(reflectX,2)) * this.velY + 2 * reflectX * reflectY * this.velX;
	     this.velX = newVelX/r;
	     this.velY = newVelY/r;*/
	    var newVelX = this.velX - 2 * (this.velX * reflectX+ this.velY * reflectY) * reflectX;
	    var newVelY = this.velY - 2 * (this.velX * reflectX+ this.velY * reflectY) * reflectY;
	    this.velX = newVelX;
	    this.velY = newVelY;
	    //if (this.z < lightDist / 25)
	    playSound("cmeow", adjustFor3D(2,this.z));
	}
	// enemy barrier
	// barrier enemy
	for (var i = 0; i < player.barriers.length; i++) {
	    var barrier = player.barriers[i];
	    if (this.z >= barrier.barrierDist
		&& this.z < barrier.barrierDist
		+Math.max(barrier.thickness, this.velZ)) {
		if (barrier.checkForHit(this.x, this.y)) {
		    this.velZ *= -1;
		    barrier.hurt(this.damage);
		    if (this.velZ > 0) {
			this.z = barrier.barrierDist +barrier.thickness;
		    } else {
			this.z = barrier.barrierDist;
		    }
		    playSound("cmeow", adjustFor3D(1,this.z));
		}

		break;
	    }
	}
	return true;//still alive
    };
    this.getZ = function() {
	return this.z;
    };
    this.checkForHit = function(x, y) {
	return Math.pow(this.size * maxTunnelRadius, 2) > Math.pow(x - this.x, 2) + Math.pow(y - this.y, 2);
    };
}// end Enemy function

//Player class
function Player(role) {
    this.shipX = 0;
    this.shipY = 0;
    this.mouseX = 0;
    this.mouseY = 0;
    this.indicatorDelta = 200; // distance between indicators
    this.indicatorOffset = 1000;
    // distance between us and first indicator
    this.shipVel = 20;
    this.role = role; //set from socket.io
    this.barriers = [];
    this.bullets = [];
    this.enemies = [];
    this.shipRadius = .07;
    this.health = playerMaxHealth;
    this.exp = 0;
    this.overlayDrawFunction = null;

    // TODO: combine hurt and heal functions so they behave the same
    // some enemies could be health bonuses
    // player hurt
    this.hurt = function(amount) {
	playSound("ahhh");
	if (this.role == 'pilot') {
	    this.health -= amount;
	    //if (this.health < 0) this.health = 0;
	    if (this.health <= 0) {
			    //send({gameOver:true});
			    sendGameOver();
			    gameOver();
			    this.health = playerMaxHealth;
	    }
	    sendHealth();
	} else if (this.role == 'gunner') {
	    sendHurt(amount);
	}
    };
    
    //player heal
    this.heal = function(amount) {
	if (this.role == 'pilot') {
	    this.health += amount;
	    if (this.health > playerMaxHealth) {
		this.health = playerMaxHealth;
	    }
	    sendHealth();
	} else if (this.role == 'gunner') {
	    sendHeal(amount);
	}
    };

    // player expGain
    this.expGain = function(amount) {
	if (this.role == 'pilot') {
	    this.exp += amount;
	    sendExp();
	    if (this.exp >= playerMaxExp) {
		this.levelUp();
	    }
	} else if (this.role == 'gunner') {
	    sendExpGain(amount);
	}
    };

    this.levelUp = function() {
	score += this.exp;
	this.exp = 0;
	playerMaxExp += 25; 
	playerMaxHealth += 10;
	player.health += 10;
	if (enemyDamage < 33) {
	    enemyDamage += 1;
	}
	if (player.role == 'pilot') {
	    sendLevelUp();
	    if (barrierSpread > 500) {
		barrierSpread -= Math.random() * 100;
	    }
	    if (acceleration < 1) {
		acceleration += Math.random() * .03;
		backwardAcceleration += Math.random() * .03;
	    }
	} else if (player.role == 'gunner') {
	    if (gunMouseTrailProp < .9) {
		gunMouseTrailProp += Math.random() * .1;
	    }
	    if (enemyChance < 1) {
		enemyChance += Math.random() * .002;
	    }
	    if (bulletDamage < 100) {
		bulletDamage += Math.random() * 5;
	    }
	    if (bulletTime > 3) {
		bulletTime -= Math.random() * 1;
	    }
	    if (bulletSpeed < 150) {
		bulletSpeed += Math.random() * 5;
	    }
	}
	var alpha = 1;
	player.overlayDrawFunction = function() {
	    if (alpha > 0) {
		alpha -= .05
		if (alpha < 0) {
		    player.overlayDrawFunction = null;
		}
	    }
	    drawText('Level Up!', null, 'rgba(0,255,0,' + alpha + ')', 'rgba(0,0,100,' + alpha + ')');};
    }

    // player update
    this.update = function() {
	this.updateTunnel();
	this.updateBarriers();
	//if (this.updateEnemies()){
	// I'm not sure why this is in the if statement... shouldn't it happen
	// all the time?
	this.updateEnemies();
	    this.updateBullets();
	    //this.draw();
	    this.updateRole();

	    //healing player shield health
	    /*if ( (playerRegen != 0 )
		 && (this.role == 'pilot') 
		 && (this.health < playerMaxHealth)) {
		this.health += playerRegen;
		sendHealth();
	    }*/
	    //maxTunnelRadius += (-.5 + Math.random()) * 10;
	//}
    };

    // player draw
    this.draw = function() {
	this.clear();
	
	    
	    this.drawTunnel();
	    this.drawTunnelIndicators();

	    this.drawObjects();
	    this.drawHud();
	    this.drawCursor();
	if (this.overlayDrawFunction) { this.overlayDrawFunction(); }

    };

    this.updateTunnel = function() {
	//tunnelLineSpeed = 0;//this.shipVel / 50./100;
	initialLineAngle = (initialLineAngle + tunnelLineSpeed) % (Math.PI*2);
	this.indicatorOffset = (this.indicatorOffset - this.shipVel);
	if (this.indicatorOffset < 0) {
	    this.indicatorOffset += this.indicatorDelta;
	} else if (this.indicatorOffset > this.indicatorDelta) {
	    this.indicatorOffset -= this.indicatorDelta;
	}
    };

    this.updateBarriers = function() {
	//if there is not an interesting barrier, let's make one!
	if (this.role == 'pilot' && (!this.barriers.length || this.barriers[this.barriers.length-1].barrierDist < barrierMinSpawnDist)) {
	    var bar = new Barrier();
	    bar.makeRandomBarrier();
	    this.barriers.push(bar);
	    barrierMinSpawnDist = lightDist - (Math.random() + .5) * barrierSpread;
	}

	//make sure traverse barriers in correct order
	//fix bug where two barriers are passed in same time step (large speed)
	//this way, the barriers are recycled in correct order, keep drawn in
	//correct order. bug not fixed
	for (var i = this.barriers.length-1; i >=0; i--) {
	    var barrier = this.barriers[i];
	    if (!barrier.update(this.shipVel)) {
		this.barriers.splice(i,1);
		i = i - 1;
		continue;
	    }
	    var dist = barrier.barrierDist;
	    if (dist < 0 && dist > -Math.max(barrier.thickness, this.shipVel)){//shipvel into account?
		if (this.role == 'pilot') {

		    if (this.shipVel > 0 
			&& barrier.checkForHit(this.shipX, this.shipY)) {
			//WE hit it
			barrier.damaged = 1;
			this.bounce();
		    } /*else {
			if (this.shipVel > 0) {
			   * moved to when send barrier
			    * this.shipVel += barrier.barrierBoost;
			    barrier.barrierBoost = 0;
			    // we used it up
			    playSound("woom");
			    //made past! give boost
			}
		    }*/
		} else { //we are gunner
		    if (this.shipVel > 0
			&& barrier.checkForHit(this.shipX, this.shipY)) {
			sendBounce();
			barrier.damaged = 1;
		    }
		}
	    } else if (dist > lightDist) {
		//We are too far away. Who cares about it?
		//delete barrier
		// pilot keeps it, because could go back then forward, want
		// same obstacles for consistency
		if (this.role == 'gunner') {
		    this.barriers.splice(i,1);
		}
	    } else if (dist <= -focalDist) {
		/*	this.barriers[i].barrierDist = lightDist;
		 this.barriers[i].holes=[];
		 this.barriers[i].makeRandomBarrier();
		 this.barriers.unshift(this.barriers.splice(i,1)[0]);
		 */
		if (this.role == 'gunner') {
		    /*if (this.shipVel > 0 && barrier.checkForHit(this.shipX, this.shipY)) {
		     send({bounce:true});//old
		     } else {*/

		    sendBarrier(this.barriers[i]);
		    this.barriers.splice(i,1);
		    // }
		} else if (this.role == 'pilot') {
		    if (this.shipVel > 0) {
			this.shipVel += barrier.barrierBoost;
			if (barrier.barrierBoost > 0) {
			    this.expGain(expPerBarrier);
			}
			barrier.barrierBoost = 0;
			playSound("woom");
		    }
		    sendBarrier(this.barriers[i]);
		    //send({barrier:this.barriers[i]});
		    this.barriers.splice(i,1);
		   /*
		    // make a new random barrier
		    var bar = new Barrier();
		    bar.makeRandomBarrier();
		    this.barriers.push(bar);
		    */
		}
	    }
	}
    };

    this.updateEnemies = function() {
	for (var i = 0; i < this.enemies.length; i++) {
	    var enemy = this.enemies[i];
	    if (enemy.update()) {
		if (enemy.z > lightDist*1.2) {
		    this.enemies.splice(i,1);
		    i--;
		} else if (enemy.z < 0 && enemy.z > -focalDist ) {
		    //enemy hit
		    if (Math.pow((enemy.x - this.shipX),2) + Math.pow((enemy.y - this.shipY),2) < Math.pow( (this.shipRadius + enemy.size) * maxTunnelRadius , 2)) {
			this.hurt(enemy.damage);
			this.enemies.splice(i,1);
			i--;

			return false;
		    }
		} else if (enemy.z < -focalDist) {
		    //send({enemy:enemy});
		    sendEnemy(enemy);
		    this.enemies.splice(i,1);
		    i--;
		}
	    } else {
		//our enemy has died!
		this.enemies.splice(i,1);
		i--;
		//alert("die!");
	    }
	}
	return true;
    };

    this.updateBullets = function() {
	for (var i = 0; i < this.bullets.length; i++) {
	    var bullet = this.bullets[i];
	    if (bullet.update()) {
		//console.log(bullet.lifeTime);

		// if (bullet.z > 0 && bullet.z < bullet.velZ) {
		//console.log("plane: x:"+bullet.x+" y:"+bullet.y);
		//}
		if (bullet.z > lightDist) {
		    this.bullets.splice(i,1);
		    i--;
		} else if (bullet.z < -focalDist) {
		    //send({bullet:bullet});
		    sendBullet(bullet);
		    this.bullets.splice(i,1);
		    i--;
		}
	    } else {
		//our bullet has died!
		this.bullets.splice(i,1);
		i--;
		//alert("die!");
	    }
	}
    };

    this.bounce = function() {
	//if (this.shipVel < 0) return;
	this.shipVel *= -barrierBounce;
	if (Math.abs(this.shipVel) > acceleration)
	    playSound("lilpow");
    };

    this.updateRole = function() {};

    this.drawTunnelIndicators = function() {
	for (var indicatorDist = lightDist - this.indicatorDelta + this.indicatorOffset;
	     indicatorDist > 0;
	     indicatorDist -= this.indicatorDelta) {
	    var indicatorRadius = adjustFor3D(maxTunnelRadius, indicatorDist);
	    var indicatorX = centerX
		- adjustFor3D(this.shipX, indicatorDist);
	    var indicatorY = centerY
		- adjustFor3D(this.shipY, indicatorDist);
	    var color = getColorAtDistance(indicatorDist);

	    drawingContext.lineWidth = Math.max(indicatorRadius
						- adjustFor3D(maxTunnelRadius ,indicatorDist+10), 1);
	    drawCircle(drawingContext, indicatorX, indicatorY, indicatorRadius,
		       'rgb(' + [color,color,color].toString() + ')');
	    if (cartoonTunnel) {

		drawCircle(drawingContext,
			   indicatorX, indicatorY,
			   indicatorRadius- drawingContext.lineWidth,
		       'rgb(' + [0,0,0].toString() + ')');
	     drawCircle(drawingContext,
			indicatorX, indicatorY,
			indicatorRadius+ drawingContext.lineWidth,
		       'rgb(' + [0,0,0].toString() + ')');
		}
	    /*
	     (indicatorDist+this.indicatorDelta>=lightDist)
	     ?'rgb(' + [color, color, color].toString() + ')'
	     :null );*/
	}

    };

    //objects must have draw(x,y) function
    this.drawObjects = function() {
	var objects = new Array();
	objects = objects.concat(this.barriers).concat(this.bullets).concat(this.enemies);
	//objects.concat(this.bullets);
	//console.log(objects);
	objects.sort(this.sortObjectFunction);
	for (var i = 0; i < objects.length; i++) {
	    objects[i].draw(this.shipX, this.shipY);
	}
	/*this.drawBarriers();
	 this.drawBullets();*/
    };

    //objects must have getZ function
    this.sortObjectFunction = function(obj1, obj2) {
	return obj2.getZ() - obj1.getZ();
    };

    this.drawBarriers = function () {
	for (var i = this.barriers.length - 1; i >= 0; i--) {
	    var barrier = this.barriers[i];
	    barrier.draw(this.shipX, this.shipY);
	}
    };

    this.drawBullets = function() {
	for (var i = 0; i < this.bullets.length; i++) {
	    var bullet = this.bullets[i];
	    bullet.draw(this.shipX, this.shipY);
	}
    };

    this.drawHud = function() {
	drawingContext.strokeStyle = 'rgba(0,0,0,'+(cartoonHud?1:0) +')';
	drawingContext.lineWidth = 3;
	// life bar health bar outline
	roundRect(drawingContext, 
		  centerX - hudWidth/2, hudHeight/2, 
		  hudWidth * .35, hudHeight, hudHeight/4, 
		  false, true);
	// exp bar outline
	roundRect(drawingContext, 
		  centerX - hudWidth * .1, hudHeight/2, 
		  hudWidth * .65, hudHeight, hudHeight/4, 
		  false, true);

	var life = this.health / playerMaxHealth;
	var lifeColor = Math.round(life * 255);
	//life
	drawingContext.fillStyle = 'rgba(' + (255 - lifeColor) + ',' 
	    + (lifeColor) + ',0,' + hudAlpha + ')';
	roundRect(drawingContext,
		  centerX - hudWidth/2, hudHeight/2,
		  hudWidth * .35 * life, hudHeight,
		  Math.min(hudHeight/4, hudWidth * .175 * life), 
		  true, true);
	var exp = this.exp / playerMaxExp;
	var expColor = Math.round(exp * 255);
	//Exp bar
	drawingContext.fillStyle = 'rgba(' + expColor + ',' + (255 - expColor) 
	    + ',' + expColor + ',' + hudAlpha + ')';
	roundRect(drawingContext, 
		  centerX - hudWidth * .1, hudHeight/2, 
		  hudWidth * .65 * exp, hudHeight, 
		  Math.min(hudHeight/4, hudWidth * .65/2 * exp), 
		  true, true);
    };
    //for pilot. gets overrided for gunner
    this.drawCursor = function() {
	//drawingContext.fillStyle="rgba(0,255,0,.1)";
	//drawingContext.fillRect(centerX - 10, centerY - 10, 20, 20);
	var cursorStrokeThickness = 2;
	drawingContext.fillStyle="rgb(0,0,0)";

	drawingContext.strokeStyle=drawingContext.fillStyle;
	drawingContext.fillRect(centerX - 2 - cursorStrokeThickness, centerY - 2 - cursorStrokeThickness, 4 + 2 * cursorStrokeThickness, 4 + 2 * cursorStrokeThickness);
	drawingContext.lineWidth = 4 + cursorStrokeThickness;
	drawingContext.beginPath();
	drawingContext.moveTo(centerX - 10 + cursorStrokeThickness, centerY);
	drawingContext.lineTo(centerX - 20 - cursorStrokeThickness, centerY);
	drawingContext.moveTo(centerX + 10 - cursorStrokeThickness, centerY);
	drawingContext.lineTo(centerX + 20 + cursorStrokeThickness, centerY);
	drawingContext.moveTo(centerX, centerY - 10 + cursorStrokeThickness);
	drawingContext.lineTo(centerX, centerY - 20 - cursorStrokeThickness);
	drawingContext.moveTo(centerX, centerY + 10 - cursorStrokeThickness);
	drawingContext.lineTo(centerX, centerY + 20 + cursorStrokeThickness);

	drawingContext.closePath();

	drawingContext.stroke();

	drawingContext.fillStyle = "rgb(255,255,255)";
	drawingContext.strokeStyle = drawingContext.fillStyle;
	//drawingContext.strokeStyle="rgb(0,0,0)";
	drawingContext.fillRect(centerX - 2, centerY - 2, 4, 4);
	drawingContext.lineWidth = 4;
	drawingContext.beginPath();
	drawingContext.moveTo(centerX - 10, centerY);
	drawingContext.lineTo(centerX - 20, centerY);
	drawingContext.moveTo(centerX + 10, centerY);
	drawingContext.lineTo(centerX + 20, centerY);
	drawingContext.moveTo(centerX, centerY - 10);
	drawingContext.lineTo(centerX, centerY - 20);
	drawingContext.moveTo(centerX, centerY + 10);
	drawingContext.lineTo(centerX, centerY + 20);

	drawingContext.closePath();

	drawingContext.stroke();

	/* broken arrow no good anyway
	 drawingContext.beginPath();
	 drawingContext.moveTo(this.mouseX, this.mouseY);
	 drawingContext.lineTo(this.mouseX*.9-this.mouseY/maxTunnelRadius*20,
	 this.mouseY*.9+this.mouseX/maxTunnelRadius*20);
	 drawingContext.lineTo(this.mouseX*.9+this.mouseY/maxTunnelRadius*20,
	 this.mouseY*.9-this.mouseX/maxTunnelRadius*20);
	 drawingContext.lineTo(this.mouseX, this.mouseY);
	 drawingContext.closePath();
	 drawingContext.fillStyle="#000";
	 drawingContext.stroke();
	 drawingContext.fill();*/
    };

    this.clear = function() {
	drawingContext.clearRect(0, 0, centerX*2, centerY*2);
    };

    this.drawTunnel = function() {
	// the light is at the end of the tunnel (at infinity
	// relative to canvas topleft
	var lightX = centerX;
	var lightY = centerY;
	//green circle at light
	//drawCircle(drawingContext, lightX, lightY, 3, '#fff', '#0f0');
	var angleDiff = Math.PI * 2 / numTunnelLines;
	var currentAngle = initialLineAngle;
	var beginTunnelRadius = maxTunnelRadius;//=adjustFor3D(maxTunnelRadius, 0);
	var triangleWidth = 30;

	// draw the frame thing
	drawingContext.fillStyle = '#000';
	//drawingContext.fillRect(0, 0, centerX * 2, centerY * 2);
	//drawingContext.globalCompositeOperation = 'destination-out';
	//
	//want to clear out the center hole for the tunnel
	/*drawCircle(drawingContext, centerX - this.shipX,
	 centerY - this.shipY, beginTunnelRadius - 1,
	 '#fff', '#fff');*/
	//drawingContext.globalCompositeOperation = 'source-over';
	//now want everything else to draw default

	//Now to draw triangles! give depth perception
	var endScale = adjustFor3D(1,-focalDist * .9);
	for (var i=0; i < numTunnelLines; i++) {
	    //endScale = 1;
	    var triangleAngle = currentAngle + Math.PI/2;
	    var lineEndX = beginTunnelRadius * endScale * Math.cos(currentAngle)
		- this.shipX * endScale + centerX,
	    lineEndY = beginTunnelRadius * endScale *  Math.sin(currentAngle)
		- this.shipY * endScale + centerY,
	    triangleBaseX = triangleWidth * endScale * Math.cos(triangleAngle),
	    triangleBaseY = triangleWidth * endScale * Math.sin(triangleAngle);

	    if (cartoonTunnel) {
		drawingContext.beginPath();
	    drawingContext.moveTo(lightX, lightY);

		drawingContext.lineTo(lineEndX + 2 * triangleBaseX,
				      lineEndY + 2 * triangleBaseY
				 );
		drawingContext.lineTo(lineEndX - 2 * triangleBaseX,
				      lineEndY - 2 * triangleBaseY
				 );
	    drawingContext.lineTo(lightX, lightY);
	    drawingContext.closePath();
	    drawingContext.fillStyle = "#000";
	    drawingContext.fill();
	    }
	    drawingContext.beginPath();
	    drawingContext.moveTo(lightX, lightY);

	    drawingContext.lineTo(lineEndX + triangleBaseX,
				  lineEndY + triangleBaseY
				 );
	    drawingContext.lineTo(lineEndX - triangleBaseX,
				  lineEndY - triangleBaseY
				 );
	    drawingContext.lineTo(lightX, lightY);
	    drawingContext.closePath();
	    var lingrad = drawingContext.createLinearGradient(lightX, lightY, lineEndX, lineEndY);
	    lingrad.addColorStop(0, 'white');
	    lingrad.addColorStop(adjustFor3D(1,0)/endScale, 'black');
	    //lingrad.addColorStop(1,'black');
	    drawingContext.fillStyle = lingrad;


	    drawingContext.fill();
	    /* cartoon tunnel lines
	    drawingContext.strokeStyle = "#000";

	    drawingContext.stroke();
*/

	    /* this is just lines. I'll save this for now.
	     drawingContext.lineTo(beginTunnelRadius * Math.cos(currentAngle)
	     - this.shipX + centerX,
	     beginTunnelRadius * Math.sin(currentAngle)
	     - this.shipY + centerY);
	     */
	    currentAngle += angleDiff;
	}

	//drawingContext.lineWidth = 1;
	//drawingContext.strokeStyle = '#444';
	//drawingContext.fillStyle = drawingContext.strokeStyle;
	//drawingContext.stroke();
    };
}

function update() {
    player.update();
    //    console.log(player.barriers.length);
}

function draw() {
    player.draw();
}

function init() {
    maincanvas = $('#maincanvas')[0];
    //updateIntervalId;
    resizeCanvas();
    $(window).resize(resizeCanvas);
    /*maxTunnelRadius = Math.sqrt(Math.pow(maincanvas.height, 2) +
     Math.pow(maincanvas.width, 2));*/
    maxTunnelRadius = Math.max( maincanvas.height, maincanvas.width);
    drawingContext = maincanvas.getContext('2d');

    initSocket();
    maincanvas.oncontextmenu = function(){return false;};
    player = new Player();
    updateIntervalId = setInterval(update, updateTime);
    drawIntervalId = setInterval(draw, drawTime);
    disallowSelecting();
    initAudio();
    initMouse();
    //resizeCanvas();
}

function initMouse() {

    maincanvas.onmousemove = function(event) {
	event.preventDefault();
	// from middle of canvas
	player.mouseX = (event.pageX - centerX - maincanvas.offsetLeft)*2;
	player.mouseY = (event.pageY - centerY - maincanvas.offsetTop)*2;
	//correct for non-square canvases
	if (player.role == 'pilot') {
	    player.mouseX = player.mouseX/centerX * maxTunnelRadius;
	    player.mouseY = player.mouseY/centerY * maxTunnelRadius;
	}
    };

    maincanvas.onmousedown = function(event) {
	socket.emit('alert', 'I pressed a button');
	event.preventDefault();
	mousePressed = true;
	leftMouse = (event.button == 0);
	//console.log(player.shipVel);
    };
    maincanvas.onmouseup = function(event) {
	event.preventDefault();
	mousePressed = false;
    };
    document.onkeydown = function(e) {
	var unicode=e.keyCode? e.keyCode : e.charCode;
	switch (unicode) {
	case 77: //m
	    soundEffects = !soundEffects;
	    backgroundMusic = soundEffects;
	    break;
	}
    };
    /*
    document.onkeydown =
	function(e) {
	   // alert(e);
	    var unicode=e.keyCode? e.keyCode : e.charCode;
	    //console.log(unicode);
	    //if (!mousePressed) {
		switch(unicode) {
		case kbforward://space
		    mousePressed = true;
		    leftMouse = true;
		    break;
		case kbback:
		    mousePressed = true;
		    leftMouse = false;
			break;
		case kbleft:
		case kbright:
		case kbup:
		case kbdown:
		    keyboardControl.push(unicode);
		    break;
		}

	    //}
	    //console.log(unicode);
    };

    document.onkeyup = function(e) {
	   // alert(e);
	    var unicode=e.keyCode? e.keyCode : e.charCode;
	   switch(unicode) {
		case kbforward:
		case kbback:
		    mousePressed = false;
		    break;
		case kbleft:
		case kbright:
		case kbup:
		case kbdown:
	       keyboardControl.splice(
		   keyboardControl.indexOf(unicode));
		    break;
		}
	    //console.log(unicode);
    };
*/

    maincanvas.onmouseout = function(event) {
	event.preventDefault();
	wentOutMousePressed = mousePressed;
	mousePressed = false;
    };

    maincanvas.onmouseover = function(event) {
	event.preventDefault();
	mousePressed = wentOutMousePressed;
    };
}

function initAudio() {
    for (var i = 0; i < numAudioChannels; i++) {
	audioChannels[i] = new Audio();
    }
    //console.log(audioChannels[2] == audioChannels[0]);
    //console.log(audioChannels);
}

function initSocket() {
    // old socket stuff, not up to snuff
    //socket = new io.Socket(window.location.hostname, {port: 8080});
    //socket.connect();
    socket = io.connect();

    socket.on('alert', function(display) {
		  alert(display);
	      });

    socket.on('background', function(color) {
		  maincanvas.style.backgroundColor = color;
	      });

    socket.on('barrier', function(bar2) {
		      var bar = new Barrier();
		      bar.barrierDist = -focalDist;
		      for (var i = 0; i < bar2.holes.length; i++) {
			  var hole = bar2.holes[i];
			  var oldangle = Math.floor(hole[1]/Math.PI*180);
			  hole[1] = (Math.PI - hole[1]);
			  if (hole[1] < 0) {
			      hole[1] += 2*Math.PI;
			  }
			  if (hole[1] > 2*Math.PI)
			      hole[1] -= 2*math.PI;
			  bar.holes.push(hole);

			  // console.log("old:"+oldangle+" new:"+Math.floor(hole[1]/Math.PI*180));
		      }
		      //bar.holes = bar2.holes;
		      bar.rotation = bar2.rotation;
		      bar.rotationSpeed = bar2.rotationSpeed;
		      bar.thickness = bar2.thickness;
		      //bar2.__proto__ = bar;

		      /*if ( player.role == "pilot" && bar.checkForHit(player.shipX,
		       player.shipY)) {
		       player.bounce();
		       send({barrier:bar});
		       } else {*/
		      player.barriers.unshift(bar);
		      // }


		      //alert("barrier\n"+evt.barrier.holes);

	      });

    socket.on('bounce', function() {player.bounce();});

    socket.on('bullet',function(bul2) {
	var bul = new Bullet(-bul2.x, bul2.y, -focalDist,
			     bul2.velX, bul2.velY, -bul2.velZ);
		      player.bullets.push(bul);
	      });

    socket.on('connect', function(evt) {
		  console.log(evt);
	      });

    socket.on('disconnect', function() {
		  console.log('client disconnect');
	      });

    socket.on('enemy', function(en2) {
		  var en = new Enemy(-en2.x, en2.y, -focalDist, en2.velX, en2.velY, -en2.velZ);
		  player.enemies.push(en);
	      });

    socket.on('expGain', function(amount) {
		  player.expGain(amount);
	      });

    socket.on('exp', function(amount) {
		  player.exp = amount;
	      });

    socket.on('gameStart', function() {
	if (player.role == 'gunner' || player.role == 'pilot') {
	    clearInterval(updateIntervalId);
	    updateIntervalId = setInterval(update, updateTime);
	    playSound("gogogo");
	    if (player.role == 'pilot') {
		this.health = playerMaxHealth;
		this.exp = 0;
		sendHealth();
		sendExp();
	    }
	}
    });

    socket.on('gameOver', gameOver);

    socket.on('heal', function(amount) {
		  player.heal(amount);
		  /*player.health += amount;
		  if (player.health > playerMaxHealth) {
		      player.health = playerMaxHealth;
		  }*/
	      });

    socket.on('health', function(amount) {
		  player.health = amount;
	      });

    socket.on('hurt', function(amount) {
		  player.hurt(amount);
		  /*player.health -= amount;
		  if (player.health < 0) {
		      player.health = 0;
		  }*/
	      });

    socket.on('levelUp', function() {  player.levelUp();});

    socket.on('message', function(evt) {
		  evt = JSON.parse(evt);
		  //console.log("evt =");
		  //console.log(evt);
		      //drawCircle(drawingContext, evt.shipX, evt.shipY, 5, '#fff', '#f00');
		      if (player.role == 'gunner') {
			  player.shipX = -evt.shipX * maxTunnelRadius;
			  player.shipY = evt.shipY * maxTunnelRadius;
			  player.shipVel = -evt.shipVel;
		      } else if (player.role == 'waiting') {
			  player.shipX = evt.shipX * maxTunnelRadius;
			  player.shipY = evt.shipY * maxTunnelRadius;
			  player.shipVel = evt.shipVel;
		      }

	      });

    socket.on('reconnect', reset);

    socket.on('role', function(role) {
	    player.role = role;
	    if (player.role == 'pilot') {
		initPilot();
	    } else if (player.role == 'gunner') {
		initGunner();
	    }
	    console.log('I AM THE ' + player.role + ' F**** YEAH!!!');
	});
}

function initPilot() {

    /*
     var bar = new Barrier();
     bar.barrierDist = lightDist/2;
     bar.holes = [[-.25,-.5,.25, 1, 0]];
     bar.holes.push([.75, 0, .25, 1, 0]);
     bar.holes.push([0,.75, .25, 1, .005]);

     player.barriers.push(bar);*/
    /* var bar = new Barrier();
     bar.barrierDist = lightDist;
     bar.holes = [[0,0,.5,1,0]];
     player.barriers.push(bar);*/
    for (var i = barrierSpread; i < lightDist; i+= barrierSpread) {

	var bar = new Barrier();
	bar.makeRandomBarrier();
	bar.barrierDist = i;
	//bar.holes = [[0,0,.5,1,0]];
	player.barriers.push(bar);
	//console.log(bar.barrierDist);
    }

    //pilot update
    player.updateRole = function() {
	var clippingSpeed = 50;
	var oldRad = Math.sqrt(
	    Math.pow(player.shipX, 2)
		+ Math.pow( player.shipY, 2));
	/*if (keyboardControl.length) {
	    if (keyboardControl.indexOf(kbup) != -1) {
		player.shipY -= keyboardSpeed * maxTunnelRadius;
		player.mouseY -= keyboardSpeed * maxTunnelRadius;
	    }
	    if (keyboardControl.indexOf(kbdown) != -1) {
		player.shipY += keyboardSpeed * maxTunnelRadius;
		player.mouseY += keyboardSpeed * maxTunnelRadius;
	    }
	    if (keyboardControl.indexOf(kbleft) != -1) {
		player.shipX -= keyboardSpeed * maxTunnelRadius;
		player.mouseX -= keyboardSpeed * maxTunnelRadius;
	    }
	    if (keyboardControl.indexOf(kbright) != -1) {
		player.shipX += keyboardSpeed * maxTunnelRadius;
		player.mouseX += keyboardSpeed * maxTunnelRadius;
	    }
	}*/
	var mouseTrailProp = .25
	    *(Math.min(player.shipVel, clippingSpeed)/clippingSpeed*.9+.1);
	//a noncontinuous linear hack for a logarithmic or -a/x-b curve
	player.shipX = player.mouseX * mouseTrailProp +
	    player.shipX * (1 - mouseTrailProp);
	player.shipY = player.mouseY * mouseTrailProp +
	    player.shipY * (1 - mouseTrailProp);
	var shipPositionRadius = Math.sqrt(
	    Math.pow(player.shipX, 2)
		+ Math.pow( player.shipY, 2));
	if ( shipPositionRadius
	     > maxTunnelRadius * (1 - player.shipRadius)) {
	    player.shipX *= maxTunnelRadius
		* (1 - player.shipRadius)/ shipPositionRadius;
	    player.shipY *= maxTunnelRadius
		* (1 - player.shipRadius)/ shipPositionRadius;
	    if (oldRad < maxTunnelRadius
		* (1 - player.shipRadius)) {
		//playSound("csh");
	    }
	}
	//console.log(player.mouseX, player.shipX, mouseTrailProp);
	send({shipX: this.shipX/maxTunnelRadius,
	      shipY: this.shipY/maxTunnelRadius,
	      shipVel: this.shipVel});
	player.shipVel *= friction;
	if (Math.abs(player.shipVel) < cutoffSpeed) {
	    player.shipVel = 0;
	}
	if (mousePressed) {
	    if (leftMouse)
		player.shipVel += acceleration;
	    else
		player.shipVel -= backwardAcceleration;
	}
	if (backgroundMusic) {
	    if (player.shipVel > 0)
		backgroundMusicChannel.volume = Math.min(player.shipVel/2, clippingSpeed)/clippingSpeed + .1;
	    else
		backgroundMusicChannel.volume = 0;
	}
    };// updateRole
    if (backgroundMusic) {
	startBackgroundMusic();
    }



}

function initGunner() {
    document.title = "Gunner Runner - Gunner";
    tunnelLineSpeed *=-1;
    var curbulletTime = 0;
    var gunX = 0, gunY = 0;

    //gunner updaterole
    player.updateRole = function() {
	
	gunX = player.mouseX/2 * gunMouseTrailProp +
	    gunX * (1 - gunMouseTrailProp);
	gunY = player.mouseY/2 * gunMouseTrailProp +
	    gunY * (1 - gunMouseTrailProp);
	if (curbulletTime < bulletTime) {
	    curbulletTime++;
	}
	if (mousePressed) {
	    if (curbulletTime >= bulletTime) {
		shootBullet();
		curbulletTime = 0;
	    }
	}
	// enemy spawn
	if (Math.random() < enemyChance) {
	    // random (r, angle) polar position
	    var r = Math.random() * (maxTunnelRadius - .5 * maxTunnelRadius);
	    var angle = Math.random() * 2 * Math.PI;

	    // random enemy
	    var enemy = new Enemy(
		r * Math.cos(angle), r * Math.sin(angle), lightDist, 
		Math.random() * enemySpeed - enemySpeed/2, 
		Math.random() * enemySpeed - enemySpeed/2, 
		(Math.random() * -enemySpeed - enemySpeed/2) 
		    + Math.min(player.shipVel,0));
	    player.enemies.push(enemy);
	}
    };

    function shootBullet() {
	//console.log("shoot: x:"+player.mouseX+" y:"+player.mouseY);
	var bulletSpawnDepth = focalDist;
	var bulletScale = bulletSpeed/Math.sqrt( Math.pow(gunX,2) + Math.pow(gunY,2) + Math.pow(bulletSpawnDepth, 2));

	bul = new Bullet(player.shipX,
			 player.shipY,
			 -bulletSpawnDepth,
			 gunX * bulletScale,
			 gunY * bulletScale,
			 bulletSpawnDepth * bulletScale + player.shipVel);
	//console.log([player.mouseX, player.mouseY]);
	player.bullets.push(bul);
	playSound("doo");
    };
    //overrides for the gunner
    player.drawCursor = function() {
	var boxSize = 20;
	var reloadWidth = boxSize/2;
	var reloadOffset = 5;
	drawingContext.strokeStyle = "#000";
	drawingContext.lineWidth = 2;
	drawingContext.strokeRect(centerX + gunX - boxSize/2,
				  centerY + gunY - boxSize/2,
				  boxSize, boxSize);
	drawingContext.fillStyle = "#0c0";
	var reloadHeight = boxSize * curbulletTime / bulletTime;
	drawingContext.fillRect(centerX + gunX
				+ boxSize/2 + reloadOffset,
				centerY + gunY + boxSize/2 - reloadHeight,
				reloadWidth,reloadHeight);
	drawingContext.lineWidth = 1;
	drawingContext.strokeRect(centerX + gunX
				  + boxSize/2 + reloadOffset,
				  centerY + gunY -  boxSize/2,
				  reloadWidth,boxSize);
	drawingContext.fillStyle = "rgb(255,0,0)";
	drawingContext.fillRect(centerX + player.mouseX/2-2,
				centerY + player.mouseY/2-2,4,4);
    };


}

function disallowSelecting() {
    maincanvas.onmousemove = function(event) {
	event.preventDefault();
    };

    maincanvas.onmousedown = function(event) {
	event.preventDefault();
    };
    maincanvas.onmouseup = function(event) {
	event.preventDefault();
    };
    maincanvas.onmouseout = function(event) {
	event.preventDefault();
    };
    maincanvas.onmouseover = function(event) {
	event.preventDefault();
    };
}

function resizeCanvas()
{
    $(maincanvas).attr("width", $(window).width());
    $(maincanvas).attr("height", $(window).height());
    centerY = maincanvas.height/2;
    centerX = maincanvas.width/2;
    hudWidth = maincanvas.width * .8;
    hudHeight = maincanvas.height * .05;
    maxTunnelRadius = Math.max( maincanvas.height, maincanvas.width);
}
function reset() {
    location.reload(true);

}
function gameOver() {
    clearInterval(updateIntervalId);
    clearInterval(drawIntervalId);
    playSound("oh_no");
    drawText( "Game Over");
    setTimeout(reset, 3000);
}

function drawText(text, textSize, fillStyle, strokeStyle) {
//drawingContext.clearRect(0,0,centerX * 2, centerY * 2);
    var size = textSize?textSize: Math.min(centerY, centerX/7.125)*1.9;
    drawingContext.strokeStyle = strokeStyle?strokeStyle:"#000";
    drawingContext.fillStyle = fillStyle?fillStyle:"#F00";
    drawingContext.font =  'bold ' + size +'pt Helvetica,Arial';
    drawingContext.lineWidth = Math.ceil(size * .1);
	var metrics = drawingContext.measureText(text);
//    console.log(metrics.width);
	var startx = centerX - metrics.width/2.0;
    var starty = centerY + size/2.0;
	drawingContext.strokeText(text, startx, starty);
	drawingContext.fillText(text, startx, starty);
}

/**
 * From StackOverflow:
 *
 * Draws a rounded rectangle using the current state of the canvas.
 * If you omit the last three params, it will draw a rectangle
 * outline with a 5 pixel border radius
 * @param {CanvasRenderingContext2D} ctx
 * @param {Number} x The top left x coordinate
 * @param {Number} y The top left y coordinate
 * @param {Number} width The width of the rectangle
 * @param {Number} height The height of the rectangle
 * @param {Number} radius The corner radius. Defaults to 5;
 * @param {Boolean} fill Whether to fill the rectangle. Defaults to false.
 * @param {Boolean} stroke Whether to stroke the rectangle. Defaults to true.
 */
function roundRect(ctx, x, y, width, height, radius, fill, stroke) {
  if (typeof stroke == "undefined" ) {
    stroke = true;
  }
  if (typeof radius === "undefined") {
    radius = 5;
  }
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
  if (stroke) {
    ctx.stroke();
  }
  if (fill) {
    ctx.fill();
  }
}