const Discord = require("discord.js");
const Config = require("./config.json");
const fs = require('fs');
const path = require('path');
const test = require('assets/logger.js');

const client = new Discord.Client({
   intents: [
     Discord.GatewayIntentBits.Guilds
   ]
});

// Dynamically load all modules from the /modules directory
const modulesDir = path.join(__dirname, 'modules');
const modules = fs.readdirSync(modulesDir)
    .filter(file => file.endsWith('.js'))
    .map(file => require(path.join(modulesDir, file)));

// Register slash commands
const registerCommands = async () => {
    const commands = [];
    modules.forEach(mod => {
        if (mod.commandData) {
            commands.push(mod.commandData.toJSON());
        }
    });

    if (commands.length > 0) {
        const rest = new Discord.REST({ version: '10' }).setToken(Config.Token);
        // Fetch the guilds the bot is in
        const guilds = await client.guilds.fetch();

        if (guilds.size === 1) {
            // Register commands to a single guild (server)
            const guildId = guilds.first().id;
            await rest.put(Discord.Routes.applicationGuildCommands(Config.ClientID, guildId), { body: commands });
            console.log(`Successfully registered commands to the guild with ID: ${guildId}.`);
        } else {
            // Register commands globally
            await rest.put(Discord.Routes.applicationCommands(Config.ClientID), { body: commands });
            console.log('Successfully registered global application commands.');
        }
    }
};

client.once('clientReady', async () => {
    console.log(`Client ready; logged in as ${client.user.tag} (${client.user.id})`);

    // Register commands based on the number of guilds (servers)
    await registerCommands();

    // Initialize the bot using all loaded modules
    modules.forEach(mod => {
        if (mod.initializeBot) mod.initializeBot(client);
        if (mod.loadEvents) mod.loadEvents(client);
    });

    // Call the main function for each module after the bot is ready
    modules.forEach(mod => {
        if (mod.main) mod.main(client);
    });


//emoji upload for beastiary, remove later
const sqlite3 = require('better-sqlite3');
const db = new sqlite3('db/dungeonbard.db');
const downloadAndResizeEmojis = async () => {
    // Get unique emojiIds from both tables
    const relicEmojis = db.prepare('SELECT DISTINCT emojiId FROM relic WHERE emojiId IS NOT NULL').all();
    const itemEmojis = db.prepare('SELECT DISTINCT emojiId FROM items WHERE emojiId IS NOT NULL').all();
    const cursedItems = db.prepare('SELECT DISTINCT emojiId FROM cursedItems WHERE emojiId IS NOT NULL').all();
    
    // Combine and deduplicate
    const allEmojiIds = [...new Set([...relicEmojis.map(r => r.emojiId), ...itemEmojis.map(i => i.emojiId), ...cursedItems.map(c => c.emojiId)])];

    console.log(`Checking ${allEmojiIds.length} emojis...`);
    
    let downloaded = 0;
    let skipped = 0;
    
    for (let i = 0; i < allEmojiIds.length; i++) {
        const emojiId = allEmojiIds[i];
        
        // Check if emoji already exists
        const existing = db.prepare('SELECT emojiId FROM itemEmojis WHERE emojiId = ?').get(emojiId);
        if (existing) {
            skipped++;
            //console.log(`Skipped ${i+1}/${allEmojiIds.length}: ${emojiId} (already exists)`);
            continue;
        }
        
        try {
            // Download emoji from Discord CDN
            const emojiUrl = `https://cdn.discordapp.com/emojis/${emojiId}.png?size=32`;
            const response = await fetch(emojiUrl);
            
            if (!response.ok) {
                console.error(`Failed to fetch emoji ${emojiId}: ${response.status}`);
                return;
            }
            
            const buffer = Buffer.from(await response.arrayBuffer());
            
            // Store in database
            db.prepare('INSERT INTO itemEmojis (emojiId, emoji) VALUES (?, ?)').run(emojiId, buffer);
            downloaded++;
            console.log(`Downloaded ${i+1}/${allEmojiIds.length}: ${emojiId}`);
            
            // Wait 2 seconds between downloads
            await new Promise(resolve => setTimeout(resolve, 2000));
            
        } catch (error) {
            console.error(`Error downloading emoji ${emojiId}:`, error);
            return;
        }
    }
    
    console.log(`Emoji download complete: ${downloaded} downloaded, ${skipped} skipped`);
};
downloadAndResizeEmojis();



});

client.on("interactionCreate", (interaction) => {
    Promise.all(
        modules
            .filter(mod => mod.handleInteraction)
            .map(mod => mod.handleInteraction(client, interaction))
    ).catch(console.error); // Log errors if any module fails
});

setInterval(async () => {
  await client.users.fetch(client.user.id, { force: true });
  //console.log('Bot connection verified');
}, 20 * 60 * 1000); // every 20 minutes

client.login(Config.Token).catch(console.error);
