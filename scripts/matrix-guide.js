/**
 * Hand-holding Matrix runbook pages for the turn wizard.
 * Home "In the Matrix" points here (mx-hub) instead of the old state-matrix hub.
 */

import { lacksMatrixDevice } from "./launch.js";

const ACCESS_SUBTYPES = new Set([
    "COMMLINK", "CYBERDECK", "CYBERJACK", "RIGGER_CONSOLE", "DATATERM", "CYBERTERM",
]);

const MODE_COPY = {
    ar: {
        label: "AR",
        hint: "Augmented reality. Meat body still acts; Matrix init stays light.",
        matrixIni: "ar",
        vr: false,
    },
    vrcold: {
        label: "Cold-sim VR",
        hint: "Filtered VR. Dumpshock is Stun if you disconnect dirty.",
        matrixIni: "vrcold",
        vr: true,
    },
    vrhot: {
        label: "Hot-sim VR",
        hint: "Unfiltered VR. Dumpshock is Physical; illegal in most places.",
        matrixIni: "vrhot",
        vr: true,
    },
};

/** Keys cleared when leaving the Matrix guide back toward home. */
export const MX_CLEAR = "deviceId,matrixMode,hostUuid,matrixIntent,matrixId,pool,kind,itemId,osDelta";

export function renderMatrixGuidePage(pageId, actor, data = {}) {
    if (pageId === "state-matrix" || pageId === "mx-hub") return mxHubPage(actor, data);
    if (pageId === "mx-persona") return mxPersonaPage(actor, data);
    if (pageId === "mx-mode") return mxModePage(actor, data);
    if (pageId === "mx-prep") return mxPrepPage(actor, data);
    if (pageId === "mx-techno") return mxTechnoPage(actor, data);
    if (pageId === "mx-target") return mxTargetPage(actor, data);
    if (pageId === "mx-intent") return mxIntentPage(actor, data);
    if (pageId === "mx-confirm") return mxConfirmPage(actor, data);
    if (pageId === "mx-os") return mxOsPage(actor, data);
    return null;
}

export async function applyMatrixDevice(actor, deviceId) {
    if (!actor?.isOwner && !game.user.isGM) {
        ui.notifications.warn("Only an owner or GM can set the Matrix access device.");
        return false;
    }
    if (deviceId === "living") {
        if (!actor.isTechno && !actorGates(actor).resonance) {
            ui.notifications.warn("Living persona is for technomancers.");
            return false;
        }
        // Clear decker access ticks; living persona does not need usedForPool.
        const updates = matrixDevices(actor)
            .filter((item) => item.system.usedForPool)
            .map((item) => ({ _id: item.id, "system.usedForPool": false }));
        if (updates.length) await actor.updateEmbeddedDocuments("Item", updates);
        ui.notifications.info(`${actor.name} is connecting with a living persona.`);
        return true;
    }
    const item = actor.items.get(deviceId);
    if (!item || !isMatrixAccessItem(item)) {
        ui.notifications.warn("That item cannot access the Matrix.");
        return false;
    }
    await item.update({ "system.usedForPool": true });
    ui.notifications.info(`${item.name} is now the Matrix access device.`);
    return true;
}

export async function applyMatrixMode(actor, matrixMode) {
    if (!actor?.isOwner && !game.user.isGM) {
        ui.notifications.warn("Only an owner or GM can set Matrix mode.");
        return false;
    }
    const mode = MODE_COPY[matrixMode];
    if (!mode) {
        ui.notifications.warn("Pick AR, cold-sim, or hot-sim.");
        return false;
    }
    await actor.update({ "system.matrixIni": mode.matrixIni });
    if (mode.vr) await setCombatantIniType(actor, "matrix");
    else await setCombatantIniType(actor, "physical");
    ui.notifications.info(`${actor.name} interface mode → ${mode.label}.`);
    return true;
}

export async function bumpOverwatch(actor, delta) {
    if (!actor?.isOwner && !game.user.isGM) {
        ui.notifications.warn("Only an owner or GM can change Overwatch Score.");
        return false;
    }
    const current = Number(actor.system.overwatch) || 0;
    const next = Math.max(0, current + (Number(delta) || 0));
    await actor.update({ "system.overwatch": next });
    ui.notifications.info(`Overwatch Score → ${next}${next >= 40 ? " (Convergence threshold)" : ""}.`);
    return true;
}

