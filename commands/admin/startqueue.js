const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, } = require('discord.js');
const { AWAITING_VC_ID, QUEUE_TIMEOUT_MS, HOST_ROLE_ID } = require('../../config');
const eloRepo = require('../../db/eloRepo');
const matchState = require('../../utils/matchState');
const { balanceTeams } = require('../../utils/teamBalancer');
const { sendErrorLog } = require('../../utils/logger');

const QUEUE_SIZE = 12;

module.exports = {
    data: new SlashCommandBuilder()
        .setName('startqueue')
        .setDescription('Open a queue for the next match. (HOST ONLY)'),

    async execute(interaction)
    {
        const member = await interaction.guild.members.fetch(interaction.user.id);

        if (!member.roles.cache.has(HOST_ROLE_ID))
        {
            return await interaction.reply({
                content: 'Only hosts can start a queue.',
                ephemeral: true,
            });
        }

        if (matchState.queue || matchState.matchState)
        {
            return await interaction.reply({
                content: 'A queue or match is already active. End it before starting a new one.',
                ephemeral: true,
            });
        }

        const embed = buildQueueEmbed([], QUEUE_SIZE);
        const row = buildQueueRow();

        const reply = await interaction.reply({
            embeds: [embed],
            components: [row],
            fetchReply: true,
        });

        const timeoutHandle = setTimeout(async () => {
            if (!matchState.queue) return;
            matchState.queue = null;

            try
            {
                await reply.edit({
                    embeds: [
                        new EmbedBuilder()
                            .setTitle('Queue Expired')
                            .setDescription('Not enough players joined in time. Host can run `/startqueue` again.')
                            .setColor(0xED4245),
                    ],
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
    },
};

function buildQueueEmbed(players, total)
{
    return new EmbedBuilder()
        .setTitle('Match Queue')
        .setDescription(`Click **Join** to enter the queue. You must be in the <#${AWAITING_VC_ID}> voice channel.`)
        .addFields(
            { name: `Players (${players.length}/${total})`, value: players.length > 0 ? players.map(p => `• ${p}`).join('\n') : 'None' }
        )
        .setColor(0x5865F2);
}

function buildQueueRow(disabled = false)
{
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('queue_join')
            .setLabel('Join')
            .setStyle(ButtonStyle.Success)
            .setDisabled(disabled),
        new ButtonBuilder()
            .setCustomId('queue_leave')
            .setLabel('Leave')
            .setStyle(ButtonStyle.Danger)
            .setDisabled(disabled),
        new ButtonBuilder()
            .setCustomId('queue_cancel')
            .setLabel('Cancel Queue')
            .setStyle(ButtonStyle.Secondary),
    );
}

async function fillQueue(guild, interaction, size) 
{
    const allUsers = eloRepo.sortTopUsers();
    if (allUsers.length < size) {
        await interaction.editReply({
            content: `Not enough registered users in the DB. Need ${size}, only have ${allUsers.length}.`,
        });
        return;
    }

    // Shuffle and fill queue with dummy IDs using GHOST_ prefix for non-real members
    const shuffled = allUsers.sort(() => Math.random() - 0.5).slice(0, size);
    shuffled.forEach(u => matchState.queue.players.add(u.id));

    // Update the queue embed to show filled players
    const usernames = shuffled.map(u => u.username);
    const channel = await guild.channels.fetch(matchState.queue.channelId);
    const message = await channel.messages.fetch(matchState.queue.messageId);

    await message.edit({
        embeds: [buildQueueEmbed(usernames, size)],
        components: [buildQueueRow()],
    });

    // Trigger the same queue-full logic by faking a queue_join interaction
    // by directly calling the balancer and match start
    clearTimeout(matchState.queue.timeoutHandle);

    const profiles = shuffled.map(u => eloRepo.getUserStats(u.id));
    const { teamA, teamB, eloA, eloB, eloDiff } = balanceTeams(profiles);

    const matchEmbed = new EmbedBuilder()
        .setTitle('⚔️ [TEST] Match Started!')
        .setDescription('Simulated match — ELO **will** update on result.')
        .setColor(0xFEE75C)
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

    const matchMsg = await channel.send({ embeds: [matchEmbed], components: [resultRow] });

    matchState.match = {
        messageId: matchMsg.id,
        channelId: matchMsg.channelId,
        teamA: teamA.map(p => p.user_id),
        teamB: teamB.map(p => p.user_id),
    };
    matchState.queue = null;

    await message.edit({
        embeds: [new EmbedBuilder().setTitle('[TEST] Queue Filled — Match Started!').setColor(0x57F287)],
        components: [],
    });
}

module.exports = { buildQueueEmbed, buildQueueRow, fillQueue };