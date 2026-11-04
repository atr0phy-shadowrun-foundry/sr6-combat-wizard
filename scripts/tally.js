const MODULE = "sr6-turn-wizard";

export function tallyKey(actor) {
    const combat = game.combat;
    const round = combat ? `${combat.id}:${combat.round}:${combat.turn}` : "none";
    return `${round}:${actor?.uuid ?? "none"}`;
}

export function readTally(actor) {
    const key = tallyKey(actor);
    const stored = game.user.getFlag(MODULE, "tally");
    if (!stored || stored.key !== key) return { key, major: 0, minor: 0 };
    return {
        key,
        major: Number(stored.major) || 0,
        minor: Number(stored.minor) || 0,
    };
}

export async function addTally(actor, track, delta) {
    const current = readTally(actor);
    const step = Number(delta) || 0;
    if (track === "major") current.major = Math.max(0, current.major + step);
    if (track === "minor") current.minor = Math.max(0, current.minor + step);
    await game.user.setFlag(MODULE, "tally", current);
    return current;
}
