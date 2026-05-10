const { SlashCommandBuilder, AttachmentBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
const eloRepo = require('../../db/eloRepo');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('match-history')
        .setDescription('View recent match history.')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('View a specific user\'s match history')
                .setRequired(false)
        ),

    async execute(interaction) 
    {
        const targetUser = interaction.options.getUser('user') || null;

        const matches = targetUser
            ? eloRepo.getUserMatchHistory(targetUser.id, 20)
            : eloRepo.getRecentMatches(20);

        if (!matches.length)
            return interaction.reply({ content: 'No matches found.', ephemeral: true });

        // Fetch DB username if viewing a specific user
        const dbProfile = targetUser ? eloRepo.getUserStats(targetUser.id) : null;
        const displayName = dbProfile?.username ?? targetUser?.username ?? 'Unknown';

        let currentPage = 0;
        const ITEMS_PER_PAGE = 5;
        const TOTAL_PAGES = Math.ceil(matches.length / ITEMS_PER_PAGE);

        const generateEmbed = (page) => {
            const start = page * ITEMS_PER_PAGE;
            const pageMatches = matches.slice(start, start + ITEMS_PER_PAGE);

            const { EmbedBuilder } = require('discord.js');
            const embed = new EmbedBuilder()
                .setTitle(targetUser ? `${displayName}'s Match History` : 'Recent Matches')
                .setColor(0x5865F2)
                .setFooter({ text: `Page ${page + 1} of ${TOTAL_PAGES}` })
                .setTimestamp();

            if (targetUser) 
            {
                // Per-user view — now also shows both teams for context
                for (const m of pageMatches) 
                {
                    const players = eloRepo.getMatchPlayers(m.match_id);
                    const teamA = players.filter(p => p.team === 'A');
                    const teamB = players.filter(p => p.team === 'B');
                    const won = m.winner_team === m.team;
                    const delta = m.elo_delta >= 0 ? `+${m.elo_delta}` : `${m.elo_delta}`;
                    const date = new Date(m.timestamp).toLocaleDateString();

                    const fmt = (p) => {
                        const isTarget = p.user_id === targetUser.id;
                        const sign = p.elo_delta >= 0 ? '+' : '';
                        const name = p.username ?? p.user_id;
                        return isTarget ? `**__${name}__** (${sign}${p.elo_delta})` : `${name} (${sign}${p.elo_delta})`;
                    };

                    embed.addFields({
                        name: `${won ? '✅' : '❌'} Match #${m.match_id} — ${delta} ELO — ${date}`,
                        value: `**Team A:** ${teamA.map(fmt).join(', ')}\n**Team B:** ${teamB.map(fmt).join(', ')}`,
                    });
                }
            } 
            else 
            {
                // Server-wide view
                for (const m of pageMatches) 
                {
                    const players = eloRepo.getMatchPlayers(m.match_id);
                    const teamA = players.filter(p => p.team === 'A');
                    const teamB = players.filter(p => p.team === 'B');

                    const fmt = (p) => {
                        const sign = p.elo_delta >= 0 ? '+' : '';
                        return `${p.username ?? p.user_id} (${sign}${p.elo_delta})`;
                    };

                    const date = new Date(m.timestamp).toLocaleDateString();
                    embed.addFields({
                        name: `Match #${m.match_id} — Team ${m.winner_team} Won — ${date}`,
                        value: `**Team A:** ${teamA.map(fmt).join(', ')}\n**Team B:** ${teamB.map(fmt).join(', ')}`,
                    });
                }
            }

            return embed;
        };

        const getButtons = (page) => new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('mh_prev')
                .setLabel('Previous')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(page === 0),
            new ButtonBuilder()
                .setCustomId('mh_next')
                .setLabel('Next')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(page === TOTAL_PAGES - 1),
        );

        const response = await interaction.reply({
            embeds: [generateEmbed(currentPage)],
            components: TOTAL_PAGES > 1 ? [getButtons(currentPage)] : [],
        });

        if (TOTAL_PAGES <= 1) return;

        const collector = response.createMessageComponentCollector({
            componentType: ComponentType.Button,
            time: 60000,
        });

        collector.on('collect', async (i) => {
            if (i.user.id !== interaction.user.id)
                return i.reply({ content: 'You did not run this command.', ephemeral: true });

            if (i.customId === 'mh_next') currentPage++;
            else if (i.customId === 'mh_prev') currentPage--;

            await i.update({
                embeds: [generateEmbed(currentPage)],
                components: [getButtons(currentPage)],
            });
        });

        collector.on('end', () => {
            interaction.editReply({ components: [] }).catch(() => null);
        });
    },
};