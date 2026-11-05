import { destinationForItem, importFromCompendium, openPack } from "./compendiums.js";
import { buildProvision, findByGenesis } from "./provisions.js";
import { buildPage, defaultActor } from "./pages.js";
import { openPrintedPage, refillWeapon, runLaunch, toggleStatus } from "./launch.js";
import { addTally } from "./tally.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

const DATA_FIELDS = ["kind", "itemId", "fireMode", "burst", "faArea", "topic", "skill", "spec", "matrixId", "pool", "pack", "guide", "guideStep"];

function dataAttribute(key) {
    return "data-" + key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
}

export class TurnWizard extends HandlebarsApplicationMixin(ApplicationV2) {
    static DEFAULT_OPTIONS = {
        id: "sr6-turn-wizard",
        classes: ["sr6-turn-wizard"],
        tag: "form",
        window: {
            icon: "fas fa-route",
            resizable: true,
            minimizable: true,
        },
        position: {
            width: 780,
            height: 640,
        },
        form: {
            submitOnChange: false,
            closeOnSubmit: false,
        },
        actions: {},
    };

    static PARTS = {
        wizard: {
            template: "modules/sr6-turn-wizard/templates/wizard.hbs",
            scrollable: [".sr6tw-scroll"],
        },
    };

    static {
        this.DEFAULT_OPTIONS.form.handler = this.#onSubmit;
        this.DEFAULT_OPTIONS.actions = {
            choose: this.#onChoose,
            back: this.#onBack,
            home: this.#onHome,
            launch: this.#onLaunch,
            book: this.#onBook,
            tally: this.#onTally,
            actor: this.#onActor,
            status: this.#onStatus,
            refill: this.#onRefill,
            refresh: this.#onRefresh,
            search: this.#onSearch,
            pack: this.#onPack,
            import: this.#onImport,
            provision: this.#onProvision,
            crumb: this.#onCrumb,
        };
    }

    static #app = null;

    static show(actor) {
        if (!this.#app) this.#app = new TurnWizard();
        const app = this.#app;
        if (actor) app.state.actorUuid = actor.uuid;
        if (!app.rendered) {
            app.state.pageId = "home";
            app.state.history = [];
            app.state.data = {};
            app.state.label = "";
        }
        app.render({ force: true });
        return app;
    }

    constructor(options = {}) {
        super(options);
        this.state = {
            actorUuid: null,
            pageId: "home",
            history: [],
            data: {},
            label: "",
        };
    }

    get title() {
        const actor = this.actor;
        return actor ? `Turn — ${actor.name}` : "Combat Turn Wizard";
    }

    get actor() {
        if (this.state.actorUuid) {
            const fromState = fromUuidSync(this.state.actorUuid);
            if (fromState) return fromState;
        }
        return defaultActor();
    }

    async _prepareContext(options) {
        const context = typeof super._prepareContext === "function"
            ? await super._prepareContext(options)
            : {};
        if (!this.state.actorUuid) {
            const actor = defaultActor();
            if (actor) this.state.actorUuid = actor.uuid;
        }
        const page = await buildPage(this.state);
        delete page.actor;
        return { ...context, ...page };
    }

    static async #onSubmit(event, form) {
        if (this.state.pageId !== "compendium") return null;
        const query = form?.querySelector?.("[name=compendiumQuery]")?.value ?? "";
        this.state.data = { ...this.state.data, query };
        return this.render();
    }

