CREATE TABLE IF NOT EXISTS "attributes" (
    "skillId" INTEGER, 
    "domainId" INTEGER, 
    "domain" TEXT, 
    "skillName" TEXT, 
    "skillAbbrv" TEXT, 
    "skillDesc" TEXT,
    PRIMARY KEY (skillId, domainId)
    );
INSERT INTO attributes VALUES(1,1,'Initiate','LEARNING','LRN','Absorbing and recalling knowledge from lessons readings and practice.');
INSERT INTO attributes VALUES(2,1,'Initiate','COMMUNICATION','COM','Speaking clearly, participating in discussions, and asking thoughtful questions.');
INSERT INTO attributes VALUES(3,1,'Initiate','DISCIPLINE','DIS','Developing time management, note-taking, and study habits.');
INSERT INTO attributes VALUES(4,1,'Initiate','ORGANIZATION','ORG','Managing assignments, schedules, and school-related responsibilities.');
INSERT INTO attributes VALUES(5,1,'Initiate','STAMINA','STA','Maintaining focus, handling stress, and persisting through long study sessions.');
INSERT INTO attributes VALUES(6,1,'Initiate','PERSEVERANCE','PRS','Overcoming academic setbacks, late assignments, and exam stress.');
INSERT INTO attributes VALUES(1,2,'Collegiate','LEARNING','LRN','Ability to absorb and retain knowledge from lectures and readings.');
INSERT INTO attributes VALUES(2,2,'Collegiate','COMMUNICATION','COM','Skill in participating in discussions, presentations, and group projects.');
INSERT INTO attributes VALUES(3,2,'Collegiate','DISCIPLINE','DIS','Focus and time management for completing assignments and studying.');
INSERT INTO attributes VALUES(4,2,'Collegiate','ORGANIZATION','ORG','Keeping track of deadlines, schedules, and coursework.');
INSERT INTO attributes VALUES(5,2,'Collegiate','STAMINA','STA','Enduring long study sessions, late-night cramming, and busy semesters.');
INSERT INTO attributes VALUES(6,2,'Collegiate','PERSEVERANCE','PRS','Resilience against academic setbacks, exam failures, and stress.');
INSERT INTO attributes VALUES(1,3,'Pedagogue','PEDAGOGY','PDG','Knowledge of teaching methods, curriculum design, and educational theories.');
INSERT INTO attributes VALUES(2,3,'Pedagogue','CLASSROOM COMMAND','CMC','The ability to manage a class, engage students, and deliver compelling lessons.');
INSERT INTO attributes VALUES(3,3,'Pedagogue','LESSON CRAFTING','LCR','Skill in preparing, adapting, and refining lesson plans.');
INSERT INTO attributes VALUES(4,3,'Pedagogue','ORGANIZATION','ORG','Tracking assessments, marking work, and maintaining a structured learning environment.');
INSERT INTO attributes VALUES(5,3,'Pedagogue','STAMINA','STA','The endurance to teach daily, plan lessons, and manage grading loads.');
INSERT INTO attributes VALUES(6,3,'Pedagogue','ADAPTABILITY','ADP','The flexibility to modify plans, deal with disruptions, and pivot in response to challenges.');
INSERT INTO attributes VALUES(1,4,'Masters','SCHOLARSHIP','SCH','Mastery of one’s research field, ability to synthesize knowledge, and theoretical depth.');
INSERT INTO attributes VALUES(2,4,'Masters','RHETORIC','RHT','Presenting, debating, and defending research to peers and faculty.');
INSERT INTO attributes VALUES(3,4,'Masters','ENDURANCE','END','The stamina to write, edit, and revise an endless thesis.');
INSERT INTO attributes VALUES(4,4,'Masters','ORGANIZATION','ORG','Managing research notes, deadlines, and administrative duties.');
INSERT INTO attributes VALUES(5,4,'Masters','STAMINA','STA','Surviving long nights of writing, conference preparation, and stress.');
INSERT INTO attributes VALUES(6,4,'Masters','RESILIENCE','RES','Withstanding peer review, setbacks, and the terror of Reviewer #2.');
INSERT INTO attributes VALUES(1,5,'Doctoral','SCHOLARSHIP','SCH','Mastery of research methodology, original contributions to knowledge, and field expertise.');
INSERT INTO attributes VALUES(2,5,'Doctoral','RHETORIC','RHT','The ability to present, debate, and defend research before a panel of experts.');
INSERT INTO attributes VALUES(3,5,'Doctoral','ENDURANCE','END','The mental and physical stamina to withstand years of research and revisions.');
INSERT INTO attributes VALUES(4,5,'Doctoral','ORGANIZATION','ORG','Managing extensive notes, datasets, deadlines, and bureaucratic hurdles.');
INSERT INTO attributes VALUES(5,5,'Doctoral','STAMINA','STA','Surviving stress, conference travel, grant applications, and the endless waiting game.');
INSERT INTO attributes VALUES(6,5,'Doctoral','RESILIENCE','RES','Withstanding peer review, funding rejections, and existential crises.');
INSERT INTO attributes VALUES(1,6,'Sage','SCHOLARSHIP','SCH','Mastery of one’s field, the depth of research, and publication record.');
INSERT INTO attributes VALUES(2,6,'Sage','RHETORIC','RHT','Command of speech, persuasion in funding proposals, and conference delivery.');
INSERT INTO attributes VALUES(3,6,'Sage','ENDURANCE','END','Stamina for long research hours, grading marathons, and tenure-track survival.');
INSERT INTO attributes VALUES(4,6,'Sage','ADMINISTRATION','ADM','Mastery of bureaucratic tasks, committee duties, and institutional navigation.');
INSERT INTO attributes VALUES(5,6,'Sage','STAMINA','STA','Resilience against burnout, ability to balance research, teaching, and service.');
INSERT INTO attributes VALUES(6,6,'Sage','INFLUENCE','INF','Political acumen, networking, and power within the institution.');
COMMIT;
