const xlsx = require('xlsx');
const path = 'c:\\Users\\girid\\Downloads\\woodlands data (1).xlsx';
const workbook = xlsx.readFile(path);
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];
const data = xlsx.utils.sheet_to_json(worksheet);
console.log('Total rows:', data.length);
console.log('First 5 rows:');
console.log(data.slice(0, 5));
