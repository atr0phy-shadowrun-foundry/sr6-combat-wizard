/**
 * Pure helpers for the turn wizard. No Foundry globals.
 */

const ORDNANCE = new Set(["GRENADES", "ROCKETS", "MISSILES", "EXPLOSIVES"]);
const WEAPON_TYPES = new Set([
    "WEAPON_FIREARMS",
    "WEAPON_CLOSE_COMBAT",
    "WEAPON_RANGED",
    "WEAPON_SPECIAL",
]);

/**
 * @param {object} item A Foundry item-like object `{ type, system }`.
 * @returns {"ordnance"|"gunnery"|"special"|"thrown"|"firearm"|"melee"|"limb"|null}
 */
export function classifyGear(item) {
    if (!item || item.type !== "gear") return null;
    const system = item.system ?? {};
    const type = system.type || "";
    const subtype = system.subtype || "";
    const skill = system.skill || "";

    if (type === "AMMUNITION" && ORDNANCE.has(subtype)) return "ordnance";

    if (skill === "engineering") return "gunnery";
    if (skill === "exotic_weapons" || type === "WEAPON_SPECIAL") return "special";
    if (skill === "athletics" || type === "WEAPON_RANGED") return "thrown";
    if (skill === "firearms" || type === "WEAPON_FIREARMS") return "firearm";

    if (
        type === "WEAPON_CLOSE_COMBAT"
        || skill === "close_combat"
        || subtype === "UNARMED"
        || subtype === "CYBER_IMPLANT_WEAPON"
        || subtype === "BIOWARE_IMPLANT_WEAPON"
    ) return "melee";

    if (subtype === "CYBER_LIMBS") return "limb";
    if (WEAPON_TYPES.has(type) && system.dmg != null) return "special";
    return null;
}

/**
 * Core allotment: 1 major, plus 1 minor, plus 1 minor per initiative die.
 * A character does not start the turn with more than 5 minor actions.
 * @param {number|null|undefined} dice
 */
export function actionAllotment(dice) {
    const known = Number.isFinite(dice);
    const counted = known ? Math.max(0, dice) : 1;
    const minorBase = 1 + Math.max(1, counted);
    return {
        dice: counted,
        diceKnown: known,
        major: 1,
        minor: Math.min(5, minorBase),
        companionSixth: counted >= 5,
    };
}

/**
 * @param {{ dice?: number, diceMod?: number }|null|undefined} ini
 * @returns {number|null}
 */
export function sumInitiativeDice(ini) {
    if (!ini) return null;
    const dice = Number(ini.dice ?? 0) + Number(ini.diceMod ?? 0);
    return Number.isFinite(dice) ? dice : null;
}

/**
 * @param {object} system
 * @returns {string[]} Mode ids the weapon actually has: SS, SA, BF, FA.
 */
export function enabledFireModes(system) {
    const modes = system?.modes ?? {};
    return ["SS", "SA", "BF", "FA"].filter((id) => Boolean(modes[id]));
}
