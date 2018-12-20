/*
 * Roots.js
 * Copyright (c) 2014-present  Dan Kranz
 * Release: December 19, 2018
 */

var Roots = Roots || {};


// Unpack the binary integer stored within block at field.

Roots.bunpac = function(block, field) {
  if (field[0] < 1 || field[1] < 1 || field[1] > 4)
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


// The integer num is packed into the block position indicated by field

Roots.pacbin = function(num, block, field) {
  if (!Number.isInteger(num))
    throw "Roots.pacbin: Not an integer";
  if (num < 0 && field[1] < 4)
    throw "Roots.pacbin: Need 4 bytes for negative numbers";
  if (field[0] < 1 || field[1] < 1 || field[1] > 4)
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


Roots.seqlst = function(nextLine) {
  var n = nextLine.length;
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


Roots.xpand = function(arr, newCount) {
  if (arr === undefined)
    throw ("Roots.xpand: undefined array");
  if (newCount > arr.length)
    arr.length = newCount;
}
