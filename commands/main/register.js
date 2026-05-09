const { SlashCommandBuilder } = require('discord.js');
const db = require('../../db/db');
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

            const existing = db.prepare(`
                SELECT user_id FROM users WHERE user_id = ?
            `).get(userId);

            if (existing)
            {
                return await interaction.reply({
                    content: 'You are already registered!',
                    ephemeral: true
                });
            }

            db.prepare(`
                INSERT INTO users (user_id, username) VALUES (?, ?)
            `).run(userId, username);

            await interaction.reply({
                content: 'You have been registered successfully!',
                ephemeral: true
            });
        }
        catch (err)        {
            console.error('Error registering user:', err);
            sendErrorLog(`Error registering user ${username} (${userId}): ${err.message}`);
            await interaction.reply({
                content: 'An error occurred while registering. Please try again later.',
                ephemeral: true
            });
        }
    },
};