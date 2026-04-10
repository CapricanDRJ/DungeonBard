const { SlashCommandBuilder, MessageFlagsBitField, AttachmentBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
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
    `),
    getScoreboardTop5: db.prepare(`
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
        LIMIT 5
    `),
    getGainboardData: db.prepare(`
        SELECT 
            u.userId, 
            u.guildId, 
            u.displayName, 
            SUM(q.expGained) AS overallExp, -- Alias sum to match your old column name
            a.avatarBlob
        FROM questTracker q
        INNER JOIN users u ON q.userId = u.userId AND q.guildId = u.guildId
        LEFT JOIN avatars a ON u.userId = a.userId AND u.guildId = a.guildId
        WHERE q.guildId = ? 
        AND q.unixtime > (STRFTIME('%s', 'now') - ?)
        GROUP BY q.userId
        ORDER BY overallExp DESC
        LIMIT 5
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
const fontBase = 26;

const scoreboardMsg = new Map(); // Map to track the latest scoreboard message for each guild


async function autoPostScoreboard(client) {
    const guilds = Array.from(client.guilds.cache.values());
    const fortyEightHoursAgo = Date.now() - (48 * 60 * 60 * 1000);
console.log(`Starting scoreboard cycle for ${guilds.length} guild(s)...`);
    for (const guild of guilds) {
        const channel = guild.channels.cache.find(c => c.name === "📜-ledger-of-triumphs");
        if (!channel || !channel.isTextBased()) continue;
        const perms = channel.permissionsFor(guild.members.me);
        if (!perms || !perms.has([
            PermissionFlagsBits.ViewChannel, 
            PermissionFlagsBits.ReadMessageHistory
        ])) continue;
        const isValidScoreboard = (msg) => 
            msg.author.id === client.user.id &&
            msg.type === 0 &&
            !msg.interaction &&
            msg.createdTimestamp > fortyEightHoursAgo && 
            msg.embeds.length > 0;
            let lastMessage = scoreboardMsg.get(guild.id);
        try {
            if(lastMessage) {
                console.log(`[${guild.name}] Found cached message ${lastMessage.id}. Verifying...`);
                console.log(channel.lastMessageId, lastMessage.id);
            if(channel.lastMessageId !== lastMessage?.id) {
                lastMessage.delete().catch(err => console.error(`Failed to delete old message in ${guild.name}:`, err));
                scoreboardMsg.delete(guild.id);
                lastMessage = null;
            }
        } else {
            const fetchedMessages = await channel.messages.fetch({ limit: 50 });
            const scoreboardMessages = fetchedMessages.filter(isValidScoreboard);
            for (const [id, msg] of scoreboardMessages) {
                if (id !== channel.lastMessageId) {
                    await msg.delete().catch(err => console.error(`Failed to delete in ${guild.name}:`, err));
                } else {
                    lastMessage = msg;
                    scoreboardMsg.set(guild.id, lastMessage);
                }
            }
            console.log(`[${guild.name}] Found ${scoreboardMessages.size} recent scoreboard messages. Keeping ${lastMessage ? lastMessage.id : 'none'}.`);
        }
            // 5. Final Determination & Testing
            const displayTop5 = dbQuery.getScoreboardTop5.all(guild.id); // Get top users by overall XP
            const gainUsers = dbQuery.getGainboardData.all(guild.id, 48 * 60 * 60); // Get users with XP gained in last 48 hours
            if(displayTop5.length === 0) {
                console.log(`[${guild.name}] No users with XP found. Skipping scoreboard generation.`);
                continue;
            }
            const imageBuffer = await generateScoreboardImage(displayTop5, gainUsers);
            const attachment = new AttachmentBuilder(imageBuffer, { name: 'top5.png' });
            const embed = new EmbedBuilder()
                .setTitle('Ye Olde Scoreboard')
                .setImage('attachment://top5.png')
                .setColor(0x6b4423)
                .setTimestamp();
            const messagePayload = { embeds: [embed], files: [attachment] };
            //const messagePayload = await scoreboard(client, guild.id);
            if(!messagePayload) continue;
            try {
                if (lastMessage) {
                    console.log(`[${guild.name}] Action: EDITING message ${lastMessage.id} at ${Date.now()}`);
                    // Proper object notation for editing
                    await lastMessage.edit(messagePayload);
                } else {
                    console.log(`[${guild.name}] Action: SENDING NEW message at ${Date.now()}`);
                    // Proper object notation for sending
                    lastMessage = await channel.send(messagePayload).then;
                    scoreboardMsg.set(guild.id, lastMessage);
                }
            } catch (err) {
                console.error(`[${guild.name}] Failed to update scoreboard:`, err);
            }

        } catch (err) {
            console.error(`Error in ${guild.name}:`, err);
        }

        // Delay between guilds to stay under rate limits
        await new Promise(resolve => setTimeout(resolve, 10 * 1000));
    }

    // --- SELF-SCHEDULING ---
    // This schedules the function to run again in 10 minutes
    console.log("Cycle complete. Scheduling next run in 10 minutes...");
    setTimeout(() => autoPostScoreboard(client), 1 * 60 * 1000);
}

async function scoreboard(target, guildId, userId = false) {
        const userGen = userId === false ? false : true;
        let displayUsers;
        let highlightIndex;
        let startIndex = 0;
        //const guildId = '1339984756695371908';

        try {
            // Get all users with avatars in a single query
            const allUsers = dbQuery.getScoreboardData.all(guildId);
            if(userGen) {
                if (!allUsers || allUsers.length === 0) {
                    return target.reply({
                        content: 'No characters found in this server.',
                        flags: MessageFlags.Ephemeral
                    });
                }

                const callingUserIndex = allUsers.findIndex(u => u.userId === userId);
                
                if (callingUserIndex === -1) {
                    return target.reply({
                        content: 'No character found. Use `/character enroll` to create one first.',
                        flags: MessageFlags.Ephemeral
                    });
                }
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
            } else {
                // FALSE: Show strictly the Top 10
                displayUsers = allUsers.slice(0, 12);
                highlightIndex = -1; // Don't highlight anyone
            }

            // Generate scoreboard image
            const imageBuffer = await generateScoreboardImage(displayUsers, false, highlightIndex + 1, startIndex + 1);
            const attachment = new AttachmentBuilder(imageBuffer, { name: 'scoreboard.png' });
            const embed = new EmbedBuilder()
                .setTitle('Top Characters by Experience')
                .setImage('attachment://scoreboard.png')
                .setColor(0x6b4423)
                .setTimestamp();

            if(!userGen) {
                return { embeds: [embed], files: [attachment] };
            } else {
                return target.reply({
                    embeds: [embed],
                    files: [attachment]
                })
            }

        } catch (error) {
            console.error('Error executing scoreboard command:', error, `userId:${userId}`, `guildId:${guildId}`);
            if(userGen) return target.reply({
                content: 'An error occurred while generating the scoreboard.',
                flags: MessageFlags.Ephemeral
            });
        }
    }
async function generateScoreboardImage(users, gainUsers, highlightIndex, rank = 1) {
    try {
        const metadata = await scoreImageBuffer.metadata();
        const bgWidth = metadata.width;
        const bgHeight = metadata.height;
        const canvas = scoreImageBuffer.clone();
        
        // Calculate how many rows fit strictly inside the playable area
        const availableHeight = bgHeight - HEADER_OFFSET - BOTTOM_MARGIN;
        const maxCapacity = Math.floor(availableHeight / ROW_HEIGHT);
        const maxAllowed = gainUsers ? Math.max(0, maxCapacity/2) : Math.max(0, maxCapacity);
        // Trim the list of users so it never draws past the bottom border
        if (users.length > maxAllowed) {
            users = users.slice(0, maxAllowed);
        }
        const userLength = users.length;

        if (gainUsers) {
            if (gainUsers.length > maxAllowed) {
                gainUsers = gainUsers.slice(0, maxAllowed);
            }
            users = users.concat(gainUsers);
        }
        
        const compositeLayers = [];
        
        let svgContent = `
            <svg width="${bgWidth}" height="${bgHeight}" xmlns="http://www.w3.org/2000/svg">
                <style>
                    /* You can change fill colors here to better match the dark brown ink of your borders */
                    .title { font-family: 'MedievalSharp', serif; font-size: ${fontBase + 5}px; font-weight: bold; fill: #312520; }
                    .h2 { font-family: 'MedievalSharp', serif; font-size: ${fontBase + 3}px; font-weight: bold; fill: #312520; }
                    .name { font-family: 'MedievalSharp', serif; font-size: ${fontBase}px; fill: #312520; }
                    .xp { font-family: 'MedievalSharp', serif; font-size: ${fontBase + 2}px; fill: #4a3520; }
                    .rank { font-family: 'MedievalSharp', serif; font-size: ${fontBase + 2}px; font-weight: bold; fill: #6b4423; }
                    .highlight { font-family: 'MedievalSharp', serif; font-size: ${fontBase + 2}px; font-weight: bold; fill: #1a0f0a; }
                </style>
                
                <text x="${bgWidth / 2}" y="${TITLE_Y}" text-anchor="middle" class="title">Annals of Erudition</text>
        `;
        
        // Add each user row
        let i = 0;
        let plus = '';

        const rowWidth = bgWidth - BORDER_LEFT - BORDER_RIGHT;
        for (const user of users) {
            const gainOffset = (i >= userLength) ? ROW_HEIGHT : 0;
            const y = HEADER_OFFSET + (i * ROW_HEIGHT) + gainOffset;
            const isHighlighted = (rank === highlightIndex);
            if(rank === userLength+1) {
                rank = 1;
                plus = '+';
                svgContent += `<text x="${bgWidth / 2}" y="${y + 30 - gainOffset}" text-anchor="middle" class="h2">Folios of Renown</text>`;
            };

              //  
        
            // Highlight background for calling user
            if (isHighlighted) {
                svgContent += `<rect x="${BORDER_LEFT}" y="${y}" width="${rowWidth}" height="${ROW_HEIGHT - 10}" fill="#d4c4a8" opacity="0.5" rx="5"/>`;
            }

            // Rank number
            svgContent += `<text x="${BORDER_LEFT + 10}" y="${y + 32}" class="rank">${rank}.</text>`;
            
            // Name (Offset to leave room for the avatar)
            const textClass = isHighlighted ? 'highlight' : 'name';
            svgContent += `<text x="${BORDER_LEFT + 55 + AVATAR_SIZE}" y="${y + 30}" class="${textClass}">${user.displayName}</text>`;
            
            // XP (Right-Aligned against the right border!)
            svgContent += `<text x="${bgWidth - BORDER_RIGHT - 15}" y="${y + 30}" text-anchor="end" class="xp">${plus}${user.overallExp.toLocaleString()} XP</text>`;
            
            // Separator line (except for last entry)
            if (i < users.length - 1 && i !== userLength - 1) {
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
                const gainOffset = i >= userLength ? ROW_HEIGHT : 0;
                
                const y = HEADER_OFFSET + (i * ROW_HEIGHT) + gainOffset;
                
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
        setTimeout(() => autoPostScoreboard(client), 10000);
    },

    executeCommand: async (interaction) => {
        const userId = interaction.user.id;
        const guildId = interaction.guildId;
        scoreboard(interaction, guildId, userId);
    }
};