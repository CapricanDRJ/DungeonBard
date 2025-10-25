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
};
const professionNames = ["Artisan", "Soldier", "Healer"];
const skillNames = [
  ["Learning","Communication","Discipline","Organization","Stamina","Perseverance"],
  ["Learning","Communication","Discipline","Organization","Stamina","Perseverance"],
  ["Pedagogy","Classroom Command","Lesson Crafting","Organization","Stamina","Adaptability"],
  ["Scholarship","Rhetoric","Endurance","Organization","Stamina","Resilience"],
  ["Scholarship","Rhetoric","Endurance","Organization","Stamina","Resilience"],
  ["Scholarship","Rhetoric","Endurance","Administration","Stamina","Influence"]
];
const dbQuery = {
    getUserAvatarFile:  db.prepare('SELECT avatarFile FROM users WHERE userId = ? AND guildId = ? LIMIT 1'),
    updateAvatarFileName: db.prepare('UPDATE users SET avatarFile = ? WHERE userId = ? AND guildId = ? LIMIT 1'),
    updateAvatarBlob: db.prepare('INSERT OR REPLACE INTO avatars (userId, guildId, avatarBlob) VALUES (?, ?, ?)'),
    getAvatarBlob: db.prepare('SELECT avatarBlob FROM avatars WHERE userId = ? AND guildId = ? LIMIT 1'),
    getUserData: db.prepare('SELECT * FROM users WHERE userId = ? AND guildId = ? LIMIT 1'),
    getActiveItems: db.prepare(`SELECT inventory.*, itemEmojis.emoji FROM inventory LEFT JOIN itemEmojis ON inventory.emojiId = itemEmojis.emojiId WHERE inventory.userId = ? AND inventory.guildId = ? AND (inventory.duration > 31536000 OR NOT EXISTS (SELECT 1 FROM inventory i2 WHERE i2.userId = inventory.userId AND i2.guildId = inventory.guildId AND i2.duration > 31536000))`),
    selectEmoji: db.prepare('SELECT emoji FROM itemEmojis WHERE emojiId = ? LIMIT 1'),
    getCursedItem: db.prepare('SELECT * FROM cursedItems ORDER BY RANDOM() LIMIT 1'),
    getUserDataRandom: db.prepare('SELECT * FROM users WHERE userId = ? ORDER BY RANDOM() LIMIT 1')
  };
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
                const avatarBlob = await sharp(Buffer.from(arrayBuffer))
                    .composite([{
                        input: Buffer.from(`<svg width="64" height="64"><circle cx="32" cy="32" r="32" fill="white"/></svg>`),
                        blend: 'dest-in'
                    }])
                    .png()
                    .toBuffer();
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
const IMAGE_WIDTH = 320;  // Increased for better proportions
const IMAGE_HEIGHT = 450; // Increased for better proportions
const AVATAR_SIZE = 64;
const FONT_SIZE = 14;
const LINE_HEIGHT = FONT_SIZE + 4;
const MARGIN = 46; // Increased for elaborate border
const COLUMN_WIDTH = (IMAGE_WIDTH - MARGIN * 3) / 2;

