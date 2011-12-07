var socket;
var maxTunnelRadius;

//sound
//play sound effects?
var soundEffects = true;
//play background music?
var backgroundMusic = true;
var backgroundMusicURL = "audio/beat.mp3"; // "audio/Grandaddy - Jed's Other Poem (Beautiful Ground).mp3";

// aesthetics graphics
var cartoonBarriers = true;
var cartoonTunnelLines = true;
var tunnelLineGradient = true;
var cartoonTunnelIndicators = true;
var cartoonEnemies = true;
var cartoonHud = false;
var cartoonBullets = true;
var cartoonLineThickness = 50;
var barrierAlpha = 1;//.6;
var numTunnelLines = 5;
var tunnelLineSpeed = Math.PI/200;
var drawTime = 1000/30;

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
var bulletRadius = .05;

//for enemy
//how much health enemies have
var enemyHealth = 20;
//probability of enemy appearance
var enemyChance = .1;
//how big are the enemies?
//.5 - 1.5 times this size
var enemySize = .25;//enemySize = .25 * maxTunnelRadius;
//how much damage does an enemy do?
var enemyDamage = 1;
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

var lastUpdateTime = new Date().getTime();

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

// tell the other player to recoil appropriately
function sendRecoil(recoilVector) {
    socket.emit('recoil', recoilVector);
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
		= adjustFor3D(cartoonLineThickness,this.barrierDist);//3;//barrierRadius
	drawingContext.stroke();
	    }
    };

    // Barrier update
    this.update = function(speedFactor) {
	if (this.damaged > 0) { this.damaged -= .1;}
	this.updateHoles(speedFactor);
	this.rotation = (this.rotation + this.rotationSpeed * speedFactor) % (Math.PI * 2);
	this.barrierDist = this.barrierDist - player.shipVel * speedFactor;
	return (this.health > 0);
    };

    this.updateHoles = function(speedFactor) {
	for (var i = 0; i < this.holes.length; i++) {
	    var hole = this.holes[i];
	    if (hole.length>5) {
		//are our holes growing?
		hole[4] += hole[5] * speedFactor;
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
	//drawingContext.lineWidth = adjustFor3D(bulletRadius * maxTunnelRadius,this.z)*.5;
	var color = getColorAtDistance(this.z/5);
	var drawX = centerX - adjustFor3D(cameraX, this.z) 
	    + adjustFor3D(this.x, this.z);
	var drawY = centerY - adjustFor3D(cameraY, this.z) 
	    + adjustFor3D(this.y,this.z);
	var drawR = adjustFor3D(bulletRadius * maxTunnelRadius, this.z);
	drawingContext.fillStyle = 'rgb(' + [color, color, color].toString() 
	    + ')';
	if (drawR > 1) {
	drawingContext.fillRect(
	    drawX - drawR/2,
	    drawY - drawR/2,
	    drawR,
	    drawR);
	    if (cartoonBullets) {
		drawingContext.strokeStyle = "#000";
		drawingContext.lineWidth = adjustFor3D(cartoonLineThickness, this.z);
		drawingContext.strokeRect(
		    drawX - drawR/2,
		    drawY - drawR/2,
		    drawR,
		    drawR);
	    }
	}
	/*
	drawCircle(drawingContext,
		   drawX,
		   drawY
		   drawR
		   'rgb(' + [0, 0, 0].toString() + ')',
		   'rgb(' + [color, color, color].toString() + ')');*/

    };
    // Bullet update
    this.update = function(speedFactor) {
	this.lifeTime--;
	if (this.lifeTime <= 0) return false;
	this.x += this.velX * speedFactor;
	this.y += this.velY * speedFactor;
	this.z += (this.velZ - player.shipVel) * speedFactor;
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

    // Enemy draw
    this.draw = function(cameraX, cameraY) {
//	drawingContext.lineWidth = 1;
	//drawingContext.fillRect(0,0,40,40);
	var colorValue = getColorAtDistance(this.z/(10));
	// if it is too far away, don't bother drawing it
	if (colorValue < 1) { return;}
	if (this.damaged > 0) {
	    var color = 'rgb(' + 
		[Math.round(255 * (1 - this.damaged)), 
		 Math.round(colorValue * (1 - this.damaged)), 
		 Math.round(colorValue * (1 - this.damaged))].toString() + ')'
	} else {
	    var color = 'rgb(' + [colorValue, colorValue, colorValue].toString() + ')'
	}
	//console.log(""+this.x/maxTunnelRadius+","+this.y/maxTunnelRadius+","+this.z);
	if (cartoonEnemies) {
	    drawingContext.lineWidth = adjustFor3D(cartoonLineThickness,this.z);
	}
	var drawX = centerX 
	    - adjustFor3D(cameraX, this.z) 
	    + adjustFor3D(this.x, this.z),
	drawY = centerY - adjustFor3D(cameraY, this.z) 
	    + adjustFor3D(this.y,this.z),
	drawR = adjustFor3D(this.size * maxTunnelRadius, this.z);
	if (drawR > 2) {
	drawCircle(drawingContext,
		   drawX,
		   drawY,
		   drawR,
		   cartoonEnemies? 'rgb(0, 0, 0)': null,
		   color);
	}

// uncomment to turn enemies into bears or mice or something
/*
	drawCircle(drawingContext,
		       drawX + drawR/1.41,
		       drawY - drawR/1.41,
		       drawR/2,
		       null,
		       color);
	    drawCircle(drawingContext,
		       drawX - drawR/1.41,
		       drawY - drawR/1.41,
		       drawR/2,
		       null,
		       color);
		       */
	// enemy face draw
	if (  this.velZ < 0 && this.damaged <= 0 && drawR > 4) {
	    var eyeFillStyle = 'rgb(' + 255 + ',' + colorValue + ',' + colorValue + ')';
	    drawCircle(drawingContext,
		       drawX + drawR/1.41/2,
		       drawY - drawR/1.41/2,
		       drawR/4,
		       null,
		       eyeFillStyle);
	    drawCircle(drawingContext,
		       drawX - drawR/1.41/2,
		       drawY - drawR/1.41/2,
		       drawR/4,
		       null,
		       eyeFillStyle);
	}
	
    };
    //Enemy update
    this.update = function(speedFactor) {
	if (this.damaged > 0) {this.damaged -= .1; }
	this.velX += (Math.random() - .5) * 10;
	this.velY += (Math.random() - .5) * 10;
//	if (player.x < this.x) this.velX -=  100;
//	if (player.x > this.x) this.velX += 100;
//	if (player.y < this.y) this.velY -= 100;
//	if (player.y > this.y) this.velY +=  100;
	this.velX += .01 * (player.shipX - this.x);
	this.velY += .01 * (player.shipY - this.y);
	this.x += this.velX * speedFactor;
	this.y += this.velY * speedFactor;
	this.z += (this.velZ - player.shipVel) * speedFactor;
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
		+Math.max(barrier.thickness, this.velZ * speedFactor)) {
		if (barrier.checkForHit(this.x, this.y)) {
		    this.velZ *= -1;
		    barrier.hurt(this.damage);
		    if (this.velZ > 0) {
			this.z = barrier.barrierDist +barrier.thickness;
		    } else {
			this.z = barrier.barrierDist;
		    }
		    playSound("cmeow", adjustFor3D(1,this.z));
		    //return false;
		}
		//return false;
		//break;
	    }
	}
	return true;//still alive
    };

    // returns a hole that is the same size as this enemy
    this.toHole = function() {
	return [this.x/maxTunnelRadius, this.y/maxTunnelRadius, this.size]
    }
    
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

    // recoil from shooting the gun
    // player recoil
    this.recoil = function(recoilVector) {
	player.shipX += recoilVector[0];
	player.shipY += recoilVector[1];
	player.shipVel += recoilVector[2]/100;
    }

    // player update
    this.update = function(speedFactor) {
	this.updateTunnel(speedFactor);
	this.updateBarriers(speedFactor);
	//if (this.updateEnemies()){
	// I'm not sure why this is in the if statement... shouldn't it happen
	// all the time?
	this.updateEnemies(speedFactor);
	    this.updateBullets(speedFactor);
	    //this.draw();
	    this.updateRole(speedFactor);

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

    this.updateTunnel = function(speedFactor) {
	//tunnelLineSpeed = 0;//this.shipVel / 50./100;
	initialLineAngle = (initialLineAngle + tunnelLineSpeed * speedFactor) % (Math.PI*2);
	this.indicatorOffset = (this.indicatorOffset - this.shipVel * speedFactor);
	if (this.indicatorOffset < 0) {
	    this.indicatorOffset += this.indicatorDelta;
	} else if (this.indicatorOffset > this.indicatorDelta) {
	    this.indicatorOffset -= this.indicatorDelta;
	}
    };

    this.updateBarriers = function(speedFactor) {
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
	    if (!barrier.update( speedFactor)) {
		this.barriers.splice(i,1);
		i = i - 1;
		continue;
	    }
	    var dist = barrier.barrierDist;
	    if (dist < 0 && dist > -Math.max(barrier.thickness, this.shipVel * speedFactor)){//shipvel into account?
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

    this.updateEnemies = function(speedFactor) {
	for (var i = 0; i < this.enemies.length; i++) {
	    var enemy = this.enemies[i];
	    if (enemy.update(speedFactor)) {
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

    this.updateBullets = function(speedFactor) {
	for (var i = 0; i < this.bullets.length; i++) {
	    var bullet = this.bullets[i];
	    if (bullet.update(speedFactor)) {
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

    this.updateRole = function(speedFactor) {};

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
	    var indicatorThickness = Math.max(indicatorRadius
						- adjustFor3D(maxTunnelRadius ,
							      indicatorDist+10),
					      1) / 2;
	    
	    if (cartoonTunnelIndicators) {
		
		drawingContext.lineWidth = adjustFor3D(cartoonLineThickness, indicatorDist + indicatorThickness)
		drawCircle(drawingContext,
			   indicatorX, indicatorY,
			   indicatorRadius- indicatorThickness,
		       'rgb(' + [0,0,0].toString() + ')');
		if (indicatorDist > indicatorThickness) {
		    drawingContext.lineWidth = adjustFor3D(cartoonLineThickness, indicatorDist - indicatorThickness)
		    drawCircle(drawingContext,
			       indicatorX, indicatorY,
			       indicatorRadius+ indicatorThickness,
			       'rgb(' + [0,0,0].toString() + ')');
		}
	    }

	    drawingContext.lineWidth = indicatorThickness * 2;
	    drawCircle(drawingContext, indicatorX, indicatorY, indicatorRadius,
		       'rgb(' + [color,color,color].toString() + ')');
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
	    
	    if (cartoonTunnelLines) {
		var cartoonBaseX = endScale * cartoonLineThickness
		    * Math.cos(triangleAngle);
		var cartoonBaseY = endScale * cartoonLineThickness
		    * Math.sin(triangleAngle);
		drawingContext.beginPath();
	    drawingContext.moveTo(lightX, lightY);

		drawingContext.lineTo(lineEndX + triangleBaseX
				      + cartoonBaseX,
				      lineEndY + triangleBaseY 
				      + cartoonBaseY
				 );
		drawingContext.lineTo(lineEndX - triangleBaseX
				      - cartoonBaseX,
				      lineEndY - triangleBaseY
				      - cartoonBaseY
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
	    if (tunnelLineGradient) {
	    var lingrad = drawingContext.createLinearGradient(lightX, lightY, lineEndX, lineEndY);
	    lingrad.addColorStop(0, 'white');
	    lingrad.addColorStop(adjustFor3D(1,0)/endScale, 'black');
	    //lingrad.addColorStop(1,'black');
	    drawingContext.fillStyle = lingrad;
	    } else {
		drawingContext.fillStyle = '#999';
	    }

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
    now = new Date().getTime();
    timeSinceLastUpdate = now - lastUpdateTime;
    player.update(timeSinceLastUpdate/updateTime);
    lastUpdateTime = now;
    //    console.log(player.barriers.length);
}

function draw() {
    player.draw();
}

function init() {
    maincanvas = $('#maincanvas')[0];
    //updateIntervalId;
    $(window).resize(resizeCanvas);
    /*maxTunnelRadius = Math.sqrt(Math.pow(maincanvas.height, 2) +
     Math.pow(maincanvas.width, 2));*/
    maxTunnelRadius = Math.max( maincanvas.height, maincanvas.width);
    drawingContext = maincanvas.getContext('2d');

    initSocket();
    maincanvas.oncontextmenu = function(){return false;};
    player = new Player();
    lastUpdateTime = new Date().getTime();
    updateIntervalId = setInterval(update, updateTime);
    drawIntervalId = setInterval(draw, drawTime);
    disallowSelecting();
    initAudio();
    if ($.browser.mobile) {
	initMobile();
    } else {
	initMouse();
    }
    //resizeCanvas();
    resizeCanvas();
}

function initMobile() {
    //alert('hi mobile!');
    initMouse();
    maincanvas.onmouseup = function(event) { event.preventDefault(); };
    maincanvas.onmousedown = function(event) { event.preventDefault(); };
    maincanvas.onmousemove = function(event) { event.preventDefault(); };
    document.body.addEventListener('touchmove', function(event) {
	event.preventDefault();
    }, false);
    document.body.addEventListener('touchstart', function(event) {
	event.preventDefault();
    }, false);
    document.body.addEventListener('touchend', function(event) {
	event.preventDefault();
    }, false); 
    maincanvas.addEventListener('touchmove', function(event) {
	var touch = event.changedTouches[0]
	setMousePos(touch.pageX, touch.pageY);
	//alert(event.pageX);
    }, false);
    maincanvas.addEventListener('touchstart', function(event) {
	mousePressed = true;
    }, false);
     maincanvas.addEventListener('touchend', function(event) {
	mousePressed = false;
    }, false);
    //mousePressed = true;
    /*$('#maincanvas').bind('tap', function(event) { 
      alert('tapped!')
	//maincanvas.onmousedown(event);
	//maincanvas.onmousemove(event);
	//maincanvas.onmouseup(event);
        });
    $('#maincanvas').bind('taphold', function(event) { 
	alert('taphold');
	//maincanvas.onmousedown(event);
	//maincanvas.onmousemove(event);
	//maincanvas.onmouseup(event);
        });*/
}

function setMousePos(pageX, pageY) {
    event.preventDefault();
	//alert('mouse moved!');
	// from middle of canvas
	player.mouseX = (pageX - centerX - maincanvas.offsetLeft)*2;
	player.mouseY = (pageY - centerY - maincanvas.offsetTop)*2;
	//correct for non-square canvases
	if (player.role == 'pilot') {
	    player.mouseX = player.mouseX/centerX * maxTunnelRadius;
	    player.mouseY = player.mouseY/centerY * maxTunnelRadius;
	}
}

function initMouse() {
    maincanvas.onmousemove = function(event) { 
	setMousePos(event.pageX, event.pageY);
    };

    maincanvas.onmousedown = function(event) {
	event.preventDefault();
	//alert('i pressed a button');
	//socket.emit('alert', 'I pressed a mouse button.');
	mousePressed = true;
	leftMouse = (event.button == 0);
	//console.log(player.shipVel);
    };
    maincanvas.onmouseup = function(event) {
	//alert('i released a button.');
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
		  //console.log(evt);
	      });

    socket.on('disconnect', function() {
		  //console.log('client disconnect');
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
    socket.on('recoil', function(recoilVector) { player.recoil(recoilVector);});
    socket.on('reconnect', reset);

    socket.on('role', function(role) {
	    player.role = role;
	    if (player.role == 'pilot') {
		initPilot();
	    } else if (player.role == 'gunner') {
		initGunner();
	    }
	    //console.log('I AM THE ' + player.role + ' F**** YEAH!!!');
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
    player.updateRole = function(speedFactor) {
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
	var mouseTrailProp = .15 * speedFactor;
	    //*(Math.min(player.shipVel * speedFactor, clippingSpeed)/clippingSpeed*.9+.1);
	//a noncontinuous linear hack for a logarithmic or -a/x-b curve
	player.shipX = player.mouseX * mouseTrailProp +
	    player.shipX * (1 - mouseTrailProp);
	player.shipY = player.mouseY * mouseTrailProp +
	    player.shipY * (1 - mouseTrailProp);
	var shipPositionRadius = Math.sqrt(
	    Math.pow(player.shipX, 2)
		+ Math.pow( player.shipY, 2));
	if ( shipPositionRadius > maxTunnelRadius * (1 - player.shipRadius)) {
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
		player.shipVel += acceleration * speedFactor;
	    else
		player.shipVel -= backwardAcceleration * speedFactor;
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
    player.updateRole = function(speedFactor) {
	
	gunX = player.mouseX/2 * gunMouseTrailProp * speedFactor +
	    gunX * (1 - gunMouseTrailProp * speedFactor);
	gunY = player.mouseY/2 * gunMouseTrailProp * speedFactor +
	    gunY * (1 - gunMouseTrailProp * speedFactor);
	if (curbulletTime < bulletTime) {
	    curbulletTime = Math.min(bulletTime, curbulletTime + speedFactor);
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
	//sendRecoil([gunX * bulletScale, gunY * bulletScale, 
	//	    bulletSpawnDepth * bulletScale]);
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
    $(maincanvas).attr("height", $(window).height() + ($.browser.mobile?30:0 ));
    centerY = maincanvas.height/2;
    centerX = maincanvas.width/2;
    hudWidth = maincanvas.width * .8;
    hudHeight = maincanvas.height * .05;
    if ($.browser.mobile) {
	window.scrollTo(0,1);
    }
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


/**
 * jQuery.browser.mobile (http://detectmobilebrowser.com/)
 *
 * jQuery.browser.mobile will be true if the browser is a mobile device
 *
 **/
(function(a){jQuery.browser.mobile=/android.+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|symbian|treo|up\.(browser|link)|vodafone|wap|windows (ce|phone)|xda|xiino/i.test(a)||/1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|e\-|e\/|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(di|rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|xda(\-|2|g)|yas\-|your|zeto|zte\-/i.test(a.substr(0,4))})(navigator.userAgent||navigator.vendor||window.opera);