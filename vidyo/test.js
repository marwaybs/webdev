// A $( document ).ready() block.
$( document ).ready(function() {
    console.log( "ready!" );
});


$(function() {
  console.log(status.state);
  console.log("cat");
  onVidyoClientLoaded(status.state);
});

/* When the library loads the callback will be invoked */
function onVidyoClientLoaded(status) {
  switch (status.state) {
    console.log(status.state);
    case "READY":    // The library is operating normally


      /* JavaScript Example: */
      /* Assume that the DOM has a div with id="renderer" where the preview and the live conference should be rendered */
      /* After the VidyoClient is successfully initialized a global VC object will become available  */

      VC.CreateVidyoConnector({
        viewId: "renderer",                            // Div ID where the composited video will be rendered, see VidyoConnector.html
        viewStyle: "VIDYO_CONNECTORVIEWSTYLE_Default", // Visual style of the composited renderer
        remoteParticipants: 16,                        // Maximum number of participants
        logFileFilter: "warning all@VidyoConnector info@VidyoClient",
        logFileName:"",
        userData:""
      }).then(function(vidyoConnector) {
         vidyoConnector.Connect({
           host: "prod.vidyo.io",
           token: generatedToken,
           displayName: "John Smith",
           resourceId: "JohnSmithRoom",

           // Define handlers for connection events.
           onSuccess: function()            {/* Connected */},
           onFailure: function(reason)      {/* Failed */},
           onDisconnected: function(reason) {/* Disconnected */}
          }).then(function(status) {
              if (status) {
                  console.log("ConnectCall Success");
              } else {
                  console.error("ConnectCall Failed");
              }
          }).catch(function() {
              console.error("ConnectCall Failed");
          });
      }).catch(function() {
        console.error("CreateVidyoConnector Failed");
      });


      break;
    case "RETRYING":     // The library operating is temporarily paused
      break;
    case "FAILED":       // The library operating has stopped
      break;
    case "FAILEDVERSION":// The version of the Javascript library does not match the plugin
      status.plugInVersion; // The Version of the plugin currently installed
      status.jsVersion;     // The Version of the Javascript library loaded
      break;
    case "NOTAVAILABLE": // The library is not available
      break;
  }
  status.downloadType;                // Available download types with possible values of "MOBILE" "PLUGIN" "APP"
  status.downloadPathApp;             // Path to the application installer for the app which could be invoked with a protocol handler
  status.downloadPathPlugIn;          // Path to the Plugin that can be installed
  status.downloadPathWebRTCExtension; // Path to the optional extension required for Screen Sharing in WebRTC

  return true; // Return true to reload the plugins if not available
}