export async function setOverwatch(actor, value) {
    if (!actor?.isOwner && !game.user.isGM) {
        ui.notifications.warn("Only an owner or GM can change Overwatch Score.");
        return false;
    }
    const next = Math.max(0, Math.floor(Number(value) || 0));
    await actor.update({ "system.overwatch": next });
    ui.notifications.info(`Overwatch Score set to ${next}.`);
    return true;
}

function mxHubPage(actor, data) {
    const gates = actorGates(actor);
    const summary = personaSummary(actor);
    return {
        kicker: "Special state · Matrix guide",
        title: "In the Matrix",
        lead: "Work the Grid step by step: choose how you connect, set your sim mode, pick a target, then take the action. The wizard opens Eden's roll when the sheet can finish it.",
        leadCite: core(174),
        notice: gates.matrix
            ? summary
            : "You need a connected Matrix device, or a living persona if you are a technomancer. The next page sets that.",
        infoFirst: true,
        groups: [{
            heading: "Start the run",
            choices: [
                choice("Connect and act", "Persona → mode → prep → target → intent.", {
                    go: "mx-persona", clear: MX_CLEAR, cite: core(174),
                }),
                choice("Already online — pick an action", "Skip setup if the sheet already has a device and mode.", {
                    go: "mx-intent", cite: core(179), dim: !gates.matrix,
                }),
            ],
        }],
        blocks: [
            block("rules", "Four steps on a Matrix test", [
                "Legal actions use Electronics + Logic. Illegal actions use Cracking + Logic.",
                "Attack Rating is Attack + Sleaze. Defense Rating is Data Processing + Firewall. A gap of 4 or more awards Edge to the higher side.",
                "Roll hits. Then apply that action's effect.",
            ], core(175), { guide: true }),
            block("rules", "Dumpshock and link-lock", [
                "A dirty disconnect from VR is dumpshock: 3 Stun in cold-sim, 3 Physical in hot-sim, resisted with Willpower. For (10 − Willpower) minutes you cannot gain or spend Edge.",
                "Link-lock blocks Enter/Exit Host, Reboot Device, and Switch Interface Mode on your access device. Jack Out is still the way off, and it usually still dumpshocks.",
            ], core(176)),
            edenBlock([
                "Set the combatant initiative type to matrix when this pass is a Matrix pass. The tally at the top follows that flag.",
                "Technomancers need no access device. Everyone else needs a Matrix device online and marked for the pool before Eden will open a Matrix roll.",
            ]),
        ],
    };
}

function mxPersonaPage(actor, data) {
    const gates = actorGates(actor);
    const devices = matrixDevices(actor);
    const access = actor.system?.persona?.accessDevice;
    const currentId = access?.id || (actor.isTechno || gates.resonance ? "living" : "");
    const deviceChoices = devices.map((item) => choice(
        item.name,
        [
            subtypeLabel(item),
            item.system.usedForPool || item.id === access?.id ? "Currently used for the pool" : "Offline for the pool",
        ].filter(Boolean).join(" · "),
        {
            action: "mx-device",
            deviceId: item.id,
            badge: item.id === currentId ? "Active" : "",
            cite: core(174),
        },
    ));
    if (actor.isTechno || gates.resonance) {
        deviceChoices.unshift(choice(
            "Living persona",
            "Technomancer ASDF from Charisma, Intuition, Logic, and Willpower, plus Resonance.",
            {
                action: "mx-device",
                deviceId: "living",
                badge: currentId === "living" || (!access && (actor.isTechno || gates.resonance)) ? "Active" : "",
                cite: core(189),
            },
        ));
    }
    return {
        kicker: "Matrix guide · 1 of 5",
        title: "How are you connecting?",
        lead: "Pick the device that builds your persona, or a living persona if you are a technomancer. Eden builds Matrix rolls from that choice.",
        leadCite: core(174),
        notice: personaSummary(actor),
        groups: [{
            heading: "Access",
            choices: deviceChoices.length ? deviceChoices : [
                choice("No access device on the sheet", "Add a commlink, cyberdeck, cyberjack, RCC, or similar, then return.", {
                    disabled: true,
                }),
            ],
        }],
        blocks: [
            block("rules", "Persona", [
                "Mental attributes stay. Physical attributes become Attack, Sleaze, Data Processing, and Firewall.",
                "A decker takes ASDF from the device in use. A missing attribute counts as 0.",
            ], core(174), { guide: true }),
            ...(gates.resonance ? [block("rules", "Living persona", [
                "Attack from Charisma, Sleaze from Intuition, Data Processing from Logic, Firewall from Willpower. Resonance adds capped bonus points.",
            ], core(189))] : []),
            edenBlock([
                "Ticking a device for the pool turns other access devices off. Wireless follows that tick on Eden gear.",
            ]),
        ],
    };
}

