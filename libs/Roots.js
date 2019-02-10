/*
 * Roots.js
 * Copyright (c) 2014-present  Dan Kranz
 * Release: January 4, 2019
 */

var Roots = Roots || {};

// Unpack the binary integer stored within block at field.

Roots.bunpac = function(block, field) {
  if (!(block instanceof Uint8Array))
    throw "Roots.bunpac: block must be Uint8Array";
  if (field[0] <= 0 || field[1] <= 0 || field[1] > 4)
    throw "Roots.bunpac: Bad field values";
  
  var bin = 0;
  var k = field[0] - 1;
  var i = field[1];
  while (i-- > 0) {
    bin *= 256;
    bin += block[k++];
  }
  
  // Don't want -0
  if (bin===0)
    return 0;
  
  // The number stored in block is in 2's complement form.
  // Convert back to integer.
  return -(~(bin-1));
}

// Group sorted list items

Roots.colect = function(list, compareFunc, sortColumns, firstLine, nextLine, group) {
  var i, last, check, ngroup;

  // Empty list?
  if (firstLine <= 0)
    return 0;

  ngroup = 1;
  last = group[0] = firstLine;
  check = nextLine.length;

  // Compare adjacent list items

  for (i = nextLine[firstLine - 1]; i > 0; i = nextLine[i - 1]) {
    if (check-- <= 0)
      throw "Roots.colect: Bad input list";

    // If the lines don't match, create a new group
    if (compareFunc(list, group[ngroup-1]-1, i-1, sortColumns) != 0) {
      group[ngroup++] = i;
      nextLine[last - 1] = 0;
    }

    last = i;
  }

  return ngroup;
}

// Concatenate two lists

Roots.conlst = function(afirst, bfirst, nextLine) {
  var line, last = afirst,
    check = nextLine.length;

  if (afirst === 0)
    afirst = bfirst;
  else {
    for (line = afirst; line != 0; line = nextLine[line - 1]) {
      last = line;
      if (check-- <= 0)
        throw "Roots.conlst: Bad input \"a\" list!";
    }
    nextLine[last - 1] = bfirst;
  }
  bfirst = 0;
}

// Remove the elements specified by first,nextLine from an array

Roots.delentArray = function(arr, first, nextLine) {
  if (!Array.isArray(arr))
    throw ("Roots.delentArray: invalid array");

    if (first === 0)
      return;

    var check = nextLine.length;
    var nline = arr.length;
    var lines = first - 1;
    var sx, dx, nkeep;

    for (var hole = first; hole >= 0; hole = nextLine[hole-1]) {
      if (check-- <= 0)
        throw "Roots.delentArray: Bad input list!";

      // Set the leading destination index
      dx = lines;

      // Skip sequential holes
      while (nextLine[hole-1] === hole+1)
         hole = nextLine[hole-1];

      // Leave if hole is at the bottom
      if (hole === 0) {
        arr.length = lines;
        return;
      }

      // Identify source length
      nkeep = nextLine[hole-1] - (hole+1);
      if (nextLine[hole-1] === 0)
        nkeep = nline-hole;
      lines += nkeep;

      // Move keepers up
      sx = hole;
      while (nkeep-- > 0)
        arr[dx++] = arr[sx++];
    }
    arr.length = lines;
}

// Set map entries to 1 where the value at block[field] > 0.
// The user initializes map.

Roots.idxmap = function(block, cpl, field, first, nextLine, map) {
  if (!(block instanceof Uint8Array))
    throw "Roots.idxmap: block must be Uint8Array";

  var num;
  var v = field;
  var check = nextLine.length;

  for (var line = first; line != 0; line = nextLine[line - 1]) {
    if (check-- <= 0)
      throw "Roots.idxmap: Bad input list!";
    num = bunpac(block, v);
    if (num != 0)
      map[num-1] = 1;
    v[0] += cpl;
  }
}

// All index values stored in block[field] are transformed based on the
// values in the rank column; i.e. for all nline block lines,
// block[field] is set to rank[block[field]]
// provided that block[field] is not equal to zero.

Roots.lgmap = function(block, cpl, nline, field, rank) {
  if (!(block instanceof Uint8Array))
    throw "Roots.lgmap: block must be Uint8Array";

  var i, line, v=[];
  
  v[0] = field[0];
  v[1] = field[1];
  
  // Set field to rank value for each record in block
  for (line = nline; line-- > 0;) {

     // Get the index value from block
     i = bunpac(block, v);
     if (i > 0)
        pacbin(rank[i-1], block, v);

     // Advance to the next record
     v[0] += cpl;
  }
}

