const { SlashCommandBuilder, MessageFlagsBitField } = require('discord.js');
const MessageFlags = MessageFlagsBitField.Flags;

// Type numbers used in button ids. Kept the name `houses` from sortinghat.js so the two modules read the same.
const houses = {
  1: { name: 'The Sandbagger', emoji: '🎭', color: 0x6b7280, text: 'Looks harmless. Isn\'t. Keeps their level low so every match is an easy win.' },
  2: { name: 'The Drill Sergeant', emoji: '📢', color: 0xb91c1c, text: 'Born to lead, whether or not anyone asked. Will tell you exactly what you did wrong.' },
  3: { name: 'The Community Builder', emoji: '🤝', color: 0x16a34a, text: 'The reason the group still exists. Welcomes newcomers, keeps the peace.' },
  4: { name: 'The Theorycrafter', emoji: '📊', color: 0x2563eb, text: 'Has a spreadsheet for that. Knows the numbers better than the developers.' },
  5: { name: 'The Noob', emoji: '🐣', color: 0xf59e0b, text: 'Pure chaos, no plan, somehow still having the most fun.' },
  6: { name: 'The Hitchhiker', emoji: '👍', color: 0x0d9488, text: 'Along for the ride. Always has a spare slot to fill and a favour to ask.' },
  7: { name: 'The Whale', emoji: '🐋', color: 0x0891b2, text: 'Why grind when you can buy? Has every limited edition item.' },
  8: { name: 'The Loss Farmer', emoji: '🌾', color: 0xa16207, text: 'Signs up, barely shows up, collects the rewards anyway. Your five-day match, their free points.' }
};
// Result when 4 or more types tie. Not selectable as an answer, so it is kept out of `houses`.
const wildcard = { name: 'The Wildcard', emoji: '🃏', color: 0x7c3aed, text: 'Every type and none of them. Nobody knows what you will do next, including you.' };

// Embed images are served from the GitHub repo (raw files), so nothing is uploaded with the message.
const imageUrl = 'https://raw.githubusercontent.com/CapricanDRJ/DungeonBard/main/assets/gamertype/';
const images = [
  [ // [0] questions, same order as the questions array below
    'q1.png', // new event
    'q2.png', // log in
    'q3.png', // team lost
    'q4.png', // help in chat
    'q5.png', // inventory
    'q6.png', // chat message
    'q7.png', // superpower
    'q8.png'  // snack
  ],
  [ // [1] results, index = type number - 1, then the wildcard at index 8
    'sandbagger.png',
    'drillsergeant.png',
    'communitybuilder.png',
    'theorycrafter.png',
    'noob.png',
    'hitchhiker.png',
    'whale.png',
    'lossfarmer.png',
    'wildcard.png'
  ]
];

// Returns the embed image. files is always empty, kept so the callers match sortinghat.js.
function attach(file) {
  if (!file) return { image: undefined, files: [] };
  return { image: { url: imageUrl + file }, files: [] };
}

// Ordered most important first. a[0] is type 1, a[1] is type 2, etc.
// weight is the multiplier x10 (18 = 1.8). Only used to rank types that tie on answer count.
const questions = [
  { q: 'A new event drops. What is your first move?', weight: 18, a: ['Work out how to get the easy matches first', 'Assign everyone a role in the group chat', 'Post a guide so newcomers can join in', 'Open a spreadsheet and find the best strategy', 'Click play and figure it out as I go', 'Ask who is running it so I can tag along', 'Check the shop for the event bundle', 'Sign up, then barely show up'] },
  { q: 'What gets you to log in?', weight: 17, a: ['An easy win waiting for me', 'My team needs leading', 'Seeing my friends online', 'A new patch to analyse', 'Finally finishing the tutorial', 'Someone said they would carry me today', 'A new item in the shop', 'Just enough to not get kicked'] },
  { q: 'Your team just lost. You:', weight: 16, a: ['Unlikely. I only play teams I know I can beat', 'Explain, loudly, whose fault it was', 'Tell everyone it was a good try', 'Review the replay and find the exact mistake', 'Wait, we lost?', 'Ask the winners if I can join them next time', 'Buy a boost for next round', 'Right on schedule'] },
  { q: 'Someone asks for help in chat. You:', weight: 15, a: ['Give advice, but keep my best trick to myself', 'Tell them exactly what to do, and expect it done', 'Drop everything and walk them through it', 'Link them a 40-page guide', 'Ask the same question right after them', 'Ask if they have anything spare while they are here', 'Tell them to just buy the upgrade', 'Tell them not to try so hard, it is only a game'] },
  { q: 'Your inventory looks like:', weight: 14, a: ['Suspiciously low-level gear and one maxed item', 'Exactly what the team needs, as I decided', 'Spare items I keep for giving away', 'Sorted, labelled and optimised', 'Full of stuff I have never used', 'Mostly gifts from other people', 'Everything, including the limited editions', 'Rewards from matches I never really played'] },
  { q: 'Your favourite chat message:', weight: 13, a: ['"gg ez"', '"Everyone, on me. Now."', '"Welcome to the server!"', '"Actually, the math says..."', '"how do I open the map"', '"anyone have spare resources?"', '"just bought it lol"', '"brb" (never comes back)'] },
  { q: 'Pick a superpower.', weight: 12, a: ['Look weaker than you are', 'Everyone obeys your orders', 'Make friends with anyone', 'See every hidden stat', 'Survive on pure luck', 'Get credit for other people\'s work', 'Infinite money', 'Be in five matches at once, doing nothing in all'] },
  { q: 'Pick a game night snack.', weight: 11, a: ['A plain-looking chip that is secretly the spiciest', 'Energy drink, no breaks', 'A big platter for everyone', 'Measured portions for peak focus', 'Cereal straight from the box', 'Whatever someone else brought', 'Delivery for the whole group, I\'m paying', 'A three-course meal, taken mid-match'] }
];

