import { actionAllotment, classifyGear, enabledFireModes, sumInitiativeDice } from "./classify.js";
import { packLabel, searchPack } from "./compendiums.js";
import { EDGE_ACTIONS, EDGE_BOOSTS, TOPICS } from "./topics.js";
import { readTally } from "./tally.js";

const CLEAR = "itemId,fireMode,burst,faArea,topic,skill,spec,matrixId,pool,kind";

const FIRE_MODE_COPY = {
    SS: {
        label: "Single shot",
        hint: "1 round. Attack Rating unchanged. Damage unchanged.",
    },
    SA: {
        label: "Semi-automatic",
        hint: "2 rounds. Attack Rating −2. Damage +1. This is the double tap.",
    },
    BF: {
        label: "Burst, narrow",
        hint: "4 rounds into one target. Attack Rating −4. Damage +2.",
        fireMode: "BF",
        burst: "narrow_burst",
    },
    wide: {
        label: "Burst, wide",
        hint: "4 rounds across two targets. Attack Rating −2. Damage +1. Target exactly two tokens.",
        fireMode: "BF",
        burst: "wide_burst",
    },
    FA: {
        label: "Full auto",
        hint: "10 rounds. Attack Rating −6 before the radius penalty. Next page picks the radius.",
    },
};

export function defaultActor() {
    const controlled = (canvas?.tokens?.controlled ?? [])
        .map((token) => token.actor)
        .filter((actor) => actor?.isOwner);
    const unique = [...new Map(controlled.map((actor) => [actor.uuid, actor])).values()];
    if (unique.length) return unique[0];
    if (game.user.character?.isOwner) return game.user.character;
    if (game.combat?.combatant?.actor?.isOwner) return game.combat.combatant.actor;
    return null;
}

export function actorCandidates() {
    const found = new Map();
    const add = (actor) => {
        if (actor?.isOwner && !found.has(actor.uuid)) found.set(actor.uuid, actor);
    };
    for (const token of canvas?.tokens?.controlled ?? []) add(token.actor);
    add(game.user.character);
    add(game.combat?.combatant?.actor);
    return [...found.values()];
}

export async function buildPage(state) {
    const actor = resolveActor(state);
    const page = actor ? await renderPage(state, actor) : noActorPage();
    const actors = actorCandidates().map((candidate) => ({
        uuid: candidate.uuid,
        name: candidate.name,
        current: candidate.uuid === actor?.uuid,
    }));
    return {
        ...page,
        actor,
        actorName: actor?.name ?? "No character",
        actors,
        multipleActors: actors.length > 1,
        crumb: [...(state.history ?? []).map((entry) => entry.label).filter(Boolean), state.label].filter(Boolean),
        economy: actor ? economy(actor) : null,
        targets: targetNames(),
        showBack: (state.history ?? []).length > 0,
    };
}

function resolveActor(state) {
    if (state.actorUuid) {
        const fromState = fromUuidSync(state.actorUuid);
        if (fromState) return fromState;
    }
    return defaultActor();
}

function noActorPage() {
    return {
        kicker: "Combat turn",
        title: "Who is acting?",
        lead: "Select a token you own, or assign yourself a character in the player list. A gamemaster can also open the wizard on the current combatant.",
        groups: [],
        blocks: [],
    };
}

async function renderPage(state, actor) {
    const id = state.pageId;
    if (id === "compendium") return compendiumPage(state.data);
    if (id === "home") return homePage(actor);
    if (id === "attack") return attackKindPage(actor);
    if (id === "weapons") return weaponListPage(actor, state.data.kind);
    if (id === "fire-mode") return fireModePage(actor, state.data);
    if (id === "fa-area") return faAreaPage(actor, state.data);
    if (id === "attack-confirm") return attackConfirmPage(actor, state.data);
    if (id === "spells") return spellListPage(actor, state.data.kind);
    if (id === "spell-confirm") return spellConfirmPage(actor, state.data);
    if (id === "defend") return defendPage();
    if (id === "magic") return magicPage(actor);
    if (id === "adept") return adeptPage(actor);
    if (id === "adept-detail") return adeptDetailPage(actor, state.data);
    if (id === "edge") return edgePage();
    if (id === "edge-boost") return edgeBoostPage(state.data.topic);
    if (id === "edge-action") return edgeActionPage(state.data.topic);
    if (id === "position") return positionPage();
    if (id === "reload") return reloadPage(actor);
    if (id === "reload-how") return reloadHowPage(actor, state.data);
    if (id === "matrix") return matrixPage(actor);
    if (id === "matrix-confirm") return matrixConfirmPage(actor, state.data);
    if (id === "forms") return formsPage(actor);
    if (id === "other") return otherPage(actor);
    if (id === "skills") return skillsPage(actor);
    if (id === "skill-confirm") return skillConfirmPage(actor, state.data);
    if (id === "topic") return topicPage(state.data.topic, actor);
    return {
        title: "Missing page",
        lead: "That step is not in the wizard. Go back to the start.",
        groups: [],
        blocks: [],
    };
}

function homePage(actor) {
    return {
        kicker: "Combat turn",
        title: "What are you doing?",
        lead: `${actor.name} is the character on this page. Target a token before an attack or a spell. The tally is a reminder for this turn. The sheet does not spend actions.`,
        groups: [{
            choices: [
                choice("Attack", "A weapon, a fist, a thrown weapon, a grenade.", { go: "attack", clear: CLEAR, badge: "Major" }),
                choice("Cast a spell", "Combat spells and everything else on the spell list.", { go: "spells", kind: "any", clear: CLEAR, badge: "Major" }),
                choice("Defend or get clear", "Dodge, Block, Full Defense, Hit the Dirt, a blast.", { go: "defend", clear: CLEAR }),
                choice("Move, aim, cover, reload", "The minor and major actions that set up the attack.", { go: "position", clear: CLEAR }),
                choice("Spend Edge", "Boosts and Edge actions, including the ones the dialog leaves out.", { go: "edge", clear: CLEAR }),
                choice("Other magic", "Adept powers, spirits, a focus, astral perception.", { go: "magic", clear: CLEAR }),
                choice("Matrix, a complex form, or a drone", "Matrix actions from the system list, plus forms on the sheet.", { go: "matrix", clear: CLEAR }),
                choice("Something else", "A skill, teamwork, first aid, a grapple, an off-hand penalty.", { go: "other", clear: CLEAR }),
            ],
        }],
        blocks: [
            block("rules", "How a round is built", [
                "Everyone acts once. You start with 1 major action and 1 minor action, plus 1 extra minor for each initiative die, and you do not start with more than 5 minor actions.",
                "A major action may be spent as a minor. Four minor actions may be spent as one major. Unused actions do not carry into the next round.",
                "Minor actions are usually automatic. An attack, a spell, and most other majors roll.",
            ], core(40)),
        ],
        footnote: "Token controls have a route icon for this window. The world macro is Combat Turn Wizard. The default key is Shift+Alt+T, and Configure Controls can change it.",
    };
}

