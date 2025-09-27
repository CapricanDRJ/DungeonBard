PRAGMA foreign_keys=OFF;
BEGIN TRANSACTION;
CREATE TABLE IF NOT EXISTS "relic" (
    "id" TEXT NOT NULL, 
    "chance" REAL NOT NULL DEFAULT 0.5, 
    "name" TEXT NOT NULL, 
    "description" TEXT NOT NULL,
    "bonusXp" INTEGER NOT NULL DEFAULT 0,
    "profession" TEXT DEFAULT NULL, 
    "duration" INTEGER NOT NULL DEFAULT 0, 
    "iconURL" TEXT DEFAULT NULL,
    PRIMARY KEY("id","name")
);
INSERT INTO relic VALUES('Initiate1',0.5,'The Notebook of Infinite Recall','Boosts memory for exams!',100,'Soldier',1,NULL);
INSERT INTO relic VALUES('Initiate2',0.5,'The Pen of Confidence','Feel confident to speak up in class!',2,'Soldier',604800,NULL);
INSERT INTO relic VALUES('Initiate3',0.5,'The Annotated Tome of Study','Homework becomes a breeze!',2,'Artisan',604800,NULL);
INSERT INTO relic VALUES('Initiate4',0.75,'The Medal of Scholarly Growth','Recognizes the scholar’s progress!',100,'Artisan',1,NULL);
INSERT INTO relic VALUES('Collegiate1',0.5,'The Notebook of Infinite Recall','Improves memory for exams!',100,'Soldier',1,NULL);
INSERT INTO relic VALUES('Collegiate2',0.5,'The Annotated Tome of Clarity','Writing becomes a breeze!',2,'Soldier',604800,NULL);
INSERT INTO relic VALUES('Collegiate3',0.5,'The Coffee Chalice of Wakefulness','Late-night study sessions give genius ideas!',2,'Artisan',604800,NULL);
INSERT INTO relic VALUES('Collegiate4',0.75,'The Degree Scroll of Triumph','Ensures lasting academic renown!',100,'Artisan',1,NULL);
INSERT INTO relic VALUES('Pedagogue1',0.5,'The Teacher''s Tome of Tactics','Improves retention of pedagogical strategies for in-class application.',100,'Soldier',1,NULL);
INSERT INTO relic VALUES('Pedagogue2',0.5,'The Communicator''s Compendium','Elevates the precision and conciseness of professional correspondence and feedback.',2,'Soldier',604800,NULL);
INSERT INTO relic VALUES('Pedagogue3',0.5,'The Chalice of Classroom Command','Bestows a commanding presence and the energy to manage a full day of lessons.',2,'Artisan',604800,NULL);
INSERT INTO relic VALUES('Pedagogue4',0.75,'The Guiding Scroll of Wisdom','Confers an enduring reputation for excellence in instructional practice and leadership.',100,'Artisan',1,NULL);
INSERT INTO relic VALUES('Masters1',0.5,'The Tome of Infinite Footnotes','Citation tasks are a breeze!',100,'Soldier',1,NULL);
INSERT INTO relic VALUES('Masters2',0.5,'The Philosopher’s Flask','The next late-night writing session is flawless!',2,'Soldier',604800,NULL);
INSERT INTO relic VALUES('Masters3',0.5,'The Quill of Perfect Clarity','Future thesis revisions are twice as efficient!',2,'Artisan',604800,NULL);
INSERT INTO relic VALUES('Masters4',0.75,'The Hood of the Master Scholar','Grants permanent academic prestige!',100,'Artisan',1,NULL);
INSERT INTO relic VALUES('Doctoral1',0.5,'The Annotated Tome of Wisdom','Literature reviews are insightful!',100,'Soldier',1,NULL);
INSERT INTO relic VALUES('Doctoral2',0.5,'The Philosopher’s Quill','Writing becomes a breeze!',2,'Soldier',604800,NULL);
INSERT INTO relic VALUES('Doctoral3',0.5,'The Academic Amulet','Defense presentation is a breeze!',2,'Artisan',604800,NULL);
INSERT INTO relic VALUES('Doctoral4',0.75,'The Doctoral Robes of Power','Grants permanent academic prestige!',100,'Artisan',1,NULL);
INSERT INTO relic VALUES('Sage1',0.5,'The Philosopher’s Patronage','All future grants amaze the reviewers!',100,'Soldier',1,NULL);
INSERT INTO relic VALUES('Sage2',0.5,'The Ivory Quill of the Ages','Publishing is a breeze!',2,'Soldier',604800,NULL);
INSERT INTO relic VALUES('Sage3',0.5,'The Chair’s Scepter','Committee meetings now take 50% less energy!',2,'Artisan',604800,NULL);
INSERT INTO relic VALUES('Sage4',0.75,'The Sigil of Eternal Knowledge','Ensures lasting academic legacy!',100,'Artisan',1,NULL);
INSERT INTO relic VALUES('healerRnd',0.3,'The Ever-Full Flask ðŸ¥¤','Thy cup shall never run dry! Thou dost remember to hydrate more frequently!',10,'healer',1,NULL);
INSERT INTO relic VALUES('healerRnd',0.3,'The Cozy Cloak of Softness ðŸ§£','Thy sensory needs are met! Thou dost gain comfort & warmth bonuses for deep relaxation.',50,'healer',1,NULL);
INSERT INTO relic VALUES('healerRnd',0.3,'The Windborne Muse ðŸ’¨','Inspiration strikes!',100,'healer',1,NULL);
INSERT INTO relic VALUES('healerRnd',0.3,'The Weighted Blanket of Tranquility ðŸ›','Thine anxieties are eased! Thou shalt fall asleep more swiftly and rest more deeply.',100,'healer',1,NULL);
INSERT INTO relic VALUES('healerRnd',0.3,'The Arcane Spice Rack ðŸŒ¿','Thy meals taste superior!',50,'healer',1,NULL);
INSERT INTO relic VALUES('healerRnd',0.3,'The Enchanted Candle of Focus ðŸ•¯','Boosts concentration & ambiance!',50,'healer',1,NULL);
INSERT INTO relic VALUES('healerRnd',0.3,'The Lavender Satchel of Peace ðŸŒ¸','Repels stress! Thou dost gain a resistance against distractions & sensory overload!',100,'healer',1,NULL);
INSERT INTO relic VALUES('healerRnd',0.3,'The Satchel of Perpetual Order ðŸŽ’','Reduces clutter! Next organizational task takes half the effort.',100,'healer',1,NULL);
INSERT INTO relic VALUES('healerRnd',0.3,'The Starlit Headphones ðŸŽ§','Protects thee from auditory distractions! Focus tasks are less likely to be interrupted!',20,'healer',1,NULL);
INSERT INTO relic VALUES('healerRnd',0.3,'The Cozy Cocoon Socks ðŸ§¦','Feet are warm, mind is at peace! Sitting still during study sessions becomes twice as easy.',20,'healer',1,NULL);
INSERT INTO relic VALUES('miniquest1',0.5,'Scholarâ€™s Insight','Thou dost instantly make a profound connection to another field of study.','','','',NULL);
INSERT INTO relic VALUES('miniquest2',0.5,'Quill of Perfect Recall','Future readings bring greater understanding, as if thou hadst read the text before.','','','',NULL);
INSERT INTO relic VALUES('miniquest3',0.5,'Scholarâ€™s Condensed Wisdom','Future summaries come with ease, for thy mind can now grasp the heart of any text.','','','',NULL);
INSERT INTO relic VALUES('miniquest4',0.5,'Hourglass of Flow','The next deep focus session shall be effortless, for time itself bends to thy will.','','','',NULL);
INSERT INTO relic VALUES('miniquest5',0.5,'Inkflow Rune','The next sentence shall flow from thee as if a river, perfectly formed and without struggle.','','','',NULL);
INSERT INTO relic VALUES('miniquest6',0.5,'Momentum Charm','Thou shalt feel a sudden surge of inspiration, giving thee power and focus for thy next writing session.','','','',NULL);
INSERT INTO relic VALUES('miniquest7',0.5,'Scroll of Formatting Mastery','Future citation tasks shall be done with great speed and perfect order.','','','',NULL);
INSERT INTO relic VALUES('miniquest8',0.5,'Forgotten Stamp Fairy','The next form thou submits shall vanish from thy mind, for it is already approved and filed away.','','','',NULL);
INSERT INTO relic VALUES('miniquest9',0.5,'Timetable Tricksterâ€™s Favor','All meetings this week shall align perfectly, leaving thee with a rare abundance of time for all other tasks.','','','',NULL);
INSERT INTO relic VALUES('miniquest10',0.5,'Tongue of Golden Speech','Thy next explanation shall be so clear, it could charm a dragon from its hoard.','','','',NULL);
INSERT INTO relic VALUES('miniquest11',0.5,'Scholarâ€™s Guide of Engagement','The next class thou plans shall captivate all who listen.','','','',NULL);
INSERT INTO relic VALUES('miniquest12',0.5,'Amulet of Enthusiastic Discourse','All in thy next discussion shall be filled with a passion for the topic.','','','',NULL);
INSERT INTO relic VALUES('miniquest13',0.5,'Inkflow Rune','The next paragraph shall flow from thee as if a river, perfectly formed and without struggle.','','','',NULL);
INSERT INTO relic VALUES('miniquest14',0.5,'Tome of Infinite Footnotes','Future citations shall be found without a trace of struggle.','','','',NULL);
INSERT INTO relic VALUES('miniquest15',0.5,'Scholarâ€™s Epiphany','A major insight strikes thee, illuminating thy path forward.','','','',NULL);
INSERT INTO relic VALUES('miniquest16',0.5,'Scroll of Perfect Formatting','Thy next document shall be edited with perfect order and speed.','','','',NULL);
INSERT INTO relic VALUES('miniquest17',0.5,'Amulet of Presentation Clarity','Thy next slide shall convey its message with a singular, perfect purpose.','','','',NULL);
INSERT INTO relic VALUES('miniquest18',0.5,'Golden Tongue Talisman','Thy next spoken answer shall be flawless, a golden truth for all to hear.','','','',NULL);
INSERT INTO relic VALUES('miniquest19',0.5,'Scholarâ€™s Oratorical Gift','Thy next Q&A shall be a display of quick wit and profound knowledge.','','','',NULL);
INSERT INTO relic VALUES('miniquest20',0.5,'Cloak of Supreme Confidence','Thy next speaking task shall fill thee with a boldness that cannot be denied.','','','',NULL);
INSERT INTO relic VALUES('miniquest21',0.5,'Scholarâ€™s Epiphany','A perfect title idea shall emerge, as if delivered to thee by a muse.','','','',NULL);
INSERT INTO relic VALUES('miniquest22',0.5,'Scroll of Perfect Clarity','The next abstract thou writes shall be as clear as a mountain spring.','','','',NULL);
INSERT INTO relic VALUES('miniquest23',0.5,'Journalâ€™s Favor','Thy next submission shall be looked upon with great favor.','','','',NULL);
INSERT INTO relic VALUES('miniquest24',0.5,'Editorâ€™s Blessing','Peer review feedback shall be surprisingly merciful.','','','',NULL);
INSERT INTO relic VALUES('miniquest25',0.5,'Grading Lens of Clarity','Thy next grading task shall be completed swiftly, with perfect fairness.','','','',NULL);
INSERT INTO relic VALUES('miniquest26',0.5,'Pen of Concise Wisdom','The feedback thou gives next shall be so clear and brief, it will be instantly understood.','','','',NULL);
INSERT INTO relic VALUES('miniquest27',0.5,'Scroll of Perfect Rubrics','Thy next grading session shall pass in the blink of an eye.','','','',NULL);
INSERT INTO relic VALUES('miniquest28',0.5,'Amulet of Inbox Mastery','Thy future emails shall be answered with half the effort, for thy thoughts are organized and swift.','','','',NULL);
INSERT INTO relic VALUES('miniquest29',0.5,'Letter of Perfect Clarity','Thy next email reply shall be a model of perfect communication.','','','',NULL);
INSERT INTO relic VALUES('miniquest30',0.5,'Guide of Engaged Learners','Thy next discussion will be filled with an uncommon energy and passion from all.','','','',NULL);
INSERT INTO relic VALUES('miniquest31',0.5,'Ledger of Perfect Recall','Thy future attendance tasks will be finished in half the time, for every name and face is now clear to thee.','','','',NULL);
INSERT INTO relic VALUES('miniquest32',0.5,'Scroll of Instant Approval','All forms thou submits from this point forward shall be accepted with ease.','','','',NULL);
INSERT INTO relic VALUES('miniquest33',0.5,'Clock of Perfect Timing','Thy future scheduling tasks shall be completed in half the time, with no conflict in sight.','','','',NULL);
COMMIT;
