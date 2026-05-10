const { SlashCommandBuilder, AttachmentBuilder } = require('discord.js');
const eloRepo = require('../../db/eloRepo');
const { sendErrorLog } = require('../../utils/logger');
const { generateProfileCard } = require('../../utils/profileCard');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('profile')
        .setDescription('Query your profile.')
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
            await interaction.deferReply();

            const member = await interaction.guild.members.fetch(userId);
            const profile = eloRepo.getUserStats(userId);

            if (!profile) {
                return await interaction.editReply({
                    content: `${targetUser.username} is not registered yet!`,
                });
            }

            const avatarURL = member.displayAvatarURL({ extension: 'png', forceStatic: true });
            const imageBuffer = await generateProfileCard(profile, avatarURL);

            const attachment = new AttachmentBuilder(imageBuffer, { name: 'profile.png' });
            await interaction.editReply({ files: [attachment] });
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