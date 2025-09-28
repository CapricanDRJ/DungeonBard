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
const skillNames = [
  ["Learning","Communication","Discipline","Organization","Stamina","Perseverance"],
  ["Learning","Communication","Discipline","Organization","Stamina","Perseverance"],
  ["Pedagogy","Classroom Command","Lesson Crafting","Organization","Stamina","Adaptability"],
  ["Scholarship","Rhetoric","Endurance","Organization","Stamina","Resilience"],
  ["Scholarship","Rhetoric","Endurance","Organization","Stamina","Resilience"],
  ["Scholarship","Rhetoric","Endurance","Administration","Stamina","Influence"]
];
async function menu(interaction, isUpdate, selectedItemId = null) {
  try {
    let embed;
    let components = [];
    const user = db.prepare('SELECT coins,domainId FROM users WHERE userId = ? AND guildId = ? LIMIT 1').get(interaction.user.id, interaction.guildId);
    const items = db
      .prepare("SELECT id, name, emojiId FROM items ORDER BY name ASC")
      .all();
    const ownedItems = Object.fromEntries(
      db.prepare("SELECT shopId, COUNT(*) as quantity FROM inventory WHERE userId = ? AND guildId = ? AND shopId IS NOT NULL GROUP BY shopId").all(interaction.user.id, interaction.guildId)
        .map(row => [row.shopId, row.quantity])
    );
      if (items.length > 0) {
        const dropdown = new StringSelectMenuBuilder()
          .setCustomId("itemSelect")
          .setPlaceholder("Select an item to view")
          .addOptions(
            items.map(item => ({
              label: ownedItems[item.id] ? `[${ownedItems[item.id]}] ${item.name}` : item.name,
              value: `item${item.id}`,
              emoji: item.emojiId,
              default: selectedItemId === item.id
            }))
          );

        components.push(new ActionRowBuilder().addComponents(dropdown));
      }
    if (selectedItemId) {
      // Item details view
      const item = db.prepare("SELECT * FROM items WHERE id = ?").get(selectedItemId);
      
      if (!item) {
        embed = new EmbedBuilder()
          .setTitle("Error")
          .setDescription("Item not found.")
          .setColor(embedColor);
      } else {
        const unixTime = Math.floor(Date.now() / 1000);
        const statsFields = [];
        const profession = ["Artisan", "Soldier", "Healer"];
        if(item.skillBonus) statsFields.push({ name: skillNames[user.domainId - 1][item.skill - 1], value: `+${item.skillBonus}`, inline: true });
        if(item.itemBonus) statsFields.push({ name: profession[item.professionId - 1], value:`${(item.itemBonus < 9 ? 'X' : '+')}${item.itemBonus}`, inline: true });
        if(item.duration) statsFields.push({ name: "Until", value: `<t:${unixTime + item.duration}:f>`, inline: true });
        
        embed = new EmbedBuilder()
          .setTitle(item.name)
          .setAuthor({
            iconURL: "https://cdn.discordapp.com/emojis/1421988790813196400.webp",
            name: `🪙 [${user.coins.toString()}]`
          })
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
            .setDisabled((user.coins > item.cost) ? false : true)
            .setStyle(ButtonStyle.Success)
        );
        components.push(buttonRow);
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
    .setName("shoppe")
    .setDescription("Browse and purchase items from the shoppe"),

  allowedButtons: ["purchase"],

  executeCommand: async (interaction) => {
    if (interaction.commandName === "shoppe") {
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
          if (!user || user.coins < item.cost) {
            return interaction.reply({
              content: `You don't have enough coins! You need 🪙 ${item.cost} but only have 🪙 ${user?.coins || 0}.`,
              flags: MessageFlags.Ephemeral
            });
          } else {
            const purchase = db.prepare('INSERT INTO inventory (userId, guildId, name, skillBonus, professionBonus, skill, professionId, duration, emojiId, shopId) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
              .run(interaction.user.id, interaction.guildId, item.name, item.skillBonus, item.itemBonus, item.skill, item.professionId, item.duration, item.emojiId, item.id);
            if (purchase.changes > 0) {
              db.prepare('UPDATE users SET coins = coins - ? WHERE userId = ? AND guildId = ?').run(item.cost, interaction.user.id, interaction.guildId);
            }
            const buttonRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`purchase-${item.id}`)
                .setLabel(`Purchased for 🪙 ${item.cost}`)
                .setDisabled(true)
                .setStyle(ButtonStyle.Success)
            );
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