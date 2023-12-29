#!/usr/bin/env node
import fs from 'fs';
import {createCommand} from "commander";
import csv from 'csvtojson';
import xlsx from 'xlsx';
import {GoogleSpreadsheet} from 'google-spreadsheet';
import process from 'process';
import { createRequire } from "module";

const program = createCommand();
program
  .description('Sheets joiner - nodejs cli tool for joining two tables by column')
  .option('--table1 <table1>', 'first table')
  .option('--table2 <table2>', 'second table')
  .option('--sheet1 <sheet1>', 'first sheet')
  .option('--sheet2 <sheet2>', 'second sheet')
  .option('--mode <mode>', 'one of: intersect, join, absent, default: intersect', 'intersect')
  .option('--column1 <column1>', 'column name in first table, default: url', 'url')
  .option('--column2 <column2>', 'column name in second table, default: url', 'url')
  .option('--output <output>', 'console, path to csv file, path to xlsx file, default: console', 'console')
  .option('--csv-delimiter <csvDelimiter>', 'delimiter for csv file, default: `,`', ',')
  // .parse(process.argv);
  .parse(process.argv)

const options = program.opts();

const table1 = options.table1 || options.sheet1;
const table2 = options.table2 || options.sheet2;
// console.log("process.argv:", process.argv);
// console.log("options:", options);
if (!table1 || !table2) {
  program.help();
  console.log('Error: table1 or table2 not defined!');
  process.exit(1);
}
// console.log('table1:', table1);
// console.log('table2:', table2);

const mode = options.mode;
if (!['intersect', 'join', 'absent'].includes(mode)) {
  // program.help();
  console.log('Error: mode should be one of: intersect, join, absent!');
  process.exit(1);
}
// console.log('mode:', mode);

const column1 = options.column1;
const column2 = options.column2;
// console.log('column1:', column1);
// console.log('column2:', column2);

const output = options.output;
// console.log('output:', output);

const csvDelimiter = options.csvDelimiter;
// console.log('csvDelimiter:', csvDelimiter);

function isColumnInData(columnName, data) {
  const columns = getTableColumns(data);
  return columns.includes(columnName);
}

async function start() {
  const table1Data = await readTable(table1);
  const table2Data = await readTable(table2);

  // console.log('table1Data:', table1Data);
  // console.log('table2Data:', table2Data);

  if (!isColumnInData(column1, table1Data)) {
    console.log(`Error: column "${column1}" not found in table1!`);
    // program.help();
    process.exit(1);
  }
  if (!isColumnInData(column2, table2Data)) {
    console.log(`Error: column "${column2}" not found in table1!`);
    // program.help();
    process.exit(1);
  }

  const outputData = await join(table1Data, table2Data, column1, column2, mode);
  // console.log('outputData:', outputData);

  if (output === 'console') {
    console.log(outputData);
  } else if (output.endsWith('.csv')) {
    const csv = json2csv(outputData, csvDelimiter);
    fs.writeFileSync(output, csv);
    console.log(`Saved to ${output}`);
  } else if (output.endsWith('.xlsx')) {
    const wb = json2xlsx(outputData);
    xlsx.writeFile(wb, output);
    console.log(`Saved to ${output}`);
  } else {
    // program.help();
    console.log('Error: output should be one of: console, path to csv file, path to xlsx file!');
    process.exit(1);
  }
}

function json2csv(data, delimiter = ',') {
  const fields = Object.keys(data[0]);
  const replacer = (key, value) => value === null ? '' : value;
  let csv = data.map(row => fields.map(fieldName => JSON.stringify(row[fieldName], replacer)).join(delimiter));
  csv.unshift(fields.join(delimiter));
  csv = csv.join('\r\n');
  return csv;
}

function json2xlsx(data) {
  const ws = xlsx.utils.json_to_sheet(data);
  const wb = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(wb, ws, 'data');
  return wb;
}

async function readTable(table) {
  if (table.startsWith('https://docs.google.com/spreadsheets')) {
    return await readGoogleSheets(table);
  } else if (table.endsWith('.csv')) {
    return await readCsv(table);
  } else if (table.endsWith('.xlsx')) {
    return await readXlsx(table);
  } else {
    // program.help();
    console.log('Error: table should be one of: Google sheets URL, csv file path, xlsx file path!');
    process.exit(1);
  }
}

async function readCsv(csvPath) {
  // const csv = fs.readFileSync(csvPath, 'utf8');
  const json = await csv({delimiter: options.csvDelimiter}).fromFile(csvPath);
  return json;
}

function getTableColumns(tableData) {
  const columns = [];
  const row = tableData[0];
  Object.keys(row).forEach(key => {
    columns.push(key);
  });
  return columns;
}

async function readXlsx(xlsxPath) {
  const wb = xlsx.readFile(xlsxPath);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const json = xlsx.utils.sheet_to_json(sheet, {header: 1});
  const fields = json[0];
  const data = json.slice(1).map(row => {
    const item = {};
    fields.forEach((field, i) => {
      item[field] = row[i];
    });
    return item;
  });
  return data;
}

function getSheetId(sheetUrl) {
  const match = sheetUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (!match) {
    // program.help();
    console.log('Error: invalid Google sheets URL!');
    process.exit(1);
  }
  return match[1];
}

async function readGoogleSheets(googleSheetsUrl) {
  const require = createRequire(import.meta.url);
  const creds = require('./credentials.json');
  const sheetId = getSheetId(googleSheetsUrl);
  const doc = new GoogleSpreadsheet(sheetId);
  await doc.useServiceAccountAuth(creds);
  await doc.loadInfo();
  const sheet = doc.sheetsByIndex[0];
  const rows = await sheet.getRows();
  const data = rows.map(row => {
    const item = {};
    Object.keys(row).forEach(key => {
      if (key.startsWith('_')) return;
      item[key] = row[key];
    });
    return item;
  });
  return data;
}

async function join(table1Data, table2Data, column1, column2, mode) {
  let outputData = [];
  if (mode === 'intersect') {
    outputData = intersect(table1Data, table2Data, column1, column2);
  } else if (mode === 'join') {
    outputData = joinTables(table1Data, table2Data, column1, column2);
  } else if (mode === 'absent') {
    outputData = absent(table1Data, table2Data, column1, column2);
  }
  return outputData;
}

function intersect(table1Data, table2Data, column1, column2) {
  const outputData = [];
  table1Data.forEach(row1 => {
    const row2 = table2Data.find(row2 => row1[column1] === row2[column2]);
    if (row2) {
      outputData.push({...row1, ...row2});
    }
  });
  return outputData;
}

function joinTables(table1Data, table2Data, column1, column2) {
  const outputData = [];
  table1Data.forEach(row1 => {
    const row2 = table2Data.find(row2 => row1[column1] === row2[column2]);
    if (row2) {
      outputData.push({...row1, ...row2});
    } else {
      const columns = getTableColumns(table2Data);
      const row2 = {};
      columns.forEach(column => {
        row2[column] = '';
      });
      outputData.push({...row2, ...row1});
    }
  });
  return outputData;
}

function absent(table1Data, table2Data, column1, column2) {
  const outputData = [];
  table1Data.forEach(row1 => {
    const row2 = table2Data.find(row2 => row1[column1] === row2[column2]);
    if (!row2) {
      outputData.push(row1);
    }
  });
  return outputData;
}

start();

