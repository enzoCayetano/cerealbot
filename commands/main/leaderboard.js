const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
const eloRepo = require('../../db/eloRepo');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('leaderboard')
        .setDescription('View the current leaderboard.'),
    
    async execute(interaction)
    {
        const users = eloRepo.sortTopUsers();
        if (users.length == 0) return interaction.reply('The leaderboard is currently empty!'); // if for some reason 0 users

        let currentPage = 0;
        const ITEMS_PER_PAGE = 10;
        const TOTAL_PAGES = Math.ceil(users.length / ITEMS_PER_PAGE);

        // Embed
        const generateEmbed = (page) => {
            const start = page * ITEMS_PER_PAGE;
            const end = start + ITEMS_PER_PAGE;
            const currentUsers = users.slice(start, end);

            const leaderboardString = currentUsers.map((user, index) => {
                const rank = start + index + 1;
                const prefix = `**#${rank}**`;
                return `${prefix}.  ${user.username || 'Unknown'}: \`${user.elo}\` ELO`;
            }).join('\n');

            return new EmbedBuilder()
                .setTitle('Server Leaderboard')
                .setColor(0xFFA500)
                .setDescription(leaderboardString)
                .setFooter({ text: `Page ${page + 1} of ${TOTAL_PAGES}` })
                .setTimestamp();
        };

        // Buttons
        const getButtons = (page) => {
            return new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('prev')
                    .setLabel('Previous')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(page === 0),
                new ButtonBuilder()
                    .setCustomId('next')
                    .setLabel('Next')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(page === TOTAL_PAGES - 1)
            );
        };

        // Display page & buttons if more than one page
        const response = await interaction.reply({
            embeds: [generateEmbed(currentPage)],
            components: TOTAL_PAGES > 1 ? [getButtons(currentPage)] : [],
        });

        // Button logic
        if (TOTAL_PAGES <= 1) return;

        const collector = response.createMessageComponentCollector({
            componentType: ComponentType.Button,
            time: 60000, // Buttons work for 60 seconds
        });

        collector.on('collect', async (i) => {
            if (i.user.id !== interaction.user.id)
            {
                return i.reply({ 
                    content: 'You did not run this command.',
                    ephemeral: true,
                });
            }

            if (i.customId === 'next') currentPage++;
            else if (i.customId === 'prev') currentPage--;

            await i.update({
                embeds: [generateEmbed(currentPage)],
                components: [getButtons(currentPage)]
            });
        });

        collector.on('end', () => {
            interaction.editReply({ compoentns: [] }).catch(() => null);
        });
    }
}