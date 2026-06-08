const { SlashCommandBuilder, MessageFlagsBitField, PermissionFlagsBits } = require('discord.js');
const { secret } = require(`${process.env.HOME}/.jwt/token.json`);
const jwt = require('jsonwebtoken');

const MessageFlags = MessageFlagsBitField.Flags;

module.exports = {
 commandData: new SlashCommandBuilder()
    .setName('editquest')
    .setDescription('Generate a temporary URL to edit quests')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setIntegrationTypes(0),

 allowedButtons: [],

 handleInteraction: async (client, interaction) => {
    if (interaction.isChatInputCommand() && interaction.commandName === 'editquest') {
    module.exports.executeCommand(interaction);
    }
 },

 main: (client) => {
    console.log("Slash commands for editquest module have been loaded.");
 },

executeCommand: async (interaction) => {
    try {
        const tokenUrl = ``;

        return interaction.reply({
        embeds: [{
        title: '🛡️ Administrative Access',
        description: `[Initialize Management Session](https://dm.tsl.rocks/)`,
        color: 0x5865F2, // Discord Blurple
        footer: {
        }
        }],
        flags: MessageFlags.Ephemeral
        });
    } catch (err) {
        console.error('Error generating quest token:', err);
        return interaction.reply({
            content: 'An error occurred while generating your quest editing link.',
            flags: MessageFlags.Ephemeral
        });
    }
 }
};