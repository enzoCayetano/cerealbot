require('dotenv').config();

const { Client, Collection, GatewayIntentBits } = require('discord.js');
const fs = require('fs');
const path = require('path');

// Use token from environment variables
const token = process.env.DISCORD_TOKEN;

// Create a new Discord client instance with specified intents
const client = new Client(
{
  intents:
  [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildPresences
  ]
});

// Initialize command and cooldown collections on client
client.commands = new Collection();
client.cooldowns = new Collection();

// Load commands from command folders
const foldersPath = path.join(__dirname, 'commands');
const commandFolders = fs.readdirSync(foldersPath);

for (const folder of commandFolders)
{
  const commandsPath = path.join(foldersPath, folder);
  const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

  for (const file of commandFiles)
  {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);

    if ('data' in command && 'execute' in command)
    {
      client.commands.set(command.data.name, command);
    }
    else
    {
      console.log(`Warning! The command at ${filePath} is missing a required "data" or "execute" property!`);
    }
  }
}

// Load event handlers
const eventsPath = path.join(__dirname, 'events');
const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));

for (const file of eventFiles)
{
  const filePath = path.join(eventsPath, file);
  const event = require(filePath);

  if (event.once)
  {
    client.once(event.name, (...args) => event.execute(...args));
  }
  else
  {
    client.on(event.name, (...args) => event.execute(...args));
  }
}

// Log in to Discord with the bot token
client.login(token);