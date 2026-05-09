const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
const eloRepo = require('../../db/eloRepo');
const { sendErrorLog } = require('../../utils/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('rank')
        .setDescription('Query your current rank/ELO.')
        .addUserOption(option => 
            option.setName('user')
                .setDescription('User to view profile of')
                .setRequired(false)
        ),

    async execute(interaction)
    {
        // Get user from parameter
        const targetUser = interaction.options.getUser('user') || interaction.user;
        const userId = targetUser.id;
        const username = targetUser.username;

        const member = await interaction.guild.members.fetch(userId);

        try
        {
            const member = await interaction.guild.members.fetch(userId);
            const profile = eloRepo.getUserStats(userId, username);

            if (!profile)
            {
                return await interaction.reply({
                    content: `${targetUser.username} is currently not registered yet!`
                });
            }

            const winrate = profile.games_played > 0
                ? ((profile.wins / profile.games_played) * 100).toFixed(1)
                : '0.0';

            const embed = new EmbedBuilder()
                .setTitle(`${profile.username}'s Profile`)
                .setThumbnail(member.displayAvatarURL())
                .setColor(0x5865F2) // change this to MR rank colors later
                .addFields(
                    { name: 'ELO',         value: `${profile.elo}`,          inline: true },
                    { name: 'Peak ELO',         value: `${profile.highest_elo}`,          inline: true },
                    { name: 'Rank',         value: `#${profile.rank}`,        inline: true },
                    { name: 'Wins',         value: `${profile.wins}`,         inline: true },
                    { name: 'Losses',       value: `${profile.losses}`,       inline: true },
                    { name: 'Streak',       value: `${profile.current_streak} win(s)`, inline: true },
                    { name: 'Games Played', value: `${profile.games_played}`, inline: true },
                    { name: 'Winrate',      value: `${winrate}%`,             inline: true },
                )
                .setFooter({ text: `Last played: ${new Date(profile.last_played).toLocaleDateString()}` });

            await interaction.reply({ embeds: [embed] });
        }
        catch (err)
        {
            console.error('Error fetching user or profile:', err);
            await interaction.reply({
                content: `An error occurred while fetching the profile for ${targetUser.username}. Please try again later.`
            });
            sendErrorLog(`Error in /rank command for user ${targetUser.username} (${userId}): ${err.message}`);
        }
    },
}