#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");

// --- Args ---
if (process.argv.length < 4) {
  console.error("Usage: node importcsv.js database.db table.csv [tablename]");
  process.exit(1);
}
const dbFile = process.argv[2];
const csvFile = process.argv[3];
const tableName =
  process.argv[4] || path.basename(csvFile, path.extname(csvFile));

// --- Read CSV ---
const data = fs.readFileSync(csvFile, "utf8").trim().split(/\r?\n/);
if (data.length < 1) {
  console.error("CSV file must have a header row and at least one data row.");
  process.exit(1);
}
const headers = data[0].split(",").map((h) =>
  h.trim().replace(/[^a-zA-Z0-9_]/g, "_")
);
const rows = data.slice(1).map(line =>
  line.split(",").map(value => {
    const trimmed = value.trim();
    if (/^-?\d+$/.test(trimmed)) {
      return parseInt(trimmed, 10);
    }
    return trimmed;
  })
);
// --- Open DB ---
const db = new Database(dbFile);

// --- Create Table ---
const colDefs = headers.map((h) => `"${h}" TEXT`).join(", ");
db.prepare(`DROP TABLE IF EXISTS "${tableName}"`).run();
db.prepare(`CREATE TABLE "${tableName}" (${colDefs})`).run();

// --- Insert Rows ---
if (data.length > 1) {  // FIXED
  const placeholders = headers.map(() => "?").join(", ");
  const insert = db.prepare(
    `INSERT INTO "${tableName}" (${headers.map((h) => `"${h}"`).join(", ")})
    VALUES (${placeholders})`
  );

  const insertMany = db.transaction((rows) => {
    for (const row of rows) insert.run(row);
  });
  insertMany(rows);
}
console.log(
  `Imported ${rows.length} rows into table "${tableName}" in ${dbFile}`
);