function defendPage() {
    return {
        kicker: "Defense",
        title: "Defend or get clear",
        lead: "These can be taken when it is not your turn, as long as you still have the action. The real Defense roll is the button on the attack card. This page tells you what to type into it.",
        groups: [{
            choices: [
                topicChoice("Dodge", "Minor. Add Athletics to one Defense test.", "dodge"),
                topicChoice("Block", "Minor. Add Close Combat to one melee Defense test.", "block"),
                topicChoice("Full Defense", "Major. Add Willpower to every Defense test this round.", "full-defense"),
                topicChoice("Hit the Dirt", "Minor. Prone, +2 Defense, then −2 on your tests.", "hit-the-dirt"),
                topicChoice("Avoid Incoming", "Minor. Leave a blast or a gas cloud.", "avoid"),
                topicChoice("Intercept", "Minor plus the attack. Someone entered Close.", "intercept"),
            ],
        }],
        blocks: [
            block("rules", "Soak is the next card", [
                "After a hit, the defender rolls Body unless the damage says otherwise. Each hit cancels one point. The soak button is on the attack card, and Edge can still be spent there if this action has not spent Edge yet.",
            ], core(106)),
        ],
    };
}

function attackKindPage(actor) {
    const counts = countKinds(actor);
    return {
        kicker: "Attack · major · your turn",
        title: "How are you attacking?",
        lead: "One attack is one major action. Called shots, multiple attacks, and aim are minors that ride along with it. You will get those on the last page.",
        groups: [{
            choices: [
                weaponChoice("Melee", "Close combat, unarmed, a cyber weapon.", "melee", counts),
                weaponChoice("Firearm", "A gun on the sheet. The next page is the fire mode.", "firearm", counts),
                weaponChoice("Thrown or a bow", "Athletics weapons, including a grenade that was entered as a thrown weapon.", "thrown", counts),
                weaponChoice("Grenade, rocket, or explosive", "Ammunition items. These do not open an attack roll.", "ordnance", counts),
                weaponChoice("Launcher, spray, or exotic", "Special weapons and Exotic Weapons.", "special", counts),
                weaponChoice("Gunnery", "A vehicle-mounted weapon, Engineering + Logic.", "gunnery", counts),
            ],
        }],
        blocks: [
            block("rules", "The five steps, in order", attackSteps(false), core(104)),
        ],
    };
}

function weaponListPage(actor, kind) {
    const titles = {
        melee: ["Melee", "Punch, a blade, a club, an implant weapon."],
        firearm: ["Firearm", "Every firearm on the sheet. Eden has no in-hand flag, so a stowed gun is in this list too."],
        thrown: ["Thrown or bow", "The attack roll uses the skill stored on the item, usually Athletics."],
        ordnance: ["Grenades and explosives", "These are ammunition, not weapons. The sheet will not throw them."],
        special: ["Special weapons", "Launchers, sprays, and other Exotic Weapons."],
        gunnery: ["Gunnery", "Engineering + Logic for a vehicle-mounted weapon."],
    };
    const [title, lead] = titles[kind] ?? ["Weapons", ""];
    const items = itemsOfKind(actor, kind);
    const limbs = kind === "melee" ? itemsOfKind(actor, "limb") : [];
    const choices = items.map((item) => {
        if (kind === "ordnance") {
            return choice(item.name, "Ammunition. Open the grenade page.", {
                go: "topic",
                topic: "grenade-ordnance",
                itemId: item.id,
                badge: "Gap",
            });
        }
        const modes = enabledFireModes(item.system);
        const ranged = kind === "firearm" || kind === "thrown" || kind === "special" || kind === "gunnery";
        return choice(item.name, weaponHint(item), {
            go: ranged && modes.length ? "fire-mode" : "attack-confirm",
            itemId: item.id,
            kind,
            badge: modes.length ? modes.join(" ") : (item.system.skill ? "" : "No skill"),
        });
    });
    const blocks = [];
    if (kind === "melee" && limbs.length) {
        blocks.push(block("gap", "Cyberlimbs on the sheet", [
            `${limbs.map((item) => item.name).join(", ")} ${limbs.length === 1 ? "is a limb" : "are limbs"}, not a weapon.`,
            "A punch uses the Unarmed close-combat item. Eden adds the sheet's Strength to that item's Close attack rating. A limb with its own Strength does not replace the sheet Strength unless the character's Strength is already the augmented value.",
        ]));
    }
    if (!choices.length) {
        blocks.push(block("gap", "Nothing in this group on the sheet", [
            "Search the shadowrun-data compendium below and add the item to the sheet. Implant weapons use the cyberware or bioware implant-weapon subtype and still need a skill.",
        ]));
    }
    const lookupPack = kind === "ordnance" ? "ammunition" : "weapons";
    choices.push(compendiumChoice(
        `Look up a ${kind === "ordnance" ? "grenade" : "weapon"}`,
        `${packLabel(lookupPack)} compendium in shadowrun-data.`,
        lookupPack,
        kind,
    ));
    if (kind === "ordnance") {
        blocks.unshift(block("rules", "Throwing it", [
            "A thrown grenade is an Athletics attack, then blast, gas, or scatter. Blast and gas are on printed pp. 114–117.",
            "If the grenade exists only as ammunition, roll Athletics from Something Else and apply the blast by hand. A grenade entered as a thrown weapon is in the Thrown list and can open an attack roll.",
        ], core(114)));
    }
    return {
        kicker: "Attack",
        title,
        lead,
        groups: choices.length ? [{ choices }] : [],
        blocks,
    };
}

