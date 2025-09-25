const { SlashCommandBuilder, MessageFlagsBitField, EmbedBuilder } = require('discord.js');
const sqlite3 = require('better-sqlite3');
const db = new sqlite3('db/dungeonbard.db');
const MessageFlags = MessageFlagsBitField.Flags;

// Load domain levels from database
const getDomainLevels = () => {
    const domains = db.prepare('SELECT * FROM domains ORDER BY id').all();
    const domainLevels = {};
    domains.forEach(domain => {
        domainLevels[domain.id] = {
            name: domain.title,
            description: domain.description,
            background: domain.background,
            text: domain.text
        };
    });
    return domainLevels;
};

module.exports = {
    commandData: new SlashCommandBuilder()
        .setName('character')
        .setDescription('Manage character progression')
        .addSubcommand(subcommand =>
            subcommand
                .setName('enroll')
                .setDescription('Create a character that uses your discord server name and profile picture')
                .addStringOption(option =>
                    option.setName('name')
                        .setDescription('Enter your character name')
                        .setRequired(true)
                )
                .addIntegerOption(option =>
                    option.setName('domain')
                        .setDescription('Select your starting domain level')
                        .setRequired(true)
                        .addChoices(
                            ...db.prepare('SELECT id, title FROM domains ORDER BY id').all().map(domain => ({ name: domain.title, value: domain.id }))
                        )
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
        const subcommand = interaction.options.getSubcommand();
        const domainLevels = getDomainLevels();

        try {
            switch (subcommand) {
                case 'enroll':
                    const characterName = interaction.options.getString('name');
                    const domainLevel = interaction.options.getInteger('domain');
                    const displayName = interaction.member?.displayName || interaction.user.displayName;
                    const avatarURL = interaction.user.displayAvatarURL();

                    // Check if character already exists
                    const existingCharacter = db.prepare('SELECT * FROM characters WHERE userId = ?').get(userId);
                    
                    if (existingCharacter) {
                        interaction.reply({
                            content: 'You already have a character enrolled. Use `/character delete` first if you want to create a new one.',
                            flags: MessageFlags.Ephemeral
                        });
                        return;
                    }

                    setTimeout(() => {
                        db.prepare(`INSERT INTO characters (userId, characterName, domainLevel, displayName, avatarURL, createdAt) 
                                   VALUES (?, ?, ?, ?, ?, datetime('now'))`).run(userId, characterName, domainLevel, displayName, avatarURL);
                        checkUsers(interaction);
                    }, 0);

                    interaction.reply({
                        content: `Character "${characterName}" successfully enrolled as ${domainLevels[domainLevel].name}!`
                    });
                    break;

                case 'restart':
                    const restartCharacter = db.prepare('SELECT * FROM characters WHERE userId = ?').get(userId);
                    
                    if (!restartCharacter) {
                        interaction.reply({
                            content: 'No character found. Use `/character enroll` to create one first.',
                            flags: MessageFlags.Ephemeral
                        });
                        return;
                    }

                    setTimeout(() => {
                        db.prepare('UPDATE characters SET graduatedAt = datetime(\'now\') WHERE userId = ?').run(userId);
                        checkUsers(interaction);
                    }, 0);

                    interaction.reply({
                        content: `Character "${restartCharacter.characterName}" has restarted as ${domainLevels[restartCharacter.domainLevel].name}.`
                    });
                    break;

                case 'graduate':
                    const graduateCharacter = db.prepare('SELECT * FROM characters WHERE userId = ?').get(userId);
                    
                    if (!graduateCharacter) {
                        interaction.reply({
                            content: 'No character found. Use `/character enroll` to create one first.',
                            flags: MessageFlags.Ephemeral
                        });
                        return;
                    }

                    if (graduateCharacter.domainLevel >= 6) {
                        interaction.reply({
                            content: 'You are already at the highest domain level (The Sage). Use `/character restart` instead.',
                            flags: MessageFlags.Ephemeral
                        });
                        return;
                    }

                    const newDomainLevel = graduateCharacter.domainLevel + 1;

                    setTimeout(() => {
                        db.prepare('UPDATE characters SET domainLevel = ?, graduatedAt = datetime(\'now\') WHERE userId = ?').run(newDomainLevel, userId);
                        checkUsers(interaction);
                    }, 0);

                    interaction.reply({
                        content: `Character "${graduateCharacter.characterName}" has graduated to ${domainLevels[newDomainLevel].name}!`
                    });
                    break;

                case 'delete':
                    const charToDelete = db.prepare('SELECT characterName FROM characters WHERE userId = ?').get(userId);
                    
                    if (!charToDelete) {
                        interaction.reply({
                            content: 'No character found to delete.',
                            flags: MessageFlags.Ephemeral
                        });
                        return;
                    }

                    setTimeout(() => {
                        db.prepare('DELETE FROM characters WHERE userId = ?').run(userId);
                        checkUsers(interaction);
                    }, 0);

                    interaction.reply({
                        content: `Character "${charToDelete.characterName}" has been deleted.`
                    });
                    break;

                case 'stats':
                    const statsCharacter = db.prepare('SELECT * FROM characters WHERE userId = ?').get(userId);
                    
                    if (!statsCharacter) {
                        interaction.reply({
                            content: 'No character found. Use `/character enroll` to create one first.',
                            flags: MessageFlags.Ephemeral
                        });
                        return;
                    }

                    const domain = domainLevels[statsCharacter.domainLevel];
                    const embed = new EmbedBuilder()
                        .setTitle(`${statsCharacter.characterName}`)
                        .setDescription(`**${domain.name}**\n${domain.description}`)
                        .setThumbnail(statsCharacter.avatarURL)
                        .addFields(
                            { name: 'Display Name', value: statsCharacter.displayName, inline: true },
                            { name: 'User ID', value: statsCharacter.userId, inline: true },
                            { name: 'Enrolled', value: new Date(statsCharacter.createdAt).toLocaleDateString(), inline: true }
                        )
                        .setColor(domain.background)
                        .setTimestamp();

                    if (statsCharacter.graduatedAt) {
                        embed.addFields({ name: 'Last Graduation', value: new Date(statsCharacter.graduatedAt).toLocaleDateString(), inline: true });
                    }

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