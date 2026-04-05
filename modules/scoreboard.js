const { SlashCommandBuilder, MessageFlagsBitField, AttachmentBuilder, EmbedBuilder } = require('discord.js');
const sqlite3 = require('better-sqlite3');
const db = new sqlite3('db/dungeonbard.db');
const sharp = require('sharp');
const MessageFlags = MessageFlagsBitField.Flags;
const fs = require('fs');
const bgBuffer = fs.readFileSync('./assets/scoreboard.png');
const scoreImageBuffer = sharp(bgBuffer);

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
// Image layout boundaries (Adjust these to perfectly fit your background!)
const AVATAR_SIZE = 32;
const ROW_HEIGHT = 55;
const BORDER_LEFT = 60;    // Pushes content past the left Celtic knot border
const BORDER_RIGHT = 60;   // Prevents content from drawing over the right border
const HEADER_OFFSET = 140; // Starts the player list below the top banner
const BOTTOM_MARGIN = 60;  // Stops the list before hitting the bottom border
const TITLE_Y = 75;        // Centers the "Scoreboard" text vertically in the ribbon
const userGen = false;
const fontBase = 24;

async function generateScoreboardImage(users, highlightIndex, rank = 1) {
    try {
        const metadata = await scoreImageBuffer.metadata();
        const bgWidth = metadata.width;
        const bgHeight = metadata.height;
        const canvas = scoreImageBuffer.clone();
        
        // Calculate how many rows fit strictly inside the playable area
        const availableHeight = bgHeight - HEADER_OFFSET - BOTTOM_MARGIN;
        const maxCapacity = Math.floor(availableHeight / ROW_HEIGHT);
        const maxAllowed = Math.max(0, maxCapacity); 
        console.log(maxAllowed, users.length);

        // Trim the list of users so it never draws past the bottom border
        if (users.length > maxAllowed) {
            users = users.slice(0, maxAllowed);
        }
        
        const compositeLayers = [];
        
        let svgContent = `
            <svg width="${bgWidth}" height="${bgHeight}" xmlns="http://www.w3.org/2000/svg">
                <style>
                    /* You can change fill colors here to better match the dark brown ink of your borders */
                    .title { font-family: 'MedievalSharp', serif; font-size: ${fontBase + 10}px; font-weight: bold; fill: #312520; }
                    .name { font-family: 'MedievalSharp', serif; font-size: ${fontBase}px; fill: #312520; }
                    .xp { font-family: 'MedievalSharp', serif; font-size: ${fontBase + 2}px; fill: #4a3520; }
                    .rank { font-family: 'MedievalSharp', serif; font-size: ${fontBase + 2}px; font-weight: bold; fill: #6b4423; }
                    .highlight { font-family: 'MedievalSharp', serif; font-size: ${fontBase + 2}px; font-weight: bold; fill: #1a0f0a; }
                </style>
                
                <text x="${bgWidth / 2}" y="${TITLE_Y}" text-anchor="middle" class="title">Scoreboard</text>
        `;
        
        // Add each user row
        let i = 0;
        const rowWidth = bgWidth - BORDER_LEFT - BORDER_RIGHT;

        for (const user of users) {
            const y = HEADER_OFFSET + (i * ROW_HEIGHT);
            const isHighlighted = (rank === highlightIndex);
            
            // Highlight background for calling user
            if (isHighlighted) {
                svgContent += `<rect x="${BORDER_LEFT}" y="${y}" width="${rowWidth}" height="${ROW_HEIGHT - 10}" fill="#d4c4a8" opacity="0.5" rx="5"/>`;
            }
            
            // Rank number
            svgContent += `<text x="${BORDER_LEFT + 10}" y="${y + 32}" class="rank">#${rank}</text>`;
            
            // Name (Offset to leave room for the avatar)
            const textClass = isHighlighted ? 'highlight' : 'name';
            svgContent += `<text x="${BORDER_LEFT + 55 + AVATAR_SIZE}" y="${y + 30}" class="${textClass}">${user.displayName}</text>`;
            
            // XP (Right-Aligned against the right border!)
            svgContent += `<text x="${bgWidth - BORDER_RIGHT - 15}" y="${y + 30}" text-anchor="end" class="xp">${user.overallExp.toLocaleString()} XP</text>`;
            
            // Separator line (except for last entry)
            if (i < users.length - 1) {
                svgContent += `<line x1="${BORDER_LEFT}" y1="${y + 50}" x2="${bgWidth - BORDER_RIGHT}" y2="${y + 50}" stroke="#d4c4a8" stroke-width="1"/>`;
            }
            rank++;
            i++;
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
                
                const y = HEADER_OFFSET + (i * ROW_HEIGHT);
                
                compositeLayers.push({
                    input: processedAvatar,
                    top: Math.floor(y + 8), // Pushed down slightly to center align with the text
                    left: Math.floor(BORDER_LEFT + 45) // Placed right after the # Rank
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
        //const guildId = '1339984756695371908';

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
            
            // If userGen is true, enforce that the user must have a character
            if (userGen && callingUserIndex === -1) {
                return interaction.reply({
                    content: 'No character found. Use `/character enroll` to create one first.',
                    flags: MessageFlags.Ephemeral
                });
            }

            let displayUsers;
            let highlightIndex;
            let startIndex = 0;

            if (!userGen) {
                // FALSE: Show strictly the Top 10
                displayUsers = allUsers.slice(0, 12);
                
                // Highlight the user only if they actually exist and are in the top 10
                if (callingUserIndex !== -1 && callingUserIndex < 12) {
                    highlightIndex = callingUserIndex;
                } else {
                    highlightIndex = -1; // Don't highlight anyone
                }
            } else {
                // TRUE: Dynamic windowing based on user's rank
                const userRank = callingUserIndex + 1;
                
                if (userRank <= 12) {
                    displayUsers = allUsers.slice(0, 12);
                    highlightIndex = callingUserIndex;
                } else {
                    // User is outside top 10, show 5 before and 4 after (10 total with user)
                    startIndex = Math.max(0, callingUserIndex - 5);
                    const endIndex = Math.min(allUsers.length, callingUserIndex + 4);
                    displayUsers = allUsers.slice(startIndex, endIndex);
                    highlightIndex = callingUserIndex - startIndex;
                }
            }

            // Generate scoreboard image
            const imageBuffer = await generateScoreboardImage(displayUsers, highlightIndex + 1, startIndex + 1);
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