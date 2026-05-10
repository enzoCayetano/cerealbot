const { Collection, Events, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { AWAITING_VC_ID, TEAM1_VC_ID, TEAM2_VC_ID, HOST_ROLE_ID } = require('../config');
const eloRepo = require('../db/eloRepo');
const matchState = require('../utils/matchState');
const { balanceTeams } = require('../utils/teamBalancer');
const { buildQueueEmbed, buildQueueRow } = require('../commands/admin/startqueue');

const QUEUE_SIZE = 12;

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction) 
    {
        // ---- HANDLE SLASH COMMANDS ----
        if (interaction.isCommand()) {
            const command = interaction.client.commands.get(interaction.commandName);

            if (!command) 
            {
            console.error(`No command matching ${interaction.commandName} was found.`);
            return;
            }

            // COOLDOWNS
            const { cooldowns } = interaction.client;

            if (!cooldowns.has(command.data.name))
            cooldowns.set(command.data.name, new Collection());

            const now = Date.now();
            const timestamps = cooldowns.get(command.data.name);
            const defaultCooldownDuration = 3;
            const cooldownAmount = (command.cooldown ?? defaultCooldownDuration) * 1000;

            if (timestamps.has(interaction.user.id)) 
            {
            const expirationTime = timestamps.get(interaction.user.id) + cooldownAmount;

            if (now < expirationTime) 
            {
                const expiredTimestamp = Math.round(expirationTime / 1000);
                return interaction.reply({
                content: `Please wait, this command has a cooldown of \`${command.data.name}\`. You can use it again <t:${expiredTimestamp}:R>.`,
                ephemeral: true,
                });
            }
            }

            timestamps.set(interaction.user.id, now);
            setTimeout(() => timestamps.delete(interaction.user.id), cooldownAmount);

            try 
            {
            await command.execute(interaction);
            } 
            catch (error) 
            {
            console.error(`Error executing ${interaction.commandName}`);
            console.error(error);
            }

            return;
        }

        // ---- HANDLE BUTTONS ----
        if (!interaction.isButton()) return;

        const { customId, user, guild } = interaction;

        // ---- QUEUE JOIN ----
        if (customId === 'queue_join')
        {
            if (!matchState.queue)
                return interaction.reply({ content: 'No active queue.', ephemeral: true });

            const profile = eloRepo.getUserStats(user.id);
            if (!profile)
                return interaction.reply({ content: 'You are not registered. Use `/register` first.', ephemeral: true });

            const member = await guild.members.fetch(user.id);
            if (member.voice.channelId !== AWAITING_VC_ID)
                return interaction.reply({ content: `You must be in <#${AWAITING_VC_ID}> to join the queue.`, ephemeral: true });

            if (matchState.queue.players.has(user.id))
                return interaction.reply({ content: 'You are already in the queue.', ephemeral: true });

            matchState.queue.players.add(user.id);
            const playerList = [...matchState.queue.players];
            const playerObjects = playerList.map(id => {
                const p = eloRepo.getUserStats(id);
                return { username: p?.username ?? id, elo: p?.elo ?? 1000 };
            });

            // Show Start Match button when full, but don't auto-start
            await interaction.update({
                embeds: [buildQueueEmbed(playerObjects, matchState.queue.size ?? QUEUE_SIZE)],
                components: [buildQueueRow(false, playerList.length, matchState.queue.size ?? QUEUE_SIZE)],
            });
            return;
        }

        // ---- QUEUE LEAVE ----
        if (customId === 'queue_leave')
        {
            if (!matchState.queue || !matchState.queue.players.has(user.id))
            return interaction.reply({ content: 'You are not in the queue.', ephemeral: true });

            matchState.queue.players.delete(user.id);
            const playerList = [...matchState.queue.players];
            const playerObjects = playerList.map(id => {
                const p = eloRepo.getUserStats(id);
                return { username: p?.username ?? id, elo: p?.elo ?? 1000 };
            });

            await interaction.update({
                embeds: [buildQueueEmbed(playerObjects, matchState.queue.size ?? QUEUE_SIZE)],
                components: [buildQueueRow(false, playerList.length, matchState.queue.size ?? QUEUE_SIZE)],
            });
            return;
        }

        // ---- QUEUE START ----
        if (customId === 'queue_start')
        {
            const member = await guild.members.fetch(user.id);
            if (!member.roles.cache.has(HOST_ROLE_ID))
                return interaction.reply({ content: 'Only hosts can start the match.', ephemeral: true });

            if (!matchState.queue)
                return interaction.reply({ content: 'No active queue.', ephemeral: true });

            const playerList = [...matchState.queue.players];
            const requiredSize = matchState.queue.size ?? QUEUE_SIZE;

            if (playerList.length < requiredSize)
                return interaction.reply({ content: `Not enough players. Need ${requiredSize}, have ${playerList.length}.`, ephemeral: true });

            await interaction.deferUpdate();

            await interaction.editReply({
                embeds: [new EmbedBuilder()
                    .setTitle('Starting Match...')
                    .setDescription('Balancing teams and moving players to VC...')
                    .setColor(0xFEE75C)
                ],
                components: [],
            });

            try
            {
                clearTimeout(matchState.queue.timeoutHandle);
                const queueChannelId = matchState.queue.channelId;

                const profiles = playerList.map(id => eloRepo.getUserStats(id));

                const { teamA, teamB, eloA, eloB, eloDiff } = balanceTeams(profiles);

                await Promise.allSettled([
                    ...teamA.map(async p => {
                        const m = await guild.members.fetch(p.user_id);
                        await m.voice.setChannel(TEAM1_VC_ID);
                    }),
                    ...teamB.map(async p => {
                        const m = await guild.members.fetch(p.user_id);
                        await m.voice.setChannel(TEAM2_VC_ID);
                    }),
                ]);

                const matchEmbed = new EmbedBuilder()
                    .setTitle('Match Started!')
                    .setColor(0x57F287)
                    .addFields(
                        {
                            name: `Team A (${eloA} ELO avg)`,
                            value: teamA.map(p => `• **${p.username}** — ${p.elo} ELO`).join('\n'),
                            inline: true,
                        },
                        {
                            name: `Team B (${eloB} ELO avg)`,
                            value: teamB.map(p => `• **${p.username}** — ${p.elo} ELO`).join('\n'),
                            inline: true,
                        },
                        { name: 'ELO Difference', value: `${eloDiff}` },
                    )
                    .setFooter({ text: 'Host: Click below to report the winner, or cancel to discard.' });

                const resultRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('match_win_a').setLabel('Team A Won').setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId('match_win_b').setLabel('Team B Won').setStyle(ButtonStyle.Danger),
                    new ButtonBuilder().setCustomId('match_cancel').setLabel('Cancel Match').setStyle(ButtonStyle.Secondary),
                );

                const channel = await guild.channels.fetch(queueChannelId);

                const matchMsg = await channel.send({ embeds: [matchEmbed], components: [resultRow] });

                matchState.match = {
                    messageId: matchMsg.id,
                    channelId: matchMsg.channelId,
                    teamA: teamA.map(p => p.user_id),
                    teamB: teamB.map(p => p.user_id),
                };
                matchState.queue = null;

                await interaction.editReply({
                    embeds: [new EmbedBuilder().setTitle('✅ Match Started!').setColor(0x57F287)],
                    components: [],
                });
            }
            catch (err)
            {
                console.error('queue_start error:', err);
            }
            return;
        }

        // ---- QUEUE CANCEL ----
        if (customId === 'queue_cancel')
        {
            const member = await guild.members.fetch(user.id);
            if (!member.roles.cache.has(HOST_ROLE_ID))
                return interaction.reply({ content: 'Only hosts can cancel the queue.', ephemeral: true });

            if (!matchState.queue)
                return interaction.reply({ content: 'No active queue to cancel.', ephemeral: true });

            clearTimeout(matchState.queue.timeoutHandle);
            matchState.queue = null;

            await interaction.update({
                embeds: [
                    new EmbedBuilder()
                        .setTitle('Queue Cancelled')
                        .setDescription('The host cancelled the queue.')
                        .setColor(0xED4245),
                ],
                components: [],
            });
            
            return;
        }

        // ---- MATCH RESULT ----
        if (customId === 'match_win_a' || customId === 'match_win_b')
        {
            const member = await guild.members.fetch(user.id);
            if (!member.roles.cache.has(HOST_ROLE_ID))
                return interaction.reply({ content: 'Only hosts can report the winner.', ephemeral: true });

            if (!matchState.match)
                return interaction.reply({ content: 'No active match found.', ephemeral: true });

            // snapshot ELO before update
            const beforeA = matchState.match.teamA.map(id => {
                const p = eloRepo.getUserStats(id);
                return { id, username: p?.username ?? id, elo: p?.elo ?? 1000 };
            });
            const beforeB = matchState.match.teamB.map(id => {
                const p = eloRepo.getUserStats(id);
                return { id, username: p?.username ?? id, elo: p?.elo ?? 1000 };
            });

            const winner = customId === 'match_win_a' ? 'A' : 'B';
            const { teamA, teamB } = matchState.match;
            const pointChange = eloRepo.updateMatchResults(teamA, teamB, winner);

            const winnerLabel = winner === 'A' ? 'Team A' : 'Team B';
            const loserLabel  = winner === 'A' ? 'Team B' : 'Team A';

            const winnerBefore = winner === 'A' ? beforeA : beforeB;
            const loserBefore  = winner === 'A' ? beforeB : beforeA;

            const resultEmbed = new EmbedBuilder()
                .setTitle(`${winnerLabel} Wins!`)
                .setColor(winner === 'A' ? 0x5865F2 : 0xED4245)
                .addFields(
                    {
                        name: `${winnerLabel} ✅`,
                        value: winnerBefore.map(p => `• **${p.username}** — ${p.elo} → ${p.elo + pointChange} ELO (+${pointChange})`).join('\n'),
                        inline: true,
                    },
                    {
                        name: `${loserLabel} ❌`,
                        value: loserBefore.map(p => `• **${p.username}** — ${p.elo} → ${p.elo - pointChange} ELO (-${pointChange})`).join('\n'),
                        inline: true,
                    },
                )
                .setTimestamp();

            matchState.match = null;

            await interaction.update({ embeds: [resultEmbed], components: [] });
            return;
        }

        // ---- MATCH CANCEL ----
        if (customId === 'match_cancel')
        {
            const member = await guild.members.fetch(user.id);
            if (!member.roles.cache.has(HOST_ROLE_ID))
                return interaction.reply({ content: 'Only hosts can cancel a match.', ephemeral: true });

            if (!matchState.match)
                return interaction.reply({ content: 'No active match to cancel.', ephemeral: true });

            matchState.match = null;

            await interaction.update({
                embeds: [
                    new EmbedBuilder()
                        .setTitle('Match Cancelled')
                        .setDescription('The host cancelled the match. No ELO was changed.')
                        .setColor(0xED4245),
                ],
                components: [],
            });
            return;
        }
    },
};