function fireModePage(actor, data) {
    const item = actor.items.get(data.itemId);
    if (!item) return missingItem();
    const available = new Set(enabledFireModes(item.system));
    const choices = [];
    if (available.has("SS")) choices.push(modeChoice("SS", item.id));
    if (available.has("SA")) choices.push(modeChoice("SA", item.id));
    if (available.has("BF")) {
        choices.push(modeChoice("BF", item.id));
        choices.push(modeChoice("wide", item.id));
    }
    if (available.has("FA")) choices.push(modeChoice("FA", item.id));
    const blocks = [
        block("rules", "What the dialog will apply", [
            "Single shot is 1 round and does not change Attack Rating or damage.",
            "Semi-automatic in this dialog is 2 rounds, Attack Rating −2, damage +1. A one-bullet shot from a gun that only has SA still uses that row. There is no separate single-round SA choice.",
            "Narrow burst is 4 rounds, Attack Rating −4, damage +2. Wide burst is 4 rounds, Attack Rating −2, damage +1, and Eden accepts it only when exactly two tokens are targeted.",
            "Full auto is 10 rounds and Attack Rating −6, then another −2 Attack Rating per meter of radius after the first. The dialog does not add damage for full auto.",
            "High Strength Reduces Recoil, when that world setting is on, can shrink a two-handed gun's Attack Rating penalty. The weapon needs its two-handed flag.",
        ], core(108)),
    ];
    const accessoryNote = underbarrelNote(item);
    if (accessoryNote) blocks.push(block("gap", "Second barrel", [accessoryNote]));
    if (!choices.length) {
        blocks.push(block("gap", "No fire modes on the item", [
            "The SS, SA, BF, and FA boxes are all off. The attack dialog will not show a fire-mode selector. Turn on the modes this weapon has, or continue and treat it as a single attack.",
        ]));
        choices.push(choice("Continue without a fire mode", "The roll opens with whatever the item has.", {
            go: "attack-confirm",
            itemId: item.id,
        }));
    }
    return {
        kicker: item.name,
        title: "Which fire mode?",
        lead: "Eden reads the mode boxes on the weapon. The attack dialog starts on the mode you pick here.",
        groups: [
            { choices },
            {
                heading: "Compendium",
                choices: [compendiumChoice("Look up a weapon mod", "Smartgun, underbarrel, and other mods in shadowrun-data.", "weaponMods", "any")],
            },
        ],
        blocks,
    };
}

function faAreaPage(actor, data) {
    const item = actor.items.get(data.itemId);
    return {
        kicker: item?.name ?? "Full auto",
        title: "How wide is the full-auto burst?",
        lead: "Ten rounds. Each meter past a 1-meter radius is another −2 Attack Rating. Three or more targets require full auto.",
        groups: [{
            choices: [1, 2, 3, 4, 5, 6].map((meters) => choice(
                `${meters}m radius`,
                meters === 1 ? "The base full-auto penalty only." : `Attack Rating −${6 + (meters - 1) * 2}.`,
                { go: "attack-confirm", itemId: data.itemId, fireMode: "FA", faArea: String(meters) },
            )),
        }],
        blocks: [
            block("rules", "Targets", [
                "Full auto is how one attack reaches an area. Everyone in the area defends. Eden compares Edge using the highest Defense Rating among your targets.",
            ], core(108)),
        ],
    };
}

function attackConfirmPage(actor, data) {
    const item = actor.items.get(data.itemId);
    if (!item) return missingItem();
    const modeLine = describeMode(data);
    const targets = targetNames();
    const blocks = [
        block("rules", "Five steps", attackSteps(settingOn("cantDodgeBullets")), core(104)),
        block("eden", "What opens", [
            modeLine,
            targets.length
                ? `Targeted: ${targets.join(", ")}.`
                : "No token is targeted. Target one before you roll, unless this is a shot into empty space.",
            "The dialog's distance row is the range band. A melee attack uses Close. Eden adds Strength to a close-combat weapon's Close rating (Reaction for a whip, and Reaction as well on an unarmed item whose stored Close rating is 0).",
            "Ammo is the selector in the same dialog. Changing it saves onto the weapon. Eden's selector does this: APDS is Attack Rating +2 and damage −1, explosive is damage +1, flechette is Attack Rating +1 and damage −1, gel is Stun, stick-n-shock is Stun with Attack Rating +1 and damage −1.",
            settingOn("highStrengthAddsDamage")
                ? "High Strength Adds Damage is on. Close-combat damage on the dialog already includes that bonus when the weapon qualifies. Do not add it a second time."
                : "High Strength Adds Damage is off. Companion p. 150 is the optional +1 damage at Strength 7 and +2 at Strength 10.",
            settingOn("rollStrengthCombat")
                ? "Rolling Strength Instead of Agility is on. It swaps the pool only when this weapon's Strength-weapon box is checked."
                : "The attack pool is the weapon skill plus its usual attribute. Agility for close combat and firearms, Logic for gunnery.",
        ]),
        block("rules", "Minors that can ride with this attack", [
            "Take Aim is +1 die, once this round, stacking up to Willpower if you keep aiming or attacking. Type it into the modifier.",
            "Call a Shot is −4 dice and +2 damage. Type the −4. Add the +2 to the Damage Value before soak.",
            "Multiple Attacks splits the pool evenly, rounding down. Open one roll per attack and set each pool yourself.",
            "An off-hand weapon takes its penalty from printed p. 110. Type it into the modifier.",
        ], core(42)),
    ];
    const warnings = attackWarnings(data, targets);
    if (warnings.length) blocks.push(block("gap", "Before you click", warnings));
    const accessoryNote = underbarrelNote(item);
    if (accessoryNote) blocks.push(block("gap", "Second barrel", [accessoryNote]));
    blocks.push(block("eden", "Edge on this roll", [
        "One Edge spend per action, either a boost or an Edge action. The dialog's Edge list applies several boosts. Edge actions are listed there, and their special effect is still a table call. The Edge cost of an action is worth confirming on the sheet after the roll.",
        "Attack Rating versus Defense Rating: a gap of 4 or more gives 1 Edge to the higher side. Area attacks use the highest Defense Rating. Bonus Edge from the situation is still capped. The world setting max Edge per round is the cap Eden is using.",
    ]));
    if (!item.system.skill) {
        blocks.push(block("gap", "No skill on the weapon", [
            "Open the item and set the skill before this roll will start. Close Combat, Firearms, Athletics, Engineering, or Exotic Weapons.",
        ]));
    }
    return {
        kicker: item.name,
        title: `Attack with ${item.name}`,
        lead: modeLine,
        groups: [],
        blocks,
        launch: item.system.skill
            ? { type: "weapon", label: "Open the attack roll" }
            : null,
    };
}

function spellListPage(actor, kind) {
    const spells = actor.items.filter((item) => item.type === "spell");
    const rituals = actor.items.filter((item) => item.type === "ritual");
    const combat = spells.filter((item) => item.system.category === "combat");
    const rest = spells.filter((item) => item.system.category !== "combat");
    const groups = [];
    if (!kind || kind === "any" || kind === "combat") {
        groups.push({
            heading: "Combat spells",
            note: "Direct or indirect, and area or a single target, come from the spell item. You do not have to classify it again.",
            choices: combat.map(spellChoice),
        });
    }
    if (!kind || kind === "any" || kind === "other") {
        groups.push({
            heading: "Other spells",
            note: "Detection, health, illusion, manipulation. A sustained spell is still a major action to cast.",
            choices: rest.map(spellChoice),
        });
    }
    if (rituals.length) {
        groups.push({
            heading: "Rituals",
            note: "A ritual is an extended casting, not a combat-round attack. The button on the next page still opens Eden's ritual roll.",
            choices: rituals.map((item) => choice(item.name, "Ritual", {
                go: "spell-confirm",
                itemId: item.id,
                kind: "ritual",
                badge: "Ritual",
            })),
        });
    }
    const blocks = [];
    if (!spells.length && !rituals.length) {
        blocks.push(block("gap", "No spells on this sheet", [
            "Search the spells compendium below if this character should have a formula. Adept powers are under Other magic.",
        ]));
    }
    groups.push({
        heading: "Compendium",
        choices: [
            compendiumChoice("Look up a spell", "Spells compendium in shadowrun-data.", "spells", "any"),
            compendiumChoice("Look up a ritual", "Rituals compendium in shadowrun-data.", "rituals", "any"),
        ],
    });
    return {
        kicker: "Cast spell · major · your turn",
        title: "Which spell?",
        lead: "Casting is Sorcery + Magic. Adjust the spell first, up to your Magic or your Sorcery, whichever is higher.",
        groups: groups.filter((group) => group.choices.length),
        blocks,
    };
}

