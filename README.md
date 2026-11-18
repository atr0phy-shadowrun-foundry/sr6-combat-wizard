# Shadowrun Turn Wizard

Foundry module `sr6-turn-wizard` version 0.1.6.

It requires:

- Foundry 13 or 14
- system `shadowrun6-eden` 4.0.11 or newer
- module `shadowrun-data` 1.0.5 or newer (the Shadowrun compendiums)

The wizard walks a combat turn, cites the book, and opens the Eden roll when the sheet can finish it. Search pages copy an item out of the `shadowrun-data` packs onto the acting character.

## Install in Foundry

In Setup, choose Install Module and paste this manifest URL:

```
https://raw.githubusercontent.com/atr0phy-shadowrun-foundry/sr6-combat-wizard/main/module.json
```

Foundry reads `download` from that file and fetches the `main` branch zip. The module lands in `Data/modules/sr6-turn-wizard`.

A git clone works too. The folder name has to match the module id.

```
cd "<Foundry user data>/Data/modules"
git clone https://github.com/atr0phy-shadowrun-foundry/sr6-combat-wizard.git sr6-turn-wizard
```

Then enable **Shadowrun Turn Wizard** in a world that already has **Shadowrun 6th Edition** and **Shadowrun Compendiums**. Foundry will refuse to enable this module until `shadowrun-data` is installed.

Open it from the route icon on the token controls, the **Combat Turn Wizard** macro (created the first time a gamemaster loads the world), or Shift+Alt+T.
