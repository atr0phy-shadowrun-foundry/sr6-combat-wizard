import { actionAllotment, classifyGear, enabledFireModes, sumInitiativeDice } from "./classify.js";
import { packLabel, searchPack } from "./compendiums.js";
import { buildProvision, findByGenesis, secondWeaponPlans } from "./provisions.js";
import { EDGE_ACTIONS, EDGE_BOOSTS, TOPICS } from "./topics.js";
import { readTally } from "./tally.js";
import { lacksMatrixDevice } from "./launch.js";

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

/**
 * Who the wizard is acting as. A pick made in the wizard wins until the canvas
 * selection changes; otherwise the first selected token decides.
 * @returns {{ actor: Actor|null, token: Token|null, problem: "none"|"broken"|"foreign"|null }}
 */
export function resolveActing(state) {
    const controlled = canvas?.tokens?.controlled ?? [];
    const picked = state.actorUuid ? fromUuidSync(state.actorUuid) : null;
    if (picked) {
        const token = controlled.find((entry) => entry.actor?.uuid === picked.uuid) ?? picked.getActiveTokens?.()[0] ?? null;
        return picked.isOwner ? { actor: picked, token, problem: null } : { actor: null, token, problem: "foreign" };
    }
    const token = controlled[0];
    if (!token) return { actor: null, token: null, problem: "none" };
    if (!token.actor) return { actor: null, token, problem: "broken" };
    if (!token.actor.isOwner) return { actor: null, token, problem: "foreign" };
    return { actor: token.actor, token, problem: null };
}

function selectedActors() {
    const found = new Map();
    for (const token of canvas?.tokens?.controlled ?? []) {
        if (token.actor?.isOwner && !found.has(token.actor.uuid)) found.set(token.actor.uuid, token.actor);
    }
    return [...found.values()];
}

export async function buildPage(state) {
    const acting = resolveActing(state);
    const actor = acting.actor;
    const page = actor ? await renderPage(state, actor) : noActorPage(acting);
    const actors = selectedActors().map((candidate) => ({
        uuid: candidate.uuid,
        name: candidate.name,
        current: candidate.uuid === actor?.uuid,
    }));
    return {
        ...page,
        actor,
        acting: actingCard(acting),
        actors,
        multipleActors: actors.length > 1,
        crumb: crumbTrail(state),
        economy: actor ? economy(actor) : null,
        against: targetCards(),
    };
}

function crumbTrail(state) {
    const history = state.history ?? [];
    if (state.pageId === "home") return [{ label: "Start", current: true }];
    let start = 0;
    history.forEach((entry, index) => {
        if (entry.pageId === "home") start = index;
    });
    const trail = history.slice(start).map((entry, offset) => ({
        label: entry.pageId === "home" ? "Start" : entry.label || "Start",
        index: start + offset,
    }));
    trail.push({ label: state.label || "Here", current: true });
    return trail;
}

function actingCard({ actor, token, problem }) {
    if (problem === "none") return null;
    if (problem === "broken") {
        return { name: token.name, img: portrait(token.document.texture?.src), note: "No actor" };
    }
    if (problem === "foreign") {
        return { uuid: token?.document?.uuid, name: token?.name, img: portrait(token?.document?.texture?.src, token?.actor?.img), note: "Not yours" };
    }
    return {
        uuid: token?.document?.uuid ?? actor.uuid,
        name: token?.name ?? actor.name,
        img: portrait(token?.document?.texture?.src ?? actor.prototypeToken?.texture?.src, actor.img),
    };
}

function targetCards() {
    return [...(game.user?.targets ?? [])].map((token) => ({
        uuid: token.document.uuid,
        name: token.name,
        img: portrait(token.document.texture?.src, token.actor?.img),
    }));
}

function portrait(tokenImage, actorImage) {
    if (tokenImage && !tokenImage.includes("*")) return tokenImage;
    return actorImage || "icons/svg/mystery-man.svg";
}

function noActorPage({ token, problem }) {
    const copy = {
        none: {
            title: "Nothing selected",
            notice: "Select your token on the canvas. The wizard follows your selection.",
        },
        broken: {
            title: "This token has no actor",
            notice: `${token?.name ?? "This token"} points to an actor that no longer exists. Select another token, or relink this one in its token settings.`,
        },
        foreign: {
            title: "This token is not yours",
            notice: `You do not own ${token?.name ?? "this token"}. Select your own token.`,
        },
    }[problem];
    const fallbacks = [];
    const add = (actor, label, hint) => {
        if (actor?.isOwner && !fallbacks.some((entry) => entry.actorUuid === actor.uuid)) {
            fallbacks.push(choice(label, hint, { action: "actor", actorUuid: actor.uuid }));
        }
    };
    add(game.user.character, `Use ${game.user.character?.name}`, "Your assigned character, without selecting a token.");
    add(game.combat?.combatant?.actor, `Use ${game.combat?.combatant?.name}`, "The combatant whose turn it is.");
    return {
        kicker: "Combat turn",
        ...copy,
        groups: fallbacks.length ? [{ heading: "Or act as", choices: fallbacks }] : [],
        blocks: [],
    };
}

