var canvas = document.querySelector('canvas');
canvas.width= window.innerWidth;
canvas.height=window.innerHeight;


var c = canvas.getContext('2d');
// c.fillStyle="purple"
// c.fillRect(100,100,100,100);
// c.fillStyle='rgba(255,0,0,0.4)';
// c.fillRect(250,250,100,100);
//
// c.beginPath();
// c.moveTo(50,300);
// c.lineTo(300,100);
// c.lineTo(400,300);
// c.strokeStyle="blue";
// c.stroke();
//
//
//
// for (var i = 0; i<1000; i++) {
//   var x = Math.random() * window.innerWidth;
//   var y = Math.random() * window.innerHeight;
//   c.strokeStyle="#"+((1<<24)*Math.random()|0).toString(16);
//   c.beginPath();
//   c.arc(x, y, 30, 0, Math.PI * 2, false);
//   c.stroke();
//
//
// }

function Circle(x, y, dx, dy,radius) {
  this.x = x;
  this.y = y;
  this.dx = dx;
  this.dy = dy;
  this.radius = radius


  this.draw = function() {
    c.beginPath();
    c.arc(this.x, this.y, this.radius, 0, Math.PI * 2, false);
    c.strokeStyle = "black";
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
    this.y+=this.dy;

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
