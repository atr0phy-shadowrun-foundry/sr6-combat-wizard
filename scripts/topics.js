/**
 * Static guide pages. Wording is original. Printed pages are the Berlin core
 * book unless `book` is `companion`.
 */

const core = (page) => ({ book: "core_berlin", page, label: "Core" });
const companion = (page) => ({ book: "companion", page, label: "Companion" });

function topic(title, kicker, lead, blocks, extra = {}) {
    return { title, kicker, lead, blocks, ...extra };
}

function rules(heading, paragraphs, cite) {
    return { tone: "rules", heading, paragraphs, cite };
}

function eden(paragraphs) {
    return { tone: "eden", heading: "On the Eden sheet", paragraphs };
}

function gap(paragraphs) {
    return { tone: "gap", heading: "What you still settle at the table", paragraphs };
}

export const TOPICS = {
    dodge: topic(
        "Dodge",
        "Minor · anytime",
        "Add Athletics to one Defense test this turn.",
        [
            rules("What it changes", [
                "Declare it before the Defense test. It costs a minor action, and you can take it when it is not your turn if you still have the minor action.",
                "The dice go on one Defense test. They do not linger for the rest of the round.",
            ], core(42)),
            eden([
                "The defender's roll is the Defense button on the attack card in chat. Add your Athletics rank in that dialog's modifier.",
                "There is no Dodge button that remembers the minor action. Mark a minor on the tally above.",
            ]),
            gap([
                "If the world is using You Can't Dodge Bullets, Dodge moves the attack's threshold instead of adding dice. The numbers are on Companion pp. 151–152. Type the change into the attack dialog. Eden already adds one threshold point per range band past Close.",
            ]),
        ],
    ),
    block: topic(
        "Block",
        "Minor · anytime",
        "Add Close Combat to one melee Defense test this turn.",
        [
            rules("What it changes", [
                "Same timing as Dodge, and only against a melee attack.",
            ], core(42)),
            eden([
                "On the Defense button of that melee attack, add your Close Combat rank in the modifier.",
            ]),
            gap([
                "The Wrest Edge action replaces this defense with Close Combat + Agility against the attacker's Strength. That action is not in Eden's Edge list. See Edge in this wizard.",
            ]),
        ],
    ),
    "full-defense": topic(
        "Full Defense",
        "Major · anytime",
        "Add Willpower to every Defense test until the round ends.",
        [
            rules("What it changes", [
                "This spends the major action. The Willpower dice stay on Defense tests through the end of the round, not only the next one.",
            ], core(42)),
            eden([
                "Each Defense dialog needs the Willpower dice typed into the modifier. Eden does not attach Full Defense to the token.",
                "Mark a major on the tally.",
            ]),
        ],
    ),
    "hit-the-dirt": topic(
        "Hit the Dirt",
        "Minor · anytime",
        "Dive prone. +2 Defense dice, then a penalty on your own tests.",
        [
            rules("What it changes", [
                "You gain Prone. The +2 Defense dice apply to the incoming attack you are diving from.",
                "You take −2 dice on active skill tests until the end of your next turn, unless you Stand Up before then.",
            ], core(42)),
            eden([
                "Mark Prone on the token. The Prone status is a marker. It does not add the +2 or the later −2.",
                "Type +2 on the Defense dialog, and −2 on your later skill and attack dialogs until you stand.",
            ]),
            gap([
                "Tactical Roll is a 1-Edge action on Hit the Dirt. It drops the prone penalty on the melee attack that round, and the prone penalty against Close and Near attacks next round. It is not in Eden's Edge list.",
            ]),
        ],
        {
            choices: [
                { label: "Mark Prone on your token", action: "status", status: "prone", hint: "Toggles the Prone status Eden already ships." },
            ],
        },
    ),
    avoid: topic(
        "Avoid Incoming",
        "Minor · anytime",
        "Get out of a blast or a gas cloud.",
        [
            rules("What it changes", [
                "Roll Reaction + Athletics, minus the dodge penalty if you have one. You move a number of meters equal to your hits, away from the blast or the gas.",
                "You cannot Sprint in the same turn.",
            ], core(43)),
            eden([
                "The button below opens a normal roll dialog whose pool is Reaction + Athletics, including the untrained penalty if Athletics is 0.",
                "Put the dodge penalty in the modifier. Move the token by the hits you roll. Eden does not move it.",
            ]),
        ],
        {
            launch: { type: "pool", pool: "avoid", label: "Roll Reaction + Athletics" },
        },
    ),
    intercept: topic(
        "Intercept",
        "Minor · anytime",
        "A melee attack out of turn when someone enters Close range.",
        [
            rules("What it changes", [
                "You need a minor action and a major action still available. The major action is the attack.",
                "It happens when they enter Close, before they finish the move that brought them there.",
            ], core(43)),
            eden([
                "Go back and run the melee attack from this wizard. Mark both a minor and a major on the tally.",
                "Nothing on the sheet checks that they entered Close, or that you had both actions.",
            ]),
        ],
    ),
    move: topic(
        "Move",
        "Minor · your turn",
        "10 meters. Once per turn.",
        [
            rules("What it changes", [
                "Move is a minor action on your turn. It does not roll.",
                "You do not also Sprint or Avoid Incoming in that turn.",
            ], core(41)),
            eden([
                "Drag the token. A Foundry scene grid is whatever the scene uses, so count 10 meters yourself.",
                "Mark a minor. The sheet will still let you move the token again.",
            ]),
        ],
    ),
    sprint: topic(
        "Sprint",
        "Major · your turn",
        "15 meters, plus 1 meter per hit on Athletics + Agility.",
        [
            rules("What it changes", [
                "Sprint is a major action. It replaces Move. You do not Avoid Incoming in the same turn.",
            ], core(42)),
            eden([
                "The button rolls Athletics. If the sheet's Athletics specialization or expertise is Sprinting, Eden adds those dice.",
                "Move the token 15 meters plus 1 meter per hit. Mark a major.",
            ]),
        ],
        {
            launch: { type: "skill", skill: "athletics", spec: "sprinting", label: "Roll Athletics (Sprinting)" },
        },
    ),
    "take-cover": topic(
        "Take Cover",
        "Minor · your turn",
        "You are in Cover I, II, III, or IV.",
        [
            rules("What it changes", [
                "Cover is a status with a rank. The rank is how much of you is hidden, and it feeds Defense Rating and some Edge comparisons. The cover ranks are on printed p. 52.",
            ], core(41)),
            eden([
                "The token status Cover has four levels. Set the level to the rank you claimed. Eden does not ask which obstacle you used, and it does not add the rank to a Defense roll by itself.",
                "When Attack Rating is compared with Defense Rating, tell the table the cover rank if the sheet's Defense Rating does not already include it.",
            ]),
        ],
    ),
    "take-aim": topic(
        "Take Aim",
        "Minor · your turn",
        "+1 die on the attack. Once per round, and it can stack.",
        [
            rules("What it changes", [
                "The bonus is +1 die the first time this round. If you keep aiming at the same target, or you attack that target, the bonus can stack up to your Willpower.",
                "A scope's bonus waits until you have taken this action.",
            ], core(41)),
            eden([
                "Type the aim dice into the attack dialog's modifier when you fire or swing.",
                "Eden does not remember aim from round to round, and a scope on the weapon is only dice if the item or a mod already added them.",
            ]),
        ],
    ),
    "drop-prone": topic(
        "Drop Prone",
        "Minor · your turn",
        "Go prone without the Hit the Dirt bonus.",
        [
            rules("What it changes", [
                "This is the plain minor action. It does not grant the +2 Defense dice from Hit the Dirt.",
            ], core(41)),
            eden([
                "Mark Prone. Later tests that care about prone get their penalty typed into the dialog.",
            ]),
        ],
        {
            choices: [
                { label: "Mark Prone on your token", action: "status", status: "prone" },
            ],
        },
    ),
    "stand-up": topic(
        "Stand Up",
        "Minor · your turn",
        "Leave prone.",
        [
            rules("What it changes", [
                "Standing up ends the Hit the Dirt penalty early if that penalty was still on you.",
            ], core(41)),
            eden([
                "Clear Prone on the token. Stop typing the −2 from Hit the Dirt on later rolls.",
            ]),
        ],
        {
            choices: [
                { label: "Clear or toggle Prone", action: "status", status: "prone" },
            ],
        },
    ),
    "drop-object": topic(
        "Drop Object",
        "Minor · anytime",
        "Let go of something in your hand.",
        [
            rules("What it changes", [
                "It is automatic. It does not roll.",
            ], core(41)),
            eden([
                "The sheet has no hands. Say what you dropped in chat and mark a minor.",
            ]),
        ],
    ),
    "pick-up": topic(
        "Pick Up / Put Down Object",
        "Major · your turn",
        "Take something from the scene, or stow something carefully.",
        [
            rules("What it changes", [
                "This is the major action. Dropping is the cheaper minor.",
            ], core(43)),
            eden([
                "Drag an item in Foundry if you are moving it between actors. The action cost is still the tally.",
            ]),
        ],
    ),
    "ready-weapon": topic(
        "Ready Weapon",
        "Major · your turn",
        "Draw a weapon or put one away.",
        [
            rules("What it changes", [
                "A weapon that is not already in hand takes this major action before it can attack, unless Quick Draw applies.",
            ], core(43)),
            eden([
                "Gear is not marked in-hand or stowed. Every weapon on the sheet can open an attack roll.",
                "Agree at the table which items are in hand. Mark the major if this draw was required.",
            ]),
        ],
    ),
    "quick-draw": topic(
        "Quick Draw",
        "Minor · your turn",
        "Draw a pistol, a taser, or a small melee weapon and attack with it.",
        [
            rules("What it changes", [
                "Quick Draw is a minor that rides with the attack. The weapon has to be the kind the action allows, and it has to be where you can reach it.",
            ], core(41)),
            eden([
                "Run the attack from this wizard. Mark a minor for the draw and a major for the attack.",
                "The sheet will not refuse a rifle or a weapon that was in a bag.",
            ]),
        ],
    ),
    "call-shot": topic(
        "Call a Shot",
        "Minor · with an attack",
        "+2 damage and −4 dice, unless an Edge action changes the penalty.",
        [
            rules("What it changes", [
                "You declare it with the attack. The −4 is on your pool. The +2 is on the Damage Value before soak.",
                "Shank makes a melee called shot −2 instead of −4. Called Shot (Vitals) is a different Edge action.",
            ], core(42)),
            eden([
                "Type −4 in the attack dialog's modifier (or −2 if Shank applies).",
                "After the attack hits, add 2 to the Damage Value before the defender soaks. The dialog has no called-shot damage field.",
            ]),
        ],
    ),
    "multiple-attacks": topic(
        "Multiple Attacks",
        "Minor · with an attack",
        "Split one attack pool across more than one attack.",
        [
            rules("What it changes", [
                "The minor is spent with the Attack major. Split the pool evenly, rounding down. Two different attacks can be half and half, still rounding down.",
                "Anticipation, the 4-Edge action, doubles a ranged pool before the split.",
            ], core(42)),
            eden([
                "Open one attack roll per swing or burst, and set each pool to the split number with the modifier.",
                "Wide burst and full auto are the fire modes Eden checks against the number of targeted tokens. A split melee attack is not one of those checks.",
            ]),
        ],
    ),
    "off-hand": topic(
        "Off-hand weapon",
        "With an attack",
        "A weapon in the off hand is harder to use.",
        [
            rules("What it changes", [
                "The off-hand penalty, and the rest of that close-combat cluster (knockdown, grapple, several people on one target), is on printed pp. 110–111.",
            ], core(110)),
            eden([
                "Weapons have a dual-hand flag used by the high-strength recoil setting. They do not have an off-hand penalty.",
                "Type the off-hand penalty into the attack modifier.",
            ]),
        ],
    ),
    knockdown: topic(
        "Knockdown",
        "After a melee hit",
        "A hard hit can put the target on the ground.",
        [
            rules("What it changes", [
                "The knockdown test is in the close-combat section, printed pp. 110–111. Read that line before calling someone prone.",
            ], core(110)),
            eden([
                "A successful melee card does not offer a knockdown test, and it does not mark Prone on the target.",
            ]),
        ],
    ),
    grapple: topic(
        "Grapple",
        "Melee attack",
        "Grab and hold instead of dealing a normal hit.",
        [
            rules("What it changes", [
                "Grapple is part of the same close-combat cluster, printed pp. 110–111. It is an attack, then a state the two characters are in.",
            ], core(110)),
            eden([
                "There is no grapple item, status, or opposed button. Roll the unarmed or martial-arts attack if you want the dice, then track the hold in chat.",
                "Martial art techniques on the sheet are reference items. Opening one does not roll the grapple.",
            ]),
        ],
    ),
    counterspell: topic(
        "Counterspell",
        "Major · anytime",
        "Spend the major action to oppose a spell as it is cast.",
        [
            rules("What it changes", [
                "Counterspelling is a Sorcery specialization. The opposed dispel is on printed pp. 143–144.",
            ], core(143)),
            eden([
                "The button rolls Sorcery with the Counterspelling specialization if the sheet has it.",
                "Two tokens cannot finish dispel, drain for the counter, or the spell fizzling. Compare hits in chat and apply the book.",
            ]),
        ],
        {
            launch: { type: "skill", skill: "sorcery", spec: "counterspelling", label: "Roll Sorcery (Counterspelling)" },
        },
    ),
    summon: topic(
        "Summon Spirit",
        "Major · your turn",
        "Conjuring + Magic, then services, then drain.",
        [
            rules("What it changes", [
                "Summoning is a major action. Services and the spirit's arrival are on printed pp. 146–149.",
            ], core(146)),
            eden([
                "The button rolls Conjuring. If the sheet's specialization is Summoning, those dice are included.",
                "Eden does not spawn the spirit, store services, or roll conjuring drain as part of this test. Drain resistance is tradition attribute + Willpower, the same shape as spell drain, and you roll it separately.",
            ]),
        ],
        {
            launch: { type: "skill", skill: "conjuring", spec: "summoning", label: "Roll Conjuring (Summoning)" },
        },
    ),
    "command-spirit": topic(
        "Command Spirit",
        "Minor · your turn",
        "Spend a service the spirit already owes.",
        [
            rules("What it changes", [
                "Command Spirit is a minor action. It spends a service. It does not roll unless the order itself is a test.",
            ], core(41)),
            eden([
                "Spirit actors can exist on the canvas, and nothing on them counts services down when you give an order.",
                "Say the order in chat and mark a minor. If the spirit attacks, open this wizard on the spirit's token.",
            ]),
        ],
    ),
    banish: topic(
        "Banish Spirit",
        "Major · your turn",
        "Any character may attempt it. It is Conjuring opposed by the spirit.",
        [
            rules("What it changes", [
                "Banishing is a major action. The opposed test and the drain are on printed pp. 146–149.",
            ], core(146)),
            eden([
                "The button is a Conjuring roll. Target the spirit first if you want the card to name them.",
                "The spirit does not get an automated opposed roll from this button, and drain is a separate resistance test.",
            ]),
        ],
        {
            launch: { type: "skill", skill: "conjuring", spec: "banishing", label: "Roll Conjuring (Banishing)" },
        },
    ),
    focus: topic(
        "Activate a Focus",
        "Minor · your turn",
        "Turn a bonded focus on.",
        [
            rules("What it changes", [
                "Activating a focus is a minor action for an awakened character. The focus rules start on printed p. 151.",
            ], core(151)),
            eden([
                "Focus items sit on the sheet with a rating. Nothing toggles them active, and nothing adds their dice until a roll modifier or an effect does.",
                "Say which focus is on, mark a minor, and type its bonus into the next roll if the effect is not already an active effect.",
            ]),
        ],
    ),
    perception: topic(
        "Observe in Detail",
        "Major · your turn",
        "A careful look. Perception + Intuition.",
        [
            rules("What it changes", [
                "Observe in Detail is the major action for a thorough look. A quick glance is not this action.",
            ], core(43)),
            eden([
                "The button rolls Perception. Threshold is the gamemaster's. Type it into the dialog.",
            ]),
        ],
        {
            launch: { type: "skill", skill: "perception", label: "Roll Perception" },
        },
    ),
    "shift-perception": topic(
        "Shift Perception",
        "Minor · your turn",
        "Switch between astral and physical perception.",
        [
            rules("What it changes", [
                "Assensing and astral perception are on printed pp. 159–161. Shifting is a minor action for someone who can perceive astrally.",
            ], core(159)),
            eden([
                "There is no perception toggle that changes which initiative track you are on. The combat tracker stores physical, matrix, or astral on the combatant, and someone sets that by hand.",
                "Mark a minor. Assensing rolls are Astral + Intuition from the skill list if you need the dice.",
            ]),
        ],
    ),
    "astral-projection": topic(
        "Astral Projection",
        "Major · your turn",
        "Leave the body and act on the astral.",
        [
            rules("What it changes", [
                "Projection, astral combat, and astral barriers are on printed pp. 159–161. Astral initiative uses its own dice.",
            ], core(159)),
            eden([
                "The sheet stores an astral initiative pool. The combatant flag `iniType` has to be astral before the tracker uses it.",
                "Astral combat is not a finished attack-and-damage path between two tokens. Use the astral attributes and agree the damage track in chat.",
            ]),
        ],
    ),
    assist: topic(
        "Assist",
        "Major · anytime",
        "A teamwork test. Your hits become dice on someone else's roll.",
        [
            rules("What it changes", [
                "You declare Assist before the leader acts, and you roll the same test they will roll. Your hits become extra dice, up to the leader's skill rank.",
                "The leader spends their half of the work on their next turn.",
            ], core(36)),
            eden([
                "Roll the same skill the leader is about to use, from the skill list in this wizard. Tell them the hits.",
                "Their dialog has a modifier. They type your hits in, capped at their rank. Eden does not move the dice across.",
            ]),
        ],
    ),
    heal: topic(
        "First Aid",
        "Major, usually",
        "Biotech + Logic. Then the boxes actually come off.",
        [
            rules("What it changes", [
                "First aid, medkits, magic, and natural recovery are on printed pp. 118–121. First aid is a test against a threshold built from the wounds.",
            ], core(118)),
            eden([
                "The button rolls Biotech. Use the First Aid specialization if the sheet has it.",
                "Nothing on the card removes Physical or Stun boxes. The healer, or the gamemaster, edits the monitor after the hits are known. Medkits are gear, and using one is the same kind of manual step.",
            ]),
        ],
        {
            launch: { type: "skill", skill: "biotech", spec: "first_aid", label: "Roll Biotech (First Aid)" },
        },
    ),
    "use-device": topic(
        "Use Simple Device",
        "Major · your turn",
        "A commlink, a maglock, a tool that is not its own attack.",
        [
            rules("What it changes", [
                "If the device has a skill test, it uses that skill. If it is truly simple, it is automatic and still costs the major action.",
            ], core(43)),
            eden([
                "Electronics, Engineering, and the other skills are in the skill list. Pick the one the device names.",
                "There is no generic Use Device button, and locks and sensors are not a mini-game on the item.",
            ]),
        ],
    ),
    "command-drone": topic(
        "Command Drone",
        "Minor · your turn",
        "Tell a drone to do something with a service it can already perform.",
        [
            rules("What it changes", [
                "Command Drone is a minor action. Jumping into the drone is the major action Rigger Jump In.",
            ], core(41)),
            eden([
                "Drone tokens are actors. Open this wizard with the drone selected if the drone is the one attacking, and use Gunnery for a vehicle-mounted weapon.",
                "Nothing spends a drone command or checks the RCC.",
            ]),
        ],
    ),
    "jump-in": topic(
        "Rigger Jump In",
        "Major · your turn",
        "You take over a vehicle or a drone.",
        [
            rules("What it changes", [
                "Jumping in is a major action. Rigging, the RCC, and jumped-in initiative sit on printed pp. 196–201.",
            ], core(196)),
            eden([
                "Vehicle sheets have a control mode (manual, rigged, RCC, autonomous). Set that mode on the vehicle.",
                "This wizard does not switch the mode or move your persona into the vehicle. After you are jumped in, attack with the vehicle's weapons from the Gunnery list.",
            ]),
        ],
    ),
    "burning-edge": topic(
        "Burning Edge",
        "Not a normal spend",
        "Edge rank drops by 1, and every stored point is gone.",
        [
            rules("What it does", [
                "Smackdown is an automatic success with four net hits, on a test the character can attempt.",
                "Not Dead Yet survives an imminent killing blow and does not clear the danger.",
                "Burned rank can be bought back with Karma later.",
            ], core(48)),
            eden([
                "The sheet will not burn a point of Edge attribute or empty the pool because you asked for Smackdown.",
                "Edit the Edge attribute and the current Edge points, then apply the success or the survival in chat.",
            ]),
        ],
    ),
};

