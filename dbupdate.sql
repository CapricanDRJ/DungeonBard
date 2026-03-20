BEGIN TRANSACTION;

-- 1. Move the old data out of the way
ALTER TABLE quest RENAME TO quest_old2;

-- 2. Create the fresh table structure
CREATE TABLE IF NOT EXISTS "quest" (
    "id" INTEGER PRIMARY KEY AUTOINCREMENT,
    "domainId" integer NOT NULL DEFAULT 1, 
    "questArea" TEXT NOT NULL, 
    "areaDesc" TEXT NOT NULL, 
    "name" TEXT NOT NULL, 
    "description" TEXT NOT NULL, 
    "profession" TEXT NOT NULL, 
    "professionId" integer NOT NULL,
    "professionXp" integer NOT NULL DEFAULT 0, 
    "skill1" INTEGER NOT NULL DEFAULT 0,
    "skill2" INTEGER NOT NULL DEFAULT 0,
    "skill3" INTEGER NOT NULL DEFAULT 0,
    "skill4" INTEGER NOT NULL DEFAULT 0,
    "skill5" INTEGER NOT NULL DEFAULT 0,
    "skill6" INTEGER NOT NULL DEFAULT 0,
    "beastiary" TEXT DEFAULT NULL, 
    "relic" TEXT DEFAULT NULL,
    "coins" integer NOT NULL DEFAULT 0, 
    "maxCount" integer NOT NULL DEFAULT 1
);

-- 3. Recreate the indexes for the new table
CREATE INDEX idx_quest_area_domain ON quest(questArea, domainId);
CREATE INDEX idx_quest_domain ON quest(domainId);

-- 4. Reset the autoincrement counter for the new table name
DELETE FROM sqlite_sequence WHERE name='quest';

-- 5. PASTE YOUR HUNDREDS OF LINES HERE
-- Example format: 
-- INSERT INTO quest (domainId, questArea, ...) VALUES (1, 'Forest', ...);
-- INSERT INTO quest (domainId, questArea, ...) VALUES (1, 'Cave', ...);
-- ... (all 100+ lines)

-- 6. Finalize everything
COMMIT;