function spellConfirmPage(actor, data) {
    const item = actor.items.get(data.itemId);
    if (!item) return missingItem();
    if (item.type === "ritual" || data.kind === "ritual") {
        return {
            kicker: "Ritual",
            title: item.name,
            lead: "Ritual spellcasting is Sorcery with the ritual specialization. It is not one pass in a combat round.",
            blocks: [
                block("rules", "What the book asks", [
                    "A ritual has a leader, a foundation, reagents, and a seal. Failure has its own consequences. Printed pp. 143–144.",
                ], core(143)),
                edenBlock([
                    "The roll uses the ritual's threshold and a drain of at least 2, or twice the threshold, whichever Eden's ritual roll computes.",
                    "The ritual does not resolve foundation, spotters, or the seal. Finish those in chat.",
                ]),
            ],
            launch: { type: "ritual", label: "Open the ritual roll" },
        };
    }
    const system = item.system;
    const direct = system.combatSpellType === "spells_direct";
    const indirect = system.combatSpellType === "spells_indirect";
    const area = system.range === "line_of_sight_area" || system.range === "self_area";
    const combat = system.category === "combat";
    const facts = [
        `Category ${labelOf(CONFIG.SR6.spell_category, system.category) || system.category}.`,
        `Type ${labelOf(CONFIG.SR6.spell_type, system.type) || system.type}. Range ${labelOf(CONFIG.SR6.spell_range, system.range) || system.range}. Duration ${labelOf(CONFIG.SR6.spell_duration, system.duration) || system.duration}.`,
        `Drain starts at ${system.drain}.`,
    ];
    if (combat && direct) facts.push("The item says this is a direct combat spell. Eden's defense card rolls Willpower + Intuition and does not offer a soak. The spellcasting steps oppose a direct spell with Willpower. Check printed p. 131 and this spell's line if that extra Intuition looks wrong, and correct the defense pool.");
    if (combat && indirect) facts.push("The item says this is an indirect combat spell. Defense is Reaction + Willpower, then a soak. Eden's card matches that defense pool.");
    if (combat && !direct && !indirect) facts.push("This combat spell has no direct or indirect type stored. Set combat spell type on the item. Until then, Eden will not know which defense to offer.");
    if (area) facts.push("The range is an area. Increase Area starts at a 2-meter radius and adds 1 Drain per extra 2 meters. The spell dialog has that control.");
    if (combat) facts.push("Amp Up adds 1 damage and 2 Drain per point, and the spell dialog offers it for combat spells. Direct damage starts at 0 plus Amp Up. Indirect damage starts at half Magic, rounded up, plus Amp Up.");
    const blocks = [
        block("rules", "Casting order", [
            "Adjust, then the Sorcery + Magic test, then drain. Drain resistance is your tradition attribute plus Willpower. Leftover drain is Stun unless the spell says it became Physical.",
            "Shift Area, on a spell that allows it, is a minor action and does not add drain.",
        ], core(130)),
        edenBlock(facts.concat([
            system.duration === "sustained"
                ? "If you mark the spell sustained, Eden subtracts 2 dice per sustained spell or complex form from later tests. The roll dialog has a checkbox for that penalty."
                : "This duration is not sustained, so it does not add the sustained-spell penalty.",
            "Target the tokens first. The card names them.",
        ])),
    ];
    if (system.duration === "sustained") {
        blocks.push(block("gap", "Shift Area", [
            "The spell dialog adjusts Amp Up and area radius. It does not spend the Shift Area minor. Mark that minor yourself when you move an area you are already sustaining.",
        ]));
    }
    return {
        kicker: combat ? "Combat spell" : "Spell",
        title: item.name,
        lead: area ? "Area spell. One casting, everyone in the area." : "Single target, unless the spell's own text says otherwise.",
        blocks,
        launch: { type: "spell", label: "Open the spell roll" },
    };
}

function magicPage(actor) {
    const powers = actor.items.filter((item) => item.type === "adeptpower").length;
    const foci = actor.items.filter((item) => item.type === "focus");
    return {
        kicker: "Magic",
        title: "Besides a formula",
        lead: "These are the other awakened actions that show up in a fight. Several of them stop at a skill roll.",
        groups: [{
            choices: [
                choice("Adept powers", powers ? `${powers} on the sheet.` : "None on the sheet. The compendium is one step down.", { go: "adept", badge: powers ? "" : "Empty" }),
                choice("Counterspell", "Major, anytime. Sorcery versus the spell.", { go: "topic", topic: "counterspell" }),
                choice("Summon a spirit", "Major. Services are tracked at the table.", { go: "topic", topic: "summon" }),
                choice("Command a spirit", "Minor. Spends a service.", { go: "topic", topic: "command-spirit" }),
                choice("Banish a spirit", "Major. Opposed, then drain.", { go: "topic", topic: "banish" }),
                choice("Activate a focus", foci.length ? foci.map((item) => item.name).join(", ") : "No foci on the sheet.", { go: "topic", topic: "focus" }),
                compendiumChoice("Look up a focus", "Foci compendium in shadowrun-data.", "foci", "any"),
                choice("Shift perception", "Minor. Astral or physical.", { go: "topic", topic: "shift-perception" }),
                choice("Astral projection", "Major. Its own initiative.", { go: "topic", topic: "astral-projection" }),
            ],
        }],
        blocks: [],
    };
}

function adeptPage(actor) {
    const powers = actor.items.filter((item) => item.type === "adeptpower");
    return {
        kicker: "Adept",
        title: "Powers on the sheet",
        lead: "A power's activation is passive, a minor action, or a major action. The item stores that. Using it does not roll unless the power says to make a test.",
        groups: [
            {
                choices: powers.map((item) => choice(item.name, adeptHint(item), { go: "adept-detail", itemId: item.id })),
            },
            {
                heading: "Compendium",
                choices: [compendiumChoice("Look up an adept power", "Adept powers compendium in shadowrun-data.", "adept", "any")],
            },
        ].filter((group) => group.choices.length),
        blocks: [
            block("gap", "What the sheet leaves to you", [
                "Opening a power spends nothing and applies no dice. Read the power, mark the action on the tally, and type a bonus into the attack or defense that follows.",
                "If the power is an attack, it also needs a weapon item. Use the Attack path for the roll.",
            ]),
        ],
    };
}