function mxModePage(actor, data) {
    const current = actor.system?.matrixIni || "ar";
    return {
        kicker: "Matrix guide · 2 of 5",
        title: "What mode are you in?",
        lead: "Choose AR, cold-sim VR, or hot-sim VR before you act. This sets the sheet's Matrix initiative mode and, in combat, the combatant Matrix flag for VR.",
        leadCite: core(184),
        notice: `Sheet mode now: ${MODE_COPY[current]?.label || current}.`,
        groups: [{
            heading: "Interface mode",
            choices: Object.entries(MODE_COPY).map(([id, mode]) => choice(mode.label, mode.hint, {
                action: "mx-mode",
                matrixMode: id,
                badge: current === id ? "Current" : mode.vr ? "VR" : "AR",
                cite: core(184),
            })),
        }],
        blocks: [
            block("rules", "Sim and dumpshock", [
                "Cold-sim is filtered. Hot-sim is unfiltered and carries Physical dumpshock on a dirty exit.",
                "Switch Interface Mode is the formal action when you change mid-run; link-lock can block a clean switch.",
            ], core(176), { guide: true }),
            edenBlock([
                "Eden stores mode on system.matrixIni (ar, vrcold, vrhot). Biofeedback and dumpshock paths read that field.",
            ]),
        ],
    };
}

function mxPrepPage(actor, data) {
    const gates = actorGates(actor);
    const forms = actor.items.filter((item) => item.type === "complexform");
    return {
        kicker: "Matrix guide · 3 of 5",
        title: "Anything before you connect?",
        lead: "Reconfigure ASDF if you need a different Attack or Sleaze lead. Technomancers can thread a form or compile a sprite before pointing at a host.",
        leadCite: core(183),
        notice: personaSummary(actor),
        groups: [
            {
                heading: "Continue",
                choices: [
                    choice("Choose a target", "Host, device, or open Grid.", {
                        go: "mx-target", cite: core(185),
                    }),
                ],
            },
            {
                heading: "Reconfigure",
                choices: [
                    choice("Reconfigure Matrix Attribute", "Rotate Attack, Sleaze, Data Processing, or Firewall on the persona.", {
                        go: "mx-confirm",
                        matrixId: "reconfigure",
                        kind: "matrix",
                        matrixIntent: "other",
                        badge: "Minor",
                        cite: core(183),
                    }),
                ],
            },
            ...(gates.resonance || forms.length ? [{
                heading: "Technomancer prep",
                choices: [
                    choice("Complex forms and sprites", "Thread a form or walk through compiling a sprite.", {
                        go: "mx-techno", cite: core(189),
                    }),
                ],
            }] : []),
        ],
        blocks: [
            block("rules", "Reconfigure", [
                "You can rearrange non-zero Matrix attributes on the persona. Living personas move Resonance bonuses under the same caps.",
            ], core(183), { guide: true }),
        ],
    };
}

