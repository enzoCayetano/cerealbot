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

            const sanitized = sanitizeUsername(member.displayName);
            const withSuffix = `${sanitized}_${member.id.slice(-4)}`;

            // try sanitized name, then fall back to appending last 4 of user ID
            let result = eloRepo.registerUser(member.id, sanitized);

            if (!result.success && result.reason === 'username_taken')
                result = eloRepo.registerUser(member.id, withSuffix);

            if (result.success) registered++;
            else skipped++; // already_registered
        }

        await interaction.editReply(
            `Done! Registered **${registered}** new users, skipped **${skipped}** already registered.`
        );
    }
};

function sanitizeUsername(username)
{
    return username
        .replace(/[^a-zA-Z0-9_-]/g, '_') // replace invalid chars with underscore
        .replace(/_{2,}/g, '_')           // collapse multiple underscores
        .replace(/^[-_]+|[-_]+$/g, '')    // trim leading/trailing underscores and hyphens
        .slice(0, 32)                     // enforce max length
        || 'user';                        // fallback if result is empty
}