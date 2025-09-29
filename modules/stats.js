const { SlashCommandBuilder, MessageFlagsBitField, AttachmentBuilder, EmbedBuilder } = require('discord.js');
const sqlite3 = require('better-sqlite3');
const db = new sqlite3('db/dungeonbard.db');
const sharp = require('sharp');
const MessageFlags = MessageFlagsBitField.Flags;
const professions = {
    1: [0, 50, 500, 1000, 2000, 3500, 5000],
    2: [0, 250, 1250, 2500, 5000, 7500, 10000],
    3: [0, 375, 1875, 5000, 8750, 13750, 17500],
    4: [0, 500, 2500, 7500, 12500, 20000, 25000],
    5: [0, 1000, 5000, 15000, 25000, 40000, 50000],
    6: [0, 2000, 10000, 30000, 50000, 80000, 100000],
    healer: ['Greenhand', 'Herbalist', 'Apothecary', 'Mender', 'Healer', 'Surgeon', 'Grandhealer'],
    soldier: ['Initiate', 'Squire', 'Vanguard', 'Warden', 'Guardian', 'Champion', 'Knight'],
    artisan: ['Novice', 'Apprentice', 'Artisan', 'Mason', 'Grandmaster', 'Guildmaster']
}
const skillNames = [
  ["Learning","Communication","Discipline","Organization","Stamina","Perseverance"],
  ["Learning","Communication","Discipline","Organization","Stamina","Perseverance"],
  ["Pedagogy","Classroom Command","Lesson Crafting","Organization","Stamina","Adaptability"],
  ["Scholarship","Rhetoric","Endurance","Organization","Stamina","Resilience"],
  ["Scholarship","Rhetoric","Endurance","Organization","Stamina","Resilience"],
  ["Scholarship","Rhetoric","Endurance","Administration","Stamina","Influence"]
];
const dbQuery = {
    getUserAvatarFile:  db.prepare('SELECT avatarFile FROM users WHERE userId = ? AND guildId = ?'),
    updateAvatarFileName: db.prepare('UPDATE users SET avatarFile = ? WHERE userId = ? AND guildId = ?'),
    updateAvatarBlob: db.prepare('INSERT OR REPLACE INTO avatars (userId, guildId, avatarBlob) VALUES (?, ?, ?)'),
    getAvatarBlob: db.prepare('SELECT avatarBlob FROM avatars WHERE userId = ? AND guildId = ?'),
    getUserData: db.prepare('SELECT * FROM users WHERE userId = ? AND guildId = ?'),
    getActiveItems: db.prepare(`SELECT inventory.*, itemEmojis.emoji FROM inventory LEFT JOIN itemEmojis ON inventory.emojiId = itemEmojis.emojiId WHERE inventory.userId = ? AND inventory.guildId = ? AND inventory.duration > 31536000
`)};
const avatarUpdate = async (userId, guildId, currentAvatarURL) => {
      const avatarURL = currentAvatarURL.replace(/\/a_/, '/')
    .replace(/\.[a-zA-Z]{3,4}$/, '')
    + '.png?size=64';

    const avatarFileName = avatarURL.split('/').pop().split('?')[0];
    const user = dbQuery.getUserAvatarFile.get(userId, guildId);

    if (!user || user.avatarFile !== avatarFileName) {
        try {
            const response = await fetch(avatarURL);
            if (response.ok) {
                const arrayBuffer = await response.arrayBuffer();
                const avatarBlob = Buffer.from(arrayBuffer);
                dbQuery.updateAvatarFileName.run(avatarFileName, userId, guildId);
                dbQuery.updateAvatarBlob.run(userId, guildId, avatarBlob);
            }
        } catch (error) {
            console.error('Error updating avatar:', error, `userId:${userId}`);
        }
    }
};
// Load domains from database
const domains = (() => {
    const domainData = db.prepare('SELECT * FROM domains ORDER BY id').all();
    const domainsObj = {};
    domainData.forEach(domain => {
        domainsObj[domain.id] = {
            name: domain.title,
            description: domain.description,
            background: domain.background,
            text: domain.font
        };
    });
    return domainsObj;
})();

const attributes = (() => {
    const attrRows = db.prepare(`
  SELECT domainId, skillId, domain, skillName, skillAbbrv, skillDesc, levels
  FROM attributes
  ORDER BY domainId, skillId
`).all();

const attrObj = {};
for (const row of attrRows) {
  if (!attrObj[row.domainId]) {
    attrObj[row.domainId] = {};
  }
  attrObj[row.domainId][row.skillId] = {
    domain: row.domain,
    skillName: row.skillName,
    skillAbbrv: row.skillAbbrv,
    skillDesc: row.skillDesc,
    levels: JSON.parse(row.levels)
  };
}
return attrObj;
})();

