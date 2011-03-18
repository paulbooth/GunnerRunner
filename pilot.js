var socket;
var canvasHeight;
var canvasWidth;
var maxTunnelRadius;
var numTunnelLines = 7;
var updateTime = 20;
var focalDist = 100;

var initialLineAngle = 0;
var player;
var drawingContext;

function drawCircle(context, x, y, r, borderstyle, fillstyle) {
    context.beginPath();
    // syntax reminder: x, y, r, start_angle, end_angle, anticlockwise
    //console.log(x,y,r);
    context.arc(x, y, r, 0, Math.PI*2, false);
    context.closePath();
    if (fillstyle != null) {
	context.fillStyle = fillstyle;
    }
    context.strokeStyle = borderstyle;
    context.lineWidth = 2;
    context.stroke();
    if (fillstyle != null) {
	context.fill();
    }
}

function adjustFor3D(r, dist) {
    return r * focalDist / (dist + focalDist);
}

function DonutBarrier(distance, holeradius) {
    this.distance = distance;
    this.holeradius = holeradius;
    this.draw = function() {
	


    };


}


function Player(role) {
    this.lightDist = 10000;
    this.shipX = 0;
    this.shipY = 0;
    this.mouseX = 0;
    this.mouseY = 0;
    this.centerX = 0;
    this.centerY = 0;
    this.indicatorDelta = 500; // distance between indicators
    this.indicatorOffset = 1000; 
    // distance between us and first indicator
    this.shipVel = 20;
    this.role = role; //set from socket.io

    this.update = function() {
	initialLineAngle = (initialLineAngle + Math.PI/200) % (Math.PI*2);
	this.clear();
	this.drawTunnel();
	this.drawTunnelIndicators();
	this.indicatorOffset = (this.indicatorOffset - this.shipVel) ;
	if (this.indicatorOffset < 0) {
	    this.indicatorOffset += this.indicatorDelta;
	} else if (this.indicatorOffset > this.indicatorDelta) {
	    this.indicatorOffset -= this.indicatorDelta;
	}
	this.updateRole();
    };

    this.updateRole = function() {};
	
    
    this.drawTunnelIndicators = function() {
	for (var indicatorDist = this.indicatorOffset;
	     indicatorDist < this.lightDist;
	     indicatorDist += this.indicatorDelta) {
	    var indicatorRadius = adjustFor3D(maxTunnelRadius, indicatorDist);
	    var indicatorX = this.centerX - adjustFor3D(this.shipX, indicatorDist);
	    var indicatorY = this.centerY - adjustFor3D(this.shipY, indicatorDist);
	    var color = Math.floor(200-adjustFor3D(200 ,indicatorDist));
	    drawCircle(drawingContext, indicatorX, indicatorY, indicatorRadius, 
		       'rgb(' + [color,color,color].toString() + ')', 
		       (indicatorDist+this.indicatorDelta>=this.lightDist)?'rgb(' + [color,color,color].toString() + ')':null );
	}
	
    };
    
    this.clear = function() {
	drawingContext.clearRect(0, 0, this.centerX*2, this.centerY*2);
    };

    this.drawTunnel = function() { 
	// the light is at the end of the tunnel (at infinity
	// relative to canvas topleft
	var lightX = this.centerX;
	var lightY = this.centerY;

	drawCircle(drawingContext, lightX, lightY, 3, '#fff', '#0f0');
	var angleDiff = Math.PI * 2 / numTunnelLines;
	var currentAngle = initialLineAngle;

	drawingContext.beginPath();
	for (var i=0; i < numTunnelLines; i++) {
	    drawingContext.moveTo(lightX, lightY);
	    drawingContext.lineTo(maxTunnelRadius * Math.cos(currentAngle) - this.shipX + this.centerX,
				  maxTunnelRadius * Math.sin(currentAngle) - this.shipY + this.centerY);
	    currentAngle += angleDiff;
	}
	drawingContext.closePath();
	drawingContext.lineWidth = 1;
	drawingContext.strokeStyle = '#444';
	drawingContext.stroke();
    };
    

}

function update() {
    player.update();
}

function init() {
    var maincanvas = document.getElementById('maincanvas');
    var updateIntervalId;
    centerY = maincanvas.height/2;
    centerX = maincanvas.width/2;
    maxTunnelRadius = Math.sqrt(Math.pow(maincanvas.height, 2) +
				Math.pow(maincanvas.width, 2));
    drawingContext = maincanvas.getContext('2d');
    

    socket = new io.Socket('10.41.64.64', {port: 8080});

    socket.connect();

    socket.on('connect', function(evt) {
	    console.log(evt);
	});

    socket.on('message', function(evt) {
	    if ('role' in evt) {//we got a thing to tell us what role we be
		player.role = evt.role;
		if (player.role == 'pilot') {
		    initPilot();
		}
		console.log('I AM THE ' + player.role + ' F**** YEAH!!!');
	    } else if ('gameStart' in evt) {
		clearInterval(updateIntervalId);
		updateIntervalId = setInterval(update, updateTime);
	    } else if ('shipX' in evt) {
		//drawCircle(drawingContext, evt.shipX, evt.shipY, 5, '#fff', '#f00');
		if (player.role == 'gunner') {
		    player.shipX = -evt.shipX;
		    player.shipY = evt.shipY;
		    player.shipVel = -evt.shipVel;
		}
	    } 
	});

    socket.on('disconnect', function() {
	    alert('client disconnect');
	});


    player = new Player();

    player.centerX = centerX;
    player.centerY = centerY;
    updateIntervalId = setInterval(update, updateTime);
    
    function initPilot() {
	var accelerating = false;
	var acceleration = .5;
	maincanvas.onmousemove = function(event) {
	    event.preventDefault();	
	    // from middle of canvas
	    player.mouseX = (event.pageX - player.centerX - maincanvas.offsetLeft)*2;
	    player.mouseY = (event.pageY - player.centerY - maincanvas.offsetTop)*2;
	}
	
	maincanvas.onmousedown = function(event) {
	    accelerating = true;
	    console.log(player.shipVel);
	}
	maincanvas.onmouseup = function(event) {
	    accelerating = false;
	}
	player.updateRole = function() {
	    var clippingSpeed = 50;
	    var mouseTrailProp = .25*Math.min(player.shipVel, clippingSpeed)/clippingSpeed;
	    player.shipX = player.mouseX * mouseTrailProp +
	                   player.shipX * (1 - mouseTrailProp);
	    player.shipY = player.mouseY * mouseTrailProp +
	                   player.shipY * (1 - mouseTrailProp);

	    //console.log(player.mouseX, player.shipX, mouseTrailProp);
	    
	    socket.send({shipX: this.shipX,
			 shipY: this.shipY,
			 shipVel: this.shipVel});
	    player.shipVel *= .99;
	    if (accelerating) {
		player.shipVel += acceleration;
	    }
	}
    }

    
}