// The sort order represented by sorti is converted into a list

Roots.list1 = function(sorti, nline, nextLine) {
  var i=1, n, last;

  if (nline === 0)
    return 0;

  if (nline < 0)
    throw("Roots.list1: Bad nline!");

  first = sorti[0];
	last = first;
  for (n = nline; --n > 0;) {
    nextLine[last-1] = sorti[i];
    last = sorti[i];
    i += 1;
  }
  nextLine[last-1] = 0;
  return first;
}

// Sort list items.  group and nextLine keep the new sort sequence.
// rank may also keep the sort sequence.
// rank[i]=n; where n is the ith member of the sorted list.
//
// list = The list to sort
// compareFunc = Comparison function

Roots.mrsort = function(list, compareFunc, sortColumns, group, nextLine, rank) {
  var count;
  if (typeof list.length === "function")
    count = list.length();
  else
    count = list.length;
  if (count <= 0)
    throw "Roots.mrsort: Bad input!";

  // Only one item in list?
  if (count === 1) {
    group[0] = 1;
    nextLine[0] = 0;
    if (rank === undefined)
      return;
    rank[0] = 1;
    return;
  }

  var i, a, b, last, g, ngroup, pair, npair;

  ngroup = group[0] = 1;
  g = nextLine[0] = 0;

  // Determine the natural groupings

  for (a = 0, b = 1; b < count; ++a, ++b) {

    if (compareFunc(list, b, a, sortColumns) < 0) {

      // New group
      group[++g] = b + 1;
      nextLine[a] = 0;
      ++ngroup;
    }

    // Same group
    else
      nextLine[a] = b + 1;
  }
  nextLine[a] = 0;

  // Merge Phase

  for (npair = Math.floor(ngroup / 2); npair > 0; npair = Math.floor(ngroup / 2)) {

    g = -1;

    // Merge group A with group B
    for (pair = 0; pair < npair; ++pair) {
      a = group[++g];
      b = group[++g];

      // Initial compare
      if (compareFunc(list, b-1, a-1, sortColumns) < 0) {

        // b is the 1st member of a new group
        group[pair] = b;
        last = b;
        b = nextLine[b - 1];

        // No more B?  Append the rest of A
        if (b === 0) {
          nextLine[last - 1] = a;
          continue;
        }
      }

      // A is the 1st member of a new group
      else {
        group[pair] = a;
        last = a;
        a = nextLine[a - 1];

        // No more A?  Append the rest of B
        if (a === 0) {
          nextLine[last - 1] = b;
          continue;
        }
      }

      // More line compares

      for (;;) {

        // Append b to an established group
        if (compareFunc(list, b-1, a-1, sortColumns) < 0) {
          nextLine[last - 1] = b;
          last = b;
          b = nextLine[b - 1];

          // No more B?
          if (b === 0) {
            nextLine[last - 1] = a;
            break;
          }
        }

        // Append A to an established group
        else {
          nextLine[last - 1] = a;
          last = a;
          a = nextLine[a - 1];

          // No more A?
          if (a === 0) {
            nextLine[last - 1] = b;
            break;
          }
        }
      }

    } // Next group pair

    // Reset ngroup for the next pass

    // There was an unused group.  Add the odd group to new groups.
    if (ngroup % 2 != 0) {
      group[npair] = group[ngroup - 1];
      ngroup = npair + 1;
    }

    // The groups paired evenly
    else
      ngroup = npair;

  } // Next pass for merge process

  // Derive table item rankings (optional)

  if (rank === undefined)
    return;

  for (a = group[0], i = 0; a != 0; a = nextLine[a - 1])
    rank[i++] = a;
}

// The integer, num, is packed into the block position indicated by field

Roots.pacbin = function(num, block, field) {
  if (!(block instanceof Uint8Array))
    throw "Roots.pacbin: block must be Uint8Array";
  if (!Number.isInteger(num))
    throw "Roots.pacbin: Not an integer";
  if (num < 0 && field[1] < 4)
    throw "Roots.pacbin: Need 4 bytes for negative numbers";
  if (field[0] <= 0 || field[1] <= 0 || field[1] > 4)
    throw "Roots.pacbin: Bad field values";
  
  // Get the 32-bit two's complement representation of the number.
  var bin = num>>>0;
  
  var k = field[0] - 1;
  var i = field[1];
  while (i-- > 0) {
    block[k+i] = bin % 256;
    bin = Math.trunc(bin / 256);
  }
}

