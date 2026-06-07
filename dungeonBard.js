const Discord = require("discord.js");
const Config = require("./config.json");
const fs = require('fs');
const path = require('path');

const client = new Discord.Client({
   intents: [
     Discord.GatewayIntentBits.Guilds
   ]
});
const modules = [];
const guildMap = new Map();
const modulesDir = path.join(__dirname, 'modules');

fs.readdirSync(modulesDir, { withFileTypes: true }).forEach(ent => {
 const p = path.join(modulesDir, ent.name);
 if (ent.isFile() && ent.name.endsWith('.js')) modules.push(require(p));
 else if (ent.isDirectory()) guildMap.set(ent.name, fs.readdirSync(p).filter(f => f.endsWith('.js')).map(f => require(path.join(p, f))));
});

const registerCommands = async () => {
 const rest = new Discord.REST({ version: '10' }).setToken(Config.Token);
 const globals = modules.filter(m => m.commandData).map(m => m.commandData.toJSON());
 if (globals.length) await rest.put(Discord.Routes.applicationCommands(Config.ClientID), { body: globals });
 for (const [gid, mods] of guildMap) {
 const local = mods.filter(m => m.commandData).map(m => m.commandData.toJSON());
 if (local.length) await rest.put(Discord.Routes.applicationGuildCommands(Config.ClientID, gid), { body: local });
 }
};

client.once('ready', async () => {
    console.log(`Client ready; logged in as ${client.user.tag} (${client.user.id})`);

    // Register commands based on the number of guilds (servers)
    await registerCommands();

const allLoaded = [...modules,...Array.from(guildMap.values()).flat()];
allLoaded.forEach(mod => {
 if (mod.initializeBot) mod.initializeBot(client);
 if (mod.loadEvents) mod.loadEvents(client);
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
 const active = [...modules,...(guildMap.get(interaction.guildId) || [])];
 Promise.all(active.filter(m => m.handleInteraction).map(m => m.handleInteraction(client, interaction))).catch(console.error);
});

setInterval(async () => {
  await client.users.fetch(client.user.id, { force: true });
  //console.log('Bot connection verified');
}, 20 * 60 * 1000); // every 20 minutes

client.login(Config.Token).catch(console.error);
