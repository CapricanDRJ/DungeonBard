INSERT INTO domains VALUES(replace('CREATE TABLE domains (\n    id INTEGER PRIMARY KEY,\n    title TEXT NOT NULL,\n    description TEXT NOT NULL,\n    background INTEGER NOT NULL,\n    font INTEGER NOT NULL\n)','\n',char(10)));
INSERT INTO domains VALUES(1,'The Initiate Scholar','High School & Early College Scholars!',16766720,0);
INSERT INTO domains VALUES(2,'The Collegiate Scholar','Undergraduate Level, Bachelor''s Degree!',14423100,0);
INSERT INTO domains VALUES(3,'The Pedagogue: Teacher-In-Training','Bachelor of Education',12081940,0);
INSERT INTO domains VALUES(4,'The Master''s Scholar','Graduate-Level, Thesis Track!',1852681,0);
INSERT INTO domains VALUES(5,'The Doctoral Scholar','Ph.D. Track, Dissertation Path!',21403,0);
INSERT INTO domains VALUES(6,'The Sage: Tenured Scholar','Professor, Academic Career!',4915310,0);
