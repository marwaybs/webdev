(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.adapter = f()}})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){

},{}],2:[function(require,module,exports){
/*
 *  Copyright (c) 2016 The WebRTC project authors. All Rights Reserved.
 *
 *  Use of this source code is governed by a BSD-style license
 *  that can be found in the LICENSE file in the root of the source
 *  tree.
 */
'use strict';

// Shimming starts here.
(function() {
  // Utils.
  var logging = require('./utils').log;
  var browserDetails = require('./utils').browserDetails;
  // Export to the adapter global object visible in the browser.
  module.exports.browserDetails = browserDetails;
  module.exports.extractVersion = require('./utils').extractVersion;
  module.exports.disableLog = require('./utils').disableLog;

  // Uncomment if you do not want any logging at all including the switch
  // statement below. Can also be turned off in the browser via
  // adapter.disableLog(true) but then logging from the switch statement below
  // will still appear.
  //require('./utils').disableLog(true);

  // Warn if version is not supported regardless of browser.
  // Min version can be set per browser in utils.js
  if (browserDetails.version < browserDetails.minVersion) {
    logging('Browser: ' + browserDetails.browser + ' Version: ' +
        browserDetails.version + ' <' + ' minimum supported version: ' +
        browserDetails.minVersion + '\n some things might not work!');
  }

  // Browser shims.
  var chromeShim = require('./chrome/chrome_shim') || null;
  var edgeShim = require('./edge/edge_shim') || null;
  var firefoxShim = require('./firefox/firefox_shim') || null;

  // Shim browser if found.
  switch (browserDetails.browser) {
    case 'chrome':
      if (!chromeShim||!chromeShim.shimPeerConnection) {
        logging('Chrome shim is not included in this adapter release.');
        return;
      }
      logging('adapter.js shimming chrome!');
      // Export to the adapter global object visible in the browser.
      module.exports.browserShim = chromeShim;

      chromeShim.shimGetUserMedia();
      chromeShim.shimSourceObject();
      chromeShim.shimPeerConnection();
      chromeShim.shimOnTrack();
      break;
    case 'edge':
      if (!edgeShim||!edgeShim.shimPeerConnection) {
        logging('MS edge shim is not included in this adapter release.');
        return;
      }
      logging('adapter.js shimming edge!');
      // Export to the adapter global object visible in the browser.
      module.exports.browserShim = edgeShim;

      edgeShim.shimPeerConnection();
      break;
    case 'firefox':
      if (!firefoxShim||!firefoxShim.shimPeerConnection) {
        logging('Firefox shim is not included in this adapter release.');
        return;
      }
      logging('adapter.js shimming firefox!');
      // Export to the adapter global object visible in the browser.
      module.exports.browserShim = firefoxShim;

      firefoxShim.shimGetUserMedia();
      firefoxShim.shimSourceObject();
      firefoxShim.shimPeerConnection();
      firefoxShim.shimOnTrack();
      break;
    default:
      logging('Unsupported browser!');
  }
})();

},{"./chrome/chrome_shim":3,"./edge/edge_shim":1,"./firefox/firefox_shim":4,"./utils":5}],3:[function(require,module,exports){
/*
 *  Copyright (c) 2016 The WebRTC project authors. All Rights Reserved.
 *
 *  Use of this source code is governed by a BSD-style license
 *  that can be found in the LICENSE file in the root of the source
 *  tree.
 */
'use strict';
var logging = require('../utils.js').log;
var browserDetails = require('../utils.js').browserDetails;

var chromeShim = {
  shimOnTrack: function() {
    if (typeof window === 'object' && window.RTCPeerConnection && !('ontrack' in
        window.RTCPeerConnection.prototype)) {
      Object.defineProperty(window.RTCPeerConnection.prototype, 'ontrack', {
        get: function() { return this._ontrack; },
        set: function(f) {
          var self = this;
          if (this._ontrack) {
            this.removeEventListener('track', this._ontrack);
            this.removeEventListener('addstream', this._ontrackpoly);
          }
          this.addEventListener('track', this._ontrack = f);
          this.addEventListener('addstream', this._ontrackpoly = function(e) {
            // onaddstream does not fire when a track is added to an existing stream.
            // but stream.onaddtrack is implemented so we use that
            e.stream.addEventListener('addtrack', function(te) {
              var event = new Event('track');
              event.track = te.track;
              event.receiver = {track: te.track};
              event.streams = [e.stream];
              self.dispatchEvent(event);
            });
            e.stream.getTracks().forEach(function(track) {
              var event = new Event('track');
              event.track = track;
              event.receiver = {track: track};
              event.streams = [e.stream];
              this.dispatchEvent(event);
            }.bind(this));
          }.bind(this));
        }
      });
    }
  },

  shimSourceObject: function() {
    if (typeof window === 'object') {
      if (window.HTMLMediaElement &&
        !('srcObject' in window.HTMLMediaElement.prototype)) {
        // Shim the srcObject property, once, when HTMLMediaElement is found.
        Object.defineProperty(window.HTMLMediaElement.prototype, 'srcObject', {
          get: function() {
            return this._srcObject;
          },
          set: function(stream) {
            // Use _srcObject as a private property for this shim
            this._srcObject = stream;
            if (this.src) {
              URL.revokeObjectURL(this.src);
            }
            this.src = URL.createObjectURL(stream);
            // We need to recreate the blob url when a track is added or removed.
            // Doing it manually since we want to avoid a recursion.
            stream.addEventListener('addtrack', function() {
              if (self.src) {
                URL.revokeObjectURL(self.src);
              }
              self.src = URL.createObjectURL(stream);
            });
            stream.addEventListener('removetrack', function() {
              if (self.src) {
                URL.revokeObjectURL(self.src);
              }
              self.src = URL.createObjectURL(stream);
            });
          }
        });
      }
    }
  },

  shimPeerConnection: function() {
    // The RTCPeerConnection object.
    window.RTCPeerConnection = function(pcConfig, pcConstraints) {
      // Translate iceTransportPolicy to iceTransports,
      // see https://code.google.com/p/webrtc/issues/detail?id=4869
      logging('PeerConnection');
      if (pcConfig && pcConfig.iceTransportPolicy) {
        pcConfig.iceTransports = pcConfig.iceTransportPolicy;
      }

      var pc = new webkitRTCPeerConnection(pcConfig, pcConstraints); // jscs:ignore requireCapitalizedConstructors
      var origGetStats = pc.getStats.bind(pc);
      pc.getStats = function(selector, successCallback, errorCallback) { // jshint ignore: line
        var self = this;
        var args = arguments;

        // If selector is a function then we are in the old style stats so just
        // pass back the original getStats format to avoid breaking old users.
        if (arguments.length > 0 && typeof selector === 'function') {
          return origGetStats(selector, successCallback);
        }

        var fixChromeStats_ = function(response) {
          var standardReport = {};
          var reports = response.result();
          reports.forEach(function(report) {
            var standardStats = {
              id: report.id,
              timestamp: report.timestamp,
              type: report.type
            };
            report.names().forEach(function(name) {
              standardStats[name] = report.stat(name);
            });
            standardReport[standardStats.id] = standardStats;
          });

          return standardReport;
        };

        if (arguments.length >= 2) {
          var successCallbackWrapper_ = function(response) {
            args[1](fixChromeStats_(response));
          };

          return origGetStats.apply(this, [successCallbackWrapper_, arguments[0]]);
        }

        // promise-support
        return new Promise(function(resolve, reject) {
          if (args.length === 1 && selector === null) {
            origGetStats.apply(self, [
                function(response) {
                  resolve.apply(null, [fixChromeStats_(response)]);
                }, reject]);
          } else {
            origGetStats.apply(self, [resolve, reject]);
          }
        });
      };

      return pc;
    };
    window.RTCPeerConnection.prototype = webkitRTCPeerConnection.prototype;

    // wrap static methods. Currently just generateCertificate.
    if (webkitRTCPeerConnection.generateCertificate) {
      Object.defineProperty(window.RTCPeerConnection, 'generateCertificate', {
        get: function() {
          if (arguments.length) {
            return webkitRTCPeerConnection.generateCertificate.apply(null,
                arguments);
          } else {
            return webkitRTCPeerConnection.generateCertificate;
          }
        }
      });
    }

    // add promise support
    ['createOffer', 'createAnswer'].forEach(function(method) {
      var nativeMethod = webkitRTCPeerConnection.prototype[method];
      webkitRTCPeerConnection.prototype[method] = function() {
        var self = this;
        if (arguments.length < 1 || (arguments.length === 1 &&
            typeof(arguments[0]) === 'object')) {
          var opts = arguments.length === 1 ? arguments[0] : undefined;
          return new Promise(function(resolve, reject) {
            nativeMethod.apply(self, [resolve, reject, opts]);
          });
        } else {
          return nativeMethod.apply(this, arguments);
        }
      };
    });

    ['setLocalDescription', 'setRemoteDescription',
        'addIceCandidate'].forEach(function(method) {
      var nativeMethod = webkitRTCPeerConnection.prototype[method];
      webkitRTCPeerConnection.prototype[method] = function() {
        var args = arguments;
        var self = this;
        return new Promise(function(resolve, reject) {
          nativeMethod.apply(self, [args[0],
              function() {
                resolve();
                if (args.length >= 2) {
                  args[1].apply(null, []);
                }
              },
              function(err) {
                reject(err);
                if (args.length >= 3) {
                  args[2].apply(null, [err]);
                }
              }]
            );
        });
      };
    });
  },

  shimGetUserMedia: function() {
    var constraintsToChrome_ = function(c) {
      if (typeof c !== 'object' || c.mandatory || c.optional) {
        return c;
      }
      var cc = {};
      Object.keys(c).forEach(function(key) {
        if (key === 'require' || key === 'advanced' || key === 'mediaSource') {
          return;
        }
        var r = (typeof c[key] === 'object') ? c[key] : {ideal: c[key]};
        if (r.exact !== undefined && typeof r.exact === 'number') {
          r.min = r.max = r.exact;
        }
        var oldname_ = function(prefix, name) {
          if (prefix) {
            return prefix + name.charAt(0).toUpperCase() + name.slice(1);
          }
          return (name === 'deviceId') ? 'sourceId' : name;
        };
        if (r.ideal !== undefined) {
          cc.optional = cc.optional || [];
          var oc = {};
          if (typeof r.ideal === 'number') {
            oc[oldname_('min', key)] = r.ideal;
            cc.optional.push(oc);
            oc = {};
            oc[oldname_('max', key)] = r.ideal;
            cc.optional.push(oc);
          } else {
            oc[oldname_('', key)] = r.ideal;
            cc.optional.push(oc);
          }
        }
        if (r.exact !== undefined && typeof r.exact !== 'number') {
          cc.mandatory = cc.mandatory || {};
          cc.mandatory[oldname_('', key)] = r.exact;
        } else {
          ['min', 'max'].forEach(function(mix) {
            if (r[mix] !== undefined) {
              cc.mandatory = cc.mandatory || {};
              cc.mandatory[oldname_(mix, key)] = r[mix];
            }
          });
        }
      });
      if (c.advanced) {
        cc.optional = (cc.optional || []).concat(c.advanced);
      }
      return cc;
    };

    var getUserMedia_ = function(constraints, onSuccess, onError) {
      if (constraints.audio) {
        constraints.audio = constraintsToChrome_(constraints.audio);
      }
      if (constraints.video) {
        constraints.video = constraintsToChrome_(constraints.video);
      }
      logging('chrome: ' + JSON.stringify(constraints));
      return navigator.webkitGetUserMedia(constraints, onSuccess, onError);
    };
    navigator.getUserMedia = getUserMedia_;

    // Returns the result of getUserMedia as a Promise.
    var getUserMediaPromise_ = function(constraints) {
      return new Promise(function(resolve, reject) {
        navigator.getUserMedia(constraints, resolve, reject);
      });
    }

    if (!navigator.mediaDevices) {
      navigator.mediaDevices = {getUserMedia: getUserMediaPromise_,
                               enumerateDevices: function() {
        return new Promise(function(resolve) {
          var kinds = {audio: 'audioinput', video: 'videoinput'};
          return MediaStreamTrack.getSources(function(devices) {
            resolve(devices.map(function(device) {
              return {label: device.label,
                      kind: kinds[device.kind],
                      deviceId: device.id,
                      groupId: ''};
            }));
          });
        });
      }};
    }

    // A shim for getUserMedia method on the mediaDevices object.
    // TODO(KaptenJansson) remove once implemented in Chrome stable.
    if (!navigator.mediaDevices.getUserMedia) {
      navigator.mediaDevices.getUserMedia = function(constraints) {
        return getUserMediaPromise_(constraints);
      };
    } else {
      // Even though Chrome 45 has navigator.mediaDevices and a getUserMedia
      // function which returns a Promise, it does not accept spec-style
      // constraints.
      var origGetUserMedia = navigator.mediaDevices.getUserMedia.
          bind(navigator.mediaDevices);
      navigator.mediaDevices.getUserMedia = function(c) {
        if (c) {
          logging('spec:   ' + JSON.stringify(c)); // whitespace for alignment
          c.audio = constraintsToChrome_(c.audio);
          c.video = constraintsToChrome_(c.video);
          logging('chrome: ' + JSON.stringify(c));
        }
        return origGetUserMedia(c);
      }.bind(this);
    }

    // Dummy devicechange event methods.
    // TODO(KaptenJansson) remove once implemented in Chrome stable.
    if (typeof navigator.mediaDevices.addEventListener === 'undefined') {
      navigator.mediaDevices.addEventListener = function() {
        logging('Dummy mediaDevices.addEventListener called.');
      };
    }
    if (typeof navigator.mediaDevices.removeEventListener === 'undefined') {
      navigator.mediaDevices.removeEventListener = function() {
        logging('Dummy mediaDevices.removeEventListener called.');
      };
    }
  },

  // Attach a media stream to an element.
  attachMediaStream: function(element, stream) {
    logging('DEPRECATED, attachMediaStream will soon be removed.');
    if (browserDetails.version >= 43) {
      element.srcObject = stream;
    } else if (typeof element.src !== 'undefined') {
      element.src = URL.createObjectURL(stream);
    } else {
      logging('Error attaching stream to element.');
    }
  },

  reattachMediaStream: function(to, from) {
    logging('DEPRECATED, reattachMediaStream will soon be removed.');
    if (browserDetails.version >= 43) {
      to.srcObject = from.srcObject;
    } else {
      to.src = from.src;
    }
  }
}

// Expose public methods.
module.exports = {
  shimOnTrack: chromeShim.shimOnTrack,
  shimSourceObject: chromeShim.shimSourceObject,
  shimPeerConnection: chromeShim.shimPeerConnection,
  shimGetUserMedia: chromeShim.shimGetUserMedia,
  attachMediaStream: chromeShim.attachMediaStream,
  reattachMediaStream: chromeShim.reattachMediaStream
};

},{"../utils.js":5}],4:[function(require,module,exports){
/*
 *  Copyright (c) 2016 The WebRTC project authors. All Rights Reserved.
 *
 *  Use of this source code is governed by a BSD-style license
 *  that can be found in the LICENSE file in the root of the source
 *  tree.
 */
'use strict';

var logging = require('../utils').log;
var browserDetails = require('../utils').browserDetails;

var firefoxShim = {
  shimOnTrack: function() {
    if (typeof window === 'object' && window.RTCPeerConnection && !('ontrack' in
        window.RTCPeerConnection.prototype)) {
      Object.defineProperty(window.RTCPeerConnection.prototype, 'ontrack', {
        get: function() { return this._ontrack; },
        set: function(f) {
          var self = this;
          if (this._ontrack) {
            this.removeEventListener('track', this._ontrack);
            this.removeEventListener('addstream', this._ontrackpoly);
          }
          this.addEventListener('track', this._ontrack = f);
          this.addEventListener('addstream', this._ontrackpoly = function(e) {
            e.stream.getTracks().forEach(function(track) {
              var event = new Event('track');
              event.track = track;
              event.receiver = {track: track};
              event.streams = [e.stream];
              this.dispatchEvent(event);
            }.bind(this));
          }.bind(this));
        }
      });
    }
  },

  shimSourceObject: function() {
    // Firefox has supported mozSrcObject since FF22, unprefixed in 42.
    if (typeof window === 'object') {
      if (window.HTMLMediaElement &&
        !('srcObject' in window.HTMLMediaElement.prototype)) {
        // Shim the srcObject property, once, when HTMLMediaElement is found.
        Object.defineProperty(window.HTMLMediaElement.prototype, 'srcObject', {
          get: function() {
            return this.mozSrcObject;
          },
          set: function(stream) {
            this.mozSrcObject = stream;
          }
        });
      }
    }
  },

  shimPeerConnection: function() {
    // The RTCPeerConnection object.
    if (!window.RTCPeerConnection) {
      window.RTCPeerConnection = function(pcConfig, pcConstraints) {
        if (browserDetails.version < 38) {
          // .urls is not supported in FF < 38.
          // create RTCIceServers with a single url.
          if (pcConfig && pcConfig.iceServers) {
            var newIceServers = [];
            for (var i = 0; i < pcConfig.iceServers.length; i++) {
              var server = pcConfig.iceServers[i];
              if (server.hasOwnProperty('urls')) {
                for (var j = 0; j < server.urls.length; j++) {
                  var newServer = {
                    url: server.urls[j]
                  };
                  if (server.urls[j].indexOf('turn') === 0) {
                    newServer.username = server.username;
                    newServer.credential = server.credential;
                  }
                  newIceServers.push(newServer);
                }
              } else {
                newIceServers.push(pcConfig.iceServers[i]);
              }
            }
            pcConfig.iceServers = newIceServers;
          }
        }
        return new mozRTCPeerConnection(pcConfig, pcConstraints); // jscs:ignore requireCapitalizedConstructors
      };
      window.RTCPeerConnection.prototype = mozRTCPeerConnection.prototype;

      // wrap static methods. Currently just generateCertificate.
      if (mozRTCPeerConnection.generateCertificate) {
        Object.defineProperty(window.RTCPeerConnection, 'generateCertificate', {
          get: function() {
            if (arguments.length) {
              return mozRTCPeerConnection.generateCertificate.apply(null,
                  arguments);
            } else {
              return mozRTCPeerConnection.generateCertificate;
            }
          }
        });
      }

      window.RTCSessionDescription = mozRTCSessionDescription;
      window.RTCIceCandidate = mozRTCIceCandidate;
    }
  },

  shimGetUserMedia: function() {
    // getUserMedia constraints shim.
    var getUserMedia_ = function(constraints, onSuccess, onError) {
      var constraintsToFF37_ = function(c) {
        if (typeof c !== 'object' || c.require) {
          return c;
        }
        var require = [];
        Object.keys(c).forEach(function(key) {
          if (key === 'require' || key === 'advanced' || key === 'mediaSource') {
            return;
          }
          var r = c[key] = (typeof c[key] === 'object') ?
              c[key] : {ideal: c[key]};
          if (r.min !== undefined ||
              r.max !== undefined || r.exact !== undefined) {
            require.push(key);
          }
          if (r.exact !== undefined) {
            if (typeof r.exact === 'number') {
              r. min = r.max = r.exact;
            } else {
              c[key] = r.exact;
            }
            delete r.exact;
          }
          if (r.ideal !== undefined) {
            c.advanced = c.advanced || [];
            var oc = {};
            if (typeof r.ideal === 'number') {
              oc[key] = {min: r.ideal, max: r.ideal};
            } else {
              oc[key] = r.ideal;
            }
            c.advanced.push(oc);
            delete r.ideal;
            if (!Object.keys(r).length) {
              delete c[key];
            }
          }
        });
        if (require.length) {
          c.require = require;
        }
        return c;
      };
      if (browserDetails.version < 38) {
        logging('spec: ' + JSON.stringify(constraints));
        if (constraints.audio) {
          constraints.audio = constraintsToFF37_(constraints.audio);
        }
        if (constraints.video) {
          constraints.video = constraintsToFF37_(constraints.video);
        }
        logging('ff37: ' + JSON.stringify(constraints));
      }
      return navigator.mozGetUserMedia(constraints, onSuccess, onError);
    };

    navigator.getUserMedia = getUserMedia_;

    // Returns the result of getUserMedia as a Promise.
    var getUserMediaPromise_ = function(constraints) {
      return new Promise(function(resolve, reject) {
        navigator.getUserMedia(constraints, resolve, reject);
      });
    }

    // Shim for mediaDevices on older versions.
    if (!navigator.mediaDevices) {
      navigator.mediaDevices = {getUserMedia: getUserMediaPromise_,
        addEventListener: function() { },
        removeEventListener: function() { }
      };
    }
    navigator.mediaDevices.enumerateDevices =
        navigator.mediaDevices.enumerateDevices || function() {
      return new Promise(function(resolve) {
        var infos = [
          {kind: 'audioinput', deviceId: 'default', label: '', groupId: ''},
          {kind: 'videoinput', deviceId: 'default', label: '', groupId: ''}
        ];
        resolve(infos);
      });
    };

    if (browserDetails.version < 41) {
      // Work around http://bugzil.la/1169665
      var orgEnumerateDevices =
          navigator.mediaDevices.enumerateDevices.bind(navigator.mediaDevices);
      navigator.mediaDevices.enumerateDevices = function() {
        return orgEnumerateDevices().then(undefined, function(e) {
          if (e.name === 'NotFoundError') {
            return [];
          }
          throw e;
        });
      };
    }
  },

  // Attach a media stream to an element.
  attachMediaStream: function(element, stream) {
    logging('DEPRECATED, attachMediaStream will soon be removed.');
    element.srcObject = stream;
  },

  reattachMediaStream: function(to, from) {
    logging('DEPRECATED, reattachMediaStream will soon be removed.');
    to.srcObject = from.srcObject;
  }
}

// Expose public methods.
module.exports = {
  shimOnTrack: firefoxShim.shimOnTrack,
  shimSourceObject: firefoxShim.shimSourceObject,
  shimPeerConnection: firefoxShim.shimPeerConnection,
  shimGetUserMedia: firefoxShim.shimGetUserMedia,
  attachMediaStream: firefoxShim.attachMediaStream,
  reattachMediaStream: firefoxShim.reattachMediaStream
}

},{"../utils":5}],5:[function(require,module,exports){
/*
 *  Copyright (c) 2016 The WebRTC project authors. All Rights Reserved.
 *
 *  Use of this source code is governed by a BSD-style license
 *  that can be found in the LICENSE file in the root of the source
 *  tree.
 */
'use strict';

var logDisabled_ = false;

// Utility methods.
var utils = {
  disableLog: function(bool) {
    if (typeof bool !== 'boolean') {
      return new Error('Argument type: ' + typeof bool +
          '. Please use a boolean.');
    }
    logDisabled_ = bool;
    return (bool) ? 'adapter.js logging disabled' :
        'adapter.js logging enabled';
  },

  log: function() {
    if (typeof window === 'object') {
      if (logDisabled_) {
        return;
      }
      console.log.apply(console, arguments);
    }
  },

   /**
   * Extract browser version out of the provided user agent string.
   * @param {!string} uastring userAgent string.
   * @param {!string} expr Regular expression used as match criteria.
   * @param {!number} pos position in the version string to be returned.
   * @return {!number} browser version.
   */
  extractVersion: function(uastring, expr, pos) {
    var match = uastring.match(expr);
    return match && match.length >= pos && parseInt(match[pos], 10);
  },

  /**
   * Browser detector.
   * @return {object} result containing browser, version and minVersion
   *     properties.
   */
  detectBrowser: function() {
    // Returned result object.
    var result = {};
    result.browser = null;
    result.version = null;
    result.minVersion = null;

    // Non supported browser.
    if (typeof window === 'undefined' || !window.navigator) {
      result.browser = 'Not a supported browser.';
      return result;
    }

    // Firefox.
    if (navigator.mozGetUserMedia) {
      result.browser = 'firefox';
      result.version = this.extractVersion(navigator.userAgent,
          /Firefox\/([0-9]+)\./, 1);
      result.minVersion = 31;
      return result;
    }

    // Chrome/Chromium/Webview.
    if (navigator.webkitGetUserMedia && window.webkitRTCPeerConnection) {
      result.browser = 'chrome';
      result.version = this.extractVersion(navigator.userAgent,
          /Chrom(e|ium)\/([0-9]+)\./, 2);
      result.minVersion = 38;
      return result;
    }

    // Edge.
    if (navigator.mediaDevices &&
        navigator.userAgent.match(/Edge\/(\d+).(\d+)$/)) {
      result.browser = 'edge';
      result.version = this.extractVersion(navigator.userAgent,
          /Edge\/(\d+).(\d+)$/, 2);
      result.minVersion = 10547;
      return result;
    }
    
    // Non supported browser default.
    result.browser = 'Not a supported browser.';
    return result;
  }
};

// Export.
module.exports = {
  log: utils.log,
  disableLog: utils.disableLog,
  browserDetails: utils.detectBrowser(),
  extractVersion: utils.extractVersion
};

},{}]},{},[2])(2)
});
(function(w) {
var layoutMaker = {
    aspectW: 16, 
    aspectH: 9,
    minVisiblePctX: 70,
    minVisiblePctY: 100,
    equalSizes: true,
    strict: true,
    fill: true
};


/*  1 Participant                N xd yd #             0     */
const subRect_01_01_01_0 = [{ x:0,  y:0,  s:1}];

const layout1 =
[
	{ xd:1,  yd:1, full:true,  lovely:true,  flipped: true,  w:subRect_01_01_01_0}
];

/*  2 Participants               N xd yd #             0             1     */
const subRect_02_02_01_0 = [{ x:0,  y:0,  s:1}, { x:1,  y:0,  s:1}];

const layout2 =
[
	{ xd:2,  yd:1, full:true,  lovely:true,  flipped:true,  w:subRect_02_02_01_0}
];

/*  3 Participants               N xd yd #             0             1             2     */
const subRect_03_04_04_0 = [{ x:1,  y:0,  s:2}, { x:0,  y:2,  s:2}, { x:2,  y:2,  s:2}];
const subRect_03_03_02_0 = [{ x:0,  y:0,  s:2}, { x:2,  y:0,  s:1}, { x:2,  y:1,  s:1}];
const subRect_03_03_01_0 = [{ x:0,  y:0,  s:1}, { x:1,  y:0,  s:1}, { x:2,  y:0,  s:1}];

const layout3 =
[
	{ xd:4,  yd:4, full:false, lovely:true,  flipped:false, w:subRect_03_04_04_0},
	{ xd:3,  yd:2, full:true,  lovely:true,  flipped:true,  w:subRect_03_03_02_0},
	{ xd:3,  yd:1, full:true,  lovely:true,  flipped:true,  w:subRect_03_03_01_0}
];

/*  4 Participants               N xd yd #             0             1             2             3     */
const subRect_04_02_02_0 = [{ x:0,  y:0,  s:1}, { x:1,  y:0,  s:1}, { x:0,  y:1,  s:1}, { x:1,  y:1,  s:1}];
const subRect_04_04_03_0 = [{ x:0,  y:0,  s:3}, { x:3,  y:0,  s:1}, { x:3,  y:1,  s:1}, { x:3,  y:2,  s:1}];
const subRect_04_05_03_0 = [{ x:0,  y:0,  s:3}, { x:3,  y:0,  s:2}, { x:3,  y:2,  s:1}, { x:4,  y:2,  s:1}];
const subRect_04_05_02_0 = [{ x:0,  y:0,  s:2}, { x:2,  y:0,  s:2}, { x:4,  y:0,  s:1}, { x:4,  y:1,  s:1}];
const subRect_04_04_01_0 = [{ x:0,  y:0,  s:1}, { x:1,  y:0,  s:1}, { x:2,  y:0,  s:1}, { x:3,  y:0,  s:1}];

const layout4 =
[
	{ xd:2,  yd:2, full:true,  lovely:true,  flipped:true,  w:subRect_04_02_02_0},
	{ xd:4,  yd:3, full:true,  lovely:true,  flipped:true,  w:subRect_04_04_03_0},
	{ xd:5,  yd:3, full:true,  lovely:true,  flipped:true,  w:subRect_04_05_03_0},
	{ xd:5,  yd:2, full:true,  lovely:true,  flipped:true,  w:subRect_04_05_02_0},
	{ xd:4,  yd:1, full:true,  lovely:true,  flipped:true,  w:subRect_04_04_01_0}
];

/*  5 Participants               N xd yd #             0             1             2             3             4     */
const subRect_05_07_06_0 = [{ x:0,  y:0,  s:4}, { x:4,  y:0,  s:3}, { x:4,  y:3,  s:3}, { x:0,  y:4,  s:2}, { x:2,  y:4,  s:2}];
const subRect_05_06_05_0 = [{ x:0,  y:0,  s:3}, { x:3,  y:0,  s:3}, { x:0,  y:3,  s:2}, { x:2,  y:3,  s:2}, { x:4,  y:3,  s:2}];
const subRect_05_05_04_0 = [{ x:0,  y:0,  s:4}, { x:4,  y:0,  s:1}, { x:4,  y:1,  s:1}, { x:4,  y:2,  s:1}, { x:4,  y:3,  s:1}];
const subRect_05_07_05_0 = [{ x:0,  y:0,  s:5}, { x:5,  y:0,  s:2}, { x:5,  y:2,  s:2}, { x:5,  y:4,  s:1}, { x:6,  y:4,  s:1}];
const subRect_05_06_04_0 = [{ x:1,  y:0,  s:2}, { x:3,  y:0,  s:2}, { x:0,  y:2,  s:2}, { x:2,  y:2,  s:2}, { x:4,  y:2,  s:2}];
const subRect_05_08_05_0 = [{ x:0,  y:0,  s:5}, { x:5,  y:0,  s:3}, { x:5,  y:3,  s:2}, { x:7,  y:3,  s:1}, { x:7,  y:4,  s:1}];
const subRect_05_07_04_0 = [{ x:0,  y:0,  s:4}, { x:4,  y:0,  s:3}, { x:4,  y:3,  s:1}, { x:5,  y:3,  s:1}, { x:6,  y:3,  s:1}];
const subRect_05_04_02_0 = [{ x:0,  y:0,  s:2}, { x:2,  y:0,  s:1}, { x:2,  y:1,  s:1}, { x:3,  y:0,  s:1}, { x:3,  y:1,  s:1}];
const subRect_05_07_03_0 = [{ x:0,  y:0,  s:3}, { x:3,  y:0,  s:3}, { x:6,  y:0,  s:1}, { x:6,  y:1,  s:1}, { x:6,  y:2,  s:1}];
const subRect_05_08_03_0 = [{ x:0,  y:0,  s:3}, { x:3,  y:0,  s:3}, { x:6,  y:0,  s:2}, { x:6,  y:2,  s:1}, { x:7,  y:2,  s:1}];
const subRect_05_07_02_0 = [{ x:0,  y:0,  s:2}, { x:2,  y:0,  s:2}, { x:4,  y:0,  s:2}, { x:6,  y:0,  s:1}, { x:6,  y:1,  s:1}];
const subRect_05_05_01_0 = [{ x:0,  y:0,  s:1}, { x:1,  y:0,  s:1}, { x:2,  y:0,  s:1}, { x:3,  y:0,  s:1}, { x:4,  y:0,  s:1}];

const layout5 =
[
	{ xd:7,  yd:6, full:true,  lovely:true,  flipped:true,  w:subRect_05_07_06_0},
	{ xd:6,  yd:5, full:true,  lovely:true,  flipped:true,  w:subRect_05_06_05_0},
	{ xd:5,  yd:4, full:true,  lovely:true,  flipped:true,  w:subRect_05_05_04_0},
	{ xd:7,  yd:5, full:true,  lovely:true,  flipped:true,  w:subRect_05_07_05_0},
	{ xd:6,  yd:4, full:false, lovely:true,  flipped:false, w:subRect_05_06_04_0},
	{ xd:8,  yd:5, full:true,  lovely:true,  flipped:true,  w:subRect_05_08_05_0},
	{ xd:7,  yd:4, full:true,  lovely:true,  flipped:true,  w:subRect_05_07_04_0},
	{ xd:4,  yd:2, full:true,  lovely:true,  flipped:true,  w:subRect_05_04_02_0},
	{ xd:7,  yd:3, full:true,  lovely:true,  flipped:true,  w:subRect_05_07_03_0},
	{ xd:8,  yd:3, full:true,  lovely:true,  flipped:true,  w:subRect_05_08_03_0},
	{ xd:7,  yd:2, full:true,  lovely:true,  flipped:true,  w:subRect_05_07_02_0},
	{ xd:5,  yd:1, full:true,  lovely:true,  flipped:true,  w:subRect_05_05_01_0}
];

/*  6 Participants               N xd yd #             0             1             2             3             4             5     */
const subRect_06_03_03_0 = [{ x:0,  y:0,  s:2}, { x:2,  y:0,  s:1}, { x:2,  y:1,  s:1}, { x:0,  y:2,  s:1}, { x:1,  y:2,  s:1}, { x:2,  y:2,  s:1}];
const subRect_06_11_10_0 = [{ x:0,  y:0,  s:6}, { x:6,  y:0,  s:5}, { x:6,  y:5,  s:5}, { x:0,  y:6,  s:4}, { x:4,  y:6,  s:2}, { x:4,  y:8,  s:2}];
const subRect_06_10_09_0 = [{ x:0,  y:0,  s:5}, { x:5,  y:0,  s:5}, { x:0,  y:5,  s:4}, { x:6,  y:5,  s:4}, { x:4,  y:5,  s:2}, { x:4,  y:7,  s:2}];
const subRect_06_06_05_0 = [{ x:0,  y:0,  s:5}, { x:5,  y:0,  s:1}, { x:5,  y:1,  s:1}, { x:5,  y:2,  s:1}, { x:5,  y:3,  s:1}, { x:5,  y:4,  s:1}];
const subRect_06_05_04_0 = [{ x:0,  y:0,  s:3}, { x:3,  y:0,  s:2}, { x:3,  y:2,  s:2}, { x:0,  y:3,  s:1}, { x:1,  y:3,  s:1}, { x:2,  y:3,  s:1}];
const subRect_06_04_03_0 = [{ x:0,  y:0,  s:2}, { x:2,  y:0,  s:2}, { x:0,  y:2,  s:1}, { x:1,  y:2,  s:1}, { x:2,  y:2,  s:1}, { x:3,  y:2,  s:1}];
const subRect_06_03_02_0 = [{ x:0,  y:0,  s:1}, { x:1,  y:0,  s:1}, { x:2,  y:0,  s:1}, { x:0,  y:1,  s:1}, { x:1,  y:1,  s:1}, { x:2,  y:1,  s:1}];
const subRect_06_06_04_0 = [{ x:0,  y:0,  s:4}, { x:4,  y:0,  s:2}, { x:4,  y:2,  s:1}, { x:5,  y:2,  s:1}, { x:4,  y:3,  s:1}, { x:5,  y:3,  s:1}];
const subRect_06_09_05_0 = [{ x:0,  y:0,  s:5}, { x:5,  y:0,  s:4}, { x:5,  y:4,  s:1}, { x:6,  y:4,  s:1}, { x:7,  y:4,  s:1}, { x:8,  y:4,  s:1}];
const subRect_06_11_06_0 = [{ x:0,  y:0,  s:6}, { x:6,  y:0,  s:3}, { x:6,  y:3,  s:3}, { x:9,  y:0,  s:2}, { x:9,  y:2,  s:2}, { x:9,  y:4,  s:2}];
const subRect_06_13_07_0 = [{ x:0,  y:0,  s:7}, { x:7,  y:0,  s:4}, { x:7,  y:4,  s:3}, {x:10,  y:4,  s:3}, {x:11,  y:0,  s:2}, {x:11,  y:2,  s:2}];
const subRect_06_13_06_0 = [{ x:0,  y:0,  s:6}, { x:6,  y:0,  s:4}, {x:10,  y:0,  s:3}, {x:10,  y:3,  s:3}, { x:6,  y:4,  s:2}, { x:8,  y:4,  s:2}];
const subRect_06_11_05_0 = [{ x:0,  y:0,  s:5}, { x:5,  y:0,  s:3}, { x:8,  y:0,  s:3}, { x:5,  y:3,  s:2}, { x:7,  y:3,  s:2}, { x:9,  y:3,  s:2}];
const subRect_06_09_04_0 = [{ x:0,  y:0,  s:4}, { x:4,  y:0,  s:4}, { x:8,  y:0,  s:1}, { x:8,  y:1,  s:1}, { x:8,  y:2,  s:1}, { x:8,  y:3,  s:1}];
const subRect_06_12_05_0 = [{ x:0,  y:0,  s:5}, { x:5,  y:0,  s:5}, {x:10,  y:0,  s:2}, {x:10,  y:2,  s:2}, {x:10,  y:4,  s:1}, {x:11,  y:4,  s:1}];
const subRect_06_13_05_0 = [{ x:0,  y:0,  s:5}, { x:5,  y:0,  s:5}, {x:10,  y:0,  s:3}, {x:10,  y:3,  s:2}, {x:12,  y:3,  s:1}, {x:12,  y:4,  s:1}];
const subRect_06_11_04_0 = [{ x:0,  y:0,  s:4}, { x:4,  y:0,  s:4}, { x:8,  y:0,  s:3}, { x:8,  y:3,  s:1}, { x:9,  y:3,  s:1}, {x:10,  y:3,  s:1}];
const subRect_06_06_02_0 = [{ x:0,  y:0,  s:2}, { x:2,  y:0,  s:2}, { x:4,  y:0,  s:1}, { x:5,  y:0,  s:1}, { x:4,  y:1,  s:1}, { x:5,  y:1,  s:1}];
const subRect_06_10_03_0 = [{ x:0,  y:0,  s:3}, { x:3,  y:0,  s:3}, { x:6,  y:0,  s:3}, { x:9,  y:0,  s:1}, { x:9,  y:1,  s:1}, { x:9,  y:2,  s:1}];
const subRect_06_11_03_0 = [{ x:0,  y:0,  s:3}, { x:3,  y:0,  s:3}, { x:6,  y:0,  s:3}, { x:9,  y:0,  s:2}, { x:9,  y:2,  s:1}, {x:10,  y:2,  s:1}];
const subRect_06_09_02_0 = [{ x:0,  y:0,  s:2}, { x:2,  y:0,  s:2}, { x:4,  y:0,  s:2}, { x:6,  y:0,  s:2}, { x:8,  y:0,  s:1}, { x:8,  y:1,  s:1}];
const subRect_06_06_01_0 = [{ x:0,  y:0,  s:1}, { x:1,  y:0,  s:1}, { x:2,  y:0,  s:1}, { x:3,  y:0,  s:1}, { x:4,  y:0,  s:1}, { x:5,  y:0,  s:1}];

const layout6 =
[
	{ xd:3,  yd:3, full:true,  lovely:true,  flipped:true,  w:subRect_06_03_03_0},
	{xd:11, yd:10, full:true,  lovely:true,  flipped:true,  w:subRect_06_11_10_0},
	{xd:10,  yd:9, full:true,  lovely:true,  flipped:true,  w:subRect_06_10_09_0},
	{ xd:6,  yd:5, full:true,  lovely:true,  flipped:true,  w:subRect_06_06_05_0},
	{ xd:5,  yd:4, full:true,  lovely:true,  flipped:true,  w:subRect_06_05_04_0},
	{ xd:4,  yd:3, full:true,  lovely:true,  flipped:true,  w:subRect_06_04_03_0},
	{ xd:3,  yd:2, full:true,  lovely:true,  flipped:true,  w:subRect_06_03_02_0},
	{ xd:6,  yd:4, full:true,  lovely:true,  flipped:true,  w:subRect_06_06_04_0},
	{ xd:9,  yd:5, full:true,  lovely:true,  flipped:true,  w:subRect_06_09_05_0},
	{xd:11,  yd:6, full:true,  lovely:true,  flipped:true,  w:subRect_06_11_06_0},
	{xd:13,  yd:7, full:true,  lovely:true,  flipped:true,  w:subRect_06_13_07_0},
	{xd:13,  yd:6, full:true,  lovely:true,  flipped:true,  w:subRect_06_13_06_0},
	{xd:11,  yd:5, full:true,  lovely:true,  flipped:true,  w:subRect_06_11_05_0},
	{ xd:9,  yd:4, full:true,  lovely:true,  flipped:true,  w:subRect_06_09_04_0},
	{xd:12,  yd:5, full:true,  lovely:true,  flipped:true,  w:subRect_06_12_05_0},
	{xd:13,  yd:5, full:true,  lovely:true,  flipped:true,  w:subRect_06_13_05_0},
	{xd:11,  yd:4, full:true,  lovely:true,  flipped:true,  w:subRect_06_11_04_0},
	{ xd:6,  yd:2, full:true,  lovely:true,  flipped:true,  w:subRect_06_06_02_0},
	{xd:10,  yd:3, full:true,  lovely:true,  flipped:true,  w:subRect_06_10_03_0},
	{xd:11,  yd:3, full:true,  lovely:true,  flipped:true,  w:subRect_06_11_03_0},
	{ xd:9,  yd:2, full:true,  lovely:true,  flipped:true,  w:subRect_06_09_02_0},
	{ xd:6,  yd:1, full:true,  lovely:true,  flipped:true,  w:subRect_06_06_01_0}
];

/*  7 Participants               N xd yd #             0             1             2             3             4             5             6     */
const subRect_07_04_04_0 = [{ x:0,  y:0,  s:2}, { x:2,  y:0,  s:2}, { x:0,  y:2,  s:2}, { x:2,  y:2,  s:1}, { x:3,  y:2,  s:1}, { x:2,  y:3,  s:1}, { x:3,  y:3,  s:1}];
const subRect_07_06_06_0 = [{ x:1,  y:0,  s:2}, { x:3,  y:0,  s:2}, { x:0,  y:2,  s:2}, { x:2,  y:2,  s:2}, { x:4,  y:2,  s:2}, { x:1,  y:4,  s:2}, { x:3,  y:4,  s:2}];
const subRect_07_15_14_0 = [{ x:0,  y:0,  s:9}, { x:9,  y:3,  s:6}, { x:0,  y:9,  s:5}, { x:5,  y:9,  s:5}, {x:10,  y:9,  s:5}, { x:9,  y:0,  s:3}, {x:12,  y:0,  s:3}];
const subRect_07_14_13_0 = [{ x:0,  y:0,  s:7}, { x:7,  y:0,  s:7}, { x:0,  y:7,  s:6}, { x:8,  y:7,  s:6}, { x:6,  y:7,  s:2}, { x:6,  y:9,  s:2}, { x:6,  y:11, s:2}];
const subRect_07_13_12_0 = [{ x:0,  y:0,  s:9}, { x:9,  y:0,  s:4}, { x:9,  y:4,  s:4}, { x:9,  y:8,  s:4}, { x:0,  y:9,  s:3}, { x:3,  y:9,  s:3}, { x:6,  y:9,  s:3}];
const subRect_07_12_11_0 = [{ x:0,  y:0,  s:8}, { x:8,  y:0,  s:4}, { x:8,  y:4,  s:4}, { x:0,  y:8,  s:3}, { x:3,  y:8,  s:3}, { x:6,  y:8,  s:3}, { x:9,  y:8,  s:3}];
const subRect_07_08_06_0 = [{ x:0,  y:0,  s:3}, { x:3,  y:0,  s:3}, { x:0,  y:3,  s:3}, { x:3,  y:3,  s:3}, { x:6,  y:0,  s:2}, { x:6,  y:2,  s:2}, { x:6,  y:4,  s:2}];
const subRect_07_15_11_0 = [{ x:0,  y:0,  s:6}, { x:9,  y:0,  s:6}, { x:0,  y:6,  s:5}, { x:5,  y:6,  s:5}, {x:10,  y:6,  s:5}, { x:6,  y:0,  s:3}, { x:6,  y:3,  s:3}];
const subRect_07_07_05_0 = [{ x:0,  y:0,  s:3}, { x:4,  y:2,  s:3}, { x:3,  y:0,  s:2}, { x:5,  y:0,  s:2}, { x:0,  y:3,  s:2}, { x:2,  y:3,  s:2}, { x:3,  y:2,  s:1}];
const subRect_07_10_07_0 = [{ x:0,  y:0,  s:5}, { x:5,  y:0,  s:5}, { x:0,  y:5,  s:2}, { x:2,  y:5,  s:2}, { x:4,  y:5,  s:2}, { x:6,  y:5,  s:2}, { x:8,  y:5,  s:2}];
const subRect_07_05_03_0 = [{ x:0,  y:0,  s:3}, { x:3,  y:0,  s:1}, { x:4,  y:0,  s:1}, { x:3,  y:1,  s:1}, { x:4,  y:1,  s:1}, { x:3,  y:2,  s:1}, { x:4,  y:2,  s:1}];
const subRect_07_10_06_0 = [{ x:0,  y:0,  s:4}, { x:4,  y:0,  s:3}, { x:7,  y:0,  s:3}, { x:4,  y:3,  s:3}, { x:7,  y:3,  s:3}, { x:0,  y:4,  s:2}, { x:2,  y:4,  s:2}];
const subRect_07_17_10_0 = [{ x:0,  y:0,  s:6}, { x:6,  y:0,  s:6}, {x:12,  y:0,  s:5}, {x:12,  y:5,  s:5}, { x:0,  y:6,  s:4}, { x:4,  y:6,  s:4}, { x:8,  y:6,  s:4}];
const subRect_07_12_07_0 = [{ x:0,  y:0,  s:4}, { x:4,  y:0,  s:4}, { x:8,  y:0,  s:4}, { x:0,  y:4,  s:3}, { x:3,  y:4,  s:3}, { x:6,  y:4,  s:3}, { x:9,  y:4,  s:3}];
const subRect_07_07_04_0 = [{ x:0,  y:0,  s:4}, { x:4,  y:0,  s:2}, { x:4,  y:2,  s:2}, { x:6,  y:0,  s:1}, { x:6,  y:1,  s:1}, { x:6,  y:2,  s:1}, { x:6,  y:3,  s:1}];
const subRect_07_06_03_0 = [{ x:0,  y:0,  s:3}, { x:3,  y:0,  s:2}, { x:5,  y:0,  s:1}, { x:5,  y:1,  s:1}, { x:3,  y:2,  s:1}, { x:4,  y:2,  s:1}, { x:5,  y:2,  s:1}];
const subRect_07_08_04_0 = [{ x:1,  y:0,  s:2}, { x:3,  y:0,  s:2}, { x:5,  y:0,  s:2}, { x:0,  y:2,  s:2}, { x:2,  y:2,  s:2}, { x:4,  y:2,  s:2}, { x:6,  y:2,  s:2}];
const subRect_07_07_03_0 = [{ x:0,  y:0,  s:3}, { x:3,  y:0,  s:2}, { x:5,  y:0,  s:2}, { x:3,  y:2,  s:1}, { x:4,  y:2,  s:1}, { x:5,  y:2,  s:1}, { x:6,  y:2,  s:1}];
const subRect_07_05_02_0 = [{ x:0,  y:0,  s:2}, { x:2,  y:0,  s:1}, { x:3,  y:0,  s:1}, { x:4,  y:0,  s:1}, { x:2,  y:1,  s:1}, { x:3,  y:1,  s:1}, { x:4,  y:1,  s:1}];
const subRect_07_17_06_0 = [{ x:0,  y:0,  s:6}, { x:6,  y:0,  s:6}, {x:12,  y:0,  s:3}, {x:12,  y:3,  s:3}, {x:15,  y:0,  s:2}, {x:15,  y:2,  s:2}, {x:15,  y:4,  s:2}];
const subRect_07_19_06_0 = [{ x:0,  y:0,  s:6}, { x:6,  y:0,  s:6}, {x:12,  y:0,  s:4}, {x:16,  y:0,  s:3}, {x:16,  y:3,  s:3}, {x:12,  y:4,  s:2}, {x:14,  y:4,  s:2}];
const subRect_07_16_05_0 = [{ x:0,  y:0,  s:5}, { x:5,  y:0,  s:5}, {x:10,  y:0,  s:3}, {x:13,  y:0,  s:3}, {x:10,  y:3,  s:2}, {x:12,  y:3,  s:2}, {x:14,  y:3,  s:2}];
const subRect_07_13_04_0 = [{ x:0,  y:0,  s:4}, { x:4,  y:0,  s:4}, { x:8,  y:0,  s:4}, {x:12,  y:0,  s:1}, {x:12,  y:1,  s:1}, {x:12,  y:2,  s:1}, {x:12,  y:3,  s:1}];
const subRect_07_15_04_0 = [{ x:0,  y:0,  s:4}, { x:4,  y:0,  s:4}, { x:8,  y:0,  s:4}, {x:12,  y:0,  s:3}, {x:12,  y:3,  s:1}, {x:13,  y:3,  s:1}, {x:14,  y:3,  s:1}];
const subRect_07_08_02_0 = [{ x:0,  y:0,  s:2}, { x:2,  y:0,  s:2}, { x:4,  y:0,  s:2}, { x:6,  y:0,  s:1}, { x:7,  y:0,  s:1}, { x:6,  y:1,  s:1}, { x:7,  y:1,  s:1}];
const subRect_07_13_03_0 = [{ x:0,  y:0,  s:3}, { x:3,  y:0,  s:3}, { x:6,  y:0,  s:3}, { x:9,  y:0,  s:3}, {x:12,  y:0,  s:1}, {x:12,  y:1,  s:1}, {x:12,  y:2,  s:1}];
const subRect_07_14_03_0 = [{ x:0,  y:0,  s:3}, { x:3,  y:0,  s:3}, { x:6,  y:0,  s:3}, { x:9,  y:0,  s:3}, {x:12,  y:0,  s:2}, {x:12,  y:2,  s:1}, {x:13,  y:2,  s:1}];
const subRect_07_11_02_0 = [{ x:0,  y:0,  s:2}, { x:2,  y:0,  s:2}, { x:4,  y:0,  s:2}, { x:6,  y:0,  s:2}, { x:8,  y:0,  s:2}, {x:10,  y:0,  s:1}, {x:10,  y:1,  s:1}];
const subRect_07_07_01_0 = [{ x:0,  y:0,  s:1}, { x:1,  y:0,  s:1}, { x:2,  y:0,  s:1}, { x:3,  y:0,  s:1}, { x:4,  y:0,  s:1}, { x:5,  y:0,  s:1}, { x:6,  y:0,  s:1}];

const layout7 =
[
	{ xd:4,  yd:4, full:true,  lovely:true,  flipped:true,  w:subRect_07_04_04_0},
	{ xd:6,  yd:6, full:false, lovely:true,  flipped:false, w:subRect_07_06_06_0},
	{xd:15, yd:14, full:true,  lovely:true,  flipped:true,  w:subRect_07_15_14_0},
	{xd:14, yd:13, full:true,  lovely:true,  flipped:true,  w:subRect_07_14_13_0},
	{xd:13, yd:12, full:true,  lovely:true,  flipped:true,  w:subRect_07_13_12_0},
	{xd:12, yd:11, full:true,  lovely:true,  flipped:true,  w:subRect_07_12_11_0},
	{ xd:8,  yd:6, full:true,  lovely:true,  flipped:true,  w:subRect_07_08_06_0},
	{xd:15, yd:11, full:true,  lovely:true,  flipped:true,  w:subRect_07_15_11_0},
	{ xd:7,  yd:5, full:true,  lovely:true,  flipped:true,  w:subRect_07_07_05_0},
	{xd:10,  yd:7, full:true,  lovely:true,  flipped:true,  w:subRect_07_10_07_0},
	{ xd:5,  yd:3, full:true,  lovely:true,  flipped:true,  w:subRect_07_05_03_0},
	{xd:10,  yd:6, full:true,  lovely:true,  flipped:true,  w:subRect_07_10_06_0},
	{xd:17, yd:10, full:true,  lovely:true,  flipped:true,  w:subRect_07_17_10_0},
	{xd:12,  yd:7, full:true,  lovely:true,  flipped:true,  w:subRect_07_12_07_0},
	{ xd:7,  yd:4, full:true,  lovely:true,  flipped:true,  w:subRect_07_07_04_0},
	{ xd:6,  yd:3, full:true,  lovely:true,  flipped:true,  w:subRect_07_06_03_0},
	{ xd:8,  yd:4, full:false, lovely:true,  flipped:false, w:subRect_07_08_04_0},
	{ xd:7,  yd:3, full:true,  lovely:true,  flipped:true,  w:subRect_07_07_03_0},
	{ xd:5,  yd:2, full:true,  lovely:true,  flipped:true,  w:subRect_07_05_02_0},
	{xd:17,  yd:6, full:true,  lovely:true,  flipped:true,  w:subRect_07_17_06_0},
	{xd:19,  yd:6, full:true,  lovely:true,  flipped:true,  w:subRect_07_19_06_0},
	{xd:16,  yd:5, full:true,  lovely:true,  flipped:true,  w:subRect_07_16_05_0},
	{xd:13,  yd:4, full:true,  lovely:true,  flipped:true,  w:subRect_07_13_04_0},
	{xd:15,  yd:4, full:true,  lovely:true,  flipped:true,  w:subRect_07_15_04_0},
	{ xd:8,  yd:2, full:true,  lovely:true,  flipped:true,  w:subRect_07_08_02_0},
	{xd:13,  yd:3, full:true,  lovely:true,  flipped:true,  w:subRect_07_13_03_0},
	{xd:14,  yd:3, full:true,  lovely:true,  flipped:true,  w:subRect_07_14_03_0},
	{xd:11,  yd:2, full:true,  lovely:true,  flipped:true,  w:subRect_07_11_02_0},
	{ xd:7,  yd:1, full:true,  lovely:true,  flipped:true,  w:subRect_07_07_01_0}
];

/*  8 Participants               N xd yd #             0             1             2             3             4             5             6             7     */
const subRect_08_04_04_0 = [{ x:0,  y:0,  s:3}, { x:3,  y:0,  s:1}, { x:3,  y:1,  s:1}, { x:3,  y:2,  s:1}, { x:0,  y:3,  s:1}, { x:1,  y:3,  s:1}, { x:2,  y:3,  s:1}, { x:3,  y:3,  s:1}];
const subRect_08_05_05_0 = [{ x:0,  y:0,  s:3}, { x:3,  y:0,  s:2}, { x:0,  y:3,  s:2}, { x:3,  y:3,  s:2}, { x:3,  y:2,  s:1}, { x:4,  y:2,  s:1}, { x:2,  y:3,  s:1}, { x:2,  y:4,  s:1}];
const subRect_08_06_06_0 = [{ x:1,  y:0,  s:2}, { x:3,  y:0,  s:2}, { x:0,  y:2,  s:2}, { x:2,  y:2,  s:2}, { x:4,  y:2,  s:2}, { x:0,  y:4,  s:2}, { x:2,  y:4,  s:2}, { x:4,  y:4,  s:2}];
const subRect_08_07_06_0 = [{ x:0,  y:0,  s:3}, { x:0,  y:3,  s:3}, { x:3,  y:0,  s:2}, { x:3,  y:2,  s:2}, { x:3,  y:4,  s:2}, { x:5,  y:0,  s:2}, { x:5,  y:2,  s:2}, { x:5,  y:4,  s:2}];
const subRect_08_25_21_0 = [{ x:0,  y:0, s:12}, { x:0, y:12,  s:9}, { x:9, y:12,  s:9}, {x:18,  y:0,  s:7}, {x:18,  y:7,  s:7}, {x:18, y:14,  s:7}, {x:12,  y:0,  s:6}, {x:12,  y:6,  s:6}];
const subRect_08_06_05_0 = [{ x:0,  y:0,  s:3}, { x:3,  y:0,  s:3}, { x:1,  y:3,  s:2}, { x:3,  y:3,  s:2}, { x:0,  y:3,  s:1}, { x:0,  y:4,  s:1}, { x:5,  y:3,  s:1}, { x:5,  y:4,  s:1}];
const subRect_08_12_10_0 = [{ x:3,  y:0,  s:6}, { x:0,  y:6,  s:4}, { x:4,  y:6,  s:4}, { x:8,  y:6,  s:4}, { x:0,  y:0,  s:3}, { x:0,  y:3,  s:3}, { x:9,  y:0,  s:3}, { x:9,  y:3,  s:3}];
const subRect_08_05_04_0 = [{ x:0,  y:0,  s:2}, { x:2,  y:0,  s:2}, { x:0,  y:2,  s:2}, { x:2,  y:2,  s:2}, { x:4,  y:0,  s:1}, { x:4,  y:1,  s:1}, { x:4,  y:2,  s:1}, { x:4,  y:3,  s:1}];
const subRect_08_14_10_0 = [{ x:0,  y:0,  s:5}, { x:5,  y:0,  s:5}, { x:0,  y:5,  s:5}, { x:5,  y:5,  s:5}, {x:10,  y:0,  s:4}, {x:10,  y:4,  s:4}, {x:10,  y:8,  s:2}, {x:12,  y:8,  s:2}];
const subRect_08_06_04_0 = [{ x:0,  y:0,  s:3}, { x:3,  y:0,  s:3}, { x:0,  y:3,  s:1}, { x:1,  y:3,  s:1}, { x:2,  y:3,  s:1}, { x:3,  y:3,  s:1}, { x:4,  y:3,  s:1}, { x:5,  y:3,  s:1}];
const subRect_08_09_06_0 = [{ x:3,  y:0,  s:4}, { x:0,  y:0,  s:3}, { x:0,  y:3,  s:3}, { x:7,  y:0,  s:2}, { x:7,  y:2,  s:2}, { x:3,  y:4,  s:2}, { x:5,  y:4,  s:2}, { x:7,  y:4,  s:2}];
const subRect_08_23_15_0 = [{ x:0,  y:0,  s:9}, { x:9,  y:0,  s:9}, { x:0,  y:9,  s:6}, { x:6,  y:9,  s:6}, {x:12,  y:9,  s:6}, {x:18,  y:0,  s:5}, {x:18,  y:5,  s:5}, {x:18, y:10,  s:5}];
const subRect_08_20_13_0 = [{ x:0,  y:0,  s:8}, {x:12,  y:0,  s:8}, { x:0,  y:8,  s:5}, { x:5,  y:8,  s:5}, {x:10,  y:8,  s:5}, {x:15,  y:8,  s:5}, { x:8,  y:0,  s:4}, { x:8,  y:4,  s:4}];
const subRect_08_16_10_0 = [{ x:0,  y:0,  s:6}, { x:6,  y:0,  s:5}, {x:11,  y:0,  s:5}, { x:6,  y:5,  s:5}, {x:11,  y:5,  s:5}, { x:0,  y:6,  s:4}, { x:4,  y:6,  s:2}, { x:4,  y:8,  s:2}];
const subRect_08_21_13_0 = [{ x:0,  y:0,  s:7}, { x:7,  y:0,  s:7}, {x:14,  y:0,  s:7}, { x:0,  y:7,  s:6}, { x:6,  y:7,  s:6}, {x:12,  y:7,  s:6}, {x:18,  y:7,  s:3}, {x:18, y:10,  s:3}];
const subRect_08_07_04_0 = [{ x:0,  y:0,  s:3}, { x:3,  y:0,  s:2}, { x:5,  y:0,  s:2}, { x:3,  y:2,  s:2}, { x:5,  y:2,  s:2}, { x:0,  y:3,  s:1}, { x:1,  y:3,  s:1}, { x:2,  y:3,  s:1}];
const subRect_08_11_06_0 = [{ x:0,  y:0,  s:4}, { x:4,  y:0,  s:4}, { x:8,  y:0,  s:3}, { x:8,  y:3,  s:3}, { x:0,  y:4,  s:2}, { x:2,  y:4,  s:2}, { x:4,  y:4,  s:2}, { x:6,  y:4,  s:2}];
const subRect_08_28_15_0 = [{ x:0,  y:0, s:10}, {x:10,  y:0,  s:9}, {x:19,  y:0,  s:9}, {x:10,  y:9,  s:6}, {x:16,  y:9,  s:6}, {x:22,  y:9,  s:6}, { x:0, y:10,  s:5}, { x:5, y:10,  s:5}];
const subRect_08_15_08_0 = [{ x:0,  y:0,  s:5}, { x:5,  y:0,  s:5}, {x:10,  y:0,  s:5}, { x:0,  y:5,  s:3}, { x:3,  y:5,  s:3}, { x:6,  y:5,  s:3}, { x:9,  y:5,  s:3}, {x:12,  y:5,  s:3}];
const subRect_08_04_02_0 = [{ x:0,  y:0,  s:1}, { x:1,  y:0,  s:1}, { x:2,  y:0,  s:1}, { x:3,  y:0,  s:1}, { x:0,  y:1,  s:1}, { x:1,  y:1,  s:1}, { x:2,  y:1,  s:1}, { x:3,  y:1,  s:1}];
const subRect_08_14_06_0 = [{ x:0,  y:0,  s:6}, { x:6,  y:0,  s:3}, { x:9,  y:0,  s:3}, { x:6,  y:3,  s:3}, { x:9,  y:3,  s:3}, {x:12,  y:0,  s:2}, {x:12,  y:2,  s:2}, {x:12,  y:4,  s:2}];
const subRect_08_08_03_0 = [{ x:0,  y:0,  s:3}, { x:3,  y:0,  s:3}, { x:6,  y:0,  s:1}, { x:7,  y:0,  s:1}, { x:6,  y:1,  s:1}, { x:7,  y:1,  s:1}, { x:6,  y:2,  s:1}, { x:7,  y:2,  s:1}];
const subRect_08_16_06_0 = [{ x:0,  y:0,  s:6}, { x:6,  y:0,  s:4}, {x:10,  y:0,  s:3}, {x:13,  y:0,  s:3}, {x:10,  y:3,  s:3}, {x:13,  y:3,  s:3}, { x:6,  y:4,  s:2}, { x:8,  y:4,  s:2}];
const subRect_08_27_10_0 = [{ x:0,  y:0, s:10}, {x:10,  y:0,  s:6}, {x:16,  y:0,  s:6}, {x:22,  y:0,  s:5}, {x:22,  y:5,  s:5}, {x:10,  y:6,  s:4}, {x:14,  y:6,  s:4}, {x:18,  y:6,  s:4}];
const subRect_08_19_07_0 = [{ x:0,  y:0,  s:7}, { x:7,  y:0,  s:4}, {x:11,  y:0,  s:4}, {x:15,  y:0,  s:4}, { x:7,  y:4,  s:3}, {x:10,  y:4,  s:3}, {x:13,  y:4,  s:3}, {x:16,  y:4,  s:3}];
const subRect_08_09_03_0 = [{ x:0,  y:0,  s:3}, { x:3,  y:0,  s:3}, { x:6,  y:0,  s:2}, { x:8,  y:0,  s:1}, { x:8,  y:1,  s:1}, { x:6,  y:2,  s:1}, { x:7,  y:2,  s:1}, { x:8,  y:2,  s:1}];
const subRect_08_10_03_0 = [{ x:0,  y:0,  s:3}, { x:3,  y:0,  s:3}, { x:6,  y:0,  s:2}, { x:8,  y:0,  s:2}, { x:6,  y:2,  s:1}, { x:7,  y:2,  s:1}, { x:8,  y:2,  s:1}, { x:9,  y:2,  s:1}];
const subRect_08_07_02_0 = [{ x:0,  y:0,  s:2}, { x:2,  y:0,  s:2}, { x:4,  y:0,  s:1}, { x:5,  y:0,  s:1}, { x:6,  y:0,  s:1}, { x:4,  y:1,  s:1}, { x:5,  y:1,  s:1}, { x:6,  y:1,  s:1}];
const subRect_08_23_06_0 = [{ x:0,  y:0,  s:6}, { x:6,  y:0,  s:6}, {x:12,  y:0,  s:6}, {x:18,  y:0,  s:3}, {x:18,  y:3,  s:3}, {x:21,  y:0,  s:2}, {x:21,  y:2,  s:2}, {x:21,  y:4,  s:2}];
const subRect_08_21_05_0 = [{ x:0,  y:0,  s:5}, { x:5,  y:0,  s:5}, {x:10,  y:0,  s:5}, {x:15,  y:0,  s:3}, {x:18,  y:0,  s:3}, {x:15,  y:3,  s:2}, {x:17,  y:3,  s:2}, {x:19,  y:3,  s:2}];
const subRect_08_10_02_0 = [{ x:0,  y:0,  s:2}, { x:2,  y:0,  s:2}, { x:4,  y:0,  s:2}, { x:6,  y:0,  s:2}, { x:8,  y:0,  s:1}, { x:9,  y:0,  s:1}, { x:8,  y:1,  s:1}, { x:9,  y:1,  s:1}];
const subRect_08_16_03_0 = [{ x:0,  y:0,  s:3}, { x:3,  y:0,  s:3}, { x:6,  y:0,  s:3}, { x:9,  y:0,  s:3}, {x:12,  y:0,  s:3}, {x:15,  y:0,  s:1}, {x:15,  y:1,  s:1}, {x:15,  y:2,  s:1}];
const subRect_08_17_03_0 = [{ x:0,  y:0,  s:3}, { x:3,  y:0,  s:3}, { x:6,  y:0,  s:3}, { x:9,  y:0,  s:3}, {x:12,  y:0,  s:3}, {x:15,  y:0,  s:2}, {x:15,  y:2,  s:1}, {x:16,  y:2,  s:1}];
const subRect_08_13_02_0 = [{ x:0,  y:0,  s:2}, { x:2,  y:0,  s:2}, { x:4,  y:0,  s:2}, { x:6,  y:0,  s:2}, { x:8,  y:0,  s:2}, {x:10,  y:0,  s:2}, {x:12,  y:0,  s:1}, {x:12,  y:1,  s:1}];
const subRect_08_08_01_0 = [{ x:0,  y:0,  s:1}, { x:1,  y:0,  s:1}, { x:2,  y:0,  s:1}, { x:3,  y:0,  s:1}, { x:4,  y:0,  s:1}, { x:5,  y:0,  s:1}, { x:6,  y:0,  s:1}, { x:7,  y:0,  s:1}];

const layout8 =
[
	{ xd:4,  yd:4, full:true,  lovely:true,  flipped:true,  w:subRect_08_04_04_0},
	{ xd:5,  yd:5, full:true,  lovely:true,  flipped:true,  w:subRect_08_05_05_0},
	{ xd:6,  yd:6, full:false, lovely:true,  flipped:false, w:subRect_08_06_06_0},
	{ xd:7,  yd:6, full:true,  lovely:true,  flipped:true,  w:subRect_08_07_06_0},
	{xd:25, yd:21, full:true,  lovely:true,  flipped:true,  w:subRect_08_25_21_0},
	{ xd:6,  yd:5, full:true,  lovely:true,  flipped:true,  w:subRect_08_06_05_0},
	{xd:12, yd:10, full:true,  lovely:true,  flipped:true,  w:subRect_08_12_10_0},
	{ xd:5,  yd:4, full:true,  lovely:true,  flipped:true,  w:subRect_08_05_04_0},
	{xd:14, yd:10, full:true,  lovely:true,  flipped:true,  w:subRect_08_14_10_0},
	{ xd:6,  yd:4, full:true,  lovely:true,  flipped:true,  w:subRect_08_06_04_0},
	{ xd:9,  yd:6, full:true,  lovely:true,  flipped:true,  w:subRect_08_09_06_0},
	{xd:23, yd:15, full:true,  lovely:true,  flipped:true,  w:subRect_08_23_15_0},
	{xd:20, yd:13, full:true,  lovely:true,  flipped:true,  w:subRect_08_20_13_0},
	{xd:16, yd:10, full:true,  lovely:true,  flipped:true,  w:subRect_08_16_10_0},
	{xd:21, yd:13, full:true,  lovely:true,  flipped:true,  w:subRect_08_21_13_0},
	{ xd:7,  yd:4, full:true,  lovely:true,  flipped:true,  w:subRect_08_07_04_0},
	{xd:11,  yd:6, full:true,  lovely:true,  flipped:true,  w:subRect_08_11_06_0},
	{xd:28, yd:15, full:true,  lovely:true,  flipped:true,  w:subRect_08_28_15_0},
	{xd:15,  yd:8, full:true,  lovely:true,  flipped:true,  w:subRect_08_15_08_0},
	{ xd:4,  yd:2, full:true,  lovely:true,  flipped:true,  w:subRect_08_04_02_0},
	{xd:14,  yd:6, full:true,  lovely:true,  flipped:true,  w:subRect_08_14_06_0},
	{ xd:8,  yd:3, full:true,  lovely:true,  flipped:true,  w:subRect_08_08_03_0},
	{xd:16,  yd:6, full:true,  lovely:true,  flipped:true,  w:subRect_08_16_06_0},
	{xd:27, yd:10, full:true,  lovely:true,  flipped:true,  w:subRect_08_27_10_0},
	{xd:19,  yd:7, full:true,  lovely:true,  flipped:true,  w:subRect_08_19_07_0},
	{ xd:9,  yd:3, full:true,  lovely:true,  flipped:true,  w:subRect_08_09_03_0},
	{xd:10,  yd:3, full:true,  lovely:true,  flipped:true,  w:subRect_08_10_03_0},
	{ xd:7,  yd:2, full:true,  lovely:true,  flipped:true,  w:subRect_08_07_02_0},
	{xd:23,  yd:6, full:true,  lovely:true,  flipped:true,  w:subRect_08_23_06_0},
	{xd:21,  yd:5, full:true,  lovely:true,  flipped:true,  w:subRect_08_21_05_0},
	{xd:10,  yd:2, full:true,  lovely:true,  flipped:true,  w:subRect_08_10_02_0},
	{xd:16,  yd:3, full:true,  lovely:true,  flipped:true,  w:subRect_08_16_03_0},
	{xd:17,  yd:3, full:true,  lovely:true,  flipped:true,  w:subRect_08_17_03_0},
	{xd:13,  yd:2, full:true,  lovely:true,  flipped:true,  w:subRect_08_13_02_0},
	{ xd:8,  yd:1, full:true,  lovely:true,  flipped:true,  w:subRect_08_08_01_0}
];

/*  9 Participants               N xd yd #             0             1             2             3             4             5             6             7             8     */
const subRect_09_03_03_0 = [{x:0, y:0, s:1}, {x:1, y:0, s:1}, {x:2, y:0, s:1}, {x:0, y:1, s:1}, {x:1, y:1, s:1}, {x:2, y:1, s:1}, {x:0, y:2, s:1}, {x:1, y:2, s:1}, {x:2, y:2, s:1}];
const subRect_09_06_06_0 = [{x:0, y:0, s:3}, {x:3, y:0, s:3}, {x:0, y:3, s:3}, {x:3, y:3, s:2}, {x:5, y:3, s:1}, {x:5, y:4, s:1}, {x:3, y:5, s:1}, {x:4, y:5, s:1}, {x:5, y:5, s:1}];
const subRect_09_13_12_0 = [{x:0, y:0, s:6}, {x:0, y:6, s:6}, {x:6, y:0, s:4}, {x:6, y:4, s:4}, {x:6, y:8, s:4}, {x:10, y:0, s:3}, {x:10, y:3, s:3}, {x:10, y:6, s:3}, {x:10, y:9, s:3}];
const subRect_09_10_09_0 = [{x:0, y:0, s:5}, {x:5, y:0, s:5}, {x:0, y:5, s:4}, {x:4, y:5, s:2}, {x:6, y:5, s:2}, {x:8, y:5, s:2}, {x:4, y:7, s:2}, {x:6, y:7, s:2}, {x:8, y:7, s:2}];
const subRect_09_05_04_0 = [{x:0, y:0, s:3}, {x:3, y:0, s:2}, {x:3, y:2, s:1}, {x:4, y:2, s:1}, {x:0, y:3, s:1}, {x:1, y:3, s:1}, {x:2, y:3, s:1}, {x:3, y:3, s:1}, {x:4, y:3, s:1}];
const subRect_09_10_08_0 = [{x:0, y:0, s:4}, {x:0, y:4, s:4}, {x:4, y:0, s:3}, {x:7, y:0, s:3}, {x:4, y:3, s:3}, {x:7, y:3, s:3}, {x:4, y:6, s:2}, {x:6, y:6, s:2}, {x:8, y:6, s:2}];
const subRect_09_04_03_0 = [{x:1, y:0, s:2}, {x:0, y:0, s:1}, {x:0, y:1, s:1}, {x:3, y:0, s:1}, {x:3, y:1, s:1}, {x:0, y:2, s:1}, {x:1, y:2, s:1}, {x:2, y:2, s:1}, {x:3, y:2, s:1}];
const subRect_09_06_04_0 = [{x:0, y:0, s:2}, {x:2, y:0, s:2}, {x:4, y:0, s:2}, {x:0, y:2, s:2}, {x:2, y:2, s:2}, {x:4, y:2, s:1}, {x:5, y:2, s:1}, {x:4, y:3, s:1}, {x:5, y:3, s:1}];
const subRect_09_06_04_1 = [{x:0, y:0, s:4}, {x:4, y:0, s:1}, {x:5, y:0, s:1}, {x:4, y:1, s:1}, {x:5, y:1, s:1}, {x:4, y:2, s:1}, {x:5, y:2, s:1}, {x:4, y:3, s:1}, {x:5, y:3, s:1}];
const subRect_09_08_05_0 = [{x:0, y:0, s:3}, {x:3, y:0, s:3}, {x:6, y:1, s:2}, {x:0, y:3, s:2}, {x:2, y:3, s:2}, {x:4, y:3, s:2}, {x:6, y:3, s:2}, {x:6, y:0, s:1}, {x:7, y:0, s:1}];
const subRect_09_05_03_0 = [{x:0, y:0, s:2}, {x:2, y:0, s:2}, {x:4, y:0, s:1}, {x:4, y:1, s:1}, {x:0, y:2, s:1}, {x:1, y:2, s:1}, {x:2, y:2, s:1}, {x:3, y:2, s:1}, {x:4, y:2, s:1}];
const subRect_09_09_05_0 = [{x:0, y:0, s:3}, {x:3, y:0, s:3}, {x:6, y:0, s:3}, {x:0, y:3, s:2}, {x:2, y:3, s:2}, {x:4, y:3, s:2}, {x:6, y:3, s:2}, {x:8, y:3, s:1}, {x:8, y:4, s:1}];
const subRect_09_11_06_0 = [{x:0, y:0, s:3}, {x:3, y:0, s:3}, {x:6, y:0, s:3}, {x:0, y:3, s:3}, {x:3, y:3, s:3}, {x:6, y:3, s:3}, {x:9, y:0, s:2}, {x:9, y:2, s:2}, {x:9, y:4, s:2}];
const subRect_09_26_14_0 = [{x:14, y:0, s:8}, {x:0, y:0, s:7}, {x:7, y:0, s:7}, {x:0, y:7, s:7}, {x:7, y:7, s:7}, {x:14, y:8, s:6}, {x:20, y:8, s:6}, {x:22, y:0, s:4}, {x:22, y:4, s:4}];
const subRect_09_28_15_0 = [{x:0, y:0, s:8}, {x:8, y:0, s:8}, {x:16, y:0, s:8}, {x:0, y:8, s:7}, {x:7, y:8, s:7}, {x:14, y:8, s:7}, {x:21, y:8, s:7}, {x:24, y:0, s:4}, {x:24, y:4, s:4}];
const subRect_09_06_03_0 = [{x:0, y:0, s:2}, {x:2, y:0, s:2}, {x:4, y:0, s:2}, {x:0, y:2, s:1}, {x:1, y:2, s:1}, {x:2, y:2, s:1}, {x:3, y:2, s:1}, {x:4, y:2, s:1}, {x:5, y:2, s:1}];
const subRect_09_13_06_0 = [{x:0, y:0, s:4}, {x:4, y:0, s:3}, {x:7, y:0, s:3}, {x:10, y:0, s:3}, {x:4, y:3, s:3}, {x:7, y:3, s:3}, {x:10, y:3, s:3}, {x:0, y:4, s:2}, {x:2, y:4, s:2}];
const subRect_09_22_10_0 = [{x:0, y:0, s:6}, {x:6, y:0, s:6}, {x:12, y:0, s:5}, {x:17, y:0, s:5}, {x:12, y:5, s:5}, {x:17, y:5, s:5}, {x:0, y:6, s:4}, {x:4, y:6, s:4}, {x:8, y:6, s:4}];
const subRect_09_31_14_0 = [{x:0, y:0, s:8}, {x:8, y:0, s:8}, {x:16, y:0, s:8}, {x:24, y:0, s:7}, {x:24, y:7, s:7}, {x:0, y:8, s:6}, {x:6, y:8, s:6}, {x:12, y:8, s:6}, {x:18, y:8, s:6}];
const subRect_09_20_09_0 = [{x:0, y:0, s:5}, {x:5, y:0, s:5}, {x:10, y:0, s:5}, {x:15, y:0, s:5}, {x:0, y:5, s:4}, {x:4, y:5, s:4}, {x:8, y:5, s:4}, {x:12, y:5, s:4}, {x:16, y:5, s:4}];
const subRect_09_06_02_0 = [{x:0, y:0, s:2}, {x:2, y:0, s:1}, {x:3, y:0, s:1}, {x:4, y:0, s:1}, {x:5, y:0, s:1}, {x:2, y:1, s:1}, {x:3, y:1, s:1}, {x:4, y:1, s:1}, {x:5, y:1, s:1}];
const subRect_09_11_03_0 = [{x:0, y:0, s:3}, {x:3, y:0, s:3}, {x:6, y:0, s:3}, {x:9, y:0, s:1}, {x:10, y:0, s:1}, {x:9, y:1, s:1}, {x:10, y:1, s:1}, {x:9, y:2, s:1}, {x:10, y:2, s:1}];
const subRect_09_09_02_0 = [{x:0, y:0, s:2}, {x:2, y:0, s:2}, {x:4, y:0, s:2}, {x:6, y:0, s:1}, {x:7, y:0, s:1}, {x:8, y:0, s:1}, {x:6, y:1, s:1}, {x:7, y:1, s:1}, {x:8, y:1, s:1}];
const subRect_09_21_04_0 = [{x:0, y:0, s:4}, {x:4, y:0, s:4}, {x:8, y:0, s:4}, {x:12, y:0, s:4}, {x:16, y:0, s:4}, {x:20, y:0, s:1}, {x:20, y:1, s:1}, {x:20, y:2, s:1}, {x:20, y:3, s:1}];
const subRect_09_12_02_0 = [{x:0, y:0, s:2}, {x:2, y:0, s:2}, {x:4, y:0, s:2}, {x:6, y:0, s:2}, {x:8, y:0, s:2}, {x:10, y:0, s:1}, {x:11, y:0, s:1}, {x:10, y:1, s:1}, {x:11, y:1, s:1}];
const subRect_09_19_03_0 = [{x:0, y:0, s:3}, {x:3, y:0, s:3}, {x:6, y:0, s:3}, {x:9, y:0, s:3}, {x:12, y:0, s:3}, {x:15, y:0, s:3}, {x:18, y:0, s:1}, {x:18, y:1, s:1}, {x:18, y:2, s:1}];
const subRect_09_15_02_0 = [{x:0, y:0, s:2}, {x:2, y:0, s:2}, {x:4, y:0, s:2}, {x:6, y:0, s:2}, {x:8, y:0, s:2}, {x:10, y:0, s:2}, {x:12, y:0, s:2}, {x:14, y:0, s:1}, {x:14, y:1, s:1}];
const subRect_09_09_01_0 = [{x:0, y:0, s:1}, {x:1, y:0, s:1}, {x:2, y:0, s:1}, {x:3, y:0, s:1}, {x:4, y:0, s:1}, {x:5, y:0, s:1}, {x:6, y:0, s:1}, {x:7, y:0, s:1}, {x:8, y:0, s:1}];

const layout9 =
[
	{xd:3, yd:3, full:true,  lovely:true,  flipped:true,  w:subRect_09_03_03_0},
	{xd:6, yd:6, full:true,  lovely:true,  flipped:true,  w:subRect_09_06_06_0},
	{xd:13, yd:12, full:true,  lovely:true,  flipped:true,  w:subRect_09_13_12_0},
	{xd:10, yd:9, full:true,  lovely:true,  flipped:true,  w:subRect_09_10_09_0},
	{xd:5, yd:4, full:true,  lovely:true,  flipped:true,  w:subRect_09_05_04_0},
	{xd:10, yd:8, full:true,  lovely:true,  flipped:true,  w:subRect_09_10_08_0},
	{xd:4, yd:3, full:true,  lovely:true,  flipped:false, w:subRect_09_04_03_0},
	{xd:6, yd:4, full:true,  lovely:true,  flipped:true,  w:subRect_09_06_04_0},
	{xd:6, yd:4, full:true,  lovely:true,  flipped:true,  w:subRect_09_06_04_1},
	{xd:8, yd:5, full:true,  lovely:true,  flipped:true,  w:subRect_09_08_05_0},
	{xd:5, yd:3, full:true,  lovely:true,  flipped:true,  w:subRect_09_05_03_0},
	{xd:9, yd:5, full:true,  lovely:true,  flipped:true,  w:subRect_09_09_05_0},
	{xd:11, yd:6, full:true,  lovely:true,  flipped:true,  w:subRect_09_11_06_0},
	{xd:26, yd:14, full:true,  lovely:true,  flipped:true,  w:subRect_09_26_14_0},
	{xd:28, yd:15, full:true,  lovely:true,  flipped:true,  w:subRect_09_28_15_0},
	{xd:6, yd:3, full:true,  lovely:true,  flipped:true,  w:subRect_09_06_03_0},
	{xd:13, yd:6, full:true,  lovely:true,  flipped:true,  w:subRect_09_13_06_0},
	{xd:22, yd:10, full:true,  lovely:true,  flipped:true,  w:subRect_09_22_10_0},
	{xd:31, yd:14, full:true,  lovely:true,  flipped:true,  w:subRect_09_31_14_0},
	{xd:20, yd:9, full:true,  lovely:true,  flipped:true,  w:subRect_09_20_09_0},
	{xd:6, yd:2, full:true,  lovely:true,  flipped:true,  w:subRect_09_06_02_0},
	{xd:11, yd:3, full:true,  lovely:true,  flipped:true,  w:subRect_09_11_03_0},
	{xd:9, yd:2, full:true,  lovely:true,  flipped:true,  w:subRect_09_09_02_0},
	{xd:21, yd:4, full:true,  lovely:true,  flipped:true,  w:subRect_09_21_04_0},
	{xd:12, yd:2, full:true,  lovely:true,  flipped:true,  w:subRect_09_12_02_0},
	{xd:19, yd:3, full:true,  lovely:true,  flipped:true,  w:subRect_09_19_03_0},
	{xd:15, yd:2, full:true,  lovely:true,  flipped:true,  w:subRect_09_15_02_0},
	{xd:9, yd:1, full:true,  lovely:true,  flipped:true,  w:subRect_09_09_01_0}
];

/* 10 Participants               N xd yd #              0             1             2             3             4             5             6             7             8             9     */
const subRect_10_04_04_0 = [{x:0, y:0, s:2}, {x:2, y:0, s:2}, {x:0, y:2, s:1}, {x:1, y:2, s:1}, {x:2, y:2, s:1}, {x:3, y:2, s:1}, {x:0, y:3, s:1}, {x:1, y:3, s:1}, {x:2, y:3, s:1}, {x:3, y:3, s:1}];
const subRect_10_05_05_0 = [{x:0, y:0, s:4}, {x:4, y:0, s:1}, {x:4, y:1, s:1}, {x:4, y:2, s:1}, {x:4, y:3, s:1}, {x:0, y:4, s:1}, {x:1, y:4, s:1}, {x:2, y:4, s:1}, {x:3, y:4, s:1}, {x:4, y:4, s:1}];
const subRect_10_16_15_0 = [{x:5, y:0, s:6}, {x:5, y:9, s:6}, {x:0, y:0, s:5}, {x:0, y:5, s:5}, {x:0, y:10, s:5}, {x:11, y:0, s:5}, {x:11, y:5, s:5}, {x:11, y:10, s:5}, {x:5, y:6, s:3}, {x:8, y:6, s:3}];
const subRect_10_15_14_0 = [{x:3, y:0, s:9}, {x:0, y:9, s:5}, {x:5, y:9, s:5}, {x:10, y:9, s:5}, {x:0, y:0, s:3}, {x:0, y:3, s:3}, {x:0, y:6, s:3}, {x:12, y:0, s:3}, {x:12, y:3, s:3}, {x:12, y:6, s:3}];
const subRect_10_14_13_0 = [{x:0, y:0, s:5}, {x:5, y:0, s:5}, {x:4, y:8, s:5}, {x:9, y:8, s:5}, {x:10, y:0, s:4}, {x:10, y:4, s:4}, {x:0, y:5, s:4}, {x:0, y:9, s:4}, {x:4, y:5, s:3}, {x:7, y:5, s:3}];
const subRect_10_26_24_0 = [{x:0, y:0, s:9}, {x:9, y:0, s:9}, {x:0, y:9, s:9}, {x:9, y:9, s:9}, {x:18, y:0, s:8}, {x:18, y:8, s:8}, {x:18, y:16, s:8}, {x:0, y:18, s:6}, {x:6, y:18, s:6}, {x:12, y:18, s:6}];
const subRect_10_12_11_0 = [{x:0, y:0, s:4}, {x:4, y:0, s:4}, {x:8, y:0, s:4}, {x:0, y:4, s:4}, {x:4, y:4, s:4}, {x:8, y:4, s:4}, {x:0, y:8, s:3}, {x:3, y:8, s:3}, {x:6, y:8, s:3}, {x:9, y:8, s:3}];
const subRect_10_07_06_0 = [{x:0, y:0, s:3}, {x:3, y:0, s:3}, {x:0, y:3, s:3}, {x:3, y:3, s:3}, {x:6, y:0, s:1}, {x:6, y:1, s:1}, {x:6, y:2, s:1}, {x:6, y:3, s:1}, {x:6, y:4, s:1}, {x:6, y:5, s:1}];
const subRect_10_15_12_0 = [{x:0, y:0, s:8}, {x:8, y:0, s:4}, {x:8, y:4, s:4}, {x:0, y:8, s:4}, {x:4, y:8, s:4}, {x:8, y:8, s:4}, {x:12, y:0, s:3}, {x:12, y:3, s:3}, {x:12, y:6, s:3}, {x:12, y:9, s:3}];
const subRect_10_08_06_0 = [{x:1, y:0, s:2}, {x:3, y:0, s:2}, {x:5, y:0, s:2}, {x:0, y:2, s:2}, {x:2, y:2, s:2}, {x:4, y:2, s:2}, {x:6, y:2, s:2}, {x:1, y:4, s:2}, {x:3, y:4, s:2}, {x:5, y:4, s:2}];
const subRect_10_16_12_0 = [{x:0, y:0, s:6}, {x:6, y:0, s:6}, {x:0, y:6, s:6}, {x:12, y:0, s:4}, {x:12, y:4, s:4}, {x:12, y:8, s:4}, {x:6, y:6, s:3}, {x:9, y:6, s:3}, {x:6, y:9, s:3}, {x:9, y:9, s:3}];
const subRect_10_19_14_0 = [{x:0, y:0, s:7}, {x:0, y:7, s:7}, {x:7, y:0, s:6}, {x:13, y:0, s:6}, {x:7, y:6, s:4}, {x:11, y:6, s:4}, {x:15, y:6, s:4}, {x:7, y:10, s:4}, {x:11, y:10, s:4}, {x:15, y:10, s:4}];
const subRect_10_07_05_0 = [{x:0, y:0, s:3}, {x:3, y:0, s:3}, {x:0, y:3, s:2}, {x:2, y:3, s:2}, {x:4, y:3, s:2}, {x:6, y:0, s:1}, {x:6, y:1, s:1}, {x:6, y:2, s:1}, {x:6, y:3, s:1}, {x:6, y:4, s:1}];
const subRect_10_17_12_0 = [{x:0, y:0, s:9}, {x:9, y:0, s:4}, {x:13, y:0, s:4}, {x:9, y:4, s:4}, {x:13, y:4, s:4}, {x:9, y:8, s:4}, {x:13, y:8, s:4}, {x:0, y:9, s:3}, {x:3, y:9, s:3}, {x:6, y:9, s:3}];
const subRect_10_20_14_0 = [{x:5, y:0,s:10}, {x:0, y:0, s:5}, {x:0, y:5, s:5}, {x:15, y:0, s:5}, {x:15, y:5, s:5}, {x:0, y:10, s:4}, {x:4, y:10, s:4}, {x:8, y:10, s:4}, {x:12, y:10, s:4}, {x:16, y:10, s:4}];
const subRect_10_06_04_0 = [{x:2, y:0, s:3}, {x:0, y:0, s:2}, {x:0, y:2, s:2}, {x:5, y:0, s:1}, {x:5, y:1, s:1}, {x:5, y:2, s:1}, {x:2, y:3, s:1}, {x:3, y:3, s:1}, {x:4, y:3, s:1}, {x:5, y:3, s:1}];
const subRect_10_10_06_0 = [{x:0, y:0, s:3}, {x:3, y:0, s:3}, {x:0, y:3, s:3}, {x:3, y:3, s:3}, {x:6, y:0, s:2}, {x:8, y:0, s:2}, {x:6, y:2, s:2}, {x:8, y:2, s:2}, {x:6, y:4, s:2}, {x:8, y:4, s:2}];
const subRect_10_17_10_0 = [{x:5, y:0, s:6}, {x:0, y:0, s:5}, {x:0, y:5, s:5}, {x:5, y:6, s:4}, {x:9, y:6, s:4}, {x:13, y:6, s:4}, {x:11, y:0, s:3}, {x:14, y:0, s:3}, {x:11, y:3, s:3}, {x:14, y:3, s:3}];
const subRect_10_17_10_1 = [{x:0, y:0, s:6}, {x:11, y:0, s:6}, {x:6, y:0, s:5}, {x:6, y:5, s:5}, {x:0, y:6, s:4}, {x:13, y:6, s:4}, {x:4, y:6, s:2}, {x:4, y:8, s:2}, {x:11, y:6, s:2}, {x:11, y:8, s:2}];
const subRect_10_12_07_0 = [{x:0, y:0, s:4}, {x:4, y:0, s:4}, {x:0, y:4, s:3}, {x:3, y:4, s:3}, {x:6, y:4, s:3}, {x:9, y:4, s:3}, {x:8, y:0, s:2}, {x:10, y:0, s:2}, {x:8, y:2, s:2}, {x:10, y:2, s:2}];
const subRect_10_07_04_0 = [{x:0, y:0, s:2}, {x:2, y:0, s:2}, {x:4, y:0, s:2}, {x:0, y:2, s:2}, {x:2, y:2, s:2}, {x:4, y:2, s:2}, {x:6, y:0, s:1}, {x:6, y:1, s:1}, {x:6, y:2, s:1}, {x:6, y:3, s:1}];
const subRect_10_06_03_0 = [{x:0, y:0, s:3}, {x:3, y:0, s:1}, {x:4, y:0, s:1}, {x:5, y:0, s:1}, {x:3, y:1, s:1}, {x:4, y:1, s:1}, {x:5, y:1, s:1}, {x:3, y:2, s:1}, {x:4, y:2, s:1}, {x:5, y:2, s:1}];
const subRect_10_08_04_0 = [{x:0, y:0, s:3}, {x:3, y:0, s:3}, {x:6, y:0, s:2}, {x:6, y:2, s:2}, {x:0, y:3, s:1}, {x:1, y:3, s:1}, {x:2, y:3, s:1}, {x:3, y:3, s:1}, {x:4, y:3, s:1}, {x:5, y:3, s:1}];
const subRect_10_12_06_0 = [{x:0, y:0, s:4}, {x:6, y:0, s:3}, {x:9, y:0, s:3}, {x:6, y:3, s:3}, {x:9, y:3, s:3}, {x:4, y:0, s:2}, {x:4, y:2, s:2}, {x:0, y:4, s:2}, {x:2, y:4, s:2}, {x:4, y:4, s:2}];
const subRect_10_09_04_0 = [{x:0, y:0, s:3}, {x:3, y:0, s:2}, {x:5, y:0, s:2}, {x:7, y:0, s:2}, {x:3, y:2, s:2}, {x:5, y:2, s:2}, {x:7, y:2, s:2}, {x:0, y:3, s:1}, {x:1, y:3, s:1}, {x:2, y:3, s:1}];
const subRect_10_07_03_0 = [{x:0, y:0, s:3}, {x:3, y:0, s:2}, {x:5, y:0, s:1}, {x:6, y:0, s:1}, {x:5, y:1, s:1}, {x:6, y:1, s:1}, {x:3, y:2, s:1}, {x:4, y:2, s:1}, {x:5, y:2, s:1}, {x:6, y:2, s:1}];
const subRect_10_14_06_0 = [{x:0, y:0, s:4}, {x:4, y:0, s:4}, {x:8, y:0, s:3}, {x:11, y:0, s:3}, {x:8, y:3, s:3}, {x:11, y:3, s:3}, {x:0, y:4, s:2}, {x:2, y:4, s:2}, {x:4, y:4, s:2}, {x:6, y:4, s:2}];
const subRect_10_19_08_0 = [{x:0, y:0, s:5}, {x:5, y:0, s:5}, {x:10, y:0, s:5}, {x:15, y:0, s:4}, {x:15, y:4, s:4}, {x:0, y:5, s:3}, {x:3, y:5, s:3}, {x:6, y:5, s:3}, {x:9, y:5, s:3}, {x:12, y:5, s:3}];
const subRect_10_12_05_0 = [{x:0, y:0, s:3}, {x:3, y:0, s:3}, {x:6, y:0, s:3}, {x:9, y:0, s:3}, {x:0, y:3, s:2}, {x:2, y:3, s:2}, {x:4, y:3, s:2}, {x:6, y:3, s:2}, {x:8, y:3, s:2}, {x:10, y:3, s:2}];
const subRect_10_05_02_0 = [{x:0, y:0, s:1}, {x:1, y:0, s:1}, {x:2, y:0, s:1}, {x:3, y:0, s:1}, {x:4, y:0, s:1}, {x:0, y:1, s:1}, {x:1, y:1, s:1}, {x:2, y:1, s:1}, {x:3, y:1, s:1}, {x:4, y:1, s:1}];
const subRect_10_08_03_0 = [{x:0, y:0, s:3}, {x:3, y:0, s:2}, {x:5, y:0, s:2}, {x:7, y:0, s:1}, {x:7, y:1, s:1}, {x:3, y:2, s:1}, {x:4, y:2, s:1}, {x:5, y:2, s:1}, {x:6, y:2, s:1}, {x:7, y:2, s:1}];
const subRect_10_09_03_0 = [{x:0, y:0, s:3}, {x:3, y:0, s:2}, {x:5, y:0, s:2}, {x:7, y:0, s:2}, {x:3, y:2, s:1}, {x:4, y:2, s:1}, {x:5, y:2, s:1}, {x:6, y:2, s:1}, {x:7, y:2, s:1}, {x:8, y:2, s:1}];
const subRect_10_08_02_0 = [{x:0, y:0, s:2}, {x:2, y:0, s:2}, {x:4, y:0, s:1}, {x:5, y:0, s:1}, {x:6, y:0, s:1}, {x:7, y:0, s:1}, {x:4, y:1, s:1}, {x:5, y:1, s:1}, {x:6, y:1, s:1}, {x:7, y:1, s:1}];
const subRect_10_11_02_0 = [{x:0, y:0, s:2}, {x:2, y:0, s:2}, {x:4, y:0, s:2}, {x:6, y:0, s:2}, {x:8, y:0, s:1}, {x:9, y:0, s:1}, {x:10, y:0, s:1}, {x:8, y:1, s:1}, {x:9, y:1, s:1}, {x:10, y:1, s:1}];
const subRect_10_14_02_0 = [{x:0, y:0, s:2}, {x:2, y:0, s:2}, {x:4, y:0, s:2}, {x:6, y:0, s:2}, {x:8, y:0, s:2}, {x:10, y:0, s:2}, {x:12, y:0, s:1}, {x:13, y:0, s:1}, {x:12, y:1, s:1}, {x:13, y:1, s:1}];
const subRect_10_17_02_0 = [{x:0, y:0, s:2}, {x:2, y:0, s:2}, {x:4, y:0, s:2}, {x:6, y:0, s:2}, {x:8, y:0, s:2}, {x:10, y:0, s:2}, {x:12, y:0, s:2}, {x:14, y:0, s:2}, {x:16, y:0, s:1}, {x:16, y:1, s:1}];
const subRect_10_10_01_0 = [{x:0, y:0, s:1}, {x:1, y:0, s:1}, {x:2, y:0, s:1}, {x:3, y:0, s:1}, {x:4, y:0, s:1}, {x:5, y:0, s:1}, {x:6, y:0, s:1}, {x:7, y:0, s:1}, {x:8, y:0, s:1}, {x:9, y:0, s:1}];

const layout10 =
[
	{xd:4, yd:4, full:true,  lovely:true,  flipped:true,  w:subRect_10_04_04_0},
	{xd:5, yd:5, full:true,  lovely:true,  flipped:true,  w:subRect_10_05_05_0},
	{xd:16, yd:15, full:true,  lovely:true,  flipped:true,  w:subRect_10_16_15_0},
	{xd:15, yd:14, full:true,  lovely:true,  flipped:true,  w:subRect_10_15_14_0},
	{xd:14, yd:13, full:true,  lovely:true,  flipped:true,  w:subRect_10_14_13_0},
	{xd:26, yd:24, full:true,  lovely:true,  flipped:true,  w:subRect_10_26_24_0},
	{xd:12, yd:11, full:true,  lovely:true,  flipped:true,  w:subRect_10_12_11_0},
	{xd:7, yd:6, full:true,  lovely:true,  flipped:true,  w:subRect_10_07_06_0},
	{xd:15, yd:12, full:true,  lovely:true,  flipped:true,  w:subRect_10_15_12_0},
	{xd:8, yd:6, full:false, lovely:true,  flipped:false, w:subRect_10_08_06_0},
	{xd:16, yd:12, full:true,  lovely:true,  flipped:true,  w:subRect_10_16_12_0},
	{xd:19, yd:14, full:true,  lovely:true,  flipped:true,  w:subRect_10_19_14_0},
	{xd:7, yd:5, full:true,  lovely:true,  flipped:true,  w:subRect_10_07_05_0},
	{xd:17, yd:12, full:true,  lovely:true,  flipped:true,  w:subRect_10_17_12_0},
	{xd:20, yd:14, full:true,  lovely:true,  flipped:true,  w:subRect_10_20_14_0},
	{xd:6, yd:4, full:true,  lovely:true,  flipped:true,  w:subRect_10_06_04_0},
	{xd:10, yd:6, full:true,  lovely:true,  flipped:true,  w:subRect_10_10_06_0},
	{xd:17, yd:10, full:true,  lovely:true,  flipped:true,  w:subRect_10_17_10_0},
	{xd:17, yd:10, full:true,  lovely:true,  flipped:true,  w:subRect_10_17_10_1},
	{xd:12, yd:7, full:true,  lovely:true,  flipped:true,  w:subRect_10_12_07_0},
	{xd:7, yd:4, full:true,  lovely:true,  flipped:true,  w:subRect_10_07_04_0},
	{xd:6, yd:3, full:true,  lovely:true,  flipped:true,  w:subRect_10_06_03_0},
	{xd:8, yd:4, full:true,  lovely:true,  flipped:true,  w:subRect_10_08_04_0},
	{xd:12, yd:6, full:true,  lovely:true,  flipped:true,  w:subRect_10_12_06_0},
	{xd:9, yd:4, full:true,  lovely:true,  flipped:true,  w:subRect_10_09_04_0},
	{xd:7, yd:3, full:true,  lovely:true,  flipped:true,  w:subRect_10_07_03_0},
	{xd:14, yd:6, full:true,  lovely:true,  flipped:true,  w:subRect_10_14_06_0},
	{xd:19, yd:8, full:true,  lovely:true,  flipped:true,  w:subRect_10_19_08_0},
	{xd:12, yd:5, full:true,  lovely:true,  flipped:true,  w:subRect_10_12_05_0},
	{xd:5, yd:2, full:true,  lovely:true,  flipped:true,  w:subRect_10_05_02_0},
	{xd:8, yd:3, full:true,  lovely:true,  flipped:true,  w:subRect_10_08_03_0},
	{xd:9, yd:3, full:true,  lovely:true,  flipped:true,  w:subRect_10_09_03_0},
	{xd:8, yd:2, full:true,  lovely:true,  flipped:true,  w:subRect_10_08_02_0},
	{xd:11, yd:2, full:true,  lovely:true,  flipped:true,  w:subRect_10_11_02_0},
	{xd:14, yd:2, full:true,  lovely:true,  flipped:true,  w:subRect_10_14_02_0},
	{xd:17, yd:2, full:true,  lovely:true,  flipped:true,  w:subRect_10_17_02_0},
	{xd:10, yd:1, full:true,  lovely:true,  flipped:true,  w:subRect_10_10_01_0}
];

/* 11 Participants               N xd yd #              0             1             2             3             4             5             6             7             8             9            10     */
const subRect_11_05_05_0 = [{x:0, y:0, s:3}, {x:3, y:0, s:2}, {x:0, y:3, s:2}, {x:3, y:2, s:1}, {x:4, y:2, s:1}, {x:2, y:3, s:1}, {x:3, y:3, s:1}, {x:4, y:3, s:1}, {x:2, y:4, s:1}, {x:3, y:4, s:1}, {x:4, y:4, s:1}];
const subRect_11_06_06_0 = [{x:0, y:0, s:3}, {x:3, y:0, s:3}, {x:0, y:3, s:2}, {x:2, y:3, s:2}, {x:4, y:3, s:2}, {x:0, y:5, s:1}, {x:1, y:5, s:1}, {x:2, y:5, s:1}, {x:3, y:5, s:1}, {x:4, y:5, s:1}, {x:5, y:5, s:1}];
const subRect_11_08_08_0 = [{x:0, y:0, s:3}, {x:3, y:0, s:3}, {x:0, y:3, s:3}, {x:3, y:3, s:3}, {x:6, y:0, s:2}, {x:6, y:2, s:2}, {x:6, y:4, s:2}, {x:0, y:6, s:2}, {x:2, y:6, s:2}, {x:4, y:6, s:2}, {x:6, y:6, s:2}];
const subRect_11_08_08_1 = [{x:2, y:2, s:4}, {x:1, y:0, s:2}, {x:3, y:0, s:2}, {x:5, y:0, s:2}, {x:0, y:2, s:2}, {x:0, y:4, s:2}, {x:6, y:2, s:2}, {x:6, y:4, s:2}, {x:1, y:6, s:2}, {x:3, y:6, s:2}, {x:5, y:6, s:2}];
const subRect_11_09_09_0 = [{x:0, y:0, s:4}, {x:6, y:0, s:3}, {x:6, y:3, s:3}, {x:0, y:6, s:3}, {x:3, y:6, s:3}, {x:6, y:6, s:3}, {x:4, y:0, s:2}, {x:4, y:2, s:2}, {x:0, y:4, s:2}, {x:2, y:4, s:2}, {x:4, y:4, s:2}];
const subRect_11_10_10_0 = [{x:0, y:0, s:4}, {x:6, y:0, s:4}, {x:0, y:6, s:4}, {x:4, y:4, s:3}, {x:7, y:4, s:3}, {x:4, y:7, s:3}, {x:7, y:7, s:3}, {x:4, y:0, s:2}, {x:4, y:2, s:2}, {x:0, y:4, s:2}, {x:2, y:4, s:2}];
const subRect_11_17_15_0 = [{x:0, y:0, s:6}, {x:6, y:0, s:6}, {x:0, y:6, s:6}, {x:6, y:6, s:6}, {x:12, y:0, s:5}, {x:12, y:5, s:5}, {x:12, y:10, s:5}, {x:0, y:12, s:3}, {x:3, y:12, s:3}, {x:6, y:12, s:3}, {x:9, y:12, s:3}];
const subRect_11_15_13_0 = [{x:0, y:0, s:5}, {x:5, y:0, s:5}, {x:10, y:0, s:5}, {x:0, y:5, s:5}, {x:5, y:5, s:5}, {x:10, y:5, s:5}, {x:0, y:10, s:3}, {x:3, y:10, s:3}, {x:6, y:10, s:3}, {x:9, y:10, s:3}, {x:12, y:10, s:3}];
const subRect_11_14_12_0 = [{x:0, y:3, s:6}, {x:6, y:0, s:4}, {x:10, y:0, s:4}, {x:6, y:4, s:4}, {x:10, y:4, s:4}, {x:6, y:8, s:4}, {x:10, y:8, s:4}, {x:0, y:0, s:3}, {x:3, y:0, s:3}, {x:0, y:9, s:3}, {x:3, y:9, s:3}];
const subRect_11_25_21_0 = [{x:0, y:6, s:9}, {x:9, y:6, s:9}, {x:18, y:0, s:7}, {x:18, y:7, s:7}, {x:18, y:14, s:7}, {x:0, y:0, s:6}, {x:6, y:0, s:6}, {x:12, y:0, s:6}, {x:0, y:15, s:6}, {x:6, y:15, s:6}, {x:12, y:15, s:6}];
const subRect_11_06_05_0 = [{x:0, y:0, s:3}, {x:3, y:0, s:3}, {x:2, y:3, s:2}, {x:0, y:3, s:1}, {x:1, y:3, s:1}, {x:0, y:4, s:1}, {x:1, y:4, s:1}, {x:4, y:3, s:1}, {x:5, y:3, s:1}, {x:4, y:4, s:1}, {x:5, y:4, s:1}];
const subRect_11_12_10_0 = [{x:0, y:0, s:4}, {x:4, y:0, s:4}, {x:8, y:0, s:4}, {x:0, y:4, s:3}, {x:3, y:4, s:3}, {x:6, y:4, s:3}, {x:9, y:4, s:3}, {x:0, y:7, s:3}, {x:3, y:7, s:3}, {x:6, y:7, s:3}, {x:9, y:7, s:3}];
const subRect_11_05_04_0 = [{x:0, y:0, s:2}, {x:2, y:0, s:2}, {x:0, y:2, s:2}, {x:4, y:0, s:1}, {x:4, y:1, s:1}, {x:2, y:2, s:1}, {x:3, y:2, s:1}, {x:4, y:2, s:1}, {x:2, y:3, s:1}, {x:3, y:3, s:1}, {x:4, y:3, s:1}];
const subRect_11_08_06_0 = [{x:0, y:0, s:2}, {x:2, y:0, s:2}, {x:4, y:0, s:2}, {x:6, y:0, s:2}, {x:1, y:2, s:2}, {x:3, y:2, s:2}, {x:5, y:2, s:2}, {x:0, y:4, s:2}, {x:2, y:4, s:2}, {x:4, y:4, s:2}, {x:6, y:4, s:2}];
const subRect_11_09_06_0 = [{x:0, y:0, s:3}, {x:0, y:3, s:3}, {x:3, y:0, s:2}, {x:5, y:0, s:2}, {x:7, y:0, s:2}, {x:3, y:2, s:2}, {x:5, y:2, s:2}, {x:7, y:2, s:2}, {x:3, y:4, s:2}, {x:5, y:4, s:2}, {x:7, y:4, s:2}];
const subRect_11_19_12_0 = [{x:0, y:0, s:6}, {x:6, y:0, s:6}, {x:0, y:6, s:6}, {x:6, y:6, s:6}, {x:12, y:0, s:4}, {x:12, y:4, s:4}, {x:12, y:8, s:4}, {x:16, y:0, s:3}, {x:16, y:3, s:3}, {x:16, y:6, s:3}, {x:16, y:9, s:3}];
const subRect_11_14_08_0 = [{x:0, y:0, s:4}, {x:4, y:0, s:4}, {x:0, y:4, s:4}, {x:4, y:4, s:4}, {x:8, y:0, s:3}, {x:11, y:0, s:3}, {x:8, y:5, s:3}, {x:11, y:5, s:3}, {x:8, y:3, s:2}, {x:10, y:3, s:2}, {x:12, y:3, s:2}];
const subRect_11_11_06_0 = [{x:3, y:0, s:4}, {x:0, y:0, s:3}, {x:0, y:3, s:3}, {x:7, y:0, s:2}, {x:9, y:0, s:2}, {x:7, y:2, s:2}, {x:9, y:2, s:2}, {x:3, y:4, s:2}, {x:5, y:4, s:2}, {x:7, y:4, s:2}, {x:9, y:4, s:2}];
const subRect_11_28_15_0 = [{x:0, y:0, s:9}, {x:9, y:0, s:9}, {x:0, y:9, s:6}, {x:6, y:9, s:6}, {x:12, y:9, s:6}, {x:18, y:0, s:5}, {x:23, y:0, s:5}, {x:18, y:5, s:5}, {x:23, y:5, s:5}, {x:18, y:10, s:5}, {x:23, y:10, s:5}];
const subRect_11_08_04_0 = [{x:0, y:0, s:2}, {x:2, y:0, s:2}, {x:4, y:0, s:2}, {x:6, y:0, s:2}, {x:0, y:2, s:2}, {x:2, y:2, s:2}, {x:4, y:2, s:2}, {x:6, y:2, s:1}, {x:7, y:2, s:1}, {x:6, y:3, s:1}, {x:7, y:3, s:1}];
const subRect_11_13_06_0 = [{x:3, y:0, s:4}, {x:7, y:0, s:4}, {x:0, y:0, s:3}, {x:0, y:3, s:3}, {x:11, y:0, s:2}, {x:11, y:2, s:2}, {x:3, y:4, s:2}, {x:5, y:4, s:2}, {x:7, y:4, s:2}, {x:9, y:4, s:2}, {x:11, y:4, s:2}];
const subRect_11_14_06_0 = [{x:0, y:0, s:3}, {x:3, y:0, s:3}, {x:6, y:0, s:3}, {x:9, y:0, s:3}, {x:0, y:3, s:3}, {x:3, y:3, s:3}, {x:6, y:3, s:3}, {x:9, y:3, s:3}, {x:12, y:0, s:2}, {x:12, y:2, s:2}, {x:12, y:4, s:2}];
const subRect_11_15_06_0 = [{x:0, y:0, s:4}, {x:4, y:0, s:4}, {x:8, y:0, s:4}, {x:12, y:0, s:3}, {x:12, y:3, s:3}, {x:0, y:4, s:2}, {x:2, y:4, s:2}, {x:4, y:4, s:2}, {x:6, y:4, s:2}, {x:8, y:4, s:2}, {x:10, y:4, s:2}];
const subRect_11_28_11_0 = [{x:0, y:0, s:7}, {x:7, y:0, s:7}, {x:14, y:0, s:7}, {x:21, y:0, s:7}, {x:0, y:7, s:4}, {x:4, y:7, s:4}, {x:8, y:7, s:4}, {x:12, y:7, s:4}, {x:16, y:7, s:4}, {x:20, y:7, s:4}, {x:24, y:7, s:4}];
const subRect_11_16_06_0 = [{x:0, y:0, s:4}, {x:4, y:0, s:3}, {x:7, y:0, s:3}, {x:10, y:0, s:3}, {x:13, y:0, s:3}, {x:4, y:3, s:3}, {x:7, y:3, s:3}, {x:10, y:3, s:3}, {x:13, y:3, s:3}, {x:0, y:4, s:2}, {x:2, y:4, s:2}];
const subRect_11_16_06_1 = [{x:0, y:0, s:6}, {x:6, y:0, s:3}, {x:9, y:0, s:3}, {x:6, y:3, s:3}, {x:9, y:3, s:3}, {x:12, y:0, s:2}, {x:14, y:0, s:2}, {x:12, y:2, s:2}, {x:14, y:2, s:2}, {x:12, y:4, s:2}, {x:14, y:4, s:2}];
const subRect_11_27_10_0 = [{x:0, y:0, s:6}, {x:6, y:0, s:6}, {x:12, y:0, s:5}, {x:17, y:0, s:5}, {x:22, y:0, s:5}, {x:12, y:5, s:5}, {x:17, y:5, s:5}, {x:22, y:5, s:5}, {x:0, y:6, s:4}, {x:4, y:6, s:4}, {x:8, y:6, s:4}];
const subRect_11_30_11_0 = [{x:0, y:0, s:6}, {x:6, y:0, s:6}, {x:12, y:0, s:6}, {x:18, y:0, s:6}, {x:24, y:0, s:6}, {x:0, y:6, s:5}, {x:5, y:6, s:5}, {x:10, y:6, s:5}, {x:15, y:6, s:5}, {x:20, y:6, s:5}, {x:25, y:6, s:5}];
const subRect_11_09_03_0 = [{x:0, y:0, s:3}, {x:3, y:0, s:3}, {x:6, y:0, s:1}, {x:7, y:0, s:1}, {x:8, y:0, s:1}, {x:6, y:1, s:1}, {x:7, y:1, s:1}, {x:8, y:1, s:1}, {x:6, y:2, s:1}, {x:7, y:2, s:1}, {x:8, y:2, s:1}];
const subRect_11_07_02_0 = [{x:0, y:0, s:2}, {x:2, y:0, s:1}, {x:3, y:0, s:1}, {x:4, y:0, s:1}, {x:5, y:0, s:1}, {x:6, y:0, s:1}, {x:2, y:1, s:1}, {x:3, y:1, s:1}, {x:4, y:1, s:1}, {x:5, y:1, s:1}, {x:6, y:1, s:1}];
const subRect_11_10_02_0 = [{x:0, y:0, s:2}, {x:2, y:0, s:2}, {x:4, y:0, s:2}, {x:6, y:0, s:1}, {x:7, y:0, s:1}, {x:8, y:0, s:1}, {x:9, y:0, s:1}, {x:6, y:1, s:1}, {x:7, y:1, s:1}, {x:8, y:1, s:1}, {x:9, y:1, s:1}];
const subRect_11_13_02_0 = [{x:0, y:0, s:2}, {x:2, y:0, s:2}, {x:4, y:0, s:2}, {x:6, y:0, s:2}, {x:8, y:0, s:2}, {x:10, y:0, s:1}, {x:11, y:0, s:1}, {x:12, y:0, s:1}, {x:10, y:1, s:1}, {x:11, y:1, s:1}, {x:12, y:1, s:1}];
const subRect_11_16_02_0 = [{x:0, y:0, s:2}, {x:2, y:0, s:2}, {x:4, y:0, s:2}, {x:6, y:0, s:2}, {x:8, y:0, s:2}, {x:10, y:0, s:2}, {x:12, y:0, s:2}, {x:14, y:0, s:1}, {x:15, y:0, s:1}, {x:14, y:1, s:1}, {x:15, y:1, s:1}];
const subRect_11_19_02_0 = [{x:0, y:0, s:2}, {x:2, y:0, s:2}, {x:4, y:0, s:2}, {x:6, y:0, s:2}, {x:8, y:0, s:2}, {x:10, y:0, s:2}, {x:12, y:0, s:2}, {x:14, y:0, s:2}, {x:16, y:0, s:2}, {x:18, y:0, s:1}, {x:18, y:1, s:1}];
const subRect_11_11_01_0 = [{x:0, y:0, s:1}, {x:1, y:0, s:1}, {x:2, y:0, s:1}, {x:3, y:0, s:1}, {x:4, y:0, s:1}, {x:5, y:0, s:1}, {x:6, y:0, s:1}, {x:7, y:0, s:1}, {x:8, y:0, s:1}, {x:9, y:0, s:1}, {x:10, y:0, s:1}];

const layout11 =
[
	{xd:5, yd:5, full:true,  lovely:true,  flipped:true,  w:subRect_11_05_05_0},
	{xd:6, yd:6, full:true,  lovely:true,  flipped:true,  w:subRect_11_06_06_0},
	{xd:8, yd:8, full:true,  lovely:true,  flipped:true,  w:subRect_11_08_08_0},
	{xd:8, yd:8, full:false, lovely:true,  flipped:true,  w:subRect_11_08_08_1},
	{xd:9, yd:9, full:true,  lovely:true,  flipped:true,  w:subRect_11_09_09_0},
	{xd:10, yd:10, full:true,  lovely:true,  flipped:true,  w:subRect_11_10_10_0},
	{xd:17, yd:15, full:true,  lovely:true,  flipped:true,  w:subRect_11_17_15_0},
	{xd:15, yd:13, full:true,  lovely:true,  flipped:true,  w:subRect_11_15_13_0},
	{xd:14, yd:12, full:true,  lovely:true,  flipped:true,  w:subRect_11_14_12_0},
	{xd:25, yd:21, full:true,  lovely:true,  flipped:true,  w:subRect_11_25_21_0},
	{xd:6, yd:5, full:true,  lovely:true,  flipped:true,  w:subRect_11_06_05_0},
	{xd:12, yd:10, full:true,  lovely:true,  flipped:true,  w:subRect_11_12_10_0},
	{xd:5, yd:4, full:true,  lovely:true,  flipped:true,  w:subRect_11_05_04_0},
	{xd:8, yd:6, full:false, lovely:true,  flipped:false, w:subRect_11_08_06_0},
	{xd:9, yd:6, full:true,  lovely:true,  flipped:true,  w:subRect_11_09_06_0},
	{xd:19, yd:12, full:true,  lovely:true,  flipped:true,  w:subRect_11_19_12_0},
	{xd:14, yd:8, full:true,  lovely:true,  flipped:true,  w:subRect_11_14_08_0},
	{xd:11, yd:6, full:true,  lovely:true,  flipped:true,  w:subRect_11_11_06_0},
	{xd:28, yd:15, full:true,  lovely:true,  flipped:true,  w:subRect_11_28_15_0},
	{xd:8, yd:4, full:true,  lovely:true,  flipped:true,  w:subRect_11_08_04_0},
	{xd:13, yd:6, full:true,  lovely:true,  flipped:true,  w:subRect_11_13_06_0},
	{xd:14, yd:6, full:true,  lovely:true,  flipped:true,  w:subRect_11_14_06_0},
	{xd:15, yd:6, full:true,  lovely:true,  flipped:true,  w:subRect_11_15_06_0},
	{xd:28, yd:11, full:true,  lovely:true,  flipped:true,  w:subRect_11_28_11_0},
	{xd:16, yd:6, full:true,  lovely:true,  flipped:true,  w:subRect_11_16_06_0},
	{xd:16, yd:6, full:true,  lovely:true,  flipped:true,  w:subRect_11_16_06_1},
	{xd:27, yd:10, full:true,  lovely:true,  flipped:true,  w:subRect_11_27_10_0},
	{xd:30, yd:11, full:true,  lovely:true,  flipped:true,  w:subRect_11_30_11_0},
	{xd:9, yd:3, full:true,  lovely:true,  flipped:true,  w:subRect_11_09_03_0},
	{xd:7, yd:2, full:true,  lovely:true,  flipped:true,  w:subRect_11_07_02_0},
	{xd:10, yd:2, full:true,  lovely:true,  flipped:true,  w:subRect_11_10_02_0},
	{xd:13, yd:2, full:true,  lovely:true,  flipped:true,  w:subRect_11_13_02_0},
	{xd:16, yd:2, full:true,  lovely:true,  flipped:true,  w:subRect_11_16_02_0},
	{xd:19, yd:2, full:true,  lovely:true,  flipped:true,  w:subRect_11_19_02_0},
	{xd:11, yd:1, full:true,  lovely:true,  flipped:true,  w:subRect_11_11_01_0}
];

/* 12 Participants               N xd yd #              0             1             2             3             4             5             6             7             8             9            10            11     */
const subRect_12_04_04_0 = [{x:1, y:0, s:1}, {x:2, y:0, s:1}, {x:0, y:1, s:1}, {x:1, y:1, s:1}, {x:2, y:1, s:1}, {x:3, y:1, s:1}, {x:0, y:2, s:1}, {x:1, y:2, s:1}, {x:2, y:2, s:1}, {x:3, y:2, s:1}, {x:1, y:3, s:1}, {x:2, y:3, s:1}];
const subRect_12_06_06_0 = [{x:0, y:0, s:2}, {x:2, y:0, s:2}, {x:4, y:0, s:2}, {x:0, y:2, s:2}, {x:4, y:2, s:2}, {x:0, y:4, s:2}, {x:2, y:4, s:2}, {x:4, y:4, s:2}, {x:2, y:2, s:1}, {x:3, y:2, s:1}, {x:2, y:3, s:1}, {x:3, y:3, s:1}];
const subRect_12_06_06_1 = [{x:0, y:0, s:3}, {x:3, y:0, s:3}, {x:0, y:3, s:3}, {x:3, y:3, s:1}, {x:4, y:3, s:1}, {x:5, y:3, s:1}, {x:3, y:4, s:1}, {x:4, y:4, s:1}, {x:5, y:4, s:1}, {x:3, y:5, s:1}, {x:4, y:5, s:1}, {x:5, y:5, s:1}];
const subRect_12_07_07_0 = [{x:0, y:0, s:3}, {x:4, y:4, s:3}, {x:3, y:0, s:2}, {x:5, y:0, s:2}, {x:5, y:2, s:2}, {x:0, y:3, s:2}, {x:2, y:3, s:2}, {x:0, y:5, s:2}, {x:2, y:5, s:2}, {x:3, y:2, s:1}, {x:4, y:2, s:1}, {x:4, y:3, s:1}];
const subRect_12_21_20_0 = [{x:0, y:0, s:8}, {x:8, y:0, s:8}, {x:0, y:8, s:8}, {x:8, y:8, s:8}, {x:16, y:0, s:5}, {x:16, y:5, s:5}, {x:16, y:10, s:5}, {x:16, y:15, s:5}, {x:0, y:16, s:4}, {x:4, y:16, s:4}, {x:8, y:16, s:4}, {x:12, y:16, s:4}];
const subRect_12_15_14_0 = [{x:0, y:5, s:6}, {x:6, y:5, s:6}, {x:0, y:0, s:5}, {x:5, y:0, s:5}, {x:10, y:0, s:5}, {x:12, y:5, s:3}, {x:12, y:8, s:3}, {x:0, y:11, s:3}, {x:3, y:11, s:3}, {x:6, y:11, s:3}, {x:9, y:11, s:3}, {x:12, y:11, s:3}];
const subRect_12_13_12_0 = [{x:4, y:3, s:6}, {x:0, y:0, s:4}, {x:0, y:4, s:4}, {x:0, y:8, s:4}, {x:4, y:0, s:3}, {x:7, y:0, s:3}, {x:10, y:0, s:3}, {x:10, y:3, s:3}, {x:10, y:6, s:3}, {x:4, y:9, s:3}, {x:7, y:9, s:3}, {x:10, y:9, s:3}];
const subRect_12_31_28_0 = [{x:0, y:8,s:12}, {x:12, y:8,s:12}, {x:0, y:0, s:8}, {x:8, y:0, s:8}, {x:16, y:0, s:8}, {x:0, y:20, s:8}, {x:8, y:20, s:8}, {x:16, y:20, s:8}, {x:24, y:0, s:7}, {x:24, y:7, s:7}, {x:24, y:14, s:7}, {x:24, y:21, s:7}];
const subRect_12_10_09_0 = [{x:0, y:0, s:5}, {x:5, y:0, s:5}, {x:0, y:5, s:2}, {x:2, y:5, s:2}, {x:4, y:5, s:2}, {x:6, y:5, s:2}, {x:8, y:5, s:2}, {x:0, y:7, s:2}, {x:2, y:7, s:2}, {x:4, y:7, s:2}, {x:6, y:7, s:2}, {x:8, y:7, s:2}];
const subRect_12_20_18_0 = [{x:0, y:0, s:8}, {x:12, y:0, s:8}, {x:0, y:8, s:5}, {x:5, y:8, s:5}, {x:10, y:8, s:5}, {x:15, y:8, s:5}, {x:0, y:13, s:5}, {x:5, y:13, s:5}, {x:10, y:13, s:5}, {x:15, y:13, s:5}, {x:8, y:0, s:4}, {x:8, y:4, s:4}];
const subRect_12_08_07_0 = [{x:0, y:0, s:3}, {x:3, y:0, s:3}, {x:2, y:4, s:3}, {x:5, y:4, s:3}, {x:6, y:0, s:2}, {x:6, y:2, s:2}, {x:0, y:3, s:2}, {x:0, y:5, s:2}, {x:2, y:3, s:1}, {x:3, y:3, s:1}, {x:4, y:3, s:1}, {x:5, y:3, s:1}];
const subRect_12_06_05_0 = [{x:0, y:0, s:2}, {x:2, y:0, s:2}, {x:4, y:0, s:2}, {x:0, y:2, s:2}, {x:2, y:2, s:2}, {x:4, y:2, s:2}, {x:0, y:4, s:1}, {x:1, y:4, s:1}, {x:2, y:4, s:1}, {x:3, y:4, s:1}, {x:4, y:4, s:1}, {x:5, y:4, s:1}];
const subRect_12_05_04_0 = [{x:1, y:0, s:3}, {x:0, y:0, s:1}, {x:0, y:1, s:1}, {x:0, y:2, s:1}, {x:4, y:0, s:1}, {x:4, y:1, s:1}, {x:4, y:2, s:1}, {x:0, y:3, s:1}, {x:1, y:3, s:1}, {x:2, y:3, s:1}, {x:3, y:3, s:1}, {x:4, y:3, s:1}];
const subRect_12_10_08_0 = [{x:0, y:0, s:4}, {x:4, y:0, s:3}, {x:7, y:0, s:3}, {x:4, y:3, s:3}, {x:7, y:3, s:3}, {x:0, y:4, s:2}, {x:2, y:4, s:2}, {x:0, y:6, s:2}, {x:2, y:6, s:2}, {x:4, y:6, s:2}, {x:6, y:6, s:2}, {x:8, y:6, s:2}];
const subRect_12_04_03_0 = [{x:0, y:0, s:1}, {x:1, y:0, s:1}, {x:2, y:0, s:1}, {x:3, y:0, s:1}, {x:0, y:1, s:1}, {x:1, y:1, s:1}, {x:2, y:1, s:1}, {x:3, y:1, s:1}, {x:0, y:2, s:1}, {x:1, y:2, s:1}, {x:2, y:2, s:1}, {x:3, y:2, s:1}];
const subRect_12_17_12_0 = [{x:0, y:0, s:6}, {x:0, y:6, s:6}, {x:6, y:0, s:4}, {x:10, y:0, s:4}, {x:6, y:4, s:4}, {x:10, y:4, s:4}, {x:6, y:8, s:4}, {x:10, y:8, s:4}, {x:14, y:0, s:3}, {x:14, y:3, s:3}, {x:14, y:6, s:3}, {x:14, y:9, s:3}];
const subRect_12_06_04_0 = [{x:0, y:0, s:2}, {x:2, y:0, s:2}, {x:0, y:2, s:2}, {x:2, y:2, s:2}, {x:4, y:0, s:1}, {x:5, y:0, s:1}, {x:4, y:1, s:1}, {x:5, y:1, s:1}, {x:4, y:2, s:1}, {x:5, y:2, s:1}, {x:4, y:3, s:1}, {x:5, y:3, s:1}];
const subRect_12_35_22_0 = [{x:0, y:0,s:11}, {x:0, y:11,s:11}, {x:11, y:0, s:8}, {x:19, y:0, s:8}, {x:27, y:0, s:8}, {x:11, y:14, s:8}, {x:19, y:14, s:8}, {x:27, y:14, s:8}, {x:11, y:8, s:6}, {x:17, y:8, s:6}, {x:23, y:8, s:6}, {x:29, y:8, s:6}];
const subRect_12_08_05_0 = [{x:1, y:0, s:3}, {x:4, y:0, s:3}, {x:0, y:3, s:2}, {x:2, y:3, s:2}, {x:4, y:3, s:2}, {x:6, y:3, s:2}, {x:0, y:0, s:1}, {x:0, y:1, s:1}, {x:0, y:2, s:1}, {x:7, y:0, s:1}, {x:7, y:1, s:1}, {x:7, y:2, s:1}];
const subRect_12_05_03_0 = [{x:0, y:0, s:2}, {x:2, y:0, s:1}, {x:3, y:0, s:1}, {x:4, y:0, s:1}, {x:2, y:1, s:1}, {x:3, y:1, s:1}, {x:4, y:1, s:1}, {x:0, y:2, s:1}, {x:1, y:2, s:1}, {x:2, y:2, s:1}, {x:3, y:2, s:1}, {x:4, y:2, s:1}];
const subRect_12_07_04_0 = [{x:0, y:0, s:3}, {x:3, y:0, s:3}, {x:6, y:0, s:1}, {x:6, y:1, s:1}, {x:6, y:2, s:1}, {x:0, y:3, s:1}, {x:1, y:3, s:1}, {x:2, y:3, s:1}, {x:3, y:3, s:1}, {x:4, y:3, s:1}, {x:5, y:3, s:1}, {x:6, y:3, s:1}];
const subRect_12_18_10_0 = [{x:0, y:0, s:5}, {x:5, y:0, s:5}, {x:0, y:5, s:5}, {x:5, y:5, s:5}, {x:10, y:0, s:4}, {x:14, y:0, s:4}, {x:10, y:6, s:4}, {x:14, y:6, s:4}, {x:10, y:4, s:2}, {x:12, y:4, s:2}, {x:14, y:4, s:2}, {x:16, y:4, s:2}];
const subRect_12_22_12_0 = [{x:0, y:0, s:6}, {x:6, y:0, s:6}, {x:12, y:0, s:6}, {x:0, y:6, s:6}, {x:6, y:6, s:6}, {x:18, y:0, s:4}, {x:18, y:4, s:4}, {x:18, y:8, s:4}, {x:12, y:6, s:3}, {x:15, y:6, s:3}, {x:12, y:9, s:3}, {x:15, y:9, s:3}];
const subRect_12_26_14_0 = [{x:0, y:0, s:7}, {x:7, y:0, s:7}, {x:0, y:7, s:7}, {x:7, y:7, s:7}, {x:14, y:4, s:6}, {x:20, y:4, s:6}, {x:14, y:0, s:4}, {x:18, y:0, s:4}, {x:22, y:0, s:4}, {x:14, y:10, s:4}, {x:18, y:10, s:4}, {x:22, y:10, s:4}];
const subRect_12_06_03_0 = [{x:1, y:0, s:2}, {x:3, y:0, s:2}, {x:0, y:0, s:1}, {x:0, y:1, s:1}, {x:5, y:0, s:1}, {x:5, y:1, s:1}, {x:0, y:2, s:1}, {x:1, y:2, s:1}, {x:2, y:2, s:1}, {x:3, y:2, s:1}, {x:4, y:2, s:1}, {x:5, y:2, s:1}];
const subRect_12_13_06_0 = [{x:0, y:0, s:3}, {x:3, y:0, s:3}, {x:6, y:0, s:3}, {x:0, y:3, s:3}, {x:3, y:3, s:3}, {x:6, y:3, s:3}, {x:9, y:0, s:2}, {x:11, y:0, s:2}, {x:9, y:2, s:2}, {x:11, y:2, s:2}, {x:9, y:4, s:2}, {x:11, y:4, s:2}];
const subRect_12_33_15_0 = [{x:0, y:0, s:8}, {x:8, y:0, s:8}, {x:16, y:0, s:8}, {x:0, y:8, s:7}, {x:7, y:8, s:7}, {x:14, y:8, s:7}, {x:21, y:8, s:7}, {x:28, y:0, s:5}, {x:28, y:5, s:5}, {x:28, y:10, s:5}, {x:24, y:0, s:4}, {x:24, y:4, s:4}];
const subRect_12_40_18_0 = [{x:5, y:0,s:10}, {x:15, y:0,s:10}, {x:25, y:0,s:10}, {x:0, y:10, s:8}, {x:8, y:10, s:8}, {x:16, y:10, s:8}, {x:24, y:10, s:8}, {x:32, y:10, s:8}, {x:0, y:0, s:5}, {x:0, y:5, s:5}, {x:35, y:0, s:5}, {x:35, y:5, s:5}];
const subRect_12_09_04_0 = [{x:0, y:0, s:2}, {x:2, y:0, s:2}, {x:4, y:0, s:2}, {x:6, y:0, s:2}, {x:0, y:2, s:2}, {x:2, y:2, s:2}, {x:4, y:2, s:2}, {x:6, y:2, s:2}, {x:8, y:0, s:1}, {x:8, y:1, s:1}, {x:8, y:2, s:1}, {x:8, y:3, s:1}];
const subRect_12_09_04_1 = [{x:0, y:0, s:3}, {x:3, y:0, s:3}, {x:6, y:0, s:3}, {x:0, y:3, s:1}, {x:1, y:3, s:1}, {x:2, y:3, s:1}, {x:3, y:3, s:1}, {x:4, y:3, s:1}, {x:5, y:3, s:1}, {x:6, y:3, s:1}, {x:7, y:3, s:1}, {x:8, y:3, s:1}];
const subRect_12_07_03_0 = [{x:0, y:0, s:2}, {x:2, y:0, s:2}, {x:4, y:0, s:2}, {x:6, y:0, s:1}, {x:6, y:1, s:1}, {x:0, y:2, s:1}, {x:1, y:2, s:1}, {x:2, y:2, s:1}, {x:3, y:2, s:1}, {x:4, y:2, s:1}, {x:5, y:2, s:1}, {x:6, y:2, s:1}];
const subRect_12_23_09_0 = [{x:0, y:0, s:5}, {x:5, y:0, s:5}, {x:10, y:0, s:5}, {x:15, y:0, s:5}, {x:0, y:5, s:4}, {x:4, y:5, s:4}, {x:8, y:5, s:4}, {x:12, y:5, s:4}, {x:16, y:5, s:4}, {x:20, y:0, s:3}, {x:20, y:3, s:3}, {x:20, y:6, s:3}];
const subRect_12_18_07_0 = [{x:0, y:0, s:4}, {x:4, y:0, s:4}, {x:8, y:0, s:4}, {x:12, y:0, s:4}, {x:0, y:4, s:3}, {x:3, y:4, s:3}, {x:6, y:4, s:3}, {x:9, y:4, s:3}, {x:12, y:4, s:3}, {x:15, y:4, s:3}, {x:16, y:0, s:2}, {x:16, y:2, s:2}];
const subRect_12_08_03_0 = [{x:0, y:0, s:2}, {x:2, y:0, s:2}, {x:4, y:0, s:2}, {x:6, y:0, s:2}, {x:0, y:2, s:1}, {x:1, y:2, s:1}, {x:2, y:2, s:1}, {x:3, y:2, s:1}, {x:4, y:2, s:1}, {x:5, y:2, s:1}, {x:6, y:2, s:1}, {x:7, y:2, s:1}];
const subRect_12_17_06_0 = [{x:0, y:0, s:4}, {x:4, y:0, s:4}, {x:8, y:0, s:3}, {x:11, y:0, s:3}, {x:14, y:0, s:3}, {x:8, y:3, s:3}, {x:11, y:3, s:3}, {x:14, y:3, s:3}, {x:0, y:4, s:2}, {x:2, y:4, s:2}, {x:4, y:4, s:2}, {x:6, y:4, s:2}];
const subRect_12_23_08_0 = [{x:0, y:0, s:5}, {x:5, y:0, s:5}, {x:10, y:0, s:5}, {x:15, y:0, s:4}, {x:19, y:0, s:4}, {x:15, y:4, s:4}, {x:19, y:4, s:4}, {x:0, y:5, s:3}, {x:3, y:5, s:3}, {x:6, y:5, s:3}, {x:9, y:5, s:3}, {x:12, y:5, s:3}];
const subRect_12_26_09_0 = [{x:0, y:0, s:6}, {x:6, y:0, s:5}, {x:11, y:0, s:5}, {x:16, y:0, s:5}, {x:21, y:0, s:5}, {x:6, y:5, s:4}, {x:10, y:5, s:4}, {x:14, y:5, s:4}, {x:18, y:5, s:4}, {x:22, y:5, s:4}, {x:0, y:6, s:3}, {x:3, y:6, s:3}];
const subRect_12_29_10_0 = [{x:0, y:0, s:6}, {x:6, y:0, s:6}, {x:12, y:0, s:6}, {x:18, y:0, s:6}, {x:24, y:0, s:5}, {x:24, y:5, s:5}, {x:0, y:6, s:4}, {x:4, y:6, s:4}, {x:8, y:6, s:4}, {x:12, y:6, s:4}, {x:16, y:6, s:4}, {x:20, y:6, s:4}];
const subRect_12_35_12_0 = [{x:0, y:0, s:7}, {x:7, y:0, s:7}, {x:14, y:0, s:7}, {x:21, y:0, s:7}, {x:28, y:0, s:7}, {x:0, y:7, s:5}, {x:5, y:7, s:5}, {x:10, y:7, s:5}, {x:15, y:7, s:5}, {x:20, y:7, s:5}, {x:25, y:7, s:5}, {x:30, y:7, s:5}];
const subRect_12_06_02_0 = [{x:0, y:0, s:1}, {x:1, y:0, s:1}, {x:2, y:0, s:1}, {x:3, y:0, s:1}, {x:4, y:0, s:1}, {x:5, y:0, s:1}, {x:0, y:1, s:1}, {x:1, y:1, s:1}, {x:2, y:1, s:1}, {x:3, y:1, s:1}, {x:4, y:1, s:1}, {x:5, y:1, s:1}];
const subRect_12_09_02_0 = [{x:0, y:0, s:2}, {x:2, y:0, s:2}, {x:4, y:0, s:1}, {x:5, y:0, s:1}, {x:6, y:0, s:1}, {x:7, y:0, s:1}, {x:8, y:0, s:1}, {x:4, y:1, s:1}, {x:5, y:1, s:1}, {x:6, y:1, s:1}, {x:7, y:1, s:1}, {x:8, y:1, s:1}];
const subRect_12_12_02_0 = [{x:0, y:0, s:2}, {x:2, y:0, s:2}, {x:4, y:0, s:2}, {x:6, y:0, s:2}, {x:8, y:0, s:1}, {x:9, y:0, s:1}, {x:10, y:0, s:1}, {x:11, y:0, s:1}, {x:8, y:1, s:1}, {x:9, y:1, s:1}, {x:10, y:1, s:1}, {x:11, y:1, s:1}];
const subRect_12_15_02_0 = [{x:0, y:0, s:2}, {x:2, y:0, s:2}, {x:4, y:0, s:2}, {x:6, y:0, s:2}, {x:8, y:0, s:2}, {x:10, y:0, s:2}, {x:12, y:0, s:1}, {x:13, y:0, s:1}, {x:14, y:0, s:1}, {x:12, y:1, s:1}, {x:13, y:1, s:1}, {x:14, y:1, s:1}];
const subRect_12_18_02_0 = [{x:0, y:0, s:2}, {x:2, y:0, s:2}, {x:4, y:0, s:2}, {x:6, y:0, s:2}, {x:8, y:0, s:2}, {x:10, y:0, s:2}, {x:12, y:0, s:2}, {x:14, y:0, s:2}, {x:16, y:0, s:1}, {x:17, y:0, s:1}, {x:16, y:1, s:1}, {x:17, y:1, s:1}];
const subRect_12_21_02_0 = [{x:0, y:0, s:2}, {x:2, y:0, s:2}, {x:4, y:0, s:2}, {x:6, y:0, s:2}, {x:8, y:0, s:2}, {x:10, y:0, s:2}, {x:12, y:0, s:2}, {x:14, y:0, s:2}, {x:16, y:0, s:2}, {x:18, y:0, s:2}, {x:20, y:0, s:1}, {x:20, y:1, s:1}];
const subRect_12_12_01_0 = [{x:0, y:0, s:1}, {x:1, y:0, s:1}, {x:2, y:0, s:1}, {x:3, y:0, s:1}, {x:4, y:0, s:1}, {x:5, y:0, s:1}, {x:6, y:0, s:1}, {x:7, y:0, s:1}, {x:8, y:0, s:1}, {x:9, y:0, s:1}, {x:10, y:0, s:1}, {x:11, y:0, s:1}];

const layout12 =
[
	{xd:4, yd:4, full:false, lovely:true,  flipped:true,  w:subRect_12_04_04_0},
	{xd:6, yd:6, full:true,  lovely:true,  flipped:true,  w:subRect_12_06_06_0},
	{xd:6, yd:6, full:true,  lovely:true,  flipped:true,  w:subRect_12_06_06_1},
	{xd:7, yd:7, full:true,  lovely:true,  flipped:true,  w:subRect_12_07_07_0},
	{xd:21, yd:20, full:true,  lovely:true,  flipped:true,  w:subRect_12_21_20_0},
	{xd:15, yd:14, full:true,  lovely:true,  flipped:true,  w:subRect_12_15_14_0},
	{xd:13, yd:12, full:true,  lovely:true,  flipped:true,  w:subRect_12_13_12_0},
	{xd:31, yd:28, full:true,  lovely:true,  flipped:true,  w:subRect_12_31_28_0},
	{xd:10, yd:9, full:true,  lovely:true,  flipped:true,  w:subRect_12_10_09_0},
	{xd:20, yd:18, full:true,  lovely:true,  flipped:true,  w:subRect_12_20_18_0},
	{xd:8, yd:7, full:true,  lovely:true,  flipped:true,  w:subRect_12_08_07_0},
	{xd:6, yd:5, full:true,  lovely:true,  flipped:true,  w:subRect_12_06_05_0},
	{xd:5, yd:4, full:true,  lovely:true,  flipped:true,  w:subRect_12_05_04_0},
	{xd:10, yd:8, full:true,  lovely:true,  flipped:true,  w:subRect_12_10_08_0},
	{xd:4, yd:3, full:true,  lovely:true,  flipped:true,  w:subRect_12_04_03_0},
	{xd:17, yd:12, full:true,  lovely:true,  flipped:true,  w:subRect_12_17_12_0},
	{xd:6, yd:4, full:true,  lovely:true,  flipped:true,  w:subRect_12_06_04_0},
	{xd:35, yd:22, full:true,  lovely:true,  flipped:true,  w:subRect_12_35_22_0},
	{xd:8, yd:5, full:true,  lovely:true,  flipped:true,  w:subRect_12_08_05_0},
	{xd:5, yd:3, full:true,  lovely:true,  flipped:true,  w:subRect_12_05_03_0},
	{xd:7, yd:4, full:true,  lovely:true,  flipped:true,  w:subRect_12_07_04_0},
	{xd:18, yd:10, full:true,  lovely:true,  flipped:true,  w:subRect_12_18_10_0},
	{xd:22, yd:12, full:true,  lovely:true,  flipped:true,  w:subRect_12_22_12_0},
	{xd:26, yd:14, full:true,  lovely:true,  flipped:true,  w:subRect_12_26_14_0},
	{xd:6, yd:3, full:true,  lovely:true,  flipped:true,  w:subRect_12_06_03_0},
	{xd:13, yd:6, full:true,  lovely:true,  flipped:true,  w:subRect_12_13_06_0},
	{xd:33, yd:15, full:true,  lovely:true,  flipped:true,  w:subRect_12_33_15_0},
	{xd:40, yd:18, full:true,  lovely:true,  flipped:true,  w:subRect_12_40_18_0},
	{xd:9, yd:4, full:true,  lovely:true,  flipped:true,  w:subRect_12_09_04_0},
	{xd:9, yd:4, full:true,  lovely:true,  flipped:true,  w:subRect_12_09_04_1},
	{xd:7, yd:3, full:true,  lovely:true,  flipped:true,  w:subRect_12_07_03_0},
	{xd:23, yd:9, full:true,  lovely:true,  flipped:true,  w:subRect_12_23_09_0},
	{xd:18, yd:7, full:true,  lovely:true,  flipped:true,  w:subRect_12_18_07_0},
	{xd:8, yd:3, full:true,  lovely:true,  flipped:true,  w:subRect_12_08_03_0},
	{xd:17, yd:6, full:true,  lovely:true,  flipped:true,  w:subRect_12_17_06_0},
	{xd:23, yd:8, full:true,  lovely:true,  flipped:true,  w:subRect_12_23_08_0},
	{xd:26, yd:9, full:true,  lovely:true,  flipped:true,  w:subRect_12_26_09_0},
	{xd:29, yd:10, full:true,  lovely:true,  flipped:true,  w:subRect_12_29_10_0},
	{xd:35, yd:12, full:true,  lovely:true,  flipped:true,  w:subRect_12_35_12_0},
	{xd:6, yd:2, full:true,  lovely:true,  flipped:true,  w:subRect_12_06_02_0},
	{xd:9, yd:2, full:true,  lovely:true,  flipped:true,  w:subRect_12_09_02_0},
	{xd:12, yd:2, full:true,  lovely:true,  flipped:true,  w:subRect_12_12_02_0},
	{xd:15, yd:2, full:true,  lovely:true,  flipped:true,  w:subRect_12_15_02_0},
	{xd:18, yd:2, full:true,  lovely:true,  flipped:true,  w:subRect_12_18_02_0},
	{xd:21, yd:2, full:true,  lovely:true,  flipped:true,  w:subRect_12_21_02_0},
	{xd:12, yd:1, full:true,  lovely:true,  flipped:true,  w:subRect_12_12_01_0}
];

/* 13 Participants               N xd yd #              0             1             2             3             4             5             6             7             8             9            10            11            12     */
const subRect_13_04_04_0 = [{x:1, y:1, s:2}, {x:0, y:0, s:1}, {x:1, y:0, s:1}, {x:2, y:0, s:1}, {x:3, y:0, s:1}, {x:0, y:1, s:1}, {x:0, y:2, s:1}, {x:3, y:1, s:1}, {x:3, y:2, s:1}, {x:0, y:3, s:1}, {x:1, y:3, s:1}, {x:2, y:3, s:1}, {x:3, y:3, s:1}];
const subRect_13_05_05_0 = [{x:0, y:0, s:2}, {x:3, y:0, s:2}, {x:0, y:3, s:2}, {x:3, y:3, s:2}, {x:2, y:0, s:1}, {x:2, y:1, s:1}, {x:0, y:2, s:1}, {x:1, y:2, s:1}, {x:2, y:2, s:1}, {x:3, y:2, s:1}, {x:4, y:2, s:1}, {x:2, y:3, s:1}, {x:2, y:4, s:1}];
const subRect_13_15_12_0 = [{x:0, y:0, s:4}, {x:4, y:0, s:4}, {x:8, y:0, s:4}, {x:0, y:4, s:4}, {x:4, y:4, s:4}, {x:8, y:4, s:4}, {x:0, y:8, s:4}, {x:4, y:8, s:4}, {x:8, y:8, s:4}, {x:12, y:0, s:3}, {x:12, y:3, s:3}, {x:12, y:6, s:3}, {x:12, y:9, s:3}];
const subRect_13_12_09_0 = [{x:0, y:0, s:4}, {x:4, y:0, s:4}, {x:8, y:0, s:4}, {x:0, y:4, s:3}, {x:3, y:4, s:3}, {x:6, y:4, s:3}, {x:9, y:4, s:3}, {x:0, y:7, s:2}, {x:2, y:7, s:2}, {x:4, y:7, s:2}, {x:6, y:7, s:2}, {x:8, y:7, s:2}, {x:10, y:7, s:2}];
const subRect_13_16_12_0 = [{x:0, y:0, s:6}, {x:0, y:6, s:6}, {x:6, y:0, s:4}, {x:6, y:4, s:4}, {x:6, y:8, s:4}, {x:10, y:0, s:3}, {x:13, y:0, s:3}, {x:10, y:3, s:3}, {x:13, y:3, s:3}, {x:10, y:6, s:3}, {x:13, y:6, s:3}, {x:10, y:9, s:3}, {x:13, y:9, s:3}];
const subRect_13_15_11_0 = [{x:0, y:0, s:5}, {x:5, y:0, s:5}, {x:10, y:0, s:5}, {x:0, y:5, s:3}, {x:3, y:5, s:3}, {x:6, y:5, s:3}, {x:9, y:5, s:3}, {x:12, y:5, s:3}, {x:0, y:8, s:3}, {x:3, y:8, s:3}, {x:6, y:8, s:3}, {x:9, y:8, s:3}, {x:12, y:8, s:3}];
const subRect_13_20_14_0 = [{x:0, y:0, s:5}, {x:5, y:0, s:5}, {x:10, y:0, s:5}, {x:15, y:0, s:5}, {x:0, y:5, s:5}, {x:5, y:5, s:5}, {x:10, y:5, s:5}, {x:15, y:5, s:5}, {x:0, y:10, s:4}, {x:4, y:10, s:4}, {x:8, y:10, s:4}, {x:12, y:10, s:4}, {x:16, y:10, s:4}];
const subRect_13_10_06_0 = [{x:1, y:0, s:2}, {x:3, y:0, s:2}, {x:5, y:0, s:2}, {x:7, y:0, s:2}, {x:0, y:2, s:2}, {x:2, y:2, s:2}, {x:4, y:2, s:2}, {x:6, y:2, s:2}, {x:8, y:2, s:2}, {x:1, y:4, s:2}, {x:3, y:4, s:2}, {x:5, y:4, s:2}, {x:7, y:4, s:2}];
const subRect_13_12_07_0 = [{x:4, y:0, s:4}, {x:0, y:4, s:3}, {x:3, y:4, s:3}, {x:6, y:4, s:3}, {x:9, y:4, s:3}, {x:0, y:0, s:2}, {x:2, y:0, s:2}, {x:0, y:2, s:2}, {x:2, y:2, s:2}, {x:8, y:0, s:2}, {x:10, y:0, s:2}, {x:8, y:2, s:2}, {x:10, y:2, s:2}];
const subRect_13_07_04_0 = [{x:0, y:0, s:2}, {x:2, y:0, s:2}, {x:4, y:0, s:2}, {x:0, y:2, s:2}, {x:2, y:2, s:2}, {x:6, y:0, s:1}, {x:6, y:1, s:1}, {x:4, y:2, s:1}, {x:5, y:2, s:1}, {x:6, y:2, s:1}, {x:4, y:3, s:1}, {x:5, y:3, s:1}, {x:6, y:3, s:1}];
const subRect_13_12_06_0 = [{x:0, y:0, s:3}, {x:3, y:0, s:3}, {x:0, y:3, s:3}, {x:3, y:3, s:3}, {x:6, y:0, s:2}, {x:8, y:0, s:2}, {x:10, y:0, s:2}, {x:6, y:2, s:2}, {x:8, y:2, s:2}, {x:10, y:2, s:2}, {x:6, y:4, s:2}, {x:8, y:4, s:2}, {x:10, y:4, s:2}];
const subRect_13_07_03_0 = [{x:0, y:0, s:3}, {x:3, y:0, s:1}, {x:4, y:0, s:1}, {x:5, y:0, s:1}, {x:6, y:0, s:1}, {x:3, y:1, s:1}, {x:4, y:1, s:1}, {x:5, y:1, s:1}, {x:6, y:1, s:1}, {x:3, y:2, s:1}, {x:4, y:2, s:1}, {x:5, y:2, s:1}, {x:6, y:2, s:1}];
const subRect_13_10_04_0 = [{x:0, y:0, s:2}, {x:2, y:0, s:2}, {x:4, y:0, s:2}, {x:6, y:0, s:2}, {x:8, y:0, s:2}, {x:0, y:2, s:2}, {x:2, y:2, s:2}, {x:4, y:2, s:2}, {x:6, y:2, s:2}, {x:8, y:2, s:1}, {x:9, y:2, s:1}, {x:8, y:3, s:1}, {x:9, y:3, s:1}];
const subRect_13_17_06_0 = [{x:0, y:0, s:3}, {x:3, y:0, s:3}, {x:6, y:0, s:3}, {x:9, y:0, s:3}, {x:12, y:0, s:3}, {x:0, y:3, s:3}, {x:3, y:3, s:3}, {x:6, y:3, s:3}, {x:9, y:3, s:3}, {x:12, y:3, s:3}, {x:15, y:0, s:2}, {x:15, y:2, s:2}, {x:15, y:4, s:2}];
const subRect_13_40_13_0 = [{x:0, y:0, s:8}, {x:8, y:0, s:8}, {x:16, y:0, s:8}, {x:24, y:0, s:8}, {x:32, y:0, s:8}, {x:0, y:8, s:5}, {x:5, y:8, s:5}, {x:10, y:8, s:5}, {x:15, y:8, s:5}, {x:20, y:8, s:5}, {x:25, y:8, s:5}, {x:30, y:8, s:5}, {x:35, y:8, s:5}];
const subRect_13_42_13_0 = [{x:0, y:0, s:7}, {x:7, y:0, s:7}, {x:14, y:0, s:7}, {x:21, y:0, s:7}, {x:28, y:0, s:7}, {x:35, y:0, s:7}, {x:0, y:7, s:6}, {x:6, y:7, s:6}, {x:12, y:7, s:6}, {x:18, y:7, s:6}, {x:24, y:7, s:6}, {x:30, y:7, s:6}, {x:36, y:7, s:6}];
const subRect_13_08_02_0 = [{x:0, y:0, s:2}, {x:2, y:0, s:1}, {x:3, y:0, s:1}, {x:4, y:0, s:1}, {x:5, y:0, s:1}, {x:6, y:0, s:1}, {x:7, y:0, s:1}, {x:2, y:1, s:1}, {x:3, y:1, s:1}, {x:4, y:1, s:1}, {x:5, y:1, s:1}, {x:6, y:1, s:1}, {x:7, y:1, s:1}];
const subRect_13_11_02_0 = [{x:0, y:0, s:2}, {x:2, y:0, s:2}, {x:4, y:0, s:2}, {x:6, y:0, s:1}, {x:7, y:0, s:1}, {x:8, y:0, s:1}, {x:9, y:0, s:1}, {x:10, y:0, s:1}, {x:6, y:1, s:1}, {x:7, y:1, s:1}, {x:8, y:1, s:1}, {x:9, y:1, s:1}, {x:10, y:1, s:1}];
const subRect_13_14_02_0 = [{x:0, y:0, s:2}, {x:2, y:0, s:2}, {x:4, y:0, s:2}, {x:6, y:0, s:2}, {x:8, y:0, s:2}, {x:10, y:0, s:1}, {x:11, y:0, s:1}, {x:12, y:0, s:1}, {x:13, y:0, s:1}, {x:10, y:1, s:1}, {x:11, y:1, s:1}, {x:12, y:1, s:1}, {x:13, y:1, s:1}];
const subRect_13_17_02_0 = [{x:0, y:0, s:2}, {x:2, y:0, s:2}, {x:4, y:0, s:2}, {x:6, y:0, s:2}, {x:8, y:0, s:2}, {x:10, y:0, s:2}, {x:12, y:0, s:2}, {x:14, y:0, s:1}, {x:15, y:0, s:1}, {x:16, y:0, s:1}, {x:14, y:1, s:1}, {x:15, y:1, s:1}, {x:16, y:1, s:1}];
const subRect_13_20_02_0 = [{x:0, y:0, s:2}, {x:2, y:0, s:2}, {x:4, y:0, s:2}, {x:6, y:0, s:2}, {x:8, y:0, s:2}, {x:10, y:0, s:2}, {x:12, y:0, s:2}, {x:14, y:0, s:2}, {x:16, y:0, s:2}, {x:18, y:0, s:1}, {x:19, y:0, s:1}, {x:18, y:1, s:1}, {x:19, y:1, s:1}];
const subRect_13_23_02_0 = [{x:0, y:0, s:2}, {x:2, y:0, s:2}, {x:4, y:0, s:2}, {x:6, y:0, s:2}, {x:8, y:0, s:2}, {x:10, y:0, s:2}, {x:12, y:0, s:2}, {x:14, y:0, s:2}, {x:16, y:0, s:2}, {x:18, y:0, s:2}, {x:20, y:0, s:2}, {x:22, y:0, s:1}, {x:22, y:1, s:1}];
const subRect_13_13_01_0 = [{x:0, y:0, s:1}, {x:1, y:0, s:1}, {x:2, y:0, s:1}, {x:3, y:0, s:1}, {x:4, y:0, s:1}, {x:5, y:0, s:1}, {x:6, y:0, s:1}, {x:7, y:0, s:1}, {x:8, y:0, s:1}, {x:9, y:0, s:1}, {x:10, y:0, s:1}, {x:11, y:0, s:1}, {x:12, y:0, s:1}];

const layout13 =
[
	{xd:4, yd:4, full:true,  lovely:true,  flipped:true,  w:subRect_13_04_04_0},
	{xd:5, yd:5, full:true,  lovely:true,  flipped:true,  w:subRect_13_05_05_0},
	{xd:15, yd:12, full:true,  lovely:true,  flipped:true,  w:subRect_13_15_12_0},
	{xd:12, yd:9, full:true,  lovely:true,  flipped:true,  w:subRect_13_12_09_0},
	{xd:16, yd:12, full:true,  lovely:true,  flipped:true,  w:subRect_13_16_12_0},
	{xd:15, yd:11, full:true,  lovely:true,  flipped:true,  w:subRect_13_15_11_0},
	{xd:20, yd:14, full:true,  lovely:true,  flipped:true,  w:subRect_13_20_14_0},
	{xd:10, yd:6, full:false, lovely:true,  flipped:false, w:subRect_13_10_06_0},
	{xd:12, yd:7, full:true,  lovely:true,  flipped:true,  w:subRect_13_12_07_0},
	{xd:7, yd:4, full:true,  lovely:true,  flipped:true,  w:subRect_13_07_04_0},
	{xd:12, yd:6, full:true,  lovely:true,  flipped:true,  w:subRect_13_12_06_0},
	{xd:7, yd:3, full:true,  lovely:true,  flipped:true,  w:subRect_13_07_03_0},
	{xd:10, yd:4, full:true,  lovely:true,  flipped:true,  w:subRect_13_10_04_0},
	{xd:17, yd:6, full:true,  lovely:true,  flipped:true,  w:subRect_13_17_06_0},
	{xd:40, yd:13, full:true,  lovely:true,  flipped:true,  w:subRect_13_40_13_0},
	{xd:42, yd:13, full:true,  lovely:true,  flipped:true,  w:subRect_13_42_13_0},
	{xd:8, yd:2, full:true,  lovely:true,  flipped:true,  w:subRect_13_08_02_0},
	{xd:11, yd:2, full:true,  lovely:true,  flipped:true,  w:subRect_13_11_02_0},
	{xd:14, yd:2, full:true,  lovely:true,  flipped:true,  w:subRect_13_14_02_0},
	{xd:17, yd:2, full:true,  lovely:true,  flipped:true,  w:subRect_13_17_02_0},
	{xd:20, yd:2, full:true,  lovely:true,  flipped:true,  w:subRect_13_20_02_0},
	{xd:23, yd:2, full:true,  lovely:true,  flipped:true,  w:subRect_13_23_02_0},
	{xd:13, yd:1, full:true,  lovely:true,  flipped:true,  w:subRect_13_13_01_0}
];

/* 14 Participants               N xd yd #              0             1             2             3             4             5             6             7             8             9            10            11            12            13     */
const subRect_14_08_08_0 = [{x:1, y:0, s:2}, {x:3, y:0, s:2}, {x:5, y:0, s:2}, {x:0, y:2, s:2}, {x:2, y:2, s:2}, {x:4, y:2, s:2}, {x:6, y:2, s:2}, {x:0, y:4, s:2}, {x:2, y:4, s:2}, {x:4, y:4, s:2}, {x:6, y:4, s:2}, {x:1, y:6, s:2}, {x:3, y:6, s:2}, {x:5, y:6, s:2}];
const subRect_14_08_08_1 = [{x:0, y:0, s:3}, {x:5, y:0, s:3}, {x:0, y:5, s:3}, {x:5, y:5, s:3}, {x:3, y:1, s:2}, {x:0, y:3, s:2}, {x:2, y:3, s:2}, {x:4, y:3, s:2}, {x:6, y:3, s:2}, {x:3, y:5, s:2}, {x:3, y:0, s:1}, {x:4, y:0, s:1}, {x:3, y:7, s:1}, {x:4, y:7, s:1}];
const subRect_14_09_09_0 = [{x:0, y:0, s:3}, {x:3, y:0, s:3}, {x:6, y:0, s:3}, {x:0, y:3, s:3}, {x:0, y:6, s:3}, {x:3, y:3, s:2}, {x:5, y:3, s:2}, {x:7, y:3, s:2}, {x:3, y:5, s:2}, {x:5, y:5, s:2}, {x:7, y:5, s:2}, {x:3, y:7, s:2}, {x:5, y:7, s:2}, {x:7, y:7, s:2}];
const subRect_14_10_10_0 = [{x:0, y:0, s:4}, {x:0, y:4, s:4}, {x:4, y:0, s:3}, {x:7, y:0, s:3}, {x:4, y:3, s:3}, {x:7, y:3, s:3}, {x:4, y:6, s:2}, {x:6, y:6, s:2}, {x:8, y:6, s:2}, {x:0, y:8, s:2}, {x:2, y:8, s:2}, {x:4, y:8, s:2}, {x:6, y:8, s:2}, {x:8, y:8, s:2}];
const subRect_14_10_10_1 = [{x:2, y:2, s:6}, {x:2, y:0, s:2}, {x:4, y:0, s:2}, {x:6, y:0, s:2}, {x:0, y:2, s:2}, {x:0, y:4, s:2}, {x:0, y:6, s:2}, {x:8, y:2, s:2}, {x:8, y:4, s:2}, {x:8, y:6, s:2}, {x:1, y:8, s:2}, {x:3, y:8, s:2}, {x:5, y:8, s:2}, {x:7, y:8, s:2}];
const subRect_14_12_12_0 = [{x:3, y:0, s:6}, {x:0, y:6, s:4}, {x:4, y:6, s:4}, {x:8, y:6, s:4}, {x:0, y:0, s:3}, {x:0, y:3, s:3}, {x:9, y:0, s:3}, {x:9, y:3, s:3}, {x:0, y:10, s:2}, {x:2, y:10, s:2}, {x:4, y:10, s:2}, {x:6, y:10, s:2}, {x:8, y:10, s:2}, {x:10, y:10, s:2}];
const subRect_14_20_20_0 = [{x:0, y:0, s:8}, {x:8, y:0, s:8}, {x:0, y:8, s:8}, {x:8, y:8, s:6}, {x:14, y:8, s:6}, {x:8, y:14, s:6}, {x:16, y:0, s:4}, {x:16, y:4, s:4}, {x:0, y:16, s:4}, {x:4, y:16, s:4}, {x:14, y:14, s:3}, {x:17, y:14, s:3}, {x:14, y:17, s:3}, {x:17, y:17, s:3}];
const subRect_14_30_26_0 = [{x:0, y:0,s:10}, {x:10, y:0,s:10}, {x:20, y:0,s:10}, {x:5, y:10,s:10}, {x:15, y:10,s:10}, {x:0, y:20, s:6}, {x:6, y:20, s:6}, {x:12, y:20, s:6}, {x:18, y:20, s:6}, {x:24, y:20, s:6}, {x:0, y:10, s:5}, {x:0, y:15, s:5}, {x:25, y:10, s:5}, {x:25, y:15, s:5}];
const subRect_14_14_12_0 = [{x:0, y:0, s:4}, {x:4, y:0, s:4}, {x:0, y:4, s:4}, {x:4, y:4, s:4}, {x:0, y:8, s:4}, {x:4, y:8, s:4}, {x:8, y:0, s:3}, {x:11, y:0, s:3}, {x:8, y:3, s:3}, {x:11, y:3, s:3}, {x:8, y:6, s:3}, {x:11, y:6, s:3}, {x:8, y:9, s:3}, {x:11, y:9, s:3}];
const subRect_14_12_10_0 = [{x:2, y:0, s:4}, {x:6, y:0, s:4}, {x:0, y:4, s:3}, {x:3, y:4, s:3}, {x:6, y:4, s:3}, {x:9, y:4, s:3}, {x:0, y:7, s:3}, {x:3, y:7, s:3}, {x:6, y:7, s:3}, {x:9, y:7, s:3}, {x:0, y:0, s:2}, {x:0, y:2, s:2}, {x:10, y:0, s:2}, {x:10, y:2, s:2}];
const subRect_14_18_15_0 = [{x:0, y:0, s:5}, {x:5, y:0, s:5}, {x:10, y:0, s:5}, {x:0, y:5, s:5}, {x:5, y:5, s:5}, {x:10, y:5, s:5}, {x:0, y:10, s:5}, {x:5, y:10, s:5}, {x:10, y:10, s:5}, {x:15, y:0, s:3}, {x:15, y:3, s:3}, {x:15, y:6, s:3}, {x:15, y:9, s:3}, {x:15, y:12, s:3}];
const subRect_14_05_04_0 = [{x:0, y:0, s:2}, {x:0, y:2, s:2}, {x:2, y:0, s:1}, {x:3, y:0, s:1}, {x:4, y:0, s:1}, {x:2, y:1, s:1}, {x:3, y:1, s:1}, {x:4, y:1, s:1}, {x:2, y:2, s:1}, {x:3, y:2, s:1}, {x:4, y:2, s:1}, {x:2, y:3, s:1}, {x:3, y:3, s:1}, {x:4, y:3, s:1}];
const subRect_14_30_21_0 = [{x:0, y:0,s:10}, {x:10, y:0,s:10}, {x:20, y:0,s:10}, {x:0, y:10, s:6}, {x:6, y:10, s:6}, {x:12, y:10, s:6}, {x:18, y:10, s:6}, {x:24, y:10, s:6}, {x:0, y:16, s:5}, {x:5, y:16, s:5}, {x:10, y:16, s:5}, {x:15, y:16, s:5}, {x:20, y:16, s:5}, {x:25, y:16, s:5}];
const subRect_14_12_08_0 = [{x:0, y:0, s:3}, {x:3, y:0, s:3}, {x:6, y:0, s:3}, {x:9, y:0, s:3}, {x:0, y:3, s:3}, {x:3, y:3, s:3}, {x:6, y:3, s:3}, {x:9, y:3, s:3}, {x:0, y:6, s:2}, {x:2, y:6, s:2}, {x:4, y:6, s:2}, {x:6, y:6, s:2}, {x:8, y:6, s:2}, {x:10, y:6, s:2}];
const subRect_14_18_12_0 = [{x:0, y:3, s:6}, {x:6, y:0, s:4}, {x:10, y:0, s:4}, {x:14, y:0, s:4}, {x:6, y:4, s:4}, {x:10, y:4, s:4}, {x:14, y:4, s:4}, {x:6, y:8, s:4}, {x:10, y:8, s:4}, {x:14, y:8, s:4}, {x:0, y:0, s:3}, {x:3, y:0, s:3}, {x:0, y:9, s:3}, {x:3, y:9, s:3}];
const subRect_14_20_13_0 = [{x:0, y:0, s:5}, {x:5, y:0, s:5}, {x:10, y:0, s:5}, {x:15, y:0, s:5}, {x:0, y:5, s:4}, {x:4, y:5, s:4}, {x:8, y:5, s:4}, {x:12, y:5, s:4}, {x:16, y:5, s:4}, {x:0, y:9, s:4}, {x:4, y:9, s:4}, {x:8, y:9, s:4}, {x:12, y:9, s:4}, {x:16, y:9, s:4}];
const subRect_14_19_12_0 = [{x:0, y:0, s:6}, {x:0, y:6, s:6}, {x:6, y:3, s:6}, {x:15, y:0, s:4}, {x:15, y:4, s:4}, {x:15, y:8, s:4}, {x:6, y:0, s:3}, {x:9, y:0, s:3}, {x:12, y:0, s:3}, {x:12, y:3, s:3}, {x:12, y:6, s:3}, {x:6, y:9, s:3}, {x:9, y:9, s:3}, {x:12, y:9, s:3}];
const subRect_14_10_06_0 = [{x:0, y:0, s:2}, {x:2, y:0, s:2}, {x:4, y:0, s:2}, {x:6, y:0, s:2}, {x:8, y:0, s:2}, {x:1, y:2, s:2}, {x:3, y:2, s:2}, {x:5, y:2, s:2}, {x:7, y:2, s:2}, {x:0, y:4, s:2}, {x:2, y:4, s:2}, {x:4, y:4, s:2}, {x:6, y:4, s:2}, {x:8, y:4, s:2}];
const subRect_14_11_06_0 = [{x:0, y:0, s:3}, {x:0, y:3, s:3}, {x:3, y:0, s:2}, {x:5, y:0, s:2}, {x:7, y:0, s:2}, {x:9, y:0, s:2}, {x:3, y:2, s:2}, {x:5, y:2, s:2}, {x:7, y:2, s:2}, {x:9, y:2, s:2}, {x:3, y:4, s:2}, {x:5, y:4, s:2}, {x:7, y:4, s:2}, {x:9, y:4, s:2}];
const subRect_14_30_16_0 = [{x:10, y:0,s:10}, {x:0, y:10, s:6}, {x:6, y:10, s:6}, {x:12, y:10, s:6}, {x:18, y:10, s:6}, {x:24, y:10, s:6}, {x:0, y:0, s:5}, {x:5, y:0, s:5}, {x:0, y:5, s:5}, {x:5, y:5, s:5}, {x:20, y:0, s:5}, {x:25, y:0, s:5}, {x:20, y:5, s:5}, {x:25, y:5, s:5}];
const subRect_14_23_12_0 = [{x:0, y:0, s:6}, {x:6, y:0, s:6}, {x:0, y:6, s:6}, {x:6, y:6, s:6}, {x:12, y:0, s:4}, {x:16, y:0, s:4}, {x:12, y:4, s:4}, {x:16, y:4, s:4}, {x:12, y:8, s:4}, {x:16, y:8, s:4}, {x:20, y:0, s:3}, {x:20, y:3, s:3}, {x:20, y:6, s:3}, {x:20, y:9, s:3}];
const subRect_14_08_04_0 = [{x:0, y:0, s:2}, {x:2, y:0, s:2}, {x:4, y:0, s:2}, {x:0, y:2, s:2}, {x:2, y:2, s:2}, {x:4, y:2, s:2}, {x:6, y:0, s:1}, {x:7, y:0, s:1}, {x:6, y:1, s:1}, {x:7, y:1, s:1}, {x:6, y:2, s:1}, {x:7, y:2, s:1}, {x:6, y:3, s:1}, {x:7, y:3, s:1}];
const subRect_14_42_19_0 = [{x:0, y:0,s:12}, {x:12, y:0,s:12}, {x:0, y:12, s:7}, {x:7, y:12, s:7}, {x:14, y:12, s:7}, {x:21, y:12, s:7}, {x:28, y:12, s:7}, {x:35, y:12, s:7}, {x:24, y:0, s:6}, {x:30, y:0, s:6}, {x:36, y:0, s:6}, {x:24, y:6, s:6}, {x:30, y:6, s:6}, {x:36, y:6, s:6}];
const subRect_14_45_19_0 = [{x:0, y:0,s:10}, {x:10, y:0,s:10}, {x:20, y:0,s:10}, {x:0, y:10, s:9}, {x:9, y:10, s:9}, {x:18, y:10, s:9}, {x:27, y:10, s:9}, {x:36, y:10, s:9}, {x:30, y:0, s:5}, {x:35, y:0, s:5}, {x:40, y:0, s:5}, {x:30, y:5, s:5}, {x:35, y:5, s:5}, {x:40, y:5, s:5}];
const subRect_14_16_06_0 = [{x:0, y:0, s:3}, {x:3, y:0, s:3}, {x:6, y:0, s:3}, {x:9, y:0, s:3}, {x:0, y:3, s:3}, {x:3, y:3, s:3}, {x:6, y:3, s:3}, {x:9, y:3, s:3}, {x:12, y:0, s:2}, {x:14, y:0, s:2}, {x:12, y:2, s:2}, {x:14, y:2, s:2}, {x:12, y:4, s:2}, {x:14, y:4, s:2}];
const subRect_14_11_04_0 = [{x:0, y:0, s:2}, {x:2, y:0, s:2}, {x:4, y:0, s:2}, {x:6, y:0, s:2}, {x:8, y:0, s:2}, {x:0, y:2, s:2}, {x:2, y:2, s:2}, {x:4, y:2, s:2}, {x:6, y:2, s:2}, {x:8, y:2, s:2}, {x:10, y:0, s:1}, {x:10, y:1, s:1}, {x:10, y:2, s:1}, {x:10, y:3, s:1}];
const subRect_14_19_06_0 = [{x:0, y:0, s:4}, {x:4, y:0, s:4}, {x:8, y:0, s:4}, {x:12, y:0, s:4}, {x:16, y:0, s:3}, {x:16, y:3, s:3}, {x:0, y:4, s:2}, {x:2, y:4, s:2}, {x:4, y:4, s:2}, {x:6, y:4, s:2}, {x:8, y:4, s:2}, {x:10, y:4, s:2}, {x:12, y:4, s:2}, {x:14, y:4, s:2}];
const subRect_14_10_03_0 = [{x:0, y:0, s:3}, {x:3, y:0, s:3}, {x:6, y:0, s:1}, {x:7, y:0, s:1}, {x:8, y:0, s:1}, {x:9, y:0, s:1}, {x:6, y:1, s:1}, {x:7, y:1, s:1}, {x:8, y:1, s:1}, {x:9, y:1, s:1}, {x:6, y:2, s:1}, {x:7, y:2, s:1}, {x:8, y:2, s:1}, {x:9, y:2, s:1}];
const subRect_14_45_14_0 = [{x:0, y:0, s:9}, {x:9, y:0, s:9}, {x:18, y:0, s:9}, {x:27, y:0, s:9}, {x:36, y:0, s:9}, {x:0, y:9, s:5}, {x:5, y:9, s:5}, {x:10, y:9, s:5}, {x:15, y:9, s:5}, {x:20, y:9, s:5}, {x:25, y:9, s:5}, {x:30, y:9, s:5}, {x:35, y:9, s:5}, {x:40, y:9, s:5}];
const subRect_14_24_07_0 = [{x:0, y:0, s:4}, {x:4, y:0, s:4}, {x:8, y:0, s:4}, {x:12, y:0, s:4}, {x:16, y:0, s:4}, {x:20, y:0, s:4}, {x:0, y:4, s:3}, {x:3, y:4, s:3}, {x:6, y:4, s:3}, {x:9, y:4, s:3}, {x:12, y:4, s:3}, {x:15, y:4, s:3}, {x:18, y:4, s:3}, {x:21, y:4, s:3}];
const subRect_14_07_02_0 = [{x:0, y:0, s:1}, {x:1, y:0, s:1}, {x:2, y:0, s:1}, {x:3, y:0, s:1}, {x:4, y:0, s:1}, {x:5, y:0, s:1}, {x:6, y:0, s:1}, {x:0, y:1, s:1}, {x:1, y:1, s:1}, {x:2, y:1, s:1}, {x:3, y:1, s:1}, {x:4, y:1, s:1}, {x:5, y:1, s:1}, {x:6, y:1, s:1}];
const subRect_14_10_02_0 = [{x:0, y:0, s:2}, {x:2, y:0, s:2}, {x:4, y:0, s:1}, {x:5, y:0, s:1}, {x:6, y:0, s:1}, {x:7, y:0, s:1}, {x:8, y:0, s:1}, {x:9, y:0, s:1}, {x:4, y:1, s:1}, {x:5, y:1, s:1}, {x:6, y:1, s:1}, {x:7, y:1, s:1}, {x:8, y:1, s:1}, {x:9, y:1, s:1}];
const subRect_14_13_02_0 = [{x:0, y:0, s:2}, {x:2, y:0, s:2}, {x:4, y:0, s:2}, {x:6, y:0, s:2}, {x:8, y:0, s:1}, {x:9, y:0, s:1}, {x:10, y:0, s:1}, {x:11, y:0, s:1}, {x:12, y:0, s:1}, {x:8, y:1, s:1}, {x:9, y:1, s:1}, {x:10, y:1, s:1}, {x:11, y:1, s:1}, {x:12, y:1, s:1}];
const subRect_14_16_02_0 = [{x:0, y:0, s:2}, {x:2, y:0, s:2}, {x:4, y:0, s:2}, {x:6, y:0, s:2}, {x:8, y:0, s:2}, {x:10, y:0, s:2}, {x:12, y:0, s:1}, {x:13, y:0, s:1}, {x:14, y:0, s:1}, {x:15, y:0, s:1}, {x:12, y:1, s:1}, {x:13, y:1, s:1}, {x:14, y:1, s:1}, {x:15, y:1, s:1}];
const subRect_14_19_02_0 = [{x:0, y:0, s:2}, {x:2, y:0, s:2}, {x:4, y:0, s:2}, {x:6, y:0, s:2}, {x:8, y:0, s:2}, {x:10, y:0, s:2}, {x:12, y:0, s:2}, {x:14, y:0, s:2}, {x:16, y:0, s:1}, {x:17, y:0, s:1}, {x:18, y:0, s:1}, {x:16, y:1, s:1}, {x:17, y:1, s:1}, {x:18, y:1, s:1}];
const subRect_14_22_02_0 = [{x:0, y:0, s:2}, {x:2, y:0, s:2}, {x:4, y:0, s:2}, {x:6, y:0, s:2}, {x:8, y:0, s:2}, {x:10, y:0, s:2}, {x:12, y:0, s:2}, {x:14, y:0, s:2}, {x:16, y:0, s:2}, {x:18, y:0, s:2}, {x:20, y:0, s:1}, {x:21, y:0, s:1}, {x:20, y:1, s:1}, {x:21, y:1, s:1}];
const subRect_14_25_02_0 = [{x:0, y:0, s:2}, {x:2, y:0, s:2}, {x:4, y:0, s:2}, {x:6, y:0, s:2}, {x:8, y:0, s:2}, {x:10, y:0, s:2}, {x:12, y:0, s:2}, {x:14, y:0, s:2}, {x:16, y:0, s:2}, {x:18, y:0, s:2}, {x:20, y:0, s:2}, {x:22, y:0, s:2}, {x:24, y:0, s:1}, {x:24, y:1, s:1}];
const subRect_14_14_01_0 = [{x:0, y:0, s:1}, {x:1, y:0, s:1}, {x:2, y:0, s:1}, {x:3, y:0, s:1}, {x:4, y:0, s:1}, {x:5, y:0, s:1}, {x:6, y:0, s:1}, {x:7, y:0, s:1}, {x:8, y:0, s:1}, {x:9, y:0, s:1}, {x:10, y:0, s:1}, {x:11, y:0, s:1}, {x:12, y:0, s:1}, {x:13, y:0, s:1}];

const layout14 =
[
	{xd:8, yd:8, full:false, lovely:true,  flipped:false, w:subRect_14_08_08_0},
	{xd:8, yd:8, full:true,  lovely:true,  flipped:true,  w:subRect_14_08_08_1},
	{xd:9, yd:9, full:true,  lovely:true,  flipped:true,  w:subRect_14_09_09_0},
	{xd:10, yd:10, full:true,  lovely:true,  flipped:true,  w:subRect_14_10_10_0},
	{xd:10, yd:10, full:false, lovely:true,  flipped:true,  w:subRect_14_10_10_1},
	{xd:12, yd:12, full:true,  lovely:true,  flipped:true,  w:subRect_14_12_12_0},
	{xd:20, yd:20, full:true,  lovely:true,  flipped:true,  w:subRect_14_20_20_0},
	{xd:30, yd:26, full:true,  lovely:true,  flipped:true,  w:subRect_14_30_26_0},
	{xd:14, yd:12, full:true,  lovely:true,  flipped:true,  w:subRect_14_14_12_0},
	{xd:12, yd:10, full:true,  lovely:true,  flipped:true,  w:subRect_14_12_10_0},
	{xd:18, yd:15, full:true,  lovely:true,  flipped:true,  w:subRect_14_18_15_0},
	{xd:5, yd:4, full:true,  lovely:true,  flipped:true,  w:subRect_14_05_04_0},
	{xd:30, yd:21, full:true,  lovely:true,  flipped:true,  w:subRect_14_30_21_0},
	{xd:12, yd:8, full:true,  lovely:true,  flipped:true,  w:subRect_14_12_08_0},
	{xd:18, yd:12, full:true,  lovely:true,  flipped:true,  w:subRect_14_18_12_0},
	{xd:20, yd:13, full:true,  lovely:true,  flipped:true,  w:subRect_14_20_13_0},
	{xd:19, yd:12, full:true,  lovely:true,  flipped:true,  w:subRect_14_19_12_0},
	{xd:10, yd:6, full:false, lovely:true,  flipped:false, w:subRect_14_10_06_0},
	{xd:11, yd:6, full:true,  lovely:true,  flipped:true,  w:subRect_14_11_06_0},
	{xd:30, yd:16, full:true,  lovely:true,  flipped:true,  w:subRect_14_30_16_0},
	{xd:23, yd:12, full:true,  lovely:true,  flipped:true,  w:subRect_14_23_12_0},
	{xd:8, yd:4, full:true,  lovely:true,  flipped:true,  w:subRect_14_08_04_0},
	{xd:42, yd:19, full:true,  lovely:true,  flipped:true,  w:subRect_14_42_19_0},
	{xd:45, yd:19, full:true,  lovely:true,  flipped:true,  w:subRect_14_45_19_0},
	{xd:16, yd:6, full:true,  lovely:true,  flipped:true,  w:subRect_14_16_06_0},
	{xd:11, yd:4, full:true,  lovely:true,  flipped:true,  w:subRect_14_11_04_0},
	{xd:19, yd:6, full:true,  lovely:true,  flipped:true,  w:subRect_14_19_06_0},
	{xd:10, yd:3, full:true,  lovely:true,  flipped:true,  w:subRect_14_10_03_0},
	{xd:45, yd:14, full:true,  lovely:true,  flipped:true,  w:subRect_14_45_14_0},
	{xd:24, yd:7, full:true,  lovely:true,  flipped:true,  w:subRect_14_24_07_0},
	{xd:7, yd:2, full:true,  lovely:true,  flipped:true,  w:subRect_14_07_02_0},
	{xd:10, yd:2, full:true,  lovely:true,  flipped:true,  w:subRect_14_10_02_0},
	{xd:13, yd:2, full:true,  lovely:true,  flipped:true,  w:subRect_14_13_02_0},
	{xd:16, yd:2, full:true,  lovely:true,  flipped:true,  w:subRect_14_16_02_0},
	{xd:19, yd:2, full:true,  lovely:true,  flipped:true,  w:subRect_14_19_02_0},
	{xd:22, yd:2, full:true,  lovely:true,  flipped:true,  w:subRect_14_22_02_0},
	{xd:25, yd:2, full:true,  lovely:true,  flipped:true,  w:subRect_14_25_02_0},
	{xd:14, yd:1, full:true,  lovely:true,  flipped:true,  w:subRect_14_14_01_0}
];

/* 15 Participants               N xd yd #              0             1             2             3             4             5             6             7             8             9            10            11            12            13            14     */
const subRect_15_06_06_0 = [{x:1, y:0, s:2}, {x:3, y:0, s:2}, {x:0, y:2, s:2}, {x:2, y:2, s:2}, {x:4, y:2, s:2}, {x:1, y:4, s:2}, {x:3, y:4, s:2}, {x:0, y:0, s:1}, {x:0, y:1, s:1}, {x:5, y:0, s:1}, {x:5, y:1, s:1}, {x:0, y:4, s:1}, {x:0, y:5, s:1}, {x:5, y:4, s:1}, {x:5, y:5, s:1}];
const subRect_15_07_07_0 = [{x:0, y:0, s:3}, {x:3, y:0, s:3}, {x:0, y:3, s:2}, {x:2, y:3, s:2}, {x:4, y:3, s:2}, {x:0, y:5, s:2}, {x:2, y:5, s:2}, {x:4, y:5, s:2}, {x:6, y:0, s:1}, {x:6, y:1, s:1}, {x:6, y:2, s:1}, {x:6, y:3, s:1}, {x:6, y:4, s:1}, {x:6, y:5, s:1}, {x:6, y:6, s:1}];
const subRect_15_10_10_0 = [{x:2, y:2, s:6}, {x:1, y:0, s:2}, {x:3, y:0, s:2}, {x:5, y:0, s:2}, {x:7, y:0, s:2}, {x:0, y:2, s:2}, {x:0, y:4, s:2}, {x:0, y:6, s:2}, {x:8, y:2, s:2}, {x:8, y:4, s:2}, {x:8, y:6, s:2}, {x:1, y:8, s:2}, {x:3, y:8, s:2}, {x:5, y:8, s:2}, {x:7, y:8, s:2}];
const subRect_15_11_11_0 = [{x:0, y:0, s:5}, {x:5, y:2, s:3}, {x:8, y:2, s:3}, {x:2, y:5, s:3}, {x:5, y:5, s:3}, {x:8, y:5, s:3}, {x:2, y:8, s:3}, {x:5, y:8, s:3}, {x:8, y:8, s:3}, {x:5, y:0, s:2}, {x:7, y:0, s:2}, {x:9, y:0, s:2}, {x:0, y:5, s:2}, {x:0, y:7, s:2}, {x:0, y:9, s:2}];
const subRect_15_16_16_0 = [{x:0, y:0, s:6}, {x:0, y:6, s:6}, {x:6, y:0, s:5}, {x:11, y:0, s:5}, {x:6, y:5, s:5}, {x:11, y:5, s:5}, {x:0, y:12, s:4}, {x:4, y:12, s:4}, {x:8, y:12, s:4}, {x:12, y:12, s:4}, {x:6, y:10, s:2}, {x:8, y:10, s:2}, {x:10, y:10, s:2}, {x:12, y:10, s:2}, {x:14, y:10, s:2}];
const subRect_15_13_12_0 = [{x:0, y:0, s:4}, {x:0, y:4, s:4}, {x:0, y:8, s:4}, {x:4, y:0, s:3}, {x:7, y:0, s:3}, {x:10, y:0, s:3}, {x:4, y:3, s:3}, {x:7, y:3, s:3}, {x:10, y:3, s:3}, {x:4, y:6, s:3}, {x:7, y:6, s:3}, {x:10, y:6, s:3}, {x:4, y:9, s:3}, {x:7, y:9, s:3}, {x:10, y:9, s:3}];
const subRect_15_07_06_0 = [{x:0, y:0, s:2}, {x:2, y:0, s:2}, {x:4, y:0, s:2}, {x:0, y:2, s:2}, {x:2, y:2, s:2}, {x:4, y:2, s:2}, {x:0, y:4, s:2}, {x:2, y:4, s:2}, {x:4, y:4, s:2}, {x:6, y:0, s:1}, {x:6, y:1, s:1}, {x:6, y:2, s:1}, {x:6, y:3, s:1}, {x:6, y:4, s:1}, {x:6, y:5, s:1}];
const subRect_15_06_05_0 = [{x:0, y:0, s:2}, {x:2, y:0, s:2}, {x:4, y:0, s:2}, {x:1, y:2, s:2}, {x:3, y:2, s:2}, {x:0, y:2, s:1}, {x:0, y:3, s:1}, {x:5, y:2, s:1}, {x:5, y:3, s:1}, {x:0, y:4, s:1}, {x:1, y:4, s:1}, {x:2, y:4, s:1}, {x:3, y:4, s:1}, {x:4, y:4, s:1}, {x:5, y:4, s:1}];
const subRect_15_10_08_0 = [{x:2, y:0, s:3}, {x:5, y:0, s:3}, {x:2, y:3, s:3}, {x:5, y:3, s:3}, {x:0, y:0, s:2}, {x:0, y:2, s:2}, {x:0, y:4, s:2}, {x:8, y:0, s:2}, {x:8, y:2, s:2}, {x:8, y:4, s:2}, {x:0, y:6, s:2}, {x:2, y:6, s:2}, {x:4, y:6, s:2}, {x:6, y:6, s:2}, {x:8, y:6, s:2}];
const subRect_15_35_27_0 = [{x:0, y:0,s:10}, {x:10, y:0,s:10}, {x:20, y:0,s:10}, {x:0, y:10,s:10}, {x:10, y:10,s:10}, {x:20, y:10,s:10}, {x:0, y:20, s:7}, {x:7, y:20, s:7}, {x:14, y:20, s:7}, {x:21, y:20, s:7}, {x:28, y:20, s:7}, {x:30, y:0, s:5}, {x:30, y:5, s:5}, {x:30, y:10, s:5}, {x:30, y:15, s:5}];
const subRect_15_08_06_0 = [{x:0, y:0, s:2}, {x:2, y:0, s:2}, {x:4, y:0, s:2}, {x:6, y:0, s:2}, {x:0, y:2, s:2}, {x:2, y:2, s:2}, {x:4, y:2, s:2}, {x:6, y:2, s:2}, {x:0, y:4, s:2}, {x:2, y:4, s:2}, {x:4, y:4, s:2}, {x:6, y:4, s:1}, {x:7, y:4, s:1}, {x:6, y:5, s:1}, {x:7, y:5, s:1}];
const subRect_15_24_17_0 = [{x:0, y:0, s:8}, {x:8, y:0, s:8}, {x:16, y:0, s:8}, {x:0, y:8, s:6}, {x:6, y:8, s:6}, {x:12, y:8, s:6}, {x:18, y:8, s:6}, {x:0, y:14, s:3}, {x:3, y:14, s:3}, {x:6, y:14, s:3}, {x:9, y:14, s:3}, {x:12, y:14, s:3}, {x:15, y:14, s:3}, {x:18, y:14, s:3}, {x:21, y:14, s:3}];
const subRect_15_06_04_0 = [{x:0, y:0, s:2}, {x:2, y:0, s:2}, {x:4, y:0, s:2}, {x:0, y:2, s:1}, {x:1, y:2, s:1}, {x:2, y:2, s:1}, {x:3, y:2, s:1}, {x:4, y:2, s:1}, {x:5, y:2, s:1}, {x:0, y:3, s:1}, {x:1, y:3, s:1}, {x:2, y:3, s:1}, {x:3, y:3, s:1}, {x:4, y:3, s:1}, {x:5, y:3, s:1}];
const subRect_15_08_05_0 = [{x:0, y:0, s:3}, {x:3, y:0, s:3}, {x:0, y:3, s:2}, {x:2, y:3, s:2}, {x:4, y:3, s:2}, {x:6, y:0, s:1}, {x:7, y:0, s:1}, {x:6, y:1, s:1}, {x:7, y:1, s:1}, {x:6, y:2, s:1}, {x:7, y:2, s:1}, {x:6, y:3, s:1}, {x:7, y:3, s:1}, {x:6, y:4, s:1}, {x:7, y:4, s:1}];
const subRect_15_05_03_0 = [{x:0, y:0, s:1}, {x:1, y:0, s:1}, {x:2, y:0, s:1}, {x:3, y:0, s:1}, {x:4, y:0, s:1}, {x:0, y:1, s:1}, {x:1, y:1, s:1}, {x:2, y:1, s:1}, {x:3, y:1, s:1}, {x:4, y:1, s:1}, {x:0, y:2, s:1}, {x:1, y:2, s:1}, {x:2, y:2, s:1}, {x:3, y:2, s:1}, {x:4, y:2, s:1}];
const subRect_15_21_12_0 = [{x:0, y:0, s:6}, {x:0, y:6, s:6}, {x:6, y:0, s:4}, {x:10, y:0, s:4}, {x:14, y:0, s:4}, {x:6, y:4, s:4}, {x:10, y:4, s:4}, {x:14, y:4, s:4}, {x:6, y:8, s:4}, {x:10, y:8, s:4}, {x:14, y:8, s:4}, {x:18, y:0, s:3}, {x:18, y:3, s:3}, {x:18, y:6, s:3}, {x:18, y:9, s:3}];
const subRect_15_09_05_0 = [{x:0, y:0, s:3}, {x:3, y:0, s:3}, {x:6, y:0, s:3}, {x:0, y:3, s:2}, {x:7, y:3, s:2}, {x:2, y:3, s:1}, {x:3, y:3, s:1}, {x:4, y:3, s:1}, {x:5, y:3, s:1}, {x:6, y:3, s:1}, {x:2, y:4, s:1}, {x:3, y:4, s:1}, {x:4, y:4, s:1}, {x:5, y:4, s:1}, {x:6, y:4, s:1}];
const subRect_15_06_03_0 = [{x:2, y:0, s:2}, {x:0, y:0, s:1}, {x:1, y:0, s:1}, {x:0, y:1, s:1}, {x:1, y:1, s:1}, {x:4, y:0, s:1}, {x:5, y:0, s:1}, {x:4, y:1, s:1}, {x:5, y:1, s:1}, {x:0, y:2, s:1}, {x:1, y:2, s:1}, {x:2, y:2, s:1}, {x:3, y:2, s:1}, {x:4, y:2, s:1}, {x:5, y:2, s:1}];
const subRect_15_22_10_0 = [{x:0, y:0, s:5}, {x:5, y:0, s:5}, {x:0, y:5, s:5}, {x:5, y:5, s:5}, {x:10, y:0, s:4}, {x:14, y:0, s:4}, {x:18, y:0, s:4}, {x:10, y:4, s:3}, {x:13, y:4, s:3}, {x:16, y:4, s:3}, {x:19, y:4, s:3}, {x:10, y:7, s:3}, {x:13, y:7, s:3}, {x:16, y:7, s:3}, {x:19, y:7, s:3}];
const subRect_15_09_04_0 = [{x:0, y:0, s:2}, {x:2, y:0, s:2}, {x:4, y:0, s:2}, {x:6, y:0, s:2}, {x:0, y:2, s:2}, {x:2, y:2, s:2}, {x:4, y:2, s:2}, {x:8, y:0, s:1}, {x:8, y:1, s:1}, {x:6, y:2, s:1}, {x:7, y:2, s:1}, {x:8, y:2, s:1}, {x:6, y:3, s:1}, {x:7, y:3, s:1}, {x:8, y:3, s:1}];
const subRect_15_07_03_0 = [{x:0, y:0, s:2}, {x:2, y:0, s:2}, {x:4, y:0, s:1}, {x:5, y:0, s:1}, {x:6, y:0, s:1}, {x:4, y:1, s:1}, {x:5, y:1, s:1}, {x:6, y:1, s:1}, {x:0, y:2, s:1}, {x:1, y:2, s:1}, {x:2, y:2, s:1}, {x:3, y:2, s:1}, {x:4, y:2, s:1}, {x:5, y:2, s:1}, {x:6, y:2, s:1}];
const subRect_15_15_06_0 = [{x:0, y:0, s:3}, {x:3, y:0, s:3}, {x:6, y:0, s:3}, {x:0, y:3, s:3}, {x:3, y:3, s:3}, {x:6, y:3, s:3}, {x:9, y:0, s:2}, {x:11, y:0, s:2}, {x:13, y:0, s:2}, {x:9, y:2, s:2}, {x:11, y:2, s:2}, {x:13, y:2, s:2}, {x:9, y:4, s:2}, {x:11, y:4, s:2}, {x:13, y:4, s:2}];
const subRect_15_08_03_0 = [{x:1, y:0, s:2}, {x:3, y:0, s:2}, {x:5, y:0, s:2}, {x:0, y:0, s:1}, {x:0, y:1, s:1}, {x:7, y:0, s:1}, {x:7, y:1, s:1}, {x:0, y:2, s:1}, {x:1, y:2, s:1}, {x:2, y:2, s:1}, {x:3, y:2, s:1}, {x:4, y:2, s:1}, {x:5, y:2, s:1}, {x:6, y:2, s:1}, {x:7, y:2, s:1}];
const subRect_15_09_03_0 = [{x:0, y:0, s:2}, {x:2, y:0, s:2}, {x:4, y:0, s:2}, {x:6, y:0, s:2}, {x:8, y:0, s:1}, {x:8, y:1, s:1}, {x:0, y:2, s:1}, {x:1, y:2, s:1}, {x:2, y:2, s:1}, {x:3, y:2, s:1}, {x:4, y:2, s:1}, {x:5, y:2, s:1}, {x:6, y:2, s:1}, {x:7, y:2, s:1}, {x:8, y:2, s:1}];
const subRect_15_12_04_0 = [{x:0, y:0, s:2}, {x:2, y:0, s:2}, {x:4, y:0, s:2}, {x:6, y:0, s:2}, {x:8, y:0, s:2}, {x:10, y:0, s:2}, {x:0, y:2, s:2}, {x:2, y:2, s:2}, {x:4, y:2, s:2}, {x:6, y:2, s:2}, {x:8, y:2, s:2}, {x:10, y:2, s:1}, {x:11, y:2, s:1}, {x:10, y:3, s:1}, {x:11, y:3, s:1}];
const subRect_15_10_03_0 = [{x:0, y:0, s:2}, {x:2, y:0, s:2}, {x:4, y:0, s:2}, {x:6, y:0, s:2}, {x:8, y:0, s:2}, {x:0, y:2, s:1}, {x:1, y:2, s:1}, {x:2, y:2, s:1}, {x:3, y:2, s:1}, {x:4, y:2, s:1}, {x:5, y:2, s:1}, {x:6, y:2, s:1}, {x:7, y:2, s:1}, {x:8, y:2, s:1}, {x:9, y:2, s:1}];
const subRect_15_20_06_0 = [{x:0, y:0, s:3}, {x:3, y:0, s:3}, {x:6, y:0, s:3}, {x:9, y:0, s:3}, {x:12, y:0, s:3}, {x:15, y:0, s:3}, {x:0, y:3, s:3}, {x:3, y:3, s:3}, {x:6, y:3, s:3}, {x:9, y:3, s:3}, {x:12, y:3, s:3}, {x:15, y:3, s:3}, {x:18, y:0, s:2}, {x:18, y:2, s:2}, {x:18, y:4, s:2}];
const subRect_15_18_05_0 = [{x:0, y:0, s:3}, {x:3, y:0, s:3}, {x:6, y:0, s:3}, {x:9, y:0, s:3}, {x:12, y:0, s:3}, {x:15, y:0, s:3}, {x:0, y:3, s:2}, {x:2, y:3, s:2}, {x:4, y:3, s:2}, {x:6, y:3, s:2}, {x:8, y:3, s:2}, {x:10, y:3, s:2}, {x:12, y:3, s:2}, {x:14, y:3, s:2}, {x:16, y:3, s:2}];
const subRect_15_56_15_0 = [{x:0, y:0, s:8}, {x:8, y:0, s:8}, {x:16, y:0, s:8}, {x:24, y:0, s:8}, {x:32, y:0, s:8}, {x:40, y:0, s:8}, {x:48, y:0, s:8}, {x:0, y:8, s:7}, {x:7, y:8, s:7}, {x:14, y:8, s:7}, {x:21, y:8, s:7}, {x:28, y:8, s:7}, {x:35, y:8, s:7}, {x:42, y:8, s:7}, {x:49, y:8, s:7}];
const subRect_15_09_02_0 = [{x:0, y:0, s:2}, {x:2, y:0, s:1}, {x:3, y:0, s:1}, {x:4, y:0, s:1}, {x:5, y:0, s:1}, {x:6, y:0, s:1}, {x:7, y:0, s:1}, {x:8, y:0, s:1}, {x:2, y:1, s:1}, {x:3, y:1, s:1}, {x:4, y:1, s:1}, {x:5, y:1, s:1}, {x:6, y:1, s:1}, {x:7, y:1, s:1}, {x:8, y:1, s:1}];
const subRect_15_12_02_0 = [{x:0, y:0, s:2}, {x:2, y:0, s:2}, {x:4, y:0, s:2}, {x:6, y:0, s:1}, {x:7, y:0, s:1}, {x:8, y:0, s:1}, {x:9, y:0, s:1}, {x:10, y:0, s:1}, {x:11, y:0, s:1}, {x:6, y:1, s:1}, {x:7, y:1, s:1}, {x:8, y:1, s:1}, {x:9, y:1, s:1}, {x:10, y:1, s:1}, {x:11, y:1, s:1}];
const subRect_15_15_02_0 = [{x:0, y:0, s:2}, {x:2, y:0, s:2}, {x:4, y:0, s:2}, {x:6, y:0, s:2}, {x:8, y:0, s:2}, {x:10, y:0, s:1}, {x:11, y:0, s:1}, {x:12, y:0, s:1}, {x:13, y:0, s:1}, {x:14, y:0, s:1}, {x:10, y:1, s:1}, {x:11, y:1, s:1}, {x:12, y:1, s:1}, {x:13, y:1, s:1}, {x:14, y:1, s:1}];
const subRect_15_18_02_0 = [{x:0, y:0, s:2}, {x:2, y:0, s:2}, {x:4, y:0, s:2}, {x:6, y:0, s:2}, {x:8, y:0, s:2}, {x:10, y:0, s:2}, {x:12, y:0, s:2}, {x:14, y:0, s:1}, {x:15, y:0, s:1}, {x:16, y:0, s:1}, {x:17, y:0, s:1}, {x:14, y:1, s:1}, {x:15, y:1, s:1}, {x:16, y:1, s:1}, {x:17, y:1, s:1}];
const subRect_15_21_02_0 = [{x:0, y:0, s:2}, {x:2, y:0, s:2}, {x:4, y:0, s:2}, {x:6, y:0, s:2}, {x:8, y:0, s:2}, {x:10, y:0, s:2}, {x:12, y:0, s:2}, {x:14, y:0, s:2}, {x:16, y:0, s:2}, {x:18, y:0, s:1}, {x:19, y:0, s:1}, {x:20, y:0, s:1}, {x:18, y:1, s:1}, {x:19, y:1, s:1}, {x:20, y:1, s:1}];
const subRect_15_24_02_0 = [{x:0, y:0, s:2}, {x:2, y:0, s:2}, {x:4, y:0, s:2}, {x:6, y:0, s:2}, {x:8, y:0, s:2}, {x:10, y:0, s:2}, {x:12, y:0, s:2}, {x:14, y:0, s:2}, {x:16, y:0, s:2}, {x:18, y:0, s:2}, {x:20, y:0, s:2}, {x:22, y:0, s:1}, {x:23, y:0, s:1}, {x:22, y:1, s:1}, {x:23, y:1, s:1}];
const subRect_15_27_02_0 = [{x:0, y:0, s:2}, {x:2, y:0, s:2}, {x:4, y:0, s:2}, {x:6, y:0, s:2}, {x:8, y:0, s:2}, {x:10, y:0, s:2}, {x:12, y:0, s:2}, {x:14, y:0, s:2}, {x:16, y:0, s:2}, {x:18, y:0, s:2}, {x:20, y:0, s:2}, {x:22, y:0, s:2}, {x:24, y:0, s:2}, {x:26, y:0, s:1}, {x:26, y:1, s:1}];
const subRect_15_15_01_0 = [{x:0, y:0, s:1}, {x:1, y:0, s:1}, {x:2, y:0, s:1}, {x:3, y:0, s:1}, {x:4, y:0, s:1}, {x:5, y:0, s:1}, {x:6, y:0, s:1}, {x:7, y:0, s:1}, {x:8, y:0, s:1}, {x:9, y:0, s:1}, {x:10, y:0, s:1}, {x:11, y:0, s:1}, {x:12, y:0, s:1}, {x:13, y:0, s:1}, {x:14, y:0, s:1}];

const layout15 =
[
	{xd:6, yd:6, full:true,  lovely:true,  flipped:true,  w:subRect_15_06_06_0},
	{xd:7, yd:7, full:true,  lovely:true,  flipped:true,  w:subRect_15_07_07_0},
	{xd:10, yd:10, full:false, lovely:true,  flipped:true,  w:subRect_15_10_10_0},
	{xd:11, yd:11, full:true,  lovely:true,  flipped:true,  w:subRect_15_11_11_0},
	{xd:16, yd:16, full:true,  lovely:true,  flipped:true,  w:subRect_15_16_16_0},
	{xd:13, yd:12, full:true,  lovely:true,  flipped:true,  w:subRect_15_13_12_0},
	{xd:7, yd:6, full:true,  lovely:true,  flipped:true,  w:subRect_15_07_06_0},
	{xd:6, yd:5, full:true,  lovely:true,  flipped:true,  w:subRect_15_06_05_0},
	{xd:10, yd:8, full:true,  lovely:true,  flipped:true,  w:subRect_15_10_08_0},
	{xd:35, yd:27, full:true,  lovely:true,  flipped:true,  w:subRect_15_35_27_0},
	{xd:8, yd:6, full:true,  lovely:true,  flipped:true,  w:subRect_15_08_06_0},
	{xd:24, yd:17, full:true,  lovely:true,  flipped:true,  w:subRect_15_24_17_0},
	{xd:6, yd:4, full:true,  lovely:true,  flipped:true,  w:subRect_15_06_04_0},
	{xd:8, yd:5, full:true,  lovely:true,  flipped:true,  w:subRect_15_08_05_0},
	{xd:5, yd:3, full:true,  lovely:true,  flipped:true,  w:subRect_15_05_03_0},
	{xd:21, yd:12, full:true,  lovely:true,  flipped:true,  w:subRect_15_21_12_0},
	{xd:9, yd:5, full:true,  lovely:true,  flipped:true,  w:subRect_15_09_05_0},
	{xd:6, yd:3, full:true,  lovely:true,  flipped:true,  w:subRect_15_06_03_0},
	{xd:22, yd:10, full:true,  lovely:true,  flipped:true,  w:subRect_15_22_10_0},
	{xd:9, yd:4, full:true,  lovely:true,  flipped:true,  w:subRect_15_09_04_0},
	{xd:7, yd:3, full:true,  lovely:true,  flipped:true,  w:subRect_15_07_03_0},
	{xd:15, yd:6, full:true,  lovely:true,  flipped:true,  w:subRect_15_15_06_0},
	{xd:8, yd:3, full:true,  lovely:true,  flipped:true,  w:subRect_15_08_03_0},
	{xd:9, yd:3, full:true,  lovely:true,  flipped:true,  w:subRect_15_09_03_0},
	{xd:12, yd:4, full:true,  lovely:true,  flipped:true,  w:subRect_15_12_04_0},
	{xd:10, yd:3, full:true,  lovely:true,  flipped:true,  w:subRect_15_10_03_0},
	{xd:20, yd:6, full:true,  lovely:true,  flipped:true,  w:subRect_15_20_06_0},
	{xd:18, yd:5, full:true,  lovely:true,  flipped:true,  w:subRect_15_18_05_0},
	{xd:56, yd:15, full:true,  lovely:true,  flipped:true,  w:subRect_15_56_15_0},
	{xd:9, yd:2, full:true,  lovely:true,  flipped:true,  w:subRect_15_09_02_0},
	{xd:12, yd:2, full:true,  lovely:true,  flipped:true,  w:subRect_15_12_02_0},
	{xd:15, yd:2, full:true,  lovely:true,  flipped:true,  w:subRect_15_15_02_0},
	{xd:18, yd:2, full:true,  lovely:true,  flipped:true,  w:subRect_15_18_02_0},
	{xd:21, yd:2, full:true,  lovely:true,  flipped:true,  w:subRect_15_21_02_0},
	{xd:24, yd:2, full:true,  lovely:true,  flipped:true,  w:subRect_15_24_02_0},
	{xd:27, yd:2, full:true,  lovely:true,  flipped:true,  w:subRect_15_27_02_0},
	{xd:15, yd:1, full:true,  lovely:true,  flipped:true,  w:subRect_15_15_01_0}
];

/* 16 Participants               N xd yd #              0             1             2             3             4             5             6             7             8             9            10            11            12            13            14            15     */
const subRect_16_04_04_0 = [{x:0, y:0, s:1}, {x:1, y:0, s:1}, {x:2, y:0, s:1}, {x:3, y:0, s:1}, {x:0, y:1, s:1}, {x:1, y:1, s:1}, {x:2, y:1, s:1}, {x:3, y:1, s:1}, {x:0, y:2, s:1}, {x:1, y:2, s:1}, {x:2, y:2, s:1}, {x:3, y:2, s:1}, {x:0, y:3, s:1}, {x:1, y:3, s:1}, {x:2, y:3, s:1}, {x:3, y:3, s:1}];
const subRect_16_05_05_0 = [{x:0, y:0, s:2}, {x:2, y:0, s:2}, {x:0, y:2, s:2}, {x:4, y:0, s:1}, {x:4, y:1, s:1}, {x:2, y:2, s:1}, {x:3, y:2, s:1}, {x:4, y:2, s:1}, {x:2, y:3, s:1}, {x:3, y:3, s:1}, {x:4, y:3, s:1}, {x:0, y:4, s:1}, {x:1, y:4, s:1}, {x:2, y:4, s:1}, {x:3, y:4, s:1}, {x:4, y:4, s:1}];
const subRect_16_14_14_0 = [{x:0, y:0, s:5}, {x:5, y:0, s:5}, {x:0, y:5, s:5}, {x:5, y:5, s:5}, {x:10, y:0, s:4}, {x:10, y:4, s:4}, {x:0, y:10, s:4}, {x:4, y:10, s:4}, {x:10, y:8, s:2}, {x:12, y:8, s:2}, {x:8, y:10, s:2}, {x:10, y:10, s:2}, {x:12, y:10, s:2}, {x:8, y:12, s:2}, {x:10, y:12, s:2}, {x:12, y:12, s:2}];
const subRect_16_21_20_0 = [{x:5, y:4,s:12}, {x:0, y:0, s:5}, {x:0, y:5, s:5}, {x:0, y:10, s:5}, {x:0, y:15, s:5}, {x:5, y:0, s:4}, {x:9, y:0, s:4}, {x:13, y:0, s:4}, {x:17, y:0, s:4}, {x:17, y:4, s:4}, {x:17, y:8, s:4}, {x:17, y:12, s:4}, {x:5, y:16, s:4}, {x:9, y:16, s:4}, {x:13, y:16, s:4}, {x:17, y:16, s:4}];
const subRect_16_16_15_0 = [{x:0, y:0, s:5}, {x:5, y:0, s:5}, {x:0, y:5, s:5}, {x:5, y:5, s:5}, {x:0, y:10, s:5}, {x:5, y:10, s:5}, {x:10, y:0, s:3}, {x:13, y:0, s:3}, {x:10, y:3, s:3}, {x:13, y:3, s:3}, {x:10, y:6, s:3}, {x:13, y:6, s:3}, {x:10, y:9, s:3}, {x:13, y:9, s:3}, {x:10, y:12, s:3}, {x:13, y:12, s:3}];
const subRect_16_12_11_0 = [{x:0, y:0, s:4}, {x:8, y:0, s:4}, {x:0, y:7, s:4}, {x:8, y:7, s:4}, {x:0, y:4, s:3}, {x:3, y:4, s:3}, {x:6, y:4, s:3}, {x:9, y:4, s:3}, {x:4, y:0, s:2}, {x:6, y:0, s:2}, {x:4, y:2, s:2}, {x:6, y:2, s:2}, {x:4, y:7, s:2}, {x:6, y:7, s:2}, {x:4, y:9, s:2}, {x:6, y:9, s:2}];
const subRect_16_08_07_0 = [{x:1, y:0, s:3}, {x:4, y:0, s:3}, {x:0, y:3, s:2}, {x:2, y:3, s:2}, {x:4, y:3, s:2}, {x:6, y:3, s:2}, {x:0, y:5, s:2}, {x:2, y:5, s:2}, {x:4, y:5, s:2}, {x:6, y:5, s:2}, {x:0, y:0, s:1}, {x:0, y:1, s:1}, {x:0, y:2, s:1}, {x:7, y:0, s:1}, {x:7, y:1, s:1}, {x:7, y:2, s:1}];
const subRect_16_05_04_0 = [{x:1, y:0, s:1}, {x:2, y:0, s:1}, {x:3, y:0, s:1}, {x:0, y:1, s:1}, {x:1, y:1, s:1}, {x:2, y:1, s:1}, {x:3, y:1, s:1}, {x:4, y:1, s:1}, {x:0, y:2, s:1}, {x:1, y:2, s:1}, {x:2, y:2, s:1}, {x:3, y:2, s:1}, {x:4, y:2, s:1}, {x:1, y:3, s:1}, {x:2, y:3, s:1}, {x:3, y:3, s:1}];
const subRect_16_12_09_0 = [{x:2, y:2, s:4}, {x:6, y:2, s:4}, {x:0, y:6, s:3}, {x:3, y:6, s:3}, {x:6, y:6, s:3}, {x:9, y:6, s:3}, {x:0, y:0, s:2}, {x:2, y:0, s:2}, {x:4, y:0, s:2}, {x:6, y:0, s:2}, {x:8, y:0, s:2}, {x:10, y:0, s:2}, {x:0, y:2, s:2}, {x:0, y:4, s:2}, {x:10, y:2, s:2}, {x:10, y:4, s:2}];
const subRect_16_52_37_0 = [{x:0, y:0,s:13}, {x:13, y:0,s:13}, {x:26, y:0,s:13}, {x:39, y:0,s:13}, {x:8, y:13,s:12}, {x:20, y:13,s:12}, {x:32, y:13,s:12}, {x:8, y:25,s:12}, {x:20, y:25,s:12}, {x:32, y:25,s:12}, {x:0, y:13, s:8}, {x:0, y:21, s:8}, {x:0, y:29, s:8}, {x:44, y:13, s:8}, {x:44, y:21, s:8}, {x:44, y:29, s:8}];
const subRect_16_06_04_0 = [{x:0, y:0, s:3}, {x:3, y:0, s:1}, {x:4, y:0, s:1}, {x:5, y:0, s:1}, {x:3, y:1, s:1}, {x:4, y:1, s:1}, {x:5, y:1, s:1}, {x:3, y:2, s:1}, {x:4, y:2, s:1}, {x:5, y:2, s:1}, {x:0, y:3, s:1}, {x:1, y:3, s:1}, {x:2, y:3, s:1}, {x:3, y:3, s:1}, {x:4, y:3, s:1}, {x:5, y:3, s:1}];
const subRect_16_19_12_0 = [{x:0, y:0, s:4}, {x:4, y:0, s:4}, {x:8, y:0, s:4}, {x:12, y:0, s:4}, {x:0, y:4, s:4}, {x:4, y:4, s:4}, {x:8, y:4, s:4}, {x:12, y:4, s:4}, {x:0, y:8, s:4}, {x:4, y:8, s:4}, {x:8, y:8, s:4}, {x:12, y:8, s:4}, {x:16, y:0, s:3}, {x:16, y:3, s:3}, {x:16, y:6, s:3}, {x:16, y:9, s:3}];
const subRect_16_08_05_0 = [{x:0, y:0, s:2}, {x:2, y:0, s:2}, {x:4, y:0, s:2}, {x:6, y:0, s:2}, {x:0, y:2, s:2}, {x:2, y:2, s:2}, {x:4, y:2, s:2}, {x:6, y:2, s:2}, {x:0, y:4, s:1}, {x:1, y:4, s:1}, {x:2, y:4, s:1}, {x:3, y:4, s:1}, {x:4, y:4, s:1}, {x:5, y:4, s:1}, {x:6, y:4, s:1}, {x:7, y:4, s:1}];
const subRect_16_12_07_0 = [{x:0, y:0, s:3}, {x:3, y:0, s:3}, {x:6, y:0, s:3}, {x:9, y:0, s:3}, {x:0, y:3, s:2}, {x:2, y:3, s:2}, {x:4, y:3, s:2}, {x:6, y:3, s:2}, {x:8, y:3, s:2}, {x:10, y:3, s:2}, {x:0, y:5, s:2}, {x:2, y:5, s:2}, {x:4, y:5, s:2}, {x:6, y:5, s:2}, {x:8, y:5, s:2}, {x:10, y:5, s:2}];
const subRect_16_07_04_0 = [{x:0, y:0, s:2}, {x:2, y:0, s:2}, {x:0, y:2, s:2}, {x:2, y:2, s:2}, {x:4, y:0, s:1}, {x:5, y:0, s:1}, {x:6, y:0, s:1}, {x:4, y:1, s:1}, {x:5, y:1, s:1}, {x:6, y:1, s:1}, {x:4, y:2, s:1}, {x:5, y:2, s:1}, {x:6, y:2, s:1}, {x:4, y:3, s:1}, {x:5, y:3, s:1}, {x:6, y:3, s:1}];
const subRect_16_44_25_0 = [{x:0, y:0, s:9}, {x:9, y:0, s:9}, {x:18, y:0, s:9}, {x:27, y:0, s:9}, {x:8, y:16, s:9}, {x:17, y:16, s:9}, {x:26, y:16, s:9}, {x:35, y:16, s:9}, {x:36, y:0, s:8}, {x:36, y:8, s:8}, {x:0, y:9, s:8}, {x:0, y:17, s:8}, {x:8, y:9, s:7}, {x:15, y:9, s:7}, {x:22, y:9, s:7}, {x:29, y:9, s:7}];
const subRect_16_30_17_0 = [{x:0, y:0, s:6}, {x:6, y:0, s:6}, {x:12, y:0, s:6}, {x:18, y:0, s:6}, {x:24, y:0, s:6}, {x:0, y:6, s:6}, {x:6, y:6, s:6}, {x:12, y:6, s:6}, {x:18, y:6, s:6}, {x:24, y:6, s:6}, {x:0, y:12, s:5}, {x:5, y:12, s:5}, {x:10, y:12, s:5}, {x:15, y:12, s:5}, {x:20, y:12, s:5}, {x:25, y:12, s:5}];
const subRect_16_10_04_0 = [{x:0, y:0, s:2}, {x:2, y:0, s:2}, {x:4, y:0, s:2}, {x:6, y:0, s:2}, {x:0, y:2, s:2}, {x:2, y:2, s:2}, {x:4, y:2, s:2}, {x:6, y:2, s:2}, {x:8, y:0, s:1}, {x:9, y:0, s:1}, {x:8, y:1, s:1}, {x:9, y:1, s:1}, {x:8, y:2, s:1}, {x:9, y:2, s:1}, {x:8, y:3, s:1}, {x:9, y:3, s:1}];
const subRect_16_40_14_0 = [{x:0, y:0, s:7}, {x:7, y:0, s:7}, {x:14, y:0, s:7}, {x:21, y:0, s:7}, {x:0, y:7, s:7}, {x:7, y:7, s:7}, {x:14, y:7, s:7}, {x:21, y:7, s:7}, {x:28, y:0, s:6}, {x:34, y:0, s:6}, {x:28, y:6, s:4}, {x:32, y:6, s:4}, {x:36, y:6, s:4}, {x:28, y:10, s:4}, {x:32, y:10, s:4}, {x:36, y:10, s:4}];
const subRect_16_19_06_0 = [{x:0, y:0, s:3}, {x:3, y:0, s:3}, {x:6, y:0, s:3}, {x:9, y:0, s:3}, {x:12, y:0, s:3}, {x:0, y:3, s:3}, {x:3, y:3, s:3}, {x:6, y:3, s:3}, {x:9, y:3, s:3}, {x:12, y:3, s:3}, {x:15, y:0, s:2}, {x:17, y:0, s:2}, {x:15, y:2, s:2}, {x:17, y:2, s:2}, {x:15, y:4, s:2}, {x:17, y:4, s:2}];
const subRect_16_13_04_0 = [{x:0, y:0, s:2}, {x:2, y:0, s:2}, {x:4, y:0, s:2}, {x:6, y:0, s:2}, {x:8, y:0, s:2}, {x:10, y:0, s:2}, {x:0, y:2, s:2}, {x:2, y:2, s:2}, {x:4, y:2, s:2}, {x:6, y:2, s:2}, {x:8, y:2, s:2}, {x:10, y:2, s:2}, {x:12, y:0, s:1}, {x:12, y:1, s:1}, {x:12, y:2, s:1}, {x:12, y:3, s:1}];
const subRect_16_30_08_0 = [{x:0, y:0, s:5}, {x:5, y:0, s:5}, {x:10, y:0, s:5}, {x:15, y:0, s:5}, {x:20, y:0, s:5}, {x:25, y:0, s:5}, {x:0, y:5, s:3}, {x:3, y:5, s:3}, {x:6, y:5, s:3}, {x:9, y:5, s:3}, {x:12, y:5, s:3}, {x:15, y:5, s:3}, {x:18, y:5, s:3}, {x:21, y:5, s:3}, {x:24, y:5, s:3}, {x:27, y:5, s:3}];
const subRect_16_63_16_0 = [{x:0, y:0, s:9}, {x:9, y:0, s:9}, {x:18, y:0, s:9}, {x:27, y:0, s:9}, {x:36, y:0, s:9}, {x:45, y:0, s:9}, {x:54, y:0, s:9}, {x:0, y:9, s:7}, {x:7, y:9, s:7}, {x:14, y:9, s:7}, {x:21, y:9, s:7}, {x:28, y:9, s:7}, {x:35, y:9, s:7}, {x:42, y:9, s:7}, {x:49, y:9, s:7}, {x:56, y:9, s:7}];
const subRect_16_08_02_0 = [{x:0, y:0, s:1}, {x:1, y:0, s:1}, {x:2, y:0, s:1}, {x:3, y:0, s:1}, {x:4, y:0, s:1}, {x:5, y:0, s:1}, {x:6, y:0, s:1}, {x:7, y:0, s:1}, {x:0, y:1, s:1}, {x:1, y:1, s:1}, {x:2, y:1, s:1}, {x:3, y:1, s:1}, {x:4, y:1, s:1}, {x:5, y:1, s:1}, {x:6, y:1, s:1}, {x:7, y:1, s:1}];
const subRect_16_11_02_0 = [{x:0, y:0, s:2}, {x:2, y:0, s:2}, {x:4, y:0, s:1}, {x:5, y:0, s:1}, {x:6, y:0, s:1}, {x:7, y:0, s:1}, {x:8, y:0, s:1}, {x:9, y:0, s:1}, {x:10, y:0, s:1}, {x:4, y:1, s:1}, {x:5, y:1, s:1}, {x:6, y:1, s:1}, {x:7, y:1, s:1}, {x:8, y:1, s:1}, {x:9, y:1, s:1}, {x:10, y:1, s:1}];
const subRect_16_14_02_0 = [{x:0, y:0, s:2}, {x:2, y:0, s:2}, {x:4, y:0, s:2}, {x:6, y:0, s:2}, {x:8, y:0, s:1}, {x:9, y:0, s:1}, {x:10, y:0, s:1}, {x:11, y:0, s:1}, {x:12, y:0, s:1}, {x:13, y:0, s:1}, {x:8, y:1, s:1}, {x:9, y:1, s:1}, {x:10, y:1, s:1}, {x:11, y:1, s:1}, {x:12, y:1, s:1}, {x:13, y:1, s:1}];
const subRect_16_17_02_0 = [{x:0, y:0, s:2}, {x:2, y:0, s:2}, {x:4, y:0, s:2}, {x:6, y:0, s:2}, {x:8, y:0, s:2}, {x:10, y:0, s:2}, {x:12, y:0, s:1}, {x:13, y:0, s:1}, {x:14, y:0, s:1}, {x:15, y:0, s:1}, {x:16, y:0, s:1}, {x:12, y:1, s:1}, {x:13, y:1, s:1}, {x:14, y:1, s:1}, {x:15, y:1, s:1}, {x:16, y:1, s:1}];
const subRect_16_20_02_0 = [{x:0, y:0, s:2}, {x:2, y:0, s:2}, {x:4, y:0, s:2}, {x:6, y:0, s:2}, {x:8, y:0, s:2}, {x:10, y:0, s:2}, {x:12, y:0, s:2}, {x:14, y:0, s:2}, {x:16, y:0, s:1}, {x:17, y:0, s:1}, {x:18, y:0, s:1}, {x:19, y:0, s:1}, {x:16, y:1, s:1}, {x:17, y:1, s:1}, {x:18, y:1, s:1}, {x:19, y:1, s:1}];
const subRect_16_23_02_0 = [{x:0, y:0, s:2}, {x:2, y:0, s:2}, {x:4, y:0, s:2}, {x:6, y:0, s:2}, {x:8, y:0, s:2}, {x:10, y:0, s:2}, {x:12, y:0, s:2}, {x:14, y:0, s:2}, {x:16, y:0, s:2}, {x:18, y:0, s:2}, {x:20, y:0, s:1}, {x:21, y:0, s:1}, {x:22, y:0, s:1}, {x:20, y:1, s:1}, {x:21, y:1, s:1}, {x:22, y:1, s:1}];
const subRect_16_26_02_0 = [{x:0, y:0, s:2}, {x:2, y:0, s:2}, {x:4, y:0, s:2}, {x:6, y:0, s:2}, {x:8, y:0, s:2}, {x:10, y:0, s:2}, {x:12, y:0, s:2}, {x:14, y:0, s:2}, {x:16, y:0, s:2}, {x:18, y:0, s:2}, {x:20, y:0, s:2}, {x:22, y:0, s:2}, {x:24, y:0, s:1}, {x:25, y:0, s:1}, {x:24, y:1, s:1}, {x:25, y:1, s:1}];
const subRect_16_29_02_0 = [{x:0, y:0, s:2}, {x:2, y:0, s:2}, {x:4, y:0, s:2}, {x:6, y:0, s:2}, {x:8, y:0, s:2}, {x:10, y:0, s:2}, {x:12, y:0, s:2}, {x:14, y:0, s:2}, {x:16, y:0, s:2}, {x:18, y:0, s:2}, {x:20, y:0, s:2}, {x:22, y:0, s:2}, {x:24, y:0, s:2}, {x:26, y:0, s:2}, {x:28, y:0, s:1}, {x:28, y:1, s:1}];
const subRect_16_16_01_0 = [{x:0, y:0, s:1}, {x:1, y:0, s:1}, {x:2, y:0, s:1}, {x:3, y:0, s:1}, {x:4, y:0, s:1}, {x:5, y:0, s:1}, {x:6, y:0, s:1}, {x:7, y:0, s:1}, {x:8, y:0, s:1}, {x:9, y:0, s:1}, {x:10, y:0, s:1}, {x:11, y:0, s:1}, {x:12, y:0, s:1}, {x:13, y:0, s:1}, {x:14, y:0, s:1}, {x:15, y:0, s:1}];

const layout16 =
[
	{xd:4, yd:4, full:true,  lovely:true,  flipped:true,  w:subRect_16_04_04_0},
	{xd:5, yd:5, full:true,  lovely:true,  flipped:true,  w:subRect_16_05_05_0},
	{xd:14, yd:14, full:true,  lovely:true,  flipped:true,  w:subRect_16_14_14_0},
	{xd:21, yd:20, full:true,  lovely:true,  flipped:true,  w:subRect_16_21_20_0},
	{xd:16, yd:15, full:true,  lovely:true,  flipped:true,  w:subRect_16_16_15_0},
	{xd:12, yd:11, full:true,  lovely:true,  flipped:true,  w:subRect_16_12_11_0},
	{xd:8, yd:7, full:true,  lovely:true,  flipped:true,  w:subRect_16_08_07_0},
	{xd:5, yd:4, full:false, lovely:true,  flipped:true,  w:subRect_16_05_04_0},
	{xd:12, yd:9, full:true,  lovely:true,  flipped:true,  w:subRect_16_12_09_0},
	{xd:52, yd:37, full:true,  lovely:true,  flipped:true,  w:subRect_16_52_37_0},
	{xd:6, yd:4, full:true,  lovely:true,  flipped:true,  w:subRect_16_06_04_0},
	{xd:19, yd:12, full:true,  lovely:true,  flipped:true,  w:subRect_16_19_12_0},
	{xd:8, yd:5, full:true,  lovely:true,  flipped:true,  w:subRect_16_08_05_0},
	{xd:12, yd:7, full:true,  lovely:true,  flipped:true,  w:subRect_16_12_07_0},
	{xd:7, yd:4, full:true,  lovely:true,  flipped:true,  w:subRect_16_07_04_0},
	{xd:44, yd:25, full:true,  lovely:true,  flipped:true,  w:subRect_16_44_25_0},
	{xd:30, yd:17, full:true,  lovely:true,  flipped:true,  w:subRect_16_30_17_0},
	{xd:10, yd:4, full:true,  lovely:true,  flipped:true,  w:subRect_16_10_04_0},
	{xd:40, yd:14, full:true,  lovely:true,  flipped:true,  w:subRect_16_40_14_0},
	{xd:19, yd:6, full:true,  lovely:true,  flipped:true,  w:subRect_16_19_06_0},
	{xd:13, yd:4, full:true,  lovely:true,  flipped:true,  w:subRect_16_13_04_0},
	{xd:30, yd:8, full:true,  lovely:true,  flipped:true,  w:subRect_16_30_08_0},
	{xd:63, yd:16, full:true,  lovely:true,  flipped:true,  w:subRect_16_63_16_0},
	{xd:8, yd:2, full:true,  lovely:true,  flipped:true,  w:subRect_16_08_02_0},
	{xd:11, yd:2, full:true,  lovely:true,  flipped:true,  w:subRect_16_11_02_0},
	{xd:14, yd:2, full:true,  lovely:true,  flipped:true,  w:subRect_16_14_02_0},
	{xd:17, yd:2, full:true,  lovely:true,  flipped:true,  w:subRect_16_17_02_0},
	{xd:20, yd:2, full:true,  lovely:true,  flipped:true,  w:subRect_16_20_02_0},
	{xd:23, yd:2, full:true,  lovely:true,  flipped:true,  w:subRect_16_23_02_0},
	{xd:26, yd:2, full:true,  lovely:true,  flipped:true,  w:subRect_16_26_02_0},
	{xd:29, yd:2, full:true,  lovely:true,  flipped:true,  w:subRect_16_29_02_0},
	{xd:16, yd:1, full:true,  lovely:true,  flipped:true,  w:subRect_16_16_01_0}
];

const layoutTable =
[
	{options:null, numOptions:0},
	{options:layout1, numOptions:layout1.length},
	{options:layout2, numOptions:layout2.length},
	{options:layout3, numOptions:layout3.length},
	{options:layout4, numOptions:layout4.length},
	{options:layout5, numOptions:layout5.length},
	{options:layout6, numOptions:layout6.length},
	{options:layout7, numOptions:layout7.length},
	{options:layout8, numOptions:layout8.length},
	{options:layout9, numOptions:layout9.length},
	{options:layout10, numOptions:layout10.length},
	{options:layout11, numOptions:layout11.length},
	{options:layout12, numOptions:layout12.length},
	{options:layout13, numOptions:layout13.length},
	{options:layout14, numOptions:layout14.length},
	{options:layout15, numOptions:layout15.length},
	{options:layout16, numOptions:layout16.length},
];

function LmiRectangleConstruct(rect, x, y, width, height) {
    rect.x0 = x;
    rect.y0 = y;
    rect.x1 = x+width;
    rect.y1 = y+height;
}

function LmiRectangleDestruct(r) {
    r.x0 = r.y0 = r.x1 = r.y1 = -1;
}

function LmiRectangleGetWidth(r) {           
    return (r.x1 - r.x0); 
}           
        
function LmiRectangleGetHeight(r) {       
    return (r.y1 - r.y0);
}           

function  LmiRectangleResizeToAspectRatio(r, width, height, letterbox) {
    if(width > 0 && height > 0)
    {
        var oldWidth = LmiRectangleGetWidth(r);
        var oldHeight = LmiRectangleGetHeight(r);

        if((oldHeight * width > oldWidth * height) == letterbox)
        {
            /* Fit width */
            var newHeight = (oldWidth * height / width);
            r.y0 = (r.y0 + r.y1 - newHeight) / 2;
            r.y1 = r.y0 + newHeight;
        }
        else
        {
            /* Fit height */
            var newWidth = (oldHeight * width / height);
            r.x0 = (r.x0 + r.x1 - newWidth) / 2; 
            r.x1 = r.x0 + newWidth;
        }
    }
}

function LmiRectangleGetArea(r) {
    return LmiRectangleGetWidth(r) * LmiRectangleGetHeight(r);
}

function LmiRectangleAssign(d, s) {
    for (var k in s) {
        d[k] = s[k];
    }
}

function LmiRectangleGetLeft(r) {
    return r.x0;
}

function LmiRectangleGetTop(r) {
    return r.y0;
}

function LmiRectangleSetMinAndMaxX(r, xMin, xMax) {
    r.x0 = xMin;
    r.x1 = xMax;
}

function LmiRectangleSetMinAndMaxY(r, yMin, yMax) {
    r.y0 = yMin;
    r.y1 = yMax;
}

function LmiRectangleSetMinAndMax(r, xMin, yMin, xMax, yMax) {
    LmiRectangleSetMinAndMaxX(r, xMin, xMax);
    LmiRectangleSetMinAndMaxY(r, yMin, yMax);
}

function LmiLayoutScoreBetter(a, b) {
    if(a.equalSized != b.equalSized)
        return a.equalSized;
    if(a.filled != b.filled)
        return a.filled;
    if(a.size != b.size)
        return a.size > b.size;
    return a.area > b.area;
}


function LmiLayoutHasEqualSizes(wl, numRects, lastPreferred) {
	var firstScrub, lastRect;
	if(lastPreferred > 0 && wl.w[0].s != wl.w[lastPreferred].s)
		return false;
	firstScrub = lastPreferred + 1;
	lastRect = numRects - 1;
	if(firstScrub < lastRect && wl.w[firstScrub].s != wl.w[lastRect].s)
		return false;
	if(firstScrub < numRects && wl.w[lastPreferred].s == wl.w[firstScrub].s)
		return false;

	return true;
}

function LmiLayoutIsLovely(wl, flipped) {
	return flipped ? wl.flipped : wl.lovely;
}


function LmiLayoutMakerGetLayout(numRects, numPreferred, width, height, rects, groupRank) {
	var table = layoutTable[numRects];
	var lastPreferred = (numPreferred >= 1 && numPreferred <= numRects) ? (numPreferred - 1) : (numRects - 1);
    var minVisiblePctX = layoutMaker.minVisiblePctX;
    var minVisiblePctY = layoutMaker.minVisiblePctY;
    var aspectW = layoutMaker.aspectW;
    var aspectH = layoutMaker.aspectH;

	var isFlipped = false;
	var best = {};
	var layout = null;
	var layoutRect = {};
	var layoutFlipped = false;
	var i;

	best.equalSized = false;
	best.filled = false;
	best.size = 0;
	best.area = 0;

	LmiRectangleConstruct(layoutRect, 0, 0, 1, 1); /* dummy init to avoid silly warning */

	/* Find the layout that gives a large rectangle for the last preferred
	participant, but also consider the size of the smallest rectangle. */
	for(i=0; i<table.numOptions; ++i)
	{
		var wl = table.options[i];
		var score = {};
		var f;

		score.equalSized = layoutMaker.equalSizes && LmiLayoutHasEqualSizes(wl, numRects, lastPreferred);

		if(best.equalSized && !score.equalSized)
			continue;

		for(f=0; f<2; ++f)
		{
			var flip = f == 1;
			var layoutAspectW, layoutAspectH;
			var minLayoutAspectW, minLayoutAspectH;
			var maxLayoutAspectW, maxLayoutAspectH;
			var rect = {};
			var r;

			if(layoutMaker.strict && !LmiLayoutIsLovely(wl, flip))
				continue;

			if(isFlipped != flip)
			{
				// LmiUintSwap(&width, &height);
                var t = width;
                width = height;
                height = t;

				// LmiUintSwap(&aspectW, &aspectH);
                t = aspectW;
                aspectW = aspectH;
                aspectH = t;

				// LmiUintSwap(&minVisiblePctX, &minVisiblePctY);
                t = minVisiblePctX;
                minVisiblePctX = minVisiblePctY;
                minVisiblePctY = t;

				isFlipped = flip;
			}

			layoutAspectW = wl.xd * aspectW;
			layoutAspectH = wl.yd * aspectH;
			minLayoutAspectW = minVisiblePctX * layoutAspectW;
			minLayoutAspectH = 100 * layoutAspectH;
			maxLayoutAspectW = 100 * layoutAspectW;
			maxLayoutAspectH = minVisiblePctY * layoutAspectH;

			LmiRectangleConstruct(rect, 0, 0, width, height);

			if(width * minLayoutAspectH < height * minLayoutAspectW)
			{
				LmiRectangleResizeToAspectRatio(rect, minLayoutAspectW, minLayoutAspectH, true);
				score.filled = false;
			}
			else if(width * maxLayoutAspectH > height * maxLayoutAspectW)
			{
				LmiRectangleResizeToAspectRatio(rect, maxLayoutAspectW, maxLayoutAspectH, true);
				score.filled = false;
			}
			else
				score.filled = layoutMaker.fill && wl.full;

			r = wl.w + lastPreferred;
			score.size = (LmiRectangleGetWidth(rect) * r.s / wl.xd) * (LmiRectangleGetHeight(rect) * r.s / wl.yd);

			if(lastPreferred != numRects - 1)
			{
				r = wl.w + (numRects - 1);
				score.size += (LmiRectangleGetWidth(rect) * r.s / wl.xd) * (LmiRectangleGetHeight(rect) * r.s / wl.yd) / 10;
			}

			score.area = LmiRectangleGetArea(rect);

			if(layout == null || LmiLayoutScoreBetter(score, best))
			{
				LmiRectangleAssign(layoutRect, rect);
				layout = wl;
				layoutFlipped = isFlipped;
				best.equalSized = score.equalSized;
				best.filled = score.filled;
				best.size = score.size;
				best.area = score.area;
			}

			LmiRectangleDestruct(rect);
		}
	}

	if(layout == null)
	{
		LmiRectangleDestruct(layoutRect);
		return false;
	}

	for(i=0; i<numRects; ++i)
	{
		var rect = rects[i];
		var r = layout.w[i];

		/* Calculate width and height using both endpoints (instead of just using r->s)
		to avoid gaps between rectangles due to integer roundoff */
		var x0 = Math.floor(LmiRectangleGetLeft(layoutRect) + r.x * LmiRectangleGetWidth(layoutRect) / layout.xd);
		var x1 = Math.floor(LmiRectangleGetLeft(layoutRect) + (r.x + r.s) * LmiRectangleGetWidth(layoutRect) / layout.xd);
		var y0 = Math.floor(LmiRectangleGetTop(layoutRect) + r.y * LmiRectangleGetHeight(layoutRect) / layout.yd);
		var y1 = Math.floor(LmiRectangleGetTop(layoutRect) + (r.y + r.s) * LmiRectangleGetHeight(layoutRect) / layout.yd);

		if(layoutFlipped)
			LmiRectangleSetMinAndMax(rect, y0, x0, y1, x1);
		else
			LmiRectangleSetMinAndMax(rect, x0, y0, x1, y1);
	}

    /**
	if(groupRank != NULL)
	{
		LmiAssert(numRects > 0);
		groupRank[0] = 0;
		for(i=1; i<numRects; ++i)
		{
			if(layout->w[i].s == layout->w[i-1].s)
				groupRank[i] = groupRank[i-1];
			else
				groupRank[i] = groupRank[i-1] + 1;
		}
	}

    **/
	LmiRectangleDestruct(layoutRect);
	return true;
}

function GetLayout(numRects, numPreferred, width, height) {
    var i = 0;
    var rects = [];
    for (i = 0; i < numRects; i++) 
    {
        rects[i] = {};
        LmiRectangleConstruct(rects[i], 0, 0, 0, 0);
    }

    LmiLayoutMakerGetLayout(numRects, numPreferred, width, height, rects, null);

    // add/subtract 2 to get borders around the tiles
    for (i = 0; i < numRects; i++) 
    {
        rects[i].width = LmiRectangleGetWidth(rects[i]) - 2;
        rects[i].height = LmiRectangleGetHeight(rects[i]) - 2;
        rects[i].x = rects[i].x0 + 2;
        rects[i].y = rects[i].y0 + 2;
    }

    return rects;
}


function StopStream (streams, stopAudio, stopVideo) {
    for (var i = 0; i < streams.length; i++) {
        if (!streams[i]) {
            continue;
        }
        var audioTracks = streams[i].getAudioTracks();
        var videoTracks = streams[i].getVideoTracks();

        if (stopAudio) {
            for (var j = 0; j < audioTracks.length; j++) {
                audioTracks[j].stop();
            }
        }

        if (stopVideo) {
            for (var j = 0; j < videoTracks.length; j++) {
                videoTracks[j].stop();
            }
        }
    }
};

function GetTimeForLogging() {
    return new Date().toLocaleTimeString();
};



function VidyoInputDevice(type, startCallback, stopCallback) { // type can be "AUDIO" or "VIDEO"
    var id_ = "";
    var pendingId_ = "";
    var constraints_ = null;
    var logLevel = (VCUtils.params && VCUtils.params.webrtcLogLevel) ? VCUtils.params.webrtcLogLevel : "info";

    function LogInfo (msg) {
        if (logLevel === "info") {
            console.log("" + GetTimeForLogging() + " VidyoDevice[" + type + "]: " + msg);
        }
    };


    function LogErr (msg) {
        if (logLevel === "info" || logLevel === "error") {
            console.error("" + GetTimeForLogging() + " VidyoDevice: " + msg);
        }
    };


    const DEVICE_STATE_IDLE = "DEVICE_IDLE";
    const DEVICE_STATE_STARTING = "DEVICE_STARTING";
    const DEVICE_STATE_STARTED = "DEVICE_STARTED";
    const DEVICE_STATE_STOP_PENDING = "DEVICE_STOP_PENDING"; // while starting/start pending, stop comes
    const DEVICE_STATE_START_PENDING = "DEVICE_START_PENDING"; // while in stop pending, start comes


    /*************************

          IDLE ---------------------
         |    \                    | 
         |     \                   | 
         |      STARTING ------STOP_PENDING
         |      /     |             |
         |     /      |             |
         |    /       |             |
        STARTED       |---------START_PENDING

    **************************/

    var stream_ = null;
    var state_ = DEVICE_STATE_IDLE;

    function noop(currentState, nextState, op) {
        LogInfo("NO-OP [" + op + "] Curr:" + currentState + " Next:" + nextState);
    };

    function startDevice(currentState, nextState, op) {
        if (stream_ !== null) {
            StopStream([stream_], type === "AUDIO", type === "VIDEO");
            stream_ = null; 
        }

        if (type === "VIDEO") {
            constraints_.video.deviceId = id_;
        } else {
            constraints_.audio.deviceId = id_;
        }

        navigator.mediaDevices.getUserMedia(constraints_).
        then(function(str) {
            stream_ = str;
            InvokeStateMachine("deviceStarted");
            // startCallback(str);
        }).
        catch(function(err) {
            LogErr("Start device " + id_ + " failed " + err.name + " " + JSON.stringify(err));
            InvokeStateMachine("deviceStarted"); // Will trigger startCallback with null to indicate start failure
            InvokeStateMachine("stop");
        });
    };

    function stopDevice(currentState, nextState, op) {
        id_ = "";
        if (stream_ !== null) {
            StopStream([stream_], type === "AUDIO", type === "VIDEO");
            stream_ = null;
            stopCallback();
        }
    };

    function restartDevice(currentState, nextState, op) {
        LogInfo("restartDevice id=" + id_ + " pending=" + pendingId_);
        if (id_.length > 0 && pendingId_.length > 0 && id_ != pendingId_) {
            id_ = pendingId_;
            pendingId_ = "";
            startDevice();
        } else {
            InvokeStateMachine("deviceStarted");
        }
    };

    function deviceStarted(currentState, nextState, op) {
        startCallback(stream_);
    };

    const stateMachine_ = {
        "DEVICE_IDLE" : {
            start: {
                nextState: DEVICE_STATE_STARTING,
                operation: startDevice
            },
            stop: {
                nextState: DEVICE_STATE_IDLE,
                operation: noop
            },
            deviceStarted: {
                nextState: DEVICE_STATE_IDLE,
                operation: noop
            }
        },

        "DEVICE_STARTING" : {
            start: {
                nextState: DEVICE_STATE_STARTING,
                operation: noop
            },
            stop: {
                nextState: DEVICE_STATE_STOP_PENDING,
                operation: noop
            },
            deviceStarted: {
                nextState: DEVICE_STATE_STARTED,
                operation: deviceStarted
            }
        },

        "DEVICE_STARTED" : {
            start: {
                nextState: DEVICE_STATE_STARTED,
                operation: noop
            },
            stop: {
                nextState: DEVICE_STATE_IDLE,
                operation: stopDevice
            },
            deviceStarted: {
                nextState: DEVICE_STATE_STARTED,
                operation: noop
            }
        },

        "DEVICE_STOP_PENDING" : {
            start: {
                nextState: DEVICE_STATE_START_PENDING,
                operation: noop
            },
            stop: {
                nextState: DEVICE_STATE_STOP_PENDING,
                operation: noop
            },
            deviceStarted: {
                nextState: DEVICE_STATE_IDLE,
                operation: stopDevice
            },
        },

        "DEVICE_START_PENDING" : {
            start: {
                nextState: DEVICE_STATE_START_PENDING,
                operation: noop
            },
            stop: {
                nextState: DEVICE_STATE_STOP_PENDING,
                operation: noop
            },
            deviceStarted: {
                nextState: DEVICE_STATE_STARTING,
                operation: restartDevice
            }
        },
    };

    function InvokeStateMachine(op) {
        var prevState = state_;
        var fn = stateMachine_[state_][op].operation;
        state_ = stateMachine_[state_][op].nextState;
        LogInfo("SM: Curr=" + prevState + " Next=" + state_ + " Op=" + op);
        fn(prevState, state_, op);
    };


    this.StartDevice = function(id, constraints) {
        if (id_.length <= 0) {
            id_ = id;
        } else {
            pendingId_ = id;
        }
        constraints_ = constraints;
        LogInfo("StartDevice id=" + id + "id_=" + id_ + " constraints=" + JSON.stringify(constraints));
        InvokeStateMachine("start");
    };

    this.StopDevice = function(id) {
        LogInfo("StopDevice id=" + id);
        InvokeStateMachine("stop");
    };

    this.SetDevice = function(id, constraints) {
        id_ = id;
        constraints_ = constraints;
        LogInfo("SetDevice id=" + id + " constraints=" + JSON.stringify(constraints));
    };

    this.StartPendingDevice = function() {
        LogInfo("StartPendingDevice id=*" + id_ + "*");
        if (id_ && id_.length > 0) {
            InvokeStateMachine("start");
        }
    };

    this.DeviceRemoved = function(id) {
        LogInfo("DeviceRemoved id=*" + id + "* *" + id_ + "*");
        if (id_ === id) { 
            InvokeStateMachine("stop");
        }
    };

    this.GetState = function() {
        return {
            id: stream_ ? stream_.id : null,
            state: state_
        };
    };

    this.SetStream = function(s) {
        if (state_ !== DEVICE_STATE_IDLE) {
            LogErr("SetStream in invalid state " + state_);
            return;
        }
        stream_ = s;
        state_ = DEVICE_STATE_STARTED;
    };

    this.DiffState = function(oldState) {

        var id = stream_ ? stream_.id : null;
        if (oldState.id !== id) {
            if (oldState.id === null) {
                return "started";
            } else if (id === null) {
                return "stopped";
            } else {
                return "restarted";
            }
        }
        return "nochange";
    };

    this.GetStreamAndTrack = function () {
        if (stream_ === null) {
            return {
                stream: null,
                track: null
            };
        }
        
        var track;

        if (type === "VIDEO") {
            track = stream_.getVideoTracks()[0];
        } else {
            track = stream_.getAudioTracks()[0];
        } 
        return {
            stream: stream_,
            track: track
        };
    };

    this.IsStarting = function() {
        return state_ === DEVICE_STATE_STARTING || state_ === DEVICE_STATE_START_PENDING;
    };

};


function VidyoClientWebRTCStats(t, LogInfo, LogErr) {

    const STATS_INTERVAL = 5000; // 5 seconds;
    const SHARE_VIDEO_INDEX = 0;
    const MAIN_VIDEO_INDEX = 1;

    var peerConnectionStats_ = {};
    var peerConnection_ = null;
    var localSharePeerConnection_ = null;
    var transport_ = t;

    var maxAudio_ = 4;
    var maxVideo_ = 9;

    function InitializeStats() {
        peerConnectionStats_ = {
            timestamp: Date.now(),
            availableTxBw: 0,
            availableRxBw: 0,
            audioTxSsrc: "",
            audioTxBytes: 0,
            audioTxBitrate: 0,
            videoTxSsrc: ["", ""],
            videoTxBytes: [0, 0],
            videoTxBitrate: [0, 0],
            videoTxFramerate: [0, 0],
            videoTxFirsReceived: [0, 0],
            videoTxNacksReceived: [0, 0],
            videoTxRtt: [0, 0],
            audioRxBytes: [],
            audioRxBitrate: [],
            audioRxJitterBufferSize: [],
            audioRxPacketsLost: [],
            videoRxBytes: [],
            videoRxBitrate: [],
            videoRxPacketsLost: [],
            videoRxFramerate: [],
            videoRxJitterBufferSize: [],
            videoRxNacksSent: [],
            videoRxFirsSent: [],
        };

        for (var i = 0; i < maxAudio_; i++) {
            peerConnectionStats_.audioRxBytes.push(0);
            peerConnectionStats_.audioRxBitrate.push(0);
            peerConnectionStats_.audioRxJitterBufferSize.push(0);
            peerConnectionStats_.audioRxPacketsLost.push(0);
        }
        for (var i = 0; i < maxVideo_; i++) {
            peerConnectionStats_.videoRxBytes.push(0);
            peerConnectionStats_.videoRxBitrate.push(0);
            peerConnectionStats_.videoRxPacketsLost.push(0);
            peerConnectionStats_.videoRxFramerate.push(0);
            peerConnectionStats_.videoRxJitterBufferSize.push(0);
            peerConnectionStats_.videoRxNacksSent.push(0);
            peerConnectionStats_.videoRxFirsSent.push(0);
        }
    };

    function GetBitRate (b1, b2, t) {
        var bits = (b1 - b2) << 3; // Multiply by 8 to convert to bits as b1,b2 are bytes
        return (bits < 0) ? 0 : (Math.floor(bits*1000/t)); // bits / t/1000 since t is in milliseconds
    };

    function ResetVideoTxStats(index) {
        peerConnectionStats_.videoTxBytes[index] = 0;
        peerConnectionStats_.videoTxBitrate[index] = 0;
        peerConnectionStats_.videoTxFramerate[index] = 0;
        peerConnectionStats_.videoTxFirsReceived[index] = 0;
        peerConnectionStats_.videoTxNacksReceived[index] = 0;
    };

    function ResetAudioTxStats() {
        peerConnectionStats_.audioTxBytes = 0;
        peerConnectionStats_.audioTxBitrate = 0; 
    };

    function SetChromeTxStats(stats, timediff, index) {
        var audioTxKey = "";
        var videoTxKey = "";
        var bytes = 0;

        var CheckSsrcInSdp = function(k, index) {
            var ssrc = k.replace("ssrc_", "").replace("_send", "");

            if (index === MAIN_VIDEO_INDEX  && peerConnection_.localDescription.sdp.indexOf(ssrc) !== -1) {
                return ssrc;
            } else if (index === SHARE_VIDEO_INDEX && localSharePeerConnection_ && localSharePeerConnection_.localDescription.sdp.indexOf(ssrc) !== -1) {
                return ssrc;
            }
            return "";
        };

        for (var k in stats) {
            if (k.indexOf("_send") !== -1) {
                var ssrc = CheckSsrcInSdp(k, index);

                if (ssrc.length <= 0) {
                    continue;
                }
                if (stats[k].mediaType == "video") {
                    videoTxKey = k;
                    if (peerConnectionStats_.videoTxSsrc[index] !== ssrc) {
                        peerConnectionStats_.videoTxSsrc[index] = ssrc;
                        ResetVideoTxStats(index);
                    }
                } else if (stats[k].mediaType == "audio") {
                    audioTxKey = k
                    if (peerConnectionStats_.audioTxSsrc !== ssrc) {
                        peerConnectionStats_.audioTxSsrc = ssrc;
                        ResetAudioTxStats();
                    }
                } else {
                    LogErr("Unknown send stats[" + k + "]: " + JSON.stringify(stats[k]));
                }
            }
        }

        if (audioTxKey.length > 0) {
            bytes = parseInt(stats[audioTxKey].bytesSent, 10);
            peerConnectionStats_.audioTxBitrate = GetBitRate(bytes, peerConnectionStats_.audioTxBytes, timediff);
            peerConnectionStats_.audioTxBytes = bytes;
        } else {
            ResetAudioTxStats();
        }

        if (videoTxKey.length > 0) {
            bytes = parseInt(stats[videoTxKey].bytesSent, 10);
            peerConnectionStats_.videoTxBitrate[index] = GetBitRate(bytes, peerConnectionStats_.videoTxBytes[index], timediff);
            peerConnectionStats_.videoTxBytes[index] = bytes;
            peerConnectionStats_.videoTxFramerate[index] = parseInt(stats[videoTxKey].googFrameRateSent, 10);
            peerConnectionStats_.videoTxFirsReceived[index] = parseInt(stats[videoTxKey].googFirsReceived, 10) + parseInt(stats[videoTxKey].googPlisReceived, 10);
            peerConnectionStats_.videoTxNacksReceived[index] = parseInt(stats[videoTxKey].googNacksReceived, 10);
            peerConnectionStats_.videoTxRtt[index] = parseInt(stats[videoTxKey].googRtt, 10);
        } else {
            ResetVideoTxStats(index);
        }
    };

    function GetChromeShareStats(timediff, callback) {
        if (!localSharePeerConnection_) {
            ResetVideoTxStats(SHARE_VIDEO_INDEX);
            callback(true);
            return;
        }

        localSharePeerConnection_.getStats(null, function(stats) {
            SetChromeTxStats(stats, timediff, SHARE_VIDEO_INDEX);
            callback(true);
        }, function(err) {
            LogErr("SharePeerConnection GetStats err " + err);
            callback(true);
        });
    };

    function GetChromeStats(callback) {

        peerConnection_.getStats(null, function(stats) {
            var timestamp = Date.now();
            var timediff = peerConnectionStats_.timestamp > 0 ? timestamp - peerConnectionStats_.timestamp : STATS_INTERVAL;
            peerConnectionStats_.timestamp = timestamp;
            peerConnectionStats_.interval = timediff;

            var bytes = 0;

            SetChromeTxStats(stats, timediff, MAIN_VIDEO_INDEX);

            if (stats.bweforvideo) {
                peerConnectionStats_.availableTxBw = parseInt(stats.bweforvideo.googAvailableSendBandwidth, 10);
                peerConnectionStats_.availableRxBw = parseInt(stats.bweforvideo.googAvailableReceiveBandwidth, 10);
            }
            
            for (var i = 1; i <= maxAudio_; i++) {
                var audioRxKey = "ssrc_1000" + i + "_recv";
                if (stats[audioRxKey]) {
                    bytes = parseInt(stats[audioRxKey].bytesReceived, 10);
                    peerConnectionStats_.audioRxBitrate[i] = GetBitRate(bytes, peerConnectionStats_.audioRxBytes[i], timediff);
                    peerConnectionStats_.audioRxBytes[i] = bytes;
                    peerConnectionStats_.audioRxJitterBufferSize[i] = parseInt(stats[audioRxKey].googJitterBufferMs, 10);
                    peerConnectionStats_.audioRxPacketsLost[i] = parseInt(stats[audioRxKey].packetsLost, 10);
                }
            }
            for (var i = 0; i < maxVideo_; i++) {
                var videoRxKey = "ssrc_5000" + i + "_recv";
                if (stats[videoRxKey]) {
                    bytes = parseInt(stats[videoRxKey].bytesReceived, 10);
                    peerConnectionStats_.videoRxBitrate[i] = GetBitRate(bytes, peerConnectionStats_.videoRxBytes[i], timediff);
                    peerConnectionStats_.videoRxBytes[i] = bytes;
                    peerConnectionStats_.videoRxPacketsLost[i] = parseInt(stats[videoRxKey].packetsLost, 10);
                    peerConnectionStats_.videoRxFramerate[i] = parseInt(stats[videoRxKey].googFrameRateOutput, 10);
                    peerConnectionStats_.videoRxJitterBufferSize[i] = parseInt(stats[videoRxKey].googJitterBufferMs, 10);
                    peerConnectionStats_.videoRxNacksSent[i] = parseInt(stats[videoRxKey].googNacksSent, 10);
                    peerConnectionStats_.videoRxFirsSent[i] = parseInt(stats[videoRxKey].googFirsSent, 10) + parseInt(stats[videoRxKey].googPlisSent, 10);
                }
            }
            GetChromeShareStats(timediff, callback);
        }, function(err) {
            LogErr("PeerConnection GetStats err " + err);
            callback(false);
        });
    };

    function SetFirefoxTxStats(stats, timediff, index) {
        var audioTxKey = "";
        var videoTxKey = "";
        var bytes = 0;

        var CheckSsrcInSdp = function(ssrc, index) {

            if (index === MAIN_VIDEO_INDEX  && peerConnection_.localDescription.sdp.indexOf(ssrc) !== -1) {
                return ssrc;
            } else if (index === SHARE_VIDEO_INDEX && localSharePeerConnection_ && localSharePeerConnection_.localDescription.sdp.indexOf(ssrc) !== -1) {
                return ssrc;
            }
            return "";
        };

        stats.forEach(function(k) {
            if (k.id.indexOf("outbound_rtp") !== -1) {
                var ssrc = CheckSsrcInSdp(k.ssrc, index);
                if (ssrc.length <= 0) {
                    return;
                }
                if (k.mediaType == "video") {
                    videoTxKey = k.id;
                    if (peerConnectionStats_.videoTxSsrc[index] !== ssrc) {
                        peerConnectionStats_.videoTxSsrc[index] = ssrc;
                        ResetVideoTxStats(index);
                    }
                } else if (k.mediaType == "audio") {
                    audioTxKey = k.id;
                    if (peerConnectionStats_.audioTxSsrc !== ssrc) {
                        peerConnectionStats_.audioTxSsrc = ssrc;
                        ResetAudioTxStats();
                    }
                } else {
                    LogErr("Unknown send stats[" + k + "]: " + JSON.stringify(stats[k]));
                }
            }
        });

        if (audioTxKey.length > 0) {
            var audioStats = stats.get(audioTxKey);
            bytes = audioStats.bytesSent;
            peerConnectionStats_.audioTxBitrate = GetBitRate(bytes, peerConnectionStats_.audioTxBytes, timediff);
            peerConnectionStats_.audioTxBytes = bytes;
        } else {
            ResetAudioTxStats();
        }

        if (videoTxKey.length > 0) {
            var videoStats = stats.get(videoTxKey);
            bytes = videoStats.bytesSent;
            peerConnectionStats_.videoTxBitrate[index] = GetBitRate(bytes, peerConnectionStats_.videoTxBytes[index], timediff);
            peerConnectionStats_.videoTxBytes[index] = bytes;
            peerConnectionStats_.videoTxFramerate[index] = Math.floor(videoStats.framerateMean);
        } else {
            ResetVideoTxStats(index);
        }
    };

    function GetFirefoxShareStats(timediff, callback) {
        if (!localSharePeerConnection_) {
            ResetVideoTxStats(SHARE_VIDEO_INDEX);
            callback(true);
            return;
        }

        localSharePeerConnection_.getStats(null).then(function(stats) {
            SetFirefoxTxStats(stats, timediff, SHARE_VIDEO_INDEX);
            callback(true);
        }).catch(function(err) {
            LogErr("SharePeerConnection GetStats err " + err);
            callback(true);
        });
    };

    function GetFirefoxStats(callback) {
        peerConnection_.getStats(null).then(function(stats) {
            var timestamp = Date.now();
            var timediff = peerConnectionStats_.timestamp > 0 ? timestamp - peerConnectionStats_.timestamp : STATS_INTERVAL;
            peerConnectionStats_.timestamp = timestamp;
            peerConnectionStats_.interval = timediff;

            var bytes = 0;

            SetFirefoxTxStats(stats, timediff, MAIN_VIDEO_INDEX);

            for (var i = 0; i < maxAudio_; i++) {
                var audioRxKey = "inbound_rtp_audio_" + i; 
                var audioStats = stats.get(audioRxKey);
                if (audioStats) {
                    bytes = audioStats.bytesReceived;
                    peerConnectionStats_.audioRxBitrate[i] = GetBitRate(bytes, peerConnectionStats_.audioRxBytes[i], timediff);
                    peerConnectionStats_.audioRxBytes[i] = bytes;
                    peerConnectionStats_.audioRxJitterBufferSize[i] = Math.floor(audioStats.jitter);
                    peerConnectionStats_.audioRxPacketsLost[i] = audioStats.packetsLost;
                }
            }

            for (var i = 0; i < maxVideo_; i++) {
                var videoRxKey = "inbound_rtp_video_" + (i + maxAudio_);
                var videoStats = stats.get(videoRxKey);
                if (videoStats) {
                    bytes = videoStats.bytesReceived;
                    peerConnectionStats_.videoRxBitrate[i] = GetBitRate(bytes, peerConnectionStats_.videoRxBytes[i], timediff);
                    peerConnectionStats_.videoRxBytes[i] = bytes;
                    peerConnectionStats_.videoRxPacketsLost[i] = videoStats.packetsLost;
                    peerConnectionStats_.videoRxFramerate[i] = Math.floor(videoStats.framerateMean);
                    peerConnectionStats_.videoRxJitterBufferSize[i] = Math.floor(videoStats.jitter);
                }
            }
            GetFirefoxShareStats(timediff, callback);
        }).catch(function(err) {
            LogErr("PeerConnection GetStats Err " + err);
            callback(false);
        });
    };

    function SendPeriodicStats() {
        if (!peerConnection_) {
            return;
        }

        var SendStats = function(status) {
            if (status) {
                var stats = JSON.parse(JSON.stringify(peerConnectionStats_));

                delete stats.timestamp;
                delete stats.audioTxSsrc;
                delete stats.audioTxBytes;
                delete stats.videoTxSsrc;
                delete stats.videoTxBytes;
                delete stats.audioRxBytes;
                delete stats.videoRxBytes;
 

                var statsMsg = {
                    method: "VidyoWebRTCStats",
                    stats: stats 
                };

                transport_.SendWebRTCMessage(statsMsg, function() {
                    setTimeout(SendPeriodicStats, STATS_INTERVAL);
                });
            } else {
                LogErr("GetStats failed");
            }
        };

        if (window.adapter.browserDetails.browser === "chrome") {
            GetChromeStats(SendStats);
        } else if (window.adapter.browserDetails.browser === "firefox") {
            GetFirefoxStats(SendStats);
        }
    };

    this.Start = function(pc, maxAudio, maxVideo) {
        peerConnection_ = pc;
        maxAudio_ = maxAudio;
        maxVideo_ = maxVideo;
        InitializeStats();
        setTimeout(SendPeriodicStats, STATS_INTERVAL);
    };

    this.Stop = function() {
        peerConnection_ = null;
        localSharePeerConnection_ = null;
    };

    this.SetSharePeerConnection = function(pc) {
        localSharePeerConnection_ = pc;
    };
};


const RENDERER_TYPE_COMPOSITE = "composite";
const RENDERER_TYPE_TILES = "tiles";

const STREAM_TYPE_PREVIEW = "preview";
const STREAM_TYPE_VIDEO = "video";
const STREAM_TYPE_SHARE = "share";


function VidyoClientWebRTC(t) {

    var transport_ = t;

    var layoutEngine_ = {};
    var rendererType = RENDERER_TYPE_COMPOSITE;

    const PREVIEW_SOURCE_ID = "preview-source-id";

    const maxShareResolution_ = "1080p";
    const maxShareFrameRate_ = 10;

    var devices_ = null;
    var deviceStorage_ = null;
    var offer_ = null;
    var streamMapping_ = {};
    var micStream_ = null;
    var videoStreams_ = [null];
    var maxResolution_ = "360p";
    var maxSubscriptions_ = 8;
    var startCallData_ = null;

    var localShareId_ = -1;
    var pendingRequestId_ = -1;
    var shareSelectedCallback_ = null;

    var localSharePeerConnection_ = null;
    var localShareStream_ = [];
    var localShareElement_ = null;
    var localShareOffer_ = null;
    var iceCandidateTimeout_ = null;
    var previousWindowSizes_ = { windows: []};

    const CALLSTATE_IDLE = "IDLE";
    const CALLSTATE_WAITING_FOR_DEVICES = "WAITING_FOR_DEVICES";
    const CALLSTATE_GETTING_OFFER = "GETTING_OFFER";
    const CALLSTATE_WAITING_FOR_ANSWER = "WAITING_FOR_ANSWER";
    const CALLSTATE_CONNECTING = "CONNECTING";
    const CALLSTATE_CONNECTED = "CONNECTED";
    const CALLSTATE_DISCONNECTING = "DISCONNECTING";
    const CALLSTATE_RENEGOTIATE_PENDING = "RENEGOTIATE_PENDING";

    var callState_ = CALLSTATE_IDLE;
    const stateMachine_ = {
        "IDLE": {
            startCall: {
                nextState: CALLSTATE_WAITING_FOR_DEVICES,
                operation: CheckForDevices,
            },
            gotOffer: {
                nextState: CALLSTATE_IDLE,
                operation: noop
            },
            gotAnswer: {
                nextState: CALLSTATE_IDLE,
                operation: noop
            },
            signalingStable: {
                nextState: CALLSTATE_IDLE,
                operation: noop
            },
            stopCall : {
                nextState: CALLSTATE_IDLE,
                operation: noop
            },
            deviceStateChanged: {
                nextState: CALLSTATE_IDLE,
                operation: noop
            },
        },

        "WAITING_FOR_DEVICES": {
            startCall: {
                nextState: CALLSTATE_GETTING_OFFER,
                operation: HandleStartCall
            },
            gotOffer: {
                nextState: CALLSTATE_WAITING_FOR_DEVICES,
                operation: noop
            },
            gotAnswer: {
                nextState: CALLSTATE_WAITING_FOR_DEVICES,
                operation: noop
            },
            signalingStable: {
                nextState: CALLSTATE_WAITING_FOR_DEVICES,
                operation: noop
            },
            stopCall : {
                nextState: CALLSTATE_DISCONNECTING,
                operation: noop
            },
            deviceStateChanged: {
                nextState: CALLSTATE_WAITING_FOR_DEVICES,
                operation: CheckForDevices
            },
        },

        "GETTING_OFFER" : {
            startCall: {
                nextState: CALLSTATE_GETTING_OFFER,
                operation: noop
            },
            gotOffer: {
                nextState: CALLSTATE_WAITING_FOR_ANSWER,
                operation: SendLocalOffer
            },
            gotAnswer: {
                nextState: CALLSTATE_IDLE,
                operation: noop
            },
            signalingStable: {
                nextState: CALLSTATE_GETTING_OFFER,
                operation: noop
            },
            stopCall : {
                nextState: CALLSTATE_IDLE,
                operation: HandleStopCall
            },
            deviceStateChanged: {
                nextState: CALLSTATE_RENEGOTIATE_PENDING,
                operation: noop
            },
        },
    
        "WAITING_FOR_ANSWER" : {
            startCall: {
                nextState: CALLSTATE_WAITING_FOR_ANSWER,
                operation: noop
            },
            gotOffer: {
                nextState: CALLSTATE_WAITING_FOR_ANSWER,
                operation: noop
            },
            gotAnswer: {
                nextState: CALLSTATE_CONNECTING,
                operation: HandleAnswerSdp
            },
            signalingStable: {
                nextState: CALLSTATE_WAITING_FOR_ANSWER,
                operation: noop
            },
            stopCall : {
                nextState: CALLSTATE_IDLE,
                operation: HandleStopCall
            },
            deviceStateChanged: {
                nextState: CALLSTATE_RENEGOTIATE_PENDING,
                operation: noop
            },
        },

        "CONNECTING" : {
            startCall: {
                nextState: CALLSTATE_CONNECTING,
                operation: noop
            },
            gotOffer: {
                nextState: CALLSTATE_CONNECTING,
                operation: noop
            },
            gotAnswer: {
                nextState: CALLSTATE_CONNECTING,
                operation: noop
            },
            signalingStable: {
                nextState: CALLSTATE_CONNECTED,
                operation: noop
            },
            stopCall : {
                nextState: CALLSTATE_IDLE,
                operation: HandleStopCall
            },
            deviceStateChanged: {
                nextState: CALLSTATE_RENEGOTIATE_PENDING,
                operation: noop
            },
        },


        "CONNECTED" : {
            startCall: {
                nextState: CALLSTATE_CONNECTED,
                operation: noop
            },
            gotOffer: {
                nextState: CALLSTATE_CONNECTED,
                operation: noop
            },
            gotAnswer: {
                nextState: CALLSTATE_CONNECTED,
                operation: noop
            },
            signalingStable: {
                nextState: CALLSTATE_CONNECTED,
                operation: noop
            },
            stopCall : {
                nextState: CALLSTATE_IDLE,
                operation: HandleStopCall
            },
            deviceStateChanged: {
                nextState: CALLSTATE_GETTING_OFFER,
                operation: AddRemoveStreams
            },
        },

        "DISCONNECTING": {
            startCall: {
                nextState: CALLSTATE_IDLE,
                operation: HandleStopCall
            },
            gotOffer: {
                nextState: CALLSTATE_IDLE,
                operation: HandleStopCall
            },
            gotAnswer: {
                nextState: CALLSTATE_IDLE,
                operation: HandleStopCall
            },
            signalingStable: {
                nextState: CALLSTATE_IDLE,
                operation: HandleStopCall
            },
            stopCall : {
                nextState: CALLSTATE_IDLE,
                operation: HandleStopCall
            },
            deviceStateChanged: {
                nextState: CALLSTATE_IDLE,
                operation: HandleStopCall
            },
        },

        "RENEGOTIATE_PENDING": {
            startCall: {
                nextState: CALLSTATE_RENEGOTIATE_PENDING,
                operation: noop
            },
            gotOffer: {
                nextState: CALLSTATE_RENEGOTIATE_PENDING,
                operation: SendLocalOffer
            },
            gotAnswer: {
                nextState: CALLSTATE_RENEGOTIATE_PENDING,
                operation: HandleAnswerSdp,
            },
            signalingStable: {
                nextState: CALLSTATE_GETTING_OFFER,
                operation: AddRemoveStreams,
            },
            stopCall : {
                nextState: CALLSTATE_IDLE,
                operation: HandleStopCall
            },
            deviceStateChanged: {
                nextState: CALLSTATE_RENEGOTIATE_PENDING,
                operation: noop
            },
        }
    };

    function noop(currentState, nextState, op) {
        LogInfo("NO-OP [" + op + "] Curr:" + currentState + " Next:" + nextState);
    };

    function InvokeStateMachine(op, data) {
        var prevState = callState_;
        var fn = stateMachine_[prevState][op].operation;
        callState_ = stateMachine_[prevState][op].nextState;
        LogInfo("SM: Curr=" + prevState + " Next=" + callState_ + " Op=" + op);
        fn(prevState, callState_, op, data);
    };


    const resolutionMap_ = {
        "180p" : { w: 320,  h: 180,   br: "256"},
        "240p" : { w: 426,  h: 240,   br: "384"},
        "270p" : { w: 480,  h: 270,   br: "448"},
        "360p" : { w: 640,  h: 360,   br: "512"},
        "480p" : { w: 854,  h: 480,   br: "768"},
        "540p" : { w: 960,  h: 540,   br: "1024"},
        "720p" : { w: 1280, h: 720,   br: "1536"},
        "1080p": { w: 1920, h: 1080,  br: "2048"},
    };


    var peerConnectionConstraints_ = {
        iceServers: []
    };

    function CameraStarted(stream) {
        LogInfo("CameraStarted stream=" + (stream ? stream.id : null));
        if (window.adapter.browserDetails.browser === "chrome") {
        } else {
            mic_.StartPendingDevice();
        }
        videoStreams_[0] = stream;
        CreateSourceIdEntryInStreamMappingAndAttachVideo({sourceId: PREVIEW_SOURCE_ID, streamId: 0, attached: false, type: STREAM_TYPE_PREVIEW, name: "Preview"});
        if (stream !== null) {
            InvokeStateMachine("deviceStateChanged");
        }
    };

    function CameraStopped() {
        LogInfo("CameraStopped");
        InvokeStateMachine("deviceStateChanged");
    }

    function MicStarted(stream) {
        LogInfo("MicrophoneStarted stream=" + (stream ? stream.id : null));
        if (stream !== null) {
            InvokeStateMachine("deviceStateChanged");
        }
    };

    function MicStopped() {
        LogInfo("MicrophoneStopped");
        InvokeStateMachine("deviceStateChanged");
    };

    var peerConnection_ = null;
    var peerConnectionStats_ = new VidyoClientWebRTCStats(transport_, LogInfo, LogErr);

    var camera_ = new VidyoInputDevice("VIDEO", CameraStarted, CameraStopped);
    var mic_ = new VidyoInputDevice("AUDIO", MicStarted, MicStopped);

    var cameraState_ = null;
    var micState_ = null;

    const MAX_REMOTE_AUDIO_STREAMS = 4;
    var remoteAudio_ = []; 
    var currentAudioIndex_ = 0;
    for (var r = 0; r < MAX_REMOTE_AUDIO_STREAMS; r++) {
        remoteAudio_[r] = document.createElement("audio");
        remoteAudio_[r].autoplay = true;
    };

    var logLevel = (VCUtils.params && VCUtils.params.webrtcLogLevel) ? VCUtils.params.webrtcLogLevel : "info";

    function LogInfo (msg) {
        if (logLevel === "info") {
            console.log("" + GetTimeForLogging() + " VidyoWebRTC: " + msg);
        }
    };


    function LogErr (msg) {
        if (logLevel === "info" || logLevel === "error") {
            console.error("" + GetTimeForLogging() + " VidyoWebRTC: " + msg);
        }
    };

    function AttachVideo(sourceId) {
        if (streamMapping_.hasOwnProperty(sourceId) && 
            streamMapping_[sourceId].hasOwnProperty("elemId") &&
            streamMapping_[sourceId].hasOwnProperty("streamId") &&
            !streamMapping_[sourceId].attached) { 

            var elemId = streamMapping_[sourceId]["elemId"];

            if (!layoutEngine_.hasOwnProperty(elemId)) {
                LogErr("Invalid view id - no layout engine found for " + elemId + " contains: " + JSON.stringify(Object.keys(layoutEngine_), null, 2));
                return;
            }


            var streamId = streamMapping_[sourceId]["streamId"];
            var videoElement = layoutEngine_[elemId].getVideoElement(streamMapping_[sourceId].type,  streamId);

            if (videoElement && videoStreams_[streamId]) {
                streamMapping_[sourceId].attached = true;
                var videoStream = videoStreams_[streamId];
                videoElement.srcObject = videoStream;
                videoElement.dataset.streamId = videoStream.id;
                LogInfo("AttachVideo: elem=" + elemId + " source=" + sourceId + " streamId=" + streamId);
                layoutEngine_[elemId].show(streamMapping_[sourceId].type,  streamId, streamMapping_[sourceId].name);
            }
        }
    };


    function CreateSourceIdEntryInStreamMappingAndAttachVideo(stream) {
        var sourceId = stream.sourceId;
        if (!streamMapping_.hasOwnProperty(sourceId)) {
            streamMapping_[sourceId] = {
                attached: false
            }
        }

        for (var k in stream) {
            streamMapping_[sourceId][k] = stream[k];
        }

        AttachVideo(sourceId);
    };

    function GetDevicesPostGetUserMedia(cb) {
        navigator.mediaDevices.getUserMedia({audio: true, video: true}).
        then(function(stream) {
            GetDevices(false, function(devices) {
                StopStream([stream], true, true);
                cb(true, devices);
            });
        }).
        catch(function(err) {
            LogErr("getUserMediaFailed " + err.name + " - " + JSON.stringify(err));
            console.log(err);
            cb(false, []);
        });
    };

    function GetDevices (doGetUserMedia, cb) {
        navigator.mediaDevices.enumerateDevices().
        then(function(devs) {
            var devices = [];
            var labels = 0;
            for (var k = 0; k <devs.length; k++) {
                var d = devs[k];
                devices.push({
                    deviceId: d.deviceId,
                    groupId: d.groupId,
                    kind: d.kind,
                    label: d.label
                });

                if (d.label.length > 0) {
                    labels++; 
                }
            }

            // NEPWEB-484 There is a bug in firefox when device enumeration is called with an active stream and a new mic is plugged in
            // There are devices that come with an empty label
            if (labels) {
                if (devices.length !== labels) { 
                    // LogInfo("Empty labels in device enumeration, filtering " + (devices.length - labels) + " devices");
                    var devicesWithLabels = devices.filter(function(d) { return d.label.length > 0; });
                    cb(devicesWithLabels);
                    SaveDevicesToLocalStorage(devicesWithLabels);
                } else {
                    cb(devices);
                    SaveDevicesToLocalStorage(devices);
                }
            } else {
                if (UpdateDeviceLabels(devices)) {  // If local storage has all the necessary devices
                    cb(devices);
                } else if (doGetUserMedia) {
                    GetDevicesPostGetUserMedia(function(status, devices2) {
                        if (status) {
                            cb(devices2);
                        } else {
                            cb(devices);
                        }
                    }); 
                } else {
                    cb(devices);
                }
            }
        }).
        catch(function(err) {
            LogErr("enumerateDevices failed: " + JSON.stringify(err));
            console.log(err);
            cb([]);
        });
    };

    function DiffDevices(oldDevices, newDevices) {
        var getDeviceIds = function(d) {
            return d.deviceId;
        };

        var oldDeviceIds = oldDevices.map(getDeviceIds);
        var newDeviceIds = newDevices.map(getDeviceIds);

        var addedDevices = newDevices.filter(function(d) {
            return oldDeviceIds.indexOf(d.deviceId) === -1;
        });

        var removedDevices = oldDevices.filter(function(d) {
            return newDeviceIds.indexOf(d.deviceId) === -1;
        });

        return {
            added: addedDevices,
            removed: removedDevices
        };

    };

    function SaveDevicesToLocalStorage(devices) {
        if (window.adapter.browserDetails.browser === "chrome") {
            return;
        } 

        if (deviceStorage_ === null) {
            try {
                deviceStorage_ = window.localStorage;
            } catch(err) {
                LogInfo("LocalStorage disabled !! " + err);
                deviceStorage_ = {};
            };
        }

        var devs = [];
        if (deviceStorage_.hasOwnProperty("devices")) {
            devs = JSON.parse(deviceStorage_.devices);
        }

        var newDevices = DiffDevices(devs, devices).added;

        if (newDevices.length > 0) {
            for (var n = 0; n < newDevices.length; n++) {
                LogInfo("Pushing new device to storage " + JSON.stringify(newDevices[n], 2, null));
                devs.push({
                    deviceId: newDevices[n].deviceId,
                    label: newDevices[n].label,
                    kind: newDevices[n].kind
                });
            }

            deviceStorage_.devices = JSON.stringify(devs);
            LogInfo("Stored devices: " + JSON.stringify(devs));
        }
    };

    // Updates the labels from the devices in localStorage
    // Returns false if the device was not found in localStorage
    function UpdateDeviceLabels(devices) {
        if (window.adapter.browserDetails.browser === "chrome") {
            return false;
        } 

        if (!deviceStorage_.hasOwnProperty("devices")) {
            return false;
        }

        var oldDevices = JSON.parse(deviceStorage_.devices);

        var GetDeviceLabel = function(dev) {
            for (var o = 0; o < oldDevices.length; o++) {
                if (oldDevices[o].deviceId === dev.deviceId) {
                    return oldDevices[o].label;
                }
            }
            return "";
        };

        for (var i = 0; i < devices.length; i++) {
            var label = GetDeviceLabel(devices[i]);
            if (label.length <= 0) {
                LogInfo("NO LABEL FOR " + devices[i].deviceId);
                return false;
            } 
            devices[i].label = label;
        }

        return true;
    };

    function GetDevicesUpdateObject() {
        return {
            method: "VidyoWebRTCDevicesUpdated",
            added: {
                microphones: [],
                cameras: [],
                speakers: []
            },
            removed: {
                microphones: [],
                cameras: [],
                speakers: []
            }
        };

    };

    function SendDevicesUpdated(added, removed) {
        var deviceUpdate = GetDevicesUpdateObject();
        ConvertToDeviceInfo(added, deviceUpdate.added.microphones, deviceUpdate.added.cameras, deviceUpdate.added.speakers);
        ConvertToDeviceInfo(removed, deviceUpdate.removed.microphones, deviceUpdate.removed.cameras, deviceUpdate.removed.speakers);
        
        if (deviceUpdate.removed.microphones.length > 0) {
            for (var i = 0; i < deviceUpdate.removed.microphones.length; i++) {
                mic_.DeviceRemoved(deviceUpdate.removed.microphones[i].id);
            }
        }

        if (deviceUpdate.removed.cameras.length > 0) {
            for (var j = 0; j < deviceUpdate.removed.cameras.length; j++) {
                camera_.DeviceRemoved(deviceUpdate.removed.cameras[j].id);
            }
        }
        
        transport_.SendWebRTCMessage(deviceUpdate, function() {
            LogInfo("DeviceUpdate sent: " + JSON.stringify(deviceUpdate));
            PollForDevices();
        });
    };

    function PollForDevices() {
        if (!devices_) {
            return;
        }
        setTimeout(function() {
            GetDevices(true, function(devices) {
                var diff = DiffDevices(devices_, devices);
                if (diff.added.length > 0 || diff.removed.length > 0) {
                    devices_ = devices;
                    SendDevicesUpdated(diff.added, diff.removed);
                } else {
                    PollForDevices();
                }
            });
        }, 5 * 1000);
    };

    function ConvertToDeviceInfo(devices, microphones, cameras, speakers) {
        var micLabels = [];
        var camLabels = [];
        var speakerLabels = [];

        for (var i = 0; i < devices.length; i++) {
            var device = {
                id: devices[i].deviceId,
                name: devices[i].label.replace(/\([a-zA-Z0-9]+:[a-zA-Z0-9]+\)/, "") // In windows label comes as Camera(1dead:2code), this is to remove the dead code
            };
            switch(devices[i].kind) {
                case "audioinput":
                    if (micLabels.indexOf(device.name) === -1) {
                        microphones.push(device);
                        micLabels.push(device.name);
                    }
                    break;

                case "videoinput":
                    if (camLabels.indexOf(device.name) === -1) {
                        cameras.push(device);
                        camLabels.push(device.name);
                    }
                    break;

                case "audiooutput":
                    if (speakerLabels.indexOf(device.name) === -1) {
                        speakers.push(device);
                        speakerLabels.push(device.name);
                    }
                    break;
            }
        }
    };

    function SendDeviceEnumerationResponse(devices) {
        var deviceInfo = {
            method: "VidyoWebRTCEnumerateDeviceResponse",
            status: "success",
            microphones: [],
            cameras: [],
            speakers: [],
            shareEnabled: false
        };

        if (devices.length <= 0) {
            deviceInfo.status = "error";
        } else {
            ConvertToDeviceInfo(devices, deviceInfo.microphones, deviceInfo.cameras, deviceInfo.speakers);
        }

        /**
        var defaultSpeakerIndex = -1;
        for (var i = 0; i < deviceInfo.speakers.length; i++) {
            if (deviceInfo.speakers[i].id === "default") {
                defaultSpeakerIndex = i;
                break;
            }
        }

        if (defaultSpeakerIndex !== -1) {
            deviceInfo.speakers.splice(defaultSpeakerIndex, 1);
        }
        **/

        transport_.SendWebRTCMessage(deviceInfo, function() {
            LogInfo("DeviceInfo sent: " + JSON.stringify(deviceInfo));
            HandleShareSupportedRequest();
        });

        devices_ = devices;
        PollForDevices();

    };


    function HandleDeviceEnumerationRequest (data) {

        if (window.adapter.browserDetails.browser === "chrome") {
        } else {
            // Firefox doesn't enumerate audio output devices, add one default
            var defaultSpeaker = {
                deviceId: "default",
                label: "Default",
                kind: "audiooutput"
            };

            SendDevicesUpdated([defaultSpeaker], []);
        }

        if (window.adapter.browserDetails.browser === "chrome") {
        } else {
            // For Firefox guest user, store the media stream from device enumeration and use it for startcamera/startmicrophone
            var constraints = GetCameraConstraints(data);
            constraints.audio = true;
            navigator.mediaDevices.getUserMedia(constraints).then(function(s) {
                if (s.getAudioTracks().length > 0) {
                    mic_.SetStream(s);
                }

                if (s.getVideoTracks().length > 0) {
                    var camStream = s;
                    camera_.SetStream(camStream);
                    CameraStarted(camStream);
                }

                GetDevices(false, function(devices) {
                    SendDeviceEnumerationResponse(devices);
                });

            
            }).catch(function(err) {
                LogErr("getUserMedia error in DeviceEnumeration: " + JSON.stringify(err));
            });
            return;
        }

        GetDevices(true, function(devices) {
            SendDeviceEnumerationResponse(devices);
        });
    };

    function SendShareAdded(shareId) {
        var shareAddedMsg = {
            method: "VidyoWebRTCLocalShareAdded",
            shareId: ""+shareId
        };

        transport_.SendWebRTCMessage(shareAddedMsg, function() {
            LogInfo("ShareAdded sent successfully");
        });
    };

    function SendShareRemoved(shareId, cb) {
        var shareRemovedMsg = {
            method: "VidyoWebRTCLocalShareRemoved",
            shareId: ""+shareId
        };

        transport_.SendWebRTCMessage(shareRemovedMsg, function() {
            LogInfo("ShareRemoved sent successfully");
            cb();
        });
    };

    function periodicExtensionCheck() {
        setTimeout(function() {
            if (IsShareEnabled()) {
                HandleShareSupportedRequest();
            } else {
                periodicExtensionCheck();
            }
        }, 3000);
    };


    function IsShareEnabled() {
        if (window.adapter.browserDetails.browser === "chrome") {
        } else {
            if (window.adapter.browserDetails.version >= 52) {
                return true;
            }
        }
        
        return document.getElementById("vidyowebrtcscreenshare_is_installed") ? true : false;
    }

    function HandleShareSupportedRequest() {
        var shareSupport = IsShareEnabled();
        if (!shareSupport) {
            periodicExtensionCheck();
            return;
        }

        if (window.adapter.browserDetails.browser === "chrome") {
        } else {
            window.postMessage({type: "VidyoAddDomain", domain: window.location.hostname}, "*");
        }
        
        var shareUpdate = GetDevicesUpdateObject();
        shareUpdate.shareEnabled = true;
        transport_.SendWebRTCMessage(shareUpdate, function() {
            LogInfo("ShareUpdate sent: " + JSON.stringify(shareUpdate));
        });
    };

    function SendCandidate (streamId, candidate) {
        var candidateMsg = {
            method: "VidyoWebRTCIceCandidate",
            streamId: streamId,
            candidate: candidate
        };

        transport_.SendWebRTCMessage(candidateMsg, function() {
            LogInfo("Candidate send success - " + JSON.stringify(candidate));
        });
    };

    function SendLocalOffer(currentState, nextState, op) {
        var offer = offer_;
        var offerMsg = {
            method: "VidyoWebRTCOfferSdp",
            sdp: offer.sdp
        };

        transport_.SendWebRTCMessage(offerMsg, function() {
            LogInfo("PeerConnection Offer sent = " + offer.sdp);
            if (offer_ !== null) { 
                offer_ = null;
                peerConnection_.setLocalDescription(offer).
                then(function() {
                    LogInfo("PeerConnection setLocalDescription success");
                }).
                catch(function(err) {
                    LogErr("PeerConnection setLocalDescription failed " + JSON.stringify(err));
                    console.log(err);
                });
            }
        });
    };

    function GetLocalOffer() {

        LogInfo("PeerConnection onnegotiationneeded callstate=" + callState_);

        var offerConstraints = {
            offerToReceiveAudio: remoteAudio_.length,
            offerToReceiveVideo: maxSubscriptions_ + 1
        };

        if (window.adapter.browserDetails.browser === "chrome") {
            offerConstraints.offerToReceiveVideo = true; // Chrome doesn't accept numbers for these constraints
            offerConstraints.offerToReceiveAudio = true; // Chrome doesn't accept numbers for these constraints
        }

        cameraState_ = camera_.GetState();
        micState_ = mic_.GetState();

        peerConnection_.createOffer(offerConstraints).
        then(function(offer) {
            offer_ = offer;
            InvokeStateMachine("gotOffer");
        }).
        catch(function(err) {
            LogErr("PeerConnection CreateOffer failed " + JSON.stringify(err));
            console.log(err);
        });
    };

    function CheckForDevices(currentState, nextState, op, data) {
        // Don't wait for devices to start on firefox. 
        // Let them start later and trigger renegotiation
        if (window.adapter.browserDetails.browser === "chrome") {
            if (camera_.IsStarting()) {
                LogInfo("Waiting for camera");
                return;
            }

            if (mic_.IsStarting()) {
                LogInfo("Waiting for mic");
                return;
            }
        } 

        InvokeStateMachine("startCall");
    };

    function HandleStartCall (currentState, nextState, op) {

        var data = startCallData_;
        startCallData_ = null;
        maxSubscriptions_ = data.maxSubscriptions;

        // Get the peer connection constraints
        peerConnectionConstraints_.iceServers.length = 0;
        peerConnectionConstraints_.iceServers.push({urls : "stun:" + data.stunServer});

        if (data.turnCreds) {
           var addr = window.location.hostname;
           var urls = data.turnCreds.urls;
           for (var k = 0; k < urls.length; k++) {
                if (urls[k].indexOf("self_address") !== -1) {
                    urls[k] = urls[k].replace("self_address", addr);
                }
           }
           peerConnectionConstraints_.iceServers.push(data.turnCreds);
        }

        // Create the peer connection
        peerConnection_ = new RTCPeerConnection(peerConnectionConstraints_);
        peerConnectionStats_.Start(peerConnection_, remoteAudio_.length, maxSubscriptions_ + 1);

        peerConnection_.onicecandidate = function(evt) {
            if (evt.candidate) {
                if (iceCandidateTimeout_ !== null) {
                    LogInfo("PeerConnection onicecandidate clearing candidate timeout");
                    clearTimeout(iceCandidateTimeout_);
                    iceCandidateTimeout_ = null;
                }
                SendCandidate(1, evt.candidate);
            } else {
                LogInfo("PeerConnection onicecandidate done");
            }
        };
        
        peerConnection_.oniceconnectionstatechange = function(state) {
            LogInfo("PeerConnection oniceconnectionstatechange - " + state.target.iceConnectionState);
            if (state.target.iceConnectionState === "closed" || state.target.iceConnectionState === "failed") {
                transport_.SendWebRTCMessage({method: "VidyoWebRTCIceFailed"}, function() {
                });
            }
        };

        peerConnection_.onsignalingstatechange = function(state) {
            var sigState = (state.target ? state.target.signalingState : state);
            LogInfo("PeerConnection onsignalingstatechange - " + sigState);
            if (sigState === "stable") {
                InvokeStateMachine("signalingStable");
            }
            
        };

        peerConnection_.ontrack = function(evt) {
            LogInfo("PeerConnection ontrack ");
            if (evt.track && evt.track.kind === "audio") { 
                if (evt.streams && evt.streams.length > 0) {
                    if (currentAudioIndex_ < remoteAudio_.length) {
                        LogInfo("PeerConnection onaudiotrack [" + currentAudioIndex_ + "] - audio src: " + evt.streams[0].id);
                        remoteAudio_[currentAudioIndex_].srcObject = evt.streams[0];
                        currentAudioIndex_++;
                    } else {
                        LogErr("PeerConnection onaudiotrack more than " + remoteAudio_.length + " received");
                    }
                } else {
                    LogErr("PeerConnection ontrack - audio No streams present !!");
                }
            } else if (evt.track && evt.track.kind === "video") {
                videoStreams_.push(evt.streams[0]);

                // Check if we are waiting for video, this happens when someone is already in the call, the element and sources are added, but the stream comes later
                for (var sourceId in streamMapping_) {
                    if (streamMapping_[sourceId].hasOwnProperty("streamId")) {
                        var streamId = streamMapping_[sourceId]["streamId"];
                        if (videoStreams_[streamId]) {
                            CreateSourceIdEntryInStreamMappingAndAttachVideo({sourceId: sourceId});
                        }
                    }
                }
            }
        };


        // We will trigger manually since multiple stream operations may be required before sending the offer
        // peerConnection_.onnegotiationneeded = GetLocalOffer;

        var cameraStream = camera_.GetStreamAndTrack().stream;
        var micStream = mic_.GetStreamAndTrack().stream;

        if (cameraStream) {
            AddVideoStream(cameraStream);
        }

        if (micStream) {
            AddAudioStream(micStream);
        }

        if (iceCandidateTimeout_ !== null) {
            clearTimeout(iceCandidateTimeout_);
            iceCandidateTimeout_ = null;
        }

        iceCandidateTimeout_ = setTimeout(function() {
            LogErr("No ICE candidates generated, disconnecting the call");
            InvokeStateMachine("stopCall");
        }, 30 * 1000);
        GetLocalOffer();

    };

    function HandleStopCall(currentState, nextState, op, data) {

        previousWindowSizes_ = { windows: []};
        offer_ = null;

        /**
        camera_.StopDevice();
        mic_.StopDevice();
        **/

        if (iceCandidateTimeout_ !== null) {
            clearTimeout(iceCandidateTimeout_);
            iceCandidateTimeout_ = null;
        }


        HandleStopLocalShare();
        StopStream(localShareStream_, true, true);

        /**
        StopStream([micStream_], true, true);
        micStream_ = null;
        StopStream(videoStreams_, true, true);
        **/

        peerConnectionStats_.Stop();
        if (peerConnection_ !== null) {
            // Firefox throws an exception when trying to close peer connection in offline mode
            try {
                peerConnection_.oniceconnectionstatechange = undefined;
                peerConnection_.close();
            } catch(e) {
            }
            peerConnection_ = null;
        }

        currentAudioIndex_ = 0;

        var sourceIds = Object.keys(streamMapping_);
        for (var i = 0; i < sourceIds.length; i++) {
            var sourceId = sourceIds[i];
            var streamId = streamMapping_[sourceId].streamId;
            var type = streamMapping_[sourceId].type;
            if (type !== STREAM_TYPE_PREVIEW) {
                var elemId = streamMapping_[sourceId].elemId;
                if (elemId && layoutEngine_.hasOwnProperty(elemId)) {
                    layoutEngine_[elemId].hide(type, streamId);
                } 
                delete streamMapping_[sourceId];
            }
        }

        videoStreams_.length = 0;
        var cameraStream = camera_.GetStreamAndTrack().stream;
        videoStreams_.push(cameraStream);
    };

    function HandleAnswerSdp(currentState, nextState, op, data) {
        SetAnswerSdp(data, function(){});
    };

    function SetAnswerSdp(data, callback) {
        if (peerConnection_ === null) {
            LogInfo("peerConnection SetAnswerSdp pc null, call stopped");
            callback(false);
            return;
        }

        LogInfo("SetAnswerSdp: " + data.sdp);

        var br = resolutionMap_.hasOwnProperty(maxResolution_) ? resolutionMap_[maxResolution_].br: "768";

        data.sdp = data.sdp.replace(/a=mid:video\r\n/g, "a=mid:video\r\nb=AS:" + br + "\r\n");

        var SetRemoteDescription = function () {
            if (peerConnection_ === null) {
                LogInfo("peerConnection HandleAnswerSdp pc null, call stopped");
                callback(false);
                return;
            }

            var remoteSdp = new RTCSessionDescription({type: "answer", sdp: data.sdp});
            peerConnection_.setRemoteDescription(remoteSdp).
            then(function() {
                LogInfo("PeerConnection setRemoteDescription success");
                callback(true);
            }).
            catch(function(err) {
                LogErr("PeerConnection setRemoteDescription failed " + JSON.stringify(err));
                console.log(err);
                callback(false);
            });
        };

        if (offer_ !== null) {
            LogInfo("PeerConnection HandleAnswerSdp localOffer not yet set, setting  local offer first");
            var o = offer_;
            offer_ = null;
            peerConnection_.setLocalDescription(o).
            then(function() {
                LogInfo("PeerConnection setLocalDescription success");
                SetRemoteDescription();
            }).
            catch(function(err) {
                LogErr("PeerConnection setLocalDescription failed " + JSON.stringify(err));
                console.log(err);
            });
        } else {
            SetRemoteDescription();
        }

    };

    function HandleIceCandidate(data) {
        var iceCandidate = new RTCIceCandidate(data.candidate);
        if (data.streamId === 1 && peerConnection_ !== null) {
            peerConnection_.addIceCandidate(iceCandidate).
            then(function() {
                LogInfo("HandleIceCandidate set success - "  + JSON.stringify(data.candidate));
            }).
            catch(function(err){
                LogErr("HandleIceCandidate set failed - " + JSON.stringify(data.candidate) + " " + err.stack + " " + JSON.stringify(err));
                console.log(err);
            });
        } else if (data.streamId === 0 && localSharePeerConnection_ !== null) {
            localSharePeerConnection_.addIceCandidate(iceCandidate).
            then(function() {
                LogInfo("Share: HandleIceCandidate set success - " + JSON.stringify(data.candidate));
            }).
            catch(function(err){
                LogErr("Share: HandleIceCandidate set failed - " + JSON.stringify(data.candidate) + " " + err.stack + " " + JSON.stringify(err));
                console.log(err);
            });
        }
    };

    function HandleStreamMappingChanged(data) {

        var i = 0;
        var oldSourceIds = Object.keys(streamMapping_);
        var newSourceIds = [];
        var streamIds = [];

        for (i = 0; i < data.streams.length; i++) {

            var sourceId = data.streams[i].sourceId;
            newSourceIds.push(sourceId);

            var streamId = data.streams[i].streamId + 1;
            streamIds.push(streamId);

            var viewId = data.streams[i].viewId;
            var name = data.streams[i].sourceName || "Video" + i;
            var type = data.streams[i].type;

            if (type === STREAM_TYPE_PREVIEW) {
                CreateSourceIdEntryInStreamMappingAndAttachVideo({sourceId: PREVIEW_SOURCE_ID, streamId: 0, attached: false, type: STREAM_TYPE_PREVIEW, name: "Preview", elemId: viewId});
            } else {
                CreateSourceIdEntryInStreamMappingAndAttachVideo({sourceId: sourceId, streamId: streamId, elemId: viewId, type: type, name: name});
            }
        }

        var deletedSourceIds = oldSourceIds.filter(function(i) { return newSourceIds.indexOf(i) === -1 });

        LogInfo("Deleting source ids: " + JSON.stringify(deletedSourceIds));
        for (i = 0; i < deletedSourceIds.length; i++) {
            var sourceId = deletedSourceIds[i];
            if (streamMapping_.hasOwnProperty(sourceId)) {
                var streamId = streamMapping_[sourceId].streamId;
                var type = streamMapping_[sourceId].type;
                if (streamIds.indexOf(streamId) === -1) {
                    var elemId = streamMapping_[sourceId].elemId;
                    if (elemId && layoutEngine_.hasOwnProperty(elemId)) {
                        layoutEngine_[elemId].hide(type, streamId);
                    } else {
                        LogInfo("Hide: elemId/LayoutEngine not found elemId = " + elemId);
                    }
                }
                delete streamMapping_[sourceId];
            }
        }

    };

    function GetCameraConstraints(data) {
        maxResolution_ = data.maxResolution;
        var resolution = resolutionMap_[maxResolution_];

        var constraints = {
            video: {
                deviceId: data.camera,
                frameRate: {min: 20},
                width: {ideal: resolution.w },
                height: {ideal: resolution.h }
            }
        };

        if (window.adapter.browserDetails.browser === "chrome") {
        } else {
            // Firefox doesn't seem to be handling constraints
            // So if resolution is greater than 480p, don't specify constraints
            if (constraints.video.height.ideal >= 480) {
                delete constraints.video.width;
                delete constraints.video.height;
            }
        }

        return constraints;
    };


    function HandleStartCamera(data) {
        var constraints = GetCameraConstraints(data);
        CreateSourceIdEntryInStreamMappingAndAttachVideo({sourceId: PREVIEW_SOURCE_ID, streamId: 0, attached: false, type: STREAM_TYPE_PREVIEW, name: "Preview"});
        camera_.StartDevice(data.camera, constraints); 
    };

    function HandleStopCamera(data) {
        camera_.StopDevice(data.camera);
    };

    function HandleStartMicrophone(data) {
        var constraints = {
            audio: {
                deviceId: data.microphone
            }
        };

        if (window.adapter.browserDetails.browser === "chrome") {
            mic_.StartDevice(data.microphone, constraints);
        } else {
            // In firefox, if a camera pemission window is open and we do getUsermedia for mic, 
            // that permission window is overwritten with this mic permission window 
            // and there is no way for the user to grant camera access after granting mic access
            // Hence if waiting for camera access, do not show mic access and wait for camera started
            if (camera_.IsStarting()) {
                mic_.SetDevice(data.microphone, constraints);
            } else {
                mic_.StartDevice(data.microphone, constraints);
            }
        }
    };

    function HandleStopMicrophone(data) {
        mic_.StopDevice(data.microphone);
    };


    function HandleStartSpeaker(data) {
        if (typeof remoteAudio_[0].setSinkId === "function") {
            for (var r = 0; r < remoteAudio_.length; r++) {
                remoteAudio_[r].setSinkId(data.speaker);
            }
        }
    };

    function HandleStartLocalShare(data) {
        LogInfo("Starting Local Screen Share in call state " + callState_ + " count=" + localShareStream_.length);

        if (callState_ === CALLSTATE_IDLE) {
            HandleStopCall();
            return;
        }

        localSharePeerConnection_ = new RTCPeerConnection(peerConnectionConstraints_);
        peerConnectionStats_.SetSharePeerConnection(localSharePeerConnection_);

        localSharePeerConnection_.onicecandidate = function(evt) {
            if (evt.candidate) {
                SendCandidate(0, evt.candidate);
            } else {
                LogInfo("SharePeerConnection onicecandidate done");
            }
        };

        localSharePeerConnection_.oniceconnectionstatechange = function(state) {
            LogInfo("SharePeerConnection oniceconnectionstatechange - " + state.target.iceConnectionState);
        };

        localSharePeerConnection_.onsignalingstatechange = function(state) {
            LogInfo("SharePeerConnection onsignalingstatechange - " + (state.target ? state.target.signalingState : state));
        };

        localSharePeerConnection_.ontrack = function(evt) {
            LogInfo("SharePeerConnection ontrack");
        };

        localSharePeerConnection_.onnegotiationneeded = function() {
            LogInfo("SharePeerConnection onnegotiationneeded callState=" + callState_);

            if (callState_ === CALLSTATE_IDLE) {
                HandleStopCall();
                return;
            }

            var offerConstraints = {
                offerToReceiveAudio: false,
                offerToReceiveVideo: false
            };

            localSharePeerConnection_.createOffer(offerConstraints).
            then(function(offer) {
                var offerMsg = {
                    method: "VidyoWebRTCShareOfferSdp",
                    sdp: offer.sdp
                };
                localShareOffer_ = offer;
                transport_.SendWebRTCMessage(offerMsg, function() {
                    LogInfo("SharePeerConnection Offer sent = " + offer.sdp);

                    if (localShareOffer_ !== null) {
                        localShareOffer_ = null;
                        localSharePeerConnection_.setLocalDescription(offer).
                        then(function() {
                            LogInfo("SharePeerConnection setLocalDescription success");
                        }).
                        catch(function(err) {
                        LogErr("SharePeerConnection setLocalDescription failed " + JSON.stringify(err));
                        console.log(err);
                        });
                    }
                });
            }).
            catch(function(err) {
                LogErr("SharePeerConnection CreateOffer failed " + JSON.stringify(err));
                console.log(err);
            });
        };

        localSharePeerConnection_.addStream(localShareStream_[0]);
    };

    function HandleShareAnswerSdp(data) {
        LogInfo("ShareAnswerSdp: " + data.sdp);
        var SetShareRemoteDescription = function() {

            if (localSharePeerConnection_ === null) {
                LogInfo("localSharePeerConnection HandleShareAnswerSdp pc null, call stopped");
                return;
            }

            var remoteSdp = new RTCSessionDescription({type: "answer", sdp: data.sdp});
            localSharePeerConnection_.setRemoteDescription(remoteSdp).
            then(function() {
                LogInfo("SharePeerConnection setRemoteDescription success");
            }).
            catch(function(err) {
                LogErr("SharePeerConnection setRemoteDescription failed " + JSON.stringify(err));
                console.log(err);
            });
        };

        if (localShareOffer_ !== null) {
            LogInfo("SharePeerConnection HandleShareAnswerSdp localOffer not yet set");
            var o = localShareOffer_;
            localShareOffer_ = null;
            localSharePeerConnection_.setLocalDescription(o).
            then(function() {
                LogInfo("SharePeerConnection setLocalDescription success");
                SetShareRemoteDescription();
            }).
            catch(function(err) {
                LogErr("SharePeerConnection setLocalDescription failed " + JSON.stringify(err));
                console.log(err);
            });
        } else {
            SetShareRemoteDescription();
        }
    };

    function HandleStopLocalShare(data) {
        localShareOffer_ = null;
        localShareElement_ = null;
        shareSelectedCallback_ = null;

        if (localShareId_ > 0) {
            SendShareRemoved(localShareId_, function() {
            });

            // To indicate that share has been removed and the next share add will go with localShareId_ + 1
            localShareId_ = -localShareId_; 
        }

        if (pendingRequestId_ !== -1) {
            window.postMessage({type: "VidyoCancelRequest", requestId: pendingRequestId_}, "*");
            pendingRequestId_ = -1;
        }


        if (localShareStream_.length > 0) {
            localShareStream_[0].oninactive = undefined;
            StopStream([localShareStream_[0]], true, true);
            localShareStream_ = localShareStream_.slice(1);
            LogInfo("StopLocalShare count=" + localShareStream_.length);
        }

        peerConnectionStats_.SetSharePeerConnection(null);
        if (localSharePeerConnection_ !== null) {
            localSharePeerConnection_.close();
            localSharePeerConnection_ = null;

        }
    };

    function HandleStreamStatus(data) {
        for (var s = 0; s < data.streams.length; s++) {
            var streamId = data.streams[s].streamId + 1;
            var status = data.streams[s].status == 0 ? "stalled" : "started";
            
            var elemId = getElemId(streamId);
            if (elemId && layoutEngine_.hasOwnProperty(elemId)) {
                layoutEngine_[elemId].videoStatus(STREAM_TYPE_VIDEO, streamId, status);
            }
        }
    };

    function RemoveAudioStream() {
        if (window.adapter.browserDetails.browser === "chrome") {
            peerConnection_.removeStream(micStream_);
            StopStream([micStream_], true, true);
            micStream_ = null;
        } else {
            var senders = peerConnection_.getSenders();
            for (var i = 0; i < senders.length; i++) {
                var track = senders[i].track;
                if (track.kind === "audio") {
                    peerConnection_.removeTrack(senders[i]);
                }
            }
        }
    };

    function AddAudioStream(micStream) {
        micStream_ = micStream;
        if (window.adapter.browserDetails.browser === "chrome") {
            peerConnection_.addStream(micStream_);
        } else {
            peerConnection_.addTrack(micStream_.getAudioTracks()[0], micStream_);
        }
    };

    function RemoveVideoStream() {
        if (window.adapter.browserDetails.browser === "chrome") {
            peerConnection_.removeStream(videoStreams_[0]);
            StopStream([videoStreams_[0]], true, true);
            videoStreams_[0] = null;
        } else {
            var senders = peerConnection_.getSenders();
            for (var i = 0; i < senders.length; i++) {
                var track = senders[i].track;
                if (track.kind === "video") {
                    peerConnection_.removeTrack(senders[i]);
                }
            }
        }
    };

    function AddVideoStream(cameraStream) {
        if (window.adapter.browserDetails.browser === "chrome") {
            peerConnection_.addStream(cameraStream);
        } else {
            peerConnection_.addTrack(cameraStream.getVideoTracks()[0], cameraStream);
        }
    };

    function AddRemoveStreams() {
        var cameraCase = camera_.DiffState(cameraState_);
        var micCase = mic_.DiffState(micState_);

        LogInfo("AddRemoveStreams camera=" + cameraCase + " mic=" + micCase);

        if (cameraCase === "stopped" || cameraCase === "restarted") {
            RemoveVideoStream();
        }

        if (cameraCase === "started" || cameraCase === "restarted") {
             AddVideoStream(camera_.GetStreamAndTrack().stream);
        }

        if (micCase === "stopped" || micCase === "restarted") {
            RemoveAudioStream();
        }

        if (micCase === "started" || micCase === "restarted") {
            AddAudioStream(mic_.GetStreamAndTrack().stream);
        } 

        GetLocalOffer();
    };


    this.setRendererType = function(type) {
        rendererType = type;
        var msg = {
            method: "VidyoWebRTCSetRendererType",
            type: type
        };
        transport_.SendWebRTCMessage(msg, function() {
            LogInfo("VidyoWebRTCSetRendererType sent: " + JSON.stringify(msg));
        });
    };

    this.showViewLabel = function(viewId, showLabel) {
        LogInfo("ShowViewLabel: viewId=" + viewId + " showLabel=" + showLabel);
        if (layoutEngine_.hasOwnProperty(viewId)) {
            layoutEngine_[viewId].showViewLabel(showLabel);
        }
    };

    this.callback = function(data) {
        LogInfo("Callback - " + data.method);
        switch(data.method) {
            case "VidyoWebRTCEnumerateDeviceRequest":
                HandleDeviceEnumerationRequest(data);
            break;

            case "VidyoWebRTCStartCall":
                startCallData_ = data;
                InvokeStateMachine("startCall");
            break;

            case "VidyoWebRTCStopCall":
                InvokeStateMachine("stopCall");
            break;

            case "VidyoWebRTCAnswerSdp":
                InvokeStateMachine("gotAnswer", data);
            break;

            case "VidyoWebRTCIceCandidate":
                HandleIceCandidate(data);
            break;

            case "VidyoWebRTCStreamMappingChanged":
                HandleStreamMappingChanged(data);
            break;

            case "VidyoWebRTCStartCamera":
                HandleStartCamera(data);
            break;

            case "VidyoWebRTCStopCamera":
                HandleStopCamera(data);
            break;

            case "VidyoWebRTCStartSpeaker":
                HandleStartSpeaker(data);
            break;

            case "VidyoWebRTCStopSpeaker":
                // No-op
            break;

            case "VidyoWebRTCStartMicrophone":
                HandleStartMicrophone(data);
            break;

            case "VidyoWebRTCStopMicrophone":
                HandleStopMicrophone(data);
            break;

            case "VidyoWebRTCStartLocalShare":
                HandleStartLocalShare(data);
            break;

            case "VidyoWebRTCShareAnswerSdp":
                HandleShareAnswerSdp(data);
            break;

            case "VidyoWebRTCStopLocalShare":
                HandleStopLocalShare(data);
            break;

            case "VidyoWebRTCStreamStatus":
                HandleStreamStatus(data);
            break;

            case "VidyoWebRTCInitRenderer":
                if (layoutEngine_.hasOwnProperty(data.viewId)) {
                    layoutEngine_[data.viewId].uninitialize();
                    delete layoutEngine_[data.viewId];
                    LogInfo("LayoutEngine: " + JSON.stringify(Object.keys(layoutEngine_)));
                }
                layoutEngine_[data.viewId] = new LayoutEngine(data.viewId);
                layoutEngine_[data.viewId].initialize(rendererType);
            break;

            case "VidyoWebRTCSelectShare":
                SelectShare(function(status) {
                    if (status) {
                        localShareId_ = -localShareId_ + 1;
                        SendShareAdded(localShareId_);
                    }
                });
            break;
        }
    };


    function getElemId(streamId) {
        for (var sourceId in streamMapping_) {
            if (streamMapping_[sourceId].streamId === streamId) {
                return streamMapping_[sourceId].elemId;;
            }
        }
        LogInfo("GetElemId " + streamId + " NOT FOUND");
        return "";
    };

    function ShareGetUserMedia(constraints) {
        navigator.mediaDevices.getUserMedia(constraints).
        then(function(str) {
            LogInfo("Got Local Share Stream count=" + localShareStream_.length + " id=" + str.id);
            localShareStream_.push(str); 
            if (localShareElement_) {
                localShareElement_.srcObject = str;
                localShareElement_.dataset.streamId = str.id;
            }

            str.oninactive = function() {
                LogInfo("SharePeerConnection share stream ended");
                localShareStream_.length = 0;
                HandleStopLocalShare();
            };
            if (shareSelectedCallback_) {
                shareSelectedCallback_(true);
            } else {
                LogErr("ShareGetUserMedia shareSelectedCallback_ null");
            }
        }).
        catch(function(err) {
            LogErr("Local Share Stream error" + JSON.stringify(err));
            console.log(err);
            if (shareSelectedCallback_) {
                shareSelectedCallback_(false);
            } else {
                LogErr("ShareGetUserMedia error shareSelectedCallback_ null");
            }
        });
    };

    function SelectShare(cb) {
        if (window.adapter.browserDetails.browser === "chrome") {
            if (pendingRequestId_ === -1) {
                shareSelectedCallback_ = cb;
                window.postMessage({ type: "VidyoRequestGetWindowsAndDesktops"}, "*");
            } else {
                LogErr("Pending request for StartLocalShare");
                cb(false);
            }   
        } else {
            var constraints = {
                video : {
                    mediaSource: "window",
                    mozMediaSource: "window",
                    height: {max: resolutionMap_[maxShareResolution_].h},
                    width: {max: resolutionMap_[maxShareResolution_].w},
                    frameRate: {max: maxShareFrameRate_}
                }
            };

            shareSelectedCallback_ = cb;
            ShareGetUserMedia(constraints);
        }
    };

    window.addEventListener("message", function (event) {
        if (event.origin !== window.location.origin) {
            return;
        }

        if (event.data.type === "VidyoRequestId") {
            LogInfo("VidyoRequestId - " + event.data.requestId);
            pendingRequestId_ = event.data.requestId;
        }

        if (event.data.type === "VidyoOutEventSourceId") {
            pendingRequestId_ = -1;

            if (event.data.sourceId === "") { // The user clicked cancel
                if (shareSelectedCallback_) {
                    LogInfo("ShareGetUserMedia User Cancelled");
                    shareSelectedCallback_(false);
                } else {
                    LogErr("ShareGetUserMedia cancel shareSelectedCallback_ null");
                }
                return;
            }

            var width = 1920;
            var height = 1080;

            var constraints = {
                video:  { mandatory:
                            {
                                chromeMediaSource: "desktop",
                                chromeMediaSourceId: event.data.sourceId,
                                maxWidth: resolutionMap_[maxShareResolution_].w,
                                maxHeight: resolutionMap_[maxShareResolution_].h,
                                maxFrameRate: maxShareFrameRate_
                            }
                        }
            };
            ShareGetUserMedia(constraints);
        }
    });

    function SendUninitialize() {
        callState_ = CALLSTATE_IDLE;
        HandleStopCall();

        camera_.StopDevice();
        mic_.StopDevice();
        StopStream([micStream_], true, true);
        micStream_ = null;

        var uninitMsg = {
            method: "VidyoWebRTCUninitialize"
        };
        transport_.SendWebRTCMessage(uninitMsg, function() {
            LogInfo("VidyoWebRTCUninitialize success");
        });

        // Do something here so that the uninitialize message reaches the server
        var j = 0;
        for (var i = 0; i < 500; i++) {
            j++; 
        }
    };

    window.addEventListener("unload", SendUninitialize);

    this.Uninitialize = function() {
        SendUninitialize();
    };

}

/** Layout Engine **/
function LayoutEngine(viewId) {
    var NUM_ELEMENTS = 9;

    var SELF_VIEW_DOCK = "Dock";
    var SELF_VIEW_PIP = "PIP";

    var LAYOUT_MODE_PREFERRED = "preferred";
    var LAYOUT_MODE_GRID = "grid";

    var SELF_FRAME_ID = "_vidyoSelfFrame";
    var REMOTE_FRAME_ID = "_vidyoRemoteFrame";

    var SELF_NAME_ID = "_vidyoSelfName";
    var REMOTE_NAME_ID = "_vidyoRemoteName";


    var layoutEngineCss = "                                        \
        .videoContainer {                                          \
            position: relative;                                    \
            width: 100%;                                           \
            height: 100%;                                          \
            overflow: hidden;                                      \
        }                                                          \
                                                                   \
        .videoContainer .frame {                                   \
            display: none;                                         \
            position: absolute;                                    \
            top: 0;                                                \
            right: 0;                                              \
            bottom: 0;                                             \
            left: 0;                                               \
            overflow: hidden;                                      \
            background-color: #202020;                             \
        }                                                          \
                                                                   \
        .videoContainer .video video {                             \
            width: 100%;                                           \
            height: 100%;                                          \
            object-fit: cover;                                     \
        }                                                          \
                                                                   \
        .videoContainer .share video {                             \
            width: 100%;                                           \
            height: 100%;                                          \
        }                                                          \
                                                                   \
        .videoContainer .selfview video {                          \
            transform: scaleX(-1);                                 \
        }                                                          \
                                                                   \
        .videoContainer .frame .label {                            \
            position: absolute;                                    \
            bottom: 10px;                                          \
            width: 100%;                                           \
            text-align: left;                                      \
        }                                                          \
                                                                   \
        .videoContainer .frame .label .labelContainer {            \
            height: 100%;                                          \
            display: inline-block;                                 \
            font-size: 0px;                                        \
        }                                                          \
                                                                   \
        .videoContainer .frame .label .labelContainer div {        \
            color: white;                                          \
            background-color: rgba(0, 0, 0, 0.2);                  \
            border-radius: 2px;                                    \
            padding: 3px 15px;                                     \
            height: 100%;                                          \
        }                                                          \
                                                                   \
        @media (min-aspect-ratio: 16/9) {                          \
            .videoContainer .share video {                         \
                height: 100%;                                      \
            }                                                      \
        }                                                          \
                                                                   \
        @media (max-aspect-ratio: 16/9) {                          \
            .videoContainer .share video {                         \
                width: 100%;                                       \
                height: 100%;                                      \
            }                                                      \
        } ";

    var layoutEngineStyle = document.createElement("style");
    layoutEngineStyle.type = "text/css";
    layoutEngineStyle.innerHTML = layoutEngineCss;
    document.getElementsByTagName("head")[0].appendChild(layoutEngineStyle);

    var initialized = false;
    var layoutUpdateInterval = -1;
    var FRAME = '<div class="frame video" id="<frameid>"> <video muted autoplay> </video> <div class="label"> <div class="labelContainer"> <div class="guest" id="<nameid>"> </div> </div> </div> </div>';

    var currentContext = {
        participantCount: 0,
        participants: new Array(NUM_ELEMENTS).fill(-1),
        selfViewMode: "None",
        numShares: 0,
        poppedOutWindows: new Array(NUM_ELEMENTS).fill(-1),
        width: 0,
        height: 0,
        layoutMode: "grid"
    };

    var currentLayout = {
        selfViewAttributes: new AttrSet(),
        videoAttributes: getAttrSetArray(NUM_ELEMENTS)
    };

    var logLevel = (VCUtils.params && VCUtils.params.webrtcLogLevel) ? VCUtils.params.webrtcLogLevel : "info";
    function LogInfo (msg) {
        if (logLevel === "info") {
            console.log("" + GetTimeForLogging() + " LayoutEngine[" + viewId + "]: " + msg);
        }
    };


    function LogErr (msg) {
        if (logLevel === "info" || logLevel === "error") {
            console.error("" + GetTimeForLogging() + " LayoutEngine[" + viewId + "]: " + msg);
        }
    };


    function AttrSet() {
        this.display = "none";
        this.x = 0;
        this.y = 0;
        this.width = 0;
        this.height = 0;
        this.fontSize = 15;
    }

    function applyLayout(participants, layout) {

        var applyToFrame = function(attr, frame) {
            frame.style.display = attr.display;
            if (attr.display !== "none") {
                frame.style.left = attr.x + "px";
                frame.style.top = attr.y + "px";
                frame.style.width = attr.width + "px";
                frame.style.height = attr.height + "px";

                frame.getElementsByClassName("labelContainer")[0].style.fontSize = attr.fontSize + "px";
            }
        };

        var frame = document.getElementById(viewId + SELF_FRAME_ID);
        if (frame) {
            applyToFrame(layout.selfViewAttributes, frame);
        } else {
            LogInfo("applyLayout: frame not found " + (viewId + SELF_FRAME_ID));
        }

        var displayedFrames = new Array(NUM_ELEMENTS).fill(-1);

        var layoutIndex = 0;
        for (var i = 0; i < NUM_ELEMENTS; i++) {
            if (participants[i] !== -1) {
                displayedFrames[participants[i]] = 1;
                frame = document.getElementById(viewId + REMOTE_FRAME_ID + participants[i]);
                if (frame) {
                    frame.dataset.index = participants[i];
                    applyToFrame(layout.videoAttributes[layoutIndex++], frame);
                } else {
                    LogInfo("applyLayout: frame not found " + (viewId + REMOTE_FRAME_ID + participants[i]));
                }
            } 
        }

        for (i = 0; i < NUM_ELEMENTS; i++) {
            if (displayedFrames[i] === -1) {
                frame = document.getElementById(viewId + REMOTE_FRAME_ID + i);
                if (frame) {
                    applyToFrame({display: "none"}, frame);
                } else {
                    LogInfo("applyLayout: frame not found " + (viewId + REMOTE_FRAME_ID + i));
                }
            }
        }
    }

    /** 
        Input: context: {
            participantCount,
            participants: <array of indices to indicate which participant is in which frame in the layout>
            selfViewMode: "Dock|PIP|None",
            numShares: number of shares
            width:
            height:   
            layoutMode: "grid|preferred",
        }

        Output: layout: {
            videoAttributes []: {
                display: "block|none",
                x:
                y:
                width:
                height:
                fontSize:
            },
            shareAttrs: {
                // Same as videoAttributes 
            },
            selfViewAttributes: {
                // Same as videoAttributes 
            }
        }
    **/

    function getAttrSetArray(n) {
        var ret = [];
        for (var i = 0; i < n; i++) {
            ret.push(new AttrSet());
        }

        return ret;
    }

    function calculateLayout (context, layout) {
        var numLayoutFrames = context.participantCount;

        if (context.selfViewMode === SELF_VIEW_DOCK) {
            numLayoutFrames += 1;
        }

        var i;
        if (context.width === 0 || context.height === 0 || numLayoutFrames === 0) {
            layout.shareAttrs = new AttrSet();
            layout.selfViewAttributes = new AttrSet();
            layout.videoAttributes = getAttrSetArray(NUM_ELEMENTS);
            applyLayout(context.participants, layout);
            return;
        }

        var videoMetrics = GetLayout(numLayoutFrames, context.numShares, context.width, context.height);
        var fontSize;

        for (i = 0; i < context.participantCount && i < NUM_ELEMENTS; i++) {
            var attrs = layout.videoAttributes[i];
            var metrics = videoMetrics[i];
            attrs.display = "block";
            attrs.x = metrics.x;
            attrs.y = metrics.y;
            attrs.width = metrics.width;
            attrs.height = metrics.height;
            attrs.fontSize = Math.floor(attrs.height * 7 / 100);
        }

        for (i = context.participantCount; i < NUM_ELEMENTS; i++) {
            layout.videoAttributes[i].display = "none";
        }

        var selfViewAttrs = layout.selfViewAttributes;

        var selfViewMetrics;
        switch (context.selfViewMode) {
            case SELF_VIEW_DOCK:
                selfViewMetrics = videoMetrics[videoMetrics.length - 1];
                selfViewAttrs.display = "block";
                selfViewAttrs.x = selfViewMetrics.x;
                selfViewAttrs.y = selfViewMetrics.y;
                selfViewAttrs.width = selfViewMetrics.width;
                selfViewAttrs.height = selfViewMetrics.height;
                break;
            case SELF_VIEW_PIP:
                selfViewAttrs.display = "block";
                var width = Math.floor(context.width/4);
                var height = Math.floor(context.height/4);
                if (width > height) {
                    width = Math.floor((16 * height)/9);
                } else {
                    height = Math.floor((9 * width)/16);
                }
                selfViewAttrs.x = context.width - width;
                selfViewAttrs.y = context.height - height;
                selfViewAttrs.width = width;
                selfViewAttrs.height = height;
                break;
            default:
                selfViewAttrs.display = "none";
        }

        selfViewAttrs.fontSize = Math.floor(selfViewAttrs.height * 7 / 100);
        applyLayout(context.participants, layout);
    };

    function init(rendererType) {
        LogInfo("init: viewId=" + viewId + " type=" + rendererType);
        var view = document.getElementById(viewId);
        if (!view) {
            LogErr("init: NULL viewId");
            return false;
        }

        if (rendererType === RENDERER_TYPE_TILES) {
            NUM_ELEMENTS = 1;
        }

        var layoutTemplate = '<div class="videoContainer">' 

        var i = 0;
        for (i = 0; i < NUM_ELEMENTS; i++ ) {
            layoutTemplate += FRAME.replace("<frameid>", viewId + REMOTE_FRAME_ID + i).replace("<nameid>", viewId + REMOTE_NAME_ID + i);
        }

        layoutTemplate += FRAME.replace('"frame video"', '"frame video selfview"').replace("<frameid>", viewId + SELF_FRAME_ID).replace("<nameid>", viewId + SELF_NAME_ID);
        layoutTemplate += "</div>";

        view.innerHTML = layoutTemplate;

        var videos = document.getElementsByTagName("video");
        for (i = 0; i < videos.length; i++) {
            videos[i].addEventListener("dblclick", popOut);
        }

        currentContext.width = view.clientWidth;
        currentContext.height = view.clientHeight;

        layoutUpdateInterval = window.setInterval(function() {
            if (initialized) {
                var v = document.getElementById(viewId);
                if (!v) {
                    return;
                }

                var w = v.clientWidth;
                var h = v.clientHeight;
                if (currentContext.width !== w || currentContext.height !== h) {
                    currentContext.width = w;
                    currentContext.height = h;
                    calculateLayout(currentContext, currentLayout); 
                }
            }
        }, 3000);
        return true;
    };

    this.initialize = function(rendererType) {
        if (!initialized) {
            initialized = init(rendererType);
        }
    };

    this.uninitialize = function() {
        LogInfo("uninitialize: " + viewId + " " + layoutUpdateInterval);
        if (layoutUpdateInterval !== -1) {
            clearInterval(layoutUpdateInterval);
            layoutUpdateInterval = -1;
        }
        initialized = false;
    };

    function setPreviewMode() {
        if (currentContext.selfViewMode !== SELF_VIEW_DOCK && currentContext.selfViewMode !== SELF_VIEW_PIP) {
            return;
        }

        // For single participant, self view is dock
        // For more than 1 participants, self view is dock
        // For 1 participant, self view is pip
        if (currentContext.participantCount <= 0 || currentContext.participantCount > 1) {
            currentContext.selfViewMode = SELF_VIEW_DOCK;
        } else {
            currentContext.selfViewMode = SELF_VIEW_PIP;
        }
    };

    function showPreview (name) {
        currentContext.selfViewMode = SELF_VIEW_DOCK;
        setPreviewMode();
        calculateLayout(currentContext, currentLayout);
        var elem = document.getElementById(viewId + SELF_NAME_ID);
        if (elem) {
            elem.innerHTML = name;
        }
    };

    function hidePreview() {
        currentContext.selfViewMode = "None";
        var elem = document.getElementById(viewId + SELF_NAME_ID);
        if (elem) {
            elem.innerHTML = "";
        }
        calculateLayout(currentContext, currentLayout);
    };

    function isShareFrame(frame) {
        if (frame && frame.className.indexOf(" share") !== -1) {
            return true;
        }
        return false;
    };

    function isVideoFrame(frame) {
        if (frame && frame.className.indexOf(" video") !== -1) {
            return true;
        }
        return false;
    };

    function setShareFrame(frame) {
        if (frame) {
            frame.className = frame.className.replace(" video", " share");
        }
    };

    function setVideoFrame(frame) {
        if (frame) {
            frame.className = frame.className.replace(" share", " video");
        }
    };

    function showVideo(type, index, name) {
        var frame = document.getElementById(viewId + REMOTE_FRAME_ID + index);
        var elem = document.getElementById(viewId + REMOTE_NAME_ID + index);

        if (elem) {
            elem.innerHTML = name;
        }

        if (currentContext.participants.indexOf(index) !== -1) {

            if (type === STREAM_TYPE_SHARE && isVideoFrame(frame)) {
                LogInfo("showVideo: switch from video to share index " + index); 
                hideVideo(STREAM_TYPE_VIDEO, index);
                showVideo(type, index, name);
            } else if (type === STREAM_TYPE_VIDEO && isShareFrame(frame)) {
                LogInfo("showVideo: switch from share to video index " + index); 
                hideVideo(STREAM_TYPE_SHARE, index);
                showVideo(type, index, name);
            } else {
                LogInfo("showVideo: " + type + " index " + index + " already shown");
            }
            return;
        }

        LogInfo("showVideo: " + type + " index " + index + " name " + name);

        currentContext.participantCount += 1;
        if (type === STREAM_TYPE_SHARE) {
            currentContext.numShares += 1;
            for (var i = 0; i < NUM_ELEMENTS; i++) {
                if (currentContext.participants[i] === -1) {
                    currentContext.participants[i] = index;
                    break;
                }
            }    
            setShareFrame(frame);
        } else {
            for (var i = NUM_ELEMENTS - 1; i >= 0; i--) {
                if (currentContext.participants[i] === -1) {
                    currentContext.participants[i] = index;
                    break;
                }
            }
            setVideoFrame(frame);
        }

        setPreviewMode(); // self view mode may change based on the number of participants
        calculateLayout(currentContext, currentLayout);
    };

    function hideVideo(type, index) {
        var i = 0;
        var elem = document.getElementById(viewId + REMOTE_NAME_ID + index);
        if (elem) {
            elem.innerHTML = "";
        }

        var isInLayout = (currentContext.participants.indexOf(index) !== -1);
        var poppedOut = (currentContext.poppedOutWindows[index] !== -1);

        if (!isInLayout && !poppedOut) {
            LogErr("hide: " + type + " index " + index + " already hidden");
            return;
        }

        LogInfo("hideVideo: " + type + " index " + index + " InLayout=" + isInLayout + " poppedOut=" + poppedOut); 

        // If the window is popped out, close it 
        if (poppedOut) {
            var wnd = currentContext.poppedOutWindows[index];
            currentContext.poppedOutWindows[index] = -1; // so that the unload handler is not processed
            wnd.close();
        } 

        // decrement and remove only if it is in the layout, else it is already decremented when popped out
        if (isInLayout) { 
            currentContext.participantCount -= 1;
            if (type === STREAM_TYPE_SHARE) {
                currentContext.numShares -= 1;
            }

            var pos = -1;
            for (i = 0; i < NUM_ELEMENTS; i++) {
                if (currentContext.participants[i] === index) {
                    currentContext.participants[i] = -1;
                    pos = i;
                    break;
                }
            }

            // Move the video elements to the end of the array so that the top slots are open for share
            // This is because the layout engine calculates the layout windows with preferred windows
            // followed by grid windows
            if (type === STREAM_TYPE_VIDEO) {
                for (i = pos; i > currentContext.numShares; i--) {
                    currentContext.participants[i] = currentContext.participants[i-1];
                }
                currentContext.participants[currentContext.numShares] = -1;
            } else if (type === STREAM_TYPE_SHARE) { 
                // Do not leave empty spaces at the top of the array followed by share for eg [-1, S, ..]
                // The next show will occupy the top space causing it to be shown in the preferred window
                for (i = pos; i < currentContext.numShares; i++) {
                    currentContext.participants[i] = currentContext.participants[i+1];
                }
                currentContext.participants[currentContext.numShares] = -1;
            }
        }

        setPreviewMode(); // self view mode may change based on the number of participants
        calculateLayout(currentContext, currentLayout);
    };


    function popIn(type, index, name) {
        if (currentContext.poppedOutWindows[index] !== -1) {
            currentContext.poppedOutWindows[index] = -1;
            LogInfo("popIn " + type + " index=" + index + " name=" + name);
            showVideo(type, index, name);
        } else {
            LogInfo("popIn " + type + " index=" + index + " name=" + name + " window closed");
        }
    };

    function popOut(e) {
        var videoElem = e.target;
        var frame = videoElem.parentNode;
        // Only share windows are allowed to popped out, but this can be changed to pop out videos as well
        if (frame && isShareFrame(frame)) {
            var layoutIndex = parseInt(frame.dataset.index, 10);
            var name = document.getElementById(viewId + REMOTE_NAME_ID + layoutIndex).innerHTML;
            var height = videoElem.videoHeight;
            var width = videoElem.videoWidth;

            var src = URL.createObjectURL(videoElem.srcObject);

            LogInfo("popOut share frame with id " + frame.id + " name=" + name + " index=" + layoutIndex + " Res=" + width + "x" + height + " src=" + src);
            hideVideo(STREAM_TYPE_SHARE, layoutIndex);
            currentContext.poppedOutWindows[layoutIndex] = window.open("", "Share - " + name, "width=" + width + ",height=" + height); 
            var html = "<html><head><title>Share - " + name + "</title></head><body style=\"background-color: #202020;\"><video autoplay src=\"" + src + "\" style=\"width: 100%; height: 100%;\"></video></body></html>";
            currentContext.poppedOutWindows[layoutIndex].document.write(html);
            currentContext.poppedOutWindows[layoutIndex].addEventListener("beforeunload", popIn.bind(null, STREAM_TYPE_SHARE, layoutIndex, name));
            currentContext.poppedOutWindows[layoutIndex].addEventListener("unload", popIn.bind(null, STREAM_TYPE_SHARE, layoutIndex, name));
        }
    };

    this.getVideoElement = function(type, index) {
        var frame;
        switch (type) {
            case STREAM_TYPE_PREVIEW:
                frame = document.getElementById(viewId + SELF_FRAME_ID);
            break;

            case STREAM_TYPE_SHARE:
            case STREAM_TYPE_VIDEO:
                if (NUM_ELEMENTS <= 1) {
                    index = 1;
                }
                frame = document.getElementById(viewId + REMOTE_FRAME_ID + (index-1));
            break;
        }

        if (frame) {
            return frame.getElementsByTagName("video")[0];
        }

        return frame;
    };

    this.show = function(type, index, name) {
        if (!initialized) {
            LogErr("show: NOT initialized");
            return;
        }
        if (NUM_ELEMENTS <= 1) {
            index = 1;
        }
        LogInfo("show " + type + " " + index + " " + name);
        switch (type) {
            case STREAM_TYPE_PREVIEW:
                showPreview(name);
            break;

            case STREAM_TYPE_SHARE:
            case STREAM_TYPE_VIDEO:
                showVideo(type, index-1, name);
            break;
        }
    };

    this.hide = function(type, index) {
        if (!initialized) {
            LogErr("hide: NOT initialized");
            return;
        }
        LogInfo("hide " + type + " " + index);
        if (NUM_ELEMENTS <= 1) {
            index = 1;
        }
        switch (type) {
            case STREAM_TYPE_PREVIEW:
                hidePreview();
            break;

            case STREAM_TYPE_SHARE:
            case STREAM_TYPE_VIDEO:
                hideVideo(type, index-1);
            break;
        }
    };

    this.videoStatus = function(type, index, status) {
        if (!initialized) {
            LogErr("videoStatus: NOT initialized");
            return;
        }
        LogInfo("videoStatus " + type + " " + index + " " + status);
        if (NUM_ELEMENTS <= 1) {
            index = 1;
        }
        var frame;
        switch (type) {
            case STREAM_TYPE_SHARE:
            case STREAM_TYPE_VIDEO:
                frame = document.getElementById(viewId + REMOTE_FRAME_ID + (index - 1));
            break;
        }

        if (frame) {
            if (status === "stalled") {
                frame.getElementsByTagName("video")[0].load();
            }
        }
    };

    this.showViewLabel = function(showLabel) {
        var display = showLabel ? "block" : "none";
        var view = document.getElementById(viewId);
        if (view) {
            var labels = view.getElementsByClassName("label");
            for (var i = 0; i < labels.length; i++) {
                labels[i].style.display = display;
            }
        }
    };
}


function VidyoClientTransport(plugInObj, statusChangeHandler, callbackHandler, plugInDivId){

    function randomString(length, chars) {
        var result = '';
        for (var i = length; i > 0; --i) result += chars[Math.floor(Math.random() * chars.length)];
        return result;
    }

    const MAX_RETRIES = 10;
    const WAIT_TIME_BEFORE_RETRY = 400; // first retry after 400 ms, second retry after 800ms, third retry after 1200ms and so on

    var sessionId = randomString(12, '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ');
    var contextObj = plugInObj;
    var statusChangeCallback = statusChangeHandler;
    var receiveCallback = callbackHandler;

    var session = "";
    var callId = "";
    var ms = "";
    var webrtcServer = VCUtils.webRTCServer;
    var requestNum = 1;
    var webrtcClient = new VidyoClientWebRTC(this);
    var connectionState = "CONNECTING";
    var eventsCounter = 1;

    var loggedInTimer = null;

    var requestQueue = [];
    var requestPending = -1;

    var logLevel = (VCUtils.params && VCUtils.params.webrtcLogLevel) ? VCUtils.params.webrtcLogLevel : "info";

    if (logLevel !== "info") {
        window.adapter.disableLog(true);
    }

    var GetTimeForLogging = function() {
        return new Date().toLocaleTimeString();
    };

    var LogInfo = function(msg) {
        if (logLevel === "info") {
            console.log(GetTimeForLogging() + " Transport: " + msg);
        }
    };


    var LogErr = function(msg) {
        if (logLevel === "info" || logLevel === "error") {
            console.error(GetTimeForLogging() + " Transport: " + msg);
        }
    };

    var connectionError = function() {
        if (connectionState === "CONNECTED" || connectionState === "CONNECTING") {
            webrtcClient.Uninitialize();
            connectionState = "DISCONNECTED";
            statusChangeCallback({state: "FAILED", description: "Disconnected from the WebRTC Server"});
        }
    };

    var TransportMessageSequential = function(url, params, async, successCb, errorCb, doLog) {
        requestQueue.push({url: url, params: params, async: async, successCb: successCb, errorCb: errorCb, doLog: doLog}); 
        CheckAndSendMessage();

    };

    var CheckAndSendMessage = function() {
        if (requestPending >= 0) {
            LogInfo("CheckAndSendMessage: Waiting for " + requestPending + " QLen=" + requestQueue.length);
        } else {
            if (requestQueue.length <= 0) {
                return;
            }
            var processQueue = requestQueue.splice(0, 10); // Process 10 at max
            var destination = processQueue[0].params.destination;
            var session = processQueue[0].params.session;
            var params = processQueue.map(function(r) { delete r.params.destination; delete r.params.session; return r.params});
            var callbacks = processQueue.map(function(r) { return [r.successCb, r.errorCb]});
            var url = processQueue[0].url;
            var async = processQueue[0].async;
            var data = {
                destination: destination,
                params: params,
                session: session
            };
            processQueue.length = 0;
            requestPending = params[0].requestNum;
            LogInfo("CheckAndSendMessage: Sending: " + requestPending + " - " + params[params.length-1].requestNum);
            TransportMessage(url, data, async, 
                function(a) {
                    requestPending = -1;
                    for (var i = 0; i < a.length; i++) {
                        callbacks[i][0](JSON.parse(a[i]));
                    }
                    CheckAndSendMessage();
                },
                function(e) {
                    requestPending = -1;
                    for (var i = 0; i < callbacks.length; i++) {
                        callbacks[i][1](e);
                    }
                    CheckAndSendMessage();
                }, true
            );
        }
    };

    var TransportMessage = function(url, params, async, successCb, errorCb, doLog) {
        if (connectionState !== "CONNECTING" && connectionState !== "CONNECTED") {
            LogErr("Transport Message in invalid state " + connectionState);
            return;
        }
        var start = Date.now();
        var paramsStr = JSON.stringify(params);
        var logStr = webrtcServer + url + ":" + paramsStr;
        if (doLog) {
            LogInfo("Req: async:" + async + " - " + logStr);
        }
        var oReq = new XMLHttpRequest();
        oReq.open("post", webrtcServer + url, async);

        oReq.onload = function() {
            if (oReq.status !== 200) {
                LogErr(logStr + " " + oReq.status + " " + oReq.statusText);
                errorCb(oReq.status + " " + oReq.statusText);
                return;
            }

            var logRespStr = oReq.responseText.replace(/VidyoRoomFeedbackGetRoomPropertiesResult.*VIDYO_ROOMGETPROPERTIESRESULT/, "VidyoRoomFeedbackGetRoomPropertiesResult*****VIDYO_ROOMGETPROPERTIESRESULT");
            if (doLog) {
                LogInfo("Resp: [" + (Date.now() - start) + "] " + logStr + " response: " + logRespStr);
            }

            try {
                var response = JSON.parse(oReq.responseText);
                successCb(response);
                return;
            } catch (e) {
                LogErr("TransportMessage: " + logStr + " Exception - " + e.stack + " " +  e);
                // statusChangeCallback({error: e});
            }
        };

        oReq.onerror = function(e) {
            LogErr(logStr + " onerror: " +  e);
            errorCb("error");
        };

        oReq.onabort = function(e) {
            LogErr(logStr + " onabort: " +  e);
            errorCb("abort");
        };

        oReq.send(paramsStr);

    };


    var HandleEvents = function(evts) {
        for (var i = 0; i < evts.length; i++) {
            switch(evts[i].destination) {
                case "VidyoWebRTC":
                    webrtcClient.callback(evts[i].data);
                break;

                case "VidyoClient":
                    try {
                        receiveCallback(contextObj, JSON.parse(evts[i].data));
                    } catch (e) {
                        LogErr("HandleEvents: VidyoClient error: " + e.stack + " " + e);
                        // statusChangeCallback({error: e});
                    }
                    break;
            }
        }
    };

    var LongPoll = function(retryCnt) {
        if (retryCnt === undefined) {
            retryCnt = 0;
            eventsCounter++;
        } 

        TransportMessage("/events", {session: session, count: eventsCounter}, true,
            function(resp) {
                HandleEvents(resp);
                LongPoll();
            }, function(err) {
                if (err === "error" || err === "abort") {
                    if (retryCnt <= MAX_RETRIES) { 
                        retryCnt++;
                        var timeout = retryCnt * WAIT_TIME_BEFORE_RETRY;
                        LogInfo("LongPoll err=" + err + " retrying after " + timeout + "ms");
                        setTimeout(function() {
                            LongPoll(retryCnt);
                        }, timeout);
                    } else {
                        connectionError();
                    }
                } else {
                    connectionError();
                }
            }, true);
    };

    var Initialize = function() {
        TransportMessage("/initialize", {version: VCUtils.version}, true, function(resp) {
            session = resp.session;
            callId = resp.callId;
            ms = resp.ms;
            if (resp.host.length > 0) {
                webrtcServer = "https://" + resp.host;
            }
            connectionState = "CONNECTED";
            statusChangeCallback({state: "READY", description: "WebRTC successfully loaded"});
            LongPoll();
            }, function() {
                connectionState = "DISCONNECTED";
                statusChangeCallback({state: "FAILED", description: "Could not initialize WebRTC transport"});
            }, true);
    };

    this.UpdateViewOnDOM = function(uiEvent, parentDivId, arg1, arg2, arg3, arg4){
        var plugInDivId = parentDivId ? sessionId + "_" + parentDivId : parentDivId;
        var type = "RENDERER";
        if((uiEvent.indexOf("create") !== -1) || (uiEvent.indexOf("constructor") !== -1) || (uiEvent.indexOf("AssignView") !== -1)){
            if(parentDivId){
                VCUtils.jQuery('#' + parentDivId).html("<div id='" + plugInDivId + "' vidyoclientplugin_type='" + type + "' class='VidyoClientPlugIn' style='width: 100%; height: 100%;'></div>");
            }
        }
        else if (uiEvent.indexOf("ShowView") !== -1){
        }
        else if (uiEvent.indexOf("HideView") !== -1){
            if(parentDivId){
                VCUtils.jQuery('#' + parentDivId).html('');
            }
        }

        if (uiEvent === "constructor" || uiEvent === "create") {
            if (!parentDivId) {
                webrtcClient.setRendererType(RENDERER_TYPE_TILES);
            } else {
                webrtcClient.setRendererType(RENDERER_TYPE_COMPOSITE);
            }
        } else if (uiEvent === "SetViewBackgroundColor") {
            if (parentDivId) {
                VCUtils.jQuery('#' + plugInDivId).css("background-color", "rgb(" + arg1 + "," + arg2 + "," + arg3 + ")");
            }
        } else if (uiEvent === "ShowViewLabel") {
            webrtcClient.showViewLabel(plugInDivId, arg1);
        }

        return plugInDivId;
    }

    function SendVidyoClientMessage(data, asyncSuccess, asyncFailure, async, reqNum, retryCount) {
        var request = {
            destination: "VidyoClient",
            data: data,
            requestNum: reqNum,
            session: session
        };
        var ret;
        var localAsync = false;
        var failureCallback = connectionError;
        if (async === true && typeof asyncSuccess === "function" && typeof asyncFailure === "function") {
            localAsync = async;
            failureCallback = asyncFailure;
        }

        TransportMessageSequential("/transport", request, localAsync,
            function(response) {
                ret = response;
                if (localAsync) {
                    asyncSuccess(response);
                }
                return response;
            }, function(err) {
                if (err === "error" || err === "abort") {
                    if (retryCount <= MAX_RETRIES) {
                        retryCount++;
                        var timeout = retryCount * WAIT_TIME_BEFORE_RETRY;
                        LogInfo("SendVidyoClientMessage err=" + err + " retrying after " + timeout + "ms");
                        setTimeout(function() {
                            SendVidyoClientMessage(data, asyncSuccess, asyncFailure, async, reqNum, retryCount);
                        }, timeout);
                    } else {
                        connectionError();
                    }
                } else {
                    connectionError();
                }
            }, true);

        return ret;
    }

    this.SendMessage = function(data, asyncSuccess, asyncFailure, async){

        if (connectionState !== "CONNECTED") {
            LogErr("SendMessage in invalid state " + connectionState);
            return {result: "error"};
        }

        return SendVidyoClientMessage(data, asyncSuccess, asyncFailure, async, requestNum++, 0);
    };

    function SendWebRTCMessageWithRetry(params, cb, retryCount) {
        var request = {
            destination: "VidyoWebRTC",
            data: JSON.stringify(params),
            session: session
        };
        TransportMessage("/transport", request, true, cb, function(err) {
            if (err === "error" || err === "abort") {
                if (retryCount <= MAX_RETRIES) {
                    retryCount++;
                    var timeout = retryCount * WAIT_TIME_BEFORE_RETRY;
                    LogInfo("SendWebRTCMessage err=" + err + " retrying after " + timeout + "ms");
                    setTimeout(function() {
                        SendWebRTCMessageWithRetry(params, cb, retryCount);
                    }, timeout);
                } else {
                    connectionError();
                }
            } else {
                connectionError();
            }
        }, params.method !== 'VidyoWebRTCStats');
    };

    this.SendWebRTCMessage = function(params, cb) {
        if (connectionState !== "CONNECTED") {
            LogErr("SendMessage in invalid state " + connectionState);
            return false; 
        }

        SendWebRTCMessageWithRetry(params, cb, 0);
        return true;
    };

    this.SendLogs = function(logs, cb) {
        var oReq = new XMLHttpRequest();
        oReq.open("post", webrtcServer + "/uploadlogs?callId="+callId+"&mediaserver="+ms, true);

        oReq.onload = function() {
            cb(true);
        };

        oReq.onerror = function(e) {
            LogErr("SendLogs: onerror: " +  e);
            cb(false);
        };

        oReq.onabort = function(e) {
            LogErr("SendLogs: onabort: " +  e);
            cb(false);
        };


        oReq.send(logs);
    };


    this.Uninitialize = function() {
        webrtcClient.Uninitialize();
        connectionState = "DISCONNECTED";
        statusChangeCallback({state: "DISCONNECTED", description: "Disconnected from WebRTC Server"});
    };

    Initialize();
}

w.VidyoClientTransport = VidyoClientTransport;

})(window);