function positionPage() {
    return {
        kicker: "Set up the turn",
        title: "Move, aim, cover, reload",
        groups: [{
            heading: "Minor, on your turn",
            choices: [
                topicChoice("Move", "10 meters, once.", "move"),
                topicChoice("Take Aim", "+1 die, stacks to Willpower.", "take-aim"),
                topicChoice("Take Cover", "Cover I–IV on the token.", "take-cover"),
                topicChoice("Drop Prone", "Prone without the dive bonus.", "drop-prone"),
                topicChoice("Stand Up", "Clear prone.", "stand-up"),
                topicChoice("Quick Draw", "A small weapon, with the attack.", "quick-draw"),
                choice("Reload a smartgun", "Minor, if the next clip is in hand.", { go: "reload", kind: "smart", badge: "Minor" }),
            ],
        }, {
            heading: "Major, on your turn",
            choices: [
                topicChoice("Sprint", "15 meters plus hits.", "sprint"),
                topicChoice("Ready Weapon", "Draw or stow.", "ready-weapon"),
                topicChoice("Pick up or put down", "The careful version of drop.", "pick-up"),
                choice("Reload a weapon", "Anything that is not a smartgun reload.", { go: "reload", kind: "plain", badge: "Major" }),
            ],
        }, {
            heading: "Anytime, if you still have the action",
            choices: [
                topicChoice("Drop Object", "Let go. Minor.", "drop-object"),
            ],
        }],
        blocks: [],
    };
}

function reloadPage(actor) {
    const weapons = actor.items.filter((item) => ["firearm", "thrown", "special", "gunnery"].includes(classifyGear(item)));
    return {
        kicker: "Reload",
        title: "Which weapon?",
        lead: "A smartgun reload is a minor when the next clip is in hand. Any other reload is a major. Eden's ammo button fills the weapon to capacity and does not know which action you spent.",
        groups: [{
            choices: weapons.map((item) => choice(
                item.name,
                `Ammo ${item.system.ammocount ?? 0} / ${item.system.ammocap ?? 0}.`,
                { go: "reload-how", itemId: item.id },
            )),
        }],
        blocks: weapons.length ? [] : [
            block("gap", "No ranged weapon", ["There is nothing on the sheet with a fire mode or a thrown-weapon type."]),
        ],
    };
}

function reloadHowPage(actor, data) {
    const item = actor.items.get(data.itemId);
    if (!item) return missingItem();
    const cap = Number(item.system.ammocap) || 0;
    return {
        kicker: item.name,
        title: "What kind of reload?",
        lead: cap
            ? `This sets ammo to ${cap}. Wireless smartgun mods can also grant a bonus minor on a turn you reload. Count that only when the mod is installed and wireless.`
            : "This weapon has no ammo capacity, so the button will not write a number. Mark the action anyway.",
        groups: [{
            choices: [
                { label: "Smartgun reload", hint: "Minor. Next clip is in hand.", action: "refill", itemId: item.id, track: "minor", badge: "Minor" },
                { label: "Ordinary reload", hint: "Major.", action: "refill", itemId: item.id, track: "major", badge: "Major" },
            ],
        }],
        blocks: [
            block("rules", "The two actions", [
                "Reload Smartgun is a minor. Reload Weapon is a major. Both are on your turn.",
            ], core(43)),
        ],
    };
}

function edgePage() {
    const boosts = Object.entries(EDGE_BOOSTS).map(([id, boost]) => choice(
        boostName(id),
        `${boost.cost} Edge. ${boost.when}.`,
        { go: "edge-boost", topic: id, badge: String(boost.cost) },
    ));
    const inDialog = [];
    const bookOnly = [];
    for (const [id, action] of Object.entries(EDGE_ACTIONS)) {
        const entry = choice(actionName(id), `${action.cost} Edge. ${action.attached}.`, {
            go: "edge-action",
            topic: id,
            badge: action.inDialog ? "In the dialog" : "Book only",
        });
        (action.inDialog ? inDialog : bookOnly).push(entry);
    }
    return {
        kicker: "Edge",
        title: "One spend on this action",
        lead: "A boost or an Edge action, not both. The same boost can be bought more than once. You cannot spend on your roll and the opponent's roll as that one expenditure. Nothing reduces an Edge action's cost to zero.",
        groups: [
            { heading: "Boosts", choices: boosts },
            { heading: "Edge actions Eden lists on the roll", choices: inDialog },
            { heading: "Edge actions you apply by hand", note: "They are legal. They are not in the dialog's Edge list.", choices: bookOnly },
            { heading: "Burning Edge", choices: [topicChoice("Burn Edge", "Smackdown, or Not Dead Yet.", "burning-edge")] },
        ],
        blocks: [
            block("rules", "When the point is gained", [
                "If Attack Rating and Defense Rating differ by 4 or more, the higher side gains 1 Edge. Gear, qualities, and the environment can do the same. Bonus Edge in a round is capped, and Eden's max-Edge-per-round setting is that cap.",
            ], core(45)),
        ],
    };
}

function edgeBoostPage(id) {
    const boost = EDGE_BOOSTS[id];
    if (!boost) return missingItem();
    return {
        kicker: `${boost.cost} Edge`,
        title: boostName(id),
        lead: boost.when,
        blocks: [
            block("rules", "Effect", [boost.text, "Declare a pre-roll boost before the dice. A post-roll boost waits until you see the faces."], core(46)),
            edenBlock([
                "On the attack, spell, or skill dialog, pick this boost in the Edge list before you roll, or use the post-roll Edge controls on the card if the boost is after the roll.",
                "Add Edge to your dice pool is one Eden does apply: the pool gains your Edge attribute and 6s explode.",
                "Healing a box and giving Edge to an ally still need the monitors and the ally's Edge edited if the card does not do it. Confirm the point left your sheet.",
            ]),
        ],
    };
}

function edgeActionPage(id) {
    const action = EDGE_ACTIONS[id];
    if (!action) return missingItem();
    return {
        kicker: `${action.cost} Edge · ${action.attached}`,
        title: actionName(id),
        lead: "An Edge action does not cost a minor or a major. It is declared before the test it attaches to.",
        blocks: [
            block("rules", "Effect", [action.text], core(47)),
            edenBlock(action.inDialog ? [
                "The roll dialog lists this action. Choosing it does not rewrite the pool, the damage, or the called-shot penalty.",
                "Apply the effect in the modifier or in chat, and confirm the Edge points were spent.",
            ] : [
                "This action is not in Eden's Edge list. Spend the points on the sheet and apply the effect in chat.",
            ]),
        ],
    };
}

