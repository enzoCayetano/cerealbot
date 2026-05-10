const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { HOST_ROLE_ID, TEAM1_VC_ID, TEAM2_VC_ID } = require('../../config');
const eloRepo = require('../../db/eloRepo');
const matchState = require('../../utils/matchState');
const { balanceTeams } = require('../../utils/teamBalancer');
const { buildQueueEmbed, buildQueueRow } = require('./startqueue');

const QUEUE_SIZE = 12;

module.exports = {
    data: new SlashCommandBuilder()
        .setName('testqueue')
        .setDescription('Simulate a full queue with real DB users. (Host/Developer only)')
        .addIntegerOption(option =>
            option.setName('size')
                .setDescription(`How many players to simulate (default: ${QUEUE_SIZE}`)
                .setRequired(false)
                .setMinValue(2)
                .setMaxValue(QUEUE_SIZE)
        ),

    async execute(interaction)
    {
        const member = await interaction.guild.members.fetch(interaction.user.id);

        if (!member.roles.cache.has(HOST_ROLE_ID))
            return interaction.reply({ content: 'Only hosts can run this command.' });

        if (matchState.queue || matchState.match)
        {
            return interaction.reply({
                content: 'A queue or match is already active.',
                ephemeral: true,
            });
        }

        const size = interaction.options.getInteger('size') ?? QUEUE_SIZE;
        if (size % 2 !== 0)
        {
            return interaction.reply({
                content: 'Size must be an even number.',
                ephemeral: true,
            });
        }

        const allUsers = eloRepo.sortTopUsers();
        if (allUsers.length < size)
        {
            return interaction.reply({
                content: `Not enough registered users in the DB to simulate ${size} players. Only ${allUsers.length} registered.`,
                ephemeral: true,
            });
        }

        const shuffled = allUsers.sort(() => Math.random() - 0.5).slice(0, size);
        const profiles = shuffled.map(u => eloRepo.getUserStats(u.id));
        const { teamA, teamB, eloA, eloB, eloDiff } = balanceTeams(profiles);

        const matchEmbed = new EmbedBuilder()
            .setTitle('[TEST] Match Started!')
            .setDescription('This is a simulated match. ELO **will** be updated on result.')
            .setColor(0xFEE75C) // yellow to distinguish from real matches
            .addFields(
                { name: `Team A (${eloA} ELO)`, value: teamA.map(p => `• ${p.username}`).join('\n'), inline: true },
                { name: `Team B (${eloB} ELO)`, value: teamB.map(p => `• ${p.username}`).join('\n'), inline: true },
                { name: 'ELO Difference', value: `${eloDiff}` },
            )
            .setFooter({ text: 'Host: click below to report the winner, or cancel to discard.' });

        const resultRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('match_win_a').setLabel('Team A Won').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('match_win_b').setLabel('Team B Won').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId('match_cancel').setLabel('Cancel Match').setStyle(ButtonStyle.Secondary),
        );

        const reply = await interaction.reply({ embeds: [matchEmbed], components: [resultRow], fetchReply: true });

        matchState.match = {
            messageId: reply.id,
            channelId: reply.channelId,
            teamA: teamA.map(p => p.user_id),
            teamB: teamB.map(p => p.user_id),
        };
    },
};