function mxTechnoPage(actor, data) {
    const forms = actor.items.filter((item) => item.type === "complexform");
    const gates = actorGates(actor);
    return {
        kicker: "Matrix guide · technomancer",
        title: "Resonance prep",
        lead: "Thread a complex form, or compile a sprite before you lean on a host. Compiling is Tasking work; Eden does not spawn the sprite for you.",
        leadCite: core(189),
        notice: gates.resonance || forms.length
            ? ""
            : "You need Resonance for living-persona work. Complex forms are for technomancers.",
        groups: [
            {
                heading: "Complex forms",
                choices: [
                    choice("Thread a form on the sheet", forms.length ? `${forms.length} ready.` : "None on this sheet.", {
                        go: "forms", badge: "Major", cite: core(189), dim: !forms.length,
                    }),
                    choice("Look up a complex form", "Opens the shared catalog.", {
                        action: "browse-compendium", pack: "forms", cite: core(189),
                    }),
                ],
            },
            {
                heading: "Sprites",
                choices: [
                    choice("Compile a sprite (hand-hold)", "Tasking test, then add or import a sprite actor.", {
                        go: "mx-confirm",
                        matrixIntent: "compile",
                        kind: "compile",
                        badge: "Major",
                        cite: core(187),
                    }),
                    choice("Continue to target", "Skip sprite work for now.", {
                        go: "mx-target", cite: core(185),
                    }),
                ],
            },
        ],
        blocks: [
            block("rules", "Complex forms", [
                "Attack Rating is Electronics + Resonance. Resist fading with Willpower + Logic. Sustained forms cost −2 dice each.",
            ], core(189), { guide: true }),
            block("rules", "Compiling", [
                "Compiling, registering, and decompiling live with sprites in the Resonance chapter. Track tasks owned on the sprite sheet after the table agrees the compile stuck.",
            ], core(187)),
            edenBlock([
                "Complex forms launch through Eden's Resonance roll. Sprite actors exist in the system, but compile/register are not a one-click spawn from this wizard.",
            ]),
        ],
    };
}

function mxTargetPage(actor, data) {
    const candidates = matrixTargetCandidates();
    const selected = data.hostUuid;
    const choices = candidates.map((entry) => choice(
        entry.name,
        entry.hint,
        {
            go: "mx-intent",
            hostUuid: entry.uuid,
            badge: entry.uuid === selected ? "Selected" : entry.source,
            cite: core(185),
        },
    ));
    choices.push(choice("Open Matrix / no host yet", "Act on the Grid without entering a host.", {
        go: "mx-intent",
        hostUuid: "",
        clear: "hostUuid",
        cite: core(179),
    }));
    return {
        kicker: "Matrix guide · 4 of 5",
        title: "What are we pointing at?",
        lead: "Pick a host or device icon if you have one targeted or on the scene. Or stay on the open Grid.",
        leadCite: core(185),
        notice: selected
            ? `Stored target: ${labelForUuid(selected) || selected}`
            : (game.user.targets?.size
                ? "Foundry has a targeted token — it is offered below."
                : "No stored host yet."),
        groups: [{
            heading: "Targets",
            choices,
        }],
        blocks: [
            block("rules", "Hosts", [
                "Hosts are separate from the open Matrix. Enter Host puts your persona inside. Illegal User or Admin access raises Overwatch each round while you stay.",
            ], core(185), { guide: true }),
            edenBlock([
                "Target a token in Foundry when the action is opposed. One target feeds Eden's Matrix roll. Host actors use the host type when present in the world.",
            ]),
        ],
    };
}

function mxIntentPage(actor, data) {
    const gates = actorGates(actor);
    const hostNote = data.hostUuid
        ? `Target locked: ${labelForUuid(data.hostUuid) || "stored uuid"}.`
        : "No host stored — open Grid or target a token before opposed tests.";
    return {
        kicker: "Matrix guide · 5 of 5",
        title: "What do you want to do?",
        lead: "Common illegal and legal openers first. More actions open the full Eden list. Illegal work should return here to record Overwatch after the roll.",
        leadCite: core(179),
        notice: [personaSummary(actor), hostNote].filter(Boolean).join(" "),
        groups: [
            {
                heading: "Look and listen",
                choices: [
                    intentAction("matrix_perception", "perceive", "Spot icons, marks, and running silent."),
                    intentAction("matrix_search", "perceive", "Dig for a file or detail on the Grid."),
                ].filter(Boolean),
            },
            {
                heading: "Get access",
                choices: [
                    intentAction("probe", "probe", "Quiet extended path toward a backdoor."),
                    intentAction("brute_force", "brute", "Loud User or Admin access."),
                    intentAction("backdoor_entry", "other", "Finish a successful Probe."),
                    intentAction("enter_host", "enter_host", "Step into a host, or leave one."),
                ].filter(Boolean),
            },
            {
                heading: "Hygiene and exit",
                choices: [
                    intentAction("check_os", "check_os", "Ask GOD how loud you have been."),
                    intentAction("jack_out", "jack_out", "Hard exit. Dumpshock if you were in VR dirty."),
                    intentAction("switch_ifmode", "other", "Change AR / cold-sim / hot-sim mid-run."),
                ].filter(Boolean),
            },
            {
                heading: "More",
                choices: [
                    choice("All Matrix actions", "Full major/minor list from Eden.", {
                        go: "matrix", cite: core(179),
                    }),
                    choice("Complex forms", "Technomancer threading.", {
                        go: "forms", cite: core(189), dim: !gates.resonance,
                    }),
                    choice("Spend Edge", "Boosts and Edge actions on Matrix tests.", {
                        go: "edge", clear: "matrixId,matrixIntent", badge: "Edge", cite: core(44),
                    }),
                    choice("Record Overwatch now", "Skip straight to the OS pad.", {
                        go: "mx-os", cite: core(176),
                    }),
                ],
            },
        ],
        blocks: [
            block("rules", "Illegal work and Overwatch", [
                "An illegal action adds the defender's hits — every hit, not the net — to Overwatch Score. Convergence is at 40.",
                "Programs that modify an illegal action, and illegal User/Admin host access each round, also raise OS.",
            ], core(176), { guide: true }),
            ...(lacksMatrixDevice(actor) ? [noDeviceBlock(actor)] : []),
        ],
    };
}

