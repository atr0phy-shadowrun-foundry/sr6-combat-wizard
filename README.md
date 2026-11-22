# Shadowrun Turn Wizard

Foundry module `sr6-turn-wizard` version 0.1.13.

It requires:

- Foundry 13 or 14
- system `shadowrun6-eden` 4.0.11 or newer
- module `shadowrun-data` 1.0.5 or newer (the Shadowrun compendiums)
- module `sr6-catalog` 0.1.0 or newer (shared item picker)

The wizard walks a combat turn, cites the book, and opens the Eden roll when the sheet can finish it. Look-up actions open the shared catalog and copy the pick onto the acting character.

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

Then enable **Shadowrun Turn Wizard** in a world that already has **Shadowrun 6th Edition**, **Shadowrun Compendiums**, and **Shadowrun Catalog**. Foundry will refuse to enable this module until those dependencies are installed.

Open it from the route icon on the token controls, the **Combat Turn Wizard** macro (created the first time a gamemaster loads the world), or Shift+Alt+T.
