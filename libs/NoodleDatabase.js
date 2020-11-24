/*
 * The Noodle Database object.
 * Copyright (c) 2018-present  Dan Kranz
 * Release: November 23, 2020
 */

function NoodleDatabase(stream) {
  var name;
  var field = [];
  var base = {};
  var table = [];
  var ndlEditScreen = [];
  var blkfld = [];

  var myself = this;
    
  // Utility functions
  
  // https://gist.github.com/getify/7325764
  convertBinaryStringToUint8Array = function(bStr) {
    var i, len = bStr.length, u8_array = new Uint8Array(len);
    for (i=0; i < len; i++) {
      u8_array[i] = bStr.charCodeAt(i);
    }
    return u8_array;
  }
  
  convertUint8ArrayToBinaryString = function(u8Array) {
    var i, len = base.cpl * base.nline, b_str = "";
    for (i=0; i < len; i++) {
      b_str += String.fromCharCode(u8Array[i]);
    }
    return b_str;
  }
  
  validateField = function(i) {
    if (field[i].width <= 0)
      throw("display width < 1");

    switch (field[i].type) {
      // Tabular
      case 'T':

      // Binary
      case 'B':

      // Binary - displayed with leading zeros
      case 'Z':
        if (field[i].cpl <= 0 || field[i].cpl > 4)
          throw("Invalid cpl for Type-" + field[i].type);
        break;

      // Date
      case 'D':
        if (field[i].cpl != 4)
          throw("cpl for Type-D must equal 4");
        break;

      // Real
      case 'R':
        if (field[i].cpl != 4 && field[i].cpl != 8)
          throw("cpl for Type-R must be 4 or 8");
        if (field[i].decimals === undefined)
          throw("Type-R requires decimals value")

      // Elemental data (stored as found in data source)
      case 'E':
        break;

      default:
        throw("Invalid data type");
    }
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
      base.block = convertBinaryStringToUint8Array(window.atob(base.block));
      table = ary.NoodleDatabase.table;
      ndlEditScreen = ary.NoodleDatabase.screen;
      
      // Save field's location in base.block and perform validity checks

      var start = 1;
      for (var i=0; i < field.length; i++) {
        blkfld[i] = [];
        blkfld[i][0] = start;
        blkfld[i][1] = field[i].cpl;
        start += field[i].cpl;

        validateField(i);
      }
    }
    catch(err) {
      throw("NoodleDatabase: Invalid format. " + err);
    }
  }
  
  // Return the number of rows (lines) in the database

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

  // Return a field type

  this.GetDataType = function(bfi) {
    return field[bfi-1].type;
  }
  
  // Get the database's edit screens
  
  this.GetEditScreens = function() {
    return ndlEditScreen;
  }
  
  // Compare field values
  
  // Note: The list parameter is included only for compatibility with Roots.
  
  this.Compare = function(list, a, b, sortColumns) {
    var i, k, aval, bval, v=[], rc;
    for (i=0; i < sortColumns.length; i++) {
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
          v[0] = (a * base.cpl) + blkfld[sortColumns[i]-1][0];
          v[1] = blkfld[sortColumns[i]-1][1];
          aval = Roots.runpac(base.block, v);
          v[0] = (b * base.cpl) + blkfld[sortColumns[i]-1][0];
          bval = Roots.runpac(base.block, v);
          rc = aval - bval;
          if (rc != 0)
            return rc;
          break;
        case 'E':
          v[0] = (a * base.cpl) + blkfld[sortColumns[i]-1][0] - 1;
          v[1] = blkfld[sortColumns[i]-1][1];
          aval = base.block.slice(v[0], v[0]+v[1]);
          v[0] = (b * base.cpl) + blkfld[sortColumns[i]-1][0] - 1;
          bval = base.block.slice(v[0], v[0]+v[1]);
          for (k=0; k < v[1]; k++) {
            if (aval[k] != bval[k])
              return aval[k] - bval[k];
          }
          break;
        default:
          throw("NoodleDatabase: Invalid data type");
      }
    }
    return 0;
  }
  
  // Get a field value from the database
  
  this.LineValue = function(line, bfi) {
    if (line <= 0 || line > base.nline)
      throw("NoodleDatabase: Invalid line number");
    if (bfi > field.length)
      throw("NoodleDatabase: Invalid field index");
    
    var num, v=[];
    v[0] = ((line-1) * base.cpl) + blkfld[bfi-1][0];
    v[1] = blkfld[bfi-1][1];
    
    switch(field[bfi-1].type) {
      case 'T':
        num = Roots.bunpac(base.block, v);
        if (num === 0)
          return "";
        return table[field[bfi-1].tindex-1].item[num-1].toString();
      case 'B':
        num = Roots.bunpac(base.block, v);
        return num.toString();
      case 'D':
        num = Roots.bunpac(base.block, v);
        if (num === 0)
          return "";
        var y = Math.trunc(num/10000);
        var m = "0" + Math.trunc((num%10000)/100);
        var d = "0" + Math.trunc(num%100);
        return m.slice(-2) + '/' + d.slice(-2) + '/' + y;
      case 'Z':
        num = Roots.bunpac(base.block, v);
        return num.toString().padStart(field[bfi-1].width, '0');
      case 'R':
        num = Roots.runpac(base.block, v);
        return num.toFixed(field[bfi-1].decimals);
      case 'E':
        var decoder = new TextDecoder("utf-8");
        return decoder.decode(base.block.slice(v[0]-1, v[0]-1+v[1]));
      default:
        throw("NoodleDatabase: Invalid data type");
    }
  }
  
  // Add a new line (row) to the database
  
  this.push = function() {
    if (base.cpl <= 0)
      throw("NoodleDatabase: base cpl < 1");
    
    // Allocate memory if needed.  Allow room for additional growth.
    var need = base.cpl * (base.nline+1);
    if (need > base.block.length)
      base.block = Roots.transfer(base.block, base.cpl * (base.nline+200));
    
    // Add the new line
    base.nline += 1;

    // Blank the new line per field type
    for (var i=0; i < field.length; i++) {
      if (field[i].type === 'E')
        this.PutLineValue(" ", base.nline, i+1);
    }

    return base.nline;
  }
  
  // Save a value to the database

  const _maxval = [255,65535,16777215,2147483647];
  
  this.PutLineValue = function(val, line, bfi) {
    if (line <= 0 || line > base.nline)
      throw("NoodleDatabase: Invalid line number");
    if (bfi > field.length)
      throw("NoodleDatabase: Invalid field index");
    
    var v=[];
    v[0] = ((line-1) * base.cpl) + blkfld[bfi-1][0];
    v[1] = blkfld[bfi-1][1];

    switch(field[bfi-1].type) {
      case 'T':
        var index = 0;
        // remove trailing blanks
        var str = val.replace(/\s+$/,'');
        if (str.length > 0) {
          index = table[field[bfi-1].tindex-1].item.indexOf(str) + 1;
          if (index === 0)
            index = table[field[bfi-1].tindex-1].item.push(str);
        }
        if (index > _maxval[v[1]])
          throw("Table index exceeds field's cpl");
        else
          Roots.pacbin(index, base.block, v);
        break;
      case 'B':
      case 'Z':
        if (Number(val) != NaN) {
          if (Math.trunc(val) <= _maxval[v[1]])
            Roots.pacbin(Math.trunc(val), base.block, v);
          else
            alert("The number input is too large");
        }
        else
          alert("Not a number");
        break;
      case 'D':
        var date = new Date(val);
        if (date === "Invalid Date")
          alert("Invalid Date");
        else {
          var y = date.getFullYear();
          var m = date.getMonth() + 1;
          var d = date.getDate();
          var ymd=(y*10000)+(m*100)+d;
          Roots.pacbin(ymd, base.block, v);
        }
        break;
      case 'R':
        if (Number(val) != NaN)
          Roots.pacrel(val, base.block, v);
        else
          Roots.pacrel(0, base.block, v);
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
        throw("NoodleDatabase: Invalid data type");
    }
  }

  // Select database rows by value

  valuePrune = function(p) {
    var bstr, i, index, tindex, v=[];
    var hits=[0], outlst=[0], date;

    switch(field[p.bfi-1].type) {
      case 'T':
        bstr  = new Uint8Array(table[field[p.bfi-1].tindex-1].item.length/8+1);
        tindex = field[p.bfi-1].tindex;
        for (i=0; i < p.values.length; i++) {
          if (p.values[i].length > 0) {
            index = table[tindex-1].item.indexOf(p.values[i]) + 1;
            if (index > 0) {
              v[0] = index;
              v[1] = 1;
              Roots.setone(bstr, v);
            }
          }
          else {
            v[0]=v[1]=0;
            Roots.rngprn(base.block, base.cpl, blkfld[p.bfi-1], v, p.first, p.nextLine, hits);
            Roots.conlst(outlst, hits, p.nextLine);
          }
        }
        Roots.strprn(base.block, base.cpl, blkfld[p.bfi-1], bstr, p.first, p.nextLine, hits);
        Roots.conlst(outlst, hits, p.nextLine);
        break;
      case 'B':
      case 'Z':
        for (i=0; i < p.values.length; i++) {
          if (Number(p.values[i]) != NaN) {
            v[0]=v[1]=Math.trunc(p.values[i]);
            Roots.rngprn(base.block, base.cpl, blkfld[p.bfi-1], v, p.first, p.nextLine, hits);
            Roots.conlst(outlst, hits, p.nextLine);
          }
        }
        break;
      case 'D':
        for (i=0; i < p.values.length; i++) {
          date = new Date(p.values[i]);
          if (date != "Invalid Date") {
            v[0]=v[1]=(date.getFullYear()*10000)+((date.getMonth()+1)*100)+date.getDate();
            Roots.rngprn(base.block, base.cpl, blkfld[p.bfi-1], v, p.first, p.nextLine, hits);
            Roots.conlst(outlst, hits, p.nextLine);
          }
        }
        break;
      case 'R':
        for (i=0; i < p.values.length; i++) {
          if (Number(p.values[i]) != NaN) {
            v[0]=v[1]=p.values[i];
            Roots.rgrprn(base.block, base.cpl, blkfld[p.bfi-1], v, p.first, p.nextLine, hits);
            Roots.conlst(outlst, hits, p.nextLine);
          }
        }
        break;
      case 'E':
        v[0]=1;
        for (i=0; i < p.values.length; i++) {
          v[1]=p.values[i].length;
          Roots.txtprn(base.block, base.cpl, blkfld[p.bfi-1], p.values[i], v, p.first, p.nextLine, hits);
          Roots.conlst(outlst, hits, p.nextLine);
        }
        break;
      default:
        throw("NoodleDatabase: Invalid data type");
    }
    p.match[0] = outlst[0];
    return 0;
  }

  // Select database rows via text scanning

  scanPrune = function(p) {
    var bstr, i, index, tindex, v=[];
    var hits=[0], outlst=[0];
    var tlines, tfirst=[0], tmatch=[0], tnextt=[];

    switch(field[p.bfi-1].type) {
      case 'T':
        tindex = field[p.bfi-1].tindex;
        tlines = table[tindex-1].item.length;
        bstr  = new Uint8Array(tlines/8+1);
        Roots.xpand(tnextt, tlines);
        Roots.seqlst(tfirst, tlines, tnextt);
        v[0]=1;
        for (i=0; i < p.values.length; i++) {
          if (p.values[i].length > 0) {
            v[1]=p.values[i].length;
            Roots.scanprArray(table[tindex-1].item, p.values[i], v, tfirst, tnextt, tmatch);
            Roots.setbit(tmatch, tnextt, bstr);
          }
        }
        Roots.strprn(base.block, base.cpl, blkfld[p.bfi-1], bstr, p.first, p.nextLine, hits);
        Roots.conlst(outlst, hits, p.nextLine);
        break;
      case 'E':
        v[0]=1;
        for (i=0; i < p.values.length; i++) {
          v[1]=p.values[i].length;
          Roots.scanpr(base.block, base.cpl, blkfld[p.bfi-1], p.values[i], v, p.first, p.nextLine, hits);
          Roots.conlst(outlst, hits, p.nextLine);
        }
        break;
      default:
        throw("NoodleDatabase: Invalid data type");
    }
    p.match[0] = outlst[0];
    return 0;
  }

  // Main function for creating prune sets

  this.PruneValues = function(pruneData) {
    switch (pruneData.operation) {
      case "value":
        return valuePrune(pruneData);
      case "scan":
        return scanPrune(pruneData);
      case "range":
        break;
      case "mask":
        break;
      case "compare":
        break;
      default:
        alert("Can't do PruneValues.  Invalid prune operation!");
        return -1;
    }
    return 0;
  }

  // Delete rows from the database

  this.RemoveRows = function(first, nextLine) {
    var nline=[base.nline];
    Roots.delent(base.block, base.cpl, nline, first, nextLine);
    base.nline = nline[0];
  }

  // Clean the database and its tables

  cleanDataBase = function() {
    var i, newi, t, oldt, used, flds, first=[0], sf=[1];
    var range=[], drop=[];
    var map=[], nextLine=[], group=[], rank=[], sorti=[];

    // Remove stale table entries

    // Look at each table
    for (t=0; t < table.length; t++) {
      used = false;
      flds = [];
      for (i=0; i < field.length; i++) {
        if (field[i].tindex-1 === t) {
          used = true;
          flds.push(blkfld[i]);
        }
      }
      if (!used)
        continue;

      // Empty database?
      if (base.nline === 0)
        table[t].item.length = 0;
      if (table[t].item.length === 0)
        continue;

      // Make room for mapping
      Roots.xpand(map, table[t].item.length);
      Roots.xpand(nextLine, table[t].item.length);
      Roots.xpand(nextLine, base.nline);
      Roots.xpand(group, table[t].item.length);
      Roots.xpand(rank, table[t].item.length);
      Roots.xpand(sorti, table[t].item.length);

      // Generate table entry deletion map
      Roots.zerout(map);
      Roots.seqlst(first, base.nline, nextLine);
      for (i=0; i < flds.length; i++)
        Roots.idxmap(base.block, base.cpl, flds[i], first, nextLine, map);
      
      // Generate old table's sorti
      Roots.mrsort(table[t].item, function(list,a,b) {
          return list[a].localeCompare(list[b]);
        }, sf, group, nextLine, sorti);

      // Save the old table length
      oldt = table[t].item.length;

      // Delete stale table entries, i.e. map(stale)=0
      Roots.seqlst(first, table[t].item.length, nextLine);
      range[0] = range[1] = 0;
      drop[0] = 0;
      Roots.rngprnArray(map, range, first, nextLine, drop);
      Roots.delentArray(table[t].item, drop, nextLine);
      
      // Build rank translation.  old-new : rank(sorti)=newi
      Roots.zerout(rank);
      newi = 0;
      for (i=0; i < oldt; i++) {
        if (map[sorti[i]-1])
          rank[sorti[i]-1] = ++newi;
      }

      // Build sorti for new table given the new rank column
      newi = 0;
      for (i=0; i < oldt; i++) {
        if (rank[i])
          sorti[rank[i]-1] = ++newi;
      }      

      // Re-arrange the table, i.e. physically sort it
      Roots.srmoveArray(sorti, table[t].item);

      // Update table index values in the database
      for (i=0; i < flds.length; i++)
        Roots.lgmap(base.block, base.cpl, base.nline, flds[i], rank);
    }
  }

  // Remove duplicate rows from the database
  
  removeDuplicateRows = function() {
    var i, first=[], ngroup, sf=[1], bstr;
    var keep=[0], drop=[0], nline=[base.nline];
    var group=[], nextLine=[];
    Roots.xpand(group, base.nline);
    Roots.xpand(nextLine, base.nline);

    _lineCompare = function(list,a,b) {
      var i, k, aval, bval;
      k = a * base.cpl;
      aval = base.block.slice(k, k+base.cpl);
      k = b * base.cpl;
      bval = base.block.slice(k, k+base.cpl);
      for (i=0; i < base.cpl; i++) {
        if (aval[i] != bval[i])
          return aval[i] - bval[i];
      }
      return 0;
    }

    // Determine if there are any duplicate rows
    Roots.mrsort(myself, _lineCompare, sf, group, nextLine);
    first[0] = group[0];
    ngroup = Roots.colect(myself, _lineCompare, sf, first, nextLine, group);
    if (ngroup === base.nline)
      return;

    // Mark duplicate rows for deletion
    bstr = new Uint8Array(base.nline/8 + 1);
    Roots.zerout(bstr);
    for (i=0; i < ngroup; i++) {
      first[0] = nextLine[group[i]-1];
      if (first[0])
        Roots.setbit(first, nextLine, bstr);
    }

    // Keep the rows with zero valued bits, drop those with 1=bits
    Roots.seqlst(keep, base.nline, nextLine);
    Roots.setprn(bstr, keep, nextLine, drop);
    Roots.delent(base.block, base.cpl, nline, drop, nextLine);
    base.nline = nline[0];
  }
  
  // Convert the database into a text format for data exchange or saving

  this.stringify = function() {
    cleanDataBase();
    removeDuplicateRows();

    var ndl = {};
    ndl.NoodleDatabase = {};
    ndl.NoodleDatabase.name = name;
    ndl.NoodleDatabase.field = field;
    ndl.NoodleDatabase.base = {};
    ndl.NoodleDatabase.base.cpl = base.cpl;
    ndl.NoodleDatabase.base.nline = base.nline;
    ndl.NoodleDatabase.base.block = window.btoa(convertUint8ArrayToBinaryString(base.block));
    ndl.NoodleDatabase.table = table;
    ndl.NoodleDatabase.screen = ndlEditScreen;
    return JSON.stringify(ndl);
  }
  
}