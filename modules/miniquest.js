const {
  SlashCommandBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  MessageFlagsBitField
} = require('discord.js');
const sqlite3 = require('better-sqlite3');
const db = new sqlite3('db/dungeonbard.db');
const MessageFlags = MessageFlagsBitField.Flags;

/**
 * menu(interaction, isUpdate, actionType, actionValue)
 *
 * actionType:   null | "selectArea" | "selectQuest"
 * actionValue:
 *   - "selectArea" => actionValue is the selected questArea (string)
 *   - "selectQuest" => actionValue is the selected miniquest id (string like "miniquest123")
 */
async function menu(interaction, isUpdate, actionType = null, actionValue = null) {
  let content = "";
  let components = [];

  try {
    // Stage 1: Show quest areas dropdown
    if (actionType === null) {
      // Get unique quest areas
      const questAreas = db
        .prepare("SELECT DISTINCT questArea FROM miniquest WHERE questArea IS NOT NULL ORDER BY questArea ASC")
        .all();

      if (questAreas.length === 0) {
        content = "No quest areas found in the database.";
      } else {
        const dropdown = new StringSelectMenuBuilder()
          .setCustomId("miniquestAreaSelect")
          .setPlaceholder("Select a quest area")
          .addOptions(
            questAreas.map(area => ({
              label: area.questArea,
              value: area.questArea
            }))
          );

        const row = new ActionRowBuilder().addComponents(dropdown);
        components = [row];
        content = "Choose a quest area to explore:";
      }

    // Stage 2: Show quests in selected area
    } else if (actionType === "selectArea") {
      const selectedArea = actionValue;
      content = `**Quest Area: ${selectedArea}**\n\nSelect a miniquest:`;

      // Get all quests for this area, sorted alphabetically
      const quests = db
        .prepare("SELECT id, name, description FROM miniquest WHERE questArea = ? ORDER BY name ASC")
        .all(selectedArea);

      if (quests.length === 0) {
        content += "\n\nNo quests found in this area.";
      } else {
        // Discord has a 25 option limit per dropdown, so we might need multiple
        const maxOptionsPerDropdown = 25;
        const numDropdowns = Math.ceil(quests.length / maxOptionsPerDropdown);

        for (let i = 0; i < numDropdowns; i++) {
          const startIdx = i * maxOptionsPerDropdown;
          const endIdx = Math.min(startIdx + maxOptionsPerDropdown, quests.length);
          const questSlice = quests.slice(startIdx, endIdx);

          const dropdown = new StringSelectMenuBuilder()
            .setCustomId(`miniquestSelect_${i}`)
            .setPlaceholder(`Select a quest ${numDropdowns > 1 ? `(${i + 1}/${numDropdowns})` : ''}`)
            .addOptions(
              questSlice.map(quest => ({
                label: quest.name,
                description: quest.description ? quest.description.substring(0, 100) : 'No description available',
                value: `miniquest${quest.id}`
              }))
            );

          const row = new ActionRowBuilder().addComponents(dropdown);
          components.push(row);
        }
      }

    // Stage 3: Show selected quest details
    } else if (actionType === "selectQuest") {
      const questId = actionValue.replace('miniquest', ''); // Remove "miniquest" prefix
      
      const quest = db
        .prepare(`SELECT * FROM miniquest WHERE id = ?`)
        .get(questId);

      if (!quest) {
        content = "Quest not found.";
      } else {
        content = `**${quest.name}**\n`;
        content += `**Quest Area:** ${quest.questArea}\n`;
        if (quest.description) content += `**Description:** ${quest.description}\n`;
        if (quest.profession) content += `**Profession:** ${quest.profession}\n`;
        if (quest.professionXp) content += `**Profession XP:** ${quest.professionXp}\n`;
        if (quest.difficulty) content += `**Difficulty:** ${quest.difficulty}\n`;
        if (quest.perilChance) content += `**Peril Chance:** ${(quest.perilChance * 100).toFixed(1)}%\n`;
        if (quest.relicChance) content += `**Relic Chance:** ${(quest.relicChance * 100).toFixed(1)}%\n`;
        if (quest.scholarship) content += `**Scholarship:** ${quest.scholarship}\n`;
        if (quest.coins) content += `**Coins:** ${quest.coins}\n`;
        if (quest.entity) content += `**Entity:** ${quest.entity}\n`;
        if (quest.entityEffect) content += `**Entity Effect:** ${quest.entityEffect}\n`;
        if (quest.relicEffect) content += `**Relic Effect:** ${quest.relicEffect}\n`;
      }
    }

    // Send or update the interaction
    const messageData = {
      content: content,
      components: components,
      flags: MessageFlags.Ephemeral
    };

    if (isUpdate) {
      await interaction.update(messageData);
    } else {
      await interaction.reply(messageData);
    }

  } catch (error) {
    console.error(`[MINIQUEST_ERROR] ${error.message}`, { questId: actionValue, userId: interaction.user.id });
    
    const errorMessage = isUpdate 
      ? { content: "An error occurred while processing your request.", components: [] }
      : { content: "An error occurred while processing your request.", flags: MessageFlags.Ephemeral };
      
    if (isUpdate) {
      await interaction.update(errorMessage);
    } else {
      await interaction.reply(errorMessage);
    }
  }
}

module.exports = {
  commandData: new SlashCommandBuilder()
    .setName("miniquest")
    .setDescription("Browse and explore miniquests by area"),

  allowedButtons: [],

  executeCommand: async (interaction) => {
    if (interaction.commandName === "miniquest") {
      menu(interaction, false);
    }
  },

  handleInteraction: async (client, interaction) => {
    if (interaction.isCommand()) {
      module.exports.executeCommand(interaction);
    } else if (interaction.isStringSelectMenu()) {
      if (interaction.customId === "miniquestAreaSelect") {
        menu(interaction, true, "selectArea", interaction.values[0]);
      } else if (interaction.customId.startsWith("miniquestSelect_")) {
        menu(interaction, true, "selectQuest", interaction.values[0]);
      }
    }
  },

  main: (client) => {
    console.log("Slash commands for miniquest module have been loaded.");
  }
};