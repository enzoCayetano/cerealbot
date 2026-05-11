const OAA_SLOTS = 3;

const RANKS = [
    { name: 'Bronze III',    minElo: 0    },
    { name: 'Bronze II',     minElo: 100  },
    { name: 'Bronze I',      minElo: 200  },
    { name: 'Silver III',    minElo: 300  },
    { name: 'Silver II',     minElo: 400  },
    { name: 'Silver I',      minElo: 500  },
    { name: 'Gold III',      minElo: 600  },
    { name: 'Gold II',       minElo: 700  },
    { name: 'Gold I',        minElo: 800  },
    { name: 'Platinum III',  minElo: 900  },
    { name: 'Platinum II',   minElo: 1000 },
    { name: 'Platinum I',    minElo: 1100 },
    { name: 'Diamond III',   minElo: 1200 },
    { name: 'Diamond II',    minElo: 1300 },
    { name: 'Diamond I',     minElo: 1400 },
    { name: 'Grandmaster III',   minElo: 1500 },
    { name: 'Grandmaster II',   minElo: 1600 },
    { name: 'Grandmaster II',   minElo: 1700 },
    { name: 'Celestial III',     minElo: 1800 },
    { name: 'Celestial II',     minElo: 1900 },
    { name: 'Celestial I',     minElo: 2000 },
    { name: 'Eternity',      minElo: 2200 },
];

// Optional: colors per tier for canvas cards
const RANK_COLORS = {
    'Bronze':      '#ae6e2e',
    'Silver':      '#c0c0c0',
    'Gold':        '#ffd700',
    'Platinum':    '#4dd9e0',
    'Diamond':     '#222ac4',
    'Grandmaster': '#542cd7',
    'Celestial':   '#e89d12',
    'Eternity':    '#eb459e',
    'One Above All': '#d41515',
};

function getRank(elo) {
    // Walk backwards to find the highest rank the player qualifies for
    for (let i = RANKS.length - 1; i >= 0; i--) {
        if (elo >= RANKS[i].minElo) return RANKS[i];
    }
    return RANKS[0];
}

function getRankColor(rankName) {
    const tier = Object.keys(RANK_COLORS).find(t => rankName.startsWith(t));
    return tier ? RANK_COLORS[tier] : '#ffffff';
}

function getNextRank(elo) {
    for (let i = 0; i < RANKS.length; i++) {
        if (elo < RANKS[i].minElo) return RANKS[i];
    }
    return null; // already max rank
}

function getRankProgress(elo) {
    const current = getRank(elo);
    const next = getNextRank(elo);

    if (!next) return { current, next: null, progress: 100, eloNeeded: 0 };

    const range = next.minElo - current.minElo;
    const earned = elo - current.minElo;
    const progress = Math.floor((earned / range) * 100);
    const eloNeeded = next.minElo - elo;

    return { current, next, progress, eloNeeded };
}

function getRankWithOAA(elo, globalRank) {
    // globalRank is the player's rank column from the db (1 = best)
    if (globalRank != null && globalRank <= OAA_SLOTS) {
        return { name: 'One Above All', minElo: 0 };
    }
    return getRank(elo);
}

module.exports = { RANKS, RANK_COLORS, getRank, getRankColor, getNextRank, getRankProgress, getRankWithOAA, OAA_SLOTS };