const { Events } = require('discord.js');
const eloRepo = require('../db/eloRepo');

module.exports = {
    name: Events.GuildMemberUpdate,
    async execute(oldMember, newMember)
    {
        if (oldMember.displayName !== newMember.displayName)
        {
            await eloRepo.ensureUser(newMember.id, newMember.displayName);
            console.log(`Updated name for ${newMember.id} to ${newMember.displayName}`);
        }
    }
}