function mxConfirmPage(actor, data) {
    if (data.kind === "compile" || data.matrixIntent === "compile") {
        return {
            kicker: "Compile sprite",
            title: "Compile a sprite",
            lead: "Make the Tasking test the table uses for compile, then create or import the sprite actor and set its level and tasks.",
            leadCite: core(187),
            groups: [{
                heading: "After the test",
                choices: [
                    choice("Back to prep", "Return without a roll from this page.", {
                        go: "mx-prep", cite: core(183),
                    }),
                    choice("Choose a target", "Continue the run.", {
                        go: "mx-target", cite: core(185),
                    }),
                ],
            }],
            blocks: [
                block("rules", "Compiling", [
                    "Sprites are Resonance companions with a level and tasks. Registering costs more work and keeps them longer.",
                ], core(187), { guide: true }),
                edenBlock([
                    "There is no compile-spawn button in Eden from this wizard. Add a sprite actor manually or from a compendium after the rolls succeed.",
                ]),
            ],
        };
    }

    if (data.kind === "form") {
        const item = actor.items.get(data.itemId);
        if (!item) {
            return {
                title: "That item is gone",
                lead: "It is no longer on the sheet. Go back and pick again.",
                groups: [],
                blocks: [],
            };
        }
        return {
            kicker: "Complex form",
            title: item.name,
            lead: "Target a persona, device, or host first when the form is opposed.",
            leadCite: core(189),
            groups: [{
                heading: "After you roll",
                choices: [
                    choice("Another Matrix action", "Back to intents.", {
                        go: "mx-intent", cite: core(179),
                    }),
                    choice("Thread another form", "Back to the form list.", {
                        go: "forms", cite: core(189),
                    }),
                ],
            }],
            blocks: [
                block("rules", "Fading", [
                    "Resist fading with Willpower plus Resonance. Leftover fading is Stun unless the form says otherwise. The complex-form chapter is printed pp. 187–195.",
                ], core(189), { guide: true }),
                edenBlock([
                    "Eden rolls the form and can offer the opposed test when the item has opposing attributes. Fading still needs the resistance roll from the card.",
                ]),
            ],
            launch: { type: "complexform", label: "Open the complex form roll" },
        };
    }

    const action = CONFIG.SR6.MATRIX_ACTIONS?.[data.matrixId];
    const name = actionNameMatrix(data.matrixId) || data.matrixId || "Matrix action";
    const hint = localizeOrEmpty(`shadowrun6.matrixaction.${data.matrixId}.hint`);
    const cite = matrixCite(data.matrixId) ?? core(179);
    const illegal = Boolean(action?.illegal);
    const noDevice = lacksMatrixDevice(actor);

    return {
        kicker: action?.major ? "Major matrix action" : "Minor matrix action",
        title: name,
        lead: action?.skill
            ? "Target the icon when the action is opposed. One Foundry target uses that icon. No target rolls it as a reference action."
            : "This action has no skill test. Eden posts the description to chat.",
        leadCite: cite,
        groups: [{
            heading: "After you roll",
            choices: [
                choice(
                    illegal ? "Record Overwatch" : "Overwatch pad",
                    illegal
                        ? "Illegal action — add the defender's hits to OS when the card resolves."
                        : "Check or adjust OS if something else raised it.",
                    {
                        go: "mx-os",
                        osDelta: illegal ? "1" : "0",
                        matrixIntent: data.matrixIntent || (illegal ? "other" : "check_os"),
                        cite: core(176),
                    },
                ),
                choice("Another Matrix action", "Back to intents.", {
                    go: "mx-intent", cite: core(179),
                }),
            ],
        }],
        blocks: [
            ...(noDevice ? [noDeviceBlock(actor)] : []),
            block("rules", "From the matrix action", [
                hint || "Read the action in the Matrix chapter, printed pp. 179–184.",
            ], cite, { guide: true }),
            block("rules", "Noise", [
                "Each point of noise is −1 die. If noise exceeds device rating, that device cannot reach the Matrix.",
            ], core(176)),
            edenBlock([
                illegal
                    ? "This action is illegal. Eden does not auto-add Overwatch from the roll — use the Overwatch page after defender hits are known."
                    : "Confirm whether this action is legal before you worry about Overwatch.",
                "Access level is outsider, user, or admin as a flag between documents. Brute Force can set that flag when its card resolves.",
            ]),
        ],
        launch: noDevice ? undefined : { type: "matrix", label: action?.skill ? "Open the matrix roll" : "Post this action to chat" },
    };
}

