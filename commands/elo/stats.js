const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const eloRepo = require('../../db/eloRepo');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('stats')
        .setDescription('View your or another user\'s statistics.')
        .addUserOption(option => 
            option.setName('target')
                .setDescription('The user to view the stats for.')),

    async execute(interaction)
    {
        const target = interaction.options.getUser('target') || interaction.user;
        const stats = eloRepo.getUserStats(target.id, target.displayName || target.userName);

        if (!stats)
        {
            return interaction.reply({
                content: `${target.username} doesn't have any statistics yet!`
            });
        }

        const winRate = stats.games_played > 0
            ? ((stats.wins / stats.games_played) * 100).toFixed(1)
            : 0;

        // tiers
        let tier;
        let color;

        const embed = new EmbedBuilder()
            .setAuthor({ name: `${stats.username}'s Profile`, iconURL: target.displayAvatarURL() })
            .setTitle(`TIER`)
            .setColor(0xFFF)
            .setThumbnail(target.displayAvatarURL())
            .addFields(
                { name: 'ELO Rating', value: `**${stats.elo}** ELO\n(Peak: \`${stats.highest_elo}\`)`, inline: true },
                { name: 'Games', value: `Total: \`${stats.games_played}\`\nStreak: \`${stats.current_streak}\``, inline: true },
                { name: 'Performance', value: `Wins: \`${stats.wins}\` | Losses: \`${stats.losses}\`\nWin Rate: \`${winRate}%\``, inline: false },
            )
            .setFooter({ text: 'Last played: ' })
            .setTimestamp(new Date(stats.last_played));

        await interaction.reply({ embeds: [embed] });
    }
}