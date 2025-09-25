const { SlashCommandBuilder, MessageFlagsBitField, AttachmentBuilder } = require('discord.js');
const sqlite3 = require('better-sqlite3');
const db = new sqlite3('db/dungeonbard.db');
const sharp = require('sharp');
const MessageFlags = MessageFlagsBitField.Flags;

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
  SELECT domainId, skillId, domain, skillName, skillAbbrv, skillDesc
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
  };
}
return attrObj;
})();

// Image layout constants
const IMAGE_WIDTH = 400;
const IMAGE_HEIGHT = 600;
const AVATAR_SIZE = 64;
const FONT_SIZE = 12;
const LINE_HEIGHT = 16;
const MARGIN = 10;
const COLUMN_WIDTH = (IMAGE_WIDTH - MARGIN * 3) / 2; // Two columns with margins

async function generateCharacterImage(userData, domainData, avatarBlob = null) {
  try {
    // Create base canvas with domain background color
    const canvas = sharp({
      create: {
        width: IMAGE_WIDTH,
        height: IMAGE_HEIGHT,
        channels: 4,
        background: { r: (domainData.background >> 16) & 255, g: (domainData.background >> 8) & 255, b: domainData.background & 255, alpha: 1 }
      }
    });

    const compositeLayers = [];
    const textColor = `#${domainData.text.toString(16).padStart(6, '0')}`;
    
    // Add avatar if available (Column 1)
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

    // Build SVG text overlay
    let svgContent = `
      <svg width="${IMAGE_WIDTH}" height="${IMAGE_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
        <style>
          .title { font-family: Arial, sans-serif; font-size: 14px; font-weight: bold; fill: ${textColor}; }
          .header { font-family: Arial, sans-serif; font-size: 12px; font-weight: bold; fill: ${textColor}; }
          .text { font-family: Arial, sans-serif; font-size: ${FONT_SIZE}px; fill: ${textColor}; }
          .section { font-family: Arial, sans-serif; font-size: 13px; font-weight: bold; fill: ${textColor}; text-decoration: underline; }
        </style>`;

    // Column 1: Avatar and Attributes (left side)
    const col1X = MARGIN;
    let col1Y = MARGIN + AVATAR_SIZE + 30;

    // Column 2: Name and everything else (right side)  
    const col2X = MARGIN * 2 + COLUMN_WIDTH;
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

    const artisanRank = calculateRank(userData.artisanExp, 'artisan');
    const soldierRank = calculateRank(userData.soldierExp, 'soldier'); 
    const healerRank = calculateRank(userData.healerExp, 'healer');

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

    // Equipment Section (Column 2)
    svgContent += `<text x="${col2X}" y="${col2Y}" class="section">Equipment</text>`;
    col2Y += 18;

    const armourName = getEquipmentName(userData.armourId, 'armour') || 'None';
    const weaponName = getEquipmentName(userData.weaponId, 'weapon') || 'None';

    svgContent += `
      <text x="${col2X}" y="${col2Y}" class="text">Armour: ${armourName}</text>
      <text x="${col2X}" y="${col2Y + LINE_HEIGHT}" class="text">Weapon: ${weaponName}</text>`;
    
    col2Y += LINE_HEIGHT * 2 + 10;

    // Attributes Section (Column 1)
    svgContent += `<text x="${col1X}" y="${col1Y}" class="section">Attributes</text>`;
    col1Y += 18;

    // Calculate attribute levels from skills 1-6 using proper database lookups
    const skill1Level = calculateAttributeLevel(userData.skill1, 1);
    const skill2Level = calculateAttributeLevel(userData.skill2, 2);
    const skill3Level = calculateAttributeLevel(userData.skill3, 3);
    const skill4Level = calculateAttributeLevel(userData.skill4, 4);
    const skill5Level = calculateAttributeLevel(userData.skill5, 5);
    const skill6Level = calculateAttributeLevel(userData.skill6, 6);

    // Get proper attribute names based on domain
    const skill1Name = getAttributeName(1, userData.domainId);
    const skill2Name = getAttributeName(2, userData.domainId);
    const skill3Name = getAttributeName(3, userData.domainId);
    const skill4Name = getAttributeName(4, userData.domainId);
    const skill5Name = getAttributeName(5, userData.domainId);
    const skill6Name = getAttributeName(6, userData.domainId);

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

    // Add text overlay to composite layers
    compositeLayers.push({
      input: Buffer.from(svgContent),
      top: 0,
      left: 0
    });

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
function calculateRank(experience, profession) {
  // Implement rank calculation based on your experience tables
  // This is a placeholder - replace with your actual logic
  if (experience < 100) return 'Novice';
  if (experience < 500) return 'Apprentice';
  if (experience < 1000) return 'Journeyman';
  if (experience < 2000) return 'Expert';
  return 'Master';
}

function calculateAttributeLevel(experience, skillId) {
  // Query the attributeLevels table to get the correct level
  const levelData = db.prepare(`
    SELECT level FROM attributeLevels 
    WHERE skillId = ? AND exp <= ? 
    ORDER BY exp DESC 
    LIMIT 1
  `).get(skillId, experience);
  
  return levelData ? levelData.level : 1;
}

function getAttributeName(skillId, domainId) {
  // Query the attributes table to get skill name and abbreviation
  const attr = db.prepare(`
    SELECT skillName, skillAbbrv FROM attributes 
    WHERE skillId = ? AND domainId = ?
  `).get(skillId, domainId);
  
  return attr ? `${attr.skillAbbrv} (${attr.skillName})` : `Skill ${skillId}`;
}

function getEquipmentName(equipmentId, type) {
  // You'll need to query your equipment tables here
  // This is a placeholder - replace with actual database query
  if (equipmentId === 0) return null;
  
  // Example query (you'll need to implement):
  // const equipment = db.prepare('SELECT name FROM equipment WHERE id = ? AND type = ?').get(equipmentId, type);
  // return equipment?.name || null;
  
  return `${type} ${equipmentId}`; // Placeholder
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
            const userData = db.prepare('SELECT * FROM users WHERE userId = ? AND guildId = ?').get(userId, guildId);
            
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

            // Generate character image
            const imageBuffer = await generateCharacterImage(userData, domainData, userData.avatar);
            const fileName = `${userData.displayName}-stats.png`;
            const attachment = new AttachmentBuilder(imageBuffer, { name: fileName });

            interaction.reply({
                embeds: [{
                    color: domainData.background,
                    image: { url: `attachment://${fileName}` }
                }],
                files: [attachment]
            });

        } catch (error) {
            console.error('Error executing stats command:', error, `userId:${userId}`);
            interaction.reply({
                content: 'An error occurred while generating your stats image.',
                flags: MessageFlags.Ephemeral
            });
        }
    }
};