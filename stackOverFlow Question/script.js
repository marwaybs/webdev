$(document).ready(function(){
    $('#bls').addClass('blsAnimation');
    $(".blsAnimation").css({"animation-iteration-count": "1, 2, 1, 1","animation-duration": "1s, 2s, 2s, 1s","animation-delay": "1s, 1s, sideToSideDelay, fadeOutDelay"});
});
