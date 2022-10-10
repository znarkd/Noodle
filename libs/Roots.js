/*
 * Roots.js
 * Copyright (c) 2014-present  Dan Kranz
 * Release: October 10, 2022
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

Roots.colect = function(list, compareFunc, sortColumns, first, nextLine, group) {
  var i, last, check, ngroup;

  // Empty list?
  if (first[0] <= 0)
    return 0;

  ngroup = 1;
  last = group[0] = first[0];
  check = nextLine.length;

  // Compare adjacent list items

  for (i = nextLine[first[0]- 1]; i > 0; i = nextLine[i - 1]) {
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
  var line, last = afirst[0];
  var check = nextLine.length;

  if (afirst[0] === 0)
    afirst[0] = bfirst[0];
  else {
    for (line = afirst[0]; line != 0; line = nextLine[line - 1]) {
      last = line;
      if (check-- <= 0)
        throw "Roots.conlst: Bad input \"a\" list!";
    }
    nextLine[last - 1] = bfirst[0];
  }
  bfirst[0] = 0;
}

// Remove the elements specified by first/nextLine from block

Roots.delent = function(block, cpl, nline, first, nextLine) {
  if (!(block instanceof Uint8Array))
    throw "Roots.delent: block must be Uint8Array";
  if (cpl <= 0)
    throw "Roots.delent: cpl < 1";
  if (!Array.isArray(nline))
    throw "Roots.delent: nline must be Array"
  
  if (first[0] === 0)
    return;

  // Initialize the process
  var check = nextLine.length;
  var all = cpl * nline[0];
  var lines = first[0] - 1;
  var sf=[0,0], df=[0,0], hole, nkeep;

  for (hole = first[0]; hole != 0; hole = nextLine[hole-1]) {
    if (check-- <= 0)
      throw "Roots.delent: Bad input list!";
   
      // Set leading destination byte
      df[0] = lines * cpl + 1;

      // Skip sequential holes
      while (nextLine[hole-1] === hole+1)
         hole = nextLine[hole-1];

      // Leave if hole is at bottom of block
      if (hole === 0) {
         nline[0] = lines;
         return;
      }
  
      // Identify source length in lines and bytes
      nkeep = nextLine[hole-1] - (hole+1);
      if (nextLine[hole-1] === 0) 
        nkeep = nline-hole;
      lines += nkeep;

      // Move keepers up
      sf[0] = cpl * hole + 1;
      sf[1] = cpl * nkeep;
      df[1] = cpl * nkeep;
      Roots.lgmove(block, all, 1, sf, df, '\0');
   }
   nline[0] = lines;
}

// Remove the elements specified by first/nextLine from an array

Roots.delentArray = function(arr, first, nextLine) {
  if (!Array.isArray(arr))
    throw "Roots.delentArray: invalid array";

    if (first[0] === 0)
      return;

    var check = nextLine.length;
    var nline = arr.length;
    var lines = first[0] - 1;
    var sx, dx, nkeep;

    for (var hole = first[0]; hole != 0; hole = nextLine[hole-1]) {
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

//  Sum the values of block[numfld].
//
//  The sums are distributed by the block-line groups of groups/nextLine.
//
//  For group g:  block lines of groups[g]/nextLine are processed.
//  The sum of block[numfld] is computed and stored in sums[g].

Roots.grpcum = function(block, cpl, numfld, groups, nextLine, nGroup, sums) {
  if (!(block instanceof Uint8Array))
    throw "Roots.grpcum: block must be Uint8Array";
  if (cpl <= 0)
    throw "Roots.grpcum: cpl < 1";
  if (numfld[1] <= 0 || numfld[1] > cpl || numfld[0] <= 0)
    throw "Roots.grpcum: Bad numfld values"
  if (nGroup <= 0)
    throw "Roots.grpcum: nGroup < 1"

  var group, line, n, sum, v=[];
  var check = nextLine.length;

  v[1] = numfld[1];
  for (group=0; group < nGroup; group++) {
    sum = 0;
    for (line = groups[group]; line != 0; line = nextLine[line-1]) {
      if (check-- <= 0)
        throw "Roots.grpcum: Bad input list!";
      v[0] = numfld[0] + (line-1) * cpl;
      n = Roots.bunpac(block, v);
      sum += n;
    }
    sums[group] = sum;
  }
}

//  Sum the floating point number values of block[numfld].
//
//  The sums are distributed by the block-line groups of groups/nextLine.
//
//  For group g:  block lines of groups[g]/nextLine are processed.
//  The sum of block[numfld] is computed and stored in sums[g].

Roots.grplcm = function(block, cpl, numfld, groups, nextLine, nGroup, sums) {
  if (!(block instanceof Uint8Array))
    throw "Roots.grplcm: block must be Uint8Array";
  if (cpl <= 0)
    throw "Roots.grplcm: cpl < 1";
  if (numfld[1] <= 0 || numfld[1] > cpl || numfld[0] <= 0)
    throw "Roots.grplcm: Bad numfld values"
  if (nGroup <= 0)
    throw "Roots.grplcm: nGroup < 1"

  var group, line, n, sum, v=[];
  var check = nextLine.length;

  v[1] = numfld[1];
  for (group=0; group < nGroup; group++) {
    sum = 0.0;
    for (line = groups[group]; line != 0; line = nextLine[line-1]) {
      if (check-- <= 0)
        throw "Roots.grplcm: Bad input list!";
      v[0] = numfld[0] + (line-1) * cpl;
      n = Roots.runpac(block, v);
      sum += n;
    }
    sums[group] = sum;
  }
}

// Set map entries to 1 where the value at block[field] > 0.
// The user initializes map.

Roots.idxmap = function(block, cpl, field, first, nextLine, map) {
  if (!(block instanceof Uint8Array))
    throw "Roots.idxmap: block must be Uint8Array";
  if (cpl <= 0)
    throw "Roots.idxmap: cpl < 1";
  if (field[0] <= 0 || field[1] <= 0 || field[1] > cpl)
    throw "Roots.idxmap: Bad field values"; 

  var line, num, v=[];
  v[0] = field[0];
  v[1] = field[1];
  var check = nextLine.length;

  for (line = first[0]; line != 0; line = nextLine[line - 1]) {
    if (check-- <= 0)
      throw "Roots.idxmap: Bad input list!";
    num = Roots.bunpac(block, v);
    if (num != 0)
      map[num-1] = 1;
    v[0] += cpl;
  }
}

// Generate field definitions by scanning bitString.  Each output field
// points to a sub-string containing concatenated ones.

Roots.laybit = function(bitString, bpl, fields) {
  if (!(bitString instanceof Uint8Array))
    throw "Roots.laybit: bitString must be Uint8Array";
  if (bpl < 1)
    throw "Roots.laybit: bpl < 1"
  if (bpl != Math.ceil(bpl))
    throw "Roots.laybit: bpl not an integer"

  var i=1, cpl, byte, bit, LastBitWasOn=false;
  const bitmask = new Uint8Array([0x80, 0x40, 0x20, 0x10, 0x08, 0x04, 0x02, 0x01]);
  const leftones = new Uint8Array([0xFF, 0x80, 0xC0, 0xE0, 0xF0, 0xF8, 0xFC, 0xFE]);

  // Compute cpl from the input bpl
  cpl = Math.ceil(bpl/8);

  // Clean up the bits to the right of bpl in bitString
  byte = bpl;
  byte &= 7;
  bitString[cpl-1] &= leftones[byte];

  fields = [];
  field = [0,0];

  // Look at each byte in string
  for (byte=0; byte < cpl; ++byte) {

    // All bits are off
    if (! bitString[byte]) {

      // Set the field length if necessary
      if (LastBitWasOn) {
        field[1] = i - field[0];

        // Next field
        fields.push(field);
        LastBitWasOn = false;
      }

      i += 8;
    }

    // Some bits are on
    else {  

      // Look at the byte's bits from left to right
      for (bit=0; bit < 8; ++bit, ++i) {

        // This bit is on
        if (bitString[byte] & bitmask[bit]) {

          // Start a new field definition if necessary
          if (!LastBitWasOn) {
            field[0] = i;
            LastBitWasOn = true;
          }
        }

        // This bit is off
        else {

          // Set the field length if necessary
          if (LastBitWasOn) {
            field[1] = i - field[0];

            // Next field
            fields.push(field);
            LastBitWasOn = false;
          }
        }
      }
    }
  }

  // Close off the last field definition
  if (LastBitWasOn) {
    field[1] = i - field[0];
    fields.push(field);
  }

  return fields.length;
}

// The intersection of seta with setb replaces setb

Roots.lgand = function(seta, cpl, setb) {
  if (cpl < 0)
    throw "Roots.lgand: cpl < 0";
  if (!(seta instanceof Uint8Array))
    throw "Roots.lgand: seta must be Uint8Array";
  if (!(setb instanceof Uint8Array))
    throw "Roots.lgand: setb must be Uint8Array";

  var i;
  for (i=0; i < cpl; i++)
    setb[i] &= seta[i];
  
  // Determine if the output set is empty
  for (i=0; i < cpl; i++) {
    if (setb[i])
      return false;
  }
  return true;
}

// All index values stored in block[field] are transformed based on the
// values in the rank column; i.e. for all nline block lines,
// block[field] is set to rank[block[field]]
// provided that block[field] is not equal to zero.

Roots.lgmap = function(block, cpl, nline, field, rank) {
  if (!(block instanceof Uint8Array))
    throw "Roots.lgmap: block must be Uint8Array";
  if (cpl <= 0)
    throw "Roots.lgmap: cpl < 1";
  if (field[0] <= 0 || field[1] <= 0 || field[1] > cpl)
    throw "Roots.lgmap: Bad field values";
  
  var i, line, v=[];
  
  v[0] = field[0];
  v[1] = field[1];
  
  // Set field to rank value for each record in block
  for (line = nline; line-- > 0;) {

     // Get the index value from block
     i = Roots.bunpac(block, v);
     if (i > 0)
        Roots.pacbin(rank[i-1], block, v);

     // Advance to the next record
     v[0] += cpl;
  }
}

// Move bytes from source to dest

Roots.lgmove = function(block, cpl, nline, sfld, dfld, pad) {
  if (!(block instanceof Uint8Array))
    throw "Roots.lgmove: block must be Uint8Array";
  if (cpl < 1)
    throw "Roots.lgmove: cpl < 1";

  var s, d, line, move, leftover;

  move = (sfld[1] > dfld[1]) ? dfld[1] : sfld[1];
  leftover = (move < dfld[1]) ? (dfld[1]-move) : 0;
  
  // Perform a move for each record
  for (line = 0; line < nline; ++line) {
    s = line*cpl + sfld[0] - 1;
    d = line*cpl + dfld[0] - 1;

    // Move the data
    if (move)
      block.copyWithin(d, s, s+move);

    // Fill leftover destination with pad
    if (leftover) {
      d += move;
      block.fill(pad, d, d+leftover);
    }
  }
}

// The union of seta with setb replaces setb

Roots.lgor = function(seta, cpl, setb) {
  if (cpl < 0)
    throw "Roots.lgor: cpl < 0";
  if (!(seta instanceof Uint8Array))
    throw "Roots.lgor: seta must be Uint8Array";
  if (!(setb instanceof Uint8Array))
    throw "Roots.lgor: setb must be Uint8Array";

  var i;
  for (i=0; i < cpl; i++)
    setb[i] |= seta[i];

  // Determine if the output set is empty
  for (i=0; i < cpl; i++) {
    if (setb[i])
      return false;
  }
  return true;
}

// The members (on-bits) of seta are removed from setb.
// The result replaces setb.

Roots.lgexcl = function(seta, cpl, setb) {
  if (cpl < 0)
    throw "Roots.lgexcl: cpl < 0";
  if (!(seta instanceof Uint8Array))
    throw "Roots.lgexcl: seta must be Uint8Array";
  if (!(setb instanceof Uint8Array))
    throw "Roots.lgexcl: setb must be Uint8Array";

  var i;
  for (i=0; i < cpl; i++)
    setb[i] &= ~(seta[i]);
  
  // Determine if the output set is empty
  for (i=0; i < cpl; i++) {
    if (setb[i])
      return false;
  }
  return true;
}

// The sort order represented by sorti is converted into a list

Roots.list1 = function(sorti, nline, nextLine) {
  var i=1, n, last;

  if (nline === 0)
    return 0;

  if (nline < 0)
    throw "Roots.list1: nline < 0";

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

// For each line in first/nextLine, pack the integer num into 
// the block position indicated by field.

Roots.paclst = function(num, block, cpl, field, first, nextLine) {
  if (!(block instanceof Uint8Array))
    throw "Roots.paclst: block must be Uint8Array";
  if (cpl <= 0)
    throw "Roots.paclst: cpl < 1";
  if (field[0] <= 0 || field[1] <= 0 || field[1] > cpl)
    throw "Roots.paclst: Bad field values";

  var line, v=[];
  var check = nextLine.length;

  v[1] = field[1];
  for (line = first; line != 0; line = nextLine[line - 1]) {
    if (check-- <= 0)
      throw "Roots.paclst: Bad input list!";
    v[0] = field[0] + (line-1) * cpl;
    Roots.pacbin(num, block, v);
  }
}

// For each array entry in first/nextLine, set its value to num.

Roots.paclstArray = function(num, arr, first, nextLine) {
  if (!Array.isArray(arr))
    throw ("Roots.paclstArray: invalid array");

  var line, check = nextLine.length;

  for (line = first; line != 0; line = nextLine[line - 1]) {
    if (check-- <= 0)
      throw "Roots.paclstArray: Bad input list!";
    arr[line - 1] = num;
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

// For each line in first/nextLine, pack the floating point number
// rnum into the block position indicated by field.

Roots.pcrlst = function(rnum, block, cpl, field, first, nextLine) {
  if (!(block instanceof Uint8Array))
    throw "Roots.pcrlst: block must be Uint8Array";
  if (cpl <= 0)
    throw "Roots.pcrlst: cpl < 1";
  if (field[0] <= 0 || field[1] <= 0 || field[1] > cpl)
    throw "Roots.pcrlst: Bad field values";

  var line, v=[];
  var check = nextLine.length;

  v[1] = field[1];
  for (line = first; line != 0; line = nextLine[line - 1]) {
    if (check-- <= 0)
      throw "Roots.pcrlst: Bad input list!";
    v[0] = field[0] + (line-1) * cpl;
    Roots.pacrel(rnum, block, v);
  }
}

// For all block lines of first/nextLine, the string stored at block[field]
// is compared with a regular expression.

// Entries matching the regular expression are entered in match/nextLine.
// Non-matching entries remain in first/nextLine.

Roots.rexprn = function(block, cpl, field, regex, first, nextLine, match) {
  if (!(block instanceof Uint8Array))
    throw "Roots.rngprn: block must be Uint8Array";
  if (cpl <= 0)
    throw "Roots.rngprn: cpl < 1";
  if (field[0] <= 0 || field[1] <= 0 || field[1] > cpl)
    throw "Roots.rngprn: Bad field values";
  
  var num, v=[], cur_line, next_line, prev_line, last_match;
  var check = nextLine.length;

  match[0] = next_line = prev_line = last_match = 0;
  cur_line = first[0];
  v[1] = field[1];

  while (cur_line != 0) {
    if (check-- <= 0)
      throw "Roots.rexprn: Bad input list!";

    next_line = nextLine[cur_line-1];
    
    v[0] = field[0] + (cur_line-1) * cpl;
    num = Roots.bunpac(block,v);

    // Match
    if (num >= range[0] && num <= range[1]) {

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

// For all lines of first/nextLine, the string stored at arr[line]
// is compared with a regular expression.  

// Entries matching the regular expression are entered in match/lnextl.
// Non-matching entries remain in first/lnextl.

Roots.rexprnArray = function(arr, regex, first, nextLine, match) {
  if (!Array.isArray(arr))
    throw "Roots.rexprnArray: invalid array";

  var cur_line, next_line, prev_line, last_match;
  var check = nextLine.length;

  match[0] = next_line = prev_line = last_match = 0;
  cur_line = first[0];

  while (cur_line != 0) {
    if (check-- <= 0)
      throw "Roots.rexprnArray: Bad input list!";

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

// For all block lines of first/nextLine, the floating point number
// stored at block[field] is compared with range.

// Entries falling within the range are entered in match/nextLine.
// Non-matching entries remain in first/nextLine.

Roots.rgrprn = function(block, cpl, field, range, first, nextLine, match) {
  if (!(block instanceof Uint8Array))
    throw "Roots.rgrprn: block must be Uint8Array";
  if (cpl <= 0)
    throw "Roots.rgrprn: cpl < 1";
  if (field[0] <= 0 || field[1] <= 0 || field[1] > cpl)
    throw "Roots.rgrprn: Bad field values";

  var rnum, v=[], cur_line, next_line, prev_line, last_match;
  var check = nextLine.length;

  match[0] = next_line = prev_line = last_match = 0;
  cur_line = first[0];
  v[1] = field[1];

  while (cur_line != 0) {
    if (check-- <= 0)
      throw "Roots.rngprn: Bad input list!";

    next_line = nextLine[cur_line-1];
    
    v[0] = field[0] + (cur_line-1) * cpl;
    rnum = Roots.runpac(block,v);

    // Match
    if (rnum >= range[0] && rnum <= range[1]) {

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

// For all block lines of first/nextLine, the number stored at block[field]
// is compared with range.

// Entries falling within the range are entered in match/nextLine.
// Non-matching entries remain in first/nextLine.

Roots.rngprn = function(block, cpl, field, range, first, nextLine, match) {
  if (!(block instanceof Uint8Array))
    throw "Roots.rngprn: block must be Uint8Array";
  if (cpl <= 0)
    throw "Roots.rngprn: cpl < 1";
  if (field[0] <= 0 || field[1] <= 0 || field[1] > cpl)
    throw "Roots.rngprn: Bad field values";
  
  var num, v=[], cur_line, next_line, prev_line, last_match;
  var check = nextLine.length;

  match[0] = next_line = prev_line = last_match = 0;
  cur_line = first[0];
  v[1] = field[1];

  while (cur_line != 0) {
    if (check-- <= 0)
      throw "Roots.rngprn: Bad input list!";

    next_line = nextLine[cur_line-1];
    
    v[0] = field[0] + (cur_line-1) * cpl;
    num = Roots.bunpac(block,v);

    // Match
    if (num >= range[0] && num <= range[1]) {

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

// For all lines of first/nextLine, the number stored at arr[line]
// is compared with range.  

// Entries falling within the range are entered in match/lnextl.
// Non-matching entries remain in first/lnextl.

Roots.rngprnArray = function(arr, range, first, nextLine, match) {
  if (!Array.isArray(arr))
    throw "Roots.rngprnArray: invalid array";

  var cur_line, next_line, prev_line, last_match;
  var check = nextLine.length;

  match[0] = next_line = prev_line = last_match = 0;
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

// For all block lines of first/nextLine block(field) is scanned for the
// substring contained within text(tfield).

// Matching entries are entered in match/nextLine.
// Non-matching entries remain in first/nextLine.

// The scanpr method is case insensitive.

Roots.scanpr = function(block, cpl, field, text, tfield, first, nextLine, match) {
  var n, start, cur_line, next_line, prev_line, last_match;
  var check = nextLine.length;
  var s1, s2;
  var decoder = new TextDecoder("utf-8");
  
  n = field[1];
  if (n > tfield[1]) n = tfield[1];

  if (!(block instanceof Uint8Array))
    throw "Roots.scanpr: block must be Uint8Array";
  if (cpl <= 0)
    throw "Roots.scanpr: cpl < 1";
  if (field[0] <= 0 || tfield[0] <= 0 || n <= 0 || n > cpl)
    throw "Roots.scanpr: Bad field values";
  if (field[0] + field[1] - 1 > cpl)
    throw "Roots.scanpr: Bad field values";

  match[0] = next_line = prev_line = last_match = 0;
  cur_line = first[0];
  s2 = text.slice(tfield[0]-1, tfield[0]-1+n).toLowerCase();

  while (cur_line != 0) {
    if (check-- <= 0)
      throw "Roots.scanpr: Bad input list!";

    next_line = nextLine[cur_line-1];
    
    start = field[0] + (cur_line-1) * cpl - 1;
    s1 = decoder.decode(block.slice(start, start+n)).toLowerCase();
    
    // Match
    if (s1.includes(s2)) {

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

// For all lines of first/nextLine, the string stored at arr(line) is
// scanned for the substring contained within text(tfield).

// Matching entries are entered in match/nextLine.
// Non-matching entries remain in first/nextLine.

// The scanprArray method is case insensitive.

Roots.scanprArray = function(arr, text, tfield, first, nextLine, match) {
  if (!Array.isArray(arr))
    throw "Roots.scanprArray: invalid array";

  var cur_line, next_line, prev_line, last_match;
  var check = nextLine.length;
  var s1, s2;
  
  if (tfield[0] <= 0 || tfield[1] <= 0)
    throw "Roots.scanprArray: Bad tfield values";

  match[0] = next_line = prev_line = last_match = 0;
  cur_line = first[0];
  s2 = text.slice(tfield[0]-1, tfield[0]-1+tfield[1]).toLowerCase();

  while (cur_line != 0) {
    if (check-- <= 0)
      throw "Roots.scanprArray: Bad input list!";

    next_line = nextLine[cur_line-1];
    
    s1 = arr[cur_line-1].toLowerCase();
    
    // Match
    if (s1.includes(s2)) {

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

// For all lines of first/nextLine, the value stored at arr[line][col]
// is scanned for the substring contained within text(tfield).

// Matching entries are entered in match/nextLine.
// Non-matching entries remain in first/nextLine.

// The scanprArrayCol method is case insensitive.

Roots.scanprArrayCol = function(arr, col, text, tfield, first, nextLine, match) {
  if (!Array.isArray(arr))
    throw "Roots.scanprArrayCol: invalid array";

  var cur_line, next_line, prev_line, last_match;
  var check = nextLine.length;
  var s1, s2;

  if (tfield[0] <= 0 || tfield[1] <= 0)
    throw "Roots.scanprArrayCol: Bad tfield values";

  match[0] = next_line = prev_line = last_match = 0;
  cur_line = first[0];
  s2 = text.slice(tfield[0]-1, tfield[0]-1+tfield[1]).toLowerCase();

  while (cur_line != 0) {
    if (check-- <= 0)
      throw "Roots.scanprArrayCol: Bad input list!";

    next_line = nextLine[cur_line-1];

    s1 = arr[cur_line-1][col].toLowerCase();

    // Match
    if (s1.includes(s2)) {

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

// Prime a new list

Roots.seqlst = function(first, nline, nextLine) {
  if (!(first instanceof Array))
    throw "Roots.seqlst: first must be Array";
  if (!(nextLine instanceof Array))
    throw "Roots.seqlst: nextLine must be Array";

  var n = nline;
  if (n === 0) {
    first[0] = 0;
    return;
  }

  var i=2, k=0;
  while (--n > 0) {
    nextLine[k++] = i++;
  }
  nextLine[k] = 0;
  first[0] = 1;
}

// Set bitString(line) to "1" for all lines found in first/nextLine

Roots.setbit = function(first, nextLine, bitString) {
  if (!(bitString instanceof Uint8Array))
    throw "Roots.setbit: bitString must be Uint8Array";

  const tbits = new Uint8Array([0x80,0x40,0x20,0x10,0x08,0x04,0x02,0x01]);
  var check = nextLine.length;

  for (var line = first[0]; line > 0; line = nextLine[line-1]) {
    if (check-- <= 0)
      throw "Roots.setbit: Bad input list!";
    bitString[(line-1) >> 3] |= tbits[(line-1) & 0x7];
  }
}

// The bit field of bitString is set to all ones.

Roots.setone = function(bitString, field) {
  if (!(bitString instanceof Uint8Array))
    throw "Roots.setone: bitString must be Uint8Array";

  var field_start, field_length, byte1, bit1, bytel, bitl;
  mask = new Uint8Array(1);
  const leftzero  = new Uint8Array([0xFF,0x7F,0x3F,0x1F,0x0F,0x07,0x03,0x01]);
  const rightzero = new Uint8Array([0x80,0xC0,0xE0,0xF0,0xF8,0xFC,0xFE,0xFF]);

  // Process the bit field
  field_start = field[0];
  --field_start;
  field_length = field[1];

  // Determine the first and last bytes
  byte1 = field_start >> 3;
  bit1 = field_start % 8;
  bytel = (field_start+field_length-1) >> 3;
  bitl = (field_start+field_length-1) % 8;

  // Bit string is contained in a single byte
  if (byte1 === bytel) {
    mask[0] = 0xFF;
    mask[0] &= leftzero[bit1];
    mask[0] &= rightzero[bitl];
    bitString[byte1] |= mask[0];
  }

  // Bit string spans several bytes
  else {
    // Turn on bits in the first byte
    bitString[byte1] |= leftzero[bit1];

    // Turn on bits in the last byte
    bitString[bytel] |= rightzero[bitl];

    // Set in-between bytes to all ones
    for (byte1 += 1; byte1 != bytel; byte1 += 1)
      bitString[byte1] = 0xFF;
  }
}

// The input list first/nextLine is split into 2 lists.
// Members whose bitString(line) contains a "1" are moved to output sub-list match/nextLine.
// Members whose bitString(line) contains a "0" remain in first/nextLine.

Roots.setprn = function(bitString, first, nextLine, match) {
  if (!(bitString instanceof Uint8Array))
    throw "Roots.setprn: block must be Uint8Array";
  
  var cur_line, prev_line, last_match;
  var check = nextLine.length;
  const tbits = new Uint8Array([0x80,0x40,0x20,0x10,0x08,0x04,0x02,0x01]);

  match[0] = next_line = prev_line = last_match = 0;
  cur_line = first[0];

  while (cur_line != 0) {
    if (check-- <= 0)
      throw "Roots.setprn: Bad input list!";

    next_line = nextLine[cur_line-1];
    
    // Match
    if (bitString[(cur_line-1)>>3] & tbits[(cur_line-1) & 0x7]) {

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

// The bit field of bitString is set to all zeros.

Roots.setzer = function(bitString, field) {
  if (!(bitString instanceof Uint8Array))
    throw "Roots.setzer: bitString must be Uint8Array";

  var field_start, field_length, byte1, bit1, bytel, bitl;
  mask = new Uint8Array(1);
  const leftones  = new Uint8Array([0x00,0x80,0xC0,0xE0,0xF0,0xF8,0xFC,0xFE]);
  const rightones = new Uint8Array([0x7F,0x3F,0x1F,0x0F,0x07,0x03,0x01,0x00]);

  // Process the bit field
  field_start = fields[0];
  --field_start;
  field_length = fields[1];

  // Determine the first and last bytes
  byte1 = field_start >> 3;
  bit1 = field_start % 8;
  bytel = (field_start+field_length-1) >> 3;
  bitl = (field_start+field_length-1) % 8;

  // Bit string is contained in a single byte
  if (byte1 === bytel) {
    mask[0] = 0x00;
    mask[0] |= leftones[bit1];
    mask[0] |= rightones[bitl];
    bitString[byte1] &= mask[0];
  }

  // Bit string spans several bytes
  else {
    // Turn off bits in the first byte
    bitString[byte1] &= leftones[bit1];

    // Turn off bits in the last byte
    bitString[bytel] &= rightones[bitl];

    // Set in-between bytes to all zeros
    for (byte1 += 1; byte1 != bytel; byte1 += 1)
      bitString[byte1] = 0x00;
  }
}

// Array elements are physically re-arranged according to the sequence
// expressed by sorti; i.e. arr(sorti(i)) is moved to arr(i).
//
// The output array replaces the input array.

Roots.srmoveArray = function(sorti, arr) {
  if (!Array.isArray(arr))
    throw "Roots.srmoveArray: invalid array";

  var i, n = arr.length;
  var output = new Array(n);

  for (i=0; i < n; i++)
    output[i] = arr[sorti[i]-1];

  for (i=0; i < n; i++)
    arr[i] = output[i];
}

// Prune by bit-string.
// Entries for which bit string(block(field)) is on are entered
// in match/nextLine.  Non-matching entries remain in first/nextLine.

Roots.strprn = function(block, cpl, field, string, first, nextLine, match) {
  if (!(block instanceof Uint8Array))
    throw "Roots.strprn: block must be Uint8Array";
  if (!(string instanceof Uint8Array))
    throw "Roots.strprn: string must be Uint8Array";  
  if (cpl <= 0)
    throw "Roots.strprn: cpl < 1";
  if (field[0] <= 0 || field[1] <= 0 || field[1] > cpl)
    throw "Roots.strprn: Bad field values";
  
  var num, v=[], cur_line, next_line, prev_line, last_match;
  var check = nextLine.length;
  const tbits  = new Uint8Array([0x80,0x40,0x20,0x10,0x08,0x04,0x02,0x01]);

  match[0] = next_line = prev_line = last_match = 0;
  cur_line = first[0];
  v[1] = field[1];

  while (cur_line != 0) {
    if (check-- <= 0)
      throw "Roots.strprn: Bad input list!";

    next_line = nextLine[cur_line-1];
    
    v[0] = field[0] + (cur_line-1) * cpl;
    num = Roots.bunpac(block,v);

    if (num === 0)
      prev_line = cur_line;

    else {
      num -= 1;

      // Match
      if (string[num >> 3] & tbits[num & 0x7]) {

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
    }

    cur_line = next_line;
  }

  if (last_match != 0)
    nextLine[last_match-1] = 0;
}

// For all block lines of first/nextLine, the text string stored
// at block(field) is compared with text(tfield).

// Matching entries are entered in match/nextLine.
// Non-matching entries remain in first/nextLine.

Roots.txtprn = function(block, cpl, field, text, tfield, first, nextLine, match) {
  var n, start, cur_line, next_line, prev_line, last_match;
  var check = nextLine.length;
  var s1, s2, rc;
  var decoder = new TextDecoder("utf-8");
  
  n = field[1];
  if (n > tfield[1]) n = tfield[1];

  if (!(block instanceof Uint8Array))
    throw "Roots.txtprn: block must be Uint8Array";
  if (cpl <= 0)
    throw "Roots.txtprn: cpl < 1";
  if (field[0] <= 0 || tfield[0] <= 0 || n <= 0 || n > cpl)
    throw "Roots.txtprn: Bad field values";
  if (field[0] + field[1] - 1 > cpl)
    throw "Roots.txtprn: Bad field values";

  match[0] = next_line = prev_line = last_match = 0;
  cur_line = first[0];
  s2 = text.slice(tfield[0]-1, tfield[0]-1+n);

  while (cur_line != 0) {
    if (check-- <= 0)
      throw "Roots.txtprn: Bad input list!";

    next_line = nextLine[cur_line-1];
    
    start = field[0] + (cur_line-1) * cpl - 1;
    s1 = decoder.decode(block.slice(start, start+n));
    rc = s1.localeCompare(s2);

    // Match
    if (rc === 0) {

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

// For all lines of first/nextLine, the value stored at arr[line][col]
// is compared with an array of values.  

// Entries which match one of the values are entered in match/nextLine.
// Non-matching entries remain in first/nextLine.

Roots.txtprnArrayCol = function(arr, col, values, first, nextLine, match) {
  if (!Array.isArray(arr))
    throw "Roots.txtprnArrayCol: invalid array";

  var cur_line, next_line, prev_line, last_match;
  var check = nextLine.length;
  var text;

  match[0] = next_line = prev_line = last_match = 0;
  cur_line = first[0];

  while (cur_line != 0) {
    if (check-- <= 0)
      throw "Roots.txtprnArrayCol: Bad input list!";

    next_line = nextLine[cur_line-1];

    // Match
    text = arr[cur_line-1][col] ?? "";
    if (values.indexOf(test.toString()) >= 0) {

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

// This function can be removed once browsers support ArrayBuffer.transfer.
// See https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/ArrayBuffer/transfer

// Extend an Uint8Array

Roots.transfer = function(source, length) {
  if (!(source instanceof Uint8Array))
    throw "Roots.transfer: Source must be an instance of Uint8Array";
  if (length <= source.length)
    return source.slice(0, length);
  var destView = new Uint8Array(length);
  destView.set(source);
  return destView;
}

// Extend an array

Roots.xpand = function(arr, newCount) {
  if (!Array.isArray(arr))
    throw "Roots.xpand: invalid array";
  var n = arr.length;
  if (newCount <= n)
    return;
  arr.length = newCount;
  arr.fill(0,n);
}

// Zero out an array

Roots.zerout = function(arr) {
  if (!Array.isArray(arr) && !(arr instanceof Uint8Array))
    throw "Roots.zerout: invalid array";
  arr.fill(0);
}
