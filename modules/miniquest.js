const {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  EmbedBuilder,
  MessageFlagsBitField
} = require('discord.js');
const sqlite3 = require('better-sqlite3');
const db = new sqlite3('db/dungeonbard.db');
const MessageFlags = MessageFlagsBitField.Flags;

async function menu(interaction, isUpdate, stage = 1, selectedArea = null, selectedQuestId = null) {
  try {
    let embed;
    let components = [];

    if (stage === 1) {
      // Stage 1: Show quest areas
      embed = new EmbedBuilder()
        .setTitle("Miniquest Explorer")
        .setDescription("Choose a quest area to explore:")
        .setColor(0x0099ff);

      const questAreas = db
        .prepare("SELECT DISTINCT questArea FROM miniquest WHERE questArea IS NOT NULL ORDER BY questArea ASC")
        .all();

      if (questAreas.length > 0) {
        const dropdown = new StringSelectMenuBuilder()
          .setCustomId("miniquestAreaSelect")
          .setPlaceholder("Select a quest area")
          .addOptions(
            questAreas.map(area => ({
              label: area.questArea,
              value: area.questArea
            }))
          );

        components.push(new ActionRowBuilder().addComponents(dropdown));
      }

    } else if (stage === 2) {
      // Stage 2: Show quests in area
      const areaData = db.prepare("SELECT DISTINCT questArea, areaDesc FROM miniquest WHERE questArea = ? LIMIT 1").get(selectedArea);
      
      embed = new EmbedBuilder()
        .setTitle(selectedArea)
        .setDescription(areaData?.areaDesc || "Select a miniquest:")
        .setColor(0x00ff00);

      const quests = db
        .prepare("SELECT id, name, description FROM miniquest WHERE questArea = ? ORDER BY name ASC")
        .all(selectedArea);

      if (quests.length > 0) {
        // Create dropdowns (max 25 options each)
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

          components.push(new ActionRowBuilder().addComponents(dropdown));
        }
      }

      // Back button
      const buttonRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`miniquestback`)
          .setLabel("Back")
          .setStyle(ButtonStyle.Secondary)
      );
      components.push(buttonRow);

    } else if (stage === 3) {
      // Stage 3: Show quest details
      const quest = db.prepare("SELECT * FROM miniquest WHERE id = ?").get(selectedQuestId);
      
      if (!quest) {
        embed = new EmbedBuilder()
          .setTitle("Error")
          .setDescription("Quest not found.")
          .setColor(0xff0000);
      } else {
        embed = new EmbedBuilder()
          .setTitle(quest.name)
          .setDescription(quest.description || "No description available")
          .setColor(0xffd700);

        const fields = [];
        if (quest.questArea) fields.push({ name: "Quest Area", value: quest.questArea, inline: true });
        if (quest.profession) fields.push({ name: "Profession", value: quest.profession, inline: true });
        if (quest.professionXp) fields.push({ name: "Profession XP", value: quest.professionXp.toString(), inline: true });
        if (quest.difficulty) fields.push({ name: "Difficulty", value: quest.difficulty.toString(), inline: true });
        if (quest.perilChance) fields.push({ name: "Peril Chance", value: `${(quest.perilChance * 100).toFixed(1)}%`, inline: true });
        if (quest.relicChance) fields.push({ name: "Relic Chance", value: `${(quest.relicChance * 100).toFixed(1)}%`, inline: true });
        if (quest.scholarship) fields.push({ name: "Scholarship", value: quest.scholarship.toString(), inline: true });
        if (quest.coins) fields.push({ name: "Coins", value: quest.coins.toString(), inline: true });
        if (quest.waitTime) fields.push({ name: "Wait Time", value: `${quest.waitTime} seconds`, inline: true });
        if (quest.entity) fields.push({ name: "Entity", value: quest.entity, inline: true });
        if (quest.entityEffect) fields.push({ name: "Entity Effect", value: quest.entityEffect, inline: false });
        if (quest.relicEffect) fields.push({ name: "Relic Effect", value: quest.relicEffect, inline: false });

        if (fields.length > 0) {
          embed.addFields(fields);
        }
      }

      // Back and Complete buttons
      const currentTime = Math.floor(Date.now() / 1000);
      const completeTime = currentTime + (quest.waitTime || 0);
      
      const buttonRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`miniquestback-${selectedArea}`)
          .setLabel("Back")
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId(`miniquestcomplete-${completeTime}`)
          .setLabel("Complete")
          .setStyle(ButtonStyle.Success)
      );
      components.push(buttonRow);
    }

    const messageData = {
      embeds: [embed],
      components: components,
      flags: MessageFlags.Ephemeral
    };

    if (isUpdate) {
      await interaction.update(messageData);
    } else {
      await interaction.reply(messageData);
    }

  } catch (error) {
    console.error(`[MINIQUEST_ERROR] ${error.message}`, { userId: interaction.user.id });
    
    const errorEmbed = new EmbedBuilder()
      .setTitle("Error")
      .setDescription("An error occurred while processing your request.")
      .setColor(0xff0000);
      
    const errorMessage = {
      embeds: [errorEmbed],
      components: [],
      flags: MessageFlags.Ephemeral
    };
      
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

  allowedButtons: ["miniquestback", "miniquestcomplete"],

  executeCommand: async (interaction) => {
    if (interaction.commandName === "miniquest") {
      menu(interaction, false, 1);
    }
  },

  handleInteraction: async (client, interaction) => {
    if (interaction.isCommand()) {
      module.exports.executeCommand(interaction);
    } else if (interaction.isStringSelectMenu()) {
      if (interaction.customId === "miniquestAreaSelect") {
        // Area selected - go to stage 2
        menu(interaction, true, 2, interaction.values[0]);
      } else if (interaction.customId.startsWith("miniquestSelect_")) {
        // Quest selected - go to stage 3
        const questId = parseInt(interaction.values[0].replace('miniquest', ''));
        const quest = db.prepare("SELECT questArea FROM miniquest WHERE id = ?").get(questId);
        menu(interaction, true, 3, quest?.questArea, questId);
      }
    } else if (interaction.isButton()) {
      if (interaction.customId === "miniquestback") {
        // Back to stage 1
        menu(interaction, true, 1);
      } else if (interaction.customId.startsWith("miniquestback-")) {
        // Back to stage 2 with area
        const area = interaction.customId.replace("miniquestback-", "");
        menu(interaction, true, 2, area);
      } else if (interaction.customId.startsWith("miniquestcomplete-")) {
        // Complete quest - check timing
        const completeTime = parseInt(interaction.customId.replace("miniquestcomplete-", ""));
        const currentTime = Math.floor(Date.now() / 1000);
        
        if (currentTime < completeTime) {
          // Not ready yet
          const remainingSeconds = completeTime - currentTime;
          const remainingMinutes = Math.ceil(remainingSeconds / 60);
          
          await interaction.reply({
            content: `You need to wait ${remainingMinutes} more minute${remainingMinutes !== 1 ? 's' : ''} before completing this quest.`,
            flags: MessageFlags.Ephemeral
          });
        } else {
          // Quest completed
          const completedEmbed = new EmbedBuilder()
            .setTitle("Quest Completed!")
            .setDescription("You have successfully completed the miniquest.")
            .setColor(0x00ff00);
            
          await interaction.update({
            embeds: [completedEmbed],
            components: []
          });
        }
      }
    }
  },

  main: (client) => {
    console.log("Slash commands for miniquest module have been loaded.");
  }
};