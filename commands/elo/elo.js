const { SlashCommandBuilder } = require('discord.js');
const eloRepo = require('../../db/eloRepo');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('elo')
        .setDescription('Query your current ELO.')
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
            const elo = eloRepo.getElo(userId);

            await interaction.reply(`**${username}** has **${elo} ELO!**`);
        }
        catch (err)
        {
            console.error(err);
            await interaction.reply({
                content: 'Something went wrong while fetching ELO.',
                ephemeral: true,
            });
        }
    },
}