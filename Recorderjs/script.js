// $(document).ready(function(){
//   var input = audio_context.createMediaStreamSource(stream);
//   var rec = new Recorder(input [, config])
//   $("#record").click(function() {
//     rec.record()
//   })
//
//   $("#stop").click(function() {
//     rec.stop()
//     rec.exportWAV([callback][, type])
//     Recorder.forceDownload(blob[, filename])
//     rec.clear()
//   })
// })
//

function __log(e, data) {
  log.innerHTML += "\n" + e + " " + (data || '');
}

var audio_context;
var recorder;

function startUserMedia(stream) {
  var input = audio_context.createMediaStreamSource(stream);

  // Uncomment if you want the audio to feedback directly
  // input.connect(audio_context.destination);
  // __log('Input connected to audio context destination.');

  recorder = new Recorder(input);
}

function startRecording(button) {
  recorder && recorder.record();
  button.disabled = true;
  button.nextElementSibling.disabled = false;
}

function stopRecording(button) {
  recorder && recorder.stop();
  button.disabled = true;
  button.previousElementSibling.disabled = false;

  // create WAV download link using audio data blob
  createDownloadLink();

  recorder.clear();
}

function createDownloadLink() {
  recorder && recorder.exportWAV(function(blob) {
    var url = URL.createObjectURL(blob);
    var li = document.createElement('li');
    var au = document.createElement('audio');
    var hf = document.createElement('a');

    au.controls = true;
    au.src = url;
    hf.href = url;
    hf.download = new Date().toISOString() + '.wav';
    hf.innerHTML = hf.download;
    li.appendChild(au);
    li.appendChild(hf);
    recordingslist.appendChild(li);
  });
}

window.onload = function init() {
  try {
    // webkit shim
    window.AudioContext = window.AudioContext || window.webkitAudioContext || window.mozAudioContext;
    navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia;
    window.URL = window.URL || window.webkitURL || window.mozURL;

    audio_context = new AudioContext;
    __log('Audio context set up.');
    __log('navigator.getUserMedia ' + (navigator.getUserMedia ? 'available.' : 'not present!'));
  } catch (e) {
    alert('No web audio support in this browser!');
  }

  try {
    navigator.mediaDevices.getUserMedia({audio: true}, startUserMedia, function(e) {
    });
  } catch (ex) {
  }
};
