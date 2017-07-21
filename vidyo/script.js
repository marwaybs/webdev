// 
// /* When the library loads the callback will be invoked */
// function onVidyoClientLoaded(status) {
//   switch (status.state) {
//     case "READY":    // The library is operating normally
//       // After the VidyoClient/VidyoConnector is successfully initialized,
//       // a global VC object will become available.
//       //
//       // Load the rest of the application here
//       // ...
//       break;
//     case "RETRYING":     // The library operating is temporarily paused
//       break;
//     case "FAILED":       // The library operating has stopped
//       break;
//     case "FAILEDVERSION":// The version of the Javascript library does not match the plugin
//       status.plugInVersion; // The Version of the plugin currently installed
//       status.jsVersion;     // The Version of the Javascript library loaded
//       break;
//     case "NOTAVAILABLE": // The library is not available
//       break;
//   }
//   status.downloadType;                // Available download types with possible values of "MOBILE" "PLUGIN" "APP"
//   status.downloadPathApp;             // Path to the application installer for the app which could be invoked with a protocol handler
//   status.downloadPathPlugIn;          // Path to the Plugin that can be installed
//   status.downloadPathWebRTCExtension; // Path to the optional extension required for Screen Sharing in WebRTC
//
//   return true; // Return true to reload the plugins if not available
// }
//
// VC.CreateVidyoConnector({
//   viewId: "renderer",                            // Div ID where the composited video will be rendered, see VidyoConnector.html
//   viewStyle: "VIDYO_CONNECTORVIEWSTYLE_Default", // Visual style of the composited renderer
//   remoteParticipants: 16,                        // Maximum number of participants
//   logFileFilter: "warning all@VidyoConnector info@VidyoClient",
//   logFileName:"",
//   userData:""
// }).then(function(vidyoConnector) {
//    vidyoConnector.Connect({
//      host: "prod.vidyo.io",
//      token: generatedToken,
//      displayName: "John Smith",
//      resourceId: "JohnSmithRoom",
//
//      // Define handlers for connection events.
//      onSuccess: function()            {/* Connected */},
//      onFailure: function(reason)      {/* Failed */},
//      onDisconnected: function(reason) {/* Disconnected */}
//     }).then(function(status) {
//         if (status) {
//             console.log("ConnectCall Success");
//         } else {
//             console.error("ConnectCall Failed");
//         }
//     }).catch(function() {
//         console.error("ConnectCall Failed");
//     });
// }).catch(function() {
//   console.error("CreateVidyoConnector Failed");
// });
//
// /* JavaScript Example: */
//
// vidyoConnector.RegisterParticipantEventListener(
// {
//   onJoined: function(participant) { /* Participant Joined */ },
//   onLeft: function(participant)   { /* Participant Left */ },
//   onDynamicChanged: function(participants, cameras) { /* Ordered array of participants according to rank */ },
//   onLoudestChanged: function(participant, audioOnly) { /* Current loudest speaker */ }
// }).then(function() {
//   console.log("RegisterParticipantEventListener Success");
// }).catch(function() {
//   console.err("RegisterParticipantEventListener Failed");
// });
//
// /* JavaScript Example: */
//
// /* Register to sreceive chat messages */
// vidyoConnector.RegisterMessageEventListener({
//   onChatMessageReceived: function(participant, chatMessage) { /* Message received from other participant */ }
// }).then(function() {
//   console.log("RegisterMessageEventListener Success");
// }).catch(function() {
//   console.err("RegisterMessageEventListener Failed");
// });
//
// /* Send chat message */
// vidyoConnector.SendChatMessage("Hello");
//
// /* JavaScript Example: */
//
// vidyoConnector.SelectDefaultCamera();
// vidyoConnector.SelectDefaultMicrophone();
// vidyoConnector.SelectDefaultSpeaker();

function ShowHelper(status) {
  var helperText = '';
  var protocolHandlerLink = 'vidyoconnector://?host=' + "HostName" + '&token=' + "Token" + '&displayName=' + "DisplayName" + '&resourceId=' + "DisplayName";
  switch (status.downloadType) {
    case "MOBILE":
      helperText += '<h2>Please download VidyoConnector from the App Store.</h2>';
      helperText += '<span> and then </span>';
      helperText += '<a href="' + protocolHandlerLink + '">launch</a>';
      break;
    case "APP":
      helperText += '<h2>Please download and launch VidyoConnector.</h2>';
      helperText += '<a href="' + status.downloadPathApp + '">download</a>';
      helperText += '<span> and then </span>';
      helperText += '<a href="' + protocolHandlerLink + '">launch</a>';
      break;
  }
}
