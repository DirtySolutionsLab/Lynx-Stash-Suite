(function(fetch){
(() => {
  "use strict";

  if (window.__lynxRightClickSettingsInstalled) return;
  window.__lynxRightClickSettingsInstalled = true;

  const UI = window.LynxRightClickUI;
  if (!UI) {
    console.error("Lynx Right Click Settings: shared UI did not load.");
    return;
  }

  const SETTINGS_SELECTOR = [
    'button[title="Settings"]',
    'a[title="Settings"]',
    'a[href="/settings"]'
  ].join(",");

  const PLUGIN_TASKS_QUERY = `
    query LynxPluginTasks {
      pluginTasks {
        plugin { id name }
        name
      }
    }
  `;

  const RUN_PLUGIN_TASK_MUTATION = `
    mutation LynxRunPluginTask($pluginID: ID!, $taskName: String!) {
      runPluginTask(plugin_id: $pluginID, task_name: $taskName)
    }
  `;

  const ALL_SCENES_QUERY = `
    query LynxDuplicateReview {
      allScenes {
        id
        title
        date
        created_at
        updated_at
        paths { screenshot }
        files {
          path
          size
          width
          height
          duration
          fingerprints { type value }
        }
      }
    }
  `;

  const DESTROY_SCENE_MUTATION = `
    mutation LynxDestroyScene($id: ID!, $deleteGenerated: Boolean!, $deleteFile: Boolean!) {
      sceneDestroy(input: { id: $id, delete_generated: $deleteGenerated, delete_file: $deleteFile })
    }
  `;

  const INTERFACE_CUSTOMIZATIONS_QUERY = `
    query LynxInterfaceCustomizations {
      configuration {
        interface {
          css
          cssEnabled
          javascript
          javascriptEnabled
        }
      }
    }
  `;

  const CONFIGURE_INTERFACE_MUTATION = `
    mutation LynxConfigureInterface($input: ConfigInterfaceInput!) {
      configureInterface(input: $input) {
        css
        cssEnabled
        javascript
        javascriptEnabled
      }
    }
  `;

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = String(text);
    return node;
  }

  function formatBytes(value) {
    const bytes = Number(value || 0);
    if (!bytes) return "0 B";
    const units = ["B", "KB", "MB", "GB", "TB"];
    const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    return `${(bytes / (1024 ** index)).toFixed(index > 1 ? 2 : 0)} ${units[index]}`;
  }

  function formatDuration(value) {
    const total = Math.max(0, Math.round(Number(value || 0)));
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const seconds = total % 60;
    return hours
      ? `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
      : `${minutes}:${String(seconds).padStart(2, "0")}`;
  }

  function navigateToSettings() {
    if (location.pathname !== "/settings") location.assign("/settings");
  }

  function openEditorDialog(kind, interfaceConfig) {
    document.querySelector(".lynx-settings-editor-overlay")?.remove();

    const isCSS = kind === "css";
    const valueKey = isCSS ? "css" : "javascript";
    const enabledKey = isCSS ? "cssEnabled" : "javascriptEnabled";
    const label = isCSS ? "Custom CSS" : "Custom JavaScript";
    let savedValue = interfaceConfig[valueKey] || "";
    let savedEnabled = Boolean(interfaceConfig[enabledKey]);
    let dirty = false;
    let saving = false;

    const overlay = el("div", "lynx-settings-editor-overlay");
    const editor = el("section", "lynx-settings-editor");
    editor.setAttribute("role", "dialog");
    editor.setAttribute("aria-modal", "true");
    editor.setAttribute("aria-label", `Edit ${label}`);

    const header = el("header", "lynx-settings-editor__header");
    const titleWrap = el("div", "lynx-settings-editor__title-wrap");
    titleWrap.append(el("span", "lynx-settings-editor__icon", isCSS ? "{ }" : "JS"));
    const headings = el("div");
    headings.append(el("h2", "lynx-settings-editor__title", label));
    headings.append(el("p", "lynx-settings-editor__subtitle", "Editing in place — the page behind stays open"));
    titleWrap.append(headings);
    const closeButton = el("button", "lynx-settings-editor__close", "×");
    closeButton.type = "button";
    closeButton.setAttribute("aria-label", "Close editor");
    header.append(titleWrap, closeButton);

    const toolbar = el("div", "lynx-settings-editor__toolbar");
    const enabledLabel = el("label", "lynx-settings-editor__enabled");
    const enabled = document.createElement("input");
    enabled.type = "checkbox";
    enabled.checked = savedEnabled;
    enabledLabel.append(enabled, el("span", "lynx-settings-editor__switch"), el("span", "lynx-settings-editor__enabled-text", "Enabled"));
    const hint = el("span", "lynx-settings-editor__hint", "Ctrl/Cmd + S to save");
    toolbar.append(enabledLabel, hint);

    const textarea = document.createElement("textarea");
    textarea.className = "lynx-settings-editor__textarea";
    textarea.value = savedValue;
    textarea.spellcheck = false;
    textarea.autocapitalize = "off";
    textarea.autocomplete = "off";
    textarea.wrap = "off";
    textarea.setAttribute("aria-label", label);

    const footer = el("footer", "lynx-settings-editor__footer");
    const status = el("span", "lynx-settings-editor__status");
    const buttons = el("div", "lynx-settings-editor__buttons");
    const cancel = el("button", "lynx-rc-button lynx-rc-button--secondary", "Cancel");
    cancel.type = "button";
    const save = el("button", "lynx-rc-button lynx-rc-button--primary", "Save changes");
    save.type = "button";
    buttons.append(cancel, save);
    footer.append(status, buttons);

    editor.append(header, toolbar, textarea, footer);
    overlay.append(editor);
    document.body.append(overlay);
    document.body.classList.add("lynx-settings-editor-open");

    function updateState() {
      dirty = textarea.value !== savedValue || enabled.checked !== savedEnabled;
      const lines = textarea.value ? textarea.value.split("\n").length : 1;
      status.textContent = `${lines.toLocaleString()} lines · ${textarea.value.length.toLocaleString()} characters${dirty ? " · Unsaved" : ""}`;
      status.classList.toggle("is-dirty", dirty);
      save.disabled = saving || !dirty;
    }

    function closeNow() {
      document.removeEventListener("keydown", onDocumentKeydown, true);
      document.body.classList.remove("lynx-settings-editor-open");
      overlay.remove();
    }

    function requestClose() {
      if (!dirty || saving) {
        closeNow();
        return;
      }
      UI.confirm({
        title: "Discard unsaved changes?",
        subtitle: label,
        message: "The changes in this editor have not been saved.",
        detail: "The current saved customization will remain unchanged.",
        icon: "!",
        confirmLabel: "Discard changes",
        danger: true,
        onConfirm: closeNow
      });
    }

    async function saveChanges() {
      if (!dirty || saving) return;
      saving = true;
      updateState();
      save.textContent = "Saving…";
      cancel.disabled = true;
      try {
        const input = isCSS
          ? { css: textarea.value, cssEnabled: enabled.checked }
          : { javascript: textarea.value, javascriptEnabled: enabled.checked };
        await UI.gql(CONFIGURE_INTERFACE_MUTATION, { input });
        savedValue = textarea.value;
        savedEnabled = enabled.checked;
        saving = false;
        cancel.disabled = false;
        save.textContent = "Save changes";
        updateState();
        UI.toast(`${label} saved. Reload the page when you want it applied.`, "success");
      } catch (error) {
        console.error(`Lynx ${label} save failed`, error);
        saving = false;
        cancel.disabled = false;
        save.textContent = "Save changes";
        updateState();
        UI.toast(`${label} could not be saved.`, "error");
      }
    }

    function onDocumentKeydown(event) {
      if (document.querySelector(".lynx-rc-overlay")) return;
      if (event.key === "Escape") {
        event.preventDefault();
        requestClose();
      } else if ((event.ctrlKey || event.metaKey) && event.key.toLocaleLowerCase() === "s") {
        event.preventDefault();
        saveChanges();
      }
    }

    textarea.addEventListener("input", updateState);
    enabled.addEventListener("change", updateState);
    textarea.addEventListener("keydown", (event) => {
      if (event.key !== "Tab") return;
      event.preventDefault();
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      textarea.setRangeText("  ", start, end, "end");
      updateState();
    });
    closeButton.addEventListener("click", requestClose);
    cancel.addEventListener("click", requestClose);
    save.addEventListener("click", saveChanges);
    overlay.addEventListener("mousedown", (event) => { if (event.target === overlay) requestClose(); });
    document.addEventListener("keydown", onDocumentKeydown, true);

    updateState();
    textarea.focus({ preventScroll: true });
  }

  async function openCodeEditor(kind) {
    const label = kind === "css" ? "Custom CSS" : "Custom JavaScript";
    UI.toast(`Loading ${label}…`);
    try {
      const data = await UI.gql(INTERFACE_CUSTOMIZATIONS_QUERY);
      openEditorDialog(kind, data.configuration?.interface || {});
    } catch (error) {
      console.error(`Lynx ${label} load failed`, error);
      UI.toast(`${label} could not be loaded.`, "error");
    }
  }

  async function openPluginTasks() {
    UI.toast("Loading plugin tasks…");
    try {
      const data = await UI.gql(PLUGIN_TASKS_QUERY);
      const tasks = (data.pluginTasks || []).map((task, index) => ({
        id: `${task.plugin.id}:${index}:${task.name}`,
        pluginId: String(task.plugin.id),
        pluginName: task.plugin.name || "Unnamed plugin",
        name: task.name || "Unnamed task",
        disambiguation: task.plugin.name || "Unnamed plugin"
      })).sort((a, b) => `${a.pluginName} ${a.name}`.localeCompare(`${b.pluginName} ${b.name}`));

      if (!tasks.length) {
        UI.toast("No plugin tasks are available.");
        return;
      }

      UI.openPicker({
        title: "Run plugin task",
        subtitle: "Search by plugin or task name",
        icon: "⚙",
        plural: "plugin tasks",
        placeholder: "Search plugin tasks…",
        single: true,
        staticItems: tasks,
        getLabel: (task) => task.name,
        getSearchText: (task) => `${task.pluginName} ${task.name}`,
        getMeta: (task) => task.pluginName,
        saveLabel: "Run task",
        errorMessage: "The plugin task could not be started.",
        onSave: async (_ids, selected) => {
          const task = selected[0];
          await UI.gql(RUN_PLUGIN_TASK_MUTATION, { pluginID: task.pluginId, taskName: task.name });
          UI.toast(`${task.pluginName}: ${task.name} started.`, "success");
        }
      });
    } catch (error) {
      console.error("Lynx plugin task lookup failed", error);
      UI.toast("Could not load plugin tasks.", "error");
    }
  }

  function fingerprint(file, type) {
    return (file?.fingerprints || []).find((item) => item.type === type)?.value || "";
  }

  function analyseScenes(scenes) {
    const hashMap = new Map();
    const titleMap = new Map();
    const duplicateFiles = [];
    const duplicateTitles = [];
    const missingFiles = [];

    scenes.forEach((scene) => {
      const files = scene.files || [];
      if (!files.length) missingFiles.push(scene);

      files.forEach((file) => {
        const hash = fingerprint(file, "SHA-256");
        if (!hash) return;
        if (hashMap.has(hash)) duplicateFiles.push({ original: hashMap.get(hash), duplicate: { scene, file }, hash });
        else hashMap.set(hash, { scene, file });
      });

      const titleKey = String(scene.title || "").trim().replace(/\s+/g, " ").toLocaleLowerCase();
      if (!titleKey) return;
      if (titleMap.has(titleKey)) duplicateTitles.push({ original: titleMap.get(titleKey), duplicate: scene });
      else titleMap.set(titleKey, scene);
    });

    return { duplicateFiles, duplicateTitles, missingFiles };
  }

  function sceneImage(scene) {
    if (!scene.paths?.screenshot) return el("div", "lynx-settings-scene__placeholder", "No preview");
    const image = document.createElement("img");
    image.className = "lynx-settings-scene__image";
    image.src = scene.paths.screenshot;
    image.alt = "";
    image.loading = "lazy";
    return image;
  }

  function detailLine(label, value, mono = false) {
    const row = el("div", "lynx-settings-detail");
    row.append(el("span", "lynx-settings-detail__label", label));
    const valueNode = el("span", `lynx-settings-detail__value${mono ? " is-mono" : ""}`, value || "—");
    row.append(valueNode);
    return row;
  }

  function removeDeletedScene(review, sceneId) {
    review.querySelectorAll(".lynx-settings-scene").forEach((card) => {
      if (card.dataset.sceneId === String(sceneId)) card.remove();
    });
    review.querySelectorAll(".lynx-settings-pair, .lynx-settings-single").forEach((row) => {
      if (!row.querySelector(".lynx-settings-scene")) row.remove();
    });
    review.querySelectorAll(".lynx-settings-section").forEach((section) => {
      if (!section.querySelector(".lynx-settings-scene")) section.remove();
    });
  }

  function confirmDelete(scene, deleteFile, review) {
    const title = scene.title || `Scene ${scene.id}`;
    UI.confirm({
      title: deleteFile ? "Delete scene and local file?" : "Remove scene from Stash?",
      subtitle: title,
      message: deleteFile
        ? "This removes the Stash entry, generated files and the local media file."
        : "This removes the Stash entry and generated files, but keeps the local media file.",
      detail: deleteFile
        ? "The local file cannot be restored by this plugin."
        : "You can scan the library later to add the kept file again.",
      icon: "!",
      confirmLabel: deleteFile ? "Delete file and entry" : "Remove entry",
      danger: true,
      onConfirm: async () => {
        await UI.gql(DESTROY_SCENE_MUTATION, {
          id: String(scene.id),
          deleteGenerated: true,
          deleteFile: Boolean(deleteFile)
        });
        removeDeletedScene(review, scene.id);
        UI.toast(deleteFile ? "Scene and local file deleted." : "Scene removed; local file kept.", "success");
      }
    });
  }

  function renderSceneCard(scene, file, review, badge) {
    const card = el("article", "lynx-settings-scene");
    card.dataset.sceneId = String(scene.id);

    const media = el("a", "lynx-settings-scene__media");
    media.href = `/scenes/${scene.id}`;
    media.append(sceneImage(scene));
    if (badge) media.append(el("span", "lynx-settings-scene__badge", badge));

    const body = el("div", "lynx-settings-scene__body");
    const title = el("a", "lynx-settings-scene__title", scene.title || "Untitled scene");
    title.href = `/scenes/${scene.id}`;
    body.append(title);

    const details = el("div", "lynx-settings-scene__details");
    details.append(detailLine("Scene ID", scene.id));
    if (scene.date) details.append(detailLine("Date", scene.date));
    if (file) {
      const resolution = file.width && file.height ? `${file.width} × ${file.height}` : "—";
      details.append(detailLine("Size", formatBytes(file.size)));
      details.append(detailLine("Video", `${resolution} · ${formatDuration(file.duration)}`));
      details.append(detailLine("Path", file.path, true));
      const hash = fingerprint(file, "SHA-256");
      if (hash) details.append(detailLine("SHA-256", hash, true));
    } else {
      details.append(detailLine("File", "No local file linked"));
    }
    body.append(details);

    const actions = el("div", "lynx-settings-scene__actions");
    const keepFile = el("button", "lynx-settings-action", "Remove entry");
    keepFile.type = "button";
    keepFile.addEventListener("click", () => confirmDelete(scene, false, review));
    const deleteFile = el("button", "lynx-settings-action is-danger", "Delete entry + file");
    deleteFile.type = "button";
    deleteFile.disabled = !(scene.files || []).length;
    deleteFile.title = deleteFile.disabled ? "This scene has no linked local file" : "Delete the Stash entry and its local media file";
    deleteFile.addEventListener("click", () => confirmDelete(scene, true, review));
    actions.append(keepFile, deleteFile);
    body.append(actions);

    card.append(media, body);
    return card;
  }

  function buildSection(review, kind, title, description, rows) {
    if (!rows.length) return null;
    const section = el("section", "lynx-settings-section");
    section.dataset.kind = kind;
    const head = el("header", "lynx-settings-section__header");
    const headingWrap = el("div");
    headingWrap.append(el("h3", "lynx-settings-section__title", title));
    headingWrap.append(el("p", "lynx-settings-section__description", description));
    head.append(headingWrap, el("span", "lynx-settings-count", rows.length));
    section.append(head);
    return section;
  }

  function openDuplicateReview(results) {
    document.querySelector(".lynx-settings-review-overlay")?.remove();

    const overlay = el("div", "lynx-settings-review-overlay");
    const review = el("section", "lynx-settings-review");
    review.setAttribute("role", "dialog");
    review.setAttribute("aria-modal", "true");

    const header = el("header", "lynx-settings-review__header");
    const titleWrap = el("div", "lynx-settings-review__title-wrap");
    titleWrap.append(el("span", "lynx-settings-review__icon", "⌁"));
    const heading = el("div");
    heading.append(el("h2", "lynx-settings-review__title", "Duplicate review"));
    heading.append(el("p", "lynx-settings-review__subtitle", "Compare carefully before removing anything"));
    titleWrap.append(heading);
    const close = el("button", "lynx-settings-review__close", "×");
    close.type = "button";
    close.setAttribute("aria-label", "Close duplicate review");
    header.append(titleWrap, close);

    const filters = el("nav", "lynx-settings-filters");
    const filterData = [
      ["all", "All", results.duplicateFiles.length + results.duplicateTitles.length + results.missingFiles.length],
      ["files", "Same file", results.duplicateFiles.length],
      ["titles", "Same title", results.duplicateTitles.length],
      ["missing", "No file", results.missingFiles.length]
    ];
    filterData.forEach(([kind, label, count], index) => {
      const button = el("button", `lynx-settings-filter${index === 0 ? " is-active" : ""}`);
      button.type = "button";
      button.dataset.filter = kind;
      button.disabled = kind !== "all" && count === 0;
      button.append(el("span", "lynx-settings-filter__label", label), el("span", "lynx-settings-filter__count", count));
      filters.append(button);
    });

    const content = el("div", "lynx-settings-review__content");
    review.append(header, filters, content);
    overlay.append(review);
    document.body.append(overlay);

    const fileSection = buildSection(
      review,
      "files",
      "Identical local files",
      "Same SHA-256 fingerprint. The smaller copy is marked only as a visual hint.",
      results.duplicateFiles
    );
    results.duplicateFiles.forEach((item) => {
      const row = el("div", "lynx-settings-pair");
      const originalSize = Number(item.original.file?.size || 0);
      const duplicateSize = Number(item.duplicate.file?.size || 0);
      row.append(
        renderSceneCard(item.original.scene, item.original.file, review, originalSize && originalSize <= duplicateSize ? "Smaller copy" : "First found"),
        renderSceneCard(item.duplicate.scene, item.duplicate.file, review, duplicateSize && duplicateSize < originalSize ? "Smaller copy" : "Duplicate")
      );
      fileSection?.append(row);
    });
    if (fileSection) content.append(fileSection);

    const titleSection = buildSection(
      review,
      "titles",
      "Matching titles",
      "These scenes share the same normalized title but may contain different media.",
      results.duplicateTitles
    );
    results.duplicateTitles.forEach((item) => {
      const row = el("div", "lynx-settings-pair");
      row.append(
        renderSceneCard(item.original, item.original.files?.[0], review, "First found"),
        renderSceneCard(item.duplicate, item.duplicate.files?.[0], review, "Same title")
      );
      titleSection?.append(row);
    });
    if (titleSection) content.append(titleSection);

    const missingSection = buildSection(
      review,
      "missing",
      "Scenes without files",
      "Database entries that currently have no local media file linked.",
      results.missingFiles
    );
    results.missingFiles.forEach((scene) => {
      const row = el("div", "lynx-settings-single");
      row.append(renderSceneCard(scene, null, review, "No file"));
      missingSection?.append(row);
    });
    if (missingSection) content.append(missingSection);

    const closeReview = () => {
      overlay.remove();
      document.removeEventListener("keydown", onKeydown, true);
    };
    const onKeydown = (event) => {
      if (event.key === "Escape" && !document.querySelector(".lynx-rc-overlay")) closeReview();
    };
    close.addEventListener("click", closeReview);
    overlay.addEventListener("mousedown", (event) => { if (event.target === overlay) closeReview(); });
    document.addEventListener("keydown", onKeydown, true);

    filters.addEventListener("click", (event) => {
      const button = event.target.closest(".lynx-settings-filter");
      if (!button || button.disabled) return;
      filters.querySelectorAll(".lynx-settings-filter").forEach((item) => item.classList.toggle("is-active", item === button));
      const filter = button.dataset.filter;
      content.querySelectorAll(".lynx-settings-section").forEach((section) => {
        section.hidden = filter !== "all" && section.dataset.kind !== filter;
      });
      content.scrollTop = 0;
    });

    close.focus({ preventScroll: true });
  }

  async function runDuplicateCheck() {
    UI.toast("Checking the scene library…");
    const data = await UI.gql(ALL_SCENES_QUERY);
    const results = analyseScenes(data.allScenes || []);
    const total = results.duplicateFiles.length + results.duplicateTitles.length + results.missingFiles.length;
    if (!total) {
      UI.toast("No duplicate files, matching titles or fileless scenes found.", "success");
      return;
    }
    window.setTimeout(() => openDuplicateReview(results), 0);
  }

  function confirmDuplicateCheck() {
    UI.confirm({
      title: "Check the scene library?",
      subtitle: "Duplicate review",
      message: "Stash will read all scene entries and compare SHA-256 fingerprints and titles.",
      detail: "Large libraries may take a little while. Nothing is removed during the check.",
      icon: "⌁",
      confirmLabel: "Run check",
      onConfirm: runDuplicateCheck
    });
  }

  function showSettingsMenu(event) {
    UI.showMenu({
      x: event.clientX,
      y: event.clientY,
      heading: "Settings actions",
      actions: [
        { label: "Open settings", icon: "⚙", onClick: navigateToSettings },
        { label: "Run plugin task…", icon: "▶", onClick: openPluginTasks },
        { divider: true },
        { label: "Edit Custom CSS…", icon: "{ }", onClick: () => openCodeEditor("css") },
        { label: "Edit Custom JavaScript…", icon: "JS", onClick: () => openCodeEditor("javascript") },
        { divider: true },
        { label: "Duplicate checker…", icon: "⌁", onClick: confirmDuplicateCheck }
      ]
    });
  }

  document.addEventListener("contextmenu", (event) => {
    const target = event.target.closest?.(SETTINGS_SELECTOR);
    if (!target) return;
    const settingsLink = target.matches('a[href="/settings"]') ? target : target.closest('a[href="/settings"]');
    const settingsButton = target.matches('button[title="Settings"]') ? target : target.querySelector?.('button[title="Settings"]');
    if (!settingsLink && !settingsButton && !target.matches('[title="Settings"]')) return;
    event.preventDefault();
    event.stopPropagation();
    showSettingsMenu(event);
  }, true);

})();

})(window.LynxToolsRuntime.fetchFor("stashRightClickSettings"));
