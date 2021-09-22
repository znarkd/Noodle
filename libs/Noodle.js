/*
 * Use Noodle to construct dynamic data views of tabular data.
 * It provides set-based data viewing and updates without SQL.
 * Copyright (c) 2014-present  Dan Kranz
 * Release: September 22, 2021
 */

function Noodle(dataArray, labels) {
  var mData = undefined;
  var mKeys;
  var mLabels;
  var mNumFields;
  var mType = undefined;

  // Error handling
 
  ErrorMsg = function(msg) {
    alert(msg);
  }

  SOS = function(msg) {
    throw ("Noodle: " + msg);
  }

  // Setup

  // Preferred data type
  if (typeof NoodleDatabase === "function" && dataArray instanceof NoodleDatabase) {
    mData = dataArray;
    mKeys = mData.GetFieldLabels();
    mType = "NoodleDatabase";
  }

  // Data is an array or contains an array
  else {
    if (Array.isArray(dataArray))
      mData = dataArray;
    else {
      for (var k in dataArray) {
        if (Array.isArray(dataArray[k])) {
          mData = dataArray[k];
          break;
        }
      }
    }
    if (mData === undefined)
      SOS("Data does not contain an array!");

    if (mData.length === 0)
      SOS("Can't work with empty arrays!");

    // Array of arrays
    if (Array.isArray(mData[0]))
      mType = "Array";

    // Array of regular objects
    else if (typeof mData[0] === "object")
      mType = "Object";

    // Array of strings or numbers
    else {
      var n = mData.length;
      var zdata = [];
      for (var i = 0; i < n; i++) {
        zdata[i] = [];
        zdata[i][0] = mData[i];
      }
      mData = zdata;
      mType = "Array";
    }

    mKeys = Object.keys(mData[0]);
  }

  if (labels != undefined)
    mLabels = labels;
  else
    mLabels = mKeys;

  mNumFields = mLabels.length;

  // Get a data element from the data source
  var LineValue;
  _linevalue = function (line, bfi) {
    var val = mData[line - 1][mKeys[bfi - 1]];
    if (!val)
      return "";
    if (Array.isArray(val)) {
      if (typeof val[0] === "object") {
        let output = "";
        for (let i=0; i < val.length; i++) {
          if (i != 0)
            output += ", ";
          output += `${i+1})`;
          for (const property in val[i]) {
            output += ` ${property}: ${val[i][property]}`;
          }
        }
        return output;
      }
      return val.join(', ');
    }
    return val;
  }
  if (mData.LineValue != undefined)
    LineValue = mData.LineValue;
  else
    LineValue = _linevalue;

  // Put a data element into the data source.
  // This default implementation attempts to handle input values of indeterminate type.
  var PutLineValue;
  _putlinevalue = function (val, line, bfi) {
    var type = typeof mData[line - 1][mKeys[bfi - 1]];
    if (mData[line -1][mKeys[bfi - 1]] === null)
      type = "null";
    var vtype = "string";
    if (!isNaN(val))
      vtype = "number";
    if (val === "")
      mData[line - 1][mKeys[bfi - 1]] = null;
    else if (type === "number" && vtype === "number")
      mData[line - 1][mKeys[bfi - 1]] = Number(val);
    else if (type === vtype)
      mData[line - 1][mKeys[bfi - 1]] = val;
    else if (vtype === "number")
      mData[line - 1][mKeys[bfi - 1]] = Number(val);
    else if (type === "object")
      mData[line - 1][mKeys[bfi - 1]] = new Date(val);
    else
      mData[line - 1][mKeys[bfi - 1]] = val;
    return true;
  }
  if (mData.PutLineValue != undefined)
    PutLineValue = mData.PutLineValue;
  else
    PutLineValue = _putlinevalue;

  // View information
  var viewInitialized = false; // Was the view initialized?
  var viewGenerated = false; // Was the view generated?
  var viewHeaderFields = []; // Fields in header
  var viewHeaderSumFields = []; // Summary header fields
  var viewNumHead = 0; // Number of header fields
  var viewColumnarFields = []; // Fields in columnar detail
  var viewColumnarSumFields = []; // Summary columnar fields
  var viewNumCol = 0; // Number of columnar fields
  var viewType = []; // Field type (header, columnar, sum)
  var viewSum = []; // viewSums index value
  var viewSortFields = []; // The fields to sort on (no sum fields)
  var viewNextLine = []; // Used for raw sort
  var viewPrevLine = []; // Previous Line
  var viewPages = []; // Page groups (header fields)
  var viewNumPages = 0; // Number of pages
  var viewFirstDetail = []; // Page detail (columnar fields)
  var viewNextDetail = []; // Page detail clones
  var viewState = []; // Line (Row) status
  var viewSums = []; // Sums data

  // Trail of recent queries for line on page
  var recentFirst = 0;
  var recentLine = 0;
  var recentNline = 0;
  var recentPage = 0;

  // View types
  var HEADER_FIELD = 1;
  var HEADER_SUM = 2;
  var COLUMNAR_FIELD = 4;
  var COLUMNAR_SUM = 8;

  // Row State
  var ACTIVE_ROW = 0;
  var DELETED_ROW = 1;
  var PRUNED_ROW = 2;

  // Prune bracket storage
  var prune = {};

  this.FieldCount = function () {
    return mNumFields;
  }

  this.GetBaseType = function() {
    return mType;
  }

  this.WhereIsField = function (bfi) {
    if (viewInitialized != true) {
      ErrorMsg("View was not initialized!\n" +
        "Please: initialize and define a view first!");
	    return 0;
    }
    return viewType[bfi-1];
  }

  this.FieldName = function (bfi) {
    if (bfi <= 0 || bfi > mNumFields)
      SOS("Invalid field index.");
    return mLabels[bfi - 1].toString();
  }

  this.BFI = function (fieldName) {
    return mLabels.indexOf(fieldName) + 1;
  }

  this.Nline = function () {
    if (typeof mData.length === "function")
      return mData.length();
    else
      return mData.length;
  }

  // Get screens for displaying the data
  this.GetEditScreens = function (screens) {
    
    // Get screens from the data source
    if (mData.GetEditScreens != undefined)
      return mData.GetEditScreens();
    
    // Were the screens already primed?
    if (screens != undefined)
      return screens;

    // No predefined screens
    return new Array(0);
  }

  this.InitializeView = function () {
    viewHeaderFields.length = 0;
    viewHeaderSumFields.length = 0;
    viewColumnarFields.length = 0;
    viewColumnarSumFields.length = 0;
    viewSums.length = 0;
    viewSum.length = mNumFields;
    viewInitialized = true;
    viewGenerated = false;
  }

  this.EnterHeader = function (bfi) {
    if (!viewInitialized)
      SOS("View was not initialized.");
    if (viewGenerated)
      SOS("View was already generated.");
    if (bfi <= 0 || bfi > mNumFields)
      SOS("Field index is out of range.");
    viewHeaderFields.push(bfi);
    viewType[bfi - 1] = HEADER_FIELD;
  }

  this.EnterHeaderSum = function (bfi) {
    if (!viewInitialized)
      SOS("View was not initialized.");
    if (viewGenerated)
      SOS("View was already generated.");
    if (bfi <= 0 || bfi > mNumFields)
      SOS("Field index is out of range.");

    viewHeaderFields.push(bfi);
    viewType[bfi - 1] |= HEADER_SUM;
    viewHeaderSumFields.push(bfi);
    var sum = [];
    viewSums.push(sum);
    viewSum[bfi - 1] = viewSums.length;
  }

  this.EnterColumnar = function (bfi) {
    if (!viewInitialized)
      SOS("View was not initialized.");
    if (viewGenerated)
      SOS("View was already generated.");
    if (bfi <= 0 || bfi > mNumFields)
      SOS("Field index is out of range.");
    viewColumnarFields.push(bfi);
    viewType[bfi - 1] = COLUMNAR_FIELD;
  }

  this.EnterColumnarSum = function (bfi) {
    if (!viewInitialized)
      SOS("View was not initialized.");
    if (viewGenerated)
      SOS("View was already generated.");
    if (bfi <= 0 || bfi > mNumFields)
      SOS("Field index is out of range.");

    viewColumnarFields.push(bfi);
    viewType[bfi - 1] |= COLUMNAR_SUM;
    viewColumnarSumFields.push(bfi);
    var sum = [];
    viewSums.push(sum);
    viewSum[bfi - 1] = viewSums.length;
  }

  this.PageCount = function () {
    if (!viewGenerated)
      SOS("View wasn't generated.");
    return viewNumPages;
  }

  // Make room for a new dataset row
  MakeRoomForNewEntry = function() {

    // Add a new row to the dataset
    var nline;
    if (mType === "Array")
      nline = mData.push([]);
    else
      nline = mData.push({});

    // Add space to sums
    for (var i = 0; i < viewSums.length; i++)
      viewSums[i].push(0.0);
 
    // Keep list arrays in similar dimensions
    Roots.xpand(viewFirstDetail, nline);
    Roots.xpand(viewNextDetail, nline);
    Roots.xpand(viewNextLine, nline);
    Roots.xpand(viewPrevLine, nline);
    Roots.xpand(viewState, nline);
  }

  // Get the actual line number for a data row
  // given a book view page and line.
  //
  firstOf = function (page, line) {
    var ln;

    // find line the slow way
    if (recentPage != page) {
      recentPage = page;
      recentNline = 0;
      ln = viewPages[page - 1];
      while (ln > 0) {
        recentNline++;
        ln = viewNextLine[ln - 1];
      }

      if (line > recentNline)
        SOS("Method firstOf called with invalid line number.");

      recentLine = 0;
      ln = viewPages[page - 1];
      while (ln >= 0) {
        if (++recentLine === line)
          break;
        ln = viewNextLine[ln - 1];
      }
      recentFirst = ln;
    }

    // Use existing information
    else {
      if (recentLine === 0) {
        recentFirst = viewPages[recentPage - 1];
        recentLine = 1;
      }

      if (recentLine === line)
        return recentFirst;

      if (line > recentNline)
        SOS("Method firstOf called with invalid line number.");

      // search down
      if (recentLine < line) {
        ln = viewNextLine[recentFirst - 1];
        while (ln >= 0) {
          if (++recentLine === line)
            break;
          ln = viewNextLine[ln - 1];
        }
        recentFirst = ln;
      }

      // search up
      else {
        ln = viewPrevLine[recentFirst - 1];
        while (ln > 0) {
          if (--recentLine === line)
            break;
          ln = viewPrevLine[ln - 1];
        }
        recentFirst = ln;
      }
    }
    return recentFirst;
  }

  nlineOf = function (page) {
    var line;
    if (recentPage === page)
      return recentNline;
    recentPage = page;
    recentNline = recentFirst = recentLine = 0;
    line = viewPages[page - 1];
    while (line > 0) {
      recentNline++;
      line = viewNextLine[line - 1];
    }
    return recentNline;
  }

  this.LineCount = function (page) {
    if (!viewGenerated)
      SOS("View wasn't generated.");
    if (page <= 0 || page > viewNumPages)
      SOS("Invalid page number for LineCount method.");
    return nlineOf(page);
  }

  // Get the number of records represented by Page, Line
  this.RecordCount = function (page, line) {
    var first, c, count = 1;

    if (!viewGenerated)
      SOS("View wasn't generated.");
    if (page < 0 || page > viewNumPages)
      SOS("Invalid page number for RecordCount method.");
    if (viewColumnarFields.length === 0)
      SOS("Can't count records in pure Header view.");

    first = firstOf(page, line);
    for (c = viewNextDetail[first - 1]; c > 0; c = viewNextLine[c - 1])
      ++count;

    return count;
  }

  fieldAudits = function (page, line, bfi) {
    if (!viewGenerated)
      SOS("View was not generated.");
    if (bfi < 0 || bfi > mNumFields)
      SOS("Invalid field index.");
    if (viewType[bfi - 1] === undefined)
      SOS("Field: " + mLabels[bfi - 1] + " is not in view.");
    if (page <= 0 || page > viewNumPages)
      SOS("Page number " + page + " outside valid range.");
    if (viewColumnarFields.length === 0 && line > 0)
      SOS("Use line = 0 for a view without columnar fields.");
  }

  groupSum = function (bfi, first, nextLine) {
    var s, line, d, sum = 0.0;
    for (line = first; line > 0; line = nextLine[line - 1]) {
      s = LineValue(line, bfi);
      d = parseFloat(s);
      if (d != NaN)
        sum += d;
    }
    return sum;
  }

  noodleCompare = function (list, a, b, sortColumns) {
    var i, fx, aRow = list[a], bRow = list[b], rc;

    // Consider switching to Intl.Collator when mobile browsers support it

    for (i = 0; i < sortColumns.length; i++) {
      fx = mKeys[sortColumns[i] - 1];
      if (!aRow[fx]) {
        if (!bRow[fx])
          continue;
        return -1;
      }
      if (!bRow[fx])
        return 1;
      rc = aRow[fx].toString().localeCompare(bRow[fx].toString());
      if (rc != 0)
        return rc;
    }
    return 0;
  }

  PrimeNewLine = function (line) {
    if (mData instanceof NoodleDatabase)
      return;
    for (var i = 1; i <= mNumFields; i++)
      PutLineValue("", line, i);
  }

  this.GenerateView = function (compareFunc) {
    var i, v = [],
      dsum;
    var bfi, first = [], drop = [], prev, page,
      ngroup = 0, g, member, line;
    var comparer;

    if (!viewInitialized)
      SOS("View was not initialized.");

    if (compareFunc != undefined)
      comparer = compareFunc;
    else if (mData.Compare != undefined)
      comparer = mData.Compare;
    else
      comparer = noodleCompare;

    var rowcount = this.Nline();

    // Prime a new data set if necessary
    if (rowcount === 0) {
      mData.push([]);
      PrimeNewLine(1);
      rowcount = 1;
    }

    // Make room for summary data
    for (i = 0; i < viewSums.length; i++)
      Roots.xpand(viewSums[i], rowcount);

    // Sort the data

    viewSortFields.length = 0;

    for (i = 0; i < viewHeaderFields.length; i++) {
      bfi = viewHeaderFields[i];
      if ((viewType[bfi - 1] & HEADER_SUM) != 0)
        continue;
      viewSortFields.push(bfi);
    }
    viewNumHead = viewSortFields.length;

    for (i = 0; i < viewColumnarFields.length; i++) {
      bfi = viewColumnarFields[i];
      if ((viewType[bfi - 1] & COLUMNAR_SUM) != 0)
        continue;
      viewSortFields.push(bfi);
    }
    viewNumCol = viewSortFields.length - viewNumHead;

    Roots.xpand(viewNextLine, rowcount);
    Roots.xpand(viewPrevLine, rowcount);
    Roots.xpand(viewPages, rowcount);
    Roots.xpand(viewFirstDetail, rowcount);
    Roots.xpand(viewNextDetail, rowcount);
    Roots.xpand(viewState, rowcount);

    if (viewSortFields.length > 0) {
      Roots.mrsort(mData, comparer, viewSortFields, viewPages, viewNextLine);
      first[0] = viewPages[0];
    }
    else {
      Roots.seqlst(first, rowcount, viewNextLine);
    }

    // Drop out records which have been deleted or filtered out
    drop[0] = first[0];
    v[0] = v[1] = ACTIVE_ROW;
    Roots.rngprnArray(viewState, v, drop, viewNextLine, first);
    if (first[0] === 0) {
      ErrorMsg("Empty dataset.");
      return false;
    }

    // Build page groups
    if (viewNumHead > 0) {
      viewNumPages = Roots.colect(mData, comparer,
        viewSortFields.slice(0, viewNumHead),
        first, viewNextLine, viewPages);
    }
    else {
      viewNumPages = 1;
      viewPages[0] = first[0];
    }

    // Build header sums
    for (g = 0; g < viewNumPages; g++) {
      first[0] = viewPages[g];
      for (i = 0; i < viewHeaderSumFields.length; i++) {
        bfi = viewHeaderSumFields[i];
        dsum = groupSum(bfi, first[0], viewNextLine);
        member = viewSum[bfi - 1];
        for (line = first[0]; line > 0; line = viewNextLine[line - 1]) {
          viewSums[member - 1][line - 1] = dsum;
        }
      }
    }

    // Build groups of unique detail lines

    for (page = 0; page < viewNumPages; page++) {

      // Build the groups for current page's detail sublist
      first[0] = viewPages[page];
      if (viewNumCol > 0) {
        ngroup = Roots.colect(mData, comparer,
          viewSortFields.slice(viewNumHead, viewSortFields.length),
          first, viewNextLine, viewFirstDetail);
      }
      else {
        viewFirstDetail[0] = first[0];
        ngroup = 1;
      }

      // Build columnar sums
      for (g = 0; g < ngroup; g++) {
        first[0] = viewFirstDetail[g];
        for (i = 0; i < viewColumnarSumFields.length; i++) {
          bfi = viewColumnarSumFields[i];
          dsum = groupSum(bfi, first[0], viewNextLine);
          member = viewSum[bfi - 1];
          for (line = first[0]; line > 0; line = viewNextLine[line - 1]) {
            viewSums[member - 1][line - 1] = dsum;
          }
        }
      }

      // Connect current page's unique elements back to the starter
      // and build clone sublists
      prev = 0;
      for (g = 0; g < ngroup; g++) {
        member = viewFirstDetail[g];
        viewNextDetail[member - 1] = viewNextLine[member - 1];
        viewNextLine[member - 1] = 0;
        if (prev > 0)
          viewNextLine[prev - 1] = member;
        prev = member;
      }
    }

    // Build previous list
    for (page = 0; page < viewNumPages; page++) {
      prev = 0;
      member = viewPages[page];
      while (member > 0) {
        viewPrevLine[member - 1] = prev;
        prev = member;
        member = viewNextLine[member - 1];
      }
    }

    recentFirst = recentLine = recentNline = recentPage = 0;
    i = firstOf(1, 1);

    viewGenerated = true;
    return true;
  }

  this.GetDataType = function(bfi) {
    if (mData.GetDataType != undefined)
      return mData.GetDataType(bfi);
    return "String";
  }

  this.GetValue = function (page, line, bfi) {
    var first;

    // Input audit
    fieldAudits(page, line, bfi);

    // Field is in detail
    if (line > 0) {
      if (line > nlineOf(page))
        SOS("Line number not on page.");
      first = firstOf(page, line);
    }

    // Field in header
    else
      first = viewPages[page - 1];

    // Get the data from data set

    // Regular field
    if ((viewType[bfi - 1] & COLUMNAR_FIELD) != 0 ||
      (viewType[bfi - 1] & HEADER_FIELD) != 0) {
      return LineValue(first, bfi);
    }

    // Summary field
    else {
      var i = viewSum[bfi - 1];
      return viewSums[i - 1][first - 1];
    }
  }


  // Set the value for column number bfi for the given page and line.
  this.PutValue = function (val, page, line, bfi) {
    var first, clone;

    // Input audit
    fieldAudits(page, line, bfi);

    // Field in header
    if (line === 0) {
      if ((viewType[bfi - 1] & HEADER_SUM) != 0)
        SOS("Can't input into summary field");
      if ((viewType[bfi - 1] & HEADER_FIELD) === 0)
        SOS(mLabels[bfi - 1] + " is not a Header field.");

      for (first = viewPages[page - 1]; first > 0; first = viewNextLine[first - 1]) {
        if (!PutLineValue(val, first, bfi))
          break;
        for (clone = viewNextDetail[first - 1]; clone > 0; clone = viewNextLine[clone - 1])
          PutLineValue(val, clone, bfi);
      }
    }

    // Field is in detail
    else {
      if ((viewType[bfi - 1] & COLUMNAR_SUM) != 0)
        SOS("Can't input into summary field.");
      if ((viewType[bfi - 1] & COLUMNAR_FIELD) === 0)
        SOS(mLabels[bfi - 1] + " is not a Columnar field.");
      if (line > nlineOf(page))
        SOS("Line number not on page");

      first = firstOf(page, line);
      if (!PutLineValue(val, first, bfi))
        return;
      for (clone = viewNextDetail[first - 1]; clone > 0; clone = viewNextLine[clone - 1])
        PutLineValue(val, clone, bfi);
    }
  }

  AdjustPruneBitMatrix = function (nline) {
    if ("sets" in prune === false)
      return;
    var keys = Object.keys(prune.sets);
    var need = Math.ceil(nline / 8);
    for (var key in keys) {
      if (need > prune.sets[keys[key]].length)
        prune.sets[keys[key]] = Roots.transfer(prune.sets[keys[key]], need + 25);
    }
  }

  this.CreateNewPage = function () {
    if (!viewGenerated)
      SOS("View was not generated!");

    if (!viewNumHead)
      SOS("View has no header fields.");

    // Add a new row to the dataset
    var nline;
    if (mType === "Array")
      nline = mData.push([]);
    else
      nline = mData.push({});
    PrimeNewLine(nline);
    for (var i = 0; i < viewSums.length; i++)
      viewSums[i].push(0.0);

    //	update lists
    var newLine = nline - 1;
    Roots.xpand(viewPages, nline);
    viewPages[viewNumPages] = nline;
    viewNumPages++;
    Roots.xpand(viewNextLine, nline);
    Roots.xpand(viewPrevLine, nline);
    Roots.xpand(viewFirstDetail, nline);
    Roots.xpand(viewNextDetail, nline);
    Roots.xpand(viewState, nline);
    viewNextLine[newLine] = 0;
    viewPrevLine[newLine] = 0;
    viewFirstDetail[newLine] = 0;
    viewNextDetail[newLine] = 0;
    viewState[newLine] = ACTIVE_ROW;

    AdjustPruneBitMatrix(nline);

    return viewNumPages;
  }

  CopyHeaderFields = function (newLine, parentLine) {
    for (var i = 0; i < viewHeaderFields.length; i++) {
      var bfi = viewHeaderFields[i];
      if ((viewType[bfi - 1] & HEADER_FIELD) != 0) {
        PutLineValue(LineValue(parentLine, bfi), newLine, bfi);
      }
      else {   // HEADER_SUM
        var k = viewSum[bfi - 1] - 1;
        viewSums[k][newLine - 1] = viewSums[k][parentLine - 1];
      }
    }
  }

  this.CreateNewLineOnPage = function (page) {
    if (!viewGenerated)
      SOS("View was not generated.");

    if (viewColumnarFields.length === 0)
      SOS("View has no columnar fields.\nUse: CreateNewPage() instead.");

    if (page > viewNumPages || page <= 0)
      SOS("Page number " + page + " not in current view!");

    // Add a new row to the dataset
    var newLine;
    if (mType === "Array")
      newLine = mData.push([]);
    else
      newLine = mData.push({});
    for (var i = 0; i < viewSums.length; i++)
      viewSums[i].push(0.0);

    // Copy data to the new row
    PrimeNewLine(newLine);
    CopyHeaderFields(newLine, viewPages[page - 1]);

    // Find last on current page
    var last = firstOf(page, nlineOf(page));

    // Update lists
    Roots.xpand(viewNextLine, newLine);
    Roots.xpand(viewPrevLine, newLine);
    Roots.xpand(viewFirstDetail, newLine);
    Roots.xpand(viewNextDetail, newLine);
    Roots.xpand(viewState, newLine);
    viewNextLine[last - 1] = newLine;
    viewNextLine[newLine - 1] = 0;
    viewPrevLine[newLine - 1] = last;
    viewFirstDetail[newLine - 1] = 0;
    viewNextDetail[newLine - 1] = 0;
    viewState[newLine - 1] = ACTIVE_ROW;

    AdjustPruneBitMatrix(newLine);

    // Update recent and return
    ++recentNline;
    return recentNline;
  }

  var PruneValues;
  _prunevalues = function (pruneData) {
    switch (pruneData.operation) {
      case "value":
        Roots.txtprnArrayCol(mData, pruneData.fx, pruneData.values,
          pruneData.first, pruneData.nextLine, pruneData.match);
        break;
      case "range":
        // string_a.localeCompare(string_b);
        break;
      case "scan":
        var v = [];
        v[0]=1;
        v[1]=pruneData.values[0].length;
        Roots.scanprArrayCol(mData, pruneData.fx, pruneData.values[0], v,
          pruneData.first, pruneData.nextLine, pruneData.match);
        break;
      case "mask":
      case "regex":
        // string.search(searchvalue)
        //
        // var patt = new RegExp("e");
        // var res = patt.test(str);
        break;
      case "compare":
        break;
      default:
        ErrorMsg("Can't do PruneValues.  Invalid prune operation!");
        return -1;
    }
    return 0;
  }
  if (mData.PruneValues != undefined)
    PruneValues = mData.PruneValues;
  else
    PruneValues = _prunevalues;

  // Create a prune set
  this.PruneBracket = function (inputs, operation, bfi, values, outputs) {
    var i, v = [];

    // first time in?
    if ("nline" in prune === false) {
      prune.first = [0];
      prune.match = [0];
      prune.greaterthan = [0];
      prune.lessthan = [0];
      prune.nline = this.Nline();
      prune.nextLine = [];
      Roots.xpand(prune.nextLine, prune.nline);
      prune.sets = {};
    }

    if (prune.nline != this.Nline()) {
      ErrorMsg("Data nline has changed since last prune!\nCall ResetPrune!");
      return -1;
    }

    // Remove "Deleted" rows
    Roots.seqlst(prune.first, prune.nline, prune.nextLine);
    v[0] = v[1] = DELETED_ROW;
    Roots.rngprnArray(viewState, v, prune.first, prune.nextLine, prune.match);

    // Select rows that match the input sets
    if (inputs != 0) {
      if (!Array.isArray(inputs)) {
        if (inputs in prune.sets === false) {
          ErrorMsg("Can't do PruneBracket.  Input set doesn't exist!");
          return -1;
        }
        prune.work = prune.sets[inputs].slice();
      }
      else {
        for (i = 0; i < inputs.length; i++) {
          if (inputs[i] in prune.sets === false) {
            ErrorMsg("Can't do PruneBracket.  Input set doesn't exist!");
            return -1;
          }
          if (i === 0)
            prune.work = prune.sets.inputs[i].slice();
          else
            Roots.lgor(prune.sets.inputs[i], prune.work.length, prune.work);
        }
      }
      Roots.setprn(prune.work, prune.first, prune.nextLine, prune.match);
      prune.first[0] = prune.match[0];
    }

    // Perform the requested prune operation

    prune.operation = operation;
    prune.bfi = bfi;
    prune.fx = mKeys[bfi - 1];
    
    if (!Array.isArray(values)) {
      prune.values = [];
      prune.values[0] = values;
    }
    else prune.values = values;
    
    if (PruneValues(prune) === -1)
      return -1;

    // Save the output sets as bit strings
    if ("match" in outputs && outputs.match != 0) {
      prune.sets[outputs.match] = new Uint8Array(Math.ceil(prune.nline / 8));
      Roots.zerout(prune.sets[outputs.match]);
      Roots.setbit(prune.match, prune.nextLine, prune.sets[outputs.match]);
    }
    if ("leftover" in outputs && outputs.leftover != 0) {
      prune.sets[outputs.leftover] = new Uint8Array(Math.ceil(prune.nline / 8));
      Roots.zerout(prune.sets[outputs.leftover]);
      Roots.setbit(prune.first, prune.nextLine, prune.sets[outputs.leftover]);
    }
    if ("greater_than" in outputs && outputs.greaterthan != 0) {
      prune.sets[outputs.greaterthan] = new Uint8Array(Math.ceil(prune.nline / 8));
      Roots.zerout(prune.sets[outputs.greaterthan]);
      Roots.setbit(prune.greaterthan, prune.nextLine, prune.sets[outputs.greaterthan]);
    }
    if ("less_than" in outputs && outputs.lessthan != 0) {
      prune.sets[outputs.lessthan] = new Uint8Array(Math.ceil(prune.nline / 8));
      Roots.zerout(prune.sets[outputs.lessthan]);
      Roots.setbit(prune.lessthan, prune.nextLine, prune.sets[outputs.lessthan]);
    }
    return 0;
  }

  // Filter the data for the specified sets.
  // Mark non-selected rows as "Pruned" out.
  this.ApplyPrune = function (inputs) {
    if ("sets" in prune === false) {
      ErrorMsg("Noodle: No prune sets have been defined.");
      return -1;
    }

    // Remove old prune flags first
    Roots.xpand(viewState, this.Nline());
    var val = [];
    Roots.seqlst(prune.first, prune.nline, prune.nextLine);
    val[0] = val[1] = PRUNED_ROW;
    Roots.rngprnArray(viewState, val, prune.first, prune.nextLine, prune.match);
    val[0] = ACTIVE_ROW;
    Roots.paclstArray(val[0], viewState, prune.match, prune.nextLine);

    // Get "Active" rows (ignore "Deleted" rows)
    Roots.seqlst(prune.first, prune.nline, prune.nextLine);
    val[0] = val[1] = ACTIVE_ROW;
    Roots.rngprnArray(viewState, val, prune.first, prune.nextLine, prune.match);
    prune.first[0] = prune.match[0];

    // Select the requested input sets
    if (!Array.isArray(inputs)) {
      if (inputs in prune.sets === false) {
        ErrorMsg("Can't do ApplyPrune.  Input set doesn't exist!");
        return -1;
      }
      prune.work = prune.sets[inputs].slice();
    }
    else {
      for (i = 0; i < inputs.length; i++) {
        if (inputs[i] in prune.sets === false) {
          ErrorMsg("Can't do ApplyPrune.  Input set doesn't exist!");
          return -1;
        }
        if (i === 0)
          prune.work = prune.sets.inputs[i].slice();
        else
          Roots.lgor(prune.sets.inputs[i], prune.work.length, prune.work);
      }
    }
    Roots.setprn(prune.work, prune.first, prune.nextLine, prune.match);

    // No match
    if (prune.match[0] === 0)
      return -1;

    // Discard non-selected rows by marking them as "Pruned"
    val[0] = PRUNED_ROW;
    Roots.paclstArray(val[0], viewState, prune.first, prune.nextLine);
    return 0;
  }

  // Reverse the position of all bits in an input set
  this.LineSetInvert = function (set) {
    if ("sets" in prune === false) {
      ErrorMsg("LineSetInvert: No prune sets have been defined.");
      return -1;
    }
    if (set in prune.sets === false) {
      ErrorMsg("Can't do LineSetInvert.  Input set doesn't exist!");
      return -1;
    }
    prune.work = prune.sets[set].slice();
    for (var i = 0; i < prune.work.length; i++)
      prune.sets[set][i] = 0xFF;
    Roots.lgexcl(prune.work, prune.work.length, prune.sets[set]);
    return 0;
  }

  // Find matching lines in a set
  this.Locate = function (locateData) {
    if ("sets" in prune === false) {
      ErrorMsg("Locate: No prune sets have been defined.");
      return -1;
    }
    if (locateData.set in prune.sets === false) {
      ErrorMsg("Can't do Locate.  Input set doesn't exist!");
      return -1;
    }
    if ("starthere" in locateData === false)
      locateData.starthere = false;

    var page, line, first, last, index, byte;
    const tbits = new Uint8Array([0x80, 0x40, 0x20, 0x10, 0x08, 0x04, 0x02, 0x01]);

    // Find the next matching line
    if (locateData.operation === "Next") {
      for (page = locateData.page; page <= viewNumPages; ++page) {
        first = viewPages[page - 1];
        line = 0;
        for (; first > 0; first = viewNextLine[first - 1]) {
          if (viewNumCol)
            ++line;
          if (page === locateData.page) {
            if (locateData.starthere && line < locateData.line)
              continue;
            if (!locateData.starthere && line <= locateData.line)
              continue;
          }
          index = first - 1;
          byte = Math.floor(index / 8);
          if (prune.sets[locateData.set][byte] & tbits[index % 8]) {
            locateData.page = page;
            locateData.line = line;
            return 0;
          }
        }
      }
      // No match
      return -1;
    }

    // Find the previous matching line (row)
    else if (locateData.operation === "Previous") {
      for (page = locateData.page; page > 0; --page) {
        line = nlineOf(page);
        last = firstOf(page, line);
        if (!viewNumCol)
          line = 0;
        else
          ++line;
        for (; last > 0; last = viewPrevLine[last - 1]) {
          if (viewNumPages)
            --line;
          if (page === locateData.page) {
            if (locateData.starthere && line > locateData.line)
              continue;
            if (!locateData.starthere && line >= locateData.line)
              continue;
          }
          index = last - 1;
          byte = Math.floor(index / 8);
          if (prune.sets[locateData.set][byte] & tbits[index % 8]) {
            locateData.page = page;
            locateData.line = line;
            return 0;
          }
        }
      }
      // No match
      return -1;
    }

    ErrorMsg("Invalid Locate operation.");
    return -1;
  }

  // Remove prune brackets
  this.ResetPrune = function () {

    // Ignore if no prune brackets were set up
    if ("nline" in prune === false)
      return;

    // Set all rows to "Active"
    var val = [];
    Roots.seqlst(prune.first, prune.nline, prune.nextLine);
    val[0] = val[1] = PRUNED_ROW;
    Roots.rngprnArray(viewState, val, prune.first, prune.nextLine, prune.match);
    val[0] = ACTIVE_ROW;
    Roots.paclstArray(val[0], viewState, prune.match, prune.nextLine);

    prune = {};
  }

  this.MoveLines = function (targetPage, AtTargetLine, sourcePage, SourceLine1, SourceLineLast) {
    var nlineTarget, nlineSource, member, clone, headerLine;
    var first, last, insert, stayTop, stayBottom;
    var insertTop, insertBottom, sourceL1, sourceLn;
    var append = false;

    sourceL1 = SourceLine1;
    if (sourceL1 > SourceLineLast)
      sourceL1 = SourceLineLast;

    sourceLn = SourceLine1;
    if (sourceLn < SourceLineLast)
      sourceLn = SourceLineLast;

    if (mData === undefined)
      SOS("No data loaded!");
    if (!viewGenerated)
      SOS("View was not generated!\nPlease: initialize and define a view first!");
    if (targetPage < 0 || targetPage > viewNumPages || sourcePage < 0 || sourcePage > viewNumPages)
      SOS("Target and/or source page number outside valid range 1 - " + viewNumPages);
    if (viewNumCol === 0 || viewNumCol === viewColumnarSumFields.length)
      SOS("Can't move lines for pure HeaderPage view!");

    // Get line counts
    nlineTarget = this.LineCount(targetPage);
    nlineSource = this.LineCount(sourcePage);
    if (nlineSource < 0 || nlineTarget < 0)
      return -1;

    // Handle the append case which happens when line goes to bottom of target
    if (nlineTarget + 1 === AtTargetLine) {
      append = true;
      AtTargetLine--;
    }

    if (nlineTarget < AtTargetLine)
      SOS("Target line " + AtTargetLine + " beyond (nline+1) of target pages nline: " + nlineTarget);

    if (nlineSource < sourceL1 || nlineSource < sourceLn)
      SOS("First and/or last Source-line not on Source Page!");


    // Process the call

    // Isolate the first and last source lines.

    // find first source line
    first = firstOf(sourcePage, sourceL1);

    // find last source line
    last = firstOf(sourcePage, sourceLn);

    if (viewPrevLine[first - 1] === 0 && viewNextLine[last - 1] === 0)
      SOS("Can't move all lines from a page!");

    // Find the target spot
    insert = firstOf(targetPage, AtTargetLine);

    // Remove the source lines from view and keep them to be moved

    stayTop = viewPrevLine[first - 1];
    stayBottom = viewNextLine[last - 1];

    // Remove from top of page
    if (stayTop === 0) {
      viewPages[sourcePage - 1] = stayBottom;
      viewPrevLine[stayBottom - 1] = 0;
    }
    // Remove from within
    else {
      viewNextLine[stayTop - 1] = stayBottom;
      if (stayBottom != 0)
        viewPrevLine[stayBottom - 1] = stayTop;
    }

    // Clean up the disconnected bunch
    viewNextLine[last - 1] = viewPrevLine[first - 1] = 0;

    // Propagate header values if needed

    if (sourcePage != targetPage) {
      headerLine = viewPages[targetPage - 1];
      member = first;
      while (member != 0) {
        CopyHeaderFields(member, headerLine);
        clone = viewNextDetail[member - 1];
        while (clone != 0) {
          CopyHeaderFields(clone, headerLine);
          clone = viewNextLine[clone - 1];
        }
        member = viewNextLine[member - 1];
      }
    }

    // Append source to bottom of target line;  N.B. input was on phantom last+1

    if (append) {
      insertTop = insert;
      insertBottom = 0;
      viewPrevLine[first - 1] = insertTop;
      viewNextLine[insertTop - 1] = first;
      viewNextLine[last - 1] = insertBottom;
    }

    // Insert lines at target line

    else {
      insertTop = viewPrevLine[insert - 1];
      insertBottom = insert;

      // On top of page
      if (insertTop === 0) {
        viewNextLine[last - 1] = insertBottom;
        viewPrevLine[insertBottom - 1] = last;
        viewPages[targetPage - 1] = first;
      }
      // Within the body
      else {
        viewPrevLine[first - 1] = insertTop;
        viewNextLine[insertTop - 1] = first;
        viewNextLine[last - 1] = insertBottom;
        viewPrevLine[insertBottom - 1] = last;
      }
    }

    // Update recent
    recentFirst = recentLine = recentNline = recentPage = 0;
    return 0;
  }

  this.PageLineSeq = function (page, bfi) {
    var seq = 0, nline, first, line, clone, val;

    fieldAudits(page, 1, bfi);
    nline = nlineOf(page);

    //	Store the sequence numbers
    for (line = 1; line <= nline; line++) {
      ++seq;
      val = seq.toString();
      first = firstOf(page, line);
      PutLineValue(val, first, bfi);
      for (clone = viewNextDetail[first - 1]; clone > 0; clone = viewNextLine[clone - 1])
        PutLineValue(val, clone, bfi);
    }
  }

  this.OpenLine = function (page, line) {
    if (line <= 0 || line > this.LineCount(page))
      SOS("Invalid line number specified!");

    var appendedLine = this.CreateNewLineOnPage(page);
    if (appendedLine === 0)
      return false;

    return this.MoveLines(page, line, page, appendedLine, appendedLine);
  }

  this.DeleteLine = function (onPage, LineNumber) {
    var first, clone, nline;
    var stayTop, stayBottom;

    if (mData === undefined)
      SOS("No data loaded!");
    if (!viewGenerated)
      SOS("View was not generated!\nPlease: initialize and define a view first!");
    if (onPage <= 0 || onPage > viewNumPages)
      SOS("Page Number outside valid range 1 - " + viewNumPages);
    if (viewNumCol === 0)
      SOS("Can't delete line from a pure HeaderPage view!");

    nline = this.LineCount(onPage);
    if (nline === 1) {
      ErrorMsg("Can't delete only remaining line from a page!");
      return -1;
    }

    if (LineNumber <= 0 || LineNumber > nline)
      SOS("Page " + onPage + " does not have line number " + LineNumber);

    //	Get to the line that is to be deleted
    first = firstOf(onPage, LineNumber);

    // Mark the status column for the line and its clones
    viewState[first - 1] = DELETED_ROW;
    for (clone = viewNextDetail[first - 1]; clone > 0; clone = viewNextLine[clone - 1]) {
      viewState[clone - 1] = DELETED_ROW;
    }

    // Delete line and its clones from list

    stayTop = viewPrevLine[first - 1];
    stayBottom = viewNextLine[first - 1];

    // Remove from top of page
    if (stayTop == 0) {
      viewPages[onPage - 1] = stayBottom;
      viewPrevLine[stayBottom - 1] = 0;
    }

    // Remove from within page
    else {
      viewNextLine[stayTop - 1] = stayBottom;
      if (stayBottom != 0)
        viewPrevLine[stayBottom - 1] = stayTop;
    }

    //	Update recent
    recentNline--;
    if (stayBottom != 0)
      recentFirst = stayBottom;
    else {
      recentLine--;
      recentFirst = stayTop;
    }

    return 0;
  }

  this.DeletePage = function (PageNumber) {
    var first, clone, line, page;

    if (mData === undefined)
      SOS("No data loaded!");
    if (!viewGenerated)
      SOS("View was not generated!\nPlease: initialize and define a view first!");
    if (PageNumber <= 0 || PageNumber > viewNumPages)
      SOS("Page Number outside valid range 1 - " + viewNumPages);
    if (viewNumHead === 0 || viewNumHead === viewHeaderSumFields.length) {
      ErrorMsg("Can't delete a page from a pure Columnar view!");
      return -1;
    }

    //	Mark page as deleted

    first = viewPages[PageNumber - 1];

    // Mark the status column for each line on the page
    for (line = first; line > 0; line = viewNextLine[line - 1]) {
      viewState[line - 1] = DELETED_ROW;
      for (clone = viewNextDetail[line - 1]; clone > 0; clone = viewNextLine[clone - 1]) {
        viewState[clone - 1] = DELETED_ROW;
      }
    }

    //	Remove one page by filling the created gap
    for (page = PageNumber; page < viewNumPages; page++)
      viewPages[page - 1] = viewPages[page];
    viewNumPages--;

    // Update recent
    recentFirst = recentLine = recentNline = recentPage = 0;

    return 0;
  }

  this.CopyLine = function (Page, Line) {
    var parentFirst, offspringFirst;
    var parentLine = Line + 1;
    var targetLine = Line;
    var clones, cloneCount;
    var i, rowcount;

    if (mData === undefined)
      SOS("No data loaded!");
    if (!viewGenerated)
      SOS("View was not generated!\nPlease: initialize and define a view first!");
    if (Page <= 0 || Page > viewNumPages)
      SOS("Page Number outside valid range 1 - " + viewNumPages);
    if (viewNumCol === 0 || viewNumCol === viewColumnarSumFields.length)
      SOS("Can't copy lines for pure HeaderPage view!");

    // Create a blank line first, then copy the parent line and clones to it.

    if (this.OpenLine(Page, targetLine) != 0)
      return -1;

    parentFirst = firstOf(Page, parentLine);
    offspringFirst = firstOf(Page, targetLine);

    // Copy the firsts
    for (i = 1; i <= mNumFields; i++) {
      PutLineValue(LineValue(parentFirst, i), offspringFirst, i);
    }
    if (viewSums.length > 0) {
      for (i = 0; i < viewSums.length; i++) {
        viewSums[i][offspringFirst - 1] = viewSums[i][parentFirst - 1];
      }
    }

    // Move the clones

    cloneCount = 0;
    for (clones = viewNextDetail[parentFirst - 1]; clones > 0; clones = viewNextLine[clones - 1]) {
      cloneCount++;
      MakeRoomForNewEntry();     // Adds a line to mData
      for (i = 1; i <= mNumFields; i++) {
        PutLineValue(LineValue(clones, i), this.Nline(), i);
      }

      rowcount = this.Nline();
      if (viewSums.length > 0) {
        for (i = 0; i < viewSums.length; i++) {
          viewSums[i][rowcount-1] = viewSums[i][clones - 1];
        }
      }

      viewState[rowcount-1] = ACTIVE_ROW;

      if (cloneCount === 1) {
        viewNextDetail[offspringFirst - 1] = rowcount;
        viewNextLine[rowcount-1] = 0;
        viewPrevLine[rowcount-1] = 0;
      }
      else {
        viewNextLine[rowcount-2] = rowcount;
        viewPrevLine[rowcount-1] = rowcount-1;
        viewNextLine[rowcount-1] = 0;
        viewNextDetail[rowcount-1] = 0;
      }
    }

    AdjustPruneBitMatrix();

    recentFirst = recentLine = recentNline = recentPage = 0;
    return 0;
  }

  this.CopyPage = function (Page) {
    var ParentPage = Page + 1;
    var OffspringPage = Page;
    var i, n, ParentFirst, nline, nclone;
    var prevl = 0, clone, clone1, prevClone = 1, member;

    if (mData === undefined)
      SOS("No data loaded!");
    if (!viewGenerated)
      SOS("View was not generated!\nPlease: initialize and define a view first!");
    if (Page <= 0 || Page > viewNumPages)
      SOS("Page Number outside valid range 1 - " + viewNumPages);
    if (viewHeaderFields.length == 0 || viewHeaderFields.length == viewHeaderSumFields.length)
      SOS("Can't copy page for pure Columnar view!");

    // Process the copy operation

    // Extend the number of pages.  Push the current page and all others down one spot
    viewNumPages++;
    Roots.xpand(viewPages, viewNumPages);
    for (i = viewNumPages; i >= OffspringPage; i--)
      viewPages[i - 1] = viewPages[i - 2];

    // Copy the parent info to offspring

    ParentFirst = viewPages[ParentPage - 1];
    nline = 0;
    for (member = ParentFirst; member > 0; member = viewNextLine[member - 1]) {
      nline++;
      MakeRoomForNewEntry();
      n = this.Nline();

      for (i = 1; i <= mNumFields; i++) {
        PutLineValue(LineValue(member, i), n, i);
      }
      if (viewSums.length > 0) {
        for (i = 0; i < viewSums.length; i++) {
          viewSums[i][n - 1] = viewSums[i][member - 1];
        }
      }
      viewState[n - 1] = ACTIVE_ROW;

      if (nline === 1) {
        viewPages[OffspringPage - 1] = n;
        viewNextLine[n - 1] = 0;
        viewPrevLine[n - 1] = 0;
        viewNextDetail[n - 1] = 0;
        prevl = n;
      }
      else {
        viewNextLine[prevl - 1] = n;
        viewPrevLine[n - 1] = prevl;
        viewNextLine[n - 1] = 0;
        viewNextDetail[n - 1] = 0;
        prevl = n;
      }

      // Deal with clones
      clone1 = viewNextDetail[member - 1];
      nclone = 0;
      for (clone = clone1; clone > 0; clone = viewNextLine[clone - 1]) {
        nclone++;
        MakeRoomForNewEntry();
        n = this.Nline();

        for (i = 1; i <= mNumFields; i++) {
          PutLineValue(LineValue(clone, i), n, i);
        }
        if (viewSums.length > 0) {
          for (i = 0; i < viewSums.length; i++) {
            viewSums[i][n - 1] = viewSums[i][clone - 1];
          }
        }
        viewState[n - 1] = ACTIVE_ROW;

        if (nclone == 1) {
          viewNextDetail[prevl - 1] = n;
          viewNextLine[n - 1] = 0;
          viewPrevLine[n - 1] = 0;
          prevClone = n;
        }
        else {
          viewNextLine[prevClone - 1] = n;
          viewPrevLine[n - 1] = prevClone;
          viewNextLine[n - 1] = 0;
          viewNextDetail[n - 1] = 0;
          prevClone = n;
        }
      }
    }

    AdjustPruneBitMatrix();

    recentFirst = recentLine = recentNline = recentPage = 0;
    return 0;
  }

  var RemoveRows;
  _removerows = function(first, nextLine) {
    Roots.delentArray(mData, first, nextLine);
  }
  if (mData.RemoveRows != undefined)
    RemoveRows = mData.RemoveRows;
  else
    RemoveRows = _removerows;

  // Create a JSON string representation of the data for data exchange or saving
  this.stringify = function() {

    // Delete rows marked for removal
    var first=[], drop=[], lnextl=[], v=[];
    var nline = this.Nline();
    Roots.xpand(lnextl, nline);
    Roots.seqlst(first, nline, lnextl);
    v[0] = v[1] = DELETED_ROW;
    Roots.rngprnArray(viewState, v, first, lnextl, drop);
    RemoveRows(drop, lnextl);

    // All rows are now active
    Roots.zerout(viewState);

    // Convert the data into a string
    if (mData.stringify != undefined)
      return mData.stringify();
    else
      return JSON.stringify(mData);
  }

  // Output encode XML special characters
  encodeXML = function (s) {
    return (s.toString()
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/'/g, '&apos;')
      .replace(/"/g, '&quot;')
    );
  }

  // Create an XML file the represents the current screen's data view
  this.XMLReport = function (title, fn, page1, save) {
    var i, page, start, end, line, bfi;
    var xmldata, blob, alink;

    if (fn === undefined)
      fn = "report.xml";

    start = end = page1;
    if (start === undefined) {
      start = 1;
      end = viewNumPages;
    }

    // Create the XML data

    xmldata = "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n";
    xmldata += "<?xml-stylesheet type=\"text/xsl\" href=\"report.xsl\"?>\n";
    var d = new Date();
    var txt = d.toLocaleDateString();
    xmldata = xmldata + "<report date=\"" + txt + "\">\n";
    xmldata += "<title>";
    xmldata += encodeXML(title);
    xmldata += "</title>\n";

    for (page = start; page <= end; page++) {
      xmldata = xmldata + "<page seq=\"" + page + "\">\n";

      // Header info
      if (viewHeaderFields.length > 0) {
        xmldata += "<header>\n";
        for (i = 0; i < viewHeaderFields.length; i++) {
          bfi = viewHeaderFields[i];
          xmldata += "<field name=\"";
          xmldata += encodeXML(mLabels[bfi - 1]);
          xmldata += "\">";
          xmldata += encodeXML(this.GetValue(page, 0, bfi));
          xmldata += "</field>\n";
        }
        xmldata += "</header>\n";
      }

      // Detail
      if (viewColumnarFields.length > 0) {
        xmldata += "<detail>\n";

        var nline = this.LineCount(page);
        for (line = 1; line <= nline; line++) {
          xmldata += "<line>\n";

          for (i = 0; i < viewColumnarFields.length; i++) {
            bfi = viewColumnarFields[i];
            xmldata += "<field name=\"";
            xmldata += encodeXML(mLabels[bfi - 1]);
            xmldata += "\">";
            xmldata += encodeXML(this.GetValue(page, line, bfi));
            xmldata += "</field>\n";
          }

          xmldata += "</line>\n";
        }
        xmldata += "</detail>\n";
      }

      xmldata += "</page>\n";
    }

    xmldata += "</report>\n";

    if (!save)
    return xmldata;

    // Create a temporary link to download the data

    blob = new Blob([xmldata], {
      "type": "application/xml; charset=utf8;"
    });

    alink = document.createElement('a');
    document.body.appendChild(alink);
    alink.setAttribute("href", window.URL.createObjectURL(blob));
    alink.setAttribute('download', fn);
    alink.click();
    alink.remove();
  }

  GetCsvWritableValue = function (s1) {
    if (s1 === null)
      return "";

    // Replace " with ""
    var s2 = s1.toString().replace(/"/g, '""');

    // Add quotes if the value starts with whitespace
    // or if the value contains , " \r \n
    var pattern = /(^\s|.*[,"\r\n])/;
    if (pattern.test(s2))
      return '"' + s2 + '"';

    return s2;
  }

  this.WriteCsvFile = function (fn, separator, save) {
    var r, c, nline=this.Nline(), nf=mLabels.length;
    var output, sep, blob;

    //StreamWriter writer = new StreamWriter(path);

    // Build a line with column names
    output = "";
    sep = "";
    for (c=0; c < nf; c++) {
      output += sep;
      output += GetCsvWritableValue(mLabels[c]);
      sep = separator;
    }
    output += "\n";

    // Build output data with active rows only
    for (r=1; r <= nline; r++) {
      if (viewState[r-1] != DELETED_ROW) {
        sep = "";
        for (c=1; c <= nf; c++) {
          output += sep;
          output += GetCsvWritableValue(LineValue(r,c));
          sep = separator;
        }
        output += "\n";
      }
    }

    if (!save)
      return output;

    // Create a temporary link to download the data

    blob = new Blob([output], {
      "type": "data/text; charset=utf8;"
    });

    alink = document.createElement('a');
    document.body.appendChild(alink);
    alink.setAttribute("href", window.URL.createObjectURL(blob));
    alink.setAttribute('download', fn);
    alink.click();
    alink.remove();
  }

  // ----- Slickgrid interface methods ------------------

  this.getLength = function () {
    if (recentPage === 0)
      return 0;
    return nlineOf(recentPage);
  }

  this.getItem = function (row) {
    var arr = [];
    var line = row + 1;
    var nf = viewColumnarFields.length;
    for (var i = 0; i < nf; i++)
      arr.push(this.GetValue(recentPage, line, viewColumnarFields[i]));
    return arr;
  }

  // ----------------------------------------------------
}