export const EDGE_BOOSTS = {
    reroll_one: {
        cost: 1,
        when: "After the roll",
        text: "Reroll one die, yours or an opponent's. The new face stands.",
    },
    plus_3_ini: {
        cost: 1,
        when: "Before the fight, or to move up next cycle",
        text: "Add 3 to your Initiative Score.",
    },
    plus_1_roll: {
        cost: 2,
        when: "Any time",
        text: "Add 1 to a single die face.",
    },
    give_ally_1_edge: {
        cost: 2,
        when: "Any time",
        text: "You spend 2 Edge. An ally gains 1.",
    },
    negate_1_edge: {
        cost: 2,
        when: "Before the roll",
        text: "Remove 1 Edge from a foe.",
    },
    buy_auto_hit: {
        cost: 3,
        when: "Any time",
        text: "Buy one extra hit. It is not an automatic success.",
    },
    heal_1_stun: {
        cost: 3,
        when: "Any time",
        text: "Heal 1 Stun box.",
    },
    add_edge_pool: {
        cost: 4,
        when: "Before the roll",
        text: "Add your Edge attribute to the pool and explode 6s. A 1 on an exploded reroll does not count toward a glitch.",
    },
    heal_1_physic: {
        cost: 4,
        when: "Any time",
        text: "Heal 1 Physical box.",
    },
    reroll_failed: {
        cost: 4,
        when: "After the roll",
        text: "Reroll every failed die. You cannot do this on a glitch or a critical glitch.",
    },
    count_2_glitch: {
        cost: 5,
        when: "Before their roll",
        text: "The opponent's 1s and 2s both count toward a glitch.",
    },
    create_special: {
        cost: 5,
        when: "Any time",
        text: "A special story effect, agreed with the gamemaster.",
    },
};

