const { SlashCommandBuilder } = require('discord.js');
const eloRepo = require('../../db/eloRepo');
const { sendErrorLog } = require('../../utils/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('username')
        .setDescription('Change your username.')
        .addStringOption(option =>
            option.setName('username')
                .setDescription('Your new username.')
                .setRequired(true)
                .setMinLength(2)
                .setMaxLength(16)
        ),

    async execute(interaction)
    {
        const userId = interaction.user.id;
        const newUsername = interaction.options.getString('username').trim();

        try 
        {
            if (!/^[a-zA-Z0-9_-]+$/.test(newUsername)) 
            {
                return await interaction.reply({
                    content: 'Username can only contain letters, numbers, underscores, and hyphens.',
                    ephemeral: true,
                });
            }

            const result = eloRepo.setUsername(userId, newUsername);

            if (!result.success) 
            {
                const messages = {
                    not_registered: 'You are not registered yet! Use `/register` first.',
                    username_taken: `The username **${newUsername}** is already taken. Please choose another.`,
                };
                
                return await interaction.reply({
                    content: messages[result.reason],
                    ephemeral: true,
                });
            }

            await interaction.reply({
                content: `✅ Username updated from **${result.oldUsername}** to **${newUsername}**.`,
                ephemeral: true,
            });
        }
        catch (err) 
        {
            console.error(err);
            await interaction.reply({
                content: 'Something went wrong while updating your username.',
                ephemeral: true,
            });
            await sendErrorLog(interaction.client, 'SetUsername Command Error', err, interaction.user);
        }
    }
}