// Image layout constants
// Image layout constants
const IMAGE_WIDTH = 300;  // Increased from 250
const IMAGE_HEIGHT = 420; // Increased from 350
const AVATAR_SIZE = 64;
const FONT_SIZE = 12;
const LINE_HEIGHT = 16;
const MARGIN = 50; // Increased from 10 to accommodate border
const COLUMN_WIDTH = (IMAGE_WIDTH - MARGIN * 3) / 2;

async function generateCharacterImage(userData, domainData, items, avatarBlob = null) {
   try {
    // Create base canvas with parchment background
    const canvas = sharp({
      create: {
        width: IMAGE_WIDTH,
        height: IMAGE_HEIGHT,
        channels: 4,
        background: { r: 235, g: 220, b: 195, alpha: 1 } // Aged parchment color
      }
    });

    const compositeLayers = [];
    const textColor = `#${domainData.text.toString(16).padStart(6, '0')}`;
    const accentColor = `#${domainData.background.toString(16).padStart(6, '0')}`;

    // Build SVG text overlay with decorative border
 
// Build SVG text overlay with decorative border
    let svgContent = `
      <svg width="${IMAGE_WIDTH}" height="${IMAGE_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <!-- Parchment texture pattern -->
          <filter id="parchment">
            <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="5" result="noise"/>
            <feColorMatrix in="noise" type="saturate" values="0" result="desaturatedNoise"/>
            <feComponentTransfer in="desaturatedNoise" result="theNoise">
              <feFuncA type="table" tableValues="0 0 0.05 0"/>
            </feComponentTransfer>
            <feBlend in="SourceGraphic" in2="theNoise" mode="multiply"/>
          </filter>
        </defs>
        <style>
          .title { font-family: 'UnifrakturMaguntia', 'Cinzel', 'IM Fell English', serif; font-size: 14px; font-weight: bold; fill: ${textColor}; }
          .header { font-family: 'Cinzel', 'IM Fell English', serif; font-size: 12px; font-weight: bold; fill: ${textColor}; }
          .text { font-family: 'Gentium Book Basic', 'IM Fell English', serif; font-size: ${FONT_SIZE}px; fill: ${textColor}; }
          .section { font-family: 'Cinzel', 'IM Fell English', serif; font-size: 13px; font-weight: bold; fill: ${textColor}; text-decoration: underline; }
        </style>
        
        <!-- Aged parchment background with texture -->
        <rect x="0" y="0" width="${IMAGE_WIDTH}" height="${IMAGE_HEIGHT}" fill="#ebe4c3" filter="url(#parchment)"/>
        
        <!-- Decorative D&D-themed border in black -->
        <!-- Outer ornate frame in black -->
        <rect x="2" y="2" width="${IMAGE_WIDTH - 4}" height="${IMAGE_HEIGHT - 4}" 
              fill="none" stroke="#000000" stroke-width="4"/>
        
        <!-- Domain color accent inside -->
        <rect x="8" y="8" width="${IMAGE_WIDTH - 16}" height="${IMAGE_HEIGHT - 16}" 
              fill="none" stroke="${accentColor}" stroke-width="3" opacity="0.8"/>
        
        <!-- Inner frame in black -->
        <rect x="13" y="13" width="${IMAGE_WIDTH - 26}" height="${IMAGE_HEIGHT - 26}" 
              fill="none" stroke="#000000" stroke-width="1.5"/>
        
        <!-- Elaborate corner ornaments - Top Left -->
        <g>
          <path d="M 2,2 L 2,45 L 15,45 L 15,15 L 45,15 L 45,2 Z" fill="#000000"/>
          <circle cx="28" cy="28" r="14" fill="none" stroke="${accentColor}" stroke-width="3" opacity="0.8"/>
          <circle cx="28" cy="28" r="9" fill="${accentColor}" opacity="0.4"/>
          <path d="M 18,18 Q 23,23 28,18 Q 33,23 38,18" stroke="#000000" stroke-width="1.5" fill="none"/>
          <path d="M 18,38 Q 23,33 28,38 Q 33,33 38,38" stroke="#000000" stroke-width="1.5" fill="none"/>
        </g>
        
        <!-- Elaborate corner ornaments - Top Right -->
        <g>
          <path d="M ${IMAGE_WIDTH - 2},2 L ${IMAGE_WIDTH - 2},45 L ${IMAGE_WIDTH - 15},45 L ${IMAGE_WIDTH - 15},15 L ${IMAGE_WIDTH - 45},15 L ${IMAGE_WIDTH - 45},2 Z" fill="#000000"/>
          <circle cx="${IMAGE_WIDTH - 28}" cy="28" r="14" fill="none" stroke="${accentColor}" stroke-width="3" opacity="0.8"/>
          <circle cx="${IMAGE_WIDTH - 28}" cy="28" r="9" fill="${accentColor}" opacity="0.4"/>
          <path d="M ${IMAGE_WIDTH - 38},18 Q ${IMAGE_WIDTH - 33},23 ${IMAGE_WIDTH - 28},18 Q ${IMAGE_WIDTH - 23},23 ${IMAGE_WIDTH - 18},18" stroke="#000000" stroke-width="1.5" fill="none"/>
          <path d="M ${IMAGE_WIDTH - 38},38 Q ${IMAGE_WIDTH - 33},33 ${IMAGE_WIDTH - 28},38 Q ${IMAGE_WIDTH - 23},33 ${IMAGE_WIDTH - 18},38" stroke="#000000" stroke-width="1.5" fill="none"/>
        </g>
        
        <!-- Elaborate corner ornaments - Bottom Left -->
        <g>
          <path d="M 2,${IMAGE_HEIGHT - 2} L 2,${IMAGE_HEIGHT - 45} L 15,${IMAGE_HEIGHT - 45} L 15,${IMAGE_HEIGHT - 15} L 45,${IMAGE_HEIGHT - 15} L 45,${IMAGE_HEIGHT - 2} Z" fill="#000000"/>
          <circle cx="28" cy="${IMAGE_HEIGHT - 28}" r="14" fill="none" stroke="${accentColor}" stroke-width="3" opacity="0.8"/>
          <circle cx="28" cy="${IMAGE_HEIGHT - 28}" r="9" fill="${accentColor}" opacity="0.4"/>
          <path d="M 18,${IMAGE_HEIGHT - 38} Q 23,${IMAGE_HEIGHT - 33} 28,${IMAGE_HEIGHT - 38} Q 33,${IMAGE_HEIGHT - 33} 38,${IMAGE_HEIGHT - 38}" stroke="#000000" stroke-width="1.5" fill="none"/>
          <path d="M 18,${IMAGE_HEIGHT - 18} Q 23,${IMAGE_HEIGHT - 23} 28,${IMAGE_HEIGHT - 18} Q 33,${IMAGE_HEIGHT - 23} 38,${IMAGE_HEIGHT - 18}" stroke="#000000" stroke-width="1.5" fill="none"/>
        </g>
        
        <!-- Elaborate corner ornaments - Bottom Right -->
        <g>
          <path d="M ${IMAGE_WIDTH - 2},${IMAGE_HEIGHT - 2} L ${IMAGE_WIDTH - 2},${IMAGE_HEIGHT - 45} L ${IMAGE_WIDTH - 15},${IMAGE_HEIGHT - 45} L ${IMAGE_WIDTH - 15},${IMAGE_HEIGHT - 15} L ${IMAGE_WIDTH - 45},${IMAGE_HEIGHT - 15} L ${IMAGE_WIDTH - 45},${IMAGE_HEIGHT - 2} Z" fill="#000000"/>
          <circle cx="${IMAGE_WIDTH - 28}" cy="${IMAGE_HEIGHT - 28}" r="14" fill="none" stroke="${accentColor}" stroke-width="3" opacity="0.8"/>
          <circle cx="${IMAGE_WIDTH - 28}" cy="${IMAGE_HEIGHT - 28}" r="9" fill="${accentColor}" opacity="0.4"/>
          <path d="M ${IMAGE_WIDTH - 38},${IMAGE_HEIGHT - 38} Q ${IMAGE_WIDTH - 33},${IMAGE_HEIGHT - 33} ${IMAGE_WIDTH - 28},${IMAGE_HEIGHT - 38} Q ${IMAGE_WIDTH - 23},${IMAGE_HEIGHT - 33} ${IMAGE_WIDTH - 18},${IMAGE_HEIGHT - 38}" stroke="#000000" stroke-width="1.5" fill="none"/>
          <path d="M ${IMAGE_WIDTH - 38},${IMAGE_HEIGHT - 18} Q ${IMAGE_WIDTH - 33},${IMAGE_HEIGHT - 23} ${IMAGE_WIDTH - 28},${IMAGE_HEIGHT - 18} Q ${IMAGE_WIDTH - 23},${IMAGE_HEIGHT - 23} ${IMAGE_WIDTH - 18},${IMAGE_HEIGHT - 18}" stroke="#000000" stroke-width="1.5" fill="none"/>
        </g>
        
        <!-- Celtic knotwork pattern along top -->
        <path d="M 55,6 Q 65,6 65,11 Q 65,16 55,16 M 65,6 Q 75,6 75,11 Q 75,16 65,16" stroke="#000000" stroke-width="1.5" fill="none"/>
        <path d="M 85,6 Q 95,6 95,11 Q 95,16 85,16 M 95,6 Q 105,6 105,11 Q 105,16 95,16" stroke="#000000" stroke-width="1.5" fill="none"/>
        <path d="M 115,6 Q 125,6 125,11 Q 125,16 115,16 M 125,6 Q 135,6 135,11 Q 135,16 125,16" stroke="#000000" stroke-width="1.5" fill="none"/>
        <path d="M 145,6 Q 155,6 155,11 Q 155,16 145,16 M 155,6 Q 165,6 165,11 Q 165,16 155,16" stroke="#000000" stroke-width="1.5" fill="none"/>
        <path d="M 175,6 Q 185,6 185,11 Q 185,16 175,16 M 185,6 Q 195,6 195,11 Q 195,16 185,16" stroke="#000000" stroke-width="1.5" fill="none"/>
        <path d="M 205,6 Q 215,6 215,11 Q 215,16 205,16 M 215,6 Q 225,6 225,11 Q 225,16 215,16" stroke="#000000" stroke-width="1.5" fill="none"/>
        <path d="M 235,6 Q 245,6 245,11 Q 245,16 235,16 M 245,6 Q 255,6 255,11 Q 255,16 245,16" stroke="#000000" stroke-width="1.5" fill="none"/>
        <path d="M 265,6 Q 275,6 275,11 Q 275,16 265,16 M 275,6 Q 285,6 285,11 Q 285,16 275,16" stroke="#000000" stroke-width="1.5" fill="none"/>
        
        <!-- Celtic knotwork pattern along bottom -->
        <path d="M 55,${IMAGE_HEIGHT - 6} Q 65,${IMAGE_HEIGHT - 6} 65,${IMAGE_HEIGHT - 11} Q 65,${IMAGE_HEIGHT - 16} 55,${IMAGE_HEIGHT - 16} M 65,${IMAGE_HEIGHT - 6} Q 75,${IMAGE_HEIGHT - 6} 75,${IMAGE_HEIGHT - 11} Q 75,${IMAGE_HEIGHT - 16} 65,${IMAGE_HEIGHT - 16}" stroke="#000000" stroke-width="1.5" fill="none"/>
        <path d="M 85,${IMAGE_HEIGHT - 6} Q 95,${IMAGE_HEIGHT - 6} 95,${IMAGE_HEIGHT - 11} Q 95,${IMAGE_HEIGHT - 16} 85,${IMAGE_HEIGHT - 16} M 95,${IMAGE_HEIGHT - 6} Q 105,${IMAGE_HEIGHT - 6} 105,${IMAGE_HEIGHT - 11} Q 105,${IMAGE_HEIGHT - 16} 95,${IMAGE_HEIGHT - 16}" stroke="#000000" stroke-width="1.5" fill="none"/>
        <path d="M 115,${IMAGE_HEIGHT - 6} Q 125,${IMAGE_HEIGHT - 6} 125,${IMAGE_HEIGHT - 11} Q 125,${IMAGE_HEIGHT - 16} 115,${IMAGE_HEIGHT - 16} M 125,${IMAGE_HEIGHT - 6} Q 135,${IMAGE_HEIGHT - 6} 135,${IMAGE_HEIGHT - 11} Q 135,${IMAGE_HEIGHT - 16} 125,${IMAGE_HEIGHT - 16}" stroke="#000000" stroke-width="1.5" fill="none"/>
        <path d="M 145,${IMAGE_HEIGHT - 6} Q 155,${IMAGE_HEIGHT - 6} 155,${IMAGE_HEIGHT - 11} Q 155,${IMAGE_HEIGHT - 16} 145,${IMAGE_HEIGHT - 16} M 155,${IMAGE_HEIGHT - 6} Q 165,${IMAGE_HEIGHT - 6} 165,${IMAGE_HEIGHT - 11} Q 165,${IMAGE_HEIGHT - 16} 155,${IMAGE_HEIGHT - 16}" stroke="#000000" stroke-width="1.5" fill="none"/>
        <path d="M 175,${IMAGE_HEIGHT - 6} Q 185,${IMAGE_HEIGHT - 6} 185,${IMAGE_HEIGHT - 11} Q 185,${IMAGE_HEIGHT - 16} 175,${IMAGE_HEIGHT - 16} M 185,${IMAGE_HEIGHT - 6} Q 195,${IMAGE_HEIGHT - 6} 195,${IMAGE_HEIGHT - 11} Q 195,${IMAGE_HEIGHT - 16} 185,${IMAGE_HEIGHT - 16}" stroke="#000000" stroke-width="1.5" fill="none"/>
        <path d="M 205,${IMAGE_HEIGHT - 6} Q 215,${IMAGE_HEIGHT - 6} 215,${IMAGE_HEIGHT - 11} Q 215,${IMAGE_HEIGHT - 16} 205,${IMAGE_HEIGHT - 16} M 215,${IMAGE_HEIGHT - 6} Q 225,${IMAGE_HEIGHT - 6} 225,${IMAGE_HEIGHT - 11} Q 225,${IMAGE_HEIGHT - 16} 215,${IMAGE_HEIGHT - 16}" stroke="#000000" stroke-width="1.5" fill="none"/>
        <path d="M 235,${IMAGE_HEIGHT - 6} Q 245,${IMAGE_HEIGHT - 6} 245,${IMAGE_HEIGHT - 11} Q 245,${IMAGE_HEIGHT - 16} 235,${IMAGE_HEIGHT - 16} M 245,${IMAGE_HEIGHT - 6} Q 255,${IMAGE_HEIGHT - 6} 255,${IMAGE_HEIGHT - 11} Q 255,${IMAGE_HEIGHT - 16} 245,${IMAGE_HEIGHT - 16}" stroke="#000000" stroke-width="1.5" fill="none"/>
        <path d="M 265,${IMAGE_HEIGHT - 6} Q 275,${IMAGE_HEIGHT - 6} 275,${IMAGE_HEIGHT - 11} Q 275,${IMAGE_HEIGHT - 16} 265,${IMAGE_HEIGHT - 16} M 275,${IMAGE_HEIGHT - 6} Q 285,${IMAGE_HEIGHT - 6} 285,${IMAGE_HEIGHT - 11} Q 285,${IMAGE_HEIGHT - 16} 275,${IMAGE_HEIGHT - 16}" stroke="#000000" stroke-width="1.5" fill="none"/>
        
<!-- Decorative diamonds along left side -->
        <path d="M 10,70 L 15,75 L 10,80 L 5,75 Z" fill="#000000"/>
        <path d="M 10,100 L 15,105 L 10,110 L 5,105 Z" fill="#000000"/>
        <path d="M 10,130 L 15,135 L 10,140 L 5,135 Z" fill="#000000"/>
        <path d="M 10,160 L 15,165 L 10,170 L 5,165 Z" fill="#000000"/>
        <path d="M 10,190 L 15,195 L 10,200 L 5,195 Z" fill="#000000"/>
        <path d="M 10,220 L 15,225 L 10,230 L 5,225 Z" fill="#000000"/>
        <path d="M 10,250 L 15,255 L 10,260 L 5,255 Z" fill="#000000"/>
        <path d="M 10,280 L 15,285 L 10,290 L 5,285 Z" fill="#000000"/>
        <path d="M 10,310 L 15,315 L 10,320 L 5,315 Z" fill="#000000"/>
        <path d="M 10,340 L 15,345 L 10,350 L 5,345 Z" fill="#000000"/>
        <path d="M 10,370 L 15,375 L 10,380 L 5,375 Z" fill="#000000"/>
        
        <!-- Domain color accent dots in diamonds (left) -->
        <circle cx="10" cy="75" r="2" fill="${accentColor}"/>
        <circle cx="10" cy="105" r="2" fill="${accentColor}"/>
        <circle cx="10" cy="135" r="2" fill="${accentColor}"/>
        <circle cx="10" cy="165" r="2" fill="${accentColor}"/>
        <circle cx="10" cy="195" r="2" fill="${accentColor}"/>
        <circle cx="10" cy="225" r="2" fill="${accentColor}"/>
        <circle cx="10" cy="255" r="2" fill="${accentColor}"/>
        <circle cx="10" cy="285" r="2" fill="${accentColor}"/>
        <circle cx="10" cy="315" r="2" fill="${accentColor}"/>
        <circle cx="10" cy="345" r="2" fill="${accentColor}"/>
        <circle cx="10" cy="375" r="2" fill="${accentColor}"/>
        
        <!-- Decorative diamonds along right side -->
        <path d="M ${IMAGE_WIDTH - 10},70 L ${IMAGE_WIDTH - 15},75 L ${IMAGE_WIDTH - 10},80 L ${IMAGE_WIDTH - 5},75 Z" fill="#000000"/>
        <path d="M ${IMAGE_WIDTH - 10},100 L ${IMAGE_WIDTH - 15},105 L ${IMAGE_WIDTH - 10},110 L ${IMAGE_WIDTH - 5},105 Z" fill="#000000"/>
        <path d="M ${IMAGE_WIDTH - 10},130 L ${IMAGE_WIDTH - 15},135 L ${IMAGE_WIDTH - 10},140 L ${IMAGE_WIDTH - 5},135 Z" fill="#000000"/>
        <path d="M ${IMAGE_WIDTH - 10},160 L ${IMAGE_WIDTH - 15},165 L ${IMAGE_WIDTH - 10},170 L ${IMAGE_WIDTH - 5},165 Z" fill="#000000"/>
        <path d="M ${IMAGE_WIDTH - 10},190 L ${IMAGE_WIDTH - 15},195 L ${IMAGE_WIDTH - 10},200 L ${IMAGE_WIDTH - 5},195 Z" fill="#000000"/>
        <path d="M ${IMAGE_WIDTH - 10},220 L ${IMAGE_WIDTH - 15},225 L ${IMAGE_WIDTH - 10},230 L ${IMAGE_WIDTH - 5},225 Z" fill="#000000"/>
        <path d="M ${IMAGE_WIDTH - 10},250 L ${IMAGE_WIDTH - 15},255 L ${IMAGE_WIDTH - 10},260 L ${IMAGE_WIDTH - 5},255 Z" fill="#000000"/>
        <path d="M ${IMAGE_WIDTH - 10},280 L ${IMAGE_WIDTH - 15},285 L ${IMAGE_WIDTH - 10},290 L ${IMAGE_WIDTH - 5},285 Z" fill="#000000"/>
        <path d="M ${IMAGE_WIDTH - 10},310 L ${IMAGE_WIDTH - 15},315 L ${IMAGE_WIDTH - 10},320 L ${IMAGE_WIDTH - 5},315 Z" fill="#000000"/>
        <path d="M ${IMAGE_WIDTH - 10},340 L ${IMAGE_WIDTH - 15},345 L ${IMAGE_WIDTH - 10},350 L ${IMAGE_WIDTH - 5},345 Z" fill="#000000"/>
        <path d="M ${IMAGE_WIDTH - 10},370 L ${IMAGE_WIDTH - 15},375 L ${IMAGE_WIDTH - 10},380 L ${IMAGE_WIDTH - 5},375 Z" fill="#000000"/>
        
        <!-- Domain color accent dots in diamonds (right) -->
        <circle cx="${IMAGE_WIDTH - 10}" cy="75" r="2" fill="${accentColor}"/>
        <circle cx="${IMAGE_WIDTH - 10}" cy="105" r="2" fill="${accentColor}"/>
        <circle cx="${IMAGE_WIDTH - 10}" cy="135" r="2" fill="${accentColor}"/>
        <circle cx="${IMAGE_WIDTH - 10}" cy="165" r="2" fill="${accentColor}"/>
        <circle cx="${IMAGE_WIDTH - 10}" cy="195" r="2" fill="${accentColor}"/>
        <circle cx="${IMAGE_WIDTH - 10}" cy="225" r="2" fill="${accentColor}"/>
        <circle cx="${IMAGE_WIDTH - 10}" cy="255" r="2" fill="${accentColor}"/>
        <circle cx="${IMAGE_WIDTH - 10}" cy="285" r="2" fill="${accentColor}"/>
        <circle cx="${IMAGE_WIDTH - 10}" cy="315" r="2" fill="${accentColor}"/>
        <circle cx="${IMAGE_WIDTH - 10}" cy="345" r="2" fill="${accentColor}"/>
        <circle cx="${IMAGE_WIDTH - 10}" cy="375" r="2" fill="${accentColor}"/>`;
    // Column 1: Avatar and Attributes (left side)
    const col1X = MARGIN;
    let col1Y = MARGIN + AVATAR_SIZE + 20;

    // Column 2: Name and everything else (right side)  
    const col2X = MARGIN + AVATAR_SIZE + 20;
    let col2Y = MARGIN;

    // Character Name and Domain (Column 2)
    svgContent += `
      <text x="${col2X}" y="${col2Y + 15}" class="title">${userData.displayName}</text>
      <text x="${col2X}" y="${col2Y + 30}" class="header">${domainData.name}</text>`;
    
    col2Y += 50;

    // Party information (Column 2)
    if (userData.partyName) {
      svgContent += `<text x="${col2X}" y="${col2Y}" class="text">Party: ${userData.partyName}</text>`;
      col2Y += LINE_HEIGHT;
    }

    // Overall Experience (Column 2)
    svgContent += `
      <text x="${col2X}" y="${col2Y}" class="section">Overall Experience</text>
      <text x="${col2X}" y="${col2Y + 15}" class="text">${userData.overallExp} XP</text>`;
    
    col2Y += 35;

    // Professions Section (Column 2)
    svgContent += `<text x="${col2X}" y="${col2Y}" class="section">Professions</text>`;
    col2Y += 18;

    const artisanRank = calculateRank(userData.domainId, userData.artisanExp, 'artisan');
    const soldierRank = calculateRank(userData.domainId, userData.soldierExp, 'soldier'); 
    const healerRank = calculateRank(userData.domainId, userData.healerExp, 'healer');

    svgContent += `
      <text x="${col2X}" y="${col2Y}" class="text">Artisan: ${artisanRank}</text>
      <text x="${col2X}" y="${col2Y + LINE_HEIGHT}" class="text">Soldier: ${soldierRank}</text>
      <text x="${col2X}" y="${col2Y + LINE_HEIGHT * 2}" class="text">Healer: ${healerRank}</text>`;
    
    col2Y += LINE_HEIGHT * 3 + 20;

    // Coins Section (Column 2)
    svgContent += `<text x="${col2X}" y="${col2Y}" class="section">Coins</text>`;
    col2Y += 18;
    svgContent += `<text x="${col2X}" y="${col2Y}" class="text">${userData.coins}</text>`;
    col2Y += 30;

    // Equipment Section (Column 1+2)
    svgContent += `<text x="${col1X}" y="${col2Y}" class="section">Equipment</text>`;
    col2Y += 18;

for (const item of items) {
  if(item.skillBonus) {
    // Add emoji image spanning 2 lines
    if(item.emoji) {
      const base64Emoji = item.emoji.toString('base64');
      svgContent += `<image x="${col1X}" y="${col2Y - 11}" width="32" height="32" href="data:image/png;base64,${base64Emoji}"/>`;
    }
    svgContent += `<text x="${col1X + 36}" y="${col2Y}" class="text">${item.name}:</text>`;
    col2Y += LINE_HEIGHT;
    svgContent += `<text x="${col1X + 36}" y="${col2Y}" class="text">+${item.skillBonus} ${skillNames[userData.domainId - 1][item.skill - 1]}</text>`;
    col2Y += LINE_HEIGHT;
  }
  if(item.professionBonus) {
    // Add emoji image spanning 2 lines
    if(item.emoji) {
      const base64Emoji = item.emoji.toString('base64');
      svgContent += `<image x="${col1X}" y="${col2Y - 11}" width="32" height="32" href="data:image/png;base64,${base64Emoji}"/>`;
    }
    svgContent += `<text x="${col1X + 36}" y="${col2Y}" class="text">${item.name}:</text>`;
    col2Y += LINE_HEIGHT;
    svgContent += `<text x="${col1X + 36}" y="${col2Y}" class="text">X${item.professionBonus} ${professionNames[item.professionId - 1]}</text>`;
    col2Y += LINE_HEIGHT;
  }
  col2Y += LINE_HEIGHT;
}

    col2Y += LINE_HEIGHT * 2 + 10;

    // Attributes Section (Column 1)
    svgContent += `<text x="${col1X}" y="${col1Y}" class="section">Attributes</text>`;
    col1Y += 18;
    const attrDomain = attributes[userData.domainId];
    // Calculate attribute levels from skills 1-6 using proper database lookups
    const skill1Level = attrDomain[1].levels.findLastIndex(level => userData.skill1 >= level) + 1;
    const skill2Level = attrDomain[2].levels.findLastIndex(level => userData.skill2 >= level) + 1;
    const skill3Level = attrDomain[3].levels.findLastIndex(level => userData.skill3 >= level) + 1;
    const skill4Level = attrDomain[4].levels.findLastIndex(level => userData.skill4 >= level) + 1;
    const skill5Level = attrDomain[5].levels.findLastIndex(level => userData.skill5 >= level) + 1;
    const skill6Level = attrDomain[6].levels.findLastIndex(level => userData.skill6 >= level) + 1;

    // Get proper attribute names based on domain
    const skill1Name = attrDomain[1]?.skillAbbrv || 'Skill 1';
    const skill2Name = attrDomain[2]?.skillAbbrv || 'Skill 2';
    const skill3Name = attrDomain[3]?.skillAbbrv || 'Skill 3';
    const skill4Name = attrDomain[4]?.skillAbbrv || 'Skill 4';
    const skill5Name = attrDomain[5]?.skillAbbrv || 'Skill 5';
    const skill6Name = attrDomain[6]?.skillAbbrv || 'Skill 6';

    svgContent += `
      <text x="${col1X}" y="${col1Y}" class="text">${skill1Name}: Lv${skill1Level}</text>
      <text x="${col1X}" y="${col1Y + LINE_HEIGHT}" class="text">${skill2Name}: Lv${skill2Level}</text>
      <text x="${col1X}" y="${col1Y + LINE_HEIGHT * 2}" class="text">${skill3Name}: Lv${skill3Level}</text>
      <text x="${col1X}" y="${col1Y + LINE_HEIGHT * 3}" class="text">${skill4Name}: Lv${skill4Level}</text>
      <text x="${col1X}" y="${col1Y + LINE_HEIGHT * 4}" class="text">${skill5Name}: Lv${skill5Level}</text>
      <text x="${col1X}" y="${col1Y + LINE_HEIGHT * 5}" class="text">${skill6Name}: Lv${skill6Level}</text>`;

    // Add active bonuses and relics at bottom of column 2 if space allows
    const now = Math.floor(Date.now() / 1000);
    
    if (userData.armourBonusEnd > now || userData.weaponBonusEnd > now || userData.healerBonusEnd > now) {
      svgContent += `<text x="${col2X}" y="${col2Y}" class="section">Active Bonuses</text>`;
      col2Y += 18;
      
      if (userData.armourBonusEnd > now) {
        const timeRemaining = formatTimeRemaining(userData.armourBonusEnd - now);
        svgContent += `<text x="${col2X}" y="${col2Y}" class="text">Armour +${userData.armourBonus}</text>`;
        col2Y += LINE_HEIGHT;
      }
      
      if (userData.weaponBonusEnd > now) {
        const timeRemaining = formatTimeRemaining(userData.weaponBonusEnd - now);
        svgContent += `<text x="${col2X}" y="${col2Y}" class="text">Weapon +${userData.weaponBonus}</text>`;
        col2Y += LINE_HEIGHT;
      }
      
      if (userData.healerBonusEnd > now) {
        const timeRemaining = formatTimeRemaining(userData.healerBonusEnd - now);
        svgContent += `<text x="${col2X}" y="${col2Y}" class="text">Healer x${userData.healerBonus}</text>`;
        col2Y += LINE_HEIGHT;
      }
    }

    if (userData.artisanBonusEnd > now || userData.soldierBonusEnd > now) {
      svgContent += `<text x="${col2X}" y="${col2Y + 10}" class="section">Relics</text>`;
      col2Y += 28;
      
      if (userData.artisanBonusEnd > now) {
        svgContent += `<text x="${col2X}" y="${col2Y}" class="text">Artisan x${userData.artisanBonus}</text>`;
        col2Y += LINE_HEIGHT;
      }
      
      if (userData.soldierBonusEnd > now) {
        svgContent += `<text x="${col2X}" y="${col2Y}" class="text">Soldier x${userData.soldierBonus}</text>`;
      }
    }

    svgContent += '</svg>';
    compositeLayers.push({
      input: Buffer.from(svgContent),
      top: 0,
      left: 0
    });

    // Add avatar on top if available
    if (avatarBlob) {
      const processedAvatar = await sharp(avatarBlob)
        .png()
        .toBuffer();
      
      compositeLayers.push({
        input: processedAvatar,
        top: MARGIN,
        left: MARGIN,
      });
    }

    // Generate final image
    const finalBuffer = await canvas
      .composite(compositeLayers)
      .png({ compressionLevel: 1 })
      .toBuffer();

    return finalBuffer;
  } catch (error) {
    throw new Error(`Character image generation failed: ${error.message}`);
  }
}