export const EDGE_ACTIONS = {
    shank: {
        cost: 1,
        inDialog: true,
        attached: "Melee attack",
        text: "A called shot's penalty becomes −2 instead of −4.",
    },
    sudden_insight: {
        cost: 1,
        inDialog: false,
        attached: "Any untrained skill you can legally attempt",
        text: "Use a skill you have no ranks in, when the skill allows untrained use.",
    },
    tactical_roll: {
        cost: 1,
        inDialog: false,
        attached: "Hit the Dirt",
        text: "Drops the prone and Hit the Dirt penalties on the melee attack that round, and the prone penalty against Close and Near attacks next round.",
    },
    tumble: {
        cost: 1,
        inDialog: false,
        attached: "Melee attack",
        text: "If the damage exceeds the target's Body, they gain Prone.",
    },
    bring_the_drama: {
        cost: 2,
        inDialog: true,
        attached: "Con",
        text: "A short con can take 200 nuyen from onlookers. A longer con can raise the asking price 20 percent.",
    },
    fire_from_cover: {
        cost: 2,
        inDialog: true,
        attached: "Ranged attack in Cover IV",
        text: "Fire from Cover IV without the minor action you would normally spend to lean out.",
    },
    knockout_blow: {
        cost: 2,
        inDialog: true,
        attached: "Melee attack",
        text: "If damage of any type exceeds Willpower, the Stun monitor fills. It does not overflow into Physical.",
    },
    wrest: {
        cost: 2,
        inDialog: false,
        attached: "Block",
        text: "Close Combat + Agility against the attacker's Strength. Equal hits disarms. More hits take the weapon.",
    },
    anticipation: {
        cost: 4,
        inDialog: true,
        attached: "Multiple Attacks, ranged",
        text: "Double the full pool, then split it.",
    },
    big_speech: {
        cost: 4,
        inDialog: true,
        attached: "Influence",
        text: "Roll twice. The first roll is a teamwork test for the second.",
    },
    called_shot_disarm: {
        cost: 5,
        inDialog: true,
        attached: "Any attack",
        text: "No damage. The weapon leaves their hands.",
    },
    called_shot_vitals: {
        cost: 5,
        inDialog: true,
        attached: "Any attack",
        text: "+3 damage on a hit, in addition to the usual net hits. This replaces the ordinary called-shot +2.",
    },
};
