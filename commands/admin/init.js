const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const eloRepo = require('../../db/eloRepo');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('elo-init')
        .setDescription('Bulk register all unregistered server members.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    
    async execute(interaction)
    {
        await interaction.deferReply({ ephemeral: true });

        const members = await interaction.guild.members.fetch();
        let registered = 0;
        let skipped = 0;

        for (const [_, member] of members)
        {
            if (member.user.bot) continue;

            const result = eloRepo.registerUser(member.id, member.user.username);

            if (result.success) registered++;
            else skipped++;  // already_registered or username_taken
        }

        await interaction.editReply(
            `Done! Registered **${registered}** new users, skipped **${skipped}** already registered.`
        );
    }
};