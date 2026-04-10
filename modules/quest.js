const {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  EmbedBuilder,
  MessageFlagsBitField,
  PermissionFlagsBits
} = require('discord.js');
const wait = require('node:timers/promises').setTimeout;
const sqlite3 = require('better-sqlite3');
//const db = new sqlite3('db/dungeonbard.db');
const db = new sqlite3('db/dungeonbard.db', { verbose: console.log });
const MessageFlags = MessageFlagsBitField.Flags;
const colors = db.prepare("SELECT id, background FROM domains ORDER BY id").all().map(r => r.background);
colors.unshift(0x000000);
const crypto = require('crypto');
//const character = require('./character');
const key = require('../config.json').key;

const { skillNames, skillLevel, profNames, profLevel } = require('../assets/levels');

const dbQuery = {
  delExpired: db.prepare(`DELETE FROM inventory WHERE duration < strftime('%s', 'now') AND duration > 31536000 AND userId = ? AND guildId = ?`),
  setActive: db.prepare(`UPDATE inventory SET duration = duration - strftime('%s', 'now') WHERE userId = ? AND guildId = ? AND duration > 31536000`),
  profBonus: db.prepare(`UPDATE inventory SET duration = duration + strftime('%s', 'now') WHERE userId = ? AND guildId = ? AND professionId != 0 AND professionBonus = (SELECT MAX(professionBonus) FROM inventory i2 WHERE i2.userId = inventory.userId AND i2.guildId = inventory.guildId AND i2.professionId = inventory.professionId)`),
  skillBonus: db.prepare(`UPDATE inventory SET duration = duration + strftime('%s', 'now') WHERE userId = ? AND guildId = ? AND skill != 0 AND skillBonus = (SELECT MAX(skillBonus) FROM inventory i2 WHERE i2.userId = inventory.userId AND i2.guildId = inventory.guildId AND i2.skill = inventory.skill)`),
  getActiveItems: db.prepare(`SELECT * FROM inventory WHERE userId = ? AND guildId = ? AND duration > 31536000`),
  getUser: db.prepare('SELECT * FROM users WHERE userId = ? AND guildId = ?'),
  getUserDataRandom: db.prepare('SELECT * FROM users WHERE userId = ? ORDER BY RANDOM() LIMIT 1'),
  getQuestAreaById: db.prepare("SELECT questArea FROM quest WHERE id = ?"),
  getQuestById: db.prepare("SELECT * FROM quest WHERE id = ?"),
  getRandomRelic: db.prepare('SELECT * FROM relic where id = ? ORDER BY RANDOM() LIMIT 1'),
  addToInventory: db.prepare('INSERT INTO inventory (userId, guildId, name, skillBonus, skill, duration, emojiId) VALUES (?, ?, ?, ?, ?, ?, ?)'),
  getRandomBeast: db.prepare('SELECT * FROM beastiary where type = ? ORDER BY RANDOM() LIMIT 1'),
  addCoins: db.prepare(`UPDATE users SET coins = coins + ? WHERE userId = ? AND guildId = ?`),
  getOneDistinctQuestArea: db.prepare("SELECT DISTINCT questArea, areaDesc FROM quest WHERE questArea = ? LIMIT 1"),
  getQuestsInArea: db.prepare("SELECT id, name, description FROM quest WHERE questArea = ? AND domainId IN (0, ?) ORDER BY name ASC"),
  getDomain: db.prepare("SELECT domainId FROM users WHERE userId = ? AND guildId = ?"),
  getDistinctQuestArea: db.prepare("SELECT DISTINCT questArea,areaDesc FROM quest WHERE questArea IS NOT NULL AND domainId IN (0, ?) ORDER BY questArea ASC"),
  insertQuestUser: db.prepare(`INSERT OR REPLACE INTO users (userId, guildId, displayName, avatarFile, domainId) VALUES (?, ?, ?, ?, ?)`),
  getAllDomains: db.prepare('SELECT id, title, description FROM domains ORDER BY id'),
  storeQuest: db.prepare(`
      INSERT INTO questTracker (
        guildId, userId, encryptedUserId, domainId, questId, 
        artisanExp, soldierExp, healerExp, overallExp, 
        artisanExpGained, soldierExpGained, healerExpGained, expGained, 
        skill1, skill2, skill3, skill4, skill5, skill6, 
        sawMonster, beatMonster, relic, quantity
      ) 
      SELECT 
        ?, ?, ?, ?, ?, 
        u.artisanExp, u.soldierExp, u.healerExp, u.overallExp, 
        (u.artisanExp - ?), (u.soldierExp - ?), (u.healerExp - ?), (u.overallExp - ?), 
        u.skill1, u.skill2, u.skill3, u.skill4, u.skill5, u.skill6, 
        ?, ?, ?, ? 
      FROM users u 
      WHERE u.userId = ? AND u.guildId = ?
    `)
};
const allDomains = dbQuery.getAllDomains.all();
const professionNames = ["Artisan", "Soldier", "Healer"];
function formatTime(seconds) {
  const days = Math.floor(seconds / 86400); // 86400 = 24*60*60
  const hours = Math.floor((seconds % 86400) / 3600);

  if (days > 0) return `${days} day${days !== 1 ? "s" : ""}`;
  if (hours > 0) return `${hours} hour${hours !== 1 ? "s" : ""}`;
  return `${Math.floor(seconds / 60)} minute${seconds >= 120 ? "s" : ""}`;
}
/*function logQuest(log) {
  setImmediate(() => {
    if(log.userId === '454459089720967168') return; //skip logging for testing account
    const hmac = crypto.createHmac('sha256', key);
    hmac.update(log.userId.toString());

    dbQuery.storeQuest.run(log.guildId, hmac.digest('hex'), log.domain, log.quest, log.sawMonster, log.beatMonster, log.relic);
  })
};
*/
function logQuest(log) {
  setImmediate(() => {

    const encryptedId = crypto.createHmac('sha256', key)
      .update(log.userId.toString())
      .digest('hex');

    // Total of 15 arguments to match the 15 '?' in the SQL above
    dbQuery.storeQuest.run(
      log.guildId,        // ? #1: guildId
      log.userId,         // ? #2: userId
      encryptedId,        // ? #3: encryptedUserId
      log.domainId,       // ? #4: domainId
      log.questId,        // ? #5: questId
      
      // The "Old" XP amounts passed to subtract from the "New" ones
      log.artisanExp,     // ? #6: (u.artisanExp - ?)
      log.soldierExp,     // ? #7: (u.soldierExp - ?)
      log.healerExp,      // ? #8: (u.healerExp - ?)
      log.overallExp,     // ? #9: (u.overallExp - ?)
      
      log.sawMonster,     // ? #10: sawMonster
      log.beatMonster,    // ? #11: beatMonster
      log.relic,          // ? #12: relic
      log.quantity,       // ? #13: quantity
      
      log.userId,         // ? #14: WHERE u.userId = ?
      log.guildId         // ? #15: WHERE u.guildId = ?
    );
  });
}
function checkLevelUp(interaction, userBefore) {
// 1. Get the guild from cache
const guild = interaction.guild;
    if (!guild) return;
    const channel = guild.channels.cache.find(c => c.name === "📜-ledger-of-triumphs");
    if (!channel) return;
    // 2. Check Permissions (View and Send)
    const perms = channel.permissionsFor(guild.members.me);
    if (!perms || !perms.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages])) {
        return;
    }
    const botPermissions = channel.permissionsFor(guild.members.me);
    if (!botPermissions || !botPermissions.has(PermissionFlagsBits.SendMessages)) {
        return;
    }

    // --- Proceed with your level check logic ---
    const userAfter = dbQuery.getUser.get(userBefore.userId, userBefore.guildId);
    if (!userAfter) return;
    const userPing = `<@${userAfter.userId}>`;

    // 1. Check Profession Levels (Artisan, Soldier, Healer)
    const pThresholds = profLevel[userAfter.domainId];
    ['artisan', 'soldier', 'healer'].forEach(prof => {
        const key = `${prof}Exp`;
        const oldLvl = pThresholds.filter(t => userBefore[key] >= t).length;
        const newLvl = pThresholds.filter(t => userAfter[key] >= t).length;

        if (newLvl > oldLvl) {
            const rankName = profNames[prof][newLvl - 1] || "Max";
            const profLabel = prof.charAt(0).toUpperCase() + prof.slice(1);
            channel.send({ 
                content: `${userPing} has levelled in the ${profLabel} profession. Their new rank is: **${rankName}**. Congratulations!` 
            }).catch(err => console.error(`Failed to send prof level-up: ${err}`));
        }
    });

    // 2. Check Skill Levels (1 - 6)
    const sThresholds = skillLevel[userAfter.domainId];
    for (let i = 1; i <= 6; i++) {
        const key = `skill${i}`;
        const oldLvl = sThresholds.filter(t => userBefore[key] >= t).length;
        const newLvl = sThresholds.filter(t => userAfter[key] >= t).length;

        if (newLvl > oldLvl) {
            const skillTitle = skillNames[userAfter.domainId - 1][i - 1];
            channel.send({ 
                content: `${userPing} has just levelled the skill of **${skillTitle}**. Their new level is **${newLvl}**.` 
            }).catch(err => console.error(`Failed to send skill level-up: ${err}`));
          }
    }
}
async function menu(interaction, isUpdate, stage = 1, selectedArea = null, selectedQuestId = null, count = 1) {
  try {
    let embed;
    let components = [];
    const domain = dbQuery.getDomain.pluck().get(interaction.user.id, interaction.guildId);
    if(!domain) {
      // Show domain selection for quest enrollment
      const questDomainEmbed = new EmbedBuilder()
        .setTitle("Quest Registration")
        .setDescription("Select your starting domain to begin questing:")
        .setColor(0x5865F2);
      
      const questDomainDropdown = new StringSelectMenuBuilder()
        .setCustomId("questDomainSelect")
        .setPlaceholder("Choose your domain")
        .addOptions(
          allDomains.map(d => ({
            label: d.title,
            description: d.description,
            value: String(d.id)
          }))
        );
      
      return interaction.reply({
        embeds: [questDomainEmbed],
        components: [new ActionRowBuilder().addComponents(questDomainDropdown)],
        flags: MessageFlags.Ephemeral
      });
    }
    const embedColor = colors[domain];
    if (stage === 1) {
      // Stage 1: Show quest areas
      embed = new EmbedBuilder()
        .setTitle("Quest Explorer")
        .setDescription("Choose a quest area to explore:")
        .setColor(embedColor);
      const questAreas = dbQuery.getDistinctQuestArea.all(domain);
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
      const areaData = dbQuery.getOneDistinctQuestArea.get(selectedArea);
      embed = new EmbedBuilder()
        .setTitle(selectedArea)
        .setDescription(areaData?.areaDesc || "Select a quest:")
        .setColor(embedColor);

      const quests = dbQuery.getQuestsInArea.all(selectedArea, domain);

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
      const quest = dbQuery.getQuestById.get(selectedQuestId);

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
      //const maxCount = currentTime + (quest.waitTime || 0);
      const multiples = (quest.maxCount < count) ? 1 : count;
      const buttonRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`questback-${selectedArea}`)
          .setLabel("Back")
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId(`questcomplete-${selectedQuestId}-${multiples}`)
          .setLabel("Claim Quest x"+multiples)
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId(`maxCount-${selectedQuestId}-${multiples}`)
          .setLabel("+1")
          .setDisabled(quest.maxCount === 1)
          .setStyle(ButtonStyle.Primary)
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
    .setDescription("Browse and explore quests by area")
    .setIntegrationTypes([ 'GuildInstall']),

  allowedButtons: ["questback", "questcomplete", "maxCount"],

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
    } else if (interaction.customId === "questDomainSelect") {
        // Quick quest registration
        const questDomainId = parseInt(interaction.values[0]);
        const questDisplayName = interaction.member?.nick || interaction.user.displayName || interaction.user.globalName || interaction.user.username;
        
        console.log("*********************************",questDisplayName);

        dbQuery.insertQuestUser.run(interaction.user.id, interaction.guildId, questDisplayName, null, questDomainId);
        
        setImmediate(() => {
          require('./character').updateRoles(interaction, questDomainId);
          const questAvatarURL = interaction.user.displayAvatarURL().replace(/\/a_/, '/').replace(/\.[a-zA-Z]{3,4}$/, '') + '.png?size=64';
          const questAvatarFile = questAvatarURL.split('/').pop().split('?')[0];
          db.prepare('UPDATE users SET avatarFile = ? WHERE userId = ? AND guildId = ?').run(questAvatarFile, interaction.user.id, interaction.guildId);
        });
        
        // Continue to quest menu
        menu(interaction, true, 1);
      } else if (interaction.customId.startsWith("questSelect_")) {
        // Quest selected - go to stage 3
        const questId = interaction.values[0].replace('quest', '');
        const quest = dbQuery.getQuestAreaById.get(questId);
        menu(interaction, true, 3, quest?.questArea, questId);
      }
    } else if (interaction.isButton()) {
      const parts = interaction.customId.split('-');
      const action = parts[0];
      
      switch (action) {
        case "questback":
          if(parts[1]) {
            // Back to stage 2 with area
            //async function menu(interaction, isUpdate, stage = 1, selectedArea = null, selectedQuestId = null) {

            const area = parts[1];
            menu(interaction, true, 2, area);
          } else {
            // Back to stage 1
            menu(interaction, true, 1);
          }
          break;
        case "maxCount":
          const mcQuestId = parts[1];
          const mcCount = parseInt(parts[2]);
          const mcQuest = dbQuery.getQuestAreaById.get(mcQuestId);
          menu(interaction, true, 3, mcQuest?.questArea, mcQuestId, mcCount+1);
          break;
        case "questcomplete":
          // Complete quest - check timing
          const multiple = parseInt(parts[2]);
          const embeds = [];
            // Quest completed
            const id = parts[1];
            const quest = dbQuery.getQuestById.get(id);

            const profession = professionNames[parseInt(quest.professionId) - 1] + "Exp";
            db.transaction(() => {
              //expire items past their duration
              dbQuery.delExpired.run(interaction.user.id, interaction.guildId);

              //reset all items durations
              dbQuery.setActive.run(interaction.user.id, interaction.guildId);

              // Activate highest profession bonuses

              dbQuery.profBonus.run(interaction.user.id, interaction.guildId);

              // Activate highest skill bonuses  
              dbQuery.skillBonus.run(interaction.user.id, interaction.guildId);
            })();

            // Calculate active bonuses
            const activeItems = dbQuery.getActiveItems.all(interaction.user.id, interaction.guildId);
            const skillBonuses = [1, 1, 1, 1, 1, 1];
            const professionBonuses = [1, 1, 1]; // artisan, soldier, healer
            let itemString = '';
            const user = dbQuery.getUser.get(interaction.user.id, interaction.guildId);
            const log = { 
              guildId: interaction.guildId,
              userId: interaction.user.id,
              domainId: quest.domainId,
              questId: id,
              sawMonster: 0,
              beatMonster: null,
              relic: null,
              quantity: multiple,
              artisanExp: user.artisanExp,
              soldierExp: user.soldierExp,
              healerExp: user.healerExp,
              overallExp: user.overallExp
            };
            setImmediate(() => {checkLevelUp(interaction, user)});
            for (const item of activeItems) {
              skillBonuses[item.skill - 1] = item.skillBonus;
              professionBonuses[item.professionId - 1] = item.professionBonus;
              itemString += item.skillBonus ? `\n- <:${item.name.replace(/[^a-zA-Z]/g, '')}:${item.emojiId}> ${item.name}\n - - ${skillNames[user.domainId - 1][item.skill - 1]} +${item.skillBonus} *Expires* <t:${item.duration}:R>` : '';
              itemString += item.professionBonus ? `\n- <:${item.name.replace(/[^a-zA-Z]/g, '')}:${item.emojiId}> ${item.name}\n - - ${professionNames[parseInt(item.professionId) - 1]} X${item.professionBonus} *Expires* <t:${item.duration}:R>` : '';
            }
            db.prepare(`UPDATE users SET skill1 = skill1 + ?, skill2 = skill2 + ?, skill3 = skill3 + ?, skill4 = skill4 + ?, skill5 = skill5 + ?, skill6 = skill6 + ?, coins = coins + ?, ${profession} = ${profession} + ? WHERE userId = ? AND guildId = ?`)
            .run(quest.skill1 * multiple, quest.skill2 * multiple, quest.skill3 * multiple, quest.skill4 * multiple, quest.skill5 * multiple, quest.skill6 * multiple, quest.coins * multiple, quest.professionXp * professionBonuses[parseInt(quest.professionId) - 1] * multiple, interaction.user.id, interaction.guildId);
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
                { name: `${['Artisan', 'Soldier', 'Healer'][parseInt(quest.professionId) - 1]} XP Earned`, value: `${quest.professionXp * multiple}`, inline: true },
                { name: "Quest Coins Earned", value: `🪙 X ${quest.coins * multiple}`, inline: true }
              )
              .setAuthor({
                name: user.displayName,
                iconURL: interaction.user.displayAvatarURL({ dynamic: true }) // their avatar
              })
            );
            if(quest.beastiary === null) {
                const relicNoMonster = dbQuery.getRandomRelic.get(quest.relic);
                if (Math.random() < relicNoMonster.chance) {
                  log.relic = `${quest.relic}: ${relicNoMonster.description}`;
                  let bonusResult = '';
                  if(relicNoMonster.bonusXp) {
                    const profBonus = professionNames[parseInt(relicNoMonster.professionId) - 1];
                    if (relicNoMonster.bonusXp < 9) {
                      dbQuery.addToInventory.run(interaction.user.id, interaction.guildId, relicNoMonster.name, relicNoMonster.skillBonus, relicNoMonster.skill, relicNoMonster.duration, relicNoMonster.emojiId);
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
                const beast = quest.beastiary ? dbQuery.getRandomBeast.get(quest.beastiary) : null;
                if(Math.random() < beast.chance || interaction.user.id === '454459089720967168') {
                    //peril
                    log.sawMonster = 1;
                    //function skillMod(skill){ return Math.floor(Math.min(20, Math.max(1, skill))); }
                    function skillMod(domainId, skill) { return (20 - skillLevel[domainId].findIndex(val => val <= skill)) }
                    embeds.push(new EmbedBuilder()
                      .setDescription(`As you embark on your quest, a sudden peril befalls you!\nYou encounter a **${beast.entity}**!\n*${beast.entityEffect}*`)
                      .setColor(0xa6ce2a)
                      .setAuthor({
                        name: `The ${beast.entity}`,
                        iconURL: beast.emojiId ? `https://cdn.discordapp.com/emojis/${beast.emojiId}.webp` : 'https://cdn.discordapp.com/emojis/1421265406081110046.webp'
                      }));
                    const difficulty = [0.01,0.75,0.9, 1.05][parseInt(beast.difficulty)];
                    const attack = skillMod(user.domainId, user.skill3) + skillBonuses[3-1];
                    const defense = skillMod(user.domainId, user.skill4) + skillBonuses[4-1];
                    const hp = skillMod(user.domainId, user.skill5);

                    const monsterAttack = skillMod(user.domainId, user.skill3) * difficulty;
                    const monsterDefense = skillMod(user.domainId, user.skill4) * difficulty;
                    //set hitpoints
                    let userHitpoints = hp;
                    let monsterHitpoints = hp * difficulty;
                    let battleLog = `Monster Attack: ${monsterAttack.toFixed(2)}, Defense: ${monsterDefense.toFixed(2)}, Hitpoints: ${monsterHitpoints.toFixed(2)}\n`;
                    battleLog += `Your Attack: ${attack.toFixed(2)}, Defense: ${defense.toFixed(2)}, Hitpoints: ${userHitpoints.toFixed(2)}\n`;
                    //battle loop
                    let i = 0;
                    while(monsterHitpoints > 0 && userHitpoints > 0) {
                      const userd20attack = Math.floor(Math.random()*20) + attack;
                      const monsterd20defense = Math.floor(Math.random()*20) + monsterDefense;
                        if(userd20attack >= monsterd20defense) {
                            //hit
                            const monsterDamage = (userd20attack - monsterd20defense) / 2;
                            battleLog += `You hit the **${beast.entity}** for ${monsterDamage.toFixed(2)}/${monsterHitpoints.toFixed(2)} damage!\n`;
                            monsterHitpoints -= monsterDamage;
                        } else {
                            battleLog += `You miss the **${beast.entity}**!\n`;
                        }
                        if(monsterHitpoints <= 0) break;
                        //monster turn
                        const monsterD20attack = (i > 5) ? 20 : Math.floor(Math.random() * 20 ) + monsterAttack;
                        const userd20defense = Math.floor(Math.random() * 20) + defense;
                        if(i>7) {
                          battleLog += `The **${beast.entity}** hits you for ${userHitpoints.toFixed(2)}/${userHitpoints.toFixed(2)} damage!\n`;
                          userHitpoints = 0;
                          break;
                        };
                        if(monsterD20attack >= userd20defense) {
                            //hit
                            const userDamage = (monsterD20attack - (userd20defense)) / 2;
                            battleLog += `The **${beast.entity}** hits you for ${userDamage.toFixed(2)}/${userHitpoints.toFixed(2)} damage!\n`;
                            userHitpoints -= userDamage;
                        } else {
                            battleLog += `The **${beast.entity}** misses you!\n`;
                        }
                        if(userHitpoints <= 0) break;
                        i++;
                    };
                    let battleField = [];
                    if(userHitpoints <= 0) {
                        //user lost
                        battleField.push({ name: "Defeat", value: `The **${beast.entity}** lands a perilous blow. Thou retreatest in defeat!`});
                        embeds.push(new EmbedBuilder()
                            .setAuthor({
                              name: "Battle",
                              iconURL: 'https://cdn.discordapp.com/emojis/1421265514474504353.webp'
                            })
                            .setDescription(battleLog)
                            .setColor(0x8b0000)
                            .addFields(battleField)
                        );
                        log.beatMonster = 0;
                    } else {
                        //user won
                        log.beatMonster = 1;
                        battleField.push({ name: "Victory", value: `The **${beast.entity}** has been vanquished!`});
                        const beastCoin = Math.floor(quest.coins * ((beast.difficulty * 0.3) + (0.5 * Math.random())));
                        dbQuery.addCoins.run(beastCoin, interaction.user.id, interaction.guildId);
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
                        const relic = dbQuery.getRandomRelic.get(quest.relic);
                        if(quest.relic && Math.random() < relic.chance) {
                          log.relic = `${quest.relic}: ${relic.description}`;  
                            embeds.push(new EmbedBuilder()
                              .setTitle(relic.name)
                              .setDescription(relic.description)
                              .setColor(0x996515)
                              .setAuthor({
                                name: "Relic Found!",
                                iconURL: `https://cdn.discordapp.com/emojis/${relic.emojiId}.webp`
                              })
                            );
                        }

                    };
                }
            }
            //await wait(1000);
            interaction.followUp({
              embeds
            });
            logQuest(log);
          break;
      }
    }
  },

  main: (client) => {
    console.log("Slash commands for quest module have been loaded.");
  }
};