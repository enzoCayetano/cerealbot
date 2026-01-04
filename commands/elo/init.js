const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
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
        let initialized = 0;

        for (const [memberId, member] of members)
        {
            if (member.user.bot) continue;

            await eloRepo.ensureUser(member.id, member.displayName);
            initialized++;
        }

        await interaction.editReply(`Initialized ELO for **${initialized}** users.`);
    }
};