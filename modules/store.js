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

async function menu(interaction, isUpdate, selectedItemId = null) {
  try {
    let embed;
    let components = [];
    const embedColor = 0x964B00;

    if (!selectedItemId) {
      // Initial store view
      embed = new EmbedBuilder()
        .setTitle("Dungeon Store")
        .setDescription("Choose an item to view:")
        .setColor(embedColor);

      const items = db
        .prepare("SELECT id, name, emojiId FROM items ORDER BY name ASC")
        .all();

      if (items.length > 0) {
        const dropdown = new StringSelectMenuBuilder()
          .setCustomId("itemSelect")
          .setPlaceholder("Select an item to view")
          .addOptions(
            items.map(item => ({
              label: item.name,
              value: `item${item.id}`,
              emoji: item.emojiId
            }))
          );

        components.push(new ActionRowBuilder().addComponents(dropdown));
      }
    } else {
      // Item details view
      const item = db.prepare("SELECT * FROM items WHERE id = ?").get(selectedItemId);
      
      if (!item) {
        embed = new EmbedBuilder()
          .setTitle("Error")
          .setDescription("Item not found.")
          .setColor(embedColor);
      } else {
        const skillBonusText = item.skillBonus ? `+${item.skillBonus} Skill Bonus` : '';
        const itemBonusText = item.itemBonus ? `+${item.itemBonus} Item Bonus` : '';
        const skillText = item.skill ? `Skill: ${item.skill}` : '';
        const professionText = item.professionId ? `Profession: ${item.professionId}` : '';
        const durationText = item.duration ? `Duration: ${Math.floor(item.duration / 86400)} days` : '';

        const statsFields = [];
        if (skillBonusText) statsFields.push({ name: "Skill Bonus", value: skillBonusText, inline: true });
        if (itemBonusText) statsFields.push({ name: "Item Bonus", value: itemBonusText, inline: true });
        if (skillText) statsFields.push({ name: "Skill", value: skillText, inline: true });
        if (professionText) statsFields.push({ name: "Profession", value: professionText, inline: true });
        if (durationText) statsFields.push({ name: "Duration", value: durationText, inline: true });
        
        embed = new EmbedBuilder()
          .setTitle(item.name)
          .setDescription(`Cost: 🪙 ${item.cost}`)
          .setColor(embedColor)
          .setThumbnail(`https://cdn.discordapp.com/emojis/${item.emojiId}.webp`);

        if (statsFields.length > 0) {
          embed.addFields(statsFields);
        }

        // Purchase button
        const buttonRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`purchase-${selectedItemId}`)
            .setLabel(`Purchase for 🪙 ${item.cost}`)
            .setStyle(ButtonStyle.Success)
        );
        components.push(buttonRow);
      }

      // Back button dropdown
      const items = db
        .prepare("SELECT id, name, emojiId FROM items ORDER BY name ASC")
        .all();

      if (items.length > 0) {
        const dropdown = new StringSelectMenuBuilder()
          .setCustomId("itemSelect")
          .setPlaceholder("Select another item to view")
          .addOptions(
            items.map(item => ({
              label: item.name,
              value: `item${item.id}`,
              emoji: item.emojiId
            }))
          );

        components.push(new ActionRowBuilder().addComponents(dropdown));
      }
    }

    const messageData = {
      embeds: [embed],
      components: components,
      flags: MessageFlags.Ephemeral
    };

    if (isUpdate) {
      return interaction.update(messageData);
    } else {
      return interaction.reply(messageData);
    }

  } catch (error) {
    console.error(`[store_ERROR] ${error.message}`, { userId: interaction.user.id });
    
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
      return interaction.update(errorMessage);
    } else {
      return interaction.reply(errorMessage);
    }
  }
}

module.exports = {
  commandData: new SlashCommandBuilder()
    .setName("store")
    .setDescription("Browse and purchase items from the store"),

  allowedButtons: ["purchase"],

  executeCommand: async (interaction) => {
    if (interaction.commandName === "store") {
      menu(interaction, false);
    }
  },

  handleInteraction: async (client, interaction) => {
    if (interaction.isCommand()) {
      module.exports.executeCommand(interaction);
    } else if (interaction.isStringSelectMenu()) {
      if (interaction.customId === "itemSelect") {
        // Item selected - show item details
        const itemId = parseInt(interaction.values[0].replace('item', ''));
        menu(interaction, true, itemId);
      }
    } else if (interaction.isButton()) {
      const parts = interaction.customId.split('-');
      const action = parts[0];
      if(action !== "purchase") return;
      
      switch (action) {
        case "purchase":
          const itemId = parseInt(parts[1]);
          const item = db.prepare("SELECT * FROM items WHERE id = ?").get(itemId);
          const user = db.prepare('SELECT coins FROM users WHERE userId = ? AND guildId = ?').get(interaction.user.id, interaction.guildId);
          
          if (!user || user.coins < item.cost) {
            return interaction.reply({
              content: `You don't have enough coins! You need 🪙 ${item.cost} but only have 🪙 ${user?.coins || 0}.`,
              flags: MessageFlags.Ephemeral
            });
          } else {
            //db.prepare('UPDATE users SET coins = coins - ? WHERE userId = ? AND guildId = ?').run(item.cost, interaction.user.id, interaction.guildId);
            return interaction.update({
              components: [] // Remove buttons and dropdown
            });
          }
          break;
      }
    }
  },

  main: (client) => {
    console.log("Slash commands for store module have been loaded.");
  }
};