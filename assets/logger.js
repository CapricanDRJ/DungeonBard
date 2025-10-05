const crypto = require('crypto');//for rs stats
const sqlite3 = require('better-sqlite3');
const db = new sqlite3('db/dungeonbard.db');
const key = require("config.json").key;

console.log(key);