// Helper functions - implement these based on your game logic
function calculateRank(domain, experience, profession) {
    const level = professions[domain].findLastIndex(level => experience >= level) || 0;
return professions[profession][level];
}

function formatTimeRemaining(seconds) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

module.exports = {
    commandData: new SlashCommandBuilder()
        .setName('stats')
        .setDescription('Display character statistics image'),

    allowedButtons: [],

    handleInteraction: async (client, interaction) => {
        if (interaction.isCommand() && interaction.commandName === 'stats') {
            module.exports.executeCommand(interaction);
        }
    },

    main: (client) => {
        console.log("Slash commands for stats module have been loaded.");
    },

    executeCommand: async (interaction) => {
        const userId = interaction.user.id;
        const guildId = interaction.guildId;
        try {
            // Get user data from database
            const userData = dbQuery.getUserData.get(userId, guildId);
            
            if (!userData) {
                interaction.reply({
                    content: 'No character found. Use `/character enroll` to create one first.',
                    flags: MessageFlags.Ephemeral
                });
                return;
            }

            // Get domain data
            const domainData = domains[userData.domainId];
            if (!domainData) {
                interaction.reply({
                    content: 'Invalid domain data found.',
                    flags: MessageFlags.Ephemeral
                });
                return;
            }
            const avatarBlob = dbQuery.getAvatarBlob.get(userId, guildId)?.avatarBlob || null;
            const items = dbQuery.getActiveItems.all(userId, guildId);
            // Generate character image
            const imageBuffer = await generateCharacterImage(userData, domainData, items, avatarBlob);
            const fileName = `${userData.displayName.replace(/[<>:"/\\|?*]/g, '_')}-stats.png`;
            const attachment = new AttachmentBuilder(imageBuffer, { name: fileName });
            const embeds = [new EmbedBuilder()
                .setImage(`attachment://${fileName}`)
                .setColor(domainData.background)];

            interaction.reply({
                embeds,
                files: [attachment]
            });
            setTimeout(() => { avatarUpdate(userId, guildId, interaction.user.displayAvatarURL()) }, 0);
        } catch (error) {
            console.error('Error executing stats command:', error, `userId:${userId}`);
            interaction.reply({
                content: 'An error occurred while generating your stats image.',
                flags: MessageFlags.Ephemeral
            });
        }
    }
};