function matrixPage(actor) {
    const forms = actor.items.filter((item) => item.type === "complexform");
    const actions = matrixActions();
    const major = actions.filter((action) => action.major);
    const minor = actions.filter((action) => !action.major);
    return {
        kicker: "Matrix and drones",
        title: "Where is this action happening?",
        lead: "A matrix pass is its own initiative. If the combatant is flagged astral or matrix, the tally at the top uses that initiative branch.",
        groups: [
            {
                heading: "On the sheet",
                choices: [
                    choice("Complex forms", forms.length ? `${forms.length} on the sheet.` : "None on this sheet.", { go: "forms" }),
                    compendiumChoice("Look up a complex form", "Complex forms compendium in shadowrun-data.", "forms", "any"),
                    compendiumChoice("Look up a drone", "Drones compendium in shadowrun-data. Add it, then command that actor.", "drones", "any"),
                    topicChoice("Command a drone", "Minor.", "command-drone"),
                    topicChoice("Jump in", "Major. Then use the vehicle's weapons.", "jump-in"),
                ],
            },
            { heading: "Major matrix actions", choices: major.map(matrixChoice) },
            { heading: "Minor matrix actions", choices: minor.map(matrixChoice) },
        ],
        blocks: [
            block("gap", "IC is not in this list", [
                "Host IC such as Killer and Patrol is omitted. Those are the host's actions. Open the host if you are running one.",
            ]),
        ],
    };
}

function formsPage(actor) {
    const forms = actor.items.filter((item) => item.type === "complexform");
    return {
        kicker: "Complex form · major",
        title: "Thread a form",
        lead: "Threading is a major action. Fading is the technomancer's version of drain.",
        groups: [{
            choices: forms.map((item) => choice(item.name, `Fading ${item.system.fading ?? "?"}. ${item.system.skill || "No skill"}.`, {
                go: "matrix-confirm",
                itemId: item.id,
                kind: "form",
            })),
        }],
        blocks: forms.length ? [
            edenBlock([
                "The roll uses the form's skill. Sustained forms use the same sustained penalty as spells once you mark them sustained.",
            ]),
        ] : [block("gap", "No complex forms", ["This sheet has no complex form items."])],
    };
}

function matrixConfirmPage(actor, data) {
    if (data.kind === "form") {
        const item = actor.items.get(data.itemId);
        if (!item) return missingItem();
        return {
            kicker: "Complex form",
            title: item.name,
            lead: "Target a persona, device, or host first when the form is opposed.",
            blocks: [
                block("rules", "Fading", [
                    "Resist fading with Willpower plus Resonance. Leftover fading is Stun unless the form says otherwise. The complex-form chapter is printed pp. 185–195.",
                ], core(185)),
                edenBlock([
                    "Eden rolls the form and can offer the opposed test when the item has opposing attributes. Fading still needs the resistance roll from the card.",
                ]),
            ],
            launch: { type: "complexform", label: "Open the complex form roll" },
        };
    }
    const action = CONFIG.SR6.MATRIX_ACTIONS?.[data.matrixId];
    const name = actionNameMatrix(data.matrixId);
    const hint = localizeOrEmpty(`shadowrun6.matrixaction.${data.matrixId}.hint`);
    return {
        kicker: action?.major ? "Major matrix action" : "Minor matrix action",
        title: name,
        lead: action?.skill
            ? "Target the icon when the action is opposed. One target uses that icon. No target rolls it as a reference action."
            : "This action has no skill test. Eden posts the description to chat.",
        blocks: [
            block("rules", "From the matrix action", [hint || "Read the action in the matrix chapter, printed pp. 174–184."], core(174)),
            edenBlock([
                action?.illegal
                    ? "This action is illegal. Overwatch still has to be tracked. The sheet stores Overwatch fields and does not advance them from this button."
                    : "Confirm whether this action is legal before you worry about Overwatch.",
                "Access level is outsider, user, or admin, stored as a flag between the two documents. Brute Force can set that flag when its card resolves. Most other actions still need the table to change access.",
            ]),
        ],
        launch: { type: "matrix", label: action?.skill ? "Open the matrix roll" : "Post this action to chat" },
    };
}

function otherPage(actor) {
    return {
        kicker: "The rest of the turn",
        title: "Something else",
        groups: [{
            choices: [
                choice("Use a skill", "The major action, or any test the gamemaster calls for.", { go: "skills" }),
                topicChoice("Observe in Detail", "Perception. Major.", "perception"),
                topicChoice("Assist", "Teamwork. Major.", "assist"),
                topicChoice("First aid", "Biotech. Then edit the monitor.", "heal"),
                topicChoice("Use a simple device", "Major.", "use-device"),
                topicChoice("Call a Shot", "−4 dice, +2 damage.", "call-shot"),
                topicChoice("Multiple Attacks", "Split the pool.", "multiple-attacks"),
                topicChoice("Off-hand", "Penalty from p. 110.", "off-hand"),
                topicChoice("Knockdown", "After a melee hit.", "knockdown"),
                topicChoice("Grapple", "A hold, tracked in chat.", "grapple"),
                topicChoice("Dodge", "The defend menu starts here too.", "dodge"),
                topicChoice("Block", "Melee defense.", "block"),
                topicChoice("Full Defense", "Willpower on every defense.", "full-defense"),
                topicChoice("Hit the Dirt", "Prone, +2, then −2.", "hit-the-dirt"),
                topicChoice("Avoid Incoming", "Leave the blast.", "avoid"),
                topicChoice("Intercept", "Melee as they close.", "intercept"),
            ],
        }],
        blocks: actor ? [] : [],
    };
}

function skillsPage(actor) {
    const skills = actor.system?.skills ?? {};
    const choices = Object.entries(skills)
        .filter(([, skill]) => Number(skill?.points) > 0)
        .map(([id, skill]) => {
            const name = game.i18n.localize(`skill.${id}`);
            const spec = skill.specialization;
            return choice(
                spec ? `${name} (${spec})` : name,
                `Rank ${skill.points}.`,
                { go: "skill-confirm", skill: id, spec: spec || "none" },
            );
        });
    return {
        kicker: "Use Skill · major",
        title: "Which skill?",
        lead: "A skill with a specialization shows that specialization. The roll adds +2 if it matches the sheet. Expertise would be +3, and Eden includes it when the spec you pass equals the expertise name.",
        groups: choices.length ? [{ choices }] : [],
        blocks: choices.length ? [] : [block("gap", "No ranked skills", ["Every skill on the sheet is rank 0, or this actor has no skill list."])],
    };
}

