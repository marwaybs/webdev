$( document ).ready(function() {
    console.log( "ready!" );
});

/* When the library loads the callback will be invoked */
function onVidyoClientLoaded(status) {
  console.log(status.state);
  console.log("AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA");
  console.log(tokenID);
  switch (status.state) {
    case "READY":    // The library is operating normally


      /* JavaScript Example: */
      /* Assume that the DOM has a div with id="renderer" where the preview and the live conference should be rendered */
      /* After the VidyoClient is successfully initialized a global VC object will become available  */

      VC.CreateVidyoConnector({
        viewId: "null",                            // Div ID where the composited video will be rendered, see VidyoConnector.html
        viewStyle: "VIDYO_CONNECTORVIEWSTYLE_Default", // Visual style of the composited renderer
        remoteParticipants: 16,                        // Maximum number of participants
        logFileFilter: "warning all@VidyoConnector info@VidyoClient",
        logFileName:"",
        userData:""
      }).then(function(vidyoConnector) {
         vidyoConnector.Connect({
           host: "prod.vidyo.io",
           token: tokenID,
           displayName: "client",
           resourceId: "therapyElevator",

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
          vidyoConnector.RegisterParticipantEventListener(
          {
            onJoined: function(participant) { /* Participant Joined */ },
            onLeft: function(participant)   { /* Participant Left */ },
            onDynamicChanged: function(participants, cameras) { /* Ordered array of participants according to rank */ },
            onLoudestChanged: function(participant, audioOnly) { /* Current loudest speaker */ }
          }).then(function() {
            console.log("RegisterParticipantEventListener Success");
          }).catch(function() {
            console.err("RegisterParticipantEventListener Failed");
          });
          /* JavaScript Example: */

          /* custom local preview */
          vidyoConnector.RegisterLocalCameraEventListener({
            onAdded: function(localCamera) {
                /* New camera is available. */
            },
            onRemoved: function(localCamera) {
                /* Existing camera became unavailable. */
                if ( /* the removed camera is the selected camera */ ) {
                    vidyoConnector.HideView({ viewId: "Div where camera was rendered" });
                }
            },
            onSelected: function(localCamera) {
              /* Camera was selected by user or automatically */
              vidyoConnector.AssignViewToLocalCamera({
                viewId: "local",
                localCamera: localCamera,
                displayCropped: true,
                allowZoom: false
              });
            },
            onStateUpdated: function(localCamera, state) { /* Camera state was updated */ }
          }).then(function() {
            console.log("RegisterLocalCameraEventListener Success");
          }).catch(function() {
            console.error("RegisterLocalCameraEventListener Failed");
          });

          /* Local camera change initiated by user. Note: this is an arbitrary function name. */
          function handleCameraChange() {
            /* Hide view of previously selected camera. */
            vidyoConnector.HideView({
              viewId: "local"
            });
            /* Select new camera */
            vidyoConnector.SelectLocalCamera({
              localCamera: camera
            });
          }

          /******************************************************************************/

          /* custom remote participant's source view */
          vidyoConnector.RegisterRemoteCameraEventListener({
            onAdded: function(remoteCamera, participant) {
              /* New camera is available. */
              if (/* This camera is desired to be viewed */) {
                vidyoConnector.AssignViewToRemoteCamera({
                  viewId: "remote",
                  remoteCamera: remoteCamera,
                  displayCropped: true,
                  allowZoom: false
                });
              }
            },
            onRemoved: function(remoteCamera, participant) {
              /* Existing camera became unavailable. */
              if (/* This camera was being viewed */) {
                vidyoConnector.HideView({
                  viewId: "remote"
                });
              }
            },
            onStateUpdated: function(remoteCamera, participant, state) { /* Camera state was updated */ }
          }).then(function() {
            console.log("RegisterRemoteCameraEventListener Success");
          }).catch(function() {
            console.error("RegisterRemoteCameraEventListener Failed");
          });

          /******************************************************************************/

          /* custom remote participant's window share view */
          vidyoConnector.RegisterRemoteWindowShareEventListener({
            onAdded: function(remoteWindowShare, participant) {
              /* New window is available for sharing. */
              if (/* This is the window that is desired to view */) {
                vidyoConnector.AssignViewToRemoteWindowShare({
                  viewId: null,
                  remoteWindowShare: remoteWindowShare,
                  displayCropped: true,
                  allowZoom: false
                });
              }
            },
            onRemoved: function(remoteWindowShare, participant) {
              /* Existing window is no longer available for sharing */
              if (/* This is the window that was being viewed */) {
                vidyoConnector.HideView({
                  viewId: null
                });
              }
            }
          }).then(function() {
            console.log("RegisterRemoteWindowShareEventListener Success");
          }).catch(function() {
            console.error("RegisterRemoteWindowShareEventListener Failed");
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
