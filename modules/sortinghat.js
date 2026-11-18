const { SlashCommandBuilder, MessageFlagsBitField } = require('discord.js');
const MessageFlags = MessageFlagsBitField.Flags;
const fs = require('fs');

// House numbers used in button ids: 1 = Gryffindor, 2 = Hufflepuff, 3 = Ravenclaw, 4 = Slytherin
const houses = {
  1: { name: 'Gryffindor', emoji: '🦁', color: 0xb3262d, text: 'You act when others hesitate. Brave, direct and always up for a bit of chaos.' },
  2: { name: 'Hufflepuff', emoji: '🦡', color: 0xd9a400, text: 'Warm, steady and fun to be around. You are the reason the party has snacks.' },
  3: { name: 'Ravenclaw', emoji: '🦅', color: 0x2f5fa8, text: 'Curious and clever. You would rather figure it out than be told the answer.' },
  4: { name: 'Slytherin', emoji: '🐍', color: 0x2a7a4b, text: 'Driven and stylish. You know what you want and how to get it.' }
};

// Embed images, uploaded by the bot from imageDir (relative to where the bot is started, same as db/tech.db).
// A missing file is logged and the embed shows with no image.
const imageDir = 'assets/sortinghat/';
const images = [
  [ // [0] questions, same order as the questions array below
    'q1.png', // magical item
    'q2.png', // where do you sit
    'q3.png', // game night
    'q4.png', // free day
    'q5.png', // companion
    'q6.png', // subject
    'q7.png'  // drink
  ],
  [ // [1] results, index = house number - 1
    'gryffindor.png',
    'hufflepuff.png',
    'ravenclaw.png',
    'slytherin.png'
  ]
];

// Returns the embed image and the file to upload for it.
function attach(file) {
  if (!file || !fs.existsSync(imageDir + file)) {
    if (file) console.error(`SORTINGHAT_IMAGE_MISSING file=${imageDir + file}`);
    return { image: undefined, files: [] };
  }
  return { image: { url: `attachment://${file}` }, files: [{ attachment: imageDir + file, name: file }] };
}

// Ordered most important first. a[0] is house 1, a[1] is house 2, etc.
// weight is the multiplier x10 (17 = 1.7) so the math stays in whole numbers.
const questions = [
  { q: 'Pick a magical item.', weight: 17, a: ['A sword that cuts any material', 'A picnic basket that never empties', 'A book that answers any question', 'A ring that makes people listen to you'] },
  { q: 'Where do you sit?', weight: 16, a: ['Front row, right in the action', 'In the kitchen at a party', 'Quiet corner by a window', 'Head of the table'] },
  { q: 'Pick a game for game night.', weight: 15, a: ['A chaotic dare game', 'A co-op game', 'Trivia or puzzles', 'A strategy game like chess'] },
  { q: 'Perfect free day?', weight: 14, a: ['No plan, see what happens', 'Cozy day with friends and good food', 'Lost in a new book or hobby', 'A stylish night out'] },
  { q: 'Pick a companion.', weight: 13, a: ['A bold, sharp-eyed hawk', 'A loyal, floppy-eared dog', 'A wise, wide-eyed owl', 'A sleek, mysterious black cat'] },
  { q: 'Pick a subject.', weight: 12, a: ['Defence Against the Dark Arts', 'Care of Magical Creatures', 'Study of Ancient Runes', 'Advanced Potion-Making'] },
  { q: 'Pick a drink.', weight: 11, a: ['Something spicy', 'Hot chocolate', 'A weird new tea', 'Dark espresso'] }
];

