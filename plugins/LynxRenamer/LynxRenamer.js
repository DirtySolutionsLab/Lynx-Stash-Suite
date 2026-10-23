(function(fetch){
(function () {
  "use strict";

  if (window.__lynxRenamerLoaded) return;
  window.__lynxRenamerLoaded = true;

  const PLUGIN_ID = "LynxRenamer";
  const ROOT_ID = "lynx-renamer-settings";

  const DEFAULTS = {
    tag_templates: {},
    studio_templates: {},
    use_default_template: true,
    default_template: "{$date - }$title",
    p_tag_templates: {},
    p_studio_templates: {},
    p_path_templates: {},
    p_use_default_template: false,
    p_default_template: "",
    p_non_organized: "",
    p_tag_option: {},
    log_file: "",
    associated_extension: ["srt", "vtt", "funscript"],
    filename_as_title: false,
    filename_splitchar: " ",
    field_whitespaceSeperator: "",
    field_replacer: {},
    replace_words: {},
    date_format: "%Y-%m-%d",
    duration_format: "",
    lowercase_Filename: false,
    titlecase_Filename: false,
    removecharac_Filename: ",#",
    performer_splitchar: " ",
    performer_limit: 3,
    performer_limit_keep: false,
    performer_sort: "id",
    performer_ignoreGender: [],
    performer_sortGender: [],
    duplicate_suffix: ["", "_1", "_2", "_3", "_4", "_5", "_6", "_7", "_8", "_9", "_10"],
    prevent_title_performer: false,
    prevent_consecutive: true,
    remove_emptyfolder: false,
    path_one_performer: true,
    path_noperformer_folder: false,
    path_keep_alrperf: true,
    prepositions_list: ["The", "A", "An"],
    prepositions_removal: false,
    squeeze_studio_names: false,
    rating_format: "{}",
    tags_splitchar: " ",
    tags_whitelist: [],
    tags_blacklist: [],
    only_organized: false,
    ignore_path_length: false,
    order_field: ["$video_codec", "$audio_codec", "$resolution", "tags", "rating", "$height", "$studio_family", "$studio", "$parent_studio", "$performer"],
    alt_diff_display: false,
    batch_number_scene: -1,
    enable_hook: false,
    dry_run: true,
    dry_run_append: true,
    process_getall: false,
    process_kill_attach: false,
    use_ascii: false,
    require_fields: true,
    exclude_enabled: false,
    exclude_tag_patterns: {},
    exclude_studio_patterns: {},
    exclude_path_patterns: {}
  };

  const SAMPLE = {
    "$performer": "Alexa Staci",
    "$studio": "Grooby Girls",
    "$parent_studio": "Grooby",
    "$studio_family": "Grooby",
    "$title": "A Perfect Scene",
    "$date": "2019-04-11",
    "$date_format": "2019-04-11",
    "$year": "2019",
    "$height": "1080p",
    "$resolution": "HD",
    "$duration": "00-26-46",
    "$rating": "5",
    "$tags": "Trans Glamour",
    "$movie_title": "A Perfect Movie",
    "$movie_year": "2019",
    "$movie_scene": "Scene 1",
    "$studio_code": "GG-2019-0411"
  };

  const MAP_LABELS = {
    tag_templates: "Filename when a tag matches",
    studio_templates: "Filename when a studio matches",
    p_tag_templates: "Destination when a tag matches",
    p_studio_templates: "Destination when a studio matches",
    p_path_templates: "Move based on current path"
  };

  const EXCLUDE_LABELS = {
    exclude_tag_patterns: "Tags",
    exclude_studio_patterns: "Studios",
    exclude_path_patterns: "Paths"
  };

  let state = clone(DEFAULTS);
  let activeRuleMap = "tag_templates";
  let activeExcludeMap = "exclude_tag_patterns";
  let savedState = clone(DEFAULTS);
  let activeTemplateInput = null;
  let ready = false;
  let lastPreviewSignature = null;
  const PRESETS = {
    standard: ['Performer — title [studio]', '$performer - $title {[$studio]}'],
    dated: ['Date — performer — title', '{$date - }$performer - $title'],
    studio: ['Studio — date — title', '{[$studio] }{$date - }$title'],
    compact: ['Title only', '$title'],
    quality: ['Performer — title — quality', '$performer - $title {[$height]}']
  };
  function destinationTemplate(base, layout) {
    const original = String(base || '').trim();
    const folder = /^[a-z]:[\\/]$/i.test(original)||original==='/' ? original : original.replace(/[\\/]+$/, '');
    if (!folder || !(/^[a-z]:[\\/]/i.test(folder) || folder.startsWith('/') || folder.startsWith('\\\\'))) throw Error('Enter an absolute destination folder, such as D:\\Media or /media/videos.');
    const separator = folder.includes('\\') ? '\\' : '/';
    const layouts = {studio: '$studio', performer: '$performer', studioPerformer: '$studio'+separator+'$performer', performerStudio: '$performer'+separator+'$studio', flat: ''};
    if (!(layout in layouts)) throw Error('Choose a destination layout.');
    return folder + (layouts[layout] ? (/[\\/]$/.test(folder)?'':separator) + layouts[layout] : '');
  }
  function tokenIssues(template) {
    const allowed = new Set([...Object.keys(SAMPLE), '$oshash', '$checksum', '$bitrate', '$video_codec', '$audio_codec', '$movie_year', '$stashid_scene', '$stashid_performer', '$studio_hierarchy']);
    return [...new Set((String(template||'').match(/\$[a-zA-Z_]+/g)||[]).filter(token=>!allowed.has(token)))];
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function esc(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function mergeSaved(saved) {
    const merged = clone(DEFAULTS);
    Object.keys(saved || {}).forEach((key) => {
      merged[key] = clone(saved[key]);
    });
    return merged;
  }

  async function gql(query, variables) {
    const response = await fetch("/graphql", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, variables: variables || {} })
    });
    const payload = await response.json();
    if (!response.ok || payload.errors) {
      throw new Error(payload.errors?.map((item) => item.message).join("; ") || `HTTP ${response.status}`);
    }
    return payload.data;
  }

  async function loadSettings() {
    const result = await operation({mode:'settings'});
    if (!result.settings || typeof result.settings !== 'object') throw Error('Could not read effective Renamer settings. Install the matching Python update and reload plugins.');
    return mergeSaved(result.settings);
  }

  async function operation(args) {
    const data = await gql('mutation($id:ID!,$args:Map!){runPluginOperation(plugin_id:$id,args:$args)}',{id:PLUGIN_ID,args});
    let result=data.runPluginOperation;
    if(typeof result==='string')result=JSON.parse(result);
    if(result?.error)throw Error(result.error);
    if(result?.output)result=typeof result.output==='string'?JSON.parse(result.output):result.output;
    if(!result||result.error)throw Error(result?.error||'The Renamer returned no result.');
    return result;
  }

  async function writeSettings() {
    const latest=await gql('query {configuration{plugins}}');
    const previous=latest.configuration?.plugins?.[PLUGIN_ID]||{};
    await gql(
      `mutation SaveLynxRenamer($input: Map!) {
         configurePlugin(plugin_id: "LynxRenamer", input: $input)
       }`,
      { input: { ...previous, configJson: JSON.stringify(state) } }
    );
  }

  function templatePreview(template) {
    let result = String(template || "");
    result = result.replace(/\{([^{}]*)\}/g, (_match, group) => {
      const tokens = group.match(/\$[a-zA-Z_]+/g) || [];
      return tokens.every((token) => SAMPLE[token]) ? group : "";
    });
    Object.keys(SAMPLE)
      .sort((a, b) => b.length - a.length)
      .forEach((token) => {
        result = result.split(token).join(SAMPLE[token]);
      });
    if (state.removecharac_Filename) {
      for (const char of state.removecharac_Filename) result = result.split(char).join("");
    }
    if (state.field_whitespaceSeperator) result = result.replace(/\s+/g, state.field_whitespaceSeperator);
    if (state.filename_splitchar !== " ") result = result.replace(/\s+/g, state.filename_splitchar);
    result = result.replace(/\s+/g, " ").trim();
    if (state.lowercase_Filename) result = result.toLowerCase();
    else if (state.titlecase_Filename) {
      result = result.replace(/\b\p{L}/gu, (letter) => letter.toUpperCase());
    }
    return result || "Untitled";
  }

  function updatePreview(root) {
    const filename = templatePreview(state.default_template) + ".mp4";
    const filenameEl = root.querySelector("[data-preview-filename]");
    if (filenameEl) filenameEl.textContent = filename;

    let pathTemplate = state.p_use_default_template ? state.p_default_template : "";
    if (!pathTemplate) pathTemplate = "No default destination. Matching move rules may still apply.";
    const pathEl = root.querySelector("[data-preview-path]");
    if (pathEl) pathEl.textContent = state.p_use_default_template && state.p_default_template ? templatePreview(pathTemplate) : pathTemplate;
    const summary=root.querySelector('[data-workflow-status]');
    const moveRules=['p_tag_templates','p_studio_templates','p_path_templates'].reduce((n,key)=>n+Object.keys(state[key]||{}).length,0);
    if(summary)summary.textContent=`${state.enable_hook?'Automatic on scene update: ON':'Automatic on scene update: OFF'} · ${state.dry_run?'Dry-run: ON (no file changes)':'Dry-run: OFF (live file changes)'} · ${moveRules} conditional move rules${state.p_non_organized?' + unorganized destination':''}. Saving settings does not run a rename, but enabled automation uses them on future updates.`;
    const fresh=root.querySelector('[data-preview-fresh]');
    if(fresh)fresh.textContent=lastPreviewSignature===JSON.stringify(state)?'Calculated for the current draft. No changes were made.':'Draft changed after this preview. Preview the scene again before using these paths.';
  }

  function field(label, key, type = "text", extra = "") {
    if (type === "checkbox") {
      return `<label class="lrx-switch"><input type="checkbox" data-key="${key}"><span>${label}</span></label>`;
    }
    if (type === "textarea") {
      return `<label class="lrx-field"><span>${label}</span><textarea data-key="${key}" ${extra}></textarea></label>`;
    }
    return `<label class="lrx-field"><span>${label}</span><input type="${type}" data-key="${key}" ${extra}></label>`;
  }

  function selectField(label, key, options) {
    return `<label class="lrx-field"><span>${label}</span><select data-key="${key}">${options.map(([value, text]) => `<option value="${esc(value)}">${esc(text)}</option>`).join("")}</select></label>`;
  }

  function panelMarkup() {
    return `
      <section class="lrx-shell">
        <header class="lrx-header">
          <div class="lrx-brand"><div class="lrx-logo">L</div><div><h2>Lynx Renamer</h2><p>Build a name. Choose a folder. Preview before saving.</p></div></div>
          <label class="lrx-hook"><input type="checkbox" data-key="enable_hook"><span class="lrx-hook-dot"></span><span data-hook-label>Hook enabled</span></label>
        </header>

        <div class="lrx-intro"><ol><li><strong>Filename</strong> — choose a preset or insert fields into your own name.</li><li><strong>Move files</strong> — choose a root folder and folder layout, or keep current folders.</li><li><strong>Preview a scene</strong> — inspect the calculated before/after paths without saving or moving files.</li></ol><p data-workflow-status></p></div>
        <div class="lrx-body">
          <nav class="lrx-nav" aria-label="Lynx Renamer sections">
            <button type="button" class="active" data-lrx-tab="filename">Filename</button>
            <button type="button" data-lrx-tab="move">Move files</button>
            <button type="button" data-lrx-tab="performers">Performers</button>
            <button type="button" data-lrx-tab="rules">Rules</button>
            <button type="button" data-lrx-tab="exclude">Exclusions</button>
            <button type="button" data-lrx-tab="advanced">Advanced</button>
          </nav>

          <main class="lrx-content">
            <section class="lrx-tab active" data-lrx-panel="filename">
              <div class="lrx-section-title"><div><h3>1. Build the filename</h3><p>Start with a preset, then add fields and punctuation. Do not add the file extension; the original extension is kept.</p></div></div>
              <div class="lrx-two-col">
                <div class="lrx-card lrx-form-grid">
                  <div class="lrx-guided-row"><label class="lrx-field"><span>Start from a naming preset</span><select data-filename-preset>${Object.entries(PRESETS).map(([key,value])=>`<option value="${key}">${esc(value[0])}</option>`).join('')}</select></label><button type="button" class="lrx-button" data-apply-preset>Use this preset</button></div>
                  ${field("Filename pattern", "default_template", "text", "data-template-field")}
                  <div class="lrx-tokens" data-token-list></div>
                  <p class="lrx-help">Click a field to insert it at the cursor. For example, <code>$performer - $title {[$studio]}</code>. Braces make a group optional when its fields are missing. Tag/studio filename rules can override this default.</p>
                  ${field("Use the default template when no rule matches", "use_default_template", "checkbox")}
                  <details class="lrx-options"><summary>Formatting and processing filters</summary>
                  ${selectField("Filename spaces", "filename_splitchar", [[" ", "Space"], [".", "Dot ."], ["_", "Underscore _"]])}
                  ${field("Characters to remove", "removecharac_Filename")}
                  <div class="lrx-inline">
                    ${field("Title case", "titlecase_Filename", "checkbox")}
                    ${field("Lowercase", "lowercase_Filename", "checkbox")}
                  </div>
                  ${field("Use the filename as title when title is missing", "filename_as_title", "checkbox")}
                  ${field("Require mandatory fields", "require_fields", "checkbox")}
                  ${field("Only process organized scenes (rename and move)", "only_organized", "checkbox")}
                  </details>
                </div>
                <aside class="lrx-preview">
                  <span>Illustrative example — not a real scene</span>
                  <strong data-preview-filename></strong>
                  <small>Destination</small>
                  <code data-preview-path></code>
                  <small>Uses bundled example metadata, not your actual tags or rule matches. Use Preview a scene below for the engine-calculated result.</small>
                </aside>
              </div>
            </section>

            <section class="lrx-tab" data-lrx-panel="move">
              <div class="lrx-section-title"><div><h3>2. Choose where files go</h3><p>A destination is a folder, not a full filename. Tag rules override studio rules, which override current-path rules, then the default. The unorganized destination overrides these for unorganized scenes.</p></div></div>
              <div class="lrx-card lrx-form-grid">
                <div class="lrx-guided-row"><label class="lrx-field"><span>Destination root folder</span><input data-destination-root placeholder="D:\\Media or /media/videos"></label><label class="lrx-field"><span>Create subfolders by</span><select data-destination-layout><option value="studioPerformer">Studio / Performer</option><option value="performerStudio">Performer / Studio</option><option value="studio">Studio</option><option value="performer">Performer</option><option value="flat">No subfolders</option></select></label></div>
                <div class="lrx-guided-row"><button type="button" class="lrx-button" data-build-destination>Use this default destination</button><button type="button" class="lrx-button" data-keep-folders>Keep current folders — clear move rules</button></div>
                <p class="lrx-help">The builder changes only the draft default destination. Existing conditional rules are kept and may take priority. The keep-folders action explicitly clears all move routes in the draft after confirmation. Neither action moves files.</p>
                ${field("Use default destination", "p_use_default_template", "checkbox")}
                ${field("Destination folder pattern", "p_default_template", "text", "data-template-field")}
                <div class="lrx-tokens" data-token-list></div>
                <p class="lrx-help">Click inside the destination pattern before inserting a field. <code>^*</code> means the file's current folder; for example <code>^*\\$studio</code>. Use absolute folders for the simple builder. Destination folders must be inside a Stash library location; the existing engine may require the destination to have been scanned.</p>
                <details class="lrx-options"><summary>Advanced folder behavior</summary><p class="lrx-help">The unorganized destination, if filled, takes priority for unorganized scenes. Turning off the default destination alone does not disable conditional move rules.</p>
                ${field("Destination for unorganized scenes", "p_non_organized")}
                ${field("Remove empty old folder", "remove_emptyfolder", "checkbox")}
                ${field("Avoid consecutive duplicate folder names", "prevent_consecutive", "checkbox")}
                ${field("One performer per folder", "path_one_performer", "checkbox")}
                ${field("Keep performers already present in the path", "path_keep_alrperf", "checkbox")}
                ${field("Create a NoPerformer folder when no performer is linked", "path_noperformer_folder", "checkbox")}
                </details>
              </div>
            </section>

            <section class="lrx-tab" data-lrx-panel="performers">
              <div class="lrx-section-title"><div><h3>Performers</h3><p>Choose sorting, limits and included genders.</p></div></div>
              <div class="lrx-card lrx-form-grid">
                <div class="lrx-grid-3">
                  ${field("Separator", "performer_splitchar")}
                  ${field("Maximum count", "performer_limit", "number", "min=0")}
                  ${selectField("Default sorting", "performer_sort", [["id", "Stash-ID"], ["name", "Name"], ["rating", "Rating"], ["favorite", "Favorite"], ["mix", "Favorite → rating → name"], ["mixid", "Favorite → rating → ID"]])}
                </div>
                ${field("Keep names up to the limit instead of hiding all names", "performer_limit_keep", "checkbox")}
                ${field("Avoid duplicate performer names in the title", "prevent_title_performer", "checkbox")}
                ${field("Gender priority — one value per line", "performer_sortGender", "textarea", "data-array rows=7")}
                ${field("Ignored genders — one value per line", "performer_ignoreGender", "textarea", "data-array rows=5")}
                <p class="lrx-help">Valid values: FEMALE, TRANSGENDER_FEMALE, NON_BINARY, INTERSEX, MALE, TRANSGENDER_MALE, UNDEFINED.</p>
              </div>
            </section>

            <section class="lrx-tab" data-lrx-panel="rules">
              <div class="lrx-section-title"><div><h3>Conditional rules (optional)</h3><p>Use these only when particular tags, studios or folders need different names or destinations. The first matching rule within a type wins. Move rules take priority over the default destination.</p></div><button type="button" class="lrx-button" data-add-rule>+ New rule</button></div>
              <div class="lrx-card">
                <label class="lrx-field"><span>Rule type</span><select data-rule-map>${Object.entries(MAP_LABELS).map(([value, text]) => `<option value="${value}">${text}</option>`).join("")}</select></label>
                <p class="lrx-help" data-rule-help></p><div class="lrx-tokens" data-token-list></div>
                <div class="lrx-rule-list" data-rule-list></div>
              </div>
            </section>

            <section class="lrx-tab" data-lrx-panel="exclude">
              <div class="lrx-section-title"><div><h3>Exclusions</h3><p>A match here prevents both renaming and moving.</p></div><button type="button" class="lrx-button" data-add-exclude>+ New exclusion</button></div>
              <div class="lrx-card lrx-form-grid">
                ${field("Enable exclusion rules", "exclude_enabled", "checkbox")}
                <label class="lrx-field"><span>Exclusion type</span><select data-exclude-map>${Object.entries(EXCLUDE_LABELS).map(([value, text]) => `<option value="${value}">${text}</option>`).join("")}</select></label>
                <div class="lrx-rule-list" data-exclude-list></div>
              </div>
            </section>

            <section class="lrx-tab" data-lrx-panel="advanced">
              <div class="lrx-section-title"><div><h3>Advanced</h3><p>Advanced safety and formatting options.</p></div></div>
              <div class="lrx-card lrx-form-grid">
                <div class="lrx-grid-3">
                  ${field("Date format", "date_format")}
                  ${field("Duration format", "duration_format")}
                  ${field("Rating format", "rating_format")}
                </div>
                ${field("Associated extensions — one per line", "associated_extension", "textarea", "data-array rows=4")}
                ${field("Allowed tags — one per line", "tags_whitelist", "textarea", "data-array rows=4")}
                ${field("Excluded tags — one per line", "tags_blacklist", "textarea", "data-array rows=4")}
                ${field("Tag separator", "tags_splitchar")}
                ${field("Log file", "log_file")}
                <div class="lrx-grid-3">
                  ${field("Dry-run", "dry_run", "checkbox")}
                  ${field("Append to dry-run log", "dry_run_append", "checkbox")}
                  ${field("Ignore path length limit", "ignore_path_length", "checkbox")}
                </div>
                <div class="lrx-grid-3">
                  ${field("ASCII transliteration", "use_ascii", "checkbox")}
                  ${field("Search all processes", "process_getall", "checkbox")}
                  ${field("Terminate the process locking the file", "process_kill_attach", "checkbox")}
                </div>
                ${field("Field replacements (JSON)", "field_replacer", "textarea", "data-json rows=5")}
                ${field("Word/regex replacements (JSON)", "replace_words", "textarea", "data-json rows=5")}
                ${field("Move-tag options (JSON)", "p_tag_option", "textarea", "data-json rows=5")}
                ${field("Field priority for long paths — one per line", "order_field", "textarea", "data-array rows=7")}
              </div>
            </section>
          </main>
        </div>

        <section class="lrx-scene-preview"><h3>3. Preview a scene — no changes</h3><p>Enter the numeric ID from a scene URL, such as <code>/scenes/123</code>. This uses your unsaved draft and the actual Renamer calculation, without saving settings, moving files or updating the database.</p><div class="lrx-guided-row"><label class="lrx-field"><span>Scene ID</span><input type="number" min="1" step="1" data-preview-scene-id placeholder="123"></label><button type="button" class="lrx-button" data-preview-scene>Preview this scene</button><button type="button" class="lrx-button" data-reload>Reload saved settings</button></div><div data-scene-preview role="status" aria-live="polite">No scene preview calculated yet.</div><small>Calculated paths do not certify disk permissions, destination availability or filename collisions. Preview again after editing a rule.</small></section>
        <footer class="lrx-footer">
          <div class="lrx-message" data-message>Settings are stored in Stash.</div>
          <div class="lrx-actions">
            <button type="button" class="lrx-button" data-reset>Discard unsaved changes</button>
            <button type="button" class="lrx-button" data-dry-run>Dry-run entire library…</button>
            <button type="button" class="lrx-button primary" data-save>Save settings</button>
          </div>
        </footer>
      </section>`;
  }

  function populateFields(root) {
    root.querySelectorAll("[data-key]").forEach((element) => {
      const key = element.dataset.key;
      const value = state[key];
      if (element.type === "checkbox") element.checked = Boolean(value);
      else if (element.hasAttribute("data-array")) element.value = Array.isArray(value) ? value.join("\n") : "";
      else if (element.hasAttribute("data-json")) element.value = JSON.stringify(value || {}, null, 2);
      else element.value = value ?? "";
    });
    updateHookLabel(root);
    updatePreview(root);
  }

  function readField(element, showErrors = false) {
    const key = element.dataset.key;
    let value;
    if (element.type === "checkbox") value = element.checked;
    else if (element.hasAttribute("data-array")) {
      value = element.value.split(/[\n,]/).map((item) => item.trim()).filter(Boolean);
    } else if (element.hasAttribute("data-json")) {
      try {
        value = JSON.parse(element.value || "{}");
        if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Use a JSON object.');
        element.classList.remove("invalid");
      } catch (error) {
        element.classList.add("invalid");
        if (showErrors) throw new Error(`${element.closest("label")?.querySelector("span")?.textContent || key}: invalid JSON`);
        return;
      }
    } else if (element.type === "number") value = Number(element.value);
    else value = element.value;
    state[key] = value;
  }

  function collectFields(root, showErrors = false) {
    root.querySelectorAll("[data-key]").forEach((element) => readField(element, showErrors));
  }

  function updateHookLabel(root) {
    const label = root.querySelector("[data-hook-label]");
    const hook = root.querySelector('[data-key="enable_hook"]');
    if (label && hook) label.textContent = hook.checked ? "Automatic on scene update: ON" : "Automatic on scene update: OFF";
    root.classList.toggle("hook-off", hook && !hook.checked);
  }

  function renderTokens(root) {
    const tokens = ["$performer", "$studio", "$parent_studio", "$title", "$date", "$year", "$height", "$resolution", "$duration", "$rating", "$tags", "$movie_title", "$movie_scene", "$studio_code"];
    root.addEventListener('focusin',event=>{if(event.target.matches('[data-template-field], [data-rule-template]'))activeTemplateInput=event.target;});
    root.querySelectorAll('[data-token-list]').forEach(holder=>{
    holder.innerHTML = tokens.map((token) => `<button type="button" data-token="${token}" title="Insert ${token}${SAMPLE[token]?' — example: '+esc(SAMPLE[token]):''}">${esc(token.slice(1).replaceAll('_',' '))}<code>${token}</code></button>`).join("");
    holder.addEventListener("click", (event) => {
      const button = event.target.closest("[data-token]");
      if (!button) return;
      const section=holder.closest('.lrx-tab');
      const input = activeTemplateInput?.isConnected && section.contains(activeTemplateInput) ? activeTemplateInput : section.querySelector('[data-template-field], [data-rule-template]') || root.querySelector('[data-key="default_template"]');
      const start = input.selectionStart ?? input.value.length;
      input.value = input.value.slice(0, start) + button.dataset.token + input.value.slice(input.selectionEnd ?? start);
      input.focus();
      input.setSelectionRange(start + button.dataset.token.length, start + button.dataset.token.length);
      if(input.dataset.key)readField(input);
      else input.dispatchEvent(new Event('input',{bubbles:true}));
      updatePreview(root);
    });
    });
  }

  function renderRules(root) {
    const list = root.querySelector("[data-rule-list]");
    const help=root.querySelector('[data-rule-help]');
    if(help)help.textContent=activeRuleMap==='p_path_templates'?'Match text anywhere in the existing full file path. Enter a destination folder pattern in the second column.':activeRuleMap.startsWith('p_')?'Match the exact tag or studio name (case-sensitive). The second column is a destination folder, without the filename.':'Match the exact tag or studio name (case-sensitive). The second column is a filename pattern, without the extension. Higher rows have priority within this type.';
    const entries = Object.entries(state[activeRuleMap] || {});
    if (!entries.length) {
      list.innerHTML = `<p class="lrx-empty">No rules of this type yet.</p>`;
      return;
    }
    list.innerHTML = entries.map(([match, template], index) => `
      <div class="lrx-rule-row" data-rule-index="${index}">
        <label class="lrx-field"><span>${activeRuleMap==='p_path_templates'?'Current path contains':'Exact tag / studio name'}</span><input type="text" value="${esc(match)}" aria-label="Match name or path"></label>
        <label class="lrx-field"><span>${activeRuleMap.startsWith('p_')?'Destination folder pattern':'Filename pattern'}</span><input type="text" data-rule-template value="${esc(template)}" aria-label="Filename or destination pattern"></label>
        <div class="lrx-rule-tools"><button type="button" class="lrx-icon-button" data-rule-up ${index===0?'disabled':''} aria-label="Higher priority">↑</button><button type="button" class="lrx-icon-button" data-rule-down ${index===entries.length-1?'disabled':''} aria-label="Lower priority">↓</button><button type="button" class="lrx-icon-button danger" data-remove-rule aria-label="Remove rule">×</button></div>
      </div>`).join("");

    list.querySelectorAll(".lrx-rule-row").forEach((row, index) => {
      const originalKey = entries[index][0];
      const inputs = row.querySelectorAll("input");
      inputs[0].addEventListener("change", () => {
        const key=inputs[0].value.trim();
        if(!key||(key!==originalKey&&Object.hasOwn(state[activeRuleMap],key))){inputs[0].value=originalKey;showMessage(root,'Enter a non-empty, unique match name. Existing rules were not overwritten.','error');return;}
        const next = {};
        Object.entries(state[activeRuleMap]).forEach(([key, value]) => {
          next[key === originalKey ? inputs[0].value.trim() : key] = key === originalKey ? inputs[1].value : value;
        });
        state[activeRuleMap] = next;
        renderRules(root);
      });
      inputs[1].addEventListener("input", () => {
        state[activeRuleMap][inputs[0].value.trim()] = inputs[1].value;
        updatePreview(root);
      });
      row.querySelector("[data-remove-rule]").addEventListener("click", () => {
        delete state[activeRuleMap][inputs[0].value.trim()];
        renderRules(root);
      });
      for(const [selector,delta] of [['[data-rule-up]',-1],['[data-rule-down]',1]])row.querySelector(selector).addEventListener('click',()=>{const values=Object.entries(state[activeRuleMap]);[values[index],values[index+delta]]=[values[index+delta],values[index]];state[activeRuleMap]=Object.fromEntries(values);renderRules(root);updatePreview(root);});
    });
  }

  function addRule(root) {
    const map = state[activeRuleMap] || (state[activeRuleMap] = {});
    let number = 1;
    let key = "New rule";
    while (Object.prototype.hasOwnProperty.call(map, key)) key = `New rule ${++number}`;
    map[key] = activeRuleMap.startsWith("p_") ? "C:\\Media\\[$studio]" : "$performer [$studio] - $title";
    renderRules(root);
  }

  function renderExclusions(root) {
    const list = root.querySelector("[data-exclude-list]");
    const entries = Object.entries(state[activeExcludeMap] || {});
    if (!entries.length) {
      list.innerHTML = `<p class="lrx-empty">No exclusions of this type yet.</p>`;
      return;
    }
    list.innerHTML = entries.map(([label, rule], index) => `
      <div class="lrx-exclude-row" data-exclude-index="${index}">
        <input type="text" value="${esc(label)}" aria-label="Name">
        <select aria-label="Match type"><option value="exact" ${rule.type === "exact" ? "selected" : ""}>Exact</option><option value="regex" ${rule.type === "regex" ? "selected" : ""}>Regex</option></select>
        <input type="text" value="${esc(rule.pattern || "")}" aria-label="Pattern">
        <button type="button" class="lrx-icon-button danger" data-remove-exclude aria-label="Remove exclusion">×</button>
      </div>`).join("");

    list.querySelectorAll(".lrx-exclude-row").forEach((row, index) => {
      const originalKey = entries[index][0];
      const name = row.querySelector('input[aria-label="Name"]');
      const type = row.querySelector("select");
      const pattern = row.querySelector('input[aria-label="Pattern"]');
      const commit = () => {
        const next = {};
        Object.entries(state[activeExcludeMap]).forEach(([key, value]) => {
          next[key === originalKey ? name.value.trim() : key] = key === originalKey ? { type: type.value, pattern: pattern.value } : value;
        });
        state[activeExcludeMap] = next;
      };
      name.addEventListener("change", () => { commit(); renderExclusions(root); });
      type.addEventListener("change", commit);
      pattern.addEventListener("input", commit);
      row.querySelector("[data-remove-exclude]").addEventListener("click", () => {
        delete state[activeExcludeMap][name.value.trim()];
        renderExclusions(root);
      });
    });
  }

  function addExclusion(root) {
    const map = state[activeExcludeMap] || (state[activeExcludeMap] = {});
    let number = 1;
    let key = "New exclusion";
    while (Object.prototype.hasOwnProperty.call(map, key)) key = `New exclusion ${++number}`;
    map[key] = { type: "exact", pattern: "" };
    renderExclusions(root);
  }

  function showMessage(root, message, type = "info") {
    const holder = root.querySelector("[data-message]");
    holder.textContent = message;
    holder.dataset.type = type;
  }

  function validateDraft() {
    const templates=[state.default_template,state.p_default_template,state.p_non_organized,...['tag_templates','studio_templates','p_tag_templates','p_studio_templates','p_path_templates'].flatMap(key=>Object.values(state[key]||{}))];
    const unknown=[...new Set(templates.flatMap(tokenIssues))];
    if(unknown.length)throw Error('Unknown template fields: '+unknown.join(', ')+'. Use the insert-field buttons or correct the spelling.');
    if(state.use_default_template&&!String(state.default_template||'').trim())throw Error('Enter a default filename pattern, or turn off its fallback switch.');
    if(state.p_use_default_template&&!String(state.p_default_template||'').trim())throw Error('Enter a default destination folder, or turn off its switch.');
    for(const key of ['tag_templates','studio_templates','p_tag_templates','p_studio_templates','p_path_templates'])for(const [match,value] of Object.entries(state[key]||{}))if(!match.trim()||typeof value!=='string'||!value.trim())throw Error('Every conditional rule needs a match and a pattern. Complete or remove empty rules.');
    if(!Number.isFinite(Number(state.performer_limit))||Number(state.performer_limit)<0)throw Error('Maximum performer count must be zero or a positive number.');
    if(/\.(mp4|mkv|avi|mov|webm|wmv|m4v)$/i.test(state.default_template||''))throw Error('Do not add a file extension to the filename pattern. The original extension is preserved automatically.');
  }

  async function previewScene(root) {
    const button=root.querySelector('[data-preview-scene]'),holder=root.querySelector('[data-scene-preview]');
    try{
      if(!ready)throw Error('Wait for settings to load before previewing.');
      collectFields(root,true);validateDraft();
      const sceneId=root.querySelector('[data-preview-scene-id]').value.trim();
      if(!/^[1-9][0-9]*$/.test(sceneId))throw Error('Enter the numeric scene ID from its URL, for example 123.');
      const draft=clone(state),signature=JSON.stringify(draft);
      button.disabled=true;holder.textContent='Calculating this scene with the current draft… No files or settings will be changed.';
      const result=await operation({mode:'preview_scene',scene_id:sceneId,config:draft});
      if(!result.read_only||!Array.isArray(result.preview))throw Error('The backend did not return a read-only scene preview. Install the matching Python update.');
      lastPreviewSignature=signature;
      holder.innerHTML=result.preview.length?`<p data-preview-fresh></p>${result.preview.map(file=>`<article class="lrx-preview-file"><strong>${esc(file.status)}</strong><dl><dt>Current file</dt><dd><code>${esc(file.current_path)}</code></dd><dt>Proposed file</dt><dd><code>${esc(file.proposed_path)}</code></dd><dt>Applied filename pattern</dt><dd>${esc(file.filename_template)}</dd><dt>Applied destination</dt><dd>${esc(file.destination_template)}</dd></dl></article>`).join('')}`:'No file plan was returned. The scene may be skipped by exclusions, required fields, organized-only filtering or a lack of active templates. Check the Stash log for the reason.';
      updatePreview(root);showMessage(root,'Read-only preview complete. No settings were saved and no files were changed.','success');
    }catch(error){holder.textContent=error.message;showMessage(root,error.message,'error');}
    finally{button.disabled=!ready;}
  }

  async function save(root, message = "Settings saved in Stash.") {
    try {
      if(!ready)throw Error('Settings have not loaded. Reload before saving.');
      collectFields(root, true);
      validateDraft();
      if(state.enable_hook&&!state.dry_run&&!window.confirm('Automatic renaming is enabled and dry-run is OFF. Future scene updates can rename or move files with these settings. Save this configuration?'))return;
      const button = root.querySelector("[data-save]");
      button.disabled = true;
      showMessage(root, "Saving…");
      await writeSettings();
      savedState=clone(state);
      showMessage(root, message, "success");
      button.disabled = false;
      updateHookLabel(root);
    } catch (error) {
      showMessage(root, error.message, "error");
      const button = root.querySelector("[data-save]");
      if (button) button.disabled = false;
      throw error;
    }
  }

  async function runDryRun(root) {
    if (!window.confirm("Save this draft, enable dry-run for future updates and queue a preview of the entire library? This can take time. No media files will be renamed or moved. For one scene, use Preview this scene instead.")) return;
    state.dry_run = true;
    const checkbox = root.querySelector('[data-key="dry_run"]');
    if (checkbox) checkbox.checked = true;
    await save(root, "Dry-run enabled. Starting the task…");
    await gql('mutation($id:ID!,$name:String!){runPluginTask(plugin_id:$id,task_name:$name)}',
      {id:PLUGIN_ID,name:"Rename all scenes"});
    showMessage(root, "Dry-run started. Follow results under Settings → Logs.", "success");
  }

  function bind(root) {
    root.querySelector('[data-apply-preset]').addEventListener('click',()=>{state.default_template=PRESETS[root.querySelector('[data-filename-preset]').value][1];state.use_default_template=true;populateFields(root);showMessage(root,'Naming preset added to the draft. Conditional filename rules are unchanged. Preview a scene before saving.');});
    root.querySelector('[data-build-destination]').addEventListener('click',()=>{try{state.p_default_template=destinationTemplate(root.querySelector('[data-destination-root]').value,root.querySelector('[data-destination-layout]').value);state.p_use_default_template=true;populateFields(root);showMessage(root,'Default destination added to the draft. Conditional move rules still take priority. Preview a scene before saving.');}catch(error){showMessage(root,error.message,'error');}});
    root.querySelector('[data-keep-folders]').addEventListener('click',()=>{if(!window.confirm('Clear all tag/studio/current-path move rules, the default destination and the unorganized destination in this draft? Filename rules are kept. Nothing is saved yet.'))return;for(const key of ['p_tag_templates','p_studio_templates','p_path_templates'])state[key]={};state.p_use_default_template=false;state.p_default_template='';state.p_non_organized='';populateFields(root);renderRules(root);showMessage(root,'Draft now keeps current folders. Filename rules are unchanged. Save settings to apply.');});
    root.querySelector('[data-preview-scene]').addEventListener('click',()=>previewScene(root));
    root.querySelector('[data-reload]').addEventListener('click',()=>{if(window.confirm('Reload settings and discard unsaved edits?'))location.reload();});
    root.querySelectorAll("[data-lrx-tab]").forEach((button) => {
      button.addEventListener("click", () => {
        root.querySelectorAll("[data-lrx-tab]").forEach((item) => item.classList.toggle("active", item === button));
        root.querySelectorAll("[data-lrx-panel]").forEach((panel) => panel.classList.toggle("active", panel.dataset.lrxPanel === button.dataset.lrxTab));
      });
    });

    root.querySelectorAll("[data-key]").forEach((element) => {
      const eventName = element.type === "checkbox" || element.tagName === "SELECT" ? "change" : "input";
      element.addEventListener(eventName, () => {
        readField(element);
        updateHookLabel(root);
        updatePreview(root);
      });
    });

    root.querySelector("[data-rule-map]").addEventListener("change", (event) => {
      activeRuleMap = event.target.value;
      renderRules(root);
    });
    root.querySelector("[data-add-rule]").addEventListener("click", () => addRule(root));

    root.querySelector("[data-exclude-map]").addEventListener("change", (event) => {
      activeExcludeMap = event.target.value;
      renderExclusions(root);
    });
    root.querySelector("[data-add-exclude]").addEventListener("click", () => addExclusion(root));

    root.querySelector("[data-save]").addEventListener("click", () => save(root).catch(() => {}));
    root.querySelector("[data-dry-run]").addEventListener("click", () => runDryRun(root).catch((error) => showMessage(root, error.message, "error")));
    root.querySelector("[data-reset]").addEventListener("click", () => {
      if (!window.confirm("Discard unsaved edits and return to the last loaded or saved settings?")) return;
      state = clone(savedState);
      populateFields(root);
      renderRules(root);
      renderExclusions(root);
      showMessage(root, "Unsaved edits discarded. Saved rules were not changed.");
    });
  }

  async function mount() {
    const pane = document.getElementById("configuration-tabs-tabpane-plugins");
    if (!pane || document.getElementById(ROOT_ID)) return;

    const root = document.createElement("div");
    root.id = ROOT_ID;
    root.innerHTML = panelMarkup();
    pane.prepend(root);

    renderTokens(root);
    bind(root);
    ready=false;
    root.querySelectorAll('button,input,textarea,select').forEach(element=>element.disabled=true);
    root.querySelector('[data-reload]').disabled=false;
    showMessage(root, "Loading saved settings…");
    try {
      state = await loadSettings();
      savedState=clone(state);ready=true;
      root.querySelectorAll('button,input,textarea,select').forEach(element=>element.disabled=false);
      populateFields(root);
      renderRules(root);
      renderExclusions(root);
      showMessage(root, "Settings are stored in Stash.", "success");
    } catch (error) {
      showMessage(root, error.message+' Editing is disabled to protect your existing settings. Reload after installing the matching Python update.', "error");
    }
  }

  document.addEventListener("stash:page:settings:plugins", mount);
  const observer = new MutationObserver(() => mount());
  observer.observe(document.documentElement, { childList: true, subtree: true });
  mount();
})();

})(window.fetch.bind(window));
