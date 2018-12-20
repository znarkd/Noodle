/*
 * Noodle gives JavaScript arrays a pivot table like data view.
 * The data is assumed to consist of flat tables (rows and columns).
 * Copyright (c) 2014-present  Dan Kranz
 * Release: December 19, 2018
 */

function Noodle(dataArray, labels) {
  var mData;
  var mKeys;
  var mLabels;
  var mNumFields;
  
  // Setup
  
  if (dataArray instanceof NoodleDatabase) {
    mData = dataArray;
    mKeys = mData.GetFieldLabels();
  }
  else if (Array.isArray(dataArray)) {
    if (dataArray.length === 0)
      throw ("Noodle can't work with empty arrays!");
    mData = dataArray;
    mKeys = Object.keys(dataArray[0]);
  }
  else { 
    alert("Noodle: invalid datatype!");
    return;
  }

  if (labels != undefined)
    mLabels = labels;
  else
    mLabels = mKeys;

  mNumFields = mLabels.length;

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
  var NEW_ROW = 4;

  ErrorMsg = function(msg) {
    alert(msg);
  }

  SOS = function(msg) {
    throw ("Noodle: " + msg);
  }

  this.FieldCount = function() {
    return mNumFields;
  }

  this.FieldName = function(bfi) {
    if (bfi <= 0 || bfi > mNumFields)
      SOS("Invalid field index.");
    return mLabels[bfi - 1].toString();
  }

  this.BFI = function(fieldName) {
    return mLabels.indexOf(fieldName) + 1;
  }

  this.Nline = function() {
    if (typeof mData.length === "function")
      return mData.length();
    else
      return mData.length;
  }
  
  this.GetEditScreens = function() {
    if (mData instanceof NoodleDatabase)
      return 	mData.getScreens();
  }

  this.InitializeView = function() {
    viewHeaderFields.length = 0;
    viewHeaderSumFields.length = 0;
    viewColumnarFields.length = 0;
    viewColumnarSumFields.length = 0;
    viewSums.length = 0;
    viewSum.length = mNumFields;
    viewInitialized = true;
    viewGenerated = false;
  }

  this.EnterHeader = function(bfi) {
    if (!viewInitialized)
      SOS("View was not initialized.");
    if (viewGenerated)
      SOS("View was already generated.");
    if (bfi <= 0 || bfi > mNumFields)
      SOS("Field index is out of range.");
    viewHeaderFields.push(bfi);
    viewType[bfi - 1] = HEADER_FIELD;
  }

  this.EnterHeaderSum = function(bfi) {
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

  this.EnterColumnar = function(bfi) {
    if (!viewInitialized)
      SOS("View was not initialized.");
    if (viewGenerated)
      SOS("View was already generated.");
    if (bfi <= 0 || bfi > mNumFields)
      SOS("Field index is out of range.");
    viewColumnarFields.push(bfi);
    viewType[bfi - 1] = COLUMNAR_FIELD;
  }

  this.EnterColumnarSum = function(bfi) {
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

  this.PageCount = function() {
    if (!viewGenerated)
      SOS("View wasn't generated.");
    return viewNumPages;
  }

  // Get the actual line number for a data row
  // given a book view page and line.
  //
  firstOf = function(page, line) {
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
        if (++recentLine == line)
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

  nlineOf = function(page) {
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

  this.LineCount = function(page) {
    if (!viewGenerated)
      SOS("View wasn't generated.");
    if (page <= 0 || page > viewNumPages)
      SOS("Invalid page number for LineCount method.");
    return nlineOf(page);
  }

  // Get the number of records represented by Page, Line
  this.RecordCount = function(page, line) {
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

  fieldAudits = function(page, line, bfi) {
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

  groupSum = function(bfi, first, nextLine) {
    var s, line, d, sum = 0.0;
    for (line = first; line > 0; line = nextLine[line - 1]) {
      if (mData.LineValue)
        s = mData.LineValue(line, bfi);
      else
        s = mData[line - 1][mKeys[bfi - 1]].toString();
      d = parseFloat(s);
      if (d != NaN)
        sum += d;
    }
    return sum;
  }

  noodleCompare = function(list, a, b, sortColumns) {
    var i, fx, aRow = list[a], bRow = list[b], rc;
    
    // Consider switching to Intl.Collator when mobile browsers support it

    for (i = 0; i < sortColumns.length; i++) {
      fx = mKeys[sortColumns[i] - 1];
      rc = aRow[fx].toString().localeCompare(bRow[fx].toString());
      if (rc != 0)
        return rc;
    }
    return 0;
  }

  this.GenerateView = function(compareFunc) {
    var i, v = [],
      dsum;
    var bfi, first, drop, prev, page, ngroup = 0,
      g, member, line;
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
      mData.push();
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
      first = viewPages[0];
    } else
      Roots.seqlst(rowcount, first, viewNextLine);

    // Drop out records which have been deleted or filtered out
    drop = first;
    v[0] = v[1] = ACTIVE_ROW;
    //Roots.rangePruneArray<byte>(viewState, v, drop, viewNextLine, first);
    if (first === 0) {
      ErrorMsg("Empty dataset.");
      return false;
    }

    // Build page groups
    if (viewNumHead > 0) {
      viewNumPages = Roots.colect(mData, comparer,
        viewSortFields.slice(0, viewNumHead),
        first, viewNextLine, viewPages);
    } else {
      viewNumPages = 1;
      viewPages[0] = first;
    }

    // Build header sums
    for (g = 0; g < viewNumPages; g++) {
      first = viewPages[g];
      for (i = 0; i < viewHeaderSumFields.length; i++) {
        bfi = viewHeaderSumFields[i];
        dsum = groupSum(bfi, first, viewNextLine);
        member = viewSum[bfi - 1];
        for (line = first; line > 0; line = viewNextLine[line - 1]) {
          viewSums[member - 1][line - 1] = dsum;
        }
      }
    }

    // Build groups of unique detail lines

    for (page = 0; page < viewNumPages; page++) {

      // Build the groups for current page's detail sublist
      first = viewPages[page];
      if (viewNumCol > 0) {
        ngroup = Roots.colect(mData, comparer,
          viewSortFields.slice(viewNumHead, viewSortFields.length),
          first, viewNextLine, viewFirstDetail);
      } else {
        viewFirstDetail[0] = first;
        ngroup = 1;
      }

      // Build columnar sums
      for (g = 0; g < ngroup; g++) {
        first = viewFirstDetail[g];
        for (i = 0; i < viewColumnarSumFields.length; i++) {
          bfi = viewColumnarSumFields[i];
          dsum = groupSum(bfi, first, viewNextLine);
          member = viewSum[bfi - 1];
          for (line = first; line > 0; line = viewNextLine[line - 1]) {
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

  this.GetValue = function(page, line, bfi) {
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
      if (mData.LineValue)
        return mData.LineValue(first, bfi);
      else
        return mData[first - 1][mKeys[bfi - 1]].toString();
    }

    // Summary field
    else {
      var i = viewSum[bfi - 1];
      return viewSums[i - 1][first - 1].toString();
    }
  }

  _putlinevalue = function(val, line, bfi) {
    mData[line - 1][mKeys[bfi - 1]] = val;
  }

  // Set the value for column number bfi for the given page and line.
  this.PutValue = function(val, page, line, bfi) {
    var first, clone;

    // Input audit
    fieldAudits(page, line, bfi);

    var putLineValue;
    if (mData.PutLineValue === undefined)
      putLineValue = _putlinevalue;
    else
      putLineValue = mData.PutLineValue;

    // Field in header
    if (line === 0) {
      if ((viewType[bfi - 1] & HEADER_SUM) != 0)
        SOS("Can't input into summary field");
      if ((viewType[bfi - 1] & HEADER_FIELD) === 0)
        SOS(mLabels[bfi - 1] + " is not a Header field.");

      for (first = viewPages[page - 1]; first > 0; first = viewNextLine[first - 1]) {
        putLineValue(val, first, bfi);
        for (clone = viewNextDetail[first - 1]; clone > 0; clone = viewNextLine[clone - 1]) {
          putLineValue(val, clone, bfi);
        }
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
      putLineValue(val, first, bfi);
      for (clone = viewNextDetail[first - 1]; clone > 0; clone = viewNextLine[clone - 1])
        putLineValue(val, clone, bfi);
    }
  }
  
  // Output encode XML special characters
  encodeXML = function(s) {
    return (s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/'/g, '&apos;')
      .replace(/"/g, '&quot;')
    );
  }
	
  // Create an XML file the represents the current screen's data view
  this.XMLReport = function(title, fn, page1) {
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
          xmldata += encodeXML(mLabels[bfi-1]);
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

  GetCsvWritableValue = function(s1) {
    if (s1 === null)
      return "";

    // Replace " with ""
    var s2 = s1.replace(/"/g, '""');
    
    // Add quotes if the value starts with whitespace
    // or if the value contains , " \r \n
    var pattern = /(^\s|.*[,"\r\n])/;
    if (pattern.test(s2))
      return '"' + s2 + '"';
    
    return s2;
  }

  this.WriteCsvFile = function(fn, separator) {
     var i, page, line, output, sep;

    //StreamWriter writer = new StreamWriter(path);

    // Write a line with the view's column names
    output = "";
    sep = "";
    for (i = 0; i < viewHeaderFields.length; i++) {
      output += sep;
      output += GetCsvWritableValue(mLabels[viewHeaderFields[i]-1]);
      sep = separator;
    }
    for (i = 0; i < viewColumnarFields.length; i++) {
      output += sep;
      output += GetCsvWritableValue(mLabels[viewColumnarFields[i] - 1]);
      sep = separator;
    }
    output += "\n";

    // Save the current view data
    for (page = 1; page <= viewNumPages; page++) {
      for (line = 1; line <= this.LineCount(page); line++) {
        sep = "";
        for (i = 0; i < viewHeaderFields.length; i++) {
          output += sep;
          output += GetCsvWritableValue(this.GetValue(page,0,viewHeaderFields[i]));
          sep = separator;
        }
        for (i = 0; i < viewColumnarFields.length; i++) {
          output += sep;
          output += GetCsvWritableValue(this.GetValue(page, line, viewColumnarFields[i]));
          sep = separator;
        }
        output += "\n";
      }
    }
    
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

  this.getLength = function() {
    if (recentPage === 0)
      return 0;
    return nlineOf(recentPage);
  }

  this.getItem = function(row) {
    var arr = [];
    var line = row + 1;
    var nf = viewColumnarFields.length;
    for (var i = 0; i < nf; i++)
      arr.push(this.GetValue(recentPage, line, viewColumnarFields[i]));
    return arr;
  }

  // ----------------------------------------------------
}