async function renderPage(state, actor) {
    const id = state.pageId;
    if (id === "compendium") return compendiumPage(state.data);
    if (id === "home") return homePage(actor);
    if (id === "major") return majorPage(actor);
    if (id === "minor") return minorPage(actor);
    if (id === "anytime") return anytimePage();
    if (id === "incoming-do") return incomingDoPage(actor, state.data.topic);
    if (id === "attack") return attackKindPage(actor);
    if (id === "weapons") return weaponListPage(actor, state.data.kind);
    if (id === "fire-mode") return fireModePage(actor, state.data);
    if (id === "fa-area") return faAreaPage(actor, state.data);
    if (id === "attack-confirm") return attackConfirmPage(actor, state.data);
    if (id === "spells") return spellListPage(actor, state.data.kind);
    if (id === "spell-confirm") return spellConfirmPage(actor, state.data);
    if (id === "adept") return adeptPage(actor);
    if (id === "adept-detail") return adeptDetailPage(actor, state.data);
    if (id === "edge") return edgePage();
    if (id === "edge-boost") return edgeBoostPage(state.data.topic);
    if (id === "edge-action") return edgeActionPage(state.data.topic);
    if (id === "reload") return reloadPage(actor);
    if (id === "reload-how") return reloadHowPage(actor, state.data);
    if (id === "matrix") return matrixPage(actor);
    if (id === "matrix-confirm") return matrixConfirmPage(actor, state.data);
    if (id === "forms") return formsPage(actor);
    if (id === "skills") return skillsPage(actor);
    if (id === "skill-confirm") return skillConfirmPage(actor, state.data);
    if (id === "topic") return topicPage(state.data.topic, actor, state.data);
    return {
        title: "Missing page",
        lead: "That step is not in the wizard. Go back to the start.",
        groups: [],
        blocks: [],
    };
}

function homePage(actor) {
    const turn = turnState(actor);
    const offTurn = turn === "other";
    const major = choice("Major action", "On your turn: attack, cast a spell, sprint, reload, a skill test.", { go: "major", clear: CLEAR, badge: "Major", cite: core(40), dim: offTurn });
    const minor = choice("Minor action", "On your turn: move, aim, take cover, drop prone.", { go: "minor", clear: CLEAR, badge: "Minor", cite: core(41), dim: offTurn });
    const anytime = choice("Anytime action", "On or off your turn: dodge, block, hit the dirt, full defense.", { go: "anytime", clear: CLEAR, badge: "Anytime", cite: core(42) });
    const edge = choice("Spend Edge", "Boosts on a roll, and Edge actions.", { go: "edge", clear: CLEAR, badge: "Edge", cite: core(44) });
    return {
        kicker: turnKicker(actor, turn),
        title: "What kind of action?",
        groups: [{ choices: offTurn ? [anytime, edge, major, minor] : [major, minor, anytime, edge] }],
        blocks: [
            block("rules", "How a round is built", [
                "Everyone acts once. You start with 1 major action and 1 minor action, plus 1 extra minor for each initiative die, and you do not start with more than 5 minor actions.",
                "A common turn is a minor to set up, the major, then any minors left. You can spend them in any order.",
                "A major action may be spent as a minor. Four minor actions may be spent as one major. Unused actions do not carry into the next round.",
                "An anytime action can be taken when it is not your turn, as long as you still have that action.",
            ], core(40)),
        ],
    };
}

function turnState(actor) {
    const combat = game.combat;
    if (!combat?.started || !combat.combatant) return "none";
    return combat.combatant.actor?.uuid === actor.uuid ? "mine" : "other";
}

function turnKicker(actor, turn) {
    if (turn === "none") return "Combat turn";
    const combat = game.combat;
    if (turn === "mine") return `Round ${combat.round} · your turn`;
    return `Round ${combat.round} · ${combat.combatant.name} is up`;
}

