const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, } = require('discord.js');
const { AWAITING_VC_ID, QUEUE_TIMEOUT_MS, HOST_ROLE_ID } = require('../../config');
const eloRepo = require('../../db/eloRepo');
const matchState = require('../../utils/matchState');
const { balanceTeams } = require('../../utils/teamBalancer');
const { sendErrorLog } = require('../../utils/logger');

const QUEUE_SIZE = 12;

module.exports = {
    data: new SlashCommandBuilder()
        .setName('start-queue')
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

        if (matchState.queue || matchState.match)
        {
            return await interaction.reply({
                content: 'A queue or match is already active. End it before starting a new one.',
                ephemeral: true,
            });
        }

        const embed = buildQueueEmbed([], QUEUE_SIZE);
        const row = buildQueueRow(false, 0, QUEUE_SIZE);

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
            size: QUEUE_SIZE,
        };
    },
    
    buildQueueEmbed,
    buildQueueRow,
    fillQueue,
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

function buildQueueRow(disabled = false, playerCount = 0, queueSize = 12)
{
    const row = new ActionRowBuilder().addComponents(
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
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(disabled),
    );

    if (playerCount >= queueSize) 
    {
        row.addComponents(
            new ButtonBuilder()
                .setCustomId('queue_start')
                .setLabel('Start Match')
                .setStyle(ButtonStyle.Primary)
        );
    }

    return row;
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

    const shuffled = allUsers.sort(() => Math.random() - 0.5).slice(0, size);
    shuffled.forEach(u => matchState.queue.players.add(u.id));

    const usernames = shuffled.map(u => u.username);
    const channel = await guild.channels.fetch(matchState.queue.channelId);
    const message = await channel.messages.fetch(matchState.queue.messageId);

    // Just fill the queue and show the Start Match button — let the host press it
    await message.edit({
        embeds: [buildQueueEmbed(usernames, size)],
        components: [buildQueueRow(false, size, size)],
    });
}