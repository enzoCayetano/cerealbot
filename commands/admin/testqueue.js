const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { HOST_ROLE_ID, TEAM1_VC_ID, TEAM2_VC_ID, QUEUE_TIMEOUT_MS } = require('../../config');
const eloRepo = require('../../db/eloRepo');
const matchState = require('../../utils/matchState');
const { balanceTeams } = require('../../utils/teamBalancer');
const { buildQueueEmbed, buildQueueRow, fillQueue } = require('./startqueue');

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
            return interaction.reply({ content: 'Only hosts can run test commands.', ephemeral: true });

        if (matchState.queue || matchState.match)
            return interaction.reply({ content: 'A queue or match is already active.', ephemeral: true });

        const size = interaction.options.getInteger('size') ?? QUEUE_SIZE;
        if (size % 2 !== 0)
            return interaction.reply({ content: 'Size must be an even number.', ephemeral: true });

        // Open the real queue
        const embed = buildQueueEmbed([], size);
        const row = buildQueueRow();
        const reply = await interaction.reply({ embeds: [embed], components: [row], fetchReply: true });

        const timeoutHandle = setTimeout(async () => {
            if (!matchState.queue) return;
            matchState.queue = null;
            try {
                await reply.edit({
                    embeds: [new EmbedBuilder().setTitle('Queue Expired').setColor(0xED4245)],
                    components: [],
                });
            } catch (_) {}
        }, QUEUE_TIMEOUT_MS);

        matchState.queue = {
            messageId: reply.id,
            channelId: reply.channelId,
            players: new Set(),
            timeoutHandle,
        };

        // Immediately fill it with DB users
        await fillQueue(interaction.guild, interaction, size);
    },
};