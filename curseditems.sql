CREATE TABLE cursedItems (
    name TEXT PRIMARY KEY,
    emojiId TEXT NOT NULL,
    bonusText TEXT NOT NULL
);
INSERT INTO cursedItems (name, emojiId, bonusText) VALUES
    ('Smelly Socks', '1422312824285302784', '+10 Ward off All Guests'),
    ('Broken Sundial', '1422335681333825627', '+0.0001 Time Travel'),
    ('Cracked Mirror', '1422337220735668234', '+7 years Bad Luck')
    ;