// Builds the message for question number `step` (0 based). Each button id is the answers so far plus its type.
function questionMessage(prefix, step) {
  const item = questions[step];
  const order = [1, 2, 3, 4, 5, 6, 7, 8];
  for (let i = order.length - 1; i > 0; i--) { // shuffle display order so the first button is not always the same type
    const j = Math.floor(Math.random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  const buttons = order.map(h => ({ type: 2, style: 2, custom_id: `${prefix}_${h}`, label: item.a[h - 1] }));
  const img = attach(images[0][step]);
  return {
    embeds: [{
      title: `Question ${step + 1} of ${questions.length}`,
      description: item.q,
      color: 0x7c3aed,
      image: img.image
    }],
    files: img.files,
    attachments: [],
    components: [ // max 5 buttons per row, so two rows of 4
      { type: 1, components: buttons.slice(0, 4) },
      { type: 1, components: buttons.slice(4) }
    ]
  };
}

// Most answers wins. A tie of 2 or 3 types gives a combo of the top 2, ranked by weighted total,
// then by who won the highest-ranked question. A tie of 4 or more returns null (the Wildcard).
function sortHouse(answers) {
  const count = {}, weight = {};
  answers.forEach((h, i) => { count[h] = (count[h] || 0) + 1; weight[h] = (weight[h] || 0) + questions[i].weight; });
  const top = Math.max(...Object.values(count));
  const tied = Object.keys(count).map(Number).filter(h => count[h] === top);
  if (tied.length >= 4) return null;
  return tied.sort((a, b) => (weight[b] - weight[a]) || (answers.indexOf(a) - answers.indexOf(b))).slice(0, 2);
}

module.exports = {
  commandData: new SlashCommandBuilder()
    .setName('gamertype')
    .setDescription('Find out what kind of gamer you are')
    .setIntegrationTypes([0, 1])// 0 = guild, 1 = user
    .setContexts([0, 1, 2]),// 0 = guild, 1 = dm, 2 = group dm

  allowedButtons: new Set(['gamertype']),

  handleInteraction: async (client, interaction, customId) => {
    try {
      if (interaction.isCommand() && interaction.commandName === 'gamertype') {
        return await interaction.reply({ ...questionMessage('gamertype', 0), flags: MessageFlags.Ephemeral });
      }
      if (!interaction.isButton() || !interaction.customId.startsWith('gamertype')) return;
      // Plain 'gamertype' button (on the public announcement) starts a fresh quiz, shown only to the clicker
      if (interaction.customId === 'gamertype') {
        return await interaction.reply({ ...questionMessage('gamertype', 0), flags: MessageFlags.Ephemeral });
      }

      // gamertype_1_3_2 -> answers [1, 3, 2], so the user is on question 4
      const parts = interaction.customId.split('_');
      const answers = parts.slice(1).map(Number);
      if (parts[0] !== 'gamertype' || !answers.length || answers.length > questions.length || answers.some(h => !houses[h])) {
        console.error(`GAMERTYPE_BAD_ID user=${interaction.user.id} id=${interaction.customId}`);
        return;
      }

      if (answers.length < questions.length) {
        return await interaction.update(questionMessage(interaction.customId, answers.length));
      }

      const win = sortHouse(answers);
      const list = win ? win.map(n => houses[n]) : [wildcard];
      const house = list[0], img = attach(images[1][win ? win[0] - 1 : 8]);
      const name = list.map(x => x.name).join(' / '), emoji = list.map(x => x.emoji).join(''), text = list.map(x => x.text).join('\n');

      // Percent of answers per type, only types that got at least one. Winners first on a tie. Bar is 10 segments.
      const count = {};
      answers.forEach(x => { count[x] = (count[x] || 0) + 1; });
      const rank = n => (win && win.includes(n) ? win.indexOf(n) : 9);
      const bars = Object.keys(count).map(Number).sort((a, b) => (count[b] - count[a]) || (rank(a) - rank(b)) || (a - b)).map(n => {
        const pct = Math.round(count[n] / questions.length * 100), full = Math.round(pct / 10);
        return `${houses[n].emoji} ${'▰'.repeat(full)}${'▱'.repeat(10 - full)} **${pct}%** ${houses[n].name}`;
      }).join('\n');

      await interaction.update({
        embeds: [{
          title: `${emoji} ${name}!`,
          description: bars,
          color: house.color
        }],
        files: [],
        attachments: [],
        components: []
      });
      // Public announcement in the channel. Remove this line to keep results private.
      await interaction.followUp({ content: `🎮 <@${interaction.user.id}> is **${name}** ${emoji}\n${text}`, embeds: img.image ? [{ color: house.color, image: img.image }] : [], files: img.files, components: [{ type: 1, components: [{ type: 2, style: 2, custom_id: 'gamertype', label: 'Gamer Type', emoji: { name: '🎮' } }] }], allowedMentions: { parse: [] } });
    } catch (error) {
      console.error(`GAMERTYPE_ERROR user=${interaction.user?.id} id=${interaction.customId} ${error.message}`);
    }
  },

  main: (client) => {
    console.log("Slash commands for gamertype module loaded.");
  }
};