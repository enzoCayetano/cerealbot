const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const eloRepo = require('../../db/eloRepo');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('set-elo')
        .setDescription('Set a user\'s ELO directly.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addUserOption(option =>
            option.setName('user')
                .setDescription('User to set ELO for')
                .setRequired(true)
        )
        .addIntegerOption(option =>
            option.setName('elo')
                .setDescription('ELO value to set')
                .setRequired(true)
                .setMinValue(0)
        ),

    async execute(interaction) {
        const target = interaction.options.getUser('user');
        const elo = interaction.options.getInteger('elo');

        const result = eloRepo.setElo(target.id, elo);
        if (result === null)
            return interaction.reply({ content: `${target.username} is not registered.`, ephemeral: true });

        // Also update highest_elo if new elo exceeds it
        const profile = eloRepo.getUserStats(target.id);
        if (profile && elo > profile.highest_elo)
            eloRepo.setHighestElo(target.id, elo);

        eloRepo.updateRanks();

        return interaction.reply({ content: `✅ Set ${target.username}'s ELO to **${elo}**.`, ephemeral: true });
    },
};