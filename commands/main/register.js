const { SlashCommandBuilder } = require('discord.js');
const db = require('../../db/db');
const { sendErrorLog } = require('../../utils/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('register')
        .setDescription('Register yourself.'),

    async execute(interaction)
    {
        const userId = interaction.user.id;
        const username = interaction.user.username;

        try
        {
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