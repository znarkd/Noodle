/*
 * The Noodle Database object.
 * Copyright (c) 2018-present  Dan Kranz
 * Release: December 19, 2018
 */

function NoodleDatabase(stream) {
  var name;
  var field = [];
  var base = {};
  var table = [];
  var ndlEditScreen = [];
  var blkfld = [];
    
  // Utility functions
  
  // https://gist.github.com/getify/7325764
  convertBaseToUint8Array = function(bStr) {
    var i, len = bStr.length, u8_array = new Uint8Array(len);
    for (i=0; i < len; i++) {
      u8_array[i] = bStr.charCodeAt(i);
    }
    return u8_array;
  }
  
  convertBaseToBinaryString = function(u8Array) {
    var i, len = base.cpl * base.nline, b_str = "";
    for (i=0; i < len; i++) {
      b_str += String.fromCharCode(u8Array[i]);
    }
    return b_str;
  }
  
  // This function can be removed once browsers support ArrayBuffer.transfer.
  // See https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/ArrayBuffer/transfer
  transfer = function(source, length) {
    if (!(source instanceof Uint8Array))
      throw new TypeError('Source must be an instance of Uint8Array');
    if (length <= source.length)
      return source.slice(0, length);
    var destView = new Uint8Array(length);
    destView.set(source);
    return destView;
  }
  
  // Constructor
  
  if (stream === undefined || stream === null) {
    name = "new";
    base.cpl = 0;
    base.nline = 0;
    base.block = new Uint8Array();
  }
  else {
    try {
      var ary = JSON.parse(stream);
      name = ary.NoodleDatabase.name;
      field = ary.NoodleDatabase.field;
      base = ary.NoodleDatabase.base;
      base.block = convertBaseToUint8Array(window.atob(base.block));
      table = ary.NoodleDatabase.table;
      ndlEditScreen = ary.NoodleDatabase.screen;
      
      var start = 1;
      for (var i=0; i < field.length; i++) {
        blkfld[i] = [];
        blkfld[i][0] = start;
        blkfld[i][1] = field[i].cpl;
        start += field[i].cpl;
      }
    }
    catch(err) {
      throw ("NoodleDatabase: Invalid format!");
    }
  }
  
  this.length = function() {
    return base.nline;
  }
  
  // Return the field names in an array
  
  this.GetFieldLabels = function() {
    var i, labels = [];
    
    for (i=0; i < field.length; i++) {
      labels.push(field[i].name);
    }
    return labels;
  }
  
  // Get the database's edit screens
  
  this.getScreens = function() {
    return ndlEditScreen;
  }
  
  // Compare field values
  
  // Note: The list parameter is included only for compatibility with Roots.
  
  this.Compare = function(list, a, b, sortColumns) {
    var aval, bval, v=[], rc;
    for (var i=0; i < sortColumns.length; i++) {
      switch(field[sortColumns[i]-1].type) {
        case 'T':
        case 'B':
        case 'D':
        case 'Z':
          v[0] = (a * base.cpl) + blkfld[sortColumns[i]-1][0];
          v[1] = blkfld[sortColumns[i]-1][1];
          aval = Roots.bunpac(base.block, v);
          v[0] = (b * base.cpl) + blkfld[sortColumns[i]-1][0];
          bval = Roots.bunpac(base.block, v);
          rc = aval - bval;
          if (rc != 0)
            return rc;
          break;
        case 'R':
          break;
        case 'E':
          v[0] = (a * base.cpl) + blkfld[sortColumns[i]-1][0] - 1;
          aval = base.block.slice(v[0], v[0]+blkfld[sortColumns[i]-1][1]).join('');
          v[0] = (b * base.cpl) + blkfld[sortColumns[i]-1][0] - 1;
          bval = base.block.slice(v[0], v[0]+blkfld[sortColumns[i]-1][1]).join('');
          rc = aval.localeCompare(bval);
          if (rc != 0)
            return rc;
          break;
        default:
          throw new TypeError("NoodleDatabase: Invalid data type.");
      }
    }
    return 0;
  }
  
  // Get a field value from the database
  
  this.LineValue = function(line, bfi) {
    if (line <= 0 || line > base.nline)
      throw new TypeError("NoodleDatabase: Invalid line number.");
    if (bfi > field.length)
      throw new TypeError("NoodleDatabase: Invalid field index");
    
    var bin, v=[];
    v[0] = ((line-1) * base.cpl) + blkfld[bfi-1][0];
    v[1] = blkfld[bfi-1][1];
    
    switch(field[bfi-1].type) {
      case 'T':
        bin = Roots.bunpac(base.block, v);
        if (bin === 0)
          return "";
        return table[field[bfi-1].tindex-1].item[bin-1].toString();
        break;
      case 'B':
         bin = Roots.bunpac(base.block, v);
        return bin.toString();
        break;
      case 'D':
        bin = Roots.bunpac(base.block, v);
        return bin.toString();
        break;
      case 'Z':
        bin = Roots.bunpac(base.block, v);
        return bin.toString();
        break;
      case 'R':
        break;
      case 'E':
        return base.block.slice(v[0]-1, v[0]-1+v[1]).join('');
        break;
      default:
        throw new TypeError("NoodleDatabase: Invalid data type.");
    }
  }
  
  // Add a new line
  
  this.push = function() {
    if (base.cpl <= 0)
      throw("NoodleDatabase: base cpl < 1");
    
    // Allocate memory if needed.  Allow room for additional growth.
    var need = base.cpl * (base.nline+1);
    if (need > base.block.length)
      base.block = transfer(base.block, base.cpl * (base.nline+200));
    
    // Add the new line
    base.nline += 1;
    return base.nline;
  }
  
  // Save a value to the database
  
  this.PutLineValue = function(val, line, bfi) {
    if (line <= 0 || line > base.nline)
      throw new TypeError("NoodleDatabase: Invalid line number.");
    if (bfi > field.length)
      throw new TypeError("NoodleDatabase: Invalid field index");
    
    var v=[];
    v[0] = ((line-1) * base.cpl) + blkfld[bfi-1][0];
    v[1] = blkfld[bfi-1][1];

    switch(field[bfi-1].type) {
      case 'T':
        var index = table[field[bfi-1].tindex-1].item.indexOf(val) + 1;
        if (index <= 0)
          index = table[field[bfi-1].tindex-1].item.push(val);
        Roots.pacbin(index, base.block, v);
        break;
      case 'B':
      case 'Z':
        if (Number(val) != NaN)
          Roots.pacbin(Math.trunc(val), base.block, v);
        else
          Roots.pacbin(0, base.block, v);
        break;
      case 'D':
        break;
      case 'R':
        break;
      case 'E':
        var vstr = val.split('');
        var len = vstr.length;
        if (len > v[1]) len = v[1];
        var rest = v[1] - len;
        var i = v[0]-1, j=0;
        while (len-- > 0)
          base.block[i++] = vstr[j++];
        while (rest-- > 0)
          base.block[i++] = ' ';
        break;
      default:
        throw new TypeError("NoodleDatabase: Invalid data type.");
    }
  }
}