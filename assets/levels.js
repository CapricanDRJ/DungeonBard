const skillNames = [
  ["Learning","Communication","Discipline","Organization","Stamina","Perseverance"],
  ["Learning","Communication","Discipline","Organization","Stamina","Perseverance"],
  ["Pedagogy","Classroom Command","Lesson Crafting","Organization","Stamina","Adaptability"],
  ["Scholarship","Rhetoric","Endurance","Organization","Stamina","Resilience"],
  ["Scholarship","Rhetoric","Endurance","Organization","Stamina","Resilience"],
  ["Scholarship","Rhetoric","Endurance","Administration","Stamina","Influence"]
];
const skillLevel = {
    1: [10830,9660,8570,7540,6580,5690,4860,4110,3420,2790,2240,1750,1320,950,650,400,220,90,20,0],
    2: [21660,19330,17130,15080,13160,11370,9730,8220,6840,5590,4480,3490,2640,1900,1290,810,440,190,40,0],
    3: [27080,24165,21415,18850,16450,14215,12160,10270,8550,6990,5600,4365,3295,2375,1615,1010,550,235,50,0],
    4: [32500,29000,25700,22620,19740,17060,14590,12320,10260,8390,6720,5240,3950,2850,1940,1210,660,280,60,0],
    5: [43440,38670,34270,30160,26320,22750,19460,16440,13680,11190,8960,6990,5270,3810,2590,1620,880,380,90,0],
    6: [54170,48330,42840,37690,32900,28440,24320,20540,17100,13980,11200,8730,6590,4760,3240,2020,1100,470,110,0],
}
//1 = artisan
//2 = soldier
//3 = healer
const profNames = {
    artisan: ['Novice', 'Apprentice', 'Artisan', 'Adept', 'Mason', 'Grandmaster', 'Guild Leader'],
    soldier: ['Initiate', 'Squire', 'Vanguard', 'Warden', 'Guardian', 'Champion', 'Knight'],
    healer: ['Greenhand', 'Herbalist', 'Apothecary', 'Mender', 'Healer', 'Surgeon', 'Grandhealer'],
    1: 'artisan',
    2: 'soldier',
    3: 'healer'
};

const profLevel = {
    1: [0, 50, 500, 1000, 2000, 3500, 5000],
    2: [0, 250, 1250, 2500, 5000, 7500, 10000],
    3: [0, 375, 1875, 5000, 8750, 13750, 17500],
    4: [0, 500, 2500, 7500, 12500, 20000, 25000],
    5: [0, 1000, 5000, 15000, 25000, 40000, 50000],
    6: [0, 2000, 10000, 30000, 50000, 80000, 100000]
};

module.exports = { skillNames, skillLevel, profNames, profLevel };
