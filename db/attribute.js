const Database = require("better-sqlite3");
const db = new Database("dungeonbard.db");

// Make sure the table exists
db.prepare(`
CREATE TABLE IF NOT EXISTS attributeLevels (
    skillId INTEGER,
    level   INTEGER,
    exp     INTEGER,
)
`).run();

// Define your data
const skills = {
1:[0,20,90,220,400,650,950,1320,1750,2240,2790,3420,4110,4860,5690,6580,7540,8570,9660,10830],
2:[0,40,190,440,810,1290,1900,2640,3490,4480,5590,6840,8220,9730,11370,13160,15080,17130,19330,21660],
3:[0,50,235,550,1010,1615,2375,3295,4365,5600,6990,8550,10270,12160,14215,16450,18850,21415,24165,27080],
4:[0,60,280,660,1210,1940,2850,3950,5240,6720,8390,10260,12320,14590,17060,19740,22620,25700,29000,32500],
5:[0,90,380,880,1620,2590,3810,5270,6990,8960,11190,13680,16440,19460,22750,26320,30160,34270,38670,43440],
6:[0,110,470,1100,2020,3240,4760,6590,8730,11200,13980,17100,20540,24320,28440,32900,37690,42840,48330,54170]
};

// Prepare insert statement
const insert = db.prepare("INSERT INTO attributeLevels (skillId, level, exp) VALUES (?, ?, ?)");

// Insert all data
const insertMany = db.transaction(() => {
  for (const [skillId, levels] of Object.entries(skills)) {
    levels.forEach((exp, idx) => {
      const level = idx + 1; // level = position + 1
      insert.run(skillId, level, exp);
    });
  }
});

insertMany();

console.log("Data inserted!");
