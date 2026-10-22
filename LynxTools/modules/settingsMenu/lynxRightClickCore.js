(function(fetch){
/* Lynx Right Click UI Core 2.1.2 — validated name/alias results. */
(() => {
  "use strict";
  if (window.LynxRightClickUI) return;

  const LIMIT = 60;
  const DELAY = 140;
  const state = { menu: null, overlay: null, timer: 0, controller: null };

  const entities = {
    Tags: {
      singular: "tag", plural: "tags", icon: "◆", itemsField: "tags",
      getLabel: (item) => item.name || "Unnamed tag",
      query: `query LynxFindTags($filter: String!, $perPage: Int!) {
        findTags(tag_filter: { name: { value: $filter, modifier: INCLUDES } }, filter: { per_page: $perPage, sort: "name", direction: ASC }) {
          count tags { id name }
        }
      }`,
      extract: (data) => data.findTags,
    },
    Performers: {
      singular: "performer", plural: "performers", icon: "●", itemsField: "performers",
      placeholder: "Search name or alias (full names match exactly)…",
      buildVariables: performerSearchVariables,
      getMatchMeta: performerAliasMatch,
      getLabel: (item) => item.name || "Unnamed performer",
      getMeta: (item) => item.disambiguation || genderLabel(item.gender) || `ID ${item.id}`,
      getImage: (item) => item.image_path || "",
      query: `query LynxFindPerformers($criteria: PerformerFilterType!, $perPage: Int!) {
        findPerformers(performer_filter: $criteria, filter: { per_page: $perPage, sort: "name", direction: ASC }) {
          count performers { id name alias_list disambiguation gender image_path }
        }
      }`,
      extract: (data) => data.findPerformers,
    },
    Scenes: {
      singular: "scene", plural: "scenes", icon: "▶", itemsField: "scenes",
      getLabel: (item) => item.title || "Untitled scene",
      getMeta: (item) => item.date || `ID ${item.id}`,
      getImage: (item) => item.paths?.screenshot || "",
      query: `query LynxFindScenes($filter: String!, $perPage: Int!) {
        findScenes(scene_filter: { title: { value: $filter, modifier: INCLUDES } }, filter: { per_page: $perPage, sort: "title", direction: ASC }) {
          count scenes { id title date paths { screenshot } }
        }
      }`,
      extract: (data) => data.findScenes,
    },
    Galleries: {
      singular: "gallery", plural: "galleries", icon: "▣", itemsField: "galleries",
      getLabel: (item) => item.title || "Untitled gallery",
      getMeta: (item) => `ID ${item.id}`,
      query: `query LynxFindGalleries($filter: String!, $perPage: Int!) {
        findGalleries(gallery_filter: { title: { value: $filter, modifier: INCLUDES } }, filter: { per_page: $perPage, sort: "title", direction: ASC }) {
          count galleries { id title }
        }
      }`,
      extract: (data) => data.findGalleries,
    },
  };

  function normalizedSearch(value) {
    return String(value || "").trim().replace(/\s+/g, " ").toLocaleLowerCase();
  }

  function performerSearchVariables(term) {
    const words = String(term).trim().split(/\s+/);
    const escaped = words.map(word => word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    const pattern = "(?i)" + (words.length > 1 ? "^\\s*" + escaped.join("\\s+") + "\\s*$" : escaped[0]);
    const criterion = { value: pattern, modifier: "MATCHES_REGEX" };
    return { criteria: { name: criterion, OR: { aliases: criterion } }, perPage: LIMIT };
  }

  function performerAliasMatch(item, term) {
    const query = normalizedSearch(term);
    const matches = value => performerNameMatches(value, query);
    if (!query || matches(item.name)) return "";
    const alias = (item.alias_list || []).find(matches);
    return alias ? "Alias: " + alias : "";
  }

  function performerNameMatches(value, query) {
    const name = normalizedSearch(value);
    return query.includes(" ") ? name === query : name.includes(query);
  }

  function performerMatchesQuery(item, term) {
    const query = normalizedSearch(term);
    return !!query && [item.name, ...(item.alias_list || [])].some(value => performerNameMatches(value, query));
  }

  function genderLabel(gender) {
    return ({
      FEMALE: "Female", MALE: "Male", TRANSGENDER_FEMALE: "Trans female",
      TRANSGENDER_MALE: "Trans male", NON_BINARY: "Non-binary", INTERSEX: "Intersex",
    })[gender] || "";
  }

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  async function gql(query, variables = {}, signal) {
    const response = await fetch("/graphql", {
      method: "POST", credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, variables }), signal,
    });
    if (!response.ok) throw new Error(`Stash returned HTTP ${response.status}`);
    const result = await response.json();
    if (result.errors?.length) throw new Error(result.errors.map((e) => e.message).join("\n"));
    return result.data;
  }

  function closeMenu() {
    state.menu?.remove();
    state.menu = null;
  }

  function closeDialog() {
    clearTimeout(state.timer);
    state.controller?.abort();
    state.controller = null;
    state.overlay?.remove();
    state.overlay = null;
    document.body.classList.remove("lynx-rc-dialog-open");
  }

  function toast(message, kind = "success") {
    document.querySelectorAll(".lynx-rc-toast").forEach((node) => node.remove());
    const node = el("div", `lynx-rc-toast lynx-rc-toast--${kind}`, message);
    node.setAttribute("role", kind === "error" ? "alert" : "status");
    document.body.appendChild(node);
    requestAnimationFrame(() => node.classList.add("is-visible"));
    setTimeout(() => {
      node.classList.remove("is-visible");
      setTimeout(() => node.remove(), 180);
    }, 2800);
  }

  function clamp(menu, x, y) {
    const rect = menu.getBoundingClientRect();
    const gap = 10;
    menu.style.left = `${Math.max(gap, Math.min(x, innerWidth - rect.width - gap))}px`;
    menu.style.top = `${Math.max(gap, Math.min(y, innerHeight - rect.height - gap))}px`;
  }

  function showMenu({ x, y, heading = "Quick actions", actions = [] }) {
    closeMenu();
    const menu = el("div", "lynx-rc-menu");
    menu.setAttribute("role", "menu");
    menu.append(el("div", "lynx-rc-menu__heading", heading));

    actions.forEach((action) => {
      if (action.divider) {
        menu.append(el("div", "lynx-rc-menu__divider"));
        return;
      }
      const item = el("button", `lynx-rc-menu__item${action.danger ? " is-danger" : ""}`);
      item.type = "button";
      item.setAttribute("role", "menuitem");
      item.append(el("span", "lynx-rc-menu__icon", action.icon || "•"));
      item.append(el("span", "lynx-rc-menu__label", action.label));
      item.addEventListener("click", () => {
        closeMenu();
        if (action.href) window.open(action.href, action.newTab ? "_blank" : "_self", "noopener");
        else action.onClick?.();
      });
      menu.appendChild(item);
    });

    document.body.appendChild(menu);
    state.menu = menu;
    clamp(menu, x, y);
    menu.querySelector("button")?.focus({ preventScroll: true });
    return menu;
  }

  function createDialogShell({ title, subtitle, icon = "●", compact = false }) {
    closeDialog();
    const overlay = el("div", "lynx-rc-overlay");
    const dialog = el("section", `lynx-rc-dialog${compact ? " lynx-rc-dialog--compact" : ""}`);
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    const header = el("header", "lynx-rc-dialog__header");
    const group = el("div", "lynx-rc-title-group");
    group.append(el("span", "lynx-rc-title-icon", icon));
    const text = el("div", "lynx-rc-title-text");
    const heading = el("h2", "lynx-rc-title", title);
    text.appendChild(heading);
    if (subtitle) {
      const sub = el("div", "lynx-rc-subtitle", subtitle);
      sub.title = subtitle;
      text.appendChild(sub);
    }
    group.appendChild(text);
    const close = el("button", "lynx-rc-close", "×");
    close.type = "button";
    close.setAttribute("aria-label", "Close");
    close.addEventListener("click", closeDialog);
    header.append(group, close);
    dialog.appendChild(header);
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);
    document.body.classList.add("lynx-rc-dialog-open");
    state.overlay = overlay;
    overlay.addEventListener("mousedown", (event) => { if (event.target === overlay) closeDialog(); });
    dialog.addEventListener("keydown", (event) => { if (event.key === "Escape") closeDialog(); });
    return { overlay, dialog };
  }

  function renderAvatar(item, label, getImage) {
    const avatar = el("div", "lynx-rc-avatar");
    avatar.append(el("span", "lynx-rc-avatar__fallback", label.charAt(0).toUpperCase()));
    const source = getImage?.(item);
    if (source) {
      const image = document.createElement("img");
      image.src = source; image.alt = ""; image.loading = "lazy";
      image.addEventListener("load", () => avatar.classList.add("has-image"));
      image.addEventListener("error", () => image.remove());
      avatar.appendChild(image);
    }
    return avatar;
  }

  async function resolveIds(value) {
    const resolved = typeof value === "function" ? await value() : await value;
    return resolved instanceof Set ? resolved : new Set((resolved || []).map(String));
  }

  function openPicker(options) {
    const config = { ...(entities[options.entity] || {}), ...options };
    if (!config.getLabel) throw new Error("Lynx picker requires getLabel");
    const { dialog } = createDialogShell({
      title: config.title || `Add ${config.plural}`,
      subtitle: config.subtitle, icon: config.icon || "●",
    });
    const selected = new Map();
    let existing = new Set();
    let resultsData = [];
    let active = -1;
    let saving = false;

    const searchArea = el("div", "lynx-rc-search-area");
    const searchWrap = el("div", "lynx-rc-search");
    searchWrap.append(el("span", "lynx-rc-search__icon", "⌕"));
    const search = document.createElement("input");
    search.type = "search"; search.className = "lynx-rc-search__input";
    search.placeholder = config.placeholder || `Search ${config.plural || "items"} by name…`;
    search.autocomplete = "off"; search.spellcheck = false;
    const clear = el("button", "lynx-rc-search__clear", "×");
    clear.type = "button"; clear.hidden = true;
    searchWrap.append(search, clear);
    const meta = el("div", "lynx-rc-search-meta", config.staticItems ? `${config.staticItems.length} available` : "Type at least one character");
    searchArea.append(searchWrap, meta);

    const chosen = el("div", "lynx-rc-selected");
    const chosenHead = el("div", "lynx-rc-selected__header");
    chosenHead.append(el("span", "lynx-rc-selected__label", config.single ? "Choice" : "Selected"));
    const chosenStatus = el("span", "lynx-rc-selected__status", "None");
    chosenHead.appendChild(chosenStatus);
    const chips = el("div", "lynx-rc-selected__chips");
    chosen.append(chosenHead, chips);

    const list = el("div", "lynx-rc-results");
    list.setAttribute("role", "listbox");
    const footer = el("footer", "lynx-rc-dialog__footer");
    footer.append(el("div", "lynx-rc-keyboard-hint", "↑↓ Navigate  ·  Enter Select  ·  Esc Close"));
    const buttons = el("div", "lynx-rc-footer-buttons");
    const cancel = el("button", "lynx-rc-button lynx-rc-button--secondary", "Cancel");
    cancel.type = "button"; cancel.addEventListener("click", closeDialog);
    const save = el("button", "lynx-rc-button lynx-rc-button--primary", config.saveLabel || (config.single ? "Select" : "Add selected"));
    save.type = "button"; save.disabled = true;
    buttons.append(cancel, save); footer.appendChild(buttons);
    dialog.append(searchArea, chosen, list, footer);

    function message(text, kind = "info") {
      resultsData = []; active = -1; list.replaceChildren();
      const box = el("div", `lynx-rc-empty lynx-rc-empty--${kind}`);
      box.append(el("span", "lynx-rc-empty__icon", kind === "error" ? "!" : "⌕"));
      box.append(el("span", "lynx-rc-empty__text", text)); list.appendChild(box);
    }

    function renderChosen() {
      chips.replaceChildren();
      chosen.classList.toggle("has-selection", selected.size > 0);
      chosenStatus.textContent = selected.size ? `${selected.size} chosen` : "None";
      save.disabled = !selected.size || saving;
      save.textContent = selected.size && !config.single
        ? `${config.saveLabel || "Add selected"} (${selected.size})`
        : (config.saveLabel || (config.single ? "Select" : "Add selected"));
      selected.forEach((item, id) => {
        const chip = el("button", "lynx-rc-chip"); chip.type = "button";
        chip.append(el("span", "lynx-rc-chip__text", config.getLabel(item)));
        chip.append(el("span", "lynx-rc-chip__remove", "×"));
        chip.addEventListener("click", () => { selected.delete(id); renderChosen(); renderRows(resultsData, Number(meta.dataset.total || resultsData.length)); });
        chips.appendChild(chip);
      });
    }

    function toggle(item) {
      const id = String(item.id);
      if (existing.has(id)) return;
      if (config.single) selected.clear();
      if (selected.has(id)) selected.delete(id); else selected.set(id, item);
      renderChosen(); renderRows(resultsData, Number(meta.dataset.total || resultsData.length));
    }

    function renderRows(items, total = items.length) {
      resultsData = items; active = -1; list.replaceChildren(); meta.dataset.total = String(total);
      meta.textContent = total > items.length ? `${total.toLocaleString()} matches · showing first ${items.length}` : `${total.toLocaleString()} ${total === 1 ? "match" : "matches"}`;
      if (!items.length) { message(config.getMatchMeta && /\s/.test(search.value.trim()) ?
        "No exact name or alias match. Try a single name for a broader search." : "No matches. Try another spelling."); return; }
      items.forEach((item) => {
        const id = String(item.id), label = config.getLabel(item);
        const isExisting = existing.has(id), isSelected = selected.has(id);
        const row = el("button", "lynx-rc-result"); row.type = "button";
        row.classList.toggle("is-existing", isExisting); row.classList.toggle("is-selected", isSelected);
        row.disabled = isExisting;
        if (config.getImage?.(item)) row.append(renderAvatar(item, label, config.getImage));
        else row.append(el("span", "lynx-rc-entity-icon", config.icon || "•"));
        const info = el("span", "lynx-rc-result__info");
        info.append(el("span", "lynx-rc-result__name", label));
        const metadata = el("span", "lynx-rc-result__metadata");
        if (item.disambiguation) {
          metadata.append(el("span", "lynx-rc-disambiguation", item.disambiguation));
        }
        if (item.gender) {
          metadata.append(el(
            "span",
            `lynx-rc-gender lynx-rc-gender--${item.gender.toLowerCase().replaceAll("_", "-")}`,
            genderLabel(item.gender)
          ));
        }
        if (!metadata.childNodes.length) {
          metadata.textContent = config.getMeta?.(item) || `ID ${id}`;
        }
        const matchMeta = config.getMatchMeta?.(item, search.value.trim());
        if (matchMeta) metadata.append(el("span", "lynx-rc-disambiguation", matchMeta));
        info.append(metadata);
        row.append(info, el("span", "lynx-rc-result__marker", isExisting ? "Added" : isSelected ? "✓" : "+"));
        row.addEventListener("click", () => toggle(item)); list.appendChild(row);
      });
    }

    function filterStatic() {
      const term = search.value.trim().toLocaleLowerCase(); clear.hidden = !term;
      const items = (config.staticItems || []).filter((item) => {
        const searchable = config.getSearchText?.(item) || config.getLabel(item);
        return String(searchable).toLocaleLowerCase().includes(term);
      });
      renderRows(items, items.length);
    }

    async function runSearch() {
      const term = search.value.trim(); clear.hidden = !term;
      if (config.staticItems) { filterStatic(); return; }
      if (!term) { meta.textContent = "Type at least one character"; message(`Start typing to search ${config.plural}.`); return; }
      state.controller?.abort();
      const controller = new AbortController(); state.controller = controller;
      meta.textContent = "Searching…"; message("Searching…");
      try {
        const data = await gql(config.query, config.buildVariables?.(term) || { filter: term, perPage: LIMIT }, controller.signal);
        if (controller.signal.aborted || state.overlay == null || search.value.trim() !== term) return;
        const found = config.extract(data);
        const items = found?.[config.itemsField] || [];
        const verified = config.getMatchMeta ? items.filter(item => performerMatchesQuery(item, term)) : items;
        renderRows(verified, config.getMatchMeta ? verified.length : found?.count || 0);
      } catch (error) {
        if (error.name !== "AbortError") { console.error("Lynx search failed", error); message("Could not search Stash. Please try again.", "error"); }
      } finally { if (state.controller === controller) state.controller = null; }
    }

    function setActive(next) {
      const rows = Array.from(list.querySelectorAll(".lynx-rc-result:not(.is-existing)"));
      rows.forEach((row) => row.classList.remove("is-active"));
      if (!rows.length) return;
      active = Math.max(0, Math.min(next, rows.length - 1));
      rows[active].classList.add("is-active"); rows[active].scrollIntoView({ block: "nearest" });
    }

    search.addEventListener("input", () => {
      clearTimeout(state.timer);
      state.controller?.abort();
      list.replaceChildren(); resultsData = []; active = -1;
      meta.textContent = search.value.trim() ? "Waiting to search…" : "Type at least one character";
      state.timer = setTimeout(runSearch, config.staticItems ? 30 : DELAY);
    });
    clear.addEventListener("click", () => { search.value = ""; clear.hidden = true; runSearch(); search.focus(); });
    search.addEventListener("keydown", (event) => {
      const rows = list.querySelectorAll(".lynx-rc-result:not(.is-existing)");
      if (event.key === "ArrowDown") { event.preventDefault(); setActive(active + 1); }
      else if (event.key === "ArrowUp") { event.preventDefault(); setActive(active <= 0 ? rows.length - 1 : active - 1); }
      else if (event.key === "Enter" && active >= 0) { event.preventDefault(); rows[active]?.click(); }
    });
    save.addEventListener("click", async () => {
      if (!selected.size || saving) return;
      saving = true; renderChosen(); cancel.disabled = true; save.textContent = "Saving…";
      try {
        await config.onSave?.([...selected.keys()], [...selected.values()], existing);
        closeDialog();
      } catch (error) {
        console.error("Lynx save failed", error); toast(config.errorMessage || "The change could not be saved.", "error");
        saving = false; cancel.disabled = false; renderChosen();
      }
    });
    dialog.addEventListener("keydown", (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key === "Enter" && !save.disabled) { event.preventDefault(); save.click(); }
    });

    message(config.staticItems ? "Loading choices…" : `Start typing to search ${config.plural}.`);
    Promise.all([resolveIds(config.existingIds), Promise.resolve(config.staticItems || null)]).then(([ids, staticItems]) => {
      if (!state.overlay) return;
      existing = ids;
      if (staticItems) renderRows(staticItems, staticItems.length);
      else if (resultsData.length) renderRows(resultsData, Number(meta.dataset.total || resultsData.length));
    }).catch((error) => { console.error(error); toast("Could not read existing links.", "error"); });
    search.focus({ preventScroll: true });
  }

  function confirmAction({ title, subtitle, message, detail, icon = "!", confirmLabel = "Continue", danger = false, onConfirm }) {
    const { dialog } = createDialogShell({ title, subtitle, icon, compact: true });
    const content = el("div", "lynx-rc-confirm");
    content.append(el("p", "lynx-rc-confirm__message", message));
    if (detail) content.append(el("p", "lynx-rc-confirm__detail", detail));
    const footer = el("footer", "lynx-rc-dialog__footer");
    footer.append(el("div", "lynx-rc-keyboard-hint", danger ? "This action cannot be undone" : "Esc Close"));
    const buttons = el("div", "lynx-rc-footer-buttons");
    const cancel = el("button", "lynx-rc-button lynx-rc-button--secondary", "Cancel"); cancel.type = "button"; cancel.onclick = closeDialog;
    const confirm = el("button", `lynx-rc-button ${danger ? "lynx-rc-button--danger" : "lynx-rc-button--primary"}`, confirmLabel); confirm.type = "button";
    confirm.onclick = async () => {
      confirm.disabled = true; cancel.disabled = true; confirm.textContent = "Working…";
      try { await onConfirm?.(); closeDialog(); }
      catch (error) { console.error(error); toast("The action failed.", "error"); confirm.disabled = false; cancel.disabled = false; confirm.textContent = confirmLabel; }
    };
    buttons.append(cancel, confirm); footer.appendChild(buttons); dialog.append(content, footer); confirm.focus();
  }

  document.addEventListener("mousedown", (event) => { if (state.menu && !state.menu.contains(event.target)) closeMenu(); });
  document.addEventListener("keydown", (event) => { if (event.key === "Escape") { closeMenu(); if (state.overlay) closeDialog(); } });
  window.addEventListener("resize", closeMenu, { passive: true });
  window.addEventListener("scroll", closeMenu, { passive: true, capture: true });

  window.LynxRightClickUI = { gql, toast, showMenu, openPicker, confirm: confirmAction, closeMenu, closeDialog, entities };
})();

})(window.LynxToolsRuntime.fetchFor("stashRightClickSettings"));
