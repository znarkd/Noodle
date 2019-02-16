# Noodle
Noodle allows one to construct a multi-view data representation for JavaScript arrays. The data is assumed to consist of flat tables (rows and columns). Any combination of columns may be used when creating a data view.

Noodle is built upon *Roots*.  The Roots library provides a foundation for creating an efficient in-memory database. Its unique [list processing structures](http://armr.sourceforge.net/) simplify programming logic and allow the developer to rapidly sort, group, and select data.

### Example
```

// Create a sample data set

var zData = [];
var i, d;
var letters = [
  'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M',
  'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'
];
var noyes = ["No", "Yes"]

for (i = 0; i < 40000; i++) {
  d = (zData[i] = {});
  d["Seq"] = i + 1;
  d["Char1"] = letters[Math.floor(Math.random() * 26)];
  d["YN"] = noyes[Math.floor(Math.random() * 2)];
  d["String3"] = letters[Math.floor(Math.random() * 26)] +
    letters[Math.floor(Math.random() * 26)] +
    letters[Math.floor(Math.random() * 26)];
  d["RNum"] = Math.random() * 10000;
  d["Num"] = Math.floor((Math.random() * 100) + 1);
  d["Date"] = Date.now();
  d["Count"] = 1;
}

// Create a sample data view with Noodle.
// In the header, group by Char1 (bfi=2).  One group per page.
// In the columnar portion, show each unique combination of String3 (bfi=4)
// and Seq (bfi=1) for that page.

var db1 = new Noodle(zData);
db1.InitializeView();
db1.EnterHeader(2);
db1.EnterColumnar(4);
db1.EnterColumnar(1);
db1.GenerateView();

// Get the number of lines on a page.  Pages are numbered, starting with 1.
var page = 1;
var nline = db1.LineCount(page);

// Get a header value.
var bfi = 2;
var text = db1.GetValue(page, 0, bfi);

// Get a columnar value.  Lines and columns are numbered, starting with 1.
line = 1;
bfi = 4;
text = db1.GetValue(page, line, bfi);

// Save a columnar value
db1.PutValue("XYZ", page, line, bfi);

// Save a header value
bfi = 2;
db1.PutValue("Z", page, 0, bfi);
```
### Demo

[NoodleApp](https://znarkd.github.io/Noodle/NoodleApp.html)


### License
Copyright © [Dan Kranz](https://github.com/znarkd?tab=repositories).  All rights reserved.

Licensed under the [MIT](https://github.com/znarkd/Noodle/blob/master/LICENSE) License.
