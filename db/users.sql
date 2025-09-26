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