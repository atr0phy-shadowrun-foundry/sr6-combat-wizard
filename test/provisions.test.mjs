import assert from "node:assert/strict";
import { buildProvision, findByGenesis, secondWeaponPlans } from "../scripts/provisions.js";

const alpha = {
    name: "Ares Alpha",
    type: "gear",
    system: {
        genesisID: "ares_alpha",
        description: "<p>The integrated underbarrel grenade launcher makes this weapon something special.</p>",
        modifier: [
            { type: "EMBED", ref: "smartgun_system", intoRef: "INTERNAL" },
            { type: "EMBED", ref: "alpha_launcher", intoType: "HOOK", intoRef: "UNDER_WEAPON_MOUNT" },
        ],
    },
};

const plans = secondWeaponPlans(alpha);
assert.deepEqual(plans.map((plan) => plan.id), ["alpha_launcher"]);

const colt = {
    name: "Colt M23",
    type: "gear",
    system: {
        genesisID: "colt_m23",
        description: "<p>The M23 can accommodate two additional underbarrel accessories.</p>",
        accessories: "",
    },
};
assert.equal(secondWeaponPlans(colt).length, 0);

const raiden = {
    name: "Yamaha Raiden",
    type: "gear",
    system: { genesisID: "yamaha_raiden", modifier: 0, description: "" },
};
assert.deepEqual(
    secondWeaponPlans(raiden).map((plan) => plan.id),
    ["raiden_shotgun", "raiden_launcher"],
);

const named = {
    name: "Custom carbine",
    id: "abc",
    type: "gear",
    system: { accessories: "Masterkey underbarrel shotgun", description: "" },
};
assert.equal(secondWeaponPlans(named)[0].id, "generic_launcher");
assert.equal(secondWeaponPlans(named)[0].genesisID, "underbarrel_abc");

const actor = {
    items: {
        find(fn) {
            return [
                { id: "existing", system: { genesisID: "alpha_launcher" } },
            ].find(fn);
        },
    },
};
assert.equal(findByGenesis(actor, "alpha_launcher").id, "existing");
assert.equal(findByGenesis(actor, "missing"), null);

const built = buildProvision("alpha_launcher");
assert.equal(built.type, "gear");
assert.equal(built.system.skill, "exotic_weapons");
assert.equal(built.system.modes.SS, true);
assert.deepEqual(built.system.attackRating, [4, 10, 6, 2, 0]);

const thrown = buildProvision("thrown", {
    name: "Fragmentation Grenade",
    img: "icons/svg/item-bag.svg",
    system: { genesisID: "fragmentation_grenade", type: "AMMUNITION", subtype: "GRENADES", dmg: 0 },
});
assert.equal(thrown.system.genesisID, "fragmentation_grenade_thrown");
assert.equal(thrown.system.skill, "athletics");
assert.equal(thrown.system.type, "WEAPON_RANGED");

console.log("provision tests passed");