function skillConfirmPage(actor, data) {
    const name = game.i18n.localize(`skill.${data.skill}`);
    const spec = data.spec && data.spec !== "none" ? ` / ${data.spec}` : "";
    return {
        kicker: "Skill",
        title: `${name}${spec}`,
        lead: "A simple test needs a threshold. An opposed test needs the other side to roll. The dialog can take a threshold. It does not pull an opponent in unless the roll type is an attack, a spell, or a matrix action.",
        blocks: [
            block("rules", "Hits", [
                "Count 5s and 6s. More than half the dice showing 1 is a glitch. A glitch with no hits is a critical glitch.",
                "Buying hits is one hit per four dice, the whole pool or not at all, and only if the gamemaster allows it.",
            ], core(35)),
        ],
        launch: { type: "skill", label: `Roll ${name}` },
    };
}

function adeptDetailPage(actor, data) {
    const item = actor.items.get(data.itemId);
    if (!item) return missingItem();
    const full = plainText(item.system.description);
    const text = full.length > 700 ? `${full.slice(0, 700)}… The rest is on the item.` : full;
    return {
        kicker: adeptHint(item),
        title: item.name,
        lead: "Read the power, mark its action on the tally, and type any dice it grants into the attack or defense that follows.",
        groups: [],
        blocks: [
            block("rules", "On the item", [
                text || "The item has no description. Open it on the sheet for the book text you imported.",
            ]),
            block("gap", "No roll", [
                "Adept powers are reference items. If this power is an attack, use the Attack path with the weapon item that represents it.",
            ]),
        ],
    };
}

async function compendiumPage(data) {
    const pack = data.pack || "weapons";
    const result = await searchPack(pack, { query: data.query, kind: data.kind });
    const blocks = [];
    if (result.missing) {
        blocks.push(block("gap", "Compendium not loaded", [
            "Enable the Shadowrun Compendiums module (shadowrun-data). The wizard looks up weapons, ammunition, spells, rituals, adept powers, complex forms, foci, drones, and weapon mods there.",
        ]));
    } else if (result.short) {
        blocks.push(block("eden", "Search", [
            `Type at least two letters of the name, then Search. This reads the ${packLabel(pack)} pack. Open compendium shows the whole pack in Foundry's browser.`,
        ]));
    } else if (!result.entries.length) {
        blocks.push(block("gap", "No matches", [
            "Nothing in that pack has that name. Try a shorter piece of the name, or open the compendium and scroll.",
        ]));
    }
    return {
        kicker: packLabel(pack),
        title: "Compendium",
        lead: "Adding an entry copies it onto the acting character. Dragging from the compendium browser onto the sheet does the same thing.",
        search: {
            pack,
            query: data.query || "",
            placeholder: `Search ${packLabel(pack).toLowerCase()}`,
        },
        groups: result.entries?.length ? [{
            choices: result.entries.map((entry) => ({
                label: entry.name,
                hint: entry.hint || "Add this to the sheet and continue.",
                action: "import",
                pack,
                documentId: entry.id,
                badge: "Add",
            })),
        }] : [],
        blocks,
    };
}

function compendiumChoice(label, hint, pack, kind) {
    return choice(label, hint, { go: "compendium", pack, kind, clear: "query" });
}

function topicPage(id) {
    if (id === "grenade-ordnance") return grenadePage();
    const topic = TOPICS[id];
    if (!topic) {
        return { title: "Missing topic", lead: "Go back.", groups: [], blocks: [] };
    }
    return {
        kicker: topic.kicker,
        title: topic.title,
        lead: topic.lead,
        groups: topic.choices?.length ? [{ choices: topic.choices }] : [],
        blocks: topic.blocks,
        launch: topic.launch ?? null,
    };
}

function grenadePage() {
    return {
        kicker: "Grenade",
        title: "This item is ammunition",
        lead: "The sheet can count it. It cannot throw it.",
        blocks: [
            block("rules", "Throwing and blast", [
                "Throwing uses Athletics. The blast, gas, or scatter that follows is on printed pp. 114–117.",
                "Avoid Incoming is how someone leaves the area: Reaction + Athletics, then meters equal to the hits.",
            ], core(114)),
            gapBlock([
                "Enter a thrown weapon if you want an attack card, or roll Athletics from the skill list and apply damage to everyone in the blast yourself.",
                "Eden does not place a blast template or roll soak for each victim.",
            ]),
        ],
        groups: [{
            choices: [
                choice("Roll Athletics (Throwing) anyway", "The dice only. Damage stays manual.", {
                    go: "skill-confirm",
                    skill: "athletics",
                    spec: "throwing",
                }),
            ],
        }],
    };
}

function economy(actor) {
    const combatant = game.combat?.combatants?.find((entry) => entry.actor?.uuid === actor.uuid);
    const iniType = combatant?.getFlag("shadowrun6-eden", "iniType") || "physical";
    const branch = iniType === "astral" || iniType === "matrix" ? iniType : "physical";
    const dice = sumInitiativeDice(actor.system?.initiative?.[branch]);
    const allotment = actionAllotment(dice);
    const spent = readTally(actor);
    const notes = [];
    if (!allotment.diceKnown) notes.push("No initiative dice were stored, so this reminder assumes 1D6.");
    else notes.push(`${allotment.dice} ${branch} initiative ${allotment.dice === 1 ? "die" : "dice"}.`);
    if (allotment.companionSixth) notes.push("Companion p. 151 lets 5 initiative dice start with a sixth minor. Count it only if the table uses that rule.");
    notes.push("A major spent as a minor, or four minors spent as a major, is yours to mark.");
    return {
        majorSpent: spent.major,
        minorSpent: spent.minor,
        majorMax: allotment.major,
        minorMax: allotment.minor,
        majorOver: spent.major > allotment.major,
        minorOver: spent.minor > allotment.minor,
        note: notes.join(" "),
    };
}

function countKinds(actor) {
    const counts = { melee: 0, firearm: 0, thrown: 0, ordnance: 0, special: 0, gunnery: 0, limb: 0 };
    for (const item of actor.items) {
        const kind = classifyGear(item);
        if (kind && counts[kind] != null) counts[kind] += 1;
    }
    return counts;
}

function itemsOfKind(actor, kind) {
    return actor.items.filter((item) => classifyGear(item) === kind);
}

function weaponHint(item) {
    const system = item.system;
    const skill = system.skill ? game.i18n.localize(`skill.${system.skill}`) : "no skill";
    const stun = system.stun ? "S" : "P";
    const dv = system.dmg != null ? `${system.dmg}${stun}` : "no DV";
    const modes = enabledFireModes(system).join("/") || "no fire mode";
    return `${skill} · DV ${dv} · ${modes}`;
}

function weaponChoice(label, hint, kind, counts) {
    const count = counts[kind] ?? 0;
    return choice(`${label}`, hint, {
        go: "weapons",
        kind,
        clear: "itemId,fireMode,burst,faArea",
        badge: count ? String(count) : "0",
    });
}

