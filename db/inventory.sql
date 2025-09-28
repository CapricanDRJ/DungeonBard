CREATE TABLE items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    skillBonus INTEGER,
    itemBonus INTEGER,
    skill INTEGER,
    professionId INTEGER,
    cost INTEGER NOT NULL,
    duration INTEGER NOT NULL,
    emojiId TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS "users" (
  "userId" TEXT NOT NULL,
  "guildId" TEXT NOT NULL,
  "displayName" TEXT NOT NULL,
  "partyName" TEXT DEFAULT NULL,
  "avatarFile" TEXT DEFAULT NULL,
  "avatar" BLOB DEFAULT NULL,

  "domainId" INTEGER NOT NULL DEFAULT 0,

  "artisanExp" REAL NOT NULL DEFAULT 0.0,
  "soldierExp" REAL NOT NULL DEFAULT 0.0,
  "healerExp" REAL NOT NULL DEFAULT 0.0,

  "overallExp" REAL GENERATED ALWAYS AS (
    artisanExp + soldierExp + healerExp
  ) STORED,

  "skill1" REAL NOT NULL DEFAULT 0.0,
  "skill2" REAL NOT NULL DEFAULT 0.0,
  "skill3" REAL NOT NULL DEFAULT 0.0,
  "skill4" REAL NOT NULL DEFAULT 0.0,
  "skill5" REAL NOT NULL DEFAULT 0.0,
  "skill6" REAL NOT NULL DEFAULT 0.0,

  "coins" INTEGER NOT NULL DEFAULT 0,

  "armourId" INTEGER NOT NULL DEFAULT 0,
  "weaponId" INTEGER NOT NULL DEFAULT 0,

  "artisanBonus" REAL NOT NULL DEFAULT 0,
  "artisanBonusEnd" INTEGER NOT NULL DEFAULT 0,
  "soldierBonus" REAL NOT NULL DEFAULT 0,
  "soldierBonusEnd" INTEGER NOT NULL DEFAULT 0,
  "healerBonus" REAL NOT NULL DEFAULT 0,
  "healerBonusEnd" INTEGER NOT NULL DEFAULT 0,
  "weaponBonus" REAL NOT NULL DEFAULT 0,
  "weaponBonusEnd" INTEGER NOT NULL DEFAULT 0,
  "armourBonus" REAL NOT NULL DEFAULT 0,
  "armourBonusEnd" INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE inventory (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId TEXT NOT NULL,
    guildId TEXT NOT NULL,
    name TEXT NOT NULL,
    skillBonus INTEGER,
    professionBonus INTEGER,
    skill INTEGER,
    professionId INTEGER,
    duration INTEGER NOT NULL,
    emojiId TEXT NOT NULL,
    shopId INTEGER DEFAULT NULL
);

            if(item.skillBonus) {
                db.prepare('UPDATE users SET coins = coins - ?, healerBonus = ?, healerBonusEnd = ? WHERE userId = ? AND guildId = ?').run(item.cost, item.skillBonus, unixTime + item.duration, interaction.user.id, interaction.guildId);
            }
            if(item.itemBonus) {
                const itemColumn = [null, null, "weaponBonus", "armourBonus", null, null][item.skill - 1];
                const updateQuery = `UPDATE users SET coins = coins - ?, ${itemColumn} = ?, ${itemColumn}End = ? WHERE userId = ? AND guildId = ?`;
                db.prepare(updateQuery).run(item.cost, item.itemBonus, unixTime + item.duration, interaction.user.id, interaction.guildId);
            }