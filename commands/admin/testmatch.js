const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
const eloRepo = require('../../db/eloRepo');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('test-match')
        .setDescription('Test a simulated 6v6 match.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction)
    {
        await interaction.deferReply();

        // get users from db
        const users = eloRepo.sortTopUsers();
        const ghosts = [];
        if (users.length < 12)
        {
            for (let i = 1; i <= 12 - users.length; i++)
            {
                ghosts.push({
                    id: `GHOST_${i}`,
                    username: `Ghost_bot_${i}`,
                    elo: 1000
                });
            }
        }

        const allUsers = [...users, ...ghosts];

        const shuffled = allUsers.sort(() => 0.5 - Math.random());
        const teamA = shuffled.slice(0, 6).map(u => u.id);
        const teamB = shuffled.slice(6, 12).map(u => u.id);

        const change = eloRepo.updateMatchResults(teamA, teamB, 'A');

        const resultEmbed = {
            title: "Match Results (Test)",
            description: `**Team A** won against **Team B**!`,
            fields: [
                { name: "ELO Change", value: `Team A: \`+${change}\` | Team B: \`-${change}\``, inline: false },
                { name: "Team A Players", value: shuffled.slice(0, 6).map(u => u.username).join(', '), inline: true },
                { name: "Team B Players", value: shuffled.slice(6, 12).map(u => u.username).join(', '), inline: true },
            ],
            color: 0x00FF00
        };

        await interaction.editReply({ embeds: [resultEmbed] });
    }
}