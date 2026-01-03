const { Events } = require('discord.js');
const eloRepo = require('../db/eloRepo');
const { sendErrorLog } = require('../utils/logger');

module.exports = {
    name: 'guildMemberAdd',
    async execute (member)
    {
        if (member.user.bot) return;
    

        try
        {
            await eloRepo.ensureUser(member.id);
            console.log(`Auto-initialized ELO for: ${member.user.tag}`);
        } 
        catch (error)
        {
            console.error(`Failed to init ELO for ${member.id}:`, error);
            await sendErrorLog(member.client, 'ELO Auto-Initialization Failed', error, member.user);
        }
    },
};