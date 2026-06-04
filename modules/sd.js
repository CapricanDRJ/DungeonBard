const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    commandData: new SlashCommandBuilder()
        .setName('sd')
        .setDescription('Post the adventure start embed')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .setIntegrationTypes(['GuildInstall']),

    allowedButtons: [],

    handleInteraction: async (client, interaction) => {
        if (interaction.isCommand() && interaction.commandName === 'sd') {
            module.exports.executeCommand(interaction);
        }
    },

    main: (client) => {
        console.log("Slash commands for sd module have been loaded.");
    },

    executeCommand: async (interaction) => {
        try {
            const logo = new AttachmentBuilder('./assets/SD_logo.png', { name: 'SD_logo.png' });

            const embed = new EmbedBuilder()
                .setTitle('Begin Your Adventure!')
                .setDescription('Welcome, Scholar! Press the button below to start your quest.')
                .setImage('attachment://SD_logo.png')
                .setColor(0x5865F2);

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                .setCustomId('quest')
                .setLabel('/quest')
                .setStyle(ButtonStyle.Success)
            );

            await interaction.reply({ embeds: [embed], files: [logo], components: [row] });

        } catch (error) {
            console.error('Error executing sd command:', error);
            await interaction.reply({ content: 'An error occurred.', ephemeral: true });
        }
    }
};