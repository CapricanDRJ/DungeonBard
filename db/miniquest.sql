CREATE TABLE IF NOT EXISTS "miniquest" (
    "id" INTEGER PRIMARY KEY AUTOINCREMENT,
    "domainId" integer, 
    "questArea" TEXT, 
    "name" TEXT, 
    "description" TEXT, 
    "profession" TEXT, 
    "professionId" integer, 
    "professionXp" integer, 
    "perilChance" real, 
    "entity" TEXT, 
    "entityEffect" TEXT, 
    "difficulty" integer, 
    "relicChance" real, 
    "scholarship" integer, 
    "relicEffect" TEXT, 
    "coins" integer
);
INSERT INTO miniquest VALUES(NULL,0,'The Vault of Vellum','The Tome Unfurled','Read 1 paragraph of an academic text!','Artisan','1','10','0.2','The Wandering Mind Phantom','Halfway through, thou dost forget what thou read!','1','0.5','The Scholar’s Insight','Thou dost instantly make a profound connection to another field of study.','5');
INSERT INTO miniquest VALUES(NULL,0,'The Scribe’s Tower','The Annotation of Arcane Knowledge','Highlight or annotate 3 key points!','Artisan','1','15','0.35','The Ink Goblin','Thine highlighter is missing or has dried up!','1','0.5','The Quill of Perfect Recall','Future readings bring greater understanding, as if thou hadst read the text before.','5');
INSERT INTO miniquest VALUES(NULL,0,'The Scribe’s Tower','The Scroll of Summarization','Write a 1-sentence summary!','Artisan','1','20','0.3','The Jargon Djinn','Thou dost struggle to phrase it simply!','1','0.5','The Scholar’s Condensed Wisdom','Future summaries come with ease, for thy mind can now grasp the heart of any text.','10');
INSERT INTO miniquest VALUES(NULL,0,'The Vault of Vellum','The Scholar’s Sprint','Study with focus for 5 minutes!','Artisan','1','15','0.5','The Notification Gremlin','An alert, sound, or thought derails thee!','1','0.5','The Hourglass of Flow','The next deep focus session shall be effortless, for time itself bends to thy will.','5');
INSERT INTO miniquest VALUES(NULL,0,'The Scribe’s Tower','The First Word Ritual','Write literally any word to begin!','Artisan','1','10','0.35','The Perfectionist’s Shadow','Thou dost hesitate, doubting the worth of the first word!','1','0.5','The Inkflow Rune','The next sentence shall flow from thee as if a river, perfectly formed and without struggle.','5');
INSERT INTO miniquest VALUES(NULL,0,'The Scribe’s Tower','The Typing Tempest','Write for 3 uninterrupted minutes!','Artisan','1','20','0.4','The Sentence Loop Curse','Thou dost keep rewriting the same phrase!','1','0.5','The Momentum Charm','Thou shalt feel a sudden surge of inspiration, giving thee power and focus for thy next writing session.','10');
INSERT INTO miniquest VALUES(NULL,0,'The Scribe’s Tower','The Formatting Enchantment','Fix 1 citation, heading, or structure!','Artisan','1','15','0.3','The Footnote Gremlin','A missing citation throws thee into chaos!','1','0.5','The Scroll of Formatting Mastery','Future citation tasks shall be done with great speed and perfect order.','5');
INSERT INTO miniquest VALUES(NULL,0,'The Tribunal of Forms','The Form of Minimal Doom','Complete one small section of paperwork!','Soldier','2','15','0.4','The Document Demon','A required field makes no sense!','1','0.5','The Forgotten Stamp Fairy','The next form thou submits shall vanish from thy mind, for it is already approved and filed away.','5');
INSERT INTO miniquest VALUES(NULL,0,'The Tribunal of Forms','The Calendar Conundrum','Schedule one task, meeting, or deadline!','Soldier','2','15','0.35','The Scheduling Sphinx','The best time is already taken!','1','0.5','The Timetable Trickster’s Favor','All meetings this week shall align perfectly, leaving thee with a rare abundance of time for all other tasks.','5');
INSERT INTO miniquest VALUES(NULL,0,'The Lair of Self-Care','The Goblet of Hydration','Drink a full glass of water!','Healer','3','10','','','','','0.2','','','5');
INSERT INTO miniquest VALUES(NULL,0,'The Lair of Self-Care','The Feast of Small Victories','Eat at least one proper meal!','Healer','3','20','','','','','0.4','','','10');
INSERT INTO miniquest VALUES(NULL,0,'The Lair of Self-Care','The Potion Brewer’s Trial','Make a cup of coffee, tea, or favourite beverage!','Healer','3','15','','','','','0.3','','','5');
INSERT INTO miniquest VALUES(NULL,0,'The Lair of Self-Care','The Stance of the Mindful Stretch','Stretch for at least 2 minutes!','Healer','3','15','','','','','0.3','','','5');
INSERT INTO miniquest VALUES(NULL,0,'The Lair of Self-Care','The Sprint of the Squirrel Knight','Engage in 5 minutes of movement!','Healer','3','15','','','','','0.3','','','5');
INSERT INTO miniquest VALUES(NULL,0,'The Lair of Self-Care','The Window of the World Beyond','Look outside, name three things thou dost see','Healer','3','10','','','','','0.2','','','5');
INSERT INTO miniquest VALUES(NULL,0,'The Lair of Self-Care','The Summoning of Fresh Air','Step outside for 2 minutes!','Healer','3','15','','','','','0.3','','','5');
INSERT INTO miniquest VALUES(NULL,0,'The Lair of Self-Care','The Grand Pilgrimage Outdoors','Take a walk, however short!','Healer','3','30','','','','','0.6','','','10');
INSERT INTO miniquest VALUES(NULL,0,'The Lair of Self-Care','The Illumination of the Study Keep','Adjust thy lighting to fit thy focus!','Healer','3','10','','','','','0.2','','','5');
INSERT INTO miniquest VALUES(NULL,0,'The Lair of Self-Care','The Soundtrack of Champions','Play a focus-boosting or mood-lifting tune!','Healer','3','10','','','','','0.2','','','5');
INSERT INTO miniquest VALUES(NULL,0,'The Lair of Self-Care','The Shield of the Sleepy Squirrel','Lie down, even if sleep evades thee!','Healer','3','20','','','','','0.4','','','10');
INSERT INTO miniquest VALUES(NULL,0,'The Lair of Self-Care','The Dimming of the Screens','Reduce blue light exposure before sleep!','Healer','3','15','','','','','0.3','','','5');
INSERT INTO miniquest VALUES(NULL,0,'The Lair of Self-Care','The Cozy Cocoon Ritual','Adjust blankets, pillows, and comfort to maximize relaxation!','Healer','3','15','','','','','0.3','','','5');
INSERT INTO miniquest VALUES(NULL,0,'The Lair of Self-Care','The Book of Gentle Escape','Read or listen to something soothing before sleep!','Healer','3','15','','','','','0.3','','','5');
INSERT INTO miniquest VALUES(NULL,0,'The Lair of Self-Care','The Whispered Gratitudes','List three small victories of the day!','Healer','3','10','','','','','0.2','','','5');
INSERT INTO miniquest VALUES(NULL,0,'The Lair of Self-Care','The Rule of Three Objects','Put away or clean three small things!','Healer','3','15','','','','','0.3','','','5');
INSERT INTO miniquest VALUES(NULL,0,'The Lair of Self-Care','The Time Traveler’s Sprint','Set a 5-minute timer and tidy as much as thou can!','Healer','3','20','','','','','0.4','','','10');
INSERT INTO miniquest VALUES(NULL,0,'The Lair of Self-Care','The Organizational Arcane Sigil','Label or categorize one small area!','Healer','3','15','','','','','0.3','','','5');
INSERT INTO miniquest VALUES(NULL,0,'The Lair of Self-Care','The Minimalist’s Trial','Declutter one item, donate or discard!','Healer','3','15','','','','','0.3','','','5');
INSERT INTO miniquest VALUES(NULL,0,'The Lair of Self-Care','The Desk of Academic Might','Clear thy workspace before beginning studies!','Healer','3','20','','','','','0.4','','','10');
INSERT INTO miniquest VALUES(NULL,0,'The Chamber of Oration','The Verbal Summoning','Practice explaining a concept aloud, even if none listen!','Soldier','2','15','0.35','The Tangent Djinn','Thou dost veer wildly off-topic!','1','0.5','The Tongue of Golden Speech','Thy next explanation shall be so clear, it could charm a dragon from its hoard.','5');
INSERT INTO miniquest VALUES(NULL,0,'The Chamber of Oration','The Ritual of Class Preparation','Draft one discussion question or slide!','Soldier','2','20','0.3','The Formatting Fiend','A slide layout refuses to align properly!','1','0.5','The Scholar’s Guide of Engagement','The next class thou plans shall captivate all who listen.','10');
INSERT INTO miniquest VALUES(NULL,0,'The Chamber of Oration','The Grand Seminar of Engagement','Pose a discussion question in class or online!','Soldier','2','25','0.25','The Deafening Silence of Disinterest','No student answers immediately!','1','0.5','The Amulet of Enthusiastic Discourse','All in thy next discussion shall be filled with a passion for the topic.','10');
INSERT INTO miniquest VALUES(NULL,4,'The Scribe’s Tower','The Final Scroll Begins','Write 1 sentence of the conclusion chapter!','Soldier','2','10','0.35','The Looping Sentence Curse','Thou dost rewrite the same idea five times!','1','0.5','The Inkflow Rune','The next paragraph shall flow from thee as if a river, perfectly formed and without struggle.','5');
INSERT INTO miniquest VALUES(NULL,4,'The Scribe’s Tower','The Ultimate Citation Challenge','Check & format one reference!','Soldier','2','15','0.4','The Footnote Gremlin','A source is missing and must be found!','1','0.5','The Tome of Infinite Footnotes','Future citations shall be found without a trace of struggle.','5');
INSERT INTO miniquest VALUES(NULL,4,'The Scribe’s Tower','The Final Data Reckoning','Analyze one result or edit a table!','Soldier','2','20','0.3','The Data Goblin','Numbers seem incorrect, requiring double-checking!','1','0.5','The Scholar’s Epiphany','A major insight strikes thee, illuminating thy path forward.','10');
INSERT INTO miniquest VALUES(NULL,4,'The Scribe’s Tower','The Last Crusade Against Formatting','Fix one style, heading, or spacing issue!','Soldier','2','15','0.25','The Vanishing Text Demon','A section disappears mysteriously!','1','0.5','The Scroll of Perfect Formatting','Thy next document shall be edited with perfect order and speed.','5');
INSERT INTO miniquest VALUES(NULL,4,'The Chamber of Oration','The PowerPoint Pilgrimage','Make or edit one slide!','Soldier','2','15','0.4','The Slide of Doom','A crucial figure refuses to align correctly!','1','0.5','The Amulet of Presentation Clarity','Thy next slide shall convey its message with a singular, perfect purpose.','5');
INSERT INTO miniquest VALUES(NULL,4,'The Chamber of Oration','The Summoning of the Oral Script','Write & practice one minute of thy speech!','Soldier','2','20','0.35','The Jargon Djinn','Thou dost struggle to phrase things simply!','1','0.5','The Golden Tongue Talisman','Thy next spoken answer shall be flawless, a golden truth for all to hear.','10');
INSERT INTO miniquest VALUES(NULL,4,'The Chamber of Oration','The Trial of the Mock Defense','Practice one question with a friend or mirror!','Soldier','2','25','0.3','The Unanswerable Question','A practice query leaves thee speechless!','1','0.5','The Scholar’s Oratorical Gift','Thy next Q&A shall be a display of quick wit and profound knowledge.','10');
INSERT INTO miniquest VALUES(NULL,4,'The Chamber of Oration','The Sacred Robing Ritual','Choose attire for the defense & feel powerful!','Soldier','2','10','0.25','The Wardrobe Malfunction Gremlin','A button or zipper fails!','1','0.5','The Cloak of Supreme Confidence','Thy next speaking task shall fill thee with a boldness that cannot be denied.','5');
INSERT INTO miniquest VALUES(NULL,4,'The Scribe’s Tower','The Title of a Thousand Revisions','Revise or finalize the title!','Soldier','2','15','0.4','The Endless Wordsmithing Curse','Thou dost change it thrice and remain unsatisfied!','1','0.5','The Scholar’s Epiphany','A perfect title idea shall emerge, as if delivered to thee by a muse.','5');
INSERT INTO miniquest VALUES(NULL,4,'The Scribe’s Tower','The Abstract Abyss','Edit one sentence of the abstract!','Soldier','2','20','0.35','The Condensation Struggle','The abstract refuses to fit the word limit!','1','0.5','The Scroll of Perfect Clarity','The next abstract thou writes shall be as clear as a mountain spring.','10');
INSERT INTO miniquest VALUES(NULL,4,'The Scribe’s Tower','The Journal Alignment Conundrum','Check submission guidelines & adjust formatting!','Soldier','2','15','0.35','The Reference Style Wraith','The journal requires a citation format overhaul!','1','0.5','The Journal’s Favor','Thy next submission shall be looked upon with great favor.','5');
INSERT INTO miniquest VALUES(NULL,4,'The Hall of Marvels','The Final Button of Fate','Press submit and send the manuscript into the void!','Soldier','2','25','0.25','The Server Error Demon','The submission system crashes just after pressing submit!','1','0.5','The Editor’s Blessing','Peer review feedback shall be surprisingly merciful.','10');
INSERT INTO miniquest VALUES(NULL,3,'The Hall of Marvels','The Single Scroll of Judgment','Grade a single response, essay, or quiz question!','Soldier','2','10','0.4','The Illegible Ink Gremlin','Thou canst not decipher the student’s handwriting!','1','0.5','The Grading Lens of Clarity','Thy next grading task shall be completed swiftly, with perfect fairness.','5');
INSERT INTO miniquest VALUES(NULL,3,'The Hall of Marvels','The Constructive Rune','Write one meaningful comment on a student’s work!','Soldier','2','15','0.35','The Over-Explanation Curse','Thy feedback grows longer than the student’s work!','1','0.5','The Pen of Concise Wisdom','The feedback thou gives next shall be so clear and brief, it will be instantly understood.','5');
INSERT INTO miniquest VALUES(NULL,3,'The Hall of Marvels','The Swift Assessment Sprint','Grade for 5 uninterrupted minutes!','Soldier','2','20','0.3','The Score Sheet Specter','A grading rubric is missing or inconsistent!','1','0.5','The Scroll of Perfect Rubrics','Thy next grading session shall pass in the blink of an eye.','10');
INSERT INTO miniquest VALUES(NULL,3,'The Hall of Marvels','The Summoning of the Inbox','Open and skim unread emails without responding!','Soldier','2','10','0.4','The Endless Thread Curse','A single email spawns five follow-ups!','1','0.5','The Amulet of Inbox Mastery','Thy future emails shall be answered with half the effort, for thy thoughts are organized and swift.','5');
INSERT INTO miniquest VALUES(NULL,3,'The Hall of Marvels','The Single Scroll of Response','Reply to one student email!','Soldier','2','15','0.35','The Cryptic Inquiry Gremlin','The student’s question makes no sense!','1','0.5','The Letter of Perfect Clarity','Thy next email reply shall be a model of perfect communication.','5');
INSERT INTO miniquest VALUES(NULL,3,'The Hall of Marvels','The Office Hour Invocation','Spend 10 minutes responding to student questions!','Soldier','2','20','0.3','The Student No-Show Curse','None attend thy office hours, and time is lost!','1','0.5','The Guide of Engaged Learners','Thy next discussion will be filled with an uncommon energy and passion from all.','10');
INSERT INTO miniquest VALUES(NULL,6,'The Hall of Marvels','The Roster of the Forgotten','Check or update attendance records!','Soldier','2','10','0.4','The Disappearing Student','A student on the roster has never been seen!','1','0.5','The Ledger of Perfect Recall','Thy future attendance tasks will be finished in half the time, for every name and face is now clear to thee.','5');
INSERT INTO miniquest VALUES(NULL,6,'The Hall of Marvels','The Form of Institutional Doom','Submit one administrative form!','Soldier','2','15','0.35','The Paperwork Phantom','The form format is incorrect, requiring resubmission!','1','0.5','The Scroll of Instant Approval','All forms thou submits from this point forward shall be accepted with ease.','5');
INSERT INTO miniquest VALUES(NULL,6,'The Hall of Marvels','The Calendar of Despair','Schedule a class, meeting, or deadline!','Soldier','2','15','0.3','The Scheduling Sphinx','The ideal time slot is already taken!','1','0.5','The Clock of Perfect Timing','Thy future scheduling tasks shall be completed in half the time, with no conflict in sight.','5');
CREATE TABLE IF NOT EXISTS healerMiniquest (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT
);
INSERT INTO healerMiniquest (name, description) VALUES
('The Ever-Full Flask 🥤', 'Thy cup shall never run dry! Thou dost remember to hydrate more frequently!'),
('The Cozy Cloak of Softness 🧣', 'Thy sensory needs are met! Thou dost gain comfort & warmth bonuses for deep relaxation.'),
('The Windborne Muse 💨', 'Inspiration strikes!'),
('The Weighted Blanket of Tranquility 🛏', 'Thine anxieties are eased! Thou shalt fall asleep more swiftly and rest more deeply.'),
('The Arcane Spice Rack 🌿', 'Thy meals taste superior!'),
('The Enchanted Candle of Focus 🕯', 'Boosts concentration & ambiance!'),
('The Lavender Satchel of Peace 🌸', 'Repels stress! Thou dost gain a resistance against distractions & sensory overload!'),
('The Satchel of Perpetual Order 🎒', 'Reduces clutter! Next organizational task takes half the effort.'),
('The Starlit Headphones 🎧', 'Protects thee from auditory distractions! Focus tasks are less likely to be interrupted!'),
('The Cozy Cocoon Socks 🧦', 'Feet are warm, mind is at peace! Sitting still during study sessions becomes twice as easy.');