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

// --- Simple CSV line parser (handles quoted fields) ---
function parseCSVLine(line) {
  const fields = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"' && !inQuotes) {
      inQuotes = true;
      continue;
    }
    if (ch === '"' && inQuotes) {
      // look ahead for escaped quote
      if (i + 1 < line.length && line[i + 1] === '"') {
        cur += '"';
        i++; // skip escaped quote
      } else {
        inQuotes = false;
      }
      continue;
    }
    if (ch === "," && !inQuotes) {
      fields.push(cur);
      cur = "";
      continue;
    }
    cur += ch;
  }
  fields.push(cur);
  return fields;
}

// --- Read CSV ---
const raw = fs.readFileSync(csvFile, "utf8").replace(/\r\n/g, "\n");
const lines = raw.split("\n").filter((l) => l.length > 0);
if (lines.length < 1) {
  console.error("CSV file must have a header row and at least one data row.");
  process.exit(1);
}

const headersRaw = parseCSVLine(lines[0]);
const headers = headersRaw.map((h) =>
  h.trim().replace(/[^a-zA-Z0-9_]/g, "_") || "col"
);

// --- Parse rows and normalize length to headers.length ---
// Convert first column to integer if it looks like an integer
const rows = lines.slice(1).map((ln) => {
  const parsed = parseCSVLine(ln).map((v) => v.trim());
  // pad or truncate to match header count
  if (parsed.length < headers.length) {
    while (parsed.length < headers.length) parsed.push(null);
  } else if (parsed.length > headers.length) {
    parsed.length = headers.length;
  }
  // convert first column to integer if integer-like
  if (parsed.length > 0 && /^-?\d+$/.test(parsed[0])) {
    parsed[0] = parseInt(parsed[0], 10);
  }
  return parsed;
});

// --- Open DB ---
const db = new Database(dbFile);

// --- Create Table ---
// We'll create all columns as TEXT; integers inserted as JS numbers stay numeric in SQLite.
const colDefs = headers.map((h) => `"${h}" TEXT`).join(", ");
db.prepare(`DROP TABLE IF EXISTS "${tableName}"`).run();
db.prepare(`CREATE TABLE "${tableName}" (${colDefs})`).run();

// --- Insert Rows ---
if (rows.length > 0) {
  const placeholders = headers.map(() => "?").join(", ");
  const insertStmt = db.prepare(
    `INSERT INTO "${tableName}" (${headers.map((h) => `"${h}"`).join(", ")})
     VALUES (${placeholders})`
  );

  const insertMany = db.transaction((rowsToInsert) => {
    for (const row of rowsToInsert) insertStmt.run(row);
  });

  insertMany(rows);
}

console.log(
  `Imported ${rows.length} rows into table "${tableName}" in ${dbFile}`
);
