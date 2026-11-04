import { classifyGear, enabledFireModes } from "./classify.js";

/** Pack names from the shadowrun-data module manifest. */
export const PACKS = {
    weapons: "shadowrun-data.weapons-core-berlin-companion",
    ammunition: "shadowrun-data.ammunition-core-berlin-companion",
    spells: "shadowrun-data.spells-core-berlin-companion",
    rituals: "shadowrun-data.rituals-core-berlin-companion",
    adept: "shadowrun-data.adept-powers-core-berlin-companion",
    forms: "shadowrun-data.complexforms-core-berlin-companion",
    foci: "shadowrun-data.foci-core-berlin-companion",
    weaponMods: "shadowrun-data.weapon-mods-core-berlin-companion",
    drones: "shadowrun-data.drones-core-berlin-companion",
    gear: "shadowrun-data.gear-core-berlin-companion",
};

const INDEX_FIELDS = [
    "system.type",
    "system.subtype",
    "system.skill",
    "system.category",
    "system.combatSpellType",
    "system.range",
    "system.drain",
    "system.dmg",
    "system.activation",
    "system.fading",
    "system.cost",
];

const PACK_LABELS = {
    weapons: "Weapons",
    ammunition: "Ammunition",
    spells: "Spells",
    rituals: "Rituals",
    adept: "Adept powers",
    forms: "Complex forms",
    foci: "Foci",
    weaponMods: "Weapon mods",
    drones: "Drones",
    gear: "Gear",
};

export function packLabel(packKey) {
    return PACK_LABELS[packKey] || packKey;
}

export function collectionFor(packKey) {
    const id = PACKS[packKey];
    if (!id || typeof game === "undefined") return null;
    return game.packs?.get(id) ?? null;
}

export async function openPack(packKey) {
    const collection = collectionFor(packKey);
    if (!collection) {
        ui.notifications.warn("Enable the Shadowrun Compendiums module (shadowrun-data) to open that pack.");
        return null;
    }
    const open = collection.apps?.find?.((app) => app.rendered);
    if (open) return open.render({ force: true });
    const Application = collection.applicationClass
        ?? foundry.applications?.sidebar?.apps?.Compendium;
    if (!Application) {
        ui.notifications.warn("This Foundry build has no compendium window to open.");
        return null;
    }
    const app = new Application({ collection });
    return app.render({ force: true });
}

/**
 * @param {string} packKey
 * @param {{ query?: string, kind?: string, limit?: number }} [filter]
 */
export async function searchPack(packKey, filter = {}) {
    const collection = collectionFor(packKey);
    if (!collection) return { missing: true, entries: [] };
    const query = (filter.query || "").trim().toLowerCase();
    if (query.length < 2) return { missing: false, entries: [], short: true };

    const index = await collection.getIndex({ fields: INDEX_FIELDS });
    const entries = [];
    for (const entry of index) {
        const system = systemFromIndex(entry);
        const item = { type: entry.type, system };
        if (!matchesKind(packKey, item, filter.kind)) continue;
        if (!entry.name?.toLowerCase().includes(query)) continue;
        entries.push({
            id: entry._id,
            name: entry.name,
            type: entry.type,
            hint: indexHint(packKey, item),
        });
    }
    entries.sort((a, b) => a.name.localeCompare(b.name));
    const limit = filter.limit ?? 15;
    return { missing: false, entries: entries.slice(0, limit), short: false };
}

export async function importFromCompendium(actor, packKey, documentId) {
    const collection = collectionFor(packKey);
    if (!collection) {
        ui.notifications.warn("Enable the Shadowrun Compendiums module (shadowrun-data) before adding an item.");
        return null;
    }
    if (!actor?.isOwner) {
        ui.notifications.warn("Only an owner of this actor can add a compendium item to the sheet.");
        return null;
    }
    const document = await collection.getDocument(documentId);
    if (!document) {
        ui.notifications.warn("That compendium entry could not be loaded.");
        return null;
    }
    const data = document.constructor.fromCompendium(document.toObject(), {
        clearFolder: true,
        clearSort: true,
        clearOwnership: true,
    });
    const [created] = await actor.createEmbeddedDocuments("Item", [data]);
    ui.notifications.info(`${created.name} was added to ${actor.name}.`);
    return created;
}

/** Where the wizard should go after a compendium item lands on the sheet. */
export function destinationForItem(item) {
    const patch = { itemId: item.id };
    if (item.type === "spell") return { pageId: "spell-confirm", patch: { ...patch, kind: "spell" } };
    if (item.type === "ritual") return { pageId: "spell-confirm", patch: { ...patch, kind: "ritual" } };
    if (item.type === "adeptpower") return { pageId: "adept-detail", patch };
    if (item.type === "complexform") return { pageId: "matrix-confirm", patch: { ...patch, kind: "form" } };
    if (item.type === "focus") return { pageId: "topic", patch: { ...patch, topic: "focus" } };
    if (String(item.system?.type || "").includes("DRONE")) {
        return { pageId: "topic", patch: { ...patch, topic: "command-drone" } };
    }

    const kind = classifyGear(item);
    if (kind === "ordnance") return { pageId: "topic", patch: { ...patch, topic: "grenade-ordnance", kind } };
    const modes = enabledFireModes(item.system);
    const ranged = kind === "firearm" || kind === "thrown" || kind === "special" || kind === "gunnery";
    if (ranged && modes.length) return { pageId: "fire-mode", patch: { ...patch, kind } };
    if (kind) return { pageId: "attack-confirm", patch: { ...patch, kind } };
    return { pageId: "home", patch };
}

function systemFromIndex(entry) {
    if (entry.system && typeof entry.system === "object") return entry.system;
    const holder = {};
    for (const [key, value] of Object.entries(entry)) {
        if (key.startsWith("system.")) foundry.utils.setProperty(holder, key, value);
    }
    return holder.system ?? {};
}

function matchesKind(packKey, item, kind) {
    if (!kind || kind === "any") return true;
    if (packKey === "spells") {
        const category = item.system?.category;
        if (kind === "combat") return category === "combat";
        if (kind === "other") return category && category !== "combat";
    }
    if (packKey === "weapons" || packKey === "ammunition") return classifyGear(item) === kind;
    return true;
}

function indexHint(packKey, item) {
    const system = item.system ?? {};
    if (packKey === "spells") {
        const drain = system.drain != null ? `Drain ${system.drain}` : "Spell";
        return system.category ? `${drain}. ${system.category}.` : drain;
    }
    if (item.type === "gear") {
        const skill = system.skill ? system.skill.replaceAll("_", " ") : (system.subtype || system.type || "Gear");
        const dv = system.dmg != null ? `DV ${system.dmg}` : "";
        return [skill, dv].filter(Boolean).join(" · ");
    }
    if (item.type === "adeptpower" && system.cost) return `Cost ${system.cost}.`;
    if (item.type === "complexform" && system.fading != null) return `Fading ${system.fading}.`;
    return "";
}
