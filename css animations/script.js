$(document).ready(function(){
  $("#button").click(function() {
    $('.translate').toggleClass('translate-active');
    $(".van").css('opacity', '0.2');
    // $(".translate-active").css('transform', 'translate(10vw,0)');
    // $(".translate-active").css('-webkit-transform', 'translate(10vw,0)');
  });
});


// transform: translate(45vw,0);
// -webkit-transform: translate(45vw,0); /** Chrome & Safari **/
// -o-transform: translate(45vw,0); /** Opera **/
// -moz-transform: translate(45vw,0); /** Firefox **/
