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
    const embedColor = 0x964B00;
const storeFront = new EmbedBuilder()
  .setImage("https://raw.githubusercontent.com/CapricanDRJ/DungeonBard/refs/heads/main/shop.webp")
  .setColor(embedColor);
async function menu(interaction, isUpdate, selectedItemId = null) {
  try {
    let embed;
    let components = [];

    if (!selectedItemId) {
      // Initial store view
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
        const unixTime = Math.floor(Date.now() / 1000);
/*
        CREATE TABLE items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    skillBonus INTEGER,
    itemBonus INTEGER,
    skill INTEGER,
    professionId INTEGER,
    cost INTEGER NOT NULL,
    duration INTEGER NOT NULL,
    emojiId TEXT NOT NULL
);*/
        const statsFields = [];
        const skills = ["Intelligence", "Charisma", "Attack", "Defense", "Hitpoints", "Dexterity"];
        const profession = ["Artisan", "Soldier", "Healer"];
        if(item.skillBonus) statsFields.push({ name: skills[item.skill - 1], value: `+${item.skillBonus}`, inline: true });
        if(item.itemBonus) statsFields.push({ name: profession[item.professionId - 1], value:`${(item.itemBonus < 9 ? 'X' : '+')}${item.itemBonus}`, inline: true });
        if(item.duration) statsFields.push({ name: "Until", value: `<t:${unixTime + item.duration}:f>`, inline: true });
        
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
    const embeds = [storeFront];
    if(embed)embeds.push(embed);
    const messageData = {
      embeds,
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
          const item = db.prepare("SELECT * FROM items WHERE id = ? LIMIT 1").get(itemId);
          const user = db.prepare('SELECT coins FROM users WHERE userId = ? AND guildId = ? LIMIT 1').get(interaction.user.id, interaction.guildId);
          const unixTime = Math.floor(Date.now() / 1000);
          if (!user || user.coins < item.cost) {
            return interaction.reply({
              content: `You don't have enough coins! You need 🪙 ${item.cost} but only have 🪙 ${user?.coins || 0}.`,
              flags: MessageFlags.Ephemeral
            });
          } else {
            if(item.skillBonus) {
                db.prepare('UPDATE users SET coins = coins - ?, healerBonus = ?, healerBonusEnd = ? WHERE userId = ? AND guildId = ?').run(item.cost, item.skillBonus, unixTime + item.duration, interaction.user.id, interaction.guildId);
            }
            if(item.itemBonus) {
                const itemColumn = [null, null, "weaponBonus", "armourBonus", null, null][item.skill - 1];
                const updateQuery = `UPDATE users SET coins = coins - ?, ${itemColumn} = ?, ${itemColumn}End = ? WHERE userId = ? AND guildId = ?`;
                db.prepare(updateQuery).run(item.cost, item.itemBonus, unixTime + item.duration, interaction.user.id, interaction.guildId);
            }
            const buttonRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`purchase-${selectedItemId}`)
                .setLabel(`Purchased for 🪙 ${item.cost}`)
                .setDisabled(true)
                .setStyle(ButtonStyle.Success)
            );
        components.push(buttonRow);
            //db.prepare('UPDATE users SET coins = coins - ? WHERE userId = ? AND guildId = ?').run(item.cost, interaction.user.id, interaction.guildId);
            return interaction.update({
              components: [buttonRow]
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