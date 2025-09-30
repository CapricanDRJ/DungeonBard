const { SlashCommandBuilder, MessageFlagsBitField, AttachmentBuilder, EmbedBuilder } = require('discord.js');
const sqlite3 = require('better-sqlite3');
const db = new sqlite3('db/dungeonbard.db');
const sharp = require('sharp');
const MessageFlags = MessageFlagsBitField.Flags;

const dbQuery = {
    getScoreboardData: db.prepare(`
        SELECT 
            u.userId, 
            u.guildId, 
            u.displayName, 
            u.overallExp,
            a.avatarBlob
        FROM users u
        LEFT JOIN avatars a ON u.userId = a.userId AND u.guildId = a.guildId
        WHERE u.guildId = ?
        ORDER BY u.overallExp DESC
    `)
};

// Image layout constants
const AVATAR_SIZE = 16;
const ROW_HEIGHT = 60;
const MARGIN = 20;
const NAME_OFFSET_X = AVATAR_SIZE + 15;
const XP_OFFSET_X = 200;
const IMAGE_WIDTH = 350;

async function generateScoreboardImage(users, highlightIndex, startRank = 1) {
    try {
        const imageHeight = MARGIN * 2 + (users.length * ROW_HEIGHT);
        
        // Create base canvas
        const canvas = sharp({
            create: {
                width: IMAGE_WIDTH,
                height: imageHeight,
                channels: 4,
                background: { r: 235, g: 220, b: 195, alpha: 1 }
            }
        });

        const compositeLayers = [];
        
        // Build SVG with borders and text
        let svgContent = `
            <svg width="${IMAGE_WIDTH}" height="${imageHeight}" xmlns="http://www.w3.org/2000/svg">
                <style>
                    .title { font-family: 'MedievalSharp', serif; font-size: 20px; font-weight: bold; fill: #2c1810; }
                    .name { font-family: 'MedievalSharp', serif; font-size: 14px; fill: #2c1810; }
                    .xp { font-family: 'MedievalSharp', serif; font-size: 14px; fill: #4a3520; }
                    .rank { font-family: 'MedievalSharp', serif; font-size: 16px; font-weight: bold; fill: #6b4423; }
                    .highlight { font-family: 'MedievalSharp', serif; font-size: 14px; font-weight: bold; fill: #2c1810; }
                </style>
                
                <!-- Parchment background -->
                <rect x="0" y="0" width="${IMAGE_WIDTH}" height="${imageHeight}" fill="#ebe4c3"/>
                
                <!-- Border -->
                <rect x="5" y="5" width="${IMAGE_WIDTH - 10}" height="${imageHeight - 10}" 
                      fill="none" stroke="#000000" stroke-width="2"/>
                <rect x="8" y="8" width="${IMAGE_WIDTH - 16}" height="${imageHeight - 16}" 
                      fill="none" stroke="#6b4423" stroke-width="1"/>
                
                <!-- Title -->
                <text x="${IMAGE_WIDTH / 2}" y="30" text-anchor="middle" class="title">Scoreboard</text>
                <line x1="20" y1="40" x2="${IMAGE_WIDTH - 20}" y2="40" stroke="#6b4423" stroke-width="1"/>
        `;

        // Add each user row
        for (let i = 0; i < users.length; i++) {
            const user = users[i];
            const y = MARGIN + 35 + (i * ROW_HEIGHT);
            const isHighlighted = i === highlightIndex;
            const actualRank = startRank + i;
            
            // Highlight background for calling user
            if (isHighlighted) {
                svgContent += `<rect x="10" y="${y}" width="${IMAGE_WIDTH - 20}" height="${ROW_HEIGHT - 10}" fill="#d4c4a8" opacity="0.5" rx="5"/>`;
            }
            
            // Rank number
            svgContent += `<text x="15" y="${y + 30}" class="rank">#${actualRank}</text>`;
            
            // Name and XP - use highlight class if it's the calling user
            const textClass = isHighlighted ? 'highlight' : 'name';
            svgContent += `
                <text x="${NAME_OFFSET_X + 40}" y="${y + 28}" class="${textClass}">${user.displayName}</text>
                <text x="${XP_OFFSET_X}" y="${y + 28}" class="xp">${user.overallExp.toLocaleString()} XP</text>
            `;
            
            // Separator line (except for last entry)
            if (i < users.length - 1) {
                svgContent += `<line x1="20" y1="${y + 50}" x2="${IMAGE_WIDTH - 20}" y2="${y + 50}" stroke="#d4c4a8" stroke-width="1"/>`;
            }
        }

        svgContent += '</svg>';
        
        compositeLayers.push({
            input: Buffer.from(svgContent),
            top: 0,
            left: 0
        });

        // Add avatars
        for (let i = 0; i < users.length; i++) {
            const user = users[i];
            
            if (user.avatarBlob) {
                const processedAvatar = await sharp(user.avatarBlob)
                    .resize(AVATAR_SIZE, AVATAR_SIZE)
                    .png()
                    .toBuffer();
                
                const y = MARGIN + 35 + (i * ROW_HEIGHT);
                
                compositeLayers.push({
                    input: processedAvatar,
                    top: y,
                    left: NAME_OFFSET_X
                });
            }
        }

        // Generate final image
        const finalBuffer = await canvas
            .composite(compositeLayers)
            .png({ compressionLevel: 1 })
            .toBuffer();

        return finalBuffer;
    } catch (error) {
        throw new Error(`Scoreboard image generation failed: ${error.message}`);
    }
}

