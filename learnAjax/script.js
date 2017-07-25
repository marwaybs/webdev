$(function(){
  $('#send').on('click', function(e){
    e.preventDefault();
    // $('#send').fadeOut(300);

    $.ajax({
      url: 'getData.php',
      type: 'post',
      data: {'action': 'send', 'text': $('#input').val()},
      success: function(data, status) {
        alert(data);
      },
      error: function(xhr, desc, err) {
        console.log(xhr);
        console.log("Details: " + desc + "\nError:" + err);
      }
    }); // end ajax call
  })
})
