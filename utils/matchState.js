const state = {
    queue: null,    // { messageId, channelId, players: Set<userId>, timeoutHandle, startedAt }
    match: null,    // { messageId, channelId, teamA: [], teamB: [], pointChange: null }
}

module.exports = state;