function mxOsPage(actor, data) {
    const os = Number(actor.system.overwatch) || 0;
    const suggested = Number(data.osDelta) || 0;
    return {
        kicker: "Matrix guide · Overwatch",
        title: "Record Overwatch Score",
        lead: "Illegal Matrix work piles OS on the persona. Convergence hits at 40: the device bricks, you dump, and your meat location is reported.",
        leadCite: core(176),
        notice: `Current OS: ${os}${os >= 40 ? " — at or over Convergence." : ""}.`,
        groups: [
            {
                heading: "Adjust",
                choices: [
                    choice(`Add ${Math.max(1, suggested)} (defender hits)`, "Use the defender's hits from the opposed roll, not net hits.", {
                        action: "os-bump",
                        delta: String(Math.max(1, suggested || 1)),
                        cite: core(176),
                    }),
                    choice("Add 1", "Program modified the action, or a small tick.", {
                        action: "os-bump", delta: "1", cite: core(176),
                    }),
                    choice("Add 3", "Illegal Admin access tick, or a larger bump.", {
                        action: "os-bump", delta: "3", cite: core(176),
                    }),
                    choice("Subtract 1", "Fix a mis-click.", {
                        action: "os-bump", delta: "-1",
                    }),
                ],
            },
            {
                heading: "Next",
                choices: [
                    choice("Check Overwatch Score (roll)", "Eden's Check OS action.", {
                        go: "mx-confirm",
                        matrixId: "check_os",
                        kind: "matrix",
                        matrixIntent: "check_os",
                        badge: "Minor",
                        cite: core(180),
                    }),
                    choice("Another Matrix action", "Back to intents.", {
                        go: "mx-intent", cite: core(179),
                    }),
                    choice("Done with Matrix for now", "Return to the Matrix guide start.", {
                        go: "mx-hub", cite: core(174),
                    }),
                ],
            },
        ],
        blocks: [
            block("rules", "How OS rises", [
                "Illegal action: add every hit on the defender's roll (not net hits).",
                "+1 when a hacking program actually modified the action. +1 per round per host with illegal User access; +3 per round for illegal Admin.",
            ], core(176), { guide: true }),
            edenBlock([
                `The sheet field is system.overwatch (currently ${os}). This page writes that field; Convergence automation beyond the number is still table judgment.`,
            ]),
        ],
    };
}

function intentAction(matrixId, matrixIntent, hint) {
    const name = actionNameMatrix(matrixId);
    if (!name) return null;
    const action = CONFIG.SR6.MATRIX_ACTIONS?.[matrixId];
    return choice(name, hint, {
        go: "mx-confirm",
        matrixId,
        kind: "matrix",
        matrixIntent,
        badge: action?.major ? "Major" : "Minor",
        osDelta: action?.illegal ? "1" : "0",
        cite: matrixCite(matrixId),
    });
}

