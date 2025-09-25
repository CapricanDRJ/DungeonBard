CREATE TABLE IF NOT EXISTS domains (
    id INTEGER PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    background INTEGER NOT NULL,
    font INTEGER NOT NULL
);

INSERT OR REPLACE INTO domains (id, title, description, background, font) VALUES
(1, 'The Initiate Scholar', 'High School & Early College Scholars!', 0xFFD700, 0x000000),
(2, 'The Collegiate Scholar', 'Undergraduate Level, Bachelor''s Degree!', 0xDC143C, 0x000000),
(3, 'The Pedagogue: Teacher-In-Training', 'Bachelor of Education', 0xB85B14, 0x000000),
(4, 'The Master''s Scholar', 'Graduate-Level, Thesis Track!', 0x1C4509, 0xFFFFFF),
(5, 'The Doctoral Scholar', 'Ph.D. Track, Dissertation Path!', 0x00539B, 0xFFFFFF),
(6, 'The Sage: Tenured Scholar', 'Professor, Academic Career!', 0x4B006E, 0xFFFFFF);