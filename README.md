Sheets joiner - nodejs cli tool for joining two tables by column
Used npm packages: commander, csv2json, xlsx, google-spreadsheet

Sheets joiner features:
- join two tables by column
- input from Google sheets, csv file or xlsx file
- output rows that are present in both tables
- output rows that are present in first table but absent in second table
- output to console, csv file or xlsx file

## Install:
```
npm install -g sheets-joiner
```

## Input:
- `--table1` or `--sheet1` - first table
- `--table2` or `--sheet2` - second table

Input examples:
- Google sheets URL
- CSV file path
- XLSX file path

## Input options
- `--csv-delimiter` - delimiter for csv file, default: `,`

## Modes:
- `--mode`, one of: intersect, join, absent, default: intersect
- intersect: output rows that are present in both tables
- join: join second table to first table by column
- absent: output rows that are present in first table but absent in second table

## Join options:
- `--column1`: column name in first table, default: `url`
- `--column2`: column name in second table, default: `url`

## Output:
- `--output`, one of: console, path to csv file, path to xlsx file, default: console
- output file format is determined by file extension