const { SlashCommandBuilder, MessageFlagsBitField, EmbedBuilder } = require('discord.js');
const sqlite3 = require('better-sqlite3');
const db = new sqlite3('db/dungeonbard.db');
const MessageFlags = MessageFlagsBitField.Flags;

const dbQuery = {
    getUserData: db.prepare('SELECT * FROM users WHERE userId = ? AND guildId = ?'),
    insertUser: db.prepare(`INSERT OR REPLACE INTO users (userId, guildId, displayName, avatarFile, domainId) VALUES (?, ?, ?, ?, ?)`),
    insertAvatarBlob: db.prepare(`INSERT OR REPLACE INTO avatars (userId, guildId, avatarBlob) VALUES (?, ?, ?)`),
    confirmExistingUser: db.prepare('SELECT 1 FROM users WHERE userId = ? AND guildId = ? LIMIT 1'),
    getDisplayName: db.prepare('SELECT displayName FROM users WHERE userId = ? AND guildId = ?'),
    updateDisplayName: db.prepare('UPDATE users SET displayName = ? WHERE userId = ? AND guildId = ?'),
    deleteUser: db.prepare('DELETE FROM users WHERE userId = ? AND guildId = ?'),
    resetUser: db.prepare(`UPDATE users SET domainId = ?, artisanExp = 0, soldierExp = 0, healerExp = 0, skill1 = 0, skill2 = 0, skill3 = 0, skill4 = 0, skill5 = 0, skill6 = 0, coins = 0 WHERE userId = ? AND guildId = ?`),
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

module.exports = {
    commandData: new SlashCommandBuilder()
        .setName('character')
        .setDescription('Manage character progression')
        .addSubcommand(subcommand =>
            subcommand
                .setName('enroll')
                .setDescription('Create a character')
                .addIntegerOption(option =>
                    option.setName('domain')
                        .setDescription('Select your starting domain level')
                        .setRequired(true)
                        .addChoices(
                            ...db.prepare('SELECT id, title FROM domains ORDER BY id').all().map(domain => ({ name: domain.title, value: domain.id }))
                        )
                )
                .addStringOption(option =>
                    option.setName('name')
                        .setDescription('Enter your character name')
                        .setRequired(false)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('restart')
                .setDescription('Restart progress in current domain')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('graduate')
                .setDescription('Graduate and advance to next domain level')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('delete')
                .setDescription('Delete your character data')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('rename')
                .setDescription('Change your character name')
                .addStringOption(option =>
                    option.setName('name')
                        .setDescription('Enter your new character name')
                        .setRequired(true)
                )
        ),

    allowedButtons: [],

    handleInteraction: async (client, interaction) => {
        if (interaction.isCommand() && interaction.commandName === 'character') {
            module.exports.executeCommand(interaction);
        }
    },

    main: (client) => {
        console.log("Slash commands for character module have been loaded.");
    },

    executeCommand: async (interaction) => {
        const userId = interaction.user.id;
        const guildId = interaction.guildId;
        const subcommand = interaction.options.getSubcommand();

        try {
            switch (subcommand) {
                case 'enroll':
                    let displayName = interaction.options.getString('name');
                    const domainId = interaction.options.getInteger('domain');

                    // Check if user already exists
                    const existingUser = dbQuery.confirmExistingUser.get(userId, guildId);
                    if(displayName === null || displayName.trim() === '') {
                        displayName = interaction.member?.nick || 
                        interaction.user.displayName || interaction.user.globalName || interaction.user.username;
                    }
                    if (existingUser) {
                        interaction.reply({
                            content: 'You already have a character enrolled. Use `/character delete` first if you want to create a new one.',
                            flags: MessageFlags.Ephemeral
                        });
                        return;
                    }

                    setTimeout(async () => {
                        // Get avatar data
                        const avatarURL = interaction.user.displayAvatarURL()
                        .replace(/\/a_/, '/')
                        .replace(/\.[a-zA-Z]{3,4}$/, '')
                        + '.png?size=64';

                        const avatarFileName = avatarURL.split('/').pop().split('?')[0];
                        let avatarBlob = null;

                        try {
                            const response = await fetch(avatarURL);
                            if (response.ok) {
                                const arrayBuffer = await response.arrayBuffer();
                                avatarBlob = await sharp(Buffer.from(arrayBuffer))
                                    .composite([{
                                        input: Buffer.from(`<svg width="64" height="64"><circle cx="32" cy="32" r="32" fill="white"/></svg>`),
                                        blend: 'dest-in'
                                    }])
                                    .png()
                                    .toBuffer();
                            }
                        } catch (error) {
                            console.error('Error downloading avatar:', error, `userId:${userId}`);
                        }
                        dbQuery.insertUser.run(userId, guildId, displayName, avatarFileName, domainId);
                        dbQuery.insertAvatarBlob.run(userId, guildId, avatarBlob);
                    }, 0);

                    interaction.reply({
                        content: `Character "${displayName}" successfully enrolled as ${domains[domainId].name}!`,
                        flags: MessageFlags.Ephemeral
                    });
                    break;

                case 'restart':
                    const restartUser = dbQuery.getUserData.get(userId, guildId);
                    
                    if (!restartUser) {
                        return interaction.reply({
                            content: 'No character found. Use `/character enroll` to create one first.',
                            flags: MessageFlags.Ephemeral
                        });
                    }

                    setTimeout(() => {
                        dbQuery.resetUser.run(userId, guildId);
                    }, 0);

                    interaction.reply({
                        content: `Character "${restartUser.displayName}" has restarted as ${domains[restartUser.domainId].name}.`,
                        flags: MessageFlags.Ephemeral
                    });
                    break;

                case 'graduate':
                    const graduateUser = dbQuery.getUserData.get(userId, guildId);
                    
                    if (!graduateUser) {
                        interaction.reply({
                            content: 'No character found. Use `/character enroll` to create one first.',
                            flags: MessageFlags.Ephemeral
                        });
                        return;
                    }

                    if (graduateUser.domainId >= 6) {
                        interaction.reply({
                            content: 'You are already at the highest domain level (The Sage). Use `/character restart` instead.',
                            flags: MessageFlags.Ephemeral
                        });
                        return;
                    }

                    const newDomainId = graduateUser.domainId + 1;

                    setTimeout(() => {
                        dbQuery.resetUser.run(newDomainId, userId, guildId);
                    }, 0);

                    interaction.reply({
                        content: `Character "${graduateUser.displayName}" has graduated to ${domains[newDomainId].name}!`,
                        flags: MessageFlags.Ephemeral
                    });
                    break;

                case 'delete':
                    const userToDelete = dbQuery.getDisplayName.get(userId, guildId);
                    
                    if (!userToDelete) {
                        interaction.reply({
                            content: 'No character found to delete.',
                            flags: MessageFlags.Ephemeral
                        });
                        return;
                    }

                    setTimeout(() => {
                        dbQuery.deleteUser.run(userId, guildId);
                    }, 0);

                    interaction.reply({
                        content: `Character "${userToDelete.displayName}" has been deleted.`,
                        flags: MessageFlags.Ephemeral
                    });
                    break;

                case 'stats':
                    const statsUser = dbQuery.getUserData.get(userId, guildId);
                    
                    if (!statsUser) {
                        interaction.reply({
                            content: 'No character found. Use `/character enroll` to create one first.',
                            flags: MessageFlags.Ephemeral
                        });
                        return;
                    }

                    const domain = domains[statsUser.domainId];
                    const embed = new EmbedBuilder()
                        .setTitle(`${statsUser.displayName}`)
                        .setDescription(`**${domain.name}**\n${domain.description}`)
                        .setThumbnail(interaction.user.displayAvatarURL())
                        .addFields(
                            { name: 'Overall Exp', value: statsUser.overallExp.toString(), inline: true },
                            { name: 'Coins', value: statsUser.coins.toString(), inline: true },
                            { name: 'Party', value: statsUser.partyName || 'None', inline: true },
                            { name: 'Artisan Exp', value: statsUser.artisanExp.toString(), inline: true },
                            { name: 'Soldier Exp', value: statsUser.soldierExp.toString(), inline: true },
                            { name: 'Healer Exp', value: statsUser.healerExp.toString(), inline: true }
                        )
                        .setColor(domain.background)
                        .setTimestamp();

                    interaction.reply({
                        embeds: [embed]
                    });
                    break;
                case 'rename':
                        const renameUser = dbQuery.getDisplayName.get(userId, guildId);
                        
                        if (!renameUser) {
                            interaction.reply({
                                content: 'No character found. Use `/character enroll` to create one first.',
                                flags: MessageFlags.Ephemeral
                            });
                            return;
                        }

                        let newName = interaction.options.getString('name').trim();
                        
                        if (newName === '' || newName.length > 32) {
                            interaction.reply({
                                content: 'Character name must be between 1-32 characters.',
                                flags: MessageFlags.Ephemeral
                            });
                            return;
                        }

                        setTimeout(() => {
                            dbQuery.updateDisplayName.run(newName, userId, guildId);
                        }, 0);

                        interaction.reply({
                            content: `Character renamed from "${renameUser.displayName}" to "${newName}".`,
                            flags: MessageFlags.Ephemeral
                        });
                        break;
                default:
                    interaction.reply({
                        content: 'Unknown subcommand.',
                        flags: MessageFlags.Ephemeral
                    });
            }
        } catch (error) {
            console.error('Error executing character command:', error, `userId:${userId}`, `subcommand:${subcommand}`);
            interaction.reply({
                content: 'An error occurred while processing your character command.',
                flags: MessageFlags.Ephemeral
            });
        }
    }
};