    static async #onChoose(event, target) {
        event.preventDefault();
        const patch = readPatch(target);
        const pageId = target.dataset.go;
        if (!pageId) return;
        await this.#navigate(pageId, patch, target.dataset.label || cleanLabel(target));
    }

    static async #onBack(event) {
        event.preventDefault();
        const previous = this.state.history.pop();
        if (!previous) return;
        this.#restore(previous);
        return this.render();
    }

    static async #onHome(event) {
        event.preventDefault();
        if (this.state.pageId === "home" && !this.state.label && !Object.keys(this.state.data).length) return;
        this.state.history.push(this.#snapshot());
        this.state.pageId = "home";
        this.state.data = {};
        this.state.label = "";
        return this.render();
    }

    static async #onCrumb(event, target) {
        event.preventDefault();
        const index = Number(target.dataset.index);
        if (!Number.isInteger(index) || index < 0 || index >= this.state.history.length) return;
        const previous = this.state.history[index];
        this.state.history = this.state.history.slice(0, index);
        this.#restore(previous);
        return this.render();
    }

    static async #onLaunch(event, target) {
        event.preventDefault();
        const launch = {
            type: target.dataset.launch,
            skill: target.dataset.skill,
            spec: target.dataset.spec,
            pool: target.dataset.pool,
        };
        await runLaunch(this.actor, launch, this.state.data);
    }

    static async #onBook(event, target) {
        event.preventDefault();
        const book = target.dataset.book;
        const page = Number(target.dataset.page);
        if (!book || !page) return;
        await openPrintedPage(book, page);
    }

    static async #onTally(event, target) {
        event.preventDefault();
        const actor = this.actor;
        if (!actor) return;
        await addTally(actor, target.dataset.track, target.dataset.delta);
        return this.render();
    }

    static async #onActor(event, target) {
        event.preventDefault();
        const uuid = target.dataset.actorUuid;
        if (!uuid || uuid === this.state.actorUuid) return;
        this.state.history.push(this.#snapshot());
        this.state.actorUuid = uuid;
        this.state.pageId = "home";
        this.state.data = {};
        this.state.label = "";
        return this.render();
    }

    static async #onStatus(event, target) {
        event.preventDefault();
        const actor = this.actor;
        if (!actor || !target.dataset.status) return;
        await toggleStatus(actor, target.dataset.status);
        return this.render();
    }

    static async #onRefill(event, target) {
        event.preventDefault();
        const actor = this.actor;
        if (!actor) return;
        const filled = await refillWeapon(actor, target.dataset.itemId);
        if (filled && target.dataset.track) await addTally(actor, target.dataset.track, 1);
        return this.render();
    }

    static async #onRefresh(event) {
        event.preventDefault();
        return this.render();
    }

    static async #onSearch(event) {
        event.preventDefault();
        const input = this.element?.querySelector?.("[name=compendiumQuery]");
        this.state.data = { ...this.state.data, query: input?.value ?? "" };
        return this.render();
    }

    static async #onPack(event, target) {
        event.preventDefault();
        await openPack(target.dataset.pack || this.state.data.pack);
    }

    static async #onImport(event, target) {
        event.preventDefault();
        const created = await importFromCompendium(this.actor, target.dataset.pack, target.dataset.documentId);
        if (!created) return;
        const destination = destinationForItem(created);
        await this.#navigate(destination.pageId, destination.patch, created.name);
    }

    static async #onProvision(event, target) {
        event.preventDefault();
        const actor = this.actor;
        if (!actor?.isOwner) {
            ui.notifications.warn("Only an owner of this actor can add an item to the sheet.");
            return;
        }
        const parent = actor.items.get(target.dataset.itemId);
        const provisionId = target.dataset.provision;
        const data = buildProvision(provisionId, parent);
        if (!data) {
            ui.notifications.warn("This page cannot create that item.");
            return;
        }
        const existing = findByGenesis(actor, data.system.genesisID);
        const created = existing || (await actor.createEmbeddedDocuments("Item", [data]))[0];
        if (!existing) ui.notifications.info(`${created.name} was added to ${actor.name}.`);
        const destination = destinationForItem(created);
        await this.#navigate(destination.pageId, destination.patch, created.name);
    }

    #snapshot() {
        return {
            pageId: this.state.pageId,
            label: this.state.label,
            data: foundry.utils.deepClone(this.state.data),
            actorUuid: this.state.actorUuid,
        };
    }

    #restore(entry) {
        this.state.pageId = entry.pageId;
        this.state.label = entry.label;
        this.state.data = entry.data;
        if (entry.actorUuid) this.state.actorUuid = entry.actorUuid;
    }

    async #navigate(pageId, patch, label) {
        const data = { ...this.state.data };
        for (const [key, value] of Object.entries(patch)) {
            if (value == null || value === "") delete data[key];
            else data[key] = value;
        }
        this.state.history.push(this.#snapshot());
        this.state.pageId = pageId;
        this.state.label = label;
        this.state.data = data;
        return this.render();
    }
}

function readPatch(target) {
    const patch = {};
    for (const key of DATA_FIELDS) {
        if (target.hasAttribute(dataAttribute(key))) patch[key] = target.dataset[key];
    }
    const clear = target.dataset.clear;
    if (clear) {
        for (const key of clear.split(",").map((part) => part.trim()).filter(Boolean)) {
            patch[key] = null;
        }
    }
    return patch;
}

function cleanLabel(target) {
    const name = target.querySelector?.(".sr6tw-choice-label");
    return (name?.textContent || target.textContent || "Next").trim();
}
