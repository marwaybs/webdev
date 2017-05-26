var canvas = document.querySelector('canvas');
canvas.width= window.innerWidth;
canvas.height=window.innerHeight;


var c = canvas.getContext('2d');

function Circle(x, y, dx, dy,radius) {
  this.x = x;
  this.y = y;
  this.dx = dx;
  this.dy = dy;
  this.radius = radius


  this.draw = function() {
    c.beginPath();
    c.arc(this.x, window.innerHeight/2, this.radius, 0, Math.PI * 2, false);
    c.strokeStyle = "white";
    c.stroke();

  }

  this.update = function(){

    if (this.x + this.radius > innerWidth || this.x - this.radius < 0) {
      this.dx = -this.dx;
    }

    if (this.y + this.radius > innerHeight || this.y - this.radius < 0) {
      this.dy = -this.dy;
    }

    this.x+=this.dx;


    this.draw()
  }

}

var circle = new Circle(200,200,3, 3, 30);


function animate() {
  requestAnimationFrame(animate);
  c.clearRect(0, 0, innerWidth, innerHeight);
  circle.update()

}

animate();