// Builds the message for question number `step` (0 based). Each button id is the answers so far plus its house.
function questionMessage(prefix, step) {
  const item = questions[step];
  const order = [1, 2, 3, 4];
  for (let i = order.length - 1; i > 0; i--) { // shuffle display order so the first button is not always Gryffindor
    const j = Math.floor(Math.random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  const img = attach(images[0][step]);
  return {
    embeds: [{
      title: `Question ${step + 1} of ${questions.length}`,
      description: item.q,
      color: 0x5b4a8a,
      image: img.image
    }],
    files: img.files,
    attachments: [], // clears the previous question's image so it does not show as a loose file
    components: [{
      type: 1,
      components: order.map(h => ({ type: 2, style: 2, custom_id: `${prefix}_${h}`, label: item.a[h - 1] }))
    }]
  };
}

// Weighted total per house. On a tie, the tied house that won the highest-ranked question wins.
function sortHouse(answers) {
  const totals = { 1: 0, 2: 0, 3: 0, 4: 0 };
  answers.forEach((h, i) => { totals[h] += questions[i].weight; });
  const top = Math.max(...Object.values(totals));
  return answers.find(h => totals[h] === top);
}

module.exports = {
  commandData: new SlashCommandBuilder()
    .setName('sortinghat')
    .setDescription('Let the Sorting Hat pick your Hogwarts house')
    .setIntegrationTypes([0, 1])// 0 = guild, 1 = user
    .setContexts([0, 1, 2]),// 0 = guild, 1 = dm, 2 = group dm

  allowedButtons: new Set(['sortinghat']),

  handleInteraction: async (client, interaction, customId) => {
    try {
      if (interaction.isCommand() && interaction.commandName === 'sortinghat') {
        return await interaction.reply({ ...questionMessage('sortinghat', 0), flags: MessageFlags.Ephemeral });
      }
      if (!interaction.isButton() || !interaction.customId.startsWith('sortinghat')) return;
      // Plain 'sortinghat' button (on the public announcement) starts a fresh quiz, shown only to the clicker
      if (interaction.customId === 'sortinghat') {
        return await interaction.reply({ ...questionMessage('sortinghat', 0), flags: MessageFlags.Ephemeral });
      }

      // sortinghat_1_3_2 -> answers [1, 3, 2], so the user is on question 4
      const parts = interaction.customId.split('_');
      const answers = parts.slice(1).map(Number);
      if (parts[0] !== 'sortinghat' || !answers.length || answers.length > questions.length || answers.some(h => !houses[h])) {
        console.error(`SORTINGHAT_BAD_ID user=${interaction.user.id} id=${interaction.customId}`);
        return;
      }

      if (answers.length < questions.length) {
        return await interaction.update(questionMessage(interaction.customId, answers.length));
      }

      const h = sortHouse(answers), house = houses[h], img = attach(images[1][h - 1]);
      // Percent of each house, sorted highest first (winner first on a tie). Bar is 10 segments.
      const totals = { 1: 0, 2: 0, 3: 0, 4: 0 }, max = questions.reduce((s, x) => s + x.weight, 0);
      answers.forEach((x, i) => { totals[x] += questions[i].weight; });
      const bars = [1, 2, 3, 4].sort((a, b) => (totals[b] - totals[a]) || ((b === h) - (a === h))).map(n => {
        const pct = Math.round(totals[n] / max * 100), full = Math.round(pct / 10);
        return `${houses[n].emoji} ${'▰'.repeat(full)}${'▱'.repeat(10 - full)} **${pct}%** ${houses[n].name}`;
      }).join('\n');
      await interaction.update({
        embeds: [{
          title: `${house.emoji} ${house.name}!`,
          description: bars,
          color: house.color
        }],
        files: [],
        attachments: [],
        components: []
      });
      // Public announcement in the channel. Remove this line to keep results private.
      await interaction.followUp({ content: `🎩 <@${interaction.user.id}> has been sorted into **${house.name}** ${house.emoji}\n${house.text}`, embeds: img.image ? [{ color: house.color, image: img.image }] : [], files: img.files, components: [{ type: 1, components: [{ type: 2, style: 2, custom_id: 'sortinghat', label: 'Sorting Hat', emoji: { name: '🎩' } }] }], allowedMentions: { parse: [] } });
    } catch (error) {
      console.error(`SORTINGHAT_ERROR user=${interaction.user?.id} id=${interaction.customId} ${error.message}`);
    }
  },

  main: (client) => {
    console.log("Slash commands for sortinghat module loaded.");
  }
};