// The floating point number, rnum, is packed into the
// block position indicated by field

Roots.pacrel = function(rnum, block, field) {
  if (!(block instanceof Uint8Array))
    throw "Roots.pacrel: block must be Uint8Array";
  if (Number(rnum) === NaN)
    throw "Roots.pacrel: Not a number";
  if (field[0] <= 0)
    throw "Roots.pacrel: Bad field values";

  var u8, len;
  if (field[1] === 8) {
    var f64 = new Float64Array(1);
    f64[0] = rnum;
    u8 = new Uint8Array(f64.buffer);
    len = 8;
  }
  else if (field[1] === 4) {
    var f32 = new Float32Array(1);
    f32[0] = rnum;
    u8 = new Uint8Array(f32.buffer);
    len = 4;
  }
  else
    throw "Roots.pacrel: Must use 4 or 8 bytes for floating point";

  var k = field[0] - 1;
  var i = field[1];
  while (i-- > 0) {
    block[k+i] = u8[--len];
  }
}

// For all block lines of first/nextLine, the number stored at arr[field]
// is compared with range.  

// Entries falling within the range are entered in match/lnextl.
// Non-matching entries remain in first/lnextl.

Roots.rngprnArray = function(arr, range, first, nextLine, match) {
  if (!Array.isArray(arr))
    throw ("Roots.rngprnArray: invalid array");

  var cur_line, prev_line, last_match;
  var check = nextLine.length;

  match[0] = next_line, prev_line = last_match = 0;
  cur_line = first[0];

  while (cur_line != 0) {
    if (check-- <= 0)
      throw "Roots.rngprnArray: Bad input list!";

    next_line = nextLine[cur_line-1];

    // Match
    if (arr[cur_line-1] >= range[0] && arr[cur_line-1] <= range[1]) {

      // Disconnect current line from top of input list
      if (prev_line === 0)
        first[0] = next_line;

      // Disconnect current line from spot other than top of input list
      else nextLine[prev_line-1] = next_line;

      // Insert current line into match list
         
      // First member of match list?
      if (last_match === 0)
        match[0] = cur_line;
         
      // Extend match list
      else nextLine[last_match-1] = cur_line;

      last_match = cur_line;
    }

    // Non-match
    else prev_line = cur_line;

    cur_line = next_line;
  }

  if (last_match != 0)
    nextLine[last_match-1] = 0;
}

// Unpack the floating point number stored within block at field.

Roots.runpac = function(block, field) {
  if (!(block instanceof Uint8Array))
    throw "Roots.runpac: block must be Uint8Array";
  if (field[0] <= 0)
    throw "Roots.runpac: Bad field values";
  
  var u8;
  if (field[1] === 8) {
    u8 = block.slice(field[0]-1, field[0]+7);
    var f64 = new Float64Array(u8.buffer);
    return f64[0];
  }
  else if (field[1] === 4) {
    u8 = block.slice(field[0]-1, field[0]+3);
    var f32 = new Float32Array(u8.buffer);
    return f32[0];
  }
  else
    throw "Roots.runpac: Must use 4 or 8 bytes for floating point";
}

// Prime a new list

Roots.seqlst = function(nline, nextLine) {
  var n = nline;
  if (n === 0)
    return 0;

  var i = 2,
    k = 0;
  while (--n > 0) {
    nextLine[k++] = i++;
  }
  nextLine[k] = 0;
  return 1;
}

// Array elements are physically re-arranged according to the sequence
// expressed by sorti; i.e. arr[sorti[i]] is moved to block[i].
//
// The output array replaces the input array.

Roots.srmoveArray = function(sorti, arr) {
  if (!Array.isArray(arr))
    throw ("Roots.srmoveArray: invalid array");

  var output = [];
  output.length = sorti.length;
  var n = sorti.length;
  var i = 0;
  while (n--) {
    output[i] = arr[sorti[i]];
    i += 1;
  }

  arr = output;
}

// Extend an array

Roots.xpand = function(arr, newCount) {
  if (!Array.isArray(arr))
    throw ("Roots.xpand: invalid array");
  if (newCount > arr.length)
    arr.length = newCount;
}

// Zero out an array

Roots.zerout = function(arr) {
  if (!Array.isArray(arr))
    throw ("Roots.zerout: invalid array");
  arr.fill(0);
}
