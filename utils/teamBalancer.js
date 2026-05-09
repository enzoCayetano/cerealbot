// function to find the most balanced split team

function balanceTeams(players)
{
    const n = players.length;
    const half = n / 2;
    let bestDiff = Infinity;
    let bestTeamA = null;

    const indices = players.map((_, i) => i);

    function combine(start, combo)
    {
        if (combo.length === half)
        {
            const teamA = combo.map(i => players[i]);
            const teamB = players.filter((_, i) => !combo.includes(i));
            const eloA = teamA.reduce((s, p) => s + p.elo, 0);
            const eloB = teamB.reduce((s, p) => s + p.elo, 0);
            const diff = Math.abs(eloA - eloB);

            if (diff < bestDiff)
            {
                bestDiff = diff;
                bestTeamA = { teamA, teamB, eloA, eloB };
            }

            return;
        }

        for (let i = start; i < n; i++)
        {
            combine(i + 1, [...combo, i]);
        }
    }

    combine(0, []);
    return { ...bestTeamA, eloDiff: bestDiff };
}

module.exports = { balanceTeams };