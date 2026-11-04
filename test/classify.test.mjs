import assert from "node:assert/strict";
import {
    actionAllotment,
    classifyGear,
    enabledFireModes,
    sumInitiativeDice,
} from "../scripts/classify.js";

const gear = (system) => ({ type: "gear", system });

assert.equal(classifyGear(gear({ type: "WEAPON_FIREARMS", skill: "firearms" })), "firearm");
assert.equal(classifyGear(gear({ type: "WEAPON_FIREARMS", skill: "engineering" })), "gunnery");
assert.equal(classifyGear(gear({ type: "WEAPON_CLOSE_COMBAT", skill: "close_combat", subtype: "BLADES" })), "melee");
assert.equal(classifyGear(gear({ type: "CYBERWARE", subtype: "CYBER_IMPLANT_WEAPON", skill: "close_combat" })), "melee");
assert.equal(classifyGear(gear({ type: "CYBERWARE", subtype: "CYBER_LIMBS" })), "limb");
assert.equal(classifyGear(gear({ type: "AMMUNITION", subtype: "GRENADES" })), "ordnance");
assert.equal(classifyGear(gear({ type: "WEAPON_RANGED", skill: "athletics", subtype: "THROWING" })), "thrown");
assert.equal(classifyGear(gear({ type: "WEAPON_SPECIAL", skill: "exotic_weapons" })), "special");
assert.equal(classifyGear({ type: "spell", system: {} }), null);

assert.deepEqual(
    { major: actionAllotment(1).major, minor: actionAllotment(1).minor, sixth: actionAllotment(1).companionSixth },
    { major: 1, minor: 2, sixth: false },
);
assert.equal(actionAllotment(4).minor, 5);
assert.equal(actionAllotment(5).minor, 5);
assert.equal(actionAllotment(5).companionSixth, true);
assert.equal(actionAllotment(null).dice, 1);

assert.equal(sumInitiativeDice({ dice: 2, diceMod: 1 }), 3);
assert.equal(sumInitiativeDice(null), null);
assert.deepEqual(enabledFireModes({ modes: { SS: true, SA: false, BF: true, FA: 0 } }), ["SS", "BF"]);

console.log("classify tests passed");
