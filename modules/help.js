const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

const embeds = [
    new EmbedBuilder()
        .setTitle('Dungeon Bard Help')
        .setColor(0x5865F2)
        .setDescription(
            'Welcome to the Quest of the Learned Scholar, Adventurer! This application is designed to reward you for engaging in scholarly work, while also balancing your health and wellbeing. This file will tell you a bit about the app and the seven commands [denoted by >>] that are used to play the DungeonBard quest.'
        )
    ,
    new EmbedBuilder()
        .setTitle('Character Commands')
        .setColor(0x5865F2)
        .setDescription(
            "In this section, you will learn how to create and manage a character for interacting with the application’s content. We have tried to use a few simple commands to navigate the app.\n"+
            "* `/character enroll` [This command creates a new character.]\n"+
            "You will be asked to select a domain: Initiate – most suitable for high school, Collegiate – suitable for college and undergraduate students, Pedagogue – suitable for teacher candidates (and teachers wishing to participate with their students), Masters – suitable for graduate students at the Masters level, Doctoral – suitable for graduate students at the Doctoral level, and Sage – suitable for professors. \n"+
            "You can also choose to enter a name (or the default will be your Discord server name).\n"+
            "* `/character graduate` [This command moves your character to the next domain and restarts many of your stats and items.] \n"+
            "* `/character restart` [This command will restart your character within the same domain.]\n"+
            "* `/character delete` [Deletes the character and all associated data]."
        )
    ,
    new EmbedBuilder()
        .setTitle('Professions')
        .setColor(0xFAA61A)
        .setDescription(
            "In DungeonBard, you will gain experience towards professions for attempting quests and facing some of the perils. \n"+
            "* `/stats` [This command will generate a character card that includes information such as your profession ranks, attribute scores, and active equipment and relic bonuses.]\n"+
            "There are three professions and these are consistent across the academic domains. Each has different ranks that can be earned through questing or facing perils, and these may be boosted through finding certain relics or buying certain equipment from the shoppe. Boosted experience rates expire in 7 days. Advancing profession ranks becomes slower as you move to higher academic domains. \n"+
            "* *  Artisan [Gaining and communicating academic knowledge and skills.]\n"+
            "* *  Soldier [Engaging in tasks around leadership, relationship building, and interpersonal communications. Also, examinations and defenses fall here.]\n"+
            "* *  Healer [Taking time to restore and rejuvenate.]\n"
        )
    ,
    new EmbedBuilder()
        .setTitle('Attributes')
        .setColor(0xEB459E)
        .setDescription(
            "Some of the quests will also help level your character’s attributes. Certain key quests require specific knowledge or skills to complete, and these level when you complete them. As with professions, levelling becomes slower as you progress through the academic domains. \n"+
            "* *  Initiate and Collegiate [LEARNING (LRN), COMMUNICATION (COM), DISCIPLINE (DIS), ORGANIZATION (ORG), STAMINA (STA), PERSEVERANCE (PRS)]\n"+
            "* *  Pedagogue [Pedagogy (PDG), Classroom Command (CMC), Lesson Crafting (LCR), Organization (ORG), Stamina (STA), Adaptability (ADP)]\n"+
            "* *  Masters and Doctoral [Scholarship (SCH), Rhetoric (RHT), Endurance (END), Organization (ORG), Stamina (STA), Resilience (RES)]\n"+
            "* *  Sage [Scholarship (SCH), Rhetoric (RHT), Endurance (END), Administration (ADM), Stamina (STA), Influence (INF)]\n"+
            "Perils faced on quests will scale to your attribute levels. You may purchase weapons and armour within the shop that will give you a seven-day bonus in attack or defense. Only the highest bonus will apply for attack and for defense at any time. "
        )
    ,
    new EmbedBuilder()
        .setTitle('Quests')
        .setColor(0x57F287)
        .setDescription(
            "Quests may be claimed for engaging in activities related to academics and self-care. Some quests are tied to certain academic domains (and these generate more experience towards professions and attributes, as well as chances for profession-boosting relics), but there are a great many that represent smaller, incremental tasks. \n"+
            "* `/quest` [This command will ask you to select a quest area and then shows a lists of quests available in that area as well as what is needed to claim them.]\n"+
            "Quest Areas include:\n"+
            "* *  **Chamber of Oration** [Where Scholars Meet to Debate]\n"+
            "* *  **Hall of Marvels** [Where Knowledge is Sought]\n"+
            "* *  **Lair of Self-Care** [Where Scholars Refresh and Restore]\n"+
            "* *  **Scribe’s Tower** [Where Knowledge is Written into Scholarly Form]\n"+
            "* *  **Tribunal of Forms** [Where Academics Meet to be Judged]\n"+
            "* *  **Vault of Vellum** [Where Knowledge is Applied]\n"+
            "Quests will be listed under these Quest Areas and you can select the one you want to claim. Sometimes there is a peril (or monster) associated with the quest, and you will see a battle play out. Perils scale in relation to your attributes. You can also buy weapons or armour from the shoppe, which will boost your prowess in attack or defense. Only the weapon or armour with the highest stat bonus will be applied. Weapon and armour boosts expire after 7 days. Sometimes at the resolution of combat, you will find coins or a relic. Some relics will give you an instantaneous boost to experience in a profession, some will boost your profession experience gains for 7 days, and some will have no effect at all. "
        )
    ,
    new EmbedBuilder()
        .setTitle('The Shoppe')
        .setColor(0x964B00)
        .setDescription(
            "The Shoppe will let you purchase items that give combat bonuses or profession experience boosts using the coins you earn from claiming quests and vanquishing perils. All items in the Shoppe will expire 7 days from purchase. \n"+
            "* `/shoppe` [This command will call up the list of available items for purchase from the shoppe. You will be prompted to purchase or cancel the purchase.]"
        )
];
module.exports = {
    commandData: new SlashCommandBuilder()
        .setName('help')
        .setDescription('Display help information'),

    allowedButtons: [],

    handleInteraction: async (client, interaction) => {
        if (interaction.isCommand() && interaction.commandName === 'help') {
            module.exports.executeCommand(interaction);
        }
    },

    main: (client) => {
        console.log("Slash commands for help module have been loaded.");
    },

    executeCommand: async (interaction) => {
        try {


            interaction.reply({ embeds });

        } catch (error) {
            console.error('Error executing help command:', error);
            interaction.reply({
                content: 'An error occurred while displaying help.'
            });
        }
    }
};

