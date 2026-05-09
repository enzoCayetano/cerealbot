const { Collection, Events, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { AWAITING_VC_ID, TEAM1_VC_ID, TEAM2_VC_ID, HOST_ROLE_ID } = require('../config');
const eloRepo = require('../db/eloRepo');
const matchState = require('../utils/matchState');
const { balanceTeams } = require('../utils/teamBalancer');
const { buildQueueEmbed, buildQueueRow } = require('../commands/admin/startqueue');
const { match } = require('node:assert');

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
            if (!profile) return interaction.reply({ content: 'You are not registered. User `/register` first.', ephemeral: true });

            const member = await guild.members.fetch(user.id);
            if (member.voice.channelId !== AWAITING_VC_ID) return interaction.reply({ content: `You must be in <#${AWAITING_VC_ID}> to join the queue.`, ephemeral: true });

            if (matchState.queue.players.has(user.id)) return interaction.reply({ content: 'You are already in the queue.', ephemeral: true });

            matchState.queue.players.add(user.id);
            const playerList = [...matchState.queue.players];

            // queue full
            if (playerList.length >= QUEUE_SIZE)
            {
                clearTimeout(matchState.queue.timeoutHandle);

                const profiles = playerList.map(id => eloRepo.getUserStats(id));
                const { teamA, teamB, eloA, eloB, eloDiff } = balanceTeams(profiles);

                for (const p of teamA)
                {
                    try { await (await guild.members.fetch(p.user_id)).voice.setChannel(TEAM1_VC_ID); }
                    catch (_) {}
                }

                for (const p of teamB)
                {
                    try { await (await guild.members.fetch(p.user_id)).voice.setChannel(TEAM2_VC_ID); }
                    catch (_) {}
                }

                const matchEmbed = new EmbedBuilder()
                    .setTitle('Ongoing Match')
                    .setColor(0x57F287)
                    .addFields(
                        { name: `Team A (${eloA} ELO)`, value: teamA.map(p => `• ${p.username}`).join('\n'), inline: true },
                        { name: `Team B (${eloB} ELO)`, value: teamB.map(p => `• ${p.username}`).join('\n'), inline: true },
                        { name: 'ELO Difference', value: `${eloDiff}` },
                    )
                    .setFooter({ text: 'Host: click the button below to report the winner.' });

                const resultRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('match_win_a').setLabel('Team A Won').setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId('match_win_b').setLabel('Team B Won').setStyle(ButtonStyle.Danger),
                );

                const channel = await guild.channel(matchState.queue.channelId);
                const matchMsg = await channel.send({ embeds: [matchEmbed], components: [resultRow] });

                matchState.match = {
                    messageId: matchMsg.id,
                    channelId: matchMsg.channelId,
                    teamA: teamA.map(p => p.user_id),
                    teamB: teamB.map(p => p.user_id),
                };
                matchState.queue = null;

                await interaction.update({
                    embeds: [new EmbedBuilder().setTitle('Queue Full - Ongoing Match!').setColor(0x57F287)],
                    components: [],
                });

                return;
            }

            // if queue not full
            const usernames = playerList.map(id => eloRepo.getUserStats(id)?.username ?? id);
            await interaction.update({
                embeds: [buildQueueEmbed(usernames, QUEUE_SIZE)],
                components: [buildQueueRow()],
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
            const usernames = playerList.map(id => eloRepo.getUserStats(id)?.username ?? id);

            await interaction.update({
                embeds: [buildQueueEmbed(usernames, QUEUE_SIZE)],
                components: [buildQueueRow()],
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

            const winner = customId === 'match_win_a' ? 'A' : 'B';
            const { teamA, teamB } = matchState.match;
            const pointChange = eloRepo.updateMatchResults(teamA, teamB, winner);

            const winnerLabel = winner === 'A' ? 'Team A' : 'Team B';
            const loserLabel = winner === 'A' ? 'Team B' : 'Team A';

            // fetch usernames for results
            const teamANames = teamA.map(id => eloRepo.getUserStats(id)?.username ?? id);
            const teamBNames = teamB.map(id => eloRepo.getUserStats(id)?.username ?? id);

            const resultEmbed = new EmbedBuilder()
                .setTitle(`${winnerLabel} Wins!`)
                .setColor(winner === 'A' ? 0x5865F2: 0xED4245)
                .addFields(
                    { name: `Team A`, value: teamANames.join('\n'), inline: true },
                    { name: `Team B`, value: teamBNames.join('\n'), inline: true },
                    { name: 'ELO Change', value: `Winner: **+${pointChange}** | Loser: **-${pointChange}**` },
                )
                .setTimestamp();

            matchState.match = null;

            await interaction.update({ embeds: [resultEmbed], components: [] });
            return;
        }
    },
};