import { TurnWizard } from "./wizard.js";

const MODULE = "sr6-turn-wizard";

Hooks.once("init", () => {
    game.settings.register(MODULE, "macroId", {
        scope: "world",
        config: false,
        type: String,
        default: "",
    });

    game.keybindings.register(MODULE, "open", {
        name: "SR6TURN.open",
        editable: [{ key: "KeyT", modifiers: ["Shift", "Alt"] }],
        onDown: () => {
            TurnWizard.show();
            return true;
        },
        reservedModifiers: [],
        restricted: false,
        precedence: CONST.KEYBINDING_PRECEDENCE.NORMAL,
    });
});

Hooks.once("ready", async () => {
    game.modules.get(MODULE).api = {
        open(actor) {
            return TurnWizard.show(actor);
        },
    };
    await ensureMacro();
});

Hooks.on("getSceneControlButtons", (controls) => {
    const tool = {
        name: "sr6TurnWizard",
        title: "Combat Turn Wizard",
        icon: "fas fa-route",
        button: true,
        order: 70,
        onClick: () => TurnWizard.show(),
        onChange: () => TurnWizard.show(),
    };
    if (Array.isArray(controls)) {
        const tokens = controls.find((entry) => entry.name === "token" || entry.name === "tokens");
        if (!tokens) return;
        if (Array.isArray(tokens.tools)) tokens.tools.push(tool);
        else tokens.tools.sr6TurnWizard = tool;
        return;
    }
    const tokens = controls.tokens ?? controls.token;
    if (!tokens?.tools) return;
    if (Array.isArray(tokens.tools)) tokens.tools.push(tool);
    else tokens.tools.sr6TurnWizard = tool;
});

for (const hook of ["targetToken", "combatStart", "updateCombat", "deleteCombat", "updateToken"]) {
    Hooks.on(hook, () => {
        const open = foundry.applications?.instances?.get?.("sr6-turn-wizard");
        if (open?.rendered) open.render();
    });
}

Hooks.on("controlToken", () => {
    foundry.applications?.instances?.get?.("sr6-turn-wizard")?.selectionChanged();
});

async function ensureMacro() {
    if (!game.user.isGM) return;
    try {
        const existingId = game.settings.get(MODULE, "macroId");
        if (existingId && game.macros.get(existingId)) return;
        const macro = await Macro.create({
            name: "Combat Turn Wizard",
            type: "script",
            scope: "global",
            img: "icons/svg/target.svg",
            command: [
                "const mod = game.modules.get(\"sr6-turn-wizard\");",
                "if (!mod?.active) return ui.notifications.error(\"Enable the Shadowrun Turn Wizard module.\");",
                "return mod.api.open();",
            ].join("\n"),
        });
        await game.settings.set(MODULE, "macroId", macro.id);
    } catch (error) {
        console.error("sr6-turn-wizard | could not create the hotbar macro", error);
    }
}
