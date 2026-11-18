const POOLS = {
    avoid: {
        actionText: "Avoid Incoming",
        checkText: "Reaction + Athletics",
        pool(actor) {
            return actor._getSkillPool("athletics", undefined, "rea");
        },
    },
};

export async function openPrintedPage(bookId, printedPage) {
    const system = "shadowrun6-eden";
    let uuid = "";
    try {
        uuid = game.settings.get(system, `pdf-${bookId}-journalUuid`);
    } catch {
        uuid = "";
    }
    if (!uuid) {
        ui.notifications.warn(`Link the ${bookId} PDF in the Shadowrun 6 system settings. Printed page ${printedPage}.`);
        return;
    }
    let offset = 0;
    try {
        offset = Number(game.settings.get(system, `pdf-${bookId}-offset`)) || 0;
    } catch {
        offset = 0;
    }
    // Cover is file page 1. Printed page N is file page N+1, shifted by the book's offset.
    const viewerPage = Math.max(1, Number(printedPage) + 1 - offset);
    return game.sr6.utils.openPdfPage(uuid, viewerPage);
}

export async function runLaunch(actor, launch, data) {
    if (!actor) {
        ui.notifications.warn("Select your token first.");
        return;
    }
    try {
        switch (launch.type) {
            case "weapon":
                return await launchWeapon(actor, data);
            case "spell":
                return await launchSpell(actor, data.itemId, false);
            case "ritual":
                return await launchSpell(actor, data.itemId, true);
            case "skill":
                return await launchSkill(actor, launch.skill ?? data.skill, launch.spec ?? data.spec);
            case "matrix":
                return await launchMatrix(actor, data.matrixId);
            case "complexform":
                return await launchComplexForm(actor, data.itemId);
            case "pool":
                return await launchPool(actor, launch.pool ?? data.pool);
            default:
                ui.notifications.warn("This page has no roll to open.");
        }
    } catch (error) {
        console.error("sr6-turn-wizard | launch failed", error);
        ui.notifications.error(error?.message || "The Eden roll did not open. See the console.");
    }
}

async function launchWeapon(actor, data) {
    const item = actor.items.get(data.itemId);
    if (!item) throw new Error("That weapon is no longer on the sheet.");
    if (!item.system?.skill) throw new Error(`${item.name} has no skill set. Open the item and set one before attacking.`);
    armWeaponDialog(data);
    const roll = new game.sr6.rollTypes.WeaponRoll(actor, item);
    if (data.fireMode) roll.fireMode = data.fireMode;
    if (data.burst && data.burst !== "none") roll.burstMode = data.burst;
    if (data.faArea && data.faArea !== "none") roll.faArea = Number(data.faArea);
    return actor.rollItem(roll);
}

function armWeaponDialog(data) {
    const burst = data.burst && data.burst !== "none" ? data.burst : "";
    const faArea = data.faArea && data.faArea !== "none" ? data.faArea : "";
    if (!burst && !faArea) return;
    Hooks.once("renderRollDialog", () => {
        const started = Date.now();
        const tick = () => {
            const mode = document.getElementById("fireMode");
            if (!mode) {
                if (Date.now() - started < 2000) setTimeout(tick, 50);
                return;
            }
            const burstEl = document.getElementById("bfType");
            const areaEl = document.getElementById("fullAutoArea");
            if (burst && burstEl && burstEl.offsetParent !== null) {
                burstEl.value = burst;
                burstEl.dispatchEvent(new Event("change", { bubbles: true }));
                return;
            }
            if (faArea && areaEl && areaEl.offsetParent !== null) {
                areaEl.value = String(faArea);
                areaEl.dispatchEvent(new Event("change", { bubbles: true }));
                return;
            }
            if (Date.now() - started < 2000) setTimeout(tick, 50);
        };
        setTimeout(tick, 0);
    });
}

async function launchSpell(actor, itemId, ritual) {
    const item = actor.items.get(itemId);
    if (!item) throw new Error("That spell is no longer on the sheet.");
    const { SpellRoll, RitualRoll } = game.sr6.rollTypes;
    const roll = ritual
        ? new RitualRoll(actor.system, item, item.id, item.system)
        : new SpellRoll(actor.system, item, item.id, item.system);
    if (!ritual) roll.skillSpec = "spellcasting";
    return actor.rollSpell(roll, ritual);
}

async function launchSkill(actor, skillId, spec) {
    if (!skillId) throw new Error("No skill was chosen.");
    const roll = new game.sr6.rollTypes.SkillRoll(actor.system, skillId);
    if (spec && spec !== "none") roll.skillSpec = spec;
    return actor.rollSkill(roll);
}

export function lacksMatrixDevice(actor) {
    if (!actor || actor.isTechno) return false;
    if (actor.system instanceof foundry.abstract.DataModel) return false;
    return !actor.system?.persona?.accessDevice;
}

async function launchMatrix(actor, matrixId) {
    const source = CONFIG.SR6.MATRIX_ACTIONS?.[matrixId];
    if (!source) throw new Error("That matrix action is not in the system config.");
    if (lacksMatrixDevice(actor)) {
        throw new Error(`${actor.name} has no matrix device in use. On the sheet's Matrix tab, switch a commlink, cyberdeck, or similar device online and tick it to access the Matrix.`);
    }
    const action = { ...source, id: source.id || matrixId };
    const targeted = [...game.user.targets];
    const target = targeted.length === 1 ? targeted[0].actor : null;
    const options = target ? { target } : { fromReferenceSection: true };
    const roll = new game.sr6.rollTypes.MatrixActionRoll(actor, action, options);
    if (action.onMatrixActionRoll) await action.onMatrixActionRoll(roll);
    if (!action.skill) return roll.toChat();
    return actor.performMatrixAction(roll);
}

async function launchComplexForm(actor, itemId) {
    const item = actor.items.get(itemId);
    if (!item) throw new Error("That complex form is no longer on the sheet.");
    const roll = new game.sr6.rollTypes.ComplexFormRoll(actor.system, item, item.id, item.system);
    return actor.rollResonanceAbility(roll);
}

async function launchPool(actor, poolId) {
    const recipe = POOLS[poolId];
    if (!recipe) throw new Error("No pool is set up for this roll.");
    const pool = Number(recipe.pool(actor));
    if (!Number.isFinite(pool)) throw new Error("The sheet could not build that pool.");
    const roll = new game.sr6.rollTypes.PreparedRoll();
    roll.rollType = game.sr6.rollTypes.RollType.Common;
    roll.pool = pool;
    roll.actionText = recipe.actionText;
    roll.checkText = recipe.checkText;
    roll.allowBuyHits = true;
    return actor.rollCommonCheck(roll);
}

export async function refillWeapon(actor, itemId) {
    const item = actor.items.get(itemId);
    if (!item) throw new Error("That weapon is no longer on the sheet.");
    const cap = Number(item.system?.ammocap) || 0;
    if (cap <= 0) {
        ui.notifications.warn(`${item.name} has no ammo capacity. Say the reload in chat and mark the action.`);
        return false;
    }
    await item.update({ "system.ammocount": cap });
    ui.notifications.info(`${item.name} is loaded to ${cap}.`);
    return true;
}

export async function toggleStatus(actor, statusId) {
    if (typeof actor.toggleStatusEffect !== "function") {
        ui.notifications.warn("This actor cannot toggle token statuses.");
        return;
    }
    await actor.toggleStatusEffect(statusId);
}
