$(document).ready(function(){
  var rec = new Recorder(source [, config])
  $("#record").click(function() {
    rec.record()
  })

  $("#stop").click(function() {
    rec.stop()
    rec.exportWAV([callback][, type])
    Recorder.forceDownload(blob[, filename])
    rec.clear()
  })
})