/*
DungeonBard: Quest of The Learned Scholar
(Help File)

Welcome to the Quest of the Learned Scholar, Adventurer! This application is designed to reward you for engaging in scholarly work, while also balancing your health and wellbeing. This file will tell you a bit about the app and the seven commands [denoted by >>] that are used to play the DungeonBard quest.

Character Commands
"In this section, you will learn how to create and manage a character for interacting with the application’s content. We have tried to use a few simple commands to navigate the app.\n"+
"* `/character enroll` [This command creates a new character.]\n"+
"You will be asked to select a domain: Initiate – most suitable for high school, Collegiate – suitable for college and undergraduate students, Pedagogue – suitable for teacher candidates (and teachers wishing to participate with their students), Masters – suitable for graduate students at the Masters level, Doctoral – suitable for graduate students at the Doctoral level, and Sage – suitable for professors. \n"+
"You can also choose to enter a name (or the default will be your Discord server name).\n"+
"* `/character graduate` [This command moves your character to the next domain and restarts many of your stats and items.] \n"+
"* `/character restart` [This command will restart your character within the same domain.]\n"+
"* `/character delete` [Deletes the character and all associated data]."

Professions and Attributes
In DungeonBard, you will gain experience towards professions for attempting quests and facing some of the perils. 
>> /stats [This command will generate a character card that includes information such as your profession ranks, attribute scores, and active equipment and relic bonuses.]
There are three professions and these are consistent across the academic domains. Each has different ranks that can be earned through questing or facing perils, and these may be boosted through finding certain relics or buying certain equipment from the shoppe. Boosted experience rates expire in 7 days. Advancing profession ranks becomes slower as you move to higher academic domains. 
- Artisan [Gaining and communicating academic knowledge and skills.]
- Soldier [Engaging in tasks around leadership, relationship building, and interpersonal communications. Also, examinations and defenses fall here.]
- Healer [Taking time to restore and rejuvenate.]
Some of the quests will also help level your character’s attributes. Certain key quests require specific knowledge or skills to complete, and these level when you complete them. As with professions, levelling becomes slower as you progress through the academic domains. 
- Initiate and Collegiate [LEARNING (LRN), COMMUNICATION (COM), DISCIPLINE (DIS), ORGANIZATION (ORG), STAMINA (STA), PERSEVERANCE (PRS)]
- Pedagogue [PEDAGOGY (PDG), CLASSROOM COMMAND (CMC), LESSON CRAFTING (LCR), ORGANIZATION (ORG), STAMINA (STA), ADAPTABILITY (ADP)]
- Masters and Doctoral [SCHOLARSHIP (SCH), RHETORIC (RHT), ENDURANCE (END), ORGANIZATION (ORG), STAMINA (STA), RESILIENCE (RES)]
- Sage [SCHOLARSHIP (SCH), RHETORIC (RHT), ENDURANCE (END), ADMINISTRATION (ADM), STAMINA (STA), INFLUENCE (INF)]
Perils faced on quests will scale to your attribute levels. You may purchase weapons and armour within the shop that will give you a seven-day bonus in attack or defense. Only the highest bonus will apply for attack and for defense at any time. 

Quests
Quests may be claimed for engaging in activities related to academics and self-care. Some quests are tied to certain academic domains (and these generate more experience towards professions and attributes, as well as chances for profession-boosting relics), but there are a great many that represent smaller, incremental tasks. 
>> /quest [This command will ask you to select a quest area and then shows a lists of quests available in that area as well as what is needed to claim them.]
Quest Areas include:
- Chamber of Oration [Where Scholars Meet to Debate]
- Hall of Marvels [Where Knowledge is Sought]
- Lair of Self-Care [Where Scholars Refresh and Restore]
- Scribe’s Tower [Where Knowledge is Written into Scholarly Form]
- Tribunal of Forms [Where Academics Meet to be Judged]
- Vault of Vellum [Where Knowledge is Applied]
Quests will be listed under these Quest Areas and you can select the one you want to claim. Sometimes there is a peril (or monster) associated with the quest, and you will see a battle play out. Perils scale in relation to your attributes. You can also buy weapons or armour from the shoppe, which will boost your prowess in attack or defense. Only the weapon or armour with the highest stat bonus will be applied. Weapon and armour boosts expire after 7 days. Sometimes at the resolution of combat, you will find coins or a relic. Some relics will give you an instantaneous boost to experience in a profession, some will boost your profession experience gains for 7 days, and some will have no effect at all. 

The Shoppe
The Shoppe will let you purchase items that give combat bonuses or profession experience boosts using the coins you earn from claiming quests and vanquishing perils. All items in the Shoppe will expire 7 days from purchase. 
>> /shoppe [This command will call up the list of available items for purchase from the shoppe. You will be prompted to purchase or cancel the purchase.]

*/