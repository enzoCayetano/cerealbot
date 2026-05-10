const { SlashCommandBuilder, AttachmentBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
const eloRepo = require('../../db/eloRepo');
const { generateLeaderboardCard } = require('../../utils/leaderboardCard');

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

        const getButtons = (page) => new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('lb_prev')
                .setLabel('Previous')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(page === 0),
            new ButtonBuilder()
                .setCustomId('lb_next')
                .setLabel('Next')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(page === TOTAL_PAGES - 1),
        );

        await interaction.deferReply();

        const imageBuffer = await generateLeaderboardCard(users, currentPage, TOTAL_PAGES);
        const attachment = new AttachmentBuilder(imageBuffer, { name: 'leaderboard.png' });

        const response = await interaction.editReply({
            files: [attachment],
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

            if (i.customId === 'lb_next') currentPage++;
            else if (i.customId === 'lb_prev') currentPage--;

            await i.deferUpdate();

            const newBuffer = await generateLeaderboardCard(users, currentPage, TOTAL_PAGES);
            const newAttachment = new AttachmentBuilder(newBuffer, { name: 'leaderboard.png' });

            await i.editReply({ files: [newAttachment], components: [getButtons(currentPage)] });
        });

        collector.on('end', () => {
            interaction.editReply({ components: [] }).catch(() => null);
        });
    },
};