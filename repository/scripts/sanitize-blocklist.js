const fs = require('fs'); // import the 'fs' module for reading the file

fs.readFile('./blocklist.json', (err, data) => {
  if (err) throw err;
  let array = JSON.parse(data).blocklist;
  let uniqueArray = [...new Set(array)];
  console.log(uniqueArray);
});
