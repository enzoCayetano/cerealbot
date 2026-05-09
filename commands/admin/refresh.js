const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const eloRepo = require('../../db/eloRepo');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('elo-refresh')
        .setDescription('Refreshes elo and highest elo.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const members = await interaction.guild.members.fetch();
        let updated = 0;

        for (const [memberId, member] of members) {
            if (member.user.bot) continue;

            eloRepo.ensureUser(member.id, member.displayName);

            db.prepare(`
                UPDATE users
                SET highest_elo = MAX(highest_elo, elo)
                WHERE user_id = ?
            `).run(member_id);

            updated++;
        }

        await interaction.editReply(`Sync complete! Refreshed data for **${updated}** users.`)
    }
}