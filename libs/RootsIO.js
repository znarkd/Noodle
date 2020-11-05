/*
 * RootsIO.js
 * Copyright (c) 2014-present  Dan Kranz
 * Release: November 4, 2020
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
      data: reader.result,
      source: "FileSystem"
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

var _oauthToken = undefined;
var _origin;
var _callback;

_onAuthApiLoad = function() {
  gapi.auth2.authorize({
    client_id: _clientId,
    scope: _scope
  }, _handleAuthResult);
}

_handleAuthResult = function(authResult) {
  if (authResult && !authResult.error) {
    _oauthToken = authResult.access_token;
    _callback();
  }
}

// Start a Google Drive process

Roots.GDriveStart = function(callback) {
  _callback = callback;
  _origin = window.location.protocol + '//' + window.location.host;
  gapi.load('auth2', _onAuthApiLoad);
}

// Get a list of files from Google Drive

Roots.GDriveList = function(callback, parentId) {
  var url = 'https://www.googleapis.com/drive/v3/files?';
  url += "fields=files(id,name,mimeType,parents,fileExtension,headRevisionId)&q=";
  if (parentId === undefined)
    url += "\"root\" in parents and trashed=false";
  else {
    url += parentId;
    url += " in parents and trashed=false";
  }
  url += " and mimeType != 'application/vnd.google-apps.document'";
  url += " and mimeType != 'application/vnd.google-apps.spreadsheet'";
  url += " and (mimeType = 'application/vnd.google-apps.folder'";
  url += " or fileExtension = 'ndl'";
  url += " or fileExtension = 'csv'";
  url += " or fileExtension = 'json')";
  url += "&pageSize=1000";

  var xhr = new XMLHttpRequest();
  xhr.onload = function() {
    if (this.status == 200 && this.responseText != null) {
      if (callback != undefined)
        callback(this.responseText);
    }
  };
  xhr.open('GET', url);
  xhr.setRequestHeader('Authorization', 'Bearer ' + _oauthToken);
  xhr.send();
}

// Get a file from Google Drive

Roots.GDriveGetFile = function(file, callback) {
  var url = 'https://www.googleapis.com/drive/v3/files/' + file.id + '?alt=media';
  
  var xhr = new XMLHttpRequest();
  xhr.onload = function(e) {
    if (this.status == 200 && this.responseText != null) {
      var gfile = {
        name: file.name,
        type: file.fileExtension,
        id: file.id,
        parentId: file.parents[0],
        data: this.responseText,
        source: "GDrive"
      };
      if (callback != undefined)
        callback(gfile);
    }
  };
  xhr.open('GET', url);
  xhr.setRequestHeader('Authorization', 'Bearer ' + _oauthToken);
  xhr.send();
}

// Write a file to Google Drive
// https://tanaikech.github.io/2018/08/13/upload-files-to-google-drive-using-javascript/

Roots.GDrivePutFile = function(file, callback) {
  var method="POST", metadata, form;
  var gfile = new Blob([file.data], {type: 'application/json'});
  var url = "https://www.googleapis.com/upload/drive/v3/files";
 
  if (file.id != undefined) {
    url += "/" + file.id;
    method = "PATCH";
  }
  
  url += "?uploadType=multipart&fields=id,name,mimeType,parents,fileExtension,headRevisionId";
  metadata = {
    'name': file.name,
    'mimeType': 'application/json'
  };
  form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(metadata)], {type: 'application/json'}));
  form.append('file', gfile);

  var xhr = new XMLHttpRequest();
  xhr.open(method, url);
  xhr.setRequestHeader('Authorization', 'Bearer ' + _oauthToken);
  xhr.responseType = 'json';
  xhr.onload = function() {
    callback(xhr.response);
  };
  xhr.send(form);
}
