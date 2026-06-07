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
        // 60 minute timeout (60 minutes * 60 seconds)
        const exp = Math.floor(Date.now() / 1000) + (60 * 60);
    
        const token = jwt.sign({
            userId: interaction.user.id,
            guildId: interaction.guildId,
            scope: 'editquest',
            iat: Math.floor(Date.now() / 1000),
            exp
        }, secret);

        const tokenUrl = `https://api.tsl.rocks/editquest?token=${encodeURIComponent(token)}`;

            return interaction.reply({
            content: [
                '**Quest Editing Link:**',
                `\`${tokenUrl}\``,
                '',
                `Link Expires <t:${exp}:R>`
            ].join('\n'),
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