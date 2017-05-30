function captureUserMedia(mediaConstraints, successCallback, errorCallback) {
    navigator.mediaDevices.getUserMedia(mediaConstraints).then(successCallback).catch(errorCallback);
}
var mediaConstraints = {
    audio: true
};

$(function(){
  $('#start-recording').click(function(){
    console.log("here");
    this.disabled = true;
    captureUserMedia(mediaConstraints, onMediaSuccess, onMediaError);
  });
});

// document.querySelector('#start-recording').onclick = function() {
//     console.log("here");
//     this.disabled = true;
//     captureUserMedia(mediaConstraints, onMediaSuccess, onMediaError);
// };

$(function(){
  $('#stop-recording').click(function(){
    this.disabled = true;
    mediaRecorder.stop();
    mediaRecorder.stream.stop();
    // document.querySelector('#pause-recording').disabled = true;
    document.querySelector('#start-recording').disabled = false;
  });
});


// document.querySelector('#stop-recording').onclick = function() {
//     this.disabled = true;
//     mediaRecorder.stop();
//     mediaRecorder.stream.stop();
//     // document.querySelector('#pause-recording').disabled = true;
//     document.querySelector('#start-recording').disabled = false;
// };

// document.querySelector('#pause-recording').onclick = function() {
//     this.disabled = true;
//     mediaRecorder.pause();
//     document.querySelector('#resume-recording').disabled = false;
// };
// document.querySelector('#resume-recording').onclick = function() {
//     this.disabled = true;
//     mediaRecorder.resume();
//     document.querySelector('#pause-recording').disabled = false;
// };

$(function(){
  $('#save-recording').click(function(){
      // this.disabled = true;
      mediaRecorder.save();
        // alert('Drop WebM file on Chrome or Firefox. Both can play entire file. VLC player or other players may not work.');
  });
});


// document.querySelector('#save-recording').onclick = function() {
//     this.disabled = true;
//     mediaRecorder.save();
//     // alert('Drop WebM file on Chrome or Firefox. Both can play entire file. VLC player or other players may not work.');
// };

var mediaRecorder;
function onMediaSuccess(stream) {
    var audio = document.createElement('audio');
    audio = mergeProps(audio, {
        controls: true,
        muted: true,
        src: URL.createObjectURL(stream)
    });
    audio.play();
    // audiosContainer.appendChild(audio);
    // audiosContainer.appendChild(document.createElement('hr'));
    mediaRecorder = new MediaStreamRecorder(stream);
    mediaRecorder.stream = stream;
    // var recorderType = document.getElementById('audio-recorderType').value;

    mediaRecorder.recorderType = StereoAudioRecorder;
    mediaRecorder.mimeType = 'audio/wav';
    // if (recorderType === 'MediaRecorder API') {
    //     mediaRecorder.recorderType = MediaRecorderWrapper;
    // }
    // if (recorderType === 'WebAudio API (WAV)') {
    //     mediaRecorder.recorderType = StereoAudioRecorder;
    //     mediaRecorder.mimeType = 'audio/wav';
    // }
    // if (recorderType === 'WebAudio API (PCM)') {
    //     mediaRecorder.recorderType = StereoAudioRecorder;
    //     mediaRecorder.mimeType = 'audio/pcm';
    // }
    // don't force any mimeType; use above "recorderType" instead.
    // mediaRecorder.mimeType = 'audio/webm'; // audio/ogg or audio/wav or audio/webm
    mediaRecorder.audioChannels = 1;
    mediaRecorder.ondataavailable = function(blob) {
        var a = document.createElement('a');
        a.target = '_blank';
        a.innerHTML = 'Open Recorded Audio No. ' + (index++) + ' (Size: ' + bytesToSize(blob.size) + ') Time Length: ' + getTimeLength(timeInterval);
        a.href = URL.createObjectURL(blob);
        // uploadToPHPServer(blob);
        // audiosContainer.appendChild(a);
        // audiosContainer.appendChild(document.createElement('hr'));
        uploadToPHPServer(blob);
    };
    var timeInterval = 5000;
    // if (timeInterval) timeInterval = parseInt(timeInterval);
    // else timeInterval = 5 * 1000;
    // get blob after specific time interval
    mediaRecorder.start(timeInterval);
    document.querySelector('#stop-recording').disabled = false;
    // document.querySelector('#pause-recording').disabled = false;
    // document.querySelector('#save-recording').disabled = false;
}
function onMediaError(e) {
    console.error('media error', e);
}
// var audiosContainer = document.getElementById('audios-container');
var index = 1;
// below function via: http://goo.gl/B3ae8c
function bytesToSize(bytes) {
    var k = 1000;
    var sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    if (bytes === 0) return '0 Bytes';
    var i = parseInt(Math.floor(Math.log(bytes) / Math.log(k)), 10);
    return (bytes / Math.pow(k, i)).toPrecision(3) + ' ' + sizes[i];
}
// below function via: http://goo.gl/6QNDcI
function getTimeLength(milliseconds) {
    var data = new Date(milliseconds);
    return data.getUTCHours() + " hours, " + data.getUTCMinutes() + " minutes and " + data.getUTCSeconds() + " second(s)";
}
window.onbeforeunload = function() {
    document.querySelector('#start-recording').disabled = false;
};

function uploadToPHPServer(blob) {
    var file = new File([blob], 'msr-' + (new Date).toISOString().replace(/:|\./g, '-') + '.webm', {
        type: 'video/webm'
    });

    // create FormData
    var formData = new FormData();
    formData.append('video-filename', file.name);
    formData.append('video-blob', file);

    makeXMLHttpRequest('save.php', formData, function() {
        var downloadURL = 'uploads/' + file.name;
        console.log('File uploaded to this path:', downloadURL);
    });
}

function makeXMLHttpRequest(url, data, callback) {
    var request = new XMLHttpRequest();
    request.onreadystatechange = function() {
        if (request.readyState == 4 && request.status == 200) {
            callback();
        }
    };
    request.open('POST', url);
    request.send(data);
}



//sending to server w/ PHP

// mediaRecorder.ondataavailable = function(blob) {
//     // upload each blob to PHP server
//     uploadToPHPServer(blob);
// };

// $(function(){
//   $('#upload-recording').on('click', function() {
//       var formData = new FormData();
//       formData.append('audio-filename', 'audio');
//       formData.append('audio-blob', "placeholder");
//       $.ajax({
//                   url: 'upload.php', // point to server-side PHP script
//                   dataType: 'audio',  // what to expect back from the PHP script, if anything
//                   cache: false,
//                   contentType: false,
//                   processData: false,
//                   data: formData,
//                   type: 'post',
//                   success: function(php_script_response){
//                       alert(php_script_response); // display response from the PHP script, if any
//                   }
//        });
//   });
// });




// function uploadToPHPServer(blob) {
//     var file = new File([blob], 'msr-' + (new Date).toISOString().replace(/:|\./g, '-') + '.wav', {
//         type: 'audio/wav'
//     });
//
//     // create FormData
//     var formData = new FormData();
//     formData.append('audio-filename', file.name);
//     formData.append('audio-blob', file);
//
//     makeXMLHttpRequest('uploadAudio.php', formData, function() {
//         var downloadURL = 'https:uploads/' + file.name;
//         console.log('File uploaded to this path:', downloadURL);
//     });
// }
//
// function makeXMLHttpRequest(url, data, callback) {
//     var request = new XMLHttpRequest();
//     request.onreadystatechange = function() {
//         if (request.readyState == 4 && request.status == 200) {
//             callback();
//         }
//     };
//     request.open('POST', url);
//     request.send(data);
// }
