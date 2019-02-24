/*
 * Roots.js
 * Copyright (c) 2014-present  Dan Kranz
 * Release: February 23, 2019
 */
 
var Roots = Roots || {};

// ----- Local file using File API --------------------------------------------

// See: https://www.w3.org/TR/file-upload/

Roots.GetLocalFile = function(fn, callback) {
  var reader = new FileReader();
  
  reader.onerror = function(e) {
    alert("Error reading: " + fn);
    callback(undefined);
  };

  reader.onloadend = function(e) {
    callback(reader.result);
  };

  // Read file into memory as UTF-8
  reader.readAsText(fn, "UTF-8");
}

Roots.initCSV = function(text) {

}

Roots.parseCSV = function(text) {
  
}

// ----- Google Drive ---------------------------------------------------------

// The Client ID obtained from the Google API Console.
// Replace with your own Client ID.
var _clientId = '\x39\x34\x35\x38\x34\x37\x35\x35\x32\x34\x37\x39';
_clientId += '\x2d\x63\x6e\x66\x6e\x75\x73\x76\x68\x68\x70\x70\x73';
_clientId += '\x71\x70\x68\x76\x66\x65\x6b\x6d\x71\x69\x62\x30\x39';
_clientId += '\x32\x68\x74\x35\x73\x73\x69\x2e\x61\x70\x70\x73\x2e';
_clientId += '\x67\x6f\x6f\x67\x6c\x65\x75\x73\x65\x72\x63\x6f\x6e';
_clientId += '\x74\x65\x6e\x74\x2e\x63\x6f\x6d';

// The Browser API key obtained from the Google API Console.
var _developerKey = '\x41\x49\x7a\x61\x53\x79\x43\x2d\x72\x42\x30';
_developerKey += '\x33\x36\x49\x5f\x4a\x56\x5a\x78\x4a\x41\x79\x79';
_developerKey += '\x4c\x6f\x6a\x34\x30\x78\x58\x4e\x64\x68\x73\x68';
_developerKey += '\x35\x67\x47\x55';

var _scope = 'https://www.googleapis.com/auth/drive';

var _APIsLoaded = false;
var _oauthToken = undefined;

var _callback;

_onAuthApiLoad = function() {
  gapi.auth2.authorize({
    client_id: _clientId,
    scope: _scope
  }, _handleAuthResult);
}

// Create and render a Picker object for selecting user files.
_createPicker = function() {
  if (_APIsLoaded && _oauthToken) {
    var view1 = new google.picker.DocsView(google.picker.ViewId.DOCS)
    .setMode(google.picker.DocsViewMode.LIST)
    .setQuery("*.ndl");
    var view2 = new google.picker.DocsView(google.picker.ViewId.DOCS)
    .setMode(google.picker.DocsViewMode.LIST)
    .setQuery("*.csv");
    var picker = new google.picker.PickerBuilder().
    addView(view1).
    addView(view2).
    setOAuthToken(_oauthToken).
    setDeveloperKey(_developerKey).
    setCallback(_pickerCallback).
    build();
    picker.setVisible(true);
  }
}

_onPickerApiLoad = function() {
  _APIsLoaded = true;
  _createPicker();
}

_handleAuthResult = function(authResult) {
  if (authResult && !authResult.error) {
    _oauthToken = authResult.access_token;
    _createPicker();
  }
}

_pickerCallback = function(data) {
  if (data[google.picker.Response.ACTION] === google.picker.Action.PICKED) {
    var doc = data[google.picker.Response.DOCUMENTS][0];
    var mimeType = doc.mimeType;
    var fileId = doc[google.picker.Document.ID];
    var url = 'https://www.googleapis.com/drive/v3/files/' + fileId + '?alt=media';

    var xhr = new XMLHttpRequest();
    xhr.onload = function() {
      if (this.status == 200 && this.responseText != null) {
        _callback(this.responseText);
      }
    };
    xhr.open('GET',url);
    xhr.setRequestHeader('Authorization', 'Bearer ' + _oauthToken);
    xhr.send();
  }
}

// Get a file from Google Drive
Roots.GDriveGetFile = function(callback) {
  _callback = callback;
  gapi.load('client');
  gapi.load('auth2', _onAuthApiLoad);
  gapi.load('picker', _onPickerApiLoad);
}