function majorPage(actor) {
    return {
        kicker: "Your turn",
        title: "Major action",
        lead: "You have one major action a round. Four minors can be spent as one major.",
        leadCite: core(40),
        groups: [
            {
                heading: "Combat",
                choices: [
                    choice("Attack", "A weapon, a fist, a thrown weapon, a grenade.", { go: "attack", badge: "Major", cite: core(40) }),
                    topicChoice("Sprint", "15 meters plus hits, instead of a normal move.", "sprint", "Major"),
                    choice("Reload a weapon", "Anything other than a smartgun reload.", { go: "reload", kind: "plain", badge: "Major", cite: core(43) }),
                    topicChoice("Ready Weapon", "Draw or stow.", "ready-weapon", "Major"),
                    topicChoice("Pick up or put down", "The careful version of drop.", "pick-up", "Major"),
                ],
            },
            {
                heading: "After a melee hit",
                note: "Follow-ups the sheet does not track.",
                choices: [
                    topicChoice("Knockdown", "After a melee hit.", "knockdown"),
                    topicChoice("Grapple", "A hold, tracked in chat.", "grapple"),
                ],
            },
            {
                heading: "Magic",
                choices: [
                    choice("Cast a spell", "A formula on the sheet.", { go: "spells", kind: "any", badge: "Major", cite: core(130) }),
                    topicChoice("Summon a spirit", "Services are tracked at the table.", "summon", "Major"),
                    topicChoice("Banish a spirit", "Opposed, then drain.", "banish", "Major"),
                    topicChoice("Astral projection", "Its own initiative.", "astral-projection", "Major"),
                    adeptChoice(actor),
                ],
            },
            {
                heading: "Matrix",
                choices: [
                    choice("Complex forms", "A form on the sheet.", { go: "forms", badge: "Major", cite: core(185) }),
                    topicChoice("Jump in", "Then use the vehicle's weapons.", "jump-in", "Major"),
                    choice("Matrix actions", "Major and minor actions from the system list.", { go: "matrix", cite: core(174) }),
                ],
            },
            {
                heading: "Other",
                choices: [
                    choice("Use a skill", "Or any test the gamemaster calls for.", { go: "skills", badge: "Major", cite: core(35) }),
                    topicChoice("Observe in Detail", "Perception.", "perception", "Major"),
                    topicChoice("Assist", "Teamwork.", "assist", "Major"),
                    topicChoice("First aid", "Biotech. Then edit the monitor.", "heal", "Major"),
                    topicChoice("Use a simple device", "Automatic if it is truly simple. It still costs the major.", "use-device", "Major"),
                ],
            },
            {
                heading: "Anytime, also on your turn",
                choices: anytimeMajors(),
            },
        ],
        blocks: [],
    };
}

function minorPage(actor) {
    const foci = actor.items.filter((item) => item.type === "focus");
    return {
        kicker: "Your turn",
        title: "Minor action",
        lead: "Minor actions are usually automatic. You start with 1, plus 1 for each initiative die, up to 5. A major can be spent as a minor.",
        leadCite: core(41),
        groups: [
            {
                heading: "Move and position",
                choices: [
                    topicChoice("Move", "10 meters, once.", "move", "Minor"),
                    topicChoice("Take Cover", "Cover I through IV on the token.", "take-cover", "Minor"),
                    topicChoice("Drop Prone", "Prone without the dive bonus.", "drop-prone", "Minor"),
                    topicChoice("Stand Up", "Clear prone.", "stand-up", "Minor"),
                ],
            },
            {
                heading: "With an attack",
                note: "These ride with the Attack major.",
                choices: [
                    topicChoice("Take Aim", "+1 die, stacks to Willpower.", "take-aim", "Minor"),
                    topicChoice("Quick Draw", "A small weapon, with the attack.", "quick-draw", "Minor"),
                    topicChoice("Call a Shot", "−4 dice, +2 damage.", "call-shot", "Minor"),
                    topicChoice("Multiple Attacks", "Split the pool.", "multiple-attacks", "Minor"),
                    topicChoice("Off-hand", "Penalty from printed p. 110.", "off-hand", "Minor"),
                    choice("Reload a smartgun", "The next clip is in hand.", { go: "reload", kind: "smart", badge: "Minor", cite: core(43) }),
                ],
            },
            {
                heading: "Magic and Matrix",
                choices: [
                    topicChoice("Command a spirit", "Spends a service.", "command-spirit", "Minor"),
                    topicChoice("Activate a focus", foci.length ? foci.map((item) => item.name).join(", ") : "No foci on the sheet.", "focus", "Minor"),
                    topicChoice("Shift perception", "Astral or physical.", "shift-perception", "Minor"),
                    topicChoice("Command a drone", "Give the drone an order.", "command-drone", "Minor"),
                    adeptChoice(actor),
                    choice("Matrix actions", "Major and minor actions from the system list.", { go: "matrix", cite: core(174) }),
                    compendiumChoice("Look up a focus", "Foci compendium in shadowrun-data.", "foci", "any"),
                ],
            },
            {
                heading: "Anytime, also on your turn",
                choices: anytimeMinors(),
            },
            {
                heading: "Edge action",
                note: "This does not spend a minor or a major. It attaches to the ranged attack.",
                choices: [
                    choice("Fire from Cover", "2 Edge. Shoot from Cover IV without the minor to lean out.", { go: "edge-action", topic: "fire_from_cover", badge: "2 Edge", cite: core(47) }),
                ],
            },
        ],
        blocks: [],
    };
}

