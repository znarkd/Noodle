/*
 * Roots.js
 * Copyright (c) 2014-present  Dan Kranz
 * Release: February 16, 2019
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
  var line, last = afirst;
  var check = nextLine.length;

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

Roots.delent = function() {

}

// Remove the elements specified by first,nextLine from an array

Roots.delentArray = function(arr, first, nextLine) {
  if (!Array.isArray(arr))
    throw "Roots.delentArray: invalid array";

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
      n = bunpac(block, v);
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
      n = runpac(block, v);
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

  var line, num;
  var v = field;
  var check = nextLine.length;

  for (line = first; line != 0; line = nextLine[line - 1]) {
    if (check-- <= 0)
      throw "Roots.idxmap: Bad input list!";
    num = bunpac(block, v);
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

  var i=1, cpl, byte, bit, LastBitWasOn=false;
  const bitmask = new Uint8Array([0x80, 0x40, 0x20, 0x10, 0x08, 0x04, 0x02, 0x01]);
  const leftones = new Uint8Array([0xFF, 0x80, 0xC0, 0xE0, 0xF0, 0xF8, 0xFC, 0xFE]);

  // Compute cpl from the input bpl
  cpl = bpl/8;
  if (bpl%8)
  ++cpl;  

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
    throw("Roots.list1: nline < 0");

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
    pacbin(num, block, v);
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
    pacrel(rnum, block, v);
  }
}

// For all block lines of first/nextLine, the floating point number
// stored at block[field] is compared with range.

// Entries falling within the range are entered in match/lnextl.
// Non-matching entries remain in first/lnextl.

Roots.rgrprn = function(block, cpl, field, range, first, nextLine, match) {
  if (!(block instanceof Uint8Array))
    throw "Roots.rgrprn: block must be Uint8Array";
  if (cpl <= 0)
    throw "Roots.rgrprn: cpl < 1";
  if (field[0] <= 0 || field[1] <= 0 || field[1] > cpl)
    throw "Roots.rgrprn: Bad field values";

  var rnum, v=[], cur_line, prev_line, last_match;
  var check = nextLine.length;

  match[0] = next_line, prev_line = last_match = 0;
  cur_line = first[0];
  v[1] = field[1];

  while (cur_line != 0) {
    if (check-- <= 0)
      throw "Roots.rngprn: Bad input list!";

    next_line = nextLine[cur_line-1];
    
    v[0] = field[0] + (cur_line-1) * cpl;
    rnum = runpac(block,v);

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

// Entries falling within the range are entered in match/lnextl.
// Non-matching entries remain in first/lnextl.

Roots.rngprn = function(block, cpl, field, range, first, nextLine, match) {
  if (!(block instanceof Uint8Array))
    throw "Roots.rngprn: block must be Uint8Array";
  if (cpl <= 0)
    throw "Roots.rngprn: cpl < 1";
  if (field[0] <= 0 || field[1] <= 0 || field[1] > cpl)
    throw "Roots.rngprn: Bad field values";
  
  var num, v=[], cur_line, prev_line, last_match;
  var check = nextLine.length;

  match[0] = next_line, prev_line = last_match = 0;
  cur_line = first[0];
  v[1] = field[1];

  while (cur_line != 0) {
    if (check-- <= 0)
      throw "Roots.rngprn: Bad input list!";

    next_line = nextLine[cur_line-1];
    
    v[0] = field[0] + (cur_line-1) * cpl;
    num = bunpac(block,v);

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

// Set bitString[line] to "1" for all lines found in first, nextLine

Roots.setbit = function(first, nextLine, bitString) {
  if (!(bitString instanceof Uint8Array))
    throw "Roots.setbit: bitString must be Uint8Array";

  const tbits = new Uint8Array([0x80,0x40,0x20,0x10,0x08,0x04,0x02,0x01]);
  var check = nextLine.length;

  for (var line = first; line > 0; line = nextLine[line-1]) {
    if (check-- <= 0)
      throw "Roots.setbit: Bad input list!";
    bitString[(line-1) >> 3] |= tbits[(line-1) & 0x7];
  }
}

Roots.setprn = function(bitString, first, nextLine, match) {
  if (!(bitString instanceof Uint8Array))
    throw "Roots.setprn: block must be Uint8Array";
  
  var cur_line, prev_line, last_match;
  var check = nextLine.length;
  const tbits = new Uint8Array([0x80,0x40,0x20,0x10,0x08,0x04,0x02,0x01]);

  match[0] = next_line, prev_line = last_match = 0;
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

// The nf bit fields of bitString are set to all zeros.

Roots.setzer = function(bitString, fields, nf) {
  if (!(bitString instanceof Uint8Array))
    throw "Roots.setzer: bitString must be Uint8Array";

  var n, field_start, field_length;
  var i, f, n, byte1, bit1, bytel, bitl;
  mask = new Uint8Array(1);

  const leftones  = new Uint8Array([0x00,0x80,0xC0,0xE0,0xF0,0xF8,0xFC,0xFE]);
  const rightones = new Uint8Array([0x7F,0x3F,0x1F,0x0F,0x07,0x03,0x01,0x00]);

  // Process each bit field
  f = 0;
  for (n = nf; n--;) {
    field_start = fields[f++];
    --field_start;
    field_length = fields[f++];

    // Determine the first and last bytes
    byte1 = field_start >> 3;
    bit1 = field_start % 8;
    bytel = (field_start+field_length-1) >> 3;
    bitl = (field_start+field_length-1) % 8;

    // Bit string is contained in a single byte
    if (byte1 == bytel) {
      mask[0] = 0x00;
      mask[0] |= leftones[bit1];
      mask[0] |= rightones[bitl];
      bitString[byte1] &= mask[0];
    }

    // Bit string spans several bytes
    else {
      // Turn on bits in the first byte
      bitString[byte1] &= leftones[bit1];

      // Turn on bits in the last byte
      bitString[bytel] &= rightones[bitl];

      // Set in-between bytes to all zeros
      for (byte1 += 1; byte1 != bytel; byte1 += 1)
        bitString[byte1] = 0x00;
    }
  }
}

// Array elements are physically re-arranged according to the sequence
// expressed by sorti; i.e. arr[sorti[i]] is moved to block[i].
//
// The output array replaces the input array.

Roots.srmoveArray = function(sorti, arr) {
  if (!Array.isArray(arr))
    throw "Roots.srmoveArray: invalid array";

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

Roots.ugroup = function() {

}

Roots.uqsort = function() {

}

// Extend an array

Roots.xpand = function(arr, newCount) {
  if (!Array.isArray(arr))
    throw "Roots.xpand: invalid array";
  if (newCount > arr.length)
    arr.length = newCount;
}

// Zero out an array

Roots.zerout = function(arr) {
  if (!Array.isArray(arr))
    throw "Roots.zerout: invalid array";
  arr.fill(0);
}
