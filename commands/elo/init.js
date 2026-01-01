const { SlashCommandBuilder } = require('discord.js');
const eloRepo = require('../../db/eloRepo');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('elo-init')
        .setDescription('Initialize elo for new users.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    
    async execute(interaction)
    {
        await interaction.deferReply({ ephemeral: true });

        const members = await interaction.guild.members.fetch();
        let inserted = 0;

        for (const member of members.values())
        {
            const created = eloRepo.ensureUser(member.user.id);
            if (created) inserted++;
        }

        await interaction.editReply(`Initialize ELO for **${inserted}** users.`);
    }
}