function modeChoice(id, itemId) {
    const copy = FIRE_MODE_COPY[id];
    const fireMode = copy.fireMode || id;
    const go = id === "FA" ? "fa-area" : "attack-confirm";
    const extra = {
        go,
        itemId,
        fireMode,
        clear: id === "FA" ? "burst" : "faArea",
    };
    if (copy.burst) extra.burst = copy.burst;
    else if (id !== "FA") extra.burst = "none";
    return choice(copy.label, copy.hint, extra);
}

function spellChoice(item) {
    const system = item.system;
    const combat = system.category === "combat";
    const direct = system.combatSpellType === "spells_direct";
    const area = system.range === "line_of_sight_area" || system.range === "self_area";
    let badge = labelOf(CONFIG.SR6.spell_category, system.category) || "";
    if (combat) badge = direct ? "Direct" : "Indirect";
    if (area) badge = badge ? `${badge} · area` : "Area";
    return choice(item.name, `Drain ${system.drain}. ${labelOf(CONFIG.SR6.spell_range, system.range) || ""}`, {
        go: "spell-confirm",
        itemId: item.id,
        kind: "spell",
        badge,
    });
}

function matrixActions() {
    const skip = new Set(["acid", "binder", "black", "blaster", "crash", "jammer", "killer", "marker", "patrol", "scramble", "sparky", "tarbaby", "track", "list"]);
    return Object.entries(CONFIG.SR6.MATRIX_ACTIONS ?? [])
        .filter(([id, action]) => action && typeof action === "object" && (action.skill != null || action.major != null) && !skip.has(id) && actionNameMatrix(id))
        .map(([id, action]) => ({ id, major: Boolean(action.major), skill: action.skill }));
}

function matrixChoice(action) {
    return choice(actionNameMatrix(action.id), action.skill ? `Skill ${action.skill}.` : "No skill test.", {
        go: "matrix-confirm",
        matrixId: action.id,
        kind: "matrix",
        badge: action.major ? "Major" : "Minor",
    });
}

function topicChoice(label, hint, topic) {
    return choice(label, hint, { go: "topic", topic });
}

function adeptHint(item) {
    const activation = item.system.activation;
    const label = activation
        ? (game.i18n.localize(CONFIG.SR6.adeptpower_activation?.[activation] || activation))
        : "Activation not set";
    const cost = item.system.cost ? `Cost ${item.system.cost}.` : "";
    return `${label}. ${cost}`.trim();
}

function attackSteps(thresholdMode) {
    const defense = thresholdMode
        ? "This world uses You Can't Dodge Bullets. The attack is a threshold test. Eden sets the threshold from one-sixth of the best target Defense pool, then adds the range band. Cover, Dodge, and the rest of Companion pp. 151–152 are typed into that threshold."
        : "The defender rolls Reaction + Intuition, plus situation dice such as Dodge. An unaware defender still rolls, at a penalty.";
    return [
        "Grab dice. The attacker uses the weapon skill plus its attribute. A melee weapon is Close Combat + Agility. A gun is Firearms + Agility. A thrown weapon is Athletics + Agility. A vehicle weapon is Engineering + Logic.",
        defense,
        "Compare Attack Rating to Defense Rating before anyone spends the Edge they just gained. A gap of 4 or more gives 1 Edge to the higher side. Then roll. A tie goes to the attacker: equal hits means the weapon's base damage, and the attacker needs at least one hit. Net hits add to the damage.",
        "Soak is Body, one hit cancels one point of damage, unless the damage says otherwise. Edge can still be spent here if it was not spent earlier in the action.",
        "Whatever remains goes on the Physical or Stun monitor. A secondary effect of the weapon applies only if at least one box got through.",
    ];
}

function attackWarnings(data, targets) {
    const warnings = [];
    if (data.burst === "wide_burst" && targets.length !== 2) {
        warnings.push("Wide burst wants exactly two targeted tokens. Eden will reject the dialog if the count is wrong.");
    }
    if (data.fireMode && data.fireMode !== "FA" && targets.length > 2) {
        warnings.push("Three or more targets need full auto. Eden will reject another fire mode.");
    }
    return warnings;
}

function describeMode(data) {
    if (data.burst === "wide_burst") return "Wide burst. Confirm two targets, then open the roll. The dialog should already be on burst fire.";
    if (data.burst === "narrow_burst") return "Narrow burst. The dialog should already be on burst fire.";
    if (data.fireMode === "FA") return `Full auto, ${data.faArea || 1}m radius. Ten rounds. The dialog should already be on full auto.`;
    if (data.fireMode === "SA") return "Semi-automatic. Two rounds, Attack Rating −2, damage +1.";
    if (data.fireMode === "SS") return "Single shot. One round, no fire-mode penalty.";
    return "No fire mode was picked. Melee and mode-less weapons open straight into the attack dialog.";
}

function underbarrelNote(item) {
    const blob = `${item.name} ${item.system?.accessories ?? ""} ${item.system?.notes ?? ""}`;
    if (!/underbarrel|under-barrel|masterkey|grenade launcher/i.test(blob)) return "";
    return "The name or accessories mention an underbarrel or a grenade launcher. Eden keeps one fire-mode list on the item. Add the second weapon as its own gear item and attack with that item.";
}

function targetNames() {
    return [...(game.user?.targets ?? [])].map((token) => token.name);
}

function settingOn(key) {
    try {
        return Boolean(game.settings.get("shadowrun6-eden", key));
    } catch {
        return false;
    }
}

function labelOf(table, key) {
    if (!table || !key || !table[key]) return "";
    const value = game.i18n.localize(table[key]);
    return value === table[key] ? key : value;
}

function localizeOrEmpty(key) {
    const value = game.i18n.localize(key);
    return value === key ? "" : value;
}

function boostName(id) {
    return localizeOrEmpty(`shadowrun6.edge_boost.${id}`) || id;
}

function actionName(id) {
    return localizeOrEmpty(`shadowrun6.edge_action.${id}`) || id.replaceAll("_", " ");
}

function actionNameMatrix(id) {
    return localizeOrEmpty(`shadowrun6.matrixaction.${id}.name`);
}

function choice(label, hint, extra = {}) {
    return { label, hint, ...extra };
}

function block(tone, heading, paragraphs, cite) {
    return { tone, heading, paragraphs, cite };
}

function edenBlock(paragraphs) {
    return block("eden", "On the Eden sheet", paragraphs);
}

function gapBlock(paragraphs) {
    return block("gap", "What you still settle at the table", paragraphs);
}

function core(page) {
    return { book: "core_berlin", page, label: "Core" };
}

function missingItem() {
    return {
        title: "That item is gone",
        lead: "It is no longer on the sheet. Go back and pick again.",
        groups: [],
        blocks: [],
    };
}

function plainText(value) {
    return String(value ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}
