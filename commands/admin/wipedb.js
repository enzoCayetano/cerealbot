const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const db = require('../../db/database');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('wipe-db')
        .setDescription('Wipe all users and match data from the database.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        db.prepare('DELETE FROM users').run();
        db.prepare('DELETE FROM matches').run();

        // Reset auto-increment counters if you have any
        db.prepare("DELETE FROM sqlite_sequence WHERE name IN ('users', 'elo_history')").run();

        return interaction.reply({ content: '✅ Database wiped. All users and ELO history have been deleted.', ephemeral: true });
    },
};