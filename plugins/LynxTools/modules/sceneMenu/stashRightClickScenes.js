(function(fetch){
/* Lynx Right Click Scenes 2.0.0
 * Lightweight, dependency-free scene actions and entity picker.
 */

(() => {
  "use strict";

  if (window.__lynxRightClickScenesInstalled) return;
  window.__lynxRightClickScenesInstalled = true;

  const RESULT_LIMIT = 60;
  const SEARCH_DELAY = 140;
  const state = {
    menu: null,
    overlay: null,
    searchTimer: 0,
    requestController: null,
  };

  const configs = {
    Performers: {
      singular: "performer",
      plural: "performers",
      icon: "●",
      existingField: "performers",
      updateField: "performer_ids",
      query: `query LynxFindPerformers($filter: String!, $perPage: Int!) {
        findPerformers(
          performer_filter: { name: { value: $filter, modifier: INCLUDES } }
          filter: { per_page: $perPage, sort: "name", direction: ASC }
        ) {
          count
          performers { id name disambiguation gender image_path }
        }
      }`,
      extract: (data) => data.findPerformers,
      itemsField: "performers",
      getLabel: (item) => item.name || "Unnamed performer",
    },
    Tags: {
      singular: "tag",
      plural: "tags",
      icon: "◆",
      existingField: "tags",
      updateField: "tag_ids",
      query: `query LynxFindTags($filter: String!, $perPage: Int!) {
        findTags(
          tag_filter: { name: { value: $filter, modifier: INCLUDES } }
          filter: { per_page: $perPage, sort: "name", direction: ASC }
        ) {
          count
          tags { id name }
        }
      }`,
      extract: (data) => data.findTags,
      itemsField: "tags",
      getLabel: (item) => item.name || "Unnamed tag",
    },
    Galleries: {
      singular: "gallery",
      plural: "galleries",
      icon: "▣",
      existingField: "galleries",
      updateField: "gallery_ids",
      query: `query LynxFindGalleries($filter: String!, $perPage: Int!) {
        findGalleries(
          gallery_filter: { title: { value: $filter, modifier: INCLUDES } }
          filter: { per_page: $perPage, sort: "title", direction: ASC }
        ) {
          count
          galleries { id title }
        }
      }`,
      extract: (data) => data.findGalleries,
      itemsField: "galleries",
      getLabel: (item) => item.title || "Untitled gallery",
    },
  };

  async function gql(query, variables = {}, signal) {
    const response = await fetch("/graphql", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, variables }),
      signal,
    });

    if (!response.ok) {
      throw new Error(`Stash returned HTTP ${response.status}`);
    }

    const result = await response.json();
    if (result.errors?.length) {
      throw new Error(result.errors.map((error) => error.message).join("\n"));
    }

    return result.data;
  }

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function closeMenu() {
    state.menu?.remove();
    state.menu = null;
  }

  function closePicker() {
    window.clearTimeout(state.searchTimer);
    state.requestController?.abort();
    state.requestController = null;
    state.overlay?.remove();
    state.overlay = null;
    document.body.classList.remove("lynx-rc-dialog-open");
  }

  function showToast(message, kind = "success") {
    document.querySelectorAll(".lynx-rc-toast").forEach((toast) => toast.remove());
    const toast = el("div", `lynx-rc-toast lynx-rc-toast--${kind}`, message);
    toast.setAttribute("role", kind === "error" ? "alert" : "status");
    document.body.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add("is-visible"));
    window.setTimeout(() => {
      toast.classList.remove("is-visible");
      window.setTimeout(() => toast.remove(), 180);
    }, 2600);
  }

  function sceneIdFromCard(card) {
    const link = card.querySelector(
      'a.scene-card-link[href*="/scenes/"], a[href^="/scenes/"]'
    );
    return link?.getAttribute("href")?.match(/\/scenes\/(\d+)/)?.[1] || null;
  }

  function sceneTitleFromCard(card) {
    return (
      card.querySelector(".scene-title")?.textContent?.trim() ||
      card.querySelector('[href^="/scenes/"]')?.getAttribute("title") ||
      "Selected scene"
    );
  }

  function clampMenuToViewport(menu, x, y) {
    const rect = menu.getBoundingClientRect();
    const gap = 10;
    menu.style.left = `${Math.max(gap, Math.min(x, innerWidth - rect.width - gap))}px`;
    menu.style.top = `${Math.max(gap, Math.min(y, innerHeight - rect.height - gap))}px`;
  }

  function createMenu(event, sceneId, sceneTitle) {
    closeMenu();
    closePicker();

    const menu = el("div", "lynx-rc-menu");
    menu.id = "scenes-custom-menu";
    menu.setAttribute("role", "menu");

    const heading = el("div", "lynx-rc-menu__heading", "Scene actions");
    menu.appendChild(heading);

    const actions = [
      ["Tags", "◆", "Add tags"],
      ["Performers", "●", "Add performers"],
      ["Galleries", "▣", "Add galleries"],
    ];

    actions.forEach(([type, icon, label]) => {
      const button = el("button", "lynx-rc-menu__item");
      button.type = "button";
      button.setAttribute("role", "menuitem");
      button.append(el("span", "lynx-rc-menu__icon", icon));
      button.append(el("span", "lynx-rc-menu__label", label));
      button.addEventListener("click", () => {
        closeMenu();
        openPicker(type, sceneId, sceneTitle);
      });
      menu.appendChild(button);
    });

    const divider = el("div", "lynx-rc-menu__divider");
    menu.appendChild(divider);

    const edit = el("button", "lynx-rc-menu__item");
    edit.type = "button";
    edit.setAttribute("role", "menuitem");
    edit.append(el("span", "lynx-rc-menu__icon", "✎"));
    edit.append(el("span", "lynx-rc-menu__label", "Edit scene"));
    edit.addEventListener("click", () => {
      closeMenu();
      window.open(`/scenes/${sceneId}/edit`, "_blank", "noopener");
    });
    menu.appendChild(edit);

    document.body.appendChild(menu);
    state.menu = menu;
    clampMenuToViewport(menu, event.clientX, event.clientY);
    menu.querySelector("button")?.focus({ preventScroll: true });
  }

  function genderLabel(gender) {
    const labels = {
      FEMALE: "Female",
      MALE: "Male",
      TRANSGENDER_FEMALE: "Trans female",
      TRANSGENDER_MALE: "Trans male",
      NON_BINARY: "Non-binary",
      INTERSEX: "Intersex",
    };
    return labels[gender] || "";
  }

  function renderAvatar(item, label) {
    const avatar = el("div", "lynx-rc-avatar");
    const fallback = el("span", "lynx-rc-avatar__fallback", label.charAt(0).toUpperCase());
    avatar.appendChild(fallback);

    if (item.image_path) {
      const image = document.createElement("img");
      image.src = item.image_path;
      image.alt = "";
      image.loading = "lazy";
      image.addEventListener("load", () => avatar.classList.add("has-image"));
      image.addEventListener("error", () => image.remove());
      avatar.appendChild(image);
    }

    return avatar;
  }

  async function fetchExistingIds(sceneId, field) {
    const query = `query LynxSceneEntities($id: ID!) {
      findScene(id: $id) {
        performers { id }
        tags { id }
        galleries { id }
      }
    }`;
    const data = await gql(query, { id: sceneId });
    return new Set((data.findScene?.[field] || []).map((item) => String(item.id)));
  }

  async function updateScene(sceneId, field, ids) {
    const mutation = `mutation LynxUpdateScene($sceneId: ID!, $ids: [ID!]!) {
      sceneUpdate(input: { id: $sceneId, ${field}: $ids }) { id }
    }`;
    await gql(mutation, { sceneId, ids });
  }

  function openPicker(type, sceneId, sceneTitle) {
    const config = configs[type];
    if (!config) return;

    closePicker();
    const selected = new Map();
    let existingIds = new Set();
    let visibleResults = [];
    let activeIndex = -1;
    let saving = false;

    const overlay = el("div", "lynx-rc-overlay");
    const dialog = el("section", "lynx-rc-dialog");
    dialog.id = "scenes-popup";
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    dialog.setAttribute("aria-labelledby", "lynx-rc-title");

    const header = el("header", "lynx-rc-dialog__header");
    const titleGroup = el("div", "lynx-rc-title-group");
    const icon = el("span", "lynx-rc-title-icon", config.icon);
    const titleText = el("div", "lynx-rc-title-text");
    const title = el("h2", "lynx-rc-title", `Add ${config.plural}`);
    title.id = "lynx-rc-title";
    const subtitle = el("div", "lynx-rc-subtitle", sceneTitle);
    subtitle.title = sceneTitle;
    titleText.append(title, subtitle);
    titleGroup.append(icon, titleText);

    const close = el("button", "lynx-rc-close", "×");
    close.type = "button";
    close.setAttribute("aria-label", "Close");
    close.addEventListener("click", closePicker);
    header.append(titleGroup, close);

    const searchArea = el("div", "lynx-rc-search-area");
    const searchWrap = el("div", "lynx-rc-search");
    const searchIcon = el("span", "lynx-rc-search__icon", "⌕");
    const search = document.createElement("input");
    search.type = "search";
    search.className = "lynx-rc-search__input";
    search.placeholder = `Search ${config.plural} by name…`;
    search.autocomplete = "off";
    search.spellcheck = false;
    search.setAttribute("aria-label", `Search ${config.plural}`);
    const clear = el("button", "lynx-rc-search__clear", "×");
    clear.type = "button";
    clear.setAttribute("aria-label", "Clear search");
    clear.hidden = true;
    clear.addEventListener("click", () => {
      search.value = "";
      clear.hidden = true;
      searchMeta.textContent = "Type at least one character";
      renderMessage(`Start typing to search ${config.plural}.`, "search");
      search.focus();
    });
    searchWrap.append(searchIcon, search, clear);
    const searchMeta = el("div", "lynx-rc-search-meta", "Type at least one character");
    searchArea.append(searchWrap, searchMeta);

    const selectedArea = el("div", "lynx-rc-selected");
    const selectedHeader = el("div", "lynx-rc-selected__header");
    const selectedLabel = el("span", "lynx-rc-selected__label", "Selected");
    const selectedStatus = el("span", "lynx-rc-selected__status", "None");
    selectedHeader.append(selectedLabel, selectedStatus);
    const selectedChips = el("div", "lynx-rc-selected__chips");
    selectedArea.append(selectedHeader, selectedChips);

    const results = el("div", "lynx-rc-results");
    results.setAttribute("role", "listbox");
    results.setAttribute("aria-multiselectable", "true");

    const footer = el("footer", "lynx-rc-dialog__footer");
    const keyboardHint = el(
      "div",
      "lynx-rc-keyboard-hint",
      "↑↓ Navigate  ·  Enter Select  ·  Esc Close"
    );
    const buttons = el("div", "lynx-rc-footer-buttons");
    const cancel = el("button", "lynx-rc-button lynx-rc-button--secondary", "Cancel");
    cancel.type = "button";
    cancel.addEventListener("click", closePicker);
    const add = el("button", "lynx-rc-button lynx-rc-button--primary", "Add selected");
    add.type = "button";
    add.disabled = true;
    buttons.append(cancel, add);
    footer.append(keyboardHint, buttons);

    dialog.append(header, searchArea, selectedArea, results, footer);
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);
    document.body.classList.add("lynx-rc-dialog-open");
    state.overlay = overlay;

    function renderMessage(message, kind = "info") {
      visibleResults = [];
      activeIndex = -1;
      results.replaceChildren();
      const box = el("div", `lynx-rc-empty lynx-rc-empty--${kind}`);
      box.append(el("span", "lynx-rc-empty__icon", kind === "error" ? "!" : "⌕"));
      box.append(el("span", "lynx-rc-empty__text", message));
      results.appendChild(box);
    }

    function updateSelectedArea() {
      selectedChips.replaceChildren();
      selectedStatus.textContent = selected.size ? `${selected.size} chosen` : "None";
      selectedArea.classList.toggle("has-selection", selected.size > 0);
      add.disabled = selected.size === 0 || saving;
      add.textContent = selected.size
        ? `Add selected (${selected.size})`
        : "Add selected";

      selected.forEach((item, id) => {
        const chip = el("button", "lynx-rc-chip");
        chip.type = "button";
        chip.title = `Remove ${config.getLabel(item)}`;
        chip.append(el("span", "lynx-rc-chip__text", config.getLabel(item)));
        chip.append(el("span", "lynx-rc-chip__remove", "×"));
        chip.addEventListener("click", () => {
          selected.delete(id);
          updateSelectedArea();
          renderRows(visibleResults, Number(searchMeta.dataset.total || visibleResults.length));
        });
        selectedChips.appendChild(chip);
      });
    }

    function setActiveRow(index) {
      const rows = Array.from(results.querySelectorAll(".lynx-rc-result:not(.is-existing)"));
      rows.forEach((row) => row.classList.remove("is-active"));
      if (!rows.length) {
        activeIndex = -1;
        return;
      }
      activeIndex = Math.max(0, Math.min(index, rows.length - 1));
      rows[activeIndex].classList.add("is-active");
      rows[activeIndex].scrollIntoView({ block: "nearest" });
    }

    function toggleItem(item) {
      const id = String(item.id);
      if (existingIds.has(id)) return;
      if (selected.has(id)) selected.delete(id);
      else selected.set(id, item);
      updateSelectedArea();
      renderRows(visibleResults, Number(searchMeta.dataset.total || visibleResults.length));
    }

    function renderRows(items, total) {
      visibleResults = items;
      activeIndex = -1;
      results.replaceChildren();
      searchMeta.dataset.total = String(total);
      searchMeta.textContent = total > items.length
        ? `${total.toLocaleString()} matches · showing first ${items.length}`
        : `${total.toLocaleString()} ${total === 1 ? "match" : "matches"}`;

      if (!items.length) {
        renderMessage("No matches. Try another spelling.", "info");
        return;
      }

      items.forEach((item) => {
        const id = String(item.id);
        const label = config.getLabel(item);
        const isExisting = existingIds.has(id);
        const isSelected = selected.has(id);
        const row = el("button", "lynx-rc-result");
        row.type = "button";
        row.setAttribute("role", "option");
        row.setAttribute("aria-selected", String(isSelected || isExisting));
        row.classList.toggle("is-selected", isSelected);
        row.classList.toggle("is-existing", isExisting);

        if (type === "Performers") {
          row.appendChild(renderAvatar(item, label));
        } else {
          row.append(el("span", "lynx-rc-entity-icon", config.icon));
        }

        const info = el("span", "lynx-rc-result__info");
        info.append(el("span", "lynx-rc-result__name", label));
        const metadata = el("span", "lynx-rc-result__metadata");

        if (item.disambiguation) {
          metadata.append(el("span", "lynx-rc-disambiguation", item.disambiguation));
        }
        if (item.gender) {
          const gender = el(
            "span",
            `lynx-rc-gender lynx-rc-gender--${item.gender.toLowerCase().replaceAll("_", "-")}`,
            genderLabel(item.gender)
          );
          metadata.append(gender);
        }
        if (!metadata.childNodes.length) {
          metadata.append(el("span", "lynx-rc-result__id", `ID ${id}`));
        }
        info.appendChild(metadata);
        row.appendChild(info);

        const marker = el(
          "span",
          "lynx-rc-result__marker",
          isExisting ? "Added" : isSelected ? "✓" : "+"
        );
        row.appendChild(marker);
        row.disabled = isExisting;
        row.addEventListener("click", () => toggleItem(item));
        results.appendChild(row);
      });
    }

    async function runSearch() {
      const query = search.value.trim();
      clear.hidden = !query;
      if (!query) {
        searchMeta.textContent = "Type at least one character";
        renderMessage(`Start typing to search ${config.plural}.`, "search");
        return;
      }

      state.requestController?.abort();
      const controller = new AbortController();
      state.requestController = controller;
      searchMeta.textContent = "Searching…";
      results.classList.add("is-loading");
      renderMessage("Searching…", "search");

      try {
        const data = await gql(
          config.query,
          { filter: query, perPage: RESULT_LIMIT },
          controller.signal
        );
        if (controller.signal.aborted || state.overlay !== overlay) return;
        const found = config.extract(data);
        renderRows(found?.[config.itemsField] || [], found?.count || 0);
      } catch (error) {
        if (error.name !== "AbortError") {
          console.error("Lynx picker search failed", error);
          searchMeta.textContent = "Search failed";
          renderMessage("Could not search Stash. Please try again.", "error");
        }
      } finally {
        if (state.requestController === controller) state.requestController = null;
        results.classList.remove("is-loading");
      }
    }

    search.addEventListener("input", () => {
      clear.hidden = !search.value;
      window.clearTimeout(state.searchTimer);
      state.searchTimer = window.setTimeout(runSearch, SEARCH_DELAY);
    });

    search.addEventListener("keydown", (event) => {
      const selectableRows = results.querySelectorAll(".lynx-rc-result:not(.is-existing)");
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setActiveRow(activeIndex + 1);
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        setActiveRow(activeIndex <= 0 ? selectableRows.length - 1 : activeIndex - 1);
      } else if (event.key === "Enter" && activeIndex >= 0) {
        event.preventDefault();
        selectableRows[activeIndex]?.click();
      }
    });

    add.addEventListener("click", async () => {
      if (!selected.size || saving) return;
      saving = true;
      add.disabled = true;
      cancel.disabled = true;
      add.classList.add("is-saving");
      add.textContent = "Saving…";

      try {
        const allIds = [...new Set([...existingIds, ...selected.keys()])];
        await updateScene(sceneId, config.updateField, allIds);
        const count = selected.size;
        closePicker();
        showToast(
          `Added ${count} ${count === 1 ? config.singular : config.plural} to the scene.`
        );
      } catch (error) {
        console.error("Lynx picker save failed", error);
        showToast(`Could not add ${config.plural}.`, "error");
        saving = false;
        cancel.disabled = false;
        add.classList.remove("is-saving");
        updateSelectedArea();
      }
    });

    overlay.addEventListener("mousedown", (event) => {
      if (event.target === overlay) closePicker();
    });

    dialog.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closePicker();
      } else if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
        event.preventDefault();
        if (!add.disabled) add.click();
      }
    });

    renderMessage(`Start typing to search ${config.plural}.`, "search");
    updateSelectedArea();
    search.focus({ preventScroll: true });

    fetchExistingIds(sceneId, config.existingField)
      .then((ids) => {
        if (state.overlay !== overlay) return;
        existingIds = ids;
        if (visibleResults.length) {
          renderRows(visibleResults, Number(searchMeta.dataset.total || visibleResults.length));
        }
      })
      .catch((error) => {
        console.error("Could not read current scene entities", error);
        showToast("Could not check items already on the scene.", "error");
      });
  }

  document.addEventListener("contextmenu", (event) => {
    const card = event.target.closest(".scene-card");
    if (!card) return;
    const sceneId = sceneIdFromCard(card);
    if (!sceneId) return;
    event.preventDefault();
    event.stopPropagation();
    createMenu(event, sceneId, sceneTitleFromCard(card));
  });

  document.addEventListener("mousedown", (event) => {
    if (state.menu && !state.menu.contains(event.target)) closeMenu();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && state.menu) closeMenu();
  });

  window.addEventListener("resize", closeMenu, { passive: true });
  window.addEventListener("scroll", closeMenu, { passive: true, capture: true });
})();

})(window.LynxToolsRuntime.fetchFor("stashRightClickScenes"));