module.exports = {
    commandData: new SlashCommandBuilder()
        .setName('scoreboard')
        .setDescription('Display top characters by overall XP')
        .setIntegrationTypes(['GuildInstall']),

    allowedButtons: [],

    handleInteraction: async (client, interaction) => {
        if (interaction.isCommand() && interaction.commandName === 'scoreboard') {
            module.exports.executeCommand(interaction);
        }
    },

    main: (client) => {
        console.log("Slash commands for scoreboard module have been loaded.");
    },

    executeCommand: async (interaction) => {
        const userId = interaction.user.id;
        const guildId = interaction.guildId;

        try {
            // Get all users with avatars in a single query
            const allUsers = dbQuery.getScoreboardData.all(guildId);
            
            if (!allUsers || allUsers.length === 0) {
                return interaction.reply({
                    content: 'No characters found in this server.',
                    flags: MessageFlags.Ephemeral
                });
            }

            // Find calling user's rank
            const callingUserIndex = allUsers.findIndex(u => u.userId === userId);
            
            if (callingUserIndex === -1) {
                return interaction.reply({
                    content: 'No character found. Use `/character enroll` to create one first.',
                    flags: MessageFlags.Ephemeral
                });
            }

            const userRank = callingUserIndex + 1;
            let displayUsers;
            let highlightIndex;

            // If user is in top 20, show top 20 with user at their position
            if (userRank <= 20) {
                displayUsers = allUsers.slice(0, 20);
                highlightIndex = callingUserIndex;
            } else {
                // User is outside top 20, center them in the middle (position 10)
                displayUsers = allUsers.slice(0, 10);
                displayUsers.push(allUsers[callingUserIndex]);
                highlightIndex = 10;
            }

            // Generate scoreboard image
            const imageBuffer = await generateScoreboardImage(displayUsers, highlightIndex, userRank);
            const attachment = new AttachmentBuilder(imageBuffer, { name: 'scoreboard.png' });
            const embed = new EmbedBuilder()
                .setTitle('Top Characters by Experience')
                .setImage('attachment://scoreboard.png')
                .setColor(0x6b4423)
                .setTimestamp();

            interaction.reply({
                embeds: [embed],
                files: [attachment]
            });
        } catch (error) {
            console.error('Error executing scoreboard command:', error, `userId:${userId}`, `guildId:${guildId}`);
            interaction.reply({
                content: 'An error occurred while generating the scoreboard.',
                flags: MessageFlags.Ephemeral
            });
        }
    }
};