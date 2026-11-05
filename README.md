# Shadowrun Turn Wizard

Foundry module `sr6-turn-wizard` version 0.1.0.

It requires:

- Foundry 13 or 14
- system `shadowrun6-eden` 4.0.11 or newer
- module `shadowrun-data` 1.0.5 or newer (the Shadowrun compendiums)

The wizard walks a combat turn, cites the book, and opens the Eden roll when the sheet can finish it. Search pages copy an item out of the `shadowrun-data` packs onto the acting character.

## Install from git

The clone has to land in Foundry's user-data folder under `Data/modules/sr6-turn-wizard`. The folder name has to match the module id.

```
cd "<Foundry user data>/Data/modules"
git clone <this repo's url> sr6-turn-wizard
```

Then enable **Shadowrun Turn Wizard** in a world that already has **Shadowrun 6th Edition** and **Shadowrun Compendiums**. Foundry will refuse to enable this module until `shadowrun-data` is installed.

Open it from the route icon on the token controls, the **Combat Turn Wizard** macro (created the first time a gamemaster loads the world), or Shift+Alt+T.

A clickable mock of the window, with no Foundry server, is `preview/index.html`. Open that file in a browser.

`url`, `manifest`, and `download` in `module.json` stay empty until this repo has a remote and a release zip. Foundry's "Install Module" button uses those. A git clone into `Data/modules` is enough to play.