export function matrixDevices(actor) {
    if (!actor?.items) return [];
    return actor.items.filter((item) => isMatrixAccessItem(item));
}

function isMatrixAccessItem(item) {
    if (item.type !== "gear") return false;
    if (typeof item.isAccessDevice === "boolean") return item.isAccessDevice;
    if (CONFIG.SR6?.GEAR?.SUBTYPES_MATRIX_ACCESS?.has?.(item.system?.subtype)) return true;
    return ACCESS_SUBTYPES.has(item.system?.subtype);
}

function matrixTargetCandidates() {
    const found = new Map();
    const add = (actor, token, source) => {
        if (!actor || found.has(actor.uuid)) return;
        const host = actor.type === "host";
        const deviceLike = actor.type === "Vehicle" || actor.items?.some?.((item) => isMatrixAccessItem(item));
        if (!host && !deviceLike && source !== "Target") return;
        found.set(actor.uuid, {
            uuid: actor.uuid,
            name: token?.name || actor.name,
            hint: host ? "Host actor" : (source === "Target" ? "Foundry target" : actor.type),
            source,
        });
    };
    for (const token of game.user?.targets ?? []) add(token.actor, token, "Target");
    for (const token of canvas?.tokens?.placeables ?? []) {
        if (token.actor?.type === "host") add(token.actor, token, "Scene");
    }
    for (const token of canvas?.tokens?.controlled ?? []) add(token.actor, token, "Selected");
    return [...found.values()];
}

function personaSummary(actor) {
    if (!actor) return "";
    const device = actor.system?.persona?.accessDevice;
    const mode = MODE_COPY[actor.system?.matrixIni]?.label || actor.system?.matrixIni || "unset";
    const os = Number(actor.system.overwatch) || 0;
    if (actor.isTechno || actorGates(actor).resonance) {
        const living = !device ? "living persona" : `${device.name} (also marked)`;
        return `Connecting as ${living} · mode ${mode} · OS ${os}.`;
    }
    if (!device) return `No access device · mode ${mode} · OS ${os}.`;
    return `Device ${device.name} · mode ${mode} · OS ${os}.`;
}

function actorGates(actor) {
    const mortype = actor?.system?.mortype || "mundane";
    const morDef = actor?.system?.morDef ?? CONFIG.SR6.MOR_DEFINITIONS?.[mortype];
    return {
        resonance: Boolean(morDef?.resonance),
        matrix: !lacksMatrixDevice(actor),
    };
}

async function setCombatantIniType(actor, iniType) {
    const combat = game.combat;
    if (!combat) return;
    const combatant = combat.combatants.find((entry) => entry.actor?.uuid === actor.uuid);
    if (!combatant) return;
    await combatant.setFlag("shadowrun6-eden", "iniType", iniType);
}

function labelForUuid(uuid) {
    if (!uuid) return "";
    try {
        const doc = fromUuidSync(uuid);
        return doc?.name || doc?.actor?.name || "";
    } catch {
        return "";
    }
}

function subtypeLabel(item) {
    const key = item.system?.subtype;
    if (!key) return item.type;
    return localizeOrEmpty(`shadowrun6.gear.subtype.${key}`) || String(key).replaceAll("_", " ");
}

function noDeviceBlock(actor) {
    return block("gap", "No matrix device in use", [
        `Eden builds Matrix rolls from the device ${actor.name} uses to access the Matrix, and this sheet has none. Go back to Connect and tick a device, or use a living persona if you are a technomancer.`,
    ]);
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

function actionNameMatrix(id) {
    return localizeOrEmpty(`shadowrun6.matrixaction.${id}.name`);
}

function localizeOrEmpty(key) {
    if (!key || !game?.i18n) return "";
    const value = game.i18n.localize(key);
    return value && value !== key ? value : "";
}

function choice(label, hint, extra = {}) {
    return { label, hint, ...extra };
}

function block(tone, heading, paragraphs, cite, options = {}) {
    return { tone, heading, paragraphs, cite, ...options };
}

function edenBlock(paragraphs, cite) {
    return block("eden", "On the Eden sheet", paragraphs, cite);
}

function core(page) {
    return { book: "core_berlin", page, label: "Core" };
}
