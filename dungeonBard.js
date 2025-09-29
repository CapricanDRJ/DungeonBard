const Discord = require("discord.js");
const Config = require("./config.json");
const fs = require('fs');
const path = require('path');

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

const uploadBeastiaryEmojis = async (client) => {
    const beasts = db.prepare('SELECT id, entity, iconURL FROM beastiary_new WHERE iconURL IS NOT NULL AND emojiId IS NULL').all();
    
    console.log(`Uploading ${beasts.length} application emoji(s)...`);
    
    for (let i = 0; i < beasts.length; i++) {
        const beast = beasts[i];
        
        try {
            const response = await fetch(beast.iconURL);
            if (!response.ok) {
                console.error(`Failed to fetch ${beast.id}: ${response.status}`);
                continue;
            }
            
            const buffer = Buffer.from(await response.arrayBuffer());
            const emojiName = beast.entity.replace(/[^a-zA-Z]/g, '');
            
            // Upload to application emoji list (not guild)
            const emoji = await client.application.emojis.create({
                attachment: buffer,
                name: emojiName
            });
            
            db.prepare('UPDATE beastiary_new SET emojiId = ? WHERE id = ?').run(emoji.id, beast.id);
            console.log(`Uploaded ${i+1}/${beasts.length}: ${beast.id} (${emoji.id})`);
            
            // Conservative 5-second delay until we know the real rate limits
            await new Promise(resolve => setTimeout(resolve, 5000));
            
        } catch (error) {
            console.error(`Error uploading ${beast.id}:`, error);
            if (error.message.includes('rate')) {
                console.log('Rate limited - waiting 10 minutes...');
                await new Promise(resolve => setTimeout(resolve, 10 * 60 * 1000));
            }
        }
    }
};



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
