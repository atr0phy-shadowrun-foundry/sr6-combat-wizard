/**
 * Items the wizard can place on a sheet when Eden has no rollable weapon for them.
 * Embedded launchers and shotguns are modifier refs on the parent gun. They are not
 * their own documents in shadowrun-data. The fields below are the roll data only.
 */

const CATALOG = {
    alpha_launcher: {
        name: "Ares Alpha Grenade Launcher",
        hint: "Exotic Weapons. Damage is the grenade. This adds the launcher, then opens its attack.",
        system: {
            genesisID: "alpha_launcher",
            description: "<p>Second weapon for the Ares Alpha. The rifle's fire-mode list cannot fire this. Damage comes from the grenade, and the blast is still applied by hand.</p>",
            type: "WEAPON_SPECIAL",
            subtype: "LAUNCHERS",
            skill: "exotic_weapons",
            skillSpec: "launchers",
            dmg: 0,
            stun: false,
            dmgDef: "grenade",
            attackRating: [4, 10, 6, 2, 0],
            modes: { BF: false, FA: false, SA: false, SS: true },
            count: 1,
        },
    },
    raiden_launcher: {
        name: "Yamaha Raiden Underbarrel Grenade Launcher",
        hint: "Exotic Weapons. Damage is the grenade. This adds the launcher, then opens its attack.",
        system: {
            genesisID: "raiden_launcher",
            description: "<p>Second weapon for the Yamaha Raiden. Damage comes from the grenade, and the blast is still applied by hand.</p>",
            type: "WEAPON_SPECIAL",
            subtype: "LAUNCHERS",
            skill: "exotic_weapons",
            skillSpec: "launchers",
            dmg: 0,
            stun: false,
            dmgDef: "grenade",
            attackRating: [4, 11, 7, 1, 0],
            modes: { BF: false, FA: false, SA: false, SS: true },
            count: 1,
        },
    },
    raiden_shotgun: {
        name: "Yamaha Raiden Underbarrel Shotgun",
        hint: "Firearms, shotguns. Damage 4P. This adds the shotgun, then opens its fire modes.",
        system: {
            genesisID: "raiden_shotgun",
            description: "<p>Second weapon for the Yamaha Raiden. The rifle's fire-mode list cannot fire this shotgun.</p>",
            type: "WEAPON_FIREARMS",
            subtype: "SHOTGUNS",
            skill: "firearms",
            skillSpec: "shotguns",
            dmg: 4,
            stun: false,
            dmgDef: "4P",
            attackRating: [7, 9, 8, 0, 0],
            modes: { BF: false, FA: false, SA: true, SS: true },
            count: 1,
        },
    },
};

const PARENT_EMBEDS = {
    ares_alpha: ["alpha_launcher"],
    yamaha_raiden: ["raiden_shotgun", "raiden_launcher"],
};

const EQUIPPED = /underbarrel (?:grenade )?launcher|underbarrel shotgun|masterkey|integrated underbarrel/i;

export function secondWeaponPlans(item) {
    const ids = new Set();
    const mods = item?.system?.modifier;
    if (Array.isArray(mods)) {
        for (const mod of mods) {
            if (mod?.type !== "EMBED") continue;
            if (!/UNDER/i.test(String(mod.intoRef || ""))) continue;
            if (CATALOG[mod.ref]) ids.add(mod.ref);
        }
    }
    for (const id of PARENT_EMBEDS[item?.system?.genesisID] || []) ids.add(id);
    if (ids.size) {
        return [...ids].map((id) => ({
            id,
            name: CATALOG[id].name,
            hint: CATALOG[id].hint,
            genesisID: CATALOG[id].system.genesisID,
        }));
    }
    if (!equippedSecondBarrel(item)) return [];
    return [{
        id: "generic_launcher",
        name: "Underbarrel grenade launcher",
        hint: "This weapon mentions a launcher, and no named one is stored on it. The new item can roll. Its Attack Rating starts blank.",
        genesisID: genericGenesis(item),
    }];
}

export function findByGenesis(actor, genesisID) {
    if (!actor || !genesisID) return null;
    return actor.items?.find?.((entry) => entry.system?.genesisID === genesisID) ?? null;
}

export function buildProvision(provisionId, parent) {
    if (provisionId === "thrown") return thrownWeaponData(parent);
    if (provisionId === "generic_launcher") return genericLauncherData(parent);
    const spec = CATALOG[provisionId];
    if (!spec) return null;
    return {
        name: spec.name,
        type: "gear",
        img: "icons/svg/item-bag.svg",
        system: { ...spec.system, modes: { ...spec.system.modes }, attackRating: [...spec.system.attackRating] },
    };
}

function equippedSecondBarrel(item) {
    if (!item) return false;
    const blob = [
        item.name,
        item.system?.accessories,
        item.system?.notes,
        strip(item.system?.description),
    ].filter(Boolean).join(" ");
    return EQUIPPED.test(blob);
}

function genericGenesis(item) {
    const slug = item?.system?.genesisID || item?.id || "weapon";
    return `underbarrel_${slug}`;
}

function genericLauncherData(parent) {
    const parentName = parent?.name || "weapon";
    return {
        name: `${parentName} grenade launcher`,
        type: "gear",
        img: "icons/svg/item-bag.svg",
        system: {
            genesisID: genericGenesis(parent),
            description: `<p>Second weapon for ${escapeHtml(parentName)}. Attack Rating is blank until you fill the five range boxes. Damage is the grenade, and the blast is still applied by hand.</p>`,
            type: "WEAPON_SPECIAL",
            subtype: "LAUNCHERS",
            skill: "exotic_weapons",
            skillSpec: "launchers",
            dmg: 0,
            stun: false,
            dmgDef: "grenade",
            attackRating: [0, 0, 0, 0, 0],
            modes: { BF: false, FA: false, SA: false, SS: true },
            count: 1,
            notes: `Added from ${parentName} because Eden cannot fire an underbarrel from the parent weapon.`,
        },
    };
}

export function thrownWeaponData(ammo) {
    if (!ammo) return null;
    const genesisID = `${ammo.system?.genesisID || slug(ammo.name) || ammo.id || "grenade"}_thrown`;
    return {
        name: ammo.name,
        type: "gear",
        img: ammo.img || "icons/svg/item-bag.svg",
        system: {
            genesisID,
            description: "<p>Thrown copy of the ammunition item so the sheet can open an Athletics attack. Blast, gas, and scatter are still applied by hand.</p>",
            type: "WEAPON_RANGED",
            subtype: "THROWING",
            skill: "athletics",
            skillSpec: "throwing",
            dmg: Number(ammo.system?.dmg) || 0,
            stun: Boolean(ammo.system?.stun),
            dmgDef: ammo.system?.dmgDef || "",
            attackRating: [0, 0, 0, 0, 0],
            modes: { BF: false, FA: false, SA: false, SS: false },
            count: 1,
            notes: "Attack Rating is blank. Set the five range boxes from the grenade line if you want the dialog to compare them.",
        },
    };
}

function slug(value) {
    return String(value || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

function strip(value) {
    return String(value || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (char) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
    }[char]));
}
