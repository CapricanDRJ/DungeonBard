const { SlashCommandBuilder, MessageFlagsBitField, EmbedBuilder } = require('discord.js');
const sqlite3 = require('better-sqlite3');
const db = new sqlite3('db/dungeonbard.db');
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
                .setName('stats')
                .setDescription('Display your character profile card')
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
                    const existingUser = db.prepare('SELECT 1 FROM users WHERE userId = ? AND guildId = ? LIMIT 1').get(userId, guildId);
                    if(displayName === null || displayName.trim() === '') {
                        displayName = interaction.member?.nickname || 
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
                        + '.png';

                        console.log(avatarURL);
                        const avatarFileName = avatarURL.split('/').pop().split('?')[0];
                        let avatarBlob = null;

                        try {
                            const response = await fetch(avatarURL);
                            if (response.ok) {
                                const arrayBuffer = await response.arrayBuffer();
                                avatarBlob = Buffer.from(arrayBuffer);
                            }
                        } catch (error) {
                            console.error('Error downloading avatar:', error, `userId:${userId}`);
                        }

                        db.prepare(`INSERT INTO users (userId, guildId, displayName, avatarFile, avatar, domainId) 
                                   VALUES (?, ?, ?, ?, ?, ?)`).run(userId, guildId, displayName, avatarFileName, avatarBlob, domainId);
                    }, 0);

                    interaction.reply({
                        content: `Character "${displayName}" successfully enrolled as ${domains[domainId].name}!`,
                        flags: MessageFlags.Ephemeral
                    });
                    break;

                case 'restart':
                    const restartUser = db.prepare('SELECT * FROM users WHERE userId = ? AND guildId = ?').get(userId, guildId);
                    
                    if (!restartUser) {
                        interaction.reply({
                            content: 'No character found. Use `/character enroll` to create one first.',
                            flags: MessageFlags.Ephemeral
                        });
                        return;
                    }

                    setTimeout(() => {
                        db.prepare(`UPDATE users SET artisanExp = 0, soldierExp = 0, healerExp = 0, 
                                   skill1 = 0, skill2 = 0, skill3 = 0, skill4 = 0, skill5 = 0, skill6 = 0, 
                                   coins = 0, armourId = 0, weaponId = 0,
                                   artisanBonus = 0, artisanBonusEnd = 0, soldierBonus = 0, soldierBonusEnd = 0,
                                   healerBonus = 0, healerBonusEnd = 0, weaponBonus = 0, weaponBonusEnd = 0,
                                   armourBonus = 0, armourBonusEnd = 0
                                   WHERE userId = ? AND guildId = ?`).run(userId, guildId);
                    }, 0);

                    interaction.reply({
                        content: `Character "${restartUser.displayName}" has restarted as ${domains[restartUser.domainId].name}.`,
                        flags: MessageFlags.Ephemeral
                    });
                    break;

                case 'graduate':
                    const graduateUser = db.prepare('SELECT * FROM users WHERE userId = ? AND guildId = ?').get(userId, guildId);
                    
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
                        db.prepare(`UPDATE users SET domainId = ?, artisanExp = 0, soldierExp = 0, healerExp = 0,
                                   skill1 = 0, skill2 = 0, skill3 = 0, skill4 = 0, skill5 = 0, skill6 = 0,
                                   coins = 0, armourId = 0, weaponId = 0,
                                   artisanBonus = 0, artisanBonusEnd = 0, soldierBonus = 0, soldierBonusEnd = 0,
                                   healerBonus = 0, healerBonusEnd = 0, weaponBonus = 0, weaponBonusEnd = 0,
                                   armourBonus = 0, armourBonusEnd = 0
                                   WHERE userId = ? AND guildId = ?`).run(newDomainId, userId, guildId);
                    }, 0);

                    interaction.reply({
                        content: `Character "${graduateUser.displayName}" has graduated to ${domains[newDomainId].name}!`,
                        flags: MessageFlags.Ephemeral
                    });
                    break;

                case 'delete':
                    const userToDelete = db.prepare('SELECT displayName FROM users WHERE userId = ? AND guildId = ?').get(userId, guildId);
                    
                    if (!userToDelete) {
                        interaction.reply({
                            content: 'No character found to delete.',
                            flags: MessageFlags.Ephemeral
                        });
                        return;
                    }

                    setTimeout(() => {
                        db.prepare('DELETE FROM users WHERE userId = ? AND guildId = ?').run(userId, guildId);
                    }, 0);

                    interaction.reply({
                        content: `Character "${userToDelete.displayName}" has been deleted.`,
                        flags: MessageFlags.Ephemeral
                    });
                    break;

                case 'stats':
                    const statsUser = db.prepare('SELECT * FROM users WHERE userId = ? AND guildId = ?').get(userId, guildId);
                    
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