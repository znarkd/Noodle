/*
 * Roots.js
 * Copyright (c) 2014-present  Dan Kranz
 * Release: October 24, 2020
 */
 
var Roots = Roots || {};

// ----- Local file using File API --------------------------------------------

// See: https://www.w3.org/TR/file-upload/

Roots.GetLocalFile = function(file, callback) {
  var reader = new FileReader();
  
  reader.onerror = function(e) {
    alert("Error reading: " + file.name);
    callback(undefined);
  };

  reader.onloadend = function(e) {
    var type = file.name.substring(file.name.lastIndexOf('.') + 1, file.name.length) || file.name;
    var f = {
      name: file.name,
      type: type,
      data: reader.result
    }
    callback(f);
  };

  // Read file into memory as UTF-8
  reader.readAsText(file, "UTF-8");
}

// Attempt to determine the seperator character
// used by a CSV file, either comma or tab.

Roots.initCSV = function(text) {
  var i; n = text.length;
  var ch, inquote = false;
  var tab=0, comma=0, lines=0;

  for (i=0; i < n; i++) {
    ch = text[i];
    if (! inquote) {
      if (ch === '"')
        inquote = true;
      if (ch === ',')
        comma += 1;
      else if (ch === '\t')
        tab += 1;
      else if (ch === '\n') {
        if (++lines > 3)
          break;
      }
    }
    else {
      if (ch === '"')
        inquote = false;
      else if (ch === '\n') {
        if (++lines > 3)
          break;
      }
    }
  }
  if (comma > tab)
    return ',';
  return '\t';
}

// Turn a CSV file into an array

Roots.parseCSV = function(text, seperator) {
  var i, ch, test, sb;
  var inquote = false;
  var n = text.length;
  sb = "";
  var columns = [];
  var arr = [];
  
  for (i=0; i < n; i++) {
     ch = text[i];

     // Not in a quoted string
     if (!inquote) {

        // End of column
        if (ch === seperator) {
          columns.push(sb.toString());
          sb = "";
        }

        else {

           // End of line
           if (ch === '\n') {
             if (sb.length > 0)
               columns.push(sb.toString());
               sb = "";
               arr.push(columns);
               columns = [];
               continue;
           }

           // Start quote
           if (ch === '"')
              inquote = true;

           // Ignore leading white space
           else if ((ch === ' ' || ch === '\t') && sb.length === 0)
              continue;

           // Append a character to the column value, ignore carriage return character.
           else if (ch != '\r')
              sb += ch;
        }
     }

     // Inside a quoted string
     else {

        // Add to the quoted string
        if (ch != '"')
           sb += ch;

        // Closing quote?
        else {

           // Look at the next character.
           // Two quotes together are used for embedded quote marks.
           test = text[i+1];

           // closing quote
           if (test != '"') {
              inquote = false;
           }

           // embedded quote
           else {
              ch = text[++i];
              sb += ch;
           }
        }
     }
  }

  // Close out the last column
  if (sb.length > 0)
    columns.push(sb.toString());
  
  if (columns.length > 0)
    arr.push(columns);

  return arr;
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
      .setQuery("*.ndl || *.csv");
    var picker = new google.picker.PickerBuilder().
    addView(view1).
    setOAuthToken(_oauthToken).
    setDeveloperKey(_developerKey).
    setCallback(_pickerCallback).
    build();
    picker.setVisible(true);
  }
}

_onPickerApiLoad = function() {
  _APIsLoaded = true;
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

    if (doc.type != "file") {
      alert("Can't download files of type: " + doc.type);
      return;
    }

    var name = doc[google.picker.Document.NAME];
    var type = name.substring(name.lastIndexOf('.') + 1, name.length) || name;
    var fileId = doc[google.picker.Document.ID];
    var parentId = doc[google.picker.Document.PARENT_ID];
    var url = 'https://www.googleapis.com/drive/v3/files/' + fileId + '?alt=media';

    var xhr = new XMLHttpRequest();
    xhr.onload = function() {
      if (this.status == 200 && this.responseText != null) {
        var gfile = {
          name: name,
          type: type,
          id: fileId,
          parentId: parentId,
          data: this.responseText
        };
        _callback(gfile);
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
  gapi.load('auth2', _onAuthApiLoad);
  gapi.load('picker', _onPickerApiLoad);
}
