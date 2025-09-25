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

// Image layout constants
const IMAGE_WIDTH = 800;
const IMAGE_HEIGHT = 1200;
const AVATAR_SIZE = 120;
const FONT_SIZE = 16;
const LINE_HEIGHT = 24;
const MARGIN = 20;
const SECTION_SPACING = 30;

// Update avatar if changed
const updateAvatarIfChanged = async (userId, guildId, currentAvatarURL) => {
    const currentFileName = currentAvatarURL.split('/').pop().split('?')[0];
    const user = db.prepare('SELECT avatarFile FROM users WHERE userId = ? AND guildId = ?').get(userId, guildId);
    
    if (!user || user.avatarFile !== currentFileName) {
        try {
            const response = await fetch(currentAvatarURL);
            if (response.ok) {
                const arrayBuffer = await response.arrayBuffer();
                const avatarBlob = Buffer.from(arrayBuffer);
                db.prepare('UPDATE users SET avatarFile = ?, avatar = ? WHERE userId = ? AND guildId = ?')
                  .run(currentFileName, avatarBlob, userId, guildId);
            }
        } catch (error) {
            console.error('Error updating avatar:', error, `userId:${userId}`);
        }
    }
};

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
    
    // Add avatar if available
    let avatarY = MARGIN;
    if (avatarBlob) {
      const processedAvatar = await sharp(avatarBlob)
        .resize(AVATAR_SIZE, AVATAR_SIZE)
        .png()
        .toBuffer();
      
      compositeLayers.push({
        input: processedAvatar,
        top: MARGIN,
        left: MARGIN,
      });
      avatarY = MARGIN + AVATAR_SIZE + 20;
    }

    // Build SVG text overlay
    let svgContent = `
      <svg width="${IMAGE_WIDTH}" height="${IMAGE_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
        <style>
          .title { font-family: Arial, sans-serif; font-size: 20px; font-weight: bold; fill: ${textColor}; }
          .header { font-family: Arial, sans-serif; font-size: 18px; font-weight: bold; fill: ${textColor}; }
          .text { font-family: Arial, sans-serif; font-size: ${FONT_SIZE}px; fill: ${textColor}; }
          .section { font-family: Arial, sans-serif; font-size: 17px; font-weight: bold; fill: ${textColor}; text-decoration: underline; }
        </style>`;

    let currentY = MARGIN;

    // Character Name and Domain (positioned next to avatar if present)
    if (avatarBlob) {
      svgContent += `
        <text x="${MARGIN + AVATAR_SIZE + 10}" y="${MARGIN + 20}" class="title">${userData.displayName}</text>
        <text x="${MARGIN + AVATAR_SIZE + 10}" y="${MARGIN + 40}" class="header">${domainData.name}</text>`;
      currentY = MARGIN + AVATAR_SIZE + 20;
    } else {
      svgContent += `
        <text x="${MARGIN}" y="${MARGIN + 20}" class="title">${userData.displayName}</text>
        <text x="${MARGIN}" y="${MARGIN + 40}" class="header">${domainData.name}</text>`;
      currentY = MARGIN + 60;
    }

    // Party information
    if (userData.partyName) {
      svgContent += `<text x="${MARGIN}" y="${currentY}" class="text">Party: ${userData.partyName}</text>`;
      currentY += LINE_HEIGHT + 5;
    }

    currentY += 15;

    // Overall Experience
    svgContent += `
      <text x="${MARGIN}" y="${currentY}" class="section">Overall Experience</text>
      <text x="${MARGIN}" y="${currentY + 20}" class="text">${userData.overallExp} XP</text>`;
    
    currentY += 45;

    // Professions Section
    svgContent += `<text x="${MARGIN}" y="${currentY}" class="section">Professions</text>`;
    currentY += 25;

    // Calculate ranks (you'll need to implement rank calculation based on your experience tables)
    const artisanRank = calculateRank(userData.artisanExp, 'artisan');
    const soldierRank = calculateRank(userData.soldierExp, 'soldier'); 
    const healerRank = calculateRank(userData.healerExp, 'healer');

    svgContent += `
      <text x="${MARGIN}" y="${currentY}" class="text">Artisan: ${artisanRank} (${userData.artisanExp} XP)</text>
      <text x="${MARGIN}" y="${currentY + LINE_HEIGHT}" class="text">Soldier: ${soldierRank} (${userData.soldierExp} XP)</text>
      <text x="${MARGIN}" y="${currentY + LINE_HEIGHT * 2}" class="text">Healer: ${healerRank} (${userData.healerExp} XP)</text>`;
    
    currentY += LINE_HEIGHT * 3 + 20;

    // Attributes Section
    svgContent += `<text x="${MARGIN}" y="${currentY}" class="section">Attributes</text>`;
    currentY += 25;

    // Calculate attribute levels from skills 1-6
    const skill1Level = calculateAttributeLevel(userData.skill1);
    const skill2Level = calculateAttributeLevel(userData.skill2);
    const skill3Level = calculateAttributeLevel(userData.skill3);
    const skill4Level = calculateAttributeLevel(userData.skill4);
    const skill5Level = calculateAttributeLevel(userData.skill5);
    const skill6Level = calculateAttributeLevel(userData.skill6);

    svgContent += `
      <text x="${MARGIN}" y="${currentY}" class="text">Skill 1: Level ${skill1Level} (${userData.skill1} XP)</text>
      <text x="${MARGIN}" y="${currentY + LINE_HEIGHT}" class="text">Skill 2: Level ${skill2Level} (${userData.skill2} XP)</text>
      <text x="${MARGIN}" y="${currentY + LINE_HEIGHT * 2}" class="text">Skill 3: Level ${skill3Level} (${userData.skill3} XP)</text>
      <text x="${MARGIN}" y="${currentY + LINE_HEIGHT * 3}" class="text">Skill 4: Level ${skill4Level} (${userData.skill4} XP)</text>
      <text x="${MARGIN}" y="${currentY + LINE_HEIGHT * 4}" class="text">Skill 5: Level ${skill5Level} (${userData.skill5} XP)</text>
      <text x="${MARGIN}" y="${currentY + LINE_HEIGHT * 5}" class="text">Skill 6: Level ${skill6Level} (${userData.skill6} XP)</text>`;
    
    currentY += LINE_HEIGHT * 6 + 20;

    // Treasure Section (Coins)
    svgContent += `<text x="${MARGIN}" y="${currentY}" class="section">Coins</text>`;
    currentY += 25;
    svgContent += `<text x="${MARGIN}" y="${currentY}" class="text">${userData.coins}</text>`;
    currentY += 35;

    // Equipment Section
    svgContent += `<text x="${MARGIN}" y="${currentY}" class="section">Equipment</text>`;
    currentY += 25;

    // You'll need to join with equipment tables to get names
    const armourName = getEquipmentName(userData.armourId, 'armour') || 'None';
    const weaponName = getEquipmentName(userData.weaponId, 'weapon') || 'None';

    svgContent += `
      <text x="${MARGIN}" y="${currentY}" class="text">Armour: ${armourName}</text>
      <text x="${MARGIN}" y="${currentY + LINE_HEIGHT}" class="text">Weapon: ${weaponName}</text>`;
    
    // Add bonus information if active
    currentY += LINE_HEIGHT * 2;
    
    const now = Math.floor(Date.now() / 1000);
    
    if (userData.armourBonusEnd > now) {
      const timeRemaining = formatTimeRemaining(userData.armourBonusEnd - now);
      svgContent += `<text x="${MARGIN + 10}" y="${currentY}" class="text">• Armour Bonus: +${userData.armourBonus} (${timeRemaining})</text>`;
      currentY += LINE_HEIGHT;
    }
    
    if (userData.weaponBonusEnd > now) {
      const timeRemaining = formatTimeRemaining(userData.weaponBonusEnd - now);
      svgContent += `<text x="${MARGIN + 10}" y="${currentY}" class="text">• Weapon Bonus: +${userData.weaponBonus} (${timeRemaining})</text>`;
      currentY += LINE_HEIGHT;
    }
    
    if (userData.healerBonusEnd > now) {
      const timeRemaining = formatTimeRemaining(userData.healerBonusEnd - now);
      svgContent += `<text x="${MARGIN + 10}" y="${currentY}" class="text">• Healer Bonus: x${userData.healerBonus} (${timeRemaining})</text>`;
      currentY += LINE_HEIGHT;
    }

    currentY += 20;

    // Relic Section
    svgContent += `<text x="${MARGIN}" y="${currentY}" class="section">Relics</text>`;
    currentY += 25;

    let hasRelics = false;
    
    if (userData.artisanBonusEnd > now) {
      const timeRemaining = formatTimeRemaining(userData.artisanBonusEnd - now);
      svgContent += `<text x="${MARGIN}" y="${currentY}" class="text">Artisan: x${userData.artisanBonus} multiplier (${timeRemaining})</text>`;
      currentY += LINE_HEIGHT;
      hasRelics = true;
    }
    
    if (userData.soldierBonusEnd > now) {
      const timeRemaining = formatTimeRemaining(userData.soldierBonusEnd - now);
      svgContent += `<text x="${MARGIN}" y="${currentY}" class="text">Soldier: x${userData.soldierBonus} multiplier (${timeRemaining})</text>`;
      currentY += LINE_HEIGHT;
      hasRelics = true;
    }
    
    if (!hasRelics) {
      svgContent += `<text x="${MARGIN}" y="${currentY}" class="text">None active</text>`;
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

// Helper functions - you'll need to implement these based on your game logic
function calculateRank(experience, profession) {
  // Implement rank calculation based on your experience tables
  // This is a placeholder - replace with your actual logic
  if (experience < 100) return 'Novice';
  if (experience < 500) return 'Apprentice';
  if (experience < 1000) return 'Journeyman';
  if (experience < 2000) return 'Expert';
  return 'Master';
}

function calculateAttributeLevel(experience) {
  // Implement attribute level calculation
  // This is a placeholder - replace with your actual logic
  return Math.floor(Math.sqrt(experience / 10)) + 1;
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
        .setDescription('Display character statistics image')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('View another user\'s stats (if allowed)')
                .setRequired(false)
        ),

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
        const targetUser = interaction.options.getUser('user') || interaction.user;
        const userId = targetUser.id;
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

            // Permission check for viewing other users
            if (userId !== interaction.user.id) {
                // Add your permission logic here if needed
                // For now, allow viewing any user's stats
            }

            // Update avatar if changed
            setTimeout(() => {
                updateAvatarIfChanged(userId, guildId, targetUser.displayAvatarURL({ size: 256 }));
            }, 0);

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