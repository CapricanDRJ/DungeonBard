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
const skillNames = [
  ["Learning","Communication","Discipline","Organization","Stamina","Perseverance"],
  ["Learning","Communication","Discipline","Organization","Stamina","Perseverance"],
  ["Pedagogy","Classroom Command","Lesson Crafting","Organization","Stamina","Adaptability"],
  ["Scholarship","Rhetoric","Endurance","Organization","Stamina","Resilience"],
  ["Scholarship","Rhetoric","Endurance","Organization","Stamina","Resilience"],
  ["Scholarship","Rhetoric","Endurance","Administration","Stamina","Influence"]
];
const professionNames = ["Artisan", "Soldier", "Healer"];
function formatTime(seconds) {
  const days = Math.floor(seconds / 86400); // 86400 = 24*60*60
  const hours = Math.floor((seconds % 86400) / 3600);

  if (days > 0) return `${days} day${days !== 1 ? "s" : ""}`;
  if (hours > 0) return `${hours} hour${hours !== 1 ? "s" : ""}`;
  return `${Math.floor(seconds / 60)} minute${seconds >= 120 ? "s" : ""}`;
}
async function menu(interaction, isUpdate, stage = 1, selectedArea = null, selectedQuestId = null) {
  try {
    let embed;
    let components = [];
    const domain = getDomain.pluck().get(interaction.user.id);
    const embedColor = colors[domain];
    if (stage === 1) {
      // Stage 1: Show quest areas
      embed = new EmbedBuilder()
        .setTitle("Quest Explorer")
        .setDescription("Choose a quest area to explore:")
        .setColor(embedColor);
      const questAreas = db
        .prepare("SELECT DISTINCT questArea,areaDesc FROM quest WHERE questArea IS NOT NULL AND domainId IN (0, ?) ORDER BY questArea ASC")
        .all(domain);
      if (questAreas.length > 0) {
        const dropdown = new StringSelectMenuBuilder()
          .setCustomId("questAreaSelect")
          .setPlaceholder("Select a quest area")
          .addOptions(
            questAreas.map(area => ({
              label: area.questArea,
              description: area.areaDesc ? area.areaDesc.substring(0, 100) : 'No description available',
              value: area.questArea
            }))
          );

        components.push(new ActionRowBuilder().addComponents(dropdown));
      }
    } else if (stage === 2) {
      // Stage 2: Show quests in area
      const areaData = db.prepare("SELECT DISTINCT questArea, areaDesc FROM quest WHERE questArea = ? LIMIT 1").get(selectedArea);
      embed = new EmbedBuilder()
        .setTitle(selectedArea)
        .setDescription(areaData?.areaDesc || "Select a quest:")
        .setColor(embedColor);

      const quests = db
        .prepare("SELECT id, name, description FROM quest WHERE questArea = ? AND domainId IN (0, ?) ORDER BY name ASC")
        .all(selectedArea, domain);

      if (quests.length > 0) {
        // Create dropdowns (max 25 options each)
        const maxOptionsPerDropdown = 25;
        const numDropdowns = Math.ceil(quests.length / maxOptionsPerDropdown);

        for (let i = 0; i < numDropdowns; i++) {
          const startIdx = i * maxOptionsPerDropdown;
          const endIdx = Math.min(startIdx + maxOptionsPerDropdown, quests.length);
          const questSlice = quests.slice(startIdx, endIdx);

          const firstLetter = questSlice[0]?.name.charAt(0).toUpperCase() || '';
          const lastLetter = questSlice[questSlice.length - 1]?.name.charAt(0).toUpperCase() || '';
          const letterRange = firstLetter === lastLetter ? firstLetter : `[${firstLetter}-${lastLetter}]`;

          const dropdown = new StringSelectMenuBuilder()
            .setCustomId(`questSelect_${i}`)
            .setPlaceholder(`Select a quest ${letterRange}`)
            .addOptions(
              questSlice.map(quest => ({
                label: quest.name,
                description: quest.description ? quest.description.substring(0, 100) : 'No description available',
                value: `quest${quest.id}`
              }))
            );

          components.push(new ActionRowBuilder().addComponents(dropdown));
        }
      }

      // Back button
      const buttonRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`questback`)
          .setLabel("Back")
          .setStyle(ButtonStyle.Danger)
      );
      components.push(buttonRow);

    } else if (stage === 3) {
      // Stage 3: Show quest details
      const quest = db.prepare("SELECT * FROM quest WHERE id = ?").get(selectedQuestId);
      
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
          .setCustomId(`questback-${selectedArea}`)
          .setLabel("Back")
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId(`questcomplete-${selectedQuestId}-${completeTime}`)
          .setLabel("Claim Quest")
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
    console.error(`[quest_ERROR] ${error.message}`, { userId: interaction.user.id });
    
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
    .setName("quest")
    .setDescription("Browse and explore quests by area"),

  allowedButtons: ["questback", "questcomplete"],

  executeCommand: async (interaction) => {
    if (interaction.commandName === "quest") {
      menu(interaction, false, 1);
    }
  },

  handleInteraction: async (client, interaction) => {
    if (interaction.isCommand()) {
      module.exports.executeCommand(interaction);
    } else if (interaction.isStringSelectMenu()) {
      if (interaction.customId === "questAreaSelect") {
        // Area selected - go to stage 2
        menu(interaction, true, 2, interaction.values[0]);
      } else if (interaction.customId.startsWith("questSelect_")) {
        // Quest selected - go to stage 3
        const questId = parseInt(interaction.values[0].replace('quest', ''));
        const quest = db.prepare("SELECT questArea FROM quest WHERE id = ?").get(questId);
        menu(interaction, true, 3, quest?.questArea, questId);
      }
    } else if (interaction.isButton()) {
      const parts = interaction.customId.split('-');
      const action = parts[0];
      
      switch (action) {
        case "questback":
          if (parts.length === 1) {
            // Back to stage 1
            menu(interaction, true, 1);
          } else {
            // Back to stage 2 with area
            const area = parts[1];
            menu(interaction, true, 2, area);
          }
          break;
          
        case "questcomplete":
          // Complete quest - check timing
          const completeTime = parseInt(parts[2]);
          const unixTime = Math.floor(Date.now() / 1000);
          const embeds = [];
          if (unixTime < completeTime) {
            // Not ready yet
            const remainingSeconds = completeTime - unixTime;
            const remainingMinutes = Math.ceil(remainingSeconds / 60);
            
            await interaction.reply({
              content: `You need to wait ${remainingMinutes} more minute${remainingMinutes !== 1 ? 's' : ''} before completing this quest.`,
              flags: MessageFlags.Ephemeral
            });
          } else {

            // Quest completed
            const id = parts[1];
            const quest = db.prepare("SELECT * FROM quest WHERE id = ?").get(id);
            const profession = professionNames[parseInt(quest.professionId) - 1] + "Exp";
            db.transaction(() => {
              //expire items past their duration
              db.prepare(`DELETE FROM inventory WHERE duration < strftime('%s', 'now') AND duration > 31536000 AND userId = ? AND guildId = ?`).run(interaction.user.id, interaction.guildId);
                        
              //reset all items durations
              db.prepare(`UPDATE inventory SET duration = duration - strftime('%s', 'now') WHERE userId = ? AND guildId = ? AND duration > 31536000`).run(interaction.user.id, interaction.guildId);

              // Activate highest profession bonuses
              db.prepare(`
              UPDATE inventory 
              SET duration = duration + strftime('%s', 'now') 
              WHERE userId = ? AND guildId = ? AND professionId != 0
                AND professionBonus = (
                  SELECT MAX(professionBonus) FROM inventory i2 
                  WHERE i2.userId = inventory.userId AND i2.guildId = inventory.guildId 
                  AND i2.professionId = inventory.professionId
                )
              `).run(interaction.user.id, interaction.guildId);

              // Activate highest skill bonuses  
              db.prepare(`
              UPDATE inventory 
              SET duration = duration + strftime('%s', 'now') 
              WHERE userId = ? AND guildId = ? AND skill != 0
                AND skillBonus = (
                  SELECT MAX(skillBonus) FROM inventory i2 
                  WHERE i2.userId = inventory.userId AND i2.guildId = inventory.guildId 
                  AND i2.skill = inventory.skill
                )
              `).run(interaction.user.id, interaction.guildId);
            })();
            // Calculate active bonuses
            const activeItems = db.prepare(`
            SELECT * FROM inventory 
            WHERE userId = ? AND guildId = ? AND duration > 31536000
            `).all(interaction.user.id, interaction.guildId);
            const skillBonuses = [1, 1, 1, 1, 1, 1];
            const professionBonuses = [1, 1, 1]; // artisan, soldier, healer
            let itemString = '';
            const user = db.prepare('SELECT * FROM users WHERE userId = ? AND guildId = ?').get(interaction.user.id, interaction.guildId);
            for (const item of activeItems) {
              skillBonuses[item.skill - 1] = item.skillBonus;
              professionBonuses[item.professionId - 1] = item.professionBonus;
              itemString += item.skillBonus ? `\n- <:emoji:${item.emojiId}> ${item.name} <t:${item.duration}:R>\n - - ${skillNames[user.domainId - 1][item.skill - 1]} +${item.skillBonus}` : '';
              itemString += item.professionBonus ? `\n- <:emoji:${item.emojiId}> ${item.name} <t:${item.duration}:R>\n - - ${professionNames[parseInt(item.professionId) - 1]} X${item.professionBonus}` : '';
            }
            db.prepare(`UPDATE users SET skill1 = skill1 + ?, skill2 = skill2 + ?, skill3 = skill3 + ?, skill4 = skill4 + ?, skill5 = skill5 + ?, skill6 = skill6 + ?, coins = coins + ?, ${profession} = ${profession} + ? WHERE userId = ? AND guildId = ?`)
            .run(quest.skill1, quest.skill2, quest.skill3 , quest.skill4, quest.skill5, quest.skill6, quest.coins, quest.professionXp * professionBonuses[parseInt(quest.professionId) - 1], interaction.user.id, interaction.guildId);
                    const endStats = new EmbedBuilder()
                        .setTitle(`${user.displayName}`)
                        .setThumbnail(interaction.user.displayAvatarURL())
                        .addFields(
                            { name: 'Overall Exp', value: user.overallExp.toString(), inline: true },
                            { name: 'Coins', value: user.coins.toString(), inline: true },
                            { name: 'Party', value: user.partyName || 'None', inline: true },
                            { name: 'Artisan Exp', value: user.artisanExp.toString(), inline: true },
                            { name: 'Soldier Exp', value: user.soldierExp.toString(), inline: true },
                            { name: 'Healer Exp', value: user.healerExp.toString(), inline: true },
                            { name: skillNames[user.domainId - 1][0], value: user.skill1.toString(), inline: true },
                            { name: skillNames[user.domainId - 1][1], value: user.skill2.toString(), inline: true },
                            { name: skillNames[user.domainId - 1][2], value: user.skill3.toString(), inline: true },
                            { name: skillNames[user.domainId - 1][3], value: user.skill4.toString(), inline: true },
                            { name: skillNames[user.domainId - 1][4], value: user.skill5.toString(), inline: true },
                            { name: skillNames[user.domainId - 1][5], value: user.skill6.toString(), inline: true },
                            { name: 'Active Items', value: itemString || 'None', inline: false }
                        )
                        .setTimestamp();
            await interaction.update({
              embeds: [endStats],
                components: []//remove buttons, no extra pressing
            });
            embeds.push(new EmbedBuilder()
              .setTitle(quest.questArea)
              .setDescription(quest.areaDesc || "No description available")
              .setColor(colors[quest.domainId])
              .addFields(
                { name: quest.name, value: quest.description, inline: true },
                { name: `${['Artisan', 'Soldier', 'Healer'][parseInt(quest.professionId) - 1]} XP Earned`, value: `${quest.professionXp}`, inline: true },
                { name: "Quest Coins Earned", value: `🪙 X ${quest.coins}`, inline: true }
              )
              .setAuthor({
                name: user.displayName,
                iconURL: interaction.user.displayAvatarURL({ dynamic: true }) // their avatar
              })
            );
            if(quest.beastiary === null) {
                const relicNoMonster = db.prepare('SELECT * FROM relic where id = ? ORDER BY RANDOM() LIMIT 1').get(quest.relic);
                if (Math.random() < relicNoMonster.chance) {
                  let bonusResult = '';
                  if(relicNoMonster.bonusXp) {
                    db.prepare('INSERT INTO inventory (userId, guildId, name, skillBonus, skill, duration, iconURL) VALUES (?, ?, ?, ?, ?, ?, ?)')
                      .run(interaction.user.id, interaction.guildId, relicNoMonster.name, relicNoMonster.skillBonus, relicNoMonster.skill, relicNoMonster.duration, `relicNoMonster.emojiId`);
                    const profBonus = professionNames[parseInt(relicNoMonster.professionId) - 1];
                    if (relicNoMonster.bonusXp < 9) {
                      db.prepare('INSERT INTO inventory (userId, guildId, name, skillBonus, skill, duration, emojiId) VALUES (?, ?, ?, ?, ?, ?, ?)')
                      .run(interaction.user.id, interaction.guildId, relicNoMonster.name, relicNoMonster.skillBonus, relicNoMonster.skill, relicNoMonster.duration, relicNoMonster.emojiId);
                      bonusResult = `\nX${relicNoMonster.bonusXp} ${profBonus} Effect lasts ${formatTime(relicNoMonster.duration)}`;
                    } else {
                      bonusResult = `\n+${relicNoMonster.bonusXp} ${profBonus} XP`;
                      db.prepare(`UPDATE users SET ${profBonus}Exp = ${profBonus}Exp + ? WHERE userId = ? AND guildId = ?`).run(relicNoMonster.bonusXp * professionBonuses[parseInt(relicNoMonster.professionId) - 1], interaction.user.id, interaction.guildId);
                    }
                  }
                  embeds.push(new EmbedBuilder()
                    .setAuthor({
                      name: "Relic Found!",
                      iconURL: `https://cdn.discordapp.com/emojis/${relicNoMonster.emojiId}.webp`
                    })
                    .setTitle(relicNoMonster.name)
                    .setDescription(relicNoMonster.description+bonusResult)
                    .setColor(0x996515)
                  );
                }

            } else {
                const beast = quest.beastiary ? db.prepare('SELECT * FROM beastiary where id = ? ORDER BY RANDOM() LIMIT 1').get(quest.beastiary) : null;
                if(Math.random() < beast.chance) {
                    //peril
                    function skillMod(skill){ return Math.floor(Math.min(20, Math.max(1, skill))); }
                    embeds.push(new EmbedBuilder()
                      .setDescription(`As you embark on your quest, a sudden peril befalls you!\nYou encounter a **${beast.entity}**!\n*${beast.entityEffect}*`)
                      .setColor(0xa6ce2a)
                      .setAuthor({
                        name: `The ${beast.entity}`,
                        iconURL: beast.iconURL ||'https://cdn.discordapp.com/emojis/1421265406081110046.webp'
                      }));
                    const difficulty = [0.01,0.75,0.9, 1.05][parseInt(beast.difficulty)];
                    const attack = skillMod(user.skill3) + skillBonuses[3-1];
                    const defense = skillMod(user.skill4) + skillBonuses[4-1];
                    const hp = skillMod(user.skill5);

                    const monsterAttack = skillMod(user.skill3) * difficulty;
                    const monsterDefense = skillMod(user.skill4) * difficulty;
                    let userHitpoints = hp;
                    let monsterHitpoints = hp * difficulty;
                    let battleLog = `Monster Attack: ${monsterAttack.toFixed(2)}, Defense: ${monsterDefense.toFixed(2)}, Hitpoints: ${monsterHitpoints.toFixed(2)}\n`;
                    battleLog += `Your Attack: ${attack.toFixed(2)}, Defense: ${defense.toFixed(2)}, Hitpoints: ${userHitpoints.toFixed(2)}\n`;
                    //battle loop
                    let i = 0;
                    while(monsterHitpoints > 0 && userHitpoints > 0) {
                      const userd20attack = Math.floor(Math.random()*20) + 1 + attack;
                      const monsterd20defense = Math.floor(Math.random()*20) + 1 + monsterDefense;
                        if(userd20attack >= monsterd20defense) {
                            //hit
                            const monsterDamage = (userd20attack - monsterd20defense) / 2;
                            battleLog += `You hit the ${beast.entity} for ${monsterDamage.toFixed(2)}/${monsterHitpoints.toFixed(2)} damage!\n`;
                            monsterHitpoints -= monsterDamage;
                        } else {
                            battleLog += `You miss the ${beast.entity}!\n`;
                        }
                        if(monsterHitpoints <= 0) break;
                        //monster turn
                        const monsterD20attack = Math.floor(Math.random() * 20) + 1 + monsterAttack;
                        const userd20defense = Math.floor(Math.random() * 20) + 1 + defense;
                        if(i>6) {
                          battleLog += `The ${beast.entity} hits you for ${userHitpoints.toFixed(2)}/${userHitpoints.toFixed(2)} damage!\n`;
                          userHitpoints = 0;
                          break;
                        };
                        if(monsterD20attack >= userd20defense) {
                            //hit
                            const userDamage = (monsterD20attack - (userd20defense)) / 2;
                            battleLog += `The ${beast.entity} hits you for ${userDamage.toFixed(2)}/${userHitpoints.toFixed(2)} damage!\n`;
                            userHitpoints -= userDamage;
                        } else {
                            battleLog += `The ${beast.entity} misses you!\n`;
                        }
                        if(userHitpoints <= 0) break;
                        i++;
                    };
                    let battleField = [];
                    if(userHitpoints <= 0) {
                        //user lost
                        battleField.push({ name: "Defeat", value: `The ${beast.entity} lands a perilous blow. Thou retreatest in defeat!`});
                        embeds.push(new EmbedBuilder()
                            .setAuthor({
                              name: "Battle",
                              iconURL: 'https://cdn.discordapp.com/emojis/1421265514474504353.webp'
                            })
                            .setDescription(battleLog)
                            .setColor(0x8b0000)
                            .addFields(battleField)
                        );
                    } else {
                        //user won
                        battleField.push({ name: "Victory", value: `The ${beast.entity} has been vanquished!`});
                        const beastCoin = Math.floor(quest.coins * ((beast.difficulty * 0.3) + (0.5 * Math.random())));
                        db.prepare(`UPDATE users SET coins = coins + ? WHERE userId = ? AND guildId = ?`).run(beastCoin, interaction.user.id, interaction.guildId);
                        battleField.push({ name: "Monster Coins Earned", value: `🪙 X ${beastCoin}`, inline: true });
                          embeds.push(new EmbedBuilder()
                            .setAuthor({
                              name: "Battle",
                              iconURL: 'https://cdn.discordapp.com/emojis/1421265514474504353.webp'
                            })
                            .setDescription(battleLog)
                            .setColor(0x8b0000)
                            .addFields(battleField)
                        );
                        const relic = quest.relic ? db.prepare('SELECT * FROM relic where id = ? ORDER BY RANDOM() LIMIT 1').get(quest.relic) : null;
                        if(relic && Math.random() < relic.chance) {
                            embeds.push(new EmbedBuilder()
                              .setTitle(relic.name)
                              .setDescription(relic.description)
                              .setColor(0x996515)
                              .setAuthor({
                                name: "Relic Found!",
                                iconURL: relic.iconURL ||'https://cdn.discordapp.com/emojis/1421265478331928646.webp'
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
    console.log("Slash commands for quest module have been loaded.");
  }
};