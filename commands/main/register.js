const { SlashCommandBuilder } = require('discord.js');
const eloRepo = require('../../db/eloRepo');
const { sendErrorLog } = require('../../utils/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('register')
        .setDescription('Register yourself.')
        .addStringOption(option =>
            option.setName('username')
                .setDescription('Your username')
                .setRequired(true)
                .setMinLength(3)
                .setMaxLength(16)
        ),

    async execute(interaction)
    {
        const userId = interaction.user.id;
        const username = interaction.options.getString('username').trim();

        try
        {
            // validate alphanumeric with underscores and hyphens
            if (!/^[a-zA-Z0-9_-]+$/.test(username)) 
            {
                return await interaction.reply({
                    content: 'Username can only contain letters, numbers, underscores, and hyphens.',
                    ephemeral: true,
                });
            }

            const result = eloRepo.registerUser(userId, username);

            if (!result.success)
            {
                const messages = {
                    already_registered: 'You are already registered! Use `/username` to change your username.',
                    username_taken: `The username **${username}** is already taken. Please choose another name.`,
                };

                return await interaction.reply({
                    content: messages[result.reason],
                    ephemeral: true,
                });
            }

            await interaction.reply({
                content: `You have been registered as **${username}**!`,
                ephemeral: true
            });
        }
        catch (err)        {
            console.error(err);
            await interaction.reply({
                content: 'Something went wrong during registration.',
                ephemeral: true,
            });
            await sendErrorLog(interaction.client, 'Register Command Error', err, interaction.user);
        }
    },
};