/* Transport facilitates communication between the library and the VidyoClient.js */

function GetElectronWindowHandle()
{
    const { remote, BrowserWindow } = require('electron');
    const currentWindow = remote.getCurrentWindow();
    return currentWindow.getNativeWindowHandle();
}

function VidyoClientTransport(plugInObj, onStatus, onCallback, plugInDivId){

	var contextObj = plugInObj;
	var onStatus = onStatus;
	var onCallback = onCallback;
	var plugInVersion;
	var status = "INITIALIZING";
	/* use a local namespace for jQuery */
	var $ = VCUtils.jQuery;
	const VidyoAddon = require('electron').remote.require('./build/Release/VidyoAddon');
	VidyoAddon.VidyoAddonInit();	

	var onStatus_ = function(event) {
		if (event.status != status && status != "UNREACHABLE") {
			status = event.status;
			if (onStatus) {
				onStatus(event);
			}
		}
	}
	
	var DEBUG = false;
	function randomString(length, chars) {
		var result = '';
		for (var i = length; i > 0; --i) result += chars[Math.floor(Math.random() * chars.length)];
		return result;
	}

	this.UpdateViewOnDOM = function(uiEvent, parentDivId, x, y, w, h){
		var electronViewId = parentDivId ? GetElectronWindowHandle().toString('hex') + "_" + parentDivId : parentDivId;
		return electronViewId;
	}
	
	var SendMessage_ = function(data, OnSuccess, OnError, Async){
		var ret;
		var isAsync = Async ? true : false;
		try {
			var responseStr = VidyoAddon.VidyoAddonDispatch("/VidyoClientAPI/" + data);
			var response = $.parseJSON(responseStr);
			
		} catch(err) {
			onStatus_({state: "FAILED", description: "Plugin failed to load or crashed", type: "METHOD"});
			if (isAsync)
				OnError(response);
			ret = null;
		}
		if (!response) {
			/* plugin respoinse could not be parsed */
			onStatus_({state: "FAILED", description: "Invalid response from the plugin", type: "METHOD"});
			if (isAsync)
				OnError("Invalid response received from the server");
			else
				ret = null;
		} else {
			if (response.result == "ok") {
				if(isAsync)
					OnSuccess(response);
				else
					ret = response;
			} else {
				if (isAsync)
					OnError(response);
				else
					ret = response;
			}
		}
		return ret;
	}
	
	var StartCallbackPoll = function() {
		var ret;
		SendMessage_("GetCallbacks",
			function(response) {
				onCallback(contextObj, response);
				setTimeout($.proxy(StartCallbackPoll, this), 1000);
			},
			function(errorText) {
				window.console && console.log("CALLBACK ERROR: " + errorText);
			},
			true
		);
	}
	
	this.SendMessage = function(data, OnSuccess, OnError, Async){
		return SendMessage_(data, OnSuccess, OnError, Async);
	}
	var GetVersion = function() {
		response = SendMessage_("GetVersion");

		if (response && response.data){
			return response.data.version;
		} else {/* Server response is valid */
			return null;
		}
	}
	
	var OnReady_ = function () {
		StartCallbackPoll();
		onStatus_({state: "READY", description: "Plugin successfully loaded", type: "METHOD"});
	}
	
	plugInVersion = GetVersion();

	if (plugInVersion == VCUtils.version){
		/* run asynchronously since the client library needs to finish constructing before READY is called */
		setTimeout($.proxy(OnReady_, this), 10);
	} else {
		onStatus_({state: "FAILEDVERSION", description: "Plugin(" + plugInVersion + ") and Javascript(" + VCUtils.version + ") versions do not match.", plugInVersion: plugInVersion, jsVersion: VCUtils.version, type: "METHOD"});
	}
}
