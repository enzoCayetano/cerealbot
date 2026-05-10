const { SlashCommandBuilder, AttachmentBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
const eloRepo = require('../../db/eloRepo');
const { generateMatchHistoryCard } = require('../../utils/matchHistoryCard');

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
        const targetDiscordUser = interaction.options.getUser('user') || null;

        // Resolve DB profile for username
        const dbProfile = targetDiscordUser ? eloRepo.getUserStats(targetDiscordUser.id) : null;
        const targetUser = dbProfile
            ? { id: targetDiscordUser.id, username: dbProfile.username }
            : targetDiscordUser
                ? { id: targetDiscordUser.id, username: targetDiscordUser.username }
                : null;

        const matches = targetUser
            ? eloRepo.getUserMatchHistory(targetUser.id, 20)
            : eloRepo.getRecentMatches(20);

        if (!matches.length)
            return interaction.reply({ content: 'No matches found.', ephemeral: true });

        let currentPage = 0;
        const ITEMS_PER_PAGE = 5;
        const TOTAL_PAGES = Math.ceil(matches.length / ITEMS_PER_PAGE);

        const getPageMatches = (page) => {
            const start = page * ITEMS_PER_PAGE;
            return matches
                .slice(start, start + ITEMS_PER_PAGE)
                .filter(m => m != null && m.match_id != null);
        };

        // Pre-fetch all player data for every match on the current page
        const fetchMatchPlayers = (pageMatches) => {
            const result = {};
            for (const m of pageMatches) 
            {
                const players = eloRepo.getMatchPlayers(m.match_id);
                result[m.match_id] = players ?? []; // null fallback
            }
            return result;
        };

        const getButtons = (page) => new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('mh_prev')
                .setLabel('◀  Previous')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(page === 0),
            new ButtonBuilder()
                .setCustomId('mh_next')
                .setLabel('Next  ▶')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(page === TOTAL_PAGES - 1),
        );

        await interaction.deferReply();

        const pageMatches = getPageMatches(currentPage);
        const matchPlayers = fetchMatchPlayers(pageMatches);

        const buffer = await generateMatchHistoryCard(pageMatches, matchPlayers, currentPage, TOTAL_PAGES, targetUser);
        const attachment = new AttachmentBuilder(buffer, { name: 'matchhistory.png' });

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

            if (i.customId === 'mh_next') currentPage++;
            else if (i.customId === 'mh_prev') currentPage--;

            await i.deferUpdate();

            const newPageMatches = getPageMatches(currentPage);
            const newMatchPlayers = fetchMatchPlayers(newPageMatches);

            const newBuffer = await generateMatchHistoryCard(newPageMatches, newMatchPlayers, currentPage, TOTAL_PAGES, targetUser);
            const newAttachment = new AttachmentBuilder(newBuffer, { name: 'matchhistory.png' });

            await i.editReply({
                files: [newAttachment],
                components: [getButtons(currentPage)],
            });
        });

        collector.on('end', () => {
            interaction.editReply({ components: [] }).catch(() => null);
        });
    },
};