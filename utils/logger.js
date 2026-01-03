const { EmbedBuilder } = require('discord.js');
const LOG_CHANNEL_ID = '1456924810205462590';

// logs error messages to a channel
async function sendErrorLog(client, title, error, user = null)
{
    try
    {
        const channel = await client.channels.fetch(LOG_CHANNEL_ID);
        if (!channel) return;

        const emberd = new EmbedBuilder()
            .setTitle(`${title}`)
            .setColor(0xFF0000)
            .addFields(
                { name: 'Error Message', value: `\`\`\`js\n${error.message || error}\n\`\`\` ` },
                { name: 'Timestamp', value: `<t:${Math.floor(Date.now() / 1000)}:f>` }
            )
            .setTimestamp();
            
        if (user)
        {
            embed.addFields({ name: 'User involved', value: `${user.tag} (${user.id})` });
        }

        await channel.send({ embeds: [embed] });
    }
    catch (err)
    {
        console.error('The logger itself failed:', err);
    }
}

module.exports = { sendErrorLog };