async function generateCharacterImage(userData, domainData, items, avatarBlob = null) {
  console.log("items:", items);
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
          .title { font-family: 'MedievalSharp', serif; font-size: ${FONT_SIZE+4}px; font-weight: bold; fill: ${textColor}; }
          .header { font-family: 'MedievalSharp', serif; font-size: ${FONT_SIZE-1}px; font-weight: bold; fill: ${textColor}; }
          .text { font-family: 'MedievalSharp', serif; font-size: ${FONT_SIZE}px; fill: ${textColor}; }
          .section { font-family: 'MedievalSharp', serif; font-size: ${FONT_SIZE+2}px; font-weight: bold; fill: ${textColor}; text-decoration: underline; }
        </style>
        
        <!-- Aged parchment background with texture -->
        <rect x="0" y="0" width="${IMAGE_WIDTH}" height="${IMAGE_HEIGHT}" fill="#ebe4c3" filter="url(#parchment)"/>
        
        <!-- Main black border frames -->
        <rect x="5" y="5" width="${IMAGE_WIDTH - 10}" height="${IMAGE_HEIGHT - 10}" 
              fill="none" stroke="#000000" stroke-width="3"/>
        <rect x="10" y="10" width="${IMAGE_WIDTH - 20}" height="${IMAGE_HEIGHT - 20}" 
              fill="none" stroke="#000000" stroke-width="1.5"/>
        
        <!-- Domain color accent band -->
        <rect x="15" y="15" width="${IMAGE_WIDTH - 30}" height="${IMAGE_HEIGHT - 30}" 
              fill="none" stroke="${accentColor}" stroke-width="4" opacity="0.7"/>
        
        <!-- Inner decorative frame -->
        <rect x="20" y="20" width="${IMAGE_WIDTH - 40}" height="${IMAGE_HEIGHT - 40}" 
              fill="none" stroke="#000000" stroke-width="1"/>
        
        <!-- Elaborate Corner Ornaments - TOP LEFT -->
        <g>
          <!-- Corner square base -->
          <rect x="5" y="5" width="50" height="50" fill="#000000"/>
          <rect x="8" y="8" width="44" height="44" fill="#ebe4c3"/>
          
          <!-- Celtic knot corner design -->
          <circle cx="30" cy="30" r="18" fill="none" stroke="${accentColor}" stroke-width="3" opacity="0.8"/>
          <circle cx="30" cy="30" r="12" fill="none" stroke="#000000" stroke-width="2"/>
          <circle cx="30" cy="30" r="6" fill="${accentColor}" opacity="0.6"/>
          
          <!-- Interlaced corner pattern -->
          <path d="M 15,15 Q 22,15 22,22 L 22,38 Q 22,45 15,45" stroke="#000000" stroke-width="2" fill="none"/>
          <path d="M 45,15 Q 38,15 38,22 L 38,38 Q 38,45 45,45" stroke="#000000" stroke-width="2" fill="none"/>
          <path d="M 15,15 Q 15,22 22,22 L 38,22 Q 45,22 45,15" stroke="#000000" stroke-width="2" fill="none"/>
          <path d="M 15,45 Q 15,38 22,38 L 38,38 Q 45,38 45,45" stroke="#000000" stroke-width="2" fill="none"/>
          
          <!-- Trinity knot elements -->
          <path d="M 23,23 Q 30,20 37,23 Q 34,30 37,37 Q 30,34 23,37 Q 26,30 23,23 Z" 
                fill="none" stroke="${accentColor}" stroke-width="1.5" opacity="0.6"/>
        </g>
        
        <!-- Elaborate Corner Ornaments - TOP RIGHT -->
        <g>
          <rect x="${IMAGE_WIDTH - 55}" y="5" width="50" height="50" fill="#000000"/>
          <rect x="${IMAGE_WIDTH - 52}" y="8" width="44" height="44" fill="#ebe4c3"/>
          
          <circle cx="${IMAGE_WIDTH - 30}" cy="30" r="18" fill="none" stroke="${accentColor}" stroke-width="3" opacity="0.8"/>
          <circle cx="${IMAGE_WIDTH - 30}" cy="30" r="12" fill="none" stroke="#000000" stroke-width="2"/>
          <circle cx="${IMAGE_WIDTH - 30}" cy="30" r="6" fill="${accentColor}" opacity="0.6"/>
          
          <path d="M ${IMAGE_WIDTH - 45},15 Q ${IMAGE_WIDTH - 38},15 ${IMAGE_WIDTH - 38},22 L ${IMAGE_WIDTH - 38},38 Q ${IMAGE_WIDTH - 38},45 ${IMAGE_WIDTH - 45},45" stroke="#000000" stroke-width="2" fill="none"/>
          <path d="M ${IMAGE_WIDTH - 15},15 Q ${IMAGE_WIDTH - 22},15 ${IMAGE_WIDTH - 22},22 L ${IMAGE_WIDTH - 22},38 Q ${IMAGE_WIDTH - 22},45 ${IMAGE_WIDTH - 15},45" stroke="#000000" stroke-width="2" fill="none"/>
          <path d="M ${IMAGE_WIDTH - 45},15 Q ${IMAGE_WIDTH - 45},22 ${IMAGE_WIDTH - 38},22 L ${IMAGE_WIDTH - 22},22 Q ${IMAGE_WIDTH - 15},22 ${IMAGE_WIDTH - 15},15" stroke="#000000" stroke-width="2" fill="none"/>
          <path d="M ${IMAGE_WIDTH - 45},45 Q ${IMAGE_WIDTH - 45},38 ${IMAGE_WIDTH - 38},38 L ${IMAGE_WIDTH - 22},38 Q ${IMAGE_WIDTH - 15},38 ${IMAGE_WIDTH - 15},45" stroke="#000000" stroke-width="2" fill="none"/>
          
          <path d="M ${IMAGE_WIDTH - 37},23 Q ${IMAGE_WIDTH - 30},20 ${IMAGE_WIDTH - 23},23 Q ${IMAGE_WIDTH - 26},30 ${IMAGE_WIDTH - 23},37 Q ${IMAGE_WIDTH - 30},34 ${IMAGE_WIDTH - 37},37 Q ${IMAGE_WIDTH - 34},30 ${IMAGE_WIDTH - 37},23 Z" 
                fill="none" stroke="${accentColor}" stroke-width="1.5" opacity="0.6"/>
        </g>
        
        <!-- Elaborate Corner Ornaments - BOTTOM LEFT -->
        <g>
          <rect x="5" y="${IMAGE_HEIGHT - 55}" width="50" height="50" fill="#000000"/>
          <rect x="8" y="${IMAGE_HEIGHT - 52}" width="44" height="44" fill="#ebe4c3"/>
          
          <circle cx="30" cy="${IMAGE_HEIGHT - 30}" r="18" fill="none" stroke="${accentColor}" stroke-width="3" opacity="0.8"/>
          <circle cx="30" cy="${IMAGE_HEIGHT - 30}" r="12" fill="none" stroke="#000000" stroke-width="2"/>
          <circle cx="30" cy="${IMAGE_HEIGHT - 30}" r="6" fill="${accentColor}" opacity="0.6"/>
          
          <path d="M 15,${IMAGE_HEIGHT - 45} Q 22,${IMAGE_HEIGHT - 45} 22,${IMAGE_HEIGHT - 38} L 22,${IMAGE_HEIGHT - 22} Q 22,${IMAGE_HEIGHT - 15} 15,${IMAGE_HEIGHT - 15}" stroke="#000000" stroke-width="2" fill="none"/>
          <path d="M 45,${IMAGE_HEIGHT - 45} Q 38,${IMAGE_HEIGHT - 45} 38,${IMAGE_HEIGHT - 38} L 38,${IMAGE_HEIGHT - 22} Q 38,${IMAGE_HEIGHT - 15} 45,${IMAGE_HEIGHT - 15}" stroke="#000000" stroke-width="2" fill="none"/>
          <path d="M 15,${IMAGE_HEIGHT - 45} Q 15,${IMAGE_HEIGHT - 38} 22,${IMAGE_HEIGHT - 38} L 38,${IMAGE_HEIGHT - 38} Q 45,${IMAGE_HEIGHT - 38} 45,${IMAGE_HEIGHT - 45}" stroke="#000000" stroke-width="2" fill="none"/>
          <path d="M 15,${IMAGE_HEIGHT - 15} Q 15,${IMAGE_HEIGHT - 22} 22,${IMAGE_HEIGHT - 22} L 38,${IMAGE_HEIGHT - 22} Q 45,${IMAGE_HEIGHT - 22} 45,${IMAGE_HEIGHT - 15}" stroke="#000000" stroke-width="2" fill="none"/>
          
          <path d="M 23,${IMAGE_HEIGHT - 37} Q 30,${IMAGE_HEIGHT - 40} 37,${IMAGE_HEIGHT - 37} Q 34,${IMAGE_HEIGHT - 30} 37,${IMAGE_HEIGHT - 23} Q 30,${IMAGE_HEIGHT - 26} 23,${IMAGE_HEIGHT - 23} Q 26,${IMAGE_HEIGHT - 30} 23,${IMAGE_HEIGHT - 37} Z" 
                fill="none" stroke="${accentColor}" stroke-width="1.5" opacity="0.6"/>
        </g>
        
        <!-- Elaborate Corner Ornaments - BOTTOM RIGHT -->
        <g>
          <rect x="${IMAGE_WIDTH - 55}" y="${IMAGE_HEIGHT - 55}" width="50" height="50" fill="#000000"/>
          <rect x="${IMAGE_WIDTH - 52}" y="${IMAGE_HEIGHT - 52}" width="44" height="44" fill="#ebe4c3"/>
          
          <circle cx="${IMAGE_WIDTH - 30}" cy="${IMAGE_HEIGHT - 30}" r="18" fill="none" stroke="${accentColor}" stroke-width="3" opacity="0.8"/>
          <circle cx="${IMAGE_WIDTH - 30}" cy="${IMAGE_HEIGHT - 30}" r="12" fill="none" stroke="#000000" stroke-width="2"/>
          <circle cx="${IMAGE_WIDTH - 30}" cy="${IMAGE_HEIGHT - 30}" r="6" fill="${accentColor}" opacity="0.6"/>
          
          <path d="M ${IMAGE_WIDTH - 45},${IMAGE_HEIGHT - 45} Q ${IMAGE_WIDTH - 38},${IMAGE_HEIGHT - 45} ${IMAGE_WIDTH - 38},${IMAGE_HEIGHT - 38} L ${IMAGE_WIDTH - 38},${IMAGE_HEIGHT - 22} Q ${IMAGE_WIDTH - 38},${IMAGE_HEIGHT - 15} ${IMAGE_WIDTH - 45},${IMAGE_HEIGHT - 15}" stroke="#000000" stroke-width="2" fill="none"/>
          <path d="M ${IMAGE_WIDTH - 15},${IMAGE_HEIGHT - 45} Q ${IMAGE_WIDTH - 22},${IMAGE_HEIGHT - 45} ${IMAGE_WIDTH - 22},${IMAGE_HEIGHT - 38} L ${IMAGE_WIDTH - 22},${IMAGE_HEIGHT - 22} Q ${IMAGE_WIDTH - 22},${IMAGE_HEIGHT - 15} ${IMAGE_WIDTH - 15},${IMAGE_HEIGHT - 15}" stroke="#000000" stroke-width="2" fill="none"/>
          <path d="M ${IMAGE_WIDTH - 45},${IMAGE_HEIGHT - 45} Q ${IMAGE_WIDTH - 45},${IMAGE_HEIGHT - 38} ${IMAGE_WIDTH - 38},${IMAGE_HEIGHT - 38} L ${IMAGE_WIDTH - 22},${IMAGE_HEIGHT - 38} Q ${IMAGE_WIDTH - 15},${IMAGE_HEIGHT - 38} ${IMAGE_WIDTH - 15},${IMAGE_HEIGHT - 45}" stroke="#000000" stroke-width="2" fill="none"/>
          <path d="M ${IMAGE_WIDTH - 45},${IMAGE_HEIGHT - 15} Q ${IMAGE_WIDTH - 45},${IMAGE_HEIGHT - 22} ${IMAGE_WIDTH - 38},${IMAGE_HEIGHT - 22} L ${IMAGE_WIDTH - 22},${IMAGE_HEIGHT - 22} Q ${IMAGE_WIDTH - 15},${IMAGE_HEIGHT - 22} ${IMAGE_WIDTH - 15},${IMAGE_HEIGHT - 15}" stroke="#000000" stroke-width="2" fill="none"/>
          
          <path d="M ${IMAGE_WIDTH - 37},${IMAGE_HEIGHT - 37} Q ${IMAGE_WIDTH - 30},${IMAGE_HEIGHT - 40} ${IMAGE_WIDTH - 23},${IMAGE_HEIGHT - 37} Q ${IMAGE_WIDTH - 26},${IMAGE_HEIGHT - 30} ${IMAGE_WIDTH - 23},${IMAGE_HEIGHT - 23} Q ${IMAGE_WIDTH - 30},${IMAGE_HEIGHT - 26} ${IMAGE_WIDTH - 37},${IMAGE_HEIGHT - 23} Q ${IMAGE_WIDTH - 34},${IMAGE_HEIGHT - 30} ${IMAGE_WIDTH - 37},${IMAGE_HEIGHT - 37} Z" 
                fill="none" stroke="${accentColor}" stroke-width="1.5" opacity="0.6"/>
        </g>
        
        <!-- Celtic interlace pattern along top edge -->
        <path d="M 65,12 L 75,12 Q 80,12 80,17 L 80,23 Q 80,28 85,28 L 95,28" 
              stroke="#000000" stroke-width="1.5" fill="none"/>
        <path d="M 65,18 L 75,18 Q 78,18 78,21 L 78,25 Q 78,28 81,28 L 95,28" 
              stroke="${accentColor}" stroke-width="1" fill="none" opacity="0.6"/>
        
        <path d="M 105,12 L 115,12 Q 120,12 120,17 L 120,23 Q 120,28 125,28 L 135,28" 
              stroke="#000000" stroke-width="1.5" fill="none"/>
        <path d="M 145,12 L 155,12 Q 160,12 160,17 L 160,23 Q 160,28 165,28 L 175,28" 
              stroke="#000000" stroke-width="1.5" fill="none"/>
        <path d="M 185,12 L 195,12 Q 200,12 200,17 L 200,23 Q 200,28 205,28 L 215,28" 
              stroke="#000000" stroke-width="1.5" fill="none"/>
        <path d="M 225,12 L 235,12 Q 240,12 240,17 L 240,23 Q 240,28 245,28 L 255,28" 
              stroke="#000000" stroke-width="1.5" fill="none"/>
        
        <!-- Celtic interlace pattern along bottom edge -->
        <path d="M 65,${IMAGE_HEIGHT - 12} L 75,${IMAGE_HEIGHT - 12} Q 80,${IMAGE_HEIGHT - 12} 80,${IMAGE_HEIGHT - 17} L 80,${IMAGE_HEIGHT - 23} Q 80,${IMAGE_HEIGHT - 28} 85,${IMAGE_HEIGHT - 28} L 95,${IMAGE_HEIGHT - 28}" 
              stroke="#000000" stroke-width="1.5" fill="none"/>
        <path d="M 105,${IMAGE_HEIGHT - 12} L 115,${IMAGE_HEIGHT - 12} Q 120,${IMAGE_HEIGHT - 12} 120,${IMAGE_HEIGHT - 17} L 120,${IMAGE_HEIGHT - 23} Q 120,${IMAGE_HEIGHT - 28} 125,${IMAGE_HEIGHT - 28} L 135,${IMAGE_HEIGHT - 28}" 
              stroke="#000000" stroke-width="1.5" fill="none"/>
        <path d="M 145,${IMAGE_HEIGHT - 12} L 155,${IMAGE_HEIGHT - 12} Q 160,${IMAGE_HEIGHT - 12} 160,${IMAGE_HEIGHT - 17} L 160,${IMAGE_HEIGHT - 23} Q 160,${IMAGE_HEIGHT - 28} 165,${IMAGE_HEIGHT - 28} L 175,${IMAGE_HEIGHT - 28}" 
              stroke="#000000" stroke-width="1.5" fill="none"/>
        <path d="M 185,${IMAGE_HEIGHT - 12} L 195,${IMAGE_HEIGHT - 12} Q 200,${IMAGE_HEIGHT - 12} 200,${IMAGE_HEIGHT - 17} L 200,${IMAGE_HEIGHT - 23} Q 200,${IMAGE_HEIGHT - 28} 205,${IMAGE_HEIGHT - 28} L 215,${IMAGE_HEIGHT - 28}" 
              stroke="#000000" stroke-width="1.5" fill="none"/>
        <path d="M 225,${IMAGE_HEIGHT - 12} L 235,${IMAGE_HEIGHT - 12} Q 240,${IMAGE_HEIGHT - 12} 240,${IMAGE_HEIGHT - 17} L 240,${IMAGE_HEIGHT - 23} Q 240,${IMAGE_HEIGHT - 28} 245,${IMAGE_HEIGHT - 28} L 255,${IMAGE_HEIGHT - 28}" 
              stroke="#000000" stroke-width="1.5" fill="none"/>
        
        <!-- Side decorative elements -->
        <circle cx="12" cy="80" r="3" fill="#000000"/>
        <circle cx="12" cy="80" r="1.5" fill="${accentColor}"/>
        <circle cx="12" cy="120" r="3" fill="#000000"/>
        <circle cx="12" cy="120" r="1.5" fill="${accentColor}"/>
        <circle cx="12" cy="160" r="3" fill="#000000"/>
        <circle cx="12" cy="160" r="1.5" fill="${accentColor}"/>
        <circle cx="12" cy="200" r="3" fill="#000000"/>
        <circle cx="12" cy="200" r="1.5" fill="${accentColor}"/>
        <circle cx="12" cy="240" r="3" fill="#000000"/>
        <circle cx="12" cy="240" r="1.5" fill="${accentColor}"/>
        <circle cx="12" cy="280" r="3" fill="#000000"/>
        <circle cx="12" cy="280" r="1.5" fill="${accentColor}"/>
        <circle cx="12" cy="320" r="3" fill="#000000"/>
        <circle cx="12" cy="320" r="1.5" fill="${accentColor}"/>
        <circle cx="12" cy="360" r="3" fill="#000000"/>
        <circle cx="12" cy="360" r="1.5" fill="${accentColor}"/>
        
        <circle cx="${IMAGE_WIDTH - 12}" cy="80" r="3" fill="#000000"/>
        <circle cx="${IMAGE_WIDTH - 12}" cy="80" r="1.5" fill="${accentColor}"/>
        <circle cx="${IMAGE_WIDTH - 12}" cy="120" r="3" fill="#000000"/>
        <circle cx="${IMAGE_WIDTH - 12}" cy="120" r="1.5" fill="${accentColor}"/>
        <circle cx="${IMAGE_WIDTH - 12}" cy="160" r="3" fill="#000000"/>
        <circle cx="${IMAGE_WIDTH - 12}" cy="160" r="1.5" fill="${accentColor}"/>
        <circle cx="${IMAGE_WIDTH - 12}" cy="200" r="3" fill="#000000"/>
        <circle cx="${IMAGE_WIDTH - 12}" cy="200" r="1.5" fill="${accentColor}"/>
        <circle cx="${IMAGE_WIDTH - 12}" cy="240" r="3" fill="#000000"/>
        <circle cx="${IMAGE_WIDTH - 12}" cy="240" r="1.5" fill="${accentColor}"/>
        <circle cx="${IMAGE_WIDTH - 12}" cy="280" r="3" fill="#000000"/>
        <circle cx="${IMAGE_WIDTH - 12}" cy="280" r="1.5" fill="${accentColor}"/>
        <circle cx="${IMAGE_WIDTH - 12}" cy="320" r="3" fill="#000000"/>
        <circle cx="${IMAGE_WIDTH - 12}" cy="320" r="1.5" fill="${accentColor}"/>
        <circle cx="${IMAGE_WIDTH - 12}" cy="360" r="3" fill="#000000"/>
        <circle cx="${IMAGE_WIDTH - 12}" cy="360" r="1.5" fill="${accentColor}"/>`;
 
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
    svgContent += `<text x="${col2X}" y="${col2Y}" class="section">Purse</text>`;
    col2Y += 18;
    svgContent += `<text x="${col2X}" y="${col2Y}" class="text">${userData.coins} Coins</text>`;
    col2Y += 30;

    // Equipment Section (Column 1+2)
    svgContent += `<text x="${col1X}" y="${col2Y}" class="section">Active Equipment</text>`;
    col2Y += 18;
    for (const item of items) {
      if(item.skillBonus) {
        // Add emoji image spanning 2 lines
        if(item.emoji) {
          const base64Emoji = item.emoji.toString('base64');
          svgContent += `<image x="${col1X}" y="${col2Y - 11}" width="32" height="32" href="data:image/png;base64,${base64Emoji}"/>`;
        }
        svgContent += `<text x="${col1X + 36}" y="${col2Y}" class="text">${item.name}</text>`;
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
        svgContent += `<text x="${col1X + 36}" y="${col2Y}" class="text">${item.name}</text>`;
        col2Y += LINE_HEIGHT;
        svgContent += `<text x="${col1X + 36}" y="${col2Y}" class="text">X${item.professionBonus} ${professionNames[item.professionId - 1]}</text>`;
        col2Y += LINE_HEIGHT;
      }
      //col2Y += LINE_HEIGHT;
    }
    if(items.length <= 3) {
      const cursedItem = dbQuery.getCursedItem.get();
      const cursedEmoji = dbQuery.selectEmoji.pluck().get(cursedItem.emojiId);
      const base64Emoji = cursedEmoji.toString('base64');
      svgContent += `<image x="${col1X}" y="${col2Y - 11}" width="32" height="32" href="data:image/png;base64,${base64Emoji}"/>`;
      svgContent += `<text x="${col1X + 36}" y="${col2Y}" class="text">${cursedItem.name}</text>`;
      col2Y += LINE_HEIGHT;
      svgContent += `<text x="${col1X + 36}" y="${col2Y}" class="text">${cursedItem.bonusText}</text>`;
      col2Y += LINE_HEIGHT;
    };
   // col2Y += LINE_HEIGHT * 2 + 10;

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
        .setDescription('Display character statistics image')
        .setIntegrationTypes([ 'GuildInstall', 'UserInstall' ]),

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
        let guildId = interaction.guildId;
        try {
            // Get user data from database
            let userData = dbQuery.getUserData.get(userId, guildId);
            
            if (!userData) {
              userData = dbQuery.getUserDataRandom.get(userId);
              if (userData) {
                guildId = userData.guildId;
              } else {
                return interaction.reply({
                    content: 'No character found. Use `/character enroll` to create one first.',
                    flags: MessageFlags.Ephemeral
                });
              }
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
            const fileName = `${userData.displayName.replace(/[^a-zA-Z0-9\-_]/g, '')}_stats.png`;
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