function anytimePage() {
    return {
        kicker: "On or off your turn",
        title: "Anytime action",
        notice: "You still need the action. A minor spent here is gone from your own turn.",
        lead: "The real Defense roll is the button on the attack card. Defenses below walk you through it.",
        leadCite: core(42),
        groups: [
            { heading: "Minor action", choices: anytimeMinors() },
            { heading: "Major action", choices: anytimeMajors() },
            {
                heading: "Edge action",
                note: "An Edge action does not spend a minor or a major. It attaches to the action in the hint. One Edge spend per action.",
                choices: [
                    choice("Tactical Roll", "1 Edge. Rides on Hit the Dirt.", { go: "edge-action", topic: "tactical_roll", badge: "1 Edge", cite: core(47) }),
                    choice("Wrest", "2 Edge. Replaces Block.", { go: "edge-action", topic: "wrest", badge: "2 Edge", cite: core(47) }),
                ],
            },
        ],
        blocks: [
            block("rules", "Soak is the next card", [
                "After a hit, the defender rolls Body unless the damage says otherwise. Each hit cancels one point. The soak button is on the attack card, and Edge can still be spent there if this action has not spent Edge yet.",
            ], core(106)),
        ],
    };
}

function anytimeMinors() {
    return [
        defenseChoice("Dodge", "Add Athletics to one Defense test.", "dodge", "Minor"),
        defenseChoice("Block", "Add Close Combat to one melee Defense test.", "block", "Minor"),
        defenseChoice("Hit the Dirt", "Prone, +2 Defense, then −2 on your tests.", "hit-the-dirt", "Minor"),
        topicChoice("Avoid Incoming", "Leave a blast or a gas cloud.", "avoid", "Minor"),
        topicChoice("Drop Object", "Let go of what you are holding.", "drop-object", "Minor"),
        topicChoice("Intercept", "Melee attack when someone enters Close. The attack is a major.", "intercept", "Minor + Major"),
    ];
}

function anytimeMajors() {
    return [
        defenseChoice("Full Defense", "Add Willpower to every Defense test this round.", "full-defense", "Major"),
        topicChoice("Counterspell", "Sorcery versus the spell.", "counterspell", "Major"),
    ];
}

function adeptChoice(actor) {
    const powers = actor.items.filter((item) => item.type === "adeptpower").length;
    return choice("Adept powers", powers ? `${powers} on the sheet, grouped by activation.` : "None on the sheet. The compendium is one step down.", { go: "adept", badge: powers ? "" : "Empty", cite: core(156) });
}

function defenseChoice(label, hint, topic, badge) {
    return choice(label, hint, { go: "incoming-do", topic, badge, cite: ruleCite(topic) });
}

function incomingDoPage(actor, topic) {
    const plans = {
        dodge: {
            title: "Dodge",
            track: "minor",
            steps: [
                "Open the attack card in chat.",
                "Press Defense.",
                modifierLine(skillRank(actor, "athletics"), "Athletics"),
            ],
        },
        block: {
            title: "Block",
            track: "minor",
            steps: [
                "Open the attack card in chat.",
                "Press Defense.",
                modifierLine(skillRank(actor, "close_combat"), "Close Combat"),
            ],
        },
        "full-defense": {
            title: "Full Defense",
            track: "major",
            steps: [
                "Open the attack card in chat.",
                "Press Defense.",
                modifierLine(attributePool(actor, "wil"), "Willpower"),
                "Use that same number on every Defense test this round.",
            ],
        },
        "hit-the-dirt": {
            title: "Hit the Dirt",
            track: "minor",
            status: "prone",
            steps: [
                "Open the attack card in chat.",
                "Press Defense.",
                "Type +2 into the modifier.",
                "You are prone. Later tests take −2 until you stand up.",
            ],
        },
    };
    const plan = plans[topic];
    if (!plan) return { title: "Missing defense", lead: "Go back.", groups: [], blocks: [] };
    const choices = [
        choice(plan.track === "major" ? "Mark the major" : "Mark the minor", "Count it on the tally at the top.", {
            action: "tally",
            track: plan.track,
            delta: "1",
        }),
    ];
    if (plan.status) {
        choices.push(choice("Mark prone", "Set the prone status on the token.", {
            action: "status",
            status: plan.status,
            cite: core(42),
        }));
    }
    const rule = choice("The full rule", "What the book and Eden each handle.", { go: "topic", topic, cite: ruleCite(topic) });
    return {
        kicker: "Defense",
        title: plan.title,
        steps: plan.steps,
        groups: [{ heading: "Then mark it", choices }, { choices: [rule] }],
        blocks: [],
    };
}

function modifierLine(value, name) {
    if (value == null) return `Type your ${name} into the modifier.`;
    return `Type ${value} into the modifier. That is ${name}.`;
}

function skillRank(actor, id) {
    const skill = actor?.system?.skills?.[id];
    if (!skill) return null;
    return Number(skill.points || 0) + Number(skill.modifier || 0) + Number(skill.augment || 0);
}

function attributePool(actor, id) {
    const attr = actor?.system?.attributes?.[id];
    if (!attr) return null;
    if (attr.pool != null && attr.pool !== "") return Number(attr.pool);
    return Number(attr.base || 0) + Number(attr.mod || 0) + Number(attr.augment || 0);
}

function attackKindPage(actor) {
    const counts = countKinds(actor);
    return {
        kicker: "Attack · major · your turn",
        title: "How are you attacking?",
        lead: "One attack is one major action. Called shots, multiple attacks, and aim are minors that ride along with it. You will get those on the last page.",
        leadCite: core(40),
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
                badge: "Finish in chat",
                cite: core(114),
            });
        }
        const modes = enabledFireModes(item.system);
        const ranged = kind === "firearm" || kind === "thrown" || kind === "special" || kind === "gunnery";
        return choice(item.name, weaponHint(item), {
            go: ranged && modes.length ? "fire-mode" : "attack-confirm",
            itemId: item.id,
            kind,
            badge: modes.length ? modeWords(modes) : (item.system.skill ? "" : "No skill"),
            cite: kindCite(kind),
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
        leadCite: kindCite(kind),
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
    const barrel = secondBarrelSection(actor, item);
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
        leadCite: core(108),
        groups: [
            { choices },
            ...(barrel ? [barrel] : []),
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
        leadCite: core(108),
        groups: [{
            choices: [1, 2, 3, 4, 5, 6].map((meters) => choice(
                `${meters}m radius`,
                meters === 1 ? "The base full-auto penalty only." : `Attack Rating −${6 + (meters - 1) * 2}.`,
                { go: "attack-confirm", itemId: data.itemId, fireMode: "FA", faArea: String(meters), cite: core(108) },
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
    const barrel = secondBarrelSection(actor, item);
    blocks.push(block("eden", "Edge on this roll", [
        "One Edge spend per action, either a boost or an Edge action. The dialog's Edge list applies several boosts. Edge actions are listed there, and their special effect is still a table call. The Edge cost of an action is worth confirming on the sheet after the roll.",
        "Attack Rating versus Defense Rating: a gap of 4 or more gives 1 Edge to the higher side. Area attacks use the highest Defense Rating. Bonus Edge from the situation is still capped. The world setting max Edge per round is the cap Eden is using.",
    ], core(45)));
    if (!item.system.skill) {
        blocks.push(block("gap", "No skill on the weapon", [
            "Open the item and set the skill before this roll will start. Close Combat, Firearms, Athletics, Engineering, or Exotic Weapons.",
        ]));
    }
    return {
        kicker: item.name,
        title: `Attack with ${item.name}`,
        lead: modeLine,
        leadCite: data.fireMode ? core(108) : core(104),
        notice: data.fireMode ? "Leave the fire mode in the dialog. Changing it throws away this choice." : "",
        groups: barrel ? [barrel] : [],
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
                cite: core(143),
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
        leadCite: core(130),
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
            leadCite: core(143),
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
        ], core(130)));
    }
    return {
        kicker: combat ? "Combat spell" : "Spell",
        title: item.name,
        lead: area ? "Area spell. One casting, everyone in the area." : "Single target, unless the spell's own text says otherwise.",
        leadCite: combat ? core(131) : core(130),
        blocks,
        launch: { type: "spell", label: "Open the spell roll" },
    };
}

function adeptPage(actor) {
    const powers = actor.items.filter((item) => item.type === "adeptpower");
    return {
        kicker: "Adept",
        title: "Powers on the sheet",
        lead: "Each power is passive, a minor action, or a major action. The item stores that. Using it does not roll unless the power says to make a test.",
        leadCite: core(156),
        groups: [
            ...adeptGroups(powers),
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

function reloadPage(actor) {
    const weapons = actor.items.filter((item) => ["firearm", "thrown", "special", "gunnery"].includes(classifyGear(item)));
    return {
        kicker: "Reload",
        title: "Which weapon?",
        lead: "A smartgun reload is a minor when the next clip is in hand. Any other reload is a major. Eden's ammo button fills the weapon to capacity and does not know which action you spent.",
        leadCite: core(43),
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
        leadCite: core(43),
        groups: [{
            heading: "Minor action",
            choices: [
                { label: "Smartgun reload", hint: "The next clip is in hand.", action: "refill", itemId: item.id, track: "minor", badge: "Minor", cite: core(43) },
            ],
        }, {
            heading: "Major action",
            choices: [
                { label: "Ordinary reload", hint: "Any reload that is not a smartgun reload.", action: "refill", itemId: item.id, track: "major", badge: "Major", cite: core(43) },
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
        { go: "edge-boost", topic: id, badge: String(boost.cost), cite: core(46) },
    ));
    const inDialog = [];
    const bookOnly = [];
    for (const [id, action] of Object.entries(EDGE_ACTIONS)) {
        const entry = choice(actionName(id), `${action.cost} Edge. ${action.attached}.`, {
            go: "edge-action",
            topic: id,
            badge: action.inDialog ? "In the dialog" : "Book only",
            cite: core(47),
        });
        (action.inDialog ? inDialog : bookOnly).push(entry);
    }
    return {
        kicker: "Edge",
        title: "One spend on this action",
        lead: "A boost or an Edge action, not both. The same boost can be bought more than once. You cannot spend on your roll and the opponent's roll as that one expenditure. Nothing reduces an Edge action's cost to zero.",
        leadCite: core(44),
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
        leadCite: core(46),
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
        leadCite: core(47),
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
        leadCite: core(174),
        groups: [
            {
                heading: "Minor action",
                choices: [
                    topicChoice("Command a drone", "Give the drone an order.", "command-drone", "Minor"),
                ],
            },
            {
                heading: "Major action",
                choices: [
                    choice("Complex forms", forms.length ? `${forms.length} on the sheet.` : "None on this sheet.", { go: "forms", badge: "Major", cite: core(185) }),
                    topicChoice("Jump in", "Then use the vehicle's weapons.", "jump-in", "Major"),
                ],
            },
            {
                heading: "Compendium",
                choices: [
                    compendiumChoice("Look up a complex form", "Complex forms compendium in shadowrun-data.", "forms", "any"),
                    compendiumChoice("Look up a drone", "Drones compendium in shadowrun-data. Add it, then command that actor.", "drones", "any"),
                ],
            },
            { heading: "Major matrix actions", choices: major.map(matrixChoice) },
            { heading: "Minor matrix actions", choices: minor.map(matrixChoice) },
        ],
        blocks: [
            ...(lacksMatrixDevice(actor) ? [noDeviceBlock(actor)] : []),
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
        leadCite: core(185),
        groups: [{
            choices: forms.map((item) => choice(item.name, `Fading ${item.system.fading ?? "?"}. ${item.system.skill || "No skill"}.`, {
                go: "matrix-confirm",
                itemId: item.id,
                kind: "form",
                cite: core(185),
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
            leadCite: core(185),
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
    const cite = matrixCite(data.matrixId) ?? core(179);
    const noDevice = lacksMatrixDevice(actor);
    return {
        kicker: action?.major ? "Major matrix action" : "Minor matrix action",
        title: name,
        lead: action?.skill
            ? "Target the icon when the action is opposed. One target uses that icon. No target rolls it as a reference action."
            : "This action has no skill test. Eden posts the description to chat.",
        leadCite: cite,
        blocks: [
            ...(noDevice ? [noDeviceBlock(actor)] : []),
            block("rules", "From the matrix action", [hint || "Read the action in the matrix chapter, printed pp. 180–184."], cite),
            edenBlock([
                action?.illegal
                    ? "This action is illegal. Overwatch still has to be tracked. The sheet stores Overwatch fields and does not advance them from this button."
                    : "Confirm whether this action is legal before you worry about Overwatch.",
                "Access level is outsider, user, or admin, stored as a flag between the two documents. Brute Force can set that flag when its card resolves. Most other actions still need the table to change access.",
            ]),
        ],
        launch: noDevice ? undefined : { type: "matrix", label: action?.skill ? "Open the matrix roll" : "Post this action to chat" },
    };
}

function noDeviceBlock(actor) {
    return block("gap", "No matrix device in use", [
        `Eden builds matrix rolls from the device ${actor.name} uses to access the Matrix, and this sheet has none. On the Matrix tab, switch a commlink, cyberdeck, cyberjack, rigger console, dataterm, or cyberterm online and tick it as the device used to access the Matrix. Technomancers do not need one.`,
    ]);
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
                { go: "skill-confirm", skill: id, spec: spec || "none", cite: core(92) },
            );
        });
    return {
        kicker: "Use Skill · major",
        title: "Which skill?",
        lead: "A skill with a specialization shows that specialization. The roll adds +2 if it matches the sheet. Expertise would be +3, and Eden includes it when the spec you pass equals the expertise name.",
        leadCite: core(92),
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
        leadCite: core(35),
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
        leadCite: core(156),
        groups: [],
        blocks: [
            block("rules", "On the item", [
                text || "The item has no description. Open it on the sheet for the book text you imported.",
            ], core(156)),
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

function topicPage(id, actor, data = {}) {
    if (id === "grenade-ordnance") return grenadePage(actor, data);
    const topic = TOPICS[id];
    if (!topic) {
        return { title: "Missing topic", lead: "Go back.", groups: [], blocks: [] };
    }
    return {
        kicker: topic.kicker,
        title: topic.title,
        lead: topic.lead,
        leadCite: ruleCite(id),
        groups: topic.choices?.length ? [{ choices: topic.choices }] : [],
        blocks: topic.blocks,
        launch: topic.launch ?? null,
    };
}

function grenadePage(actor, data) {
    const item = actor?.items?.get?.(data.itemId);
    const preview = item ? buildProvision("thrown", item) : null;
    const existing = preview ? findByGenesis(actor, preview.system.genesisID) : null;
    const choices = [];
    if (existing) {
        choices.push(choice(`Attack with ${existing.name}`, "The thrown copy is already on the sheet.", {
            go: "attack-confirm",
            itemId: existing.id,
            kind: "thrown",
            cite: core(114),
        }));
    } else if (item) {
        choices.push(choice(`Add ${item.name} as a thrown weapon`, "Athletics. Attack Rating starts blank. Blast stays a table call.", {
            action: "provision",
            provision: "thrown",
            itemId: item.id,
            badge: "Add",
            cite: core(114),
        }));
    }
    choices.push(choice("Roll Athletics (Throwing) anyway", "The dice only. Damage stays manual.", {
        go: "skill-confirm",
        skill: "athletics",
        spec: "throwing",
        cite: core(114),
    }));
    return {
        kicker: "Grenade",
        title: item ? item.name : "This item is ammunition",
        lead: "The sheet can count ammunition. It cannot throw it until a thrown weapon exists.",
        leadCite: core(114),
        groups: [{ choices }],
        blocks: [
            block("rules", "Throwing and blast", [
                "Throwing uses Athletics. The blast, gas, or scatter that follows is on printed pp. 114–117.",
                "Avoid Incoming is how someone leaves the area: Reaction + Athletics, then meters equal to the hits.",
            ], core(114)),
            gapBlock([
                "Add the thrown weapon below if you want an attack card. The new item does not know the blast radius. Apply that, and any scatter, in chat.",
                "Eden does not place a blast template or roll soak for each victim.",
            ]),
        ],
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
    const modes = enabledFireModes(system);
    const mode = modes.length ? modeWords(modes) : "no fire mode";
    return `${skill} · DV ${dv} · ${mode}`;
}

function modeWords(modes) {
    const names = { SS: "Single", SA: "Semi", BF: "Burst", FA: "Auto" };
    return modes.map((mode) => names[mode] || mode).join(", ");
}

function weaponChoice(label, hint, kind, counts) {
    const count = counts[kind] ?? 0;
    return choice(`${label}`, hint, {
        go: "weapons",
        kind,
        clear: "itemId,fireMode,burst,faArea",
        badge: count ? String(count) : "0",
        cite: kindCite(kind),
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
        cite: core(108),
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
        cite: core(130),
    });
}

function matrixActions() {
    const skip = new Set(["acid", "binder", "black", "blaster", "crash", "jammer", "killer", "marker", "patrol", "scramble", "sparky", "tarbaby", "track", "list"]);
    return Object.entries(CONFIG.SR6.MATRIX_ACTIONS ?? [])
        .filter(([id, action]) => action && typeof action === "object" && (action.skill != null || action.major != null) && !skip.has(id) && actionNameMatrix(id))
        .map(([id, action]) => ({ id, major: Boolean(action.major), skill: action.skill }));
}

const MATRIX_PAGES = {
    backdoor_entry: 180, brute_force: 180, change_icon: 180, check_os: 180, control_device: 180, crack_file: 180,
    crash_program: 181, data_spike: 181, disarm_data_bomb: 181, edit_file: 181, encrypt_file: 181, enter_host: 181,
    erase_matrix_signature: 181, format_device: 181,
    full_matrix_defense: 182, hash_check: 182, hide: 182, jack_out: 182, jam_signals: 182, jump_rigged: 182, matrix_perception: 182,
    matrix_search: 183, probe: 183, reboot_device: 183, reconfigure: 183, send_message: 183, set_data_bomb: 183,
    snoop: 184, spoof_command: 184, switch_ifmode: 184, tarpit: 184, trace_icon: 184,
};

function matrixCite(id) {
    return MATRIX_PAGES[id] ? core(MATRIX_PAGES[id]) : undefined;
}

function matrixChoice(action) {
    const skill = action.skill ? `${game.i18n.localize(`skill.${action.skill}`)}.` : "No skill test.";
    const hint = localizeOrEmpty(`shadowrun6.matrixaction.${action.id}.hint`);
    const summary = hint.split(/(?<=[.!?])\s+/)[0];
    return choice(actionNameMatrix(action.id), summary ? `${skill} ${summary}` : skill, {
        tip: hint || undefined,
        go: "matrix-confirm",
        matrixId: action.id,
        kind: "matrix",
        badge: action.major ? "Major" : "Minor",
        cite: matrixCite(action.id),
    });
}

function topicChoice(label, hint, topic, badge) {
    return choice(label, hint, { go: "topic", topic, badge, cite: ruleCite(topic) });
}

function ruleCite(topic) {
    return TOPICS[topic]?.blocks?.find((entry) => entry.cite)?.cite;
}

function kindCite(kind) {
    return {
        melee: core(104),
        firearm: core(108),
        thrown: core(114),
        ordnance: core(114),
        special: core(108),
        gunnery: core(104),
    }[kind] ?? core(104);
}

function adeptGroups(powers) {
    const buckets = {
        major_action: [],
        minor_action: [],
        passive: [],
        other: [],
    };
    for (const item of powers) {
        const key = Object.hasOwn(buckets, item.system.activation) ? item.system.activation : "other";
        buckets[key].push(choice(item.name, adeptHint(item), {
            go: "adept-detail",
            itemId: item.id,
            badge: key === "major_action" ? "Major" : key === "minor_action" ? "Minor" : key === "passive" ? "Passive" : "",
            cite: core(156),
        }));
    }
    return [
        ["major_action", "Major action"],
        ["minor_action", "Minor action"],
        ["passive", "Passive"],
        ["other", "Activation not set"],
    ].filter(([key]) => buckets[key].length).map(([key, heading]) => ({ heading, choices: buckets[key] }));
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

function secondBarrelSection(actor, item) {
    const plans = secondWeaponPlans(item);
    if (!plans.length) return null;
    return {
        heading: "Second weapon",
        note: "Eden keeps one fire-mode list on this gun. Add the launcher or shotgun as its own gear item, then attack with that item.",
        choices: plans.map((plan) => {
            const existing = findByGenesis(actor, plan.genesisID);
            if (existing) {
                const kind = classifyGear(existing);
                const modes = enabledFireModes(existing.system);
                const ranged = kind === "firearm" || kind === "thrown" || kind === "special" || kind === "gunnery";
                return choice(`Attack with ${existing.name}`, "Already on the sheet.", {
                    go: ranged && modes.length ? "fire-mode" : "attack-confirm",
                    itemId: existing.id,
                    kind: kind || "",
                    clear: "fireMode,burst,faArea",
                    cite: modes.length ? core(108) : core(104),
                });
            }
            return choice(`Add ${plan.name}`, plan.hint, {
                action: "provision",
                provision: plan.id,
                itemId: item.id,
                badge: "Add",
                cite: /launcher|grenade/i.test(plan.name) ? core(114) : core(108),
            });
        }),
    };
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
