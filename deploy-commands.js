require('dotenv').config();
const { REST, Routes } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');

// Load environment variables
const token = process.env.DISCORD_TOKEN;
const clientId = process.env.CLIENT_ID;

// Load commands from the commands folders
const commands = [];
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
      commands.push(command.data.toJSON());
    }
    else
    {
      console.warn(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
    }
  }
}

const rest = new REST().setToken(token);

// Deploy commands globally
(async () =>
{
  try
  {
    console.log(`⏳ Started refreshing ${commands.length} global application (/) commands.`);

    const route = Routes.applicationCommands(clientId);
    const data = await rest.put(route, { body: commands });

    console.log(`✅ Successfully deployed ${data.length} global command(s).`);
  }
  catch (error)
  {
    console.error('❌ Deployment failed:', error);
  }
})();