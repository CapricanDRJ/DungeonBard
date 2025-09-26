const {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  EmbedBuilder,
  MessageFlagsBitField
} = require('discord.js');
const wait = require('node:timers/promises').setTimeout;
const sqlite3 = require('better-sqlite3');
const db = new sqlite3('db/dungeonbard.db');
const getDomain = db.prepare("SELECT domainId FROM users WHERE userId = ?");
const MessageFlags = MessageFlagsBitField.Flags;
const colors = db.prepare("SELECT id, background FROM domains ORDER BY id").all().map(r => r.background);
colors.unshift(0x000000);
async function menu(interaction, isUpdate, stage = 1, selectedArea = null, selectedQuestId = null) {
  try {
    let embed;
    let components = [];
    const domain = getDomain.pluck().get(interaction.user.id);
    const embedColor = colors[domain];
    if (stage === 1) {
      // Stage 1: Show quest areas
      embed = new EmbedBuilder()
        .setTitle("Miniquest Explorer")
        .setDescription("Choose a quest area to explore:")
        .setColor(embedColor);
      const questAreas = db
        .prepare("SELECT DISTINCT questArea FROM miniquest WHERE questArea IS NOT NULL AND domainId <= ? ORDER BY questArea ASC")
        .all(domain);
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
        .setColor(embedColor);

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
          .setStyle(ButtonStyle.Danger)
      );
      components.push(buttonRow);

    } else if (stage === 3) {
      // Stage 3: Show quest details
      const quest = db.prepare("SELECT * FROM miniquest WHERE id = ?").get(selectedQuestId);
      
      if (!quest) {
        embed = new EmbedBuilder()
          .setTitle("Error")
          .setDescription("Quest not found.")
          .setColor(embedColor);
      } else {
        embed = new EmbedBuilder()
          .setTitle(quest.questArea)
          .setDescription(quest.areaDesc || "No description available")
          .setColor(embedColor);

        const fields = [];
        if (quest.questArea) fields.push({ name: quest.name, value: quest.description, inline: true });

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
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId(`miniquestcomplete-${selectedQuestId}-${completeTime}`)
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
      const parts = interaction.customId.split('-');
      const action = parts[0];
      
      switch (action) {
        case "miniquestback":
          if (parts.length === 1) {
            // Back to stage 1
            menu(interaction, true, 1);
          } else {
            // Back to stage 2 with area
            const area = parts[1];
            menu(interaction, true, 2, area);
          }
          break;
          
        case "miniquestcomplete":
          // Complete quest - check timing
          const completeTime = parseInt(parts[2]);
          const currentTime = Math.floor(Date.now() / 1000);
          const embeds = [];
          if (currentTime < completeTime) {
            // Not ready yet
            const remainingSeconds = completeTime - currentTime;
            const remainingMinutes = Math.ceil(remainingSeconds / 60);
            
            await interaction.reply({
              content: `You need to wait ${remainingMinutes} more minute${remainingMinutes !== 1 ? 's' : ''} before completing this quest.`,
              flags: MessageFlags.Ephemeral
            });
          } else {
            await interaction.update({//remove buttons, no extra pressing
                components: []
            });
            // Quest completed
            const id = parts[1];
            const quest = db.prepare("SELECT * FROM miniquest WHERE id = ?").get(id);
            const profession = ['artisanExp', 'soldierExp', 'healerExp'][parseInt(quest.professionId) - 1];
            const user = db.prepare('SELECT * FROM users WHERE userId = ? AND guildId = ?').get(interaction.user.id, interaction.guildId);
            db.prepare('UPDATE users SET coins = coins + ? WHERE userId = ? AND guildId = ?').run(quest.coins, interaction.user.id, interaction.guildId);
            embeds.push(new EmbedBuilder()
              .setTitle(quest.questArea)
              .setDescription(quest.areaDesc || "No description available")
              .setColor(colors[quest.domainId])
              .addFields(
                { name: quest.name, value: quest.description, inline: true },
                { name: "Quest Coins Earned", value: `🪙${quest.coins}`, inline: true }
              )
              .setAuthor({
                name: user.displayName,
                iconURL: interaction.user.displayAvatarURL({ dynamic: true }) // their avatar
              })
            );
            if(quest.perilChance === null) {
                let healerQuest;
                const xp = Math.random() < quest.relicChance ? quest.professionXp : 0;
                if (xp > 0) {
                    healerQuest = db.prepare('SELECT * FROM healerMiniquest ORDER BY RANDOM() LIMIT 1').get();
                    embeds.push(new EmbedBuilder()
                      .setTitle(healerQuest.name)
                      .setDescription(healerQuest.description)
                      .setColor(colors[quest.domainId])
                    );
                }
                db.prepare(`UPDATE users SET ${profession} = ${profession} + ? WHERE userId = ? AND guildId = ?`).run(xp, interaction.user.id, interaction.guildId);
            } else {
                //if(Math.random() < quest.perilChance) {
                if(true) { //always peril for testing
                    //peril
                    function skillMod(skill){ return Math.floor(Math.min(20, Math.max(1, skill))); }
                    embeds.push(new EmbedBuilder()
                      .setDescription(`As you embark on your quest, a sudden peril befalls you!\nYou encounter a **${quest.entity}**!\n*${quest.entityEffect}*`)
                      .setColor(0xa6ce2a)
                      .setAuthor({
                        name: `The ${quest.entity}`,
                        iconURL: 'https://cdn.discordapp.com/emojis/1421265406081110046.webp'
                      }));
                    const difficulty = [0.01,0.75,0.9, 1.05][parseInt(quest.difficulty)];
                    const unixTime = Math.floor(Date.now() / 1000);
                    const weaponBonus = user.weaponBonusEnd > unixTime ? user.weaponBonus : 0;
                    const armorBonus = user.armorBonusEnd > unixTime ? user.armorBonus : 0;
                    const attack = skillMod(user.skill3) + (weaponBonus || 0);
                    const defense = skillMod(user.skill4) + (armorBonus || 0);
                    const hp = Math.min(20, Math.max(1, user.skill5));

                    const monsterAttack = skillMod(user.skill3) * difficulty;
                    const monsterDefense = skillMod(user.skill4) * difficulty;
                    let userHitpoints = hp;
                    let monsterHitpoints = hp * difficulty;
                    let battleLog = `Monster Attack: ${monsterAttack.toFixed(2)}, Defense: ${monsterDefense.toFixed(2)}, Hitpoints: ${monsterHitpoints.toFixed(2)}\n`;
                    battleLog += `Your Attack: ${attack.toFixed(2)}, Defense: ${defense.toFixed(2)}, Hitpoints: ${userHitpoints.toFixed(2)}\n`;
                    //battle loop
                    while(monsterHitpoints > 0 && userHitpoints > 0) {
                      const userd20attack = Math.floor(Math.random()*20) + 1 + attack;
                      const monsterd20defense = Math.floor(Math.random()*20) + 1 + monsterDefense;
                        if(userd20attack >= monsterd20defense) {
                            //hit
                            monsterHitpoints -= (userd20attack - monsterd20defense) / 2;
                            battleLog += `You hit the ${quest.entity} for ${(userd20attack - monsterd20defense) / 2} damage!\n`;
                        } else {
                            battleLog += `You miss the ${quest.entity}!\n`;
                        }
                        if(monsterHitpoints <= 0) break;
                        //monster turn
                        const monsterD20attack = Math.floor(Math.random() * 20) + 1 + monsterAttack;
                        const userd20defense = Math.floor(Math.random() * 20) + 1 + defense + armorBonus;

                        if(monsterD20attack >= userd20defense * 2) {
                            //hit
                            userHitpoints -= (monsterAttack - (userd20defense)) / 2;
                            battleLog += `The ${quest.entity} hits you for ${(monsterAttack - (userd20defense)) / 2} damage!\n`;
                        } else {
                            battleLog += `The ${quest.entity} misses you!\n`;
                        }
                        if(userHitpoints <= 0) break;
                    }
                    let battleField = [];
                    if(userHitpoints <= 0) {
                        //user lost
                        battleField.push({ name: "Defeat", value: `The ${quest.entity} lands a perilous blow. Thou retreatest in defeat!`});
                        db.prepare(`UPDATE users SET ${profession} = ${profession} + ? WHERE userId = ? AND guildId = ?`).run(quest.professionXp, interaction.user.id, interaction.guildId);
                    } else {
                        //user won
                        battleField.push({ name: "Victory", value: `The ${quest.entity} has been vanquished!`});
                        db.prepare(`UPDATE users SET coins = coins + ?, ${profession} = ${profession} + ? WHERE userId = ? AND guildId = ?`).run(quest.coins, quest.professionXp, interaction.user.id, interaction.guildId);
                        battleField.push({ name: "Monster Coins Earned", value: `🪙${quest.coins}`, inline: true });
                          embeds.push(new EmbedBuilder()
                            .setAuthor({
                              name: "Battle",
                              iconURL: 'https://cdn.discordapp.com/emojis/1421265514474504353.webp'
                            })
                            .setDescription(battleLog)
                            .setColor(0x8b0000)
                            .addFields(battleField)
                        );
                        if(Math.random() < quest.relicChance) {
                            embeds.push(new EmbedBuilder()
                              .setTitle(quest.scholarship)
                              .setDescription(quest.relicEffect)
                              .setColor(0x996515)
                              .setAuthor({
                                name: "Relic Found!",
                                iconURL: 'https://cdn.discordapp.com/emojis/1421265478331928646.webp'
                              })
                            );
                        }

                    };
                }
            }
            await wait(1000);
            await interaction.followUp({
              embeds
            });
          };
          break;
      }
    }
  },

  main: (client) => {
    console.log("Slash commands for miniquest module have been loaded.");
  }
};