/*
 * The Noodle Database object.
 * Copyright (c) 2018-present  Dan Kranz
 * Release: October 6, 2020
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
  
  validateField = function(i) {
    if (field[i].width <= 0)
      throw("display width < 1");

    switch (field[i].type) {
      case 'T':
      case 'B':
      case 'Z':
        if (field[i].cpl <= 0 || field[i].cpl > 4)
          throw("Invalid cpl for Type-" + field[i].type);
        break;
      case 'D':
        if (field[i].cpl != 4)
          throw("cpl for Type-D must equal 4");
        break;
      case 'R':
        if (field[i].cpl != 4 && field[i].cpl != 8)
          throw("cpl for Type-R must be 4 or 8");
        if (field[i].decimals === undefined)
          throw("Type-R requires decimals value")
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
      base.block = convertBaseToUint8Array(window.atob(base.block));
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
          aval = base.block.slice(v[0], v[0]+blkfld[sortColumns[i]-1][1]).join('');
          v[0] = (b * base.cpl) + blkfld[sortColumns[i]-1][0] - 1;
          bval = base.block.slice(v[0], v[0]+blkfld[sortColumns[i]-1][1]).join('');
          rc = aval.localeCompare(bval);
          if (rc != 0)
            return rc;
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
  
  // Add a new line
  
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

  // Select database rows

  valuePrune = function(p) {
    var bstr, text, i, index, tindex, v=[];
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
              Roots.setone(bstr, v, 1);
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

  this.PruneValues = function(pruneData) {
    switch (pruneData.operation) {
      case "value":
        return valuePrune(pruneData);
      case "range":
        break;
      case "scan":
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

  // Clean the database and its tables

  this.CleanDataBase = function() {
    var i, newi, t, used, flds, first, sf=[1];
    var range=[], firstLine=[], dropLine=[];
    var map=[], nextLine=[], group=[], rank=[], sorti=[];

    // Remove stale table entries

    // Look at each table
    for (t=0; t < table.length; t++) {
      used = false;
      flds = [];
      for (i=0; i < field.length; i++) {
        if (field[i].tindex === t) {
          used = true;
          flds.push(blkfld[i]);
        }
      }
      if (!used)
        continue;

      // Empty database?
      if (base.nline === 0)
        table[t].length = 0;
      if (table[t].length === 0)
        continue;

      // Make room for mapping
      Roots.xpand(map, table[t].length);
      Roots.xpand(nextLine, table[t].length);
      Roots.xpand(nextLine, base.nline);
      Roots.xpand(group, table[t].length);
      Roots.xpand(rank, table[t].length);
      Roots.xpand(sorti, table[t].length);

      // Generate table entry deletion map
      Roots.zerout(map);
      first = Roots.seqlst(base.nline, nextLine);
      for (i=0; i < flds.length; i++)
        Roots.idxmap(base.block, base.cpl, flds[i], first, nextLine, map);
      
      // Generate old table's sorti
      Roots.mrsort(table[t], function(list,a,b) {
          return list[a].localeCompare(list[b]);
        }, sf, group, nextLine, sorti);

      // Delete stale table entries, i.e. map(stale)=0
      first = Roots.seqlst(table[t].length, nextLine);
      range[0] = range[1] = 0;
      firstLine[0] = first;
      dropLine[0] = 0;
      Roots.rngprnArray(map, range, firstLine, nextLine, dropLine);
      Roots.delentArray(table[t], dropline[0], nextLine);
      
      // Build rank translation.  old-new : rank(sorti)=newi
      Roots.zerout(rank);
      newi = 0;
      for (i=0; i < table[t].length; i++) {
        if (map[sorti[i]-1])
          rank[sorti[i]-1] = ++newi;
      }

      // Re-arrange the table, i.e. physically sort it
      Roots.srmoveArray(sorti, table[t]);

      // Update table index values in the database
      for (i=0; i < flds.length; i++)
        Roots.lgmap(base.block, base.cpl, base.nline, flds[i], rank);
    }
  }

  // Remove duplicate rows from the database
  
  this.RemoveDuplicateRows = function() {
    var i, first, next, ngroup, sf=[1], bstr;
    var keep=[0], drop=[0], nline=[base.nline];
    var group=[], nextLine=[];
    Roots.xpand(group, base.nline);
    Roots.xpand(nextLine, base.nline);

    _lineCompare = function(list,a,b) {
      var k, aval, bval;
      k = a * base.cpl;
      aval = base.block.slice(k, k+base.cpl).join('');
      k = b * base.cpl;
      bval = base.block.slice(k, k+base.cpl).join('');
      return aval.localeCompare(bval);    
    }

    // Determine if there are any duplicate rows
    Roots.mrsort(base.block, _lineCompare, sf, group, nextLine);
    first = group[0];
    ngroup = Roots.colect(base.block, _lineCompare, sf, first, nextLine, group);
    if (ngroup === base.nline)
      return;

    // Mark duplicate rows for deletion
    bstr = new Uint8Array(base.nline/8 + 1);
    Roots.zerout(bstr);
    for (i=0; i < ngroup; i++) {
      first = group[i];
      next = nextLine[first-1];
      if (next)
        Roots.setbit(next, nextLine, bstr);
    }

    // Keep the rows with zero valued bits, drop those with 1=bits
    keep[0] = Roots.seqlst(base.nline, nextLine);
    Roots.setprn(bstr, keep, nextLine, drop);
    Roots.delent(base.block, base.cpl, nline, drop[0], nextLine);
    base.nline = nline[0];
  }
  
}