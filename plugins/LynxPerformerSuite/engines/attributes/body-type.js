(function(fetch){
/* Lynx Performer Attribute Tags 1.5.3 — Full bra size only; preserve legacy cup data. */
(() => {
  "use strict";
  const api = window.PluginApi;
  if (!api?.React || !api?.patch || window.__lynxBodyTypeUI) return;
  window.__lynxBodyTypeUI = true;
  const R = api.React;
  const choices = ["Petite", "Slim", "Average", "Athletic", "Muscular", "Curvy", "Voluptuous", "Plus Size", "BBW", "SSBBW"];
  const extraFields = [
    {key: "breastSize", label: "Breast Size", options: ["Small Tits", "Normal Tits", "Big Tits", "Huge Tits"]},
    {key: "braSize", label: "Bra Size", options: [], freeText: true}
  ];

  function mappingOptions(text, fallback) {
    if (!String(text || "").trim()) return fallback;
    const seen = new Set();
    return String(text).split(";").filter(row => row.trim()).map(row => {
      const split = row.indexOf("=");
      const value = row.slice(0, split).trim();
      const target = row.slice(split + 1).trim();
      const key = value.toLowerCase();
      if (split < 1 || !value || !target || seen.has(key)) throw new Error("Invalid or duplicate mapping: " + row);
      seen.add(key);
      return value;
    });
  }

  function hairOptionKey(value) {
    const key = String(value || "").trim().toLowerCase();
    return ({redhead: "red", blond: "blonde", brunette: "brown", gray: "grey"})[key] || key;
  }

  function hairOptions(text, fallback) {
    const seen = new Set();
    return mappingOptions(text, fallback).filter(value => {
      const key = hairOptionKey(value);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function listOptions(text, fallback) {
    if (!String(text || "").trim()) return fallback;
    return [...new Set(String(text).split(";").map(value => value.trim()).filter(Boolean))];
  }

  function canonicalEthnicity(value) {
    const key = String(value || "").trim().toLowerCase();
    if (["caucasian", "white"].includes(key)) return "White";
    if (["latin", "latino", "latina", "hispanic", "latinx"].includes(key)) return "Latina";
    return String(value || "").trim();
  }

  function canonicalBreastType(value) {
    const key = String(value || "").trim().toLowerCase();
    if (["augmented", "fake", "fake tits", "fake breasts"].includes(key)) return "Fake";
    if (["natural", "natural tits", "natural breasts"].includes(key)) return "Natural";
    return String(value || "").trim();
  }

  function canonicalPiercings(value) {
    const key = String(value || "").trim().toLowerCase();
    if (["none", "no piercings", "no piercing"].includes(key)) return "None";
    if (["multiple", "multiple piercings", "several piercings"].includes(key)) return "Multiple Piercings";
    if (["piercing", "pierced", "ears", "nose", "navel", "nipples", "ear piercing", "nose piercing", "navel piercing", "nipple piercing"].includes(key)) return "Pierced";
    return String(value || "").trim();
  }

  function uniqueChoices(values, canonical) {
    return [...new Set(values.map(canonical).filter(Boolean))];
  }

  async function loadFieldName() {
    const response = await fetch("/graphql", {
      method: "POST", credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({query: "query LynxBodyTypeSettings { configuration { plugins } }"})
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const result = await response.json();
    if (result.errors) throw new Error(result.errors.map(e => e.message).join("; "));
    const settings = result.data.configuration.plugins.LynxPerformerAttributeTags || {};
    return {
      body: String(settings.bodyField || "Body Type").trim() || "Body Type",
      breastSize: String(settings.breastSizeField || "Breast Size").trim() || "Breast Size",
      cupSize: String(settings.cupSizeField || "Cup Size").trim() || "Cup Size",
      braSize: String(settings.braSizeField || result.data.configuration.plugins.LynxXLGirls?.braField || "Bra Size").trim() || "Bra Size",
      braLabel: String(settings.braSizeLabel || "Bra Size").trim() || "Bra Size",
      tattooLevel: String(settings.tattooLevelField || "Tattoo Level").trim() || "Tattoo Level",
      options: {
        body: mappingOptions(settings.bodyMap, choices),
        breastSize: mappingOptions(settings.breastSizeMap, extraFields[0].options),
        hair_color: hairOptions(settings.hairMap, ["Blonde", "Brunette", "Black", "Red", "Auburn", "Brown", "Grey", "White", "Bald", "Various", "Green", "Blue", "Pink", "Purple", "Orange", "Silver"]),
        eye_color: mappingOptions(settings.eyesMap, ["Blue", "Brown", "Green", "Hazel", "Grey", "Amber"]),
        fake_tits: ["Natural", "Fake"],
        ethnicity: uniqueChoices(listOptions(settings.ethnicityChoices, ["White", "Asian", "Black", "Latina", "Middle Eastern", "Indian", "Mixed", "Other"]), canonicalEthnicity),
        tattoos: listOptions(settings.tattooChoices, ["No ink", "Inked", "Very inked"]),
        piercings: uniqueChoices(
          [...listOptions(settings.piercingChoices, ["None", "Pierced", "Multiple Piercings"]), "None", "Pierced", "Multiple Piercings"],
          canonicalPiercings
        ).filter(value => ["None", "Pierced", "Multiple Piercings"].includes(value))
      }
    };
  }

  function useFieldName(enabled = true) {
    const [name, setName] = R.useState(null);
    R.useEffect(() => {
      if (!enabled) return;
      let alive = true;
      // Re-read on form mount so changed plugin settings are respected.
      loadFieldName().then(value => { if (alive) setName(value); }).catch(error => {
        console.error("[Lynx Body Type] Could not read the field settings", error);
        if (alive) setName(false);
      });
      return () => { alive = false; };
    }, [enabled]);
    return name;
  }

  function fieldKey(values, name) {
    return Object.keys(values || {}).find(key => key.trim().toLowerCase() === name.toLowerCase()) || name;
  }

  function tattooChoice(value, legacyLevel) {
    const text = String(value || "").trim().toLowerCase();
    if (text === "no ink") return "No ink";
    if (text === "very inked") return "Very inked";
    if (text === "inked") return "Inked";
    const negative = new Set(["", "none", "no", "unknown", "n/a", "na", "false", "0", "-", "null",
      "not known", "not specified", "ingen", "inga", "nej", "okänd", "okänt", "no tattoos", "none known"]);
    const legacy = String(legacyLevel || "").trim().toLowerCase();
    if (legacy === "very inked") return "Very inked";
    if (!negative.has(text) || legacy === "inked") return "Inked";
    return legacy === "no ink" ? "No ink" : "";
  }

  function BodyTypeSelect({values, onChange, name, label = "Body Type", options: available = choices, layout, freeText = false}) {
    const id = R.useId ? R.useId() : "lynx-attribute-" + name.replace(/[^a-z0-9]/gi, "-");
    const key = fieldKey(values, name);
    const raw = values?.[key];
    const current = raw == null ? "" : String(raw);
    const options = available.includes(current) || !current ? available : [current, ...available];
    const change = event => {
      const next = {...values};
      if (event.currentTarget.value) next[key] = event.currentTarget.value;
      else delete next[key];
      onChange(next);
    };
    const select = freeText ? R.createElement("input", {
      id, type: "text", className: "form-control lynx-native-attribute-choice",
      value: current, placeholder: "Not specified, e.g. 36E", onChange: change
    }) : R.createElement("select", {
        id, className: "form-control lynx-native-attribute-choice", value: current,
        onChange: event => {
          const next = {...values};
          if (event.currentTarget.value) next[key] = event.currentTarget.value;
          else delete next[key];
          // This is Stash's own Formik callback: dirty/Save/Cancel stay native.
          onChange(next);
        }
      }, R.createElement("option", {value: ""}, "Not specified"),
      ...options.map(value => R.createElement("option", {key: value, value},
        label === "Breast Size" ? value.replace(/ Tits$/, " tits") : value)));
    return R.createElement("div", {className: (layout?.row || "form-group") + " lynx-body-type-field", "data-field": "lynx_body_type"},
      R.createElement("label", {htmlFor: id, className: layout?.label}, label),
      layout ? R.createElement("div", {className: layout.control}, select) : select,
      !layout && R.createElement("small", {className: "form-text text-muted"}, "Saved together with the other performer fields."));
  }

  function CustomFieldsWithBodyType({original, values, onChange}) {
    const anchor = R.useRef(null);
    const customState = R.useRef({values, onChange});
    customState.current = {values, onChange};
    const [performerForm, setPerformerForm] = R.useState(false);
    const name = useFieldName(performerForm);
    const [slots, setSlots] = R.useState(null);
    R.useLayoutEffect(() => {
      setPerformerForm(Boolean(anchor.current?.closest("#performer-edit")));
    }, []);
    R.useEffect(() => {
      if (!performerForm || !name?.options) return;
      const form = anchor.current?.closest("#performer-edit");
      if (!form) return;
      const cleanup = [];
      for (const field of ["ethnicity", "hair_color", "eye_color", "fake_tits", "tattoos", "piercings"]) {
        const input = form.querySelector(`input[name="${field}"], textarea[name="${field}"]`);
        if (!input || input.parentElement.querySelector(`[data-lynx-choice="${field}"]`)) continue;
        const select = document.createElement("select");
        select.className = "form-control lynx-native-attribute-choice";
        select.dataset.lynxChoice = field;
        if (field === "tattoos") select.lynxLegacyLevel = values?.[fieldKey(values, name.tattooLevel)];
        select.id = (input.id || "lynx-" + field) + "-choice";
        const labels = Array.from(input.labels || []);
        const oldLabels = labels.map(label => [label, label.htmlFor]);
        select.setAttribute("aria-label", labels[0]?.textContent?.trim() || `Lynx alternativ: ${field}`);
        const sync = () => {
          const available = name.options[field] || [];
          let current = field === "tattoos" ? tattooChoice(input.value, select.lynxLegacyLevel) : input.value;
          if (field === "hair_color") {
            current = available.find(value => hairOptionKey(value) === hairOptionKey(current)) || current;
          } else if (field === "ethnicity") {
            current = canonicalEthnicity(current);
          } else if (field === "fake_tits") {
            current = canonicalBreastType(current);
          } else if (field === "piercings") {
            current = canonicalPiercings(current);
          }
          const all = current && !available.includes(current) ? [current, ...available] : available;
          select.replaceChildren();
          for (const value of ["", ...all]) {
            const option = document.createElement("option");
            option.value = value;
            option.textContent = value || "Not specified";
            select.appendChild(option);
          }
          select.value = current;
        };
        sync();
        select.lynxSync = sync;
        select.addEventListener("focus", sync);
        select.addEventListener("change", () => {
          // Use the native setter + bubbling input event to retain React/Formik Save/Cancel.
          const prototype = input.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
          const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
          if (!setter) return;
          setter.call(input, select.value);
          input.dispatchEvent(new Event("input", {bubbles: true}));
          input.dispatchEvent(new Event("change", {bubbles: true}));
          if (field === "tattoos") {
            // A new unified choice, including empty, supersedes the old custom
            // level. Use fresh custom fields so unrelated edits are preserved.
            const latest = customState.current;
            const oldKey = fieldKey(latest.values, name.tattooLevel);
            if (Object.prototype.hasOwnProperty.call(latest.values || {}, oldKey)) {
              const next = {...latest.values};
              delete next[oldKey];
              select.lynxLegacyLevel = undefined;
              latest.onChange(next);
            }
          }
        });
        input.addEventListener("input", sync);
        input.insertAdjacentElement("afterend", select);
        // Keep the original input type/state wiring; hide only once the replacement exists.
        input.classList.add("lynx-native-attribute-source");
        labels.forEach(label => { label.htmlFor = select.id; });
        cleanup.push(() => {
          input.removeEventListener("input", sync);
          input.classList.remove("lynx-native-attribute-source");
          oldLabels.forEach(([label, oldFor]) => { label.htmlFor = oldFor; });
          select.remove();
        });
      }
      // React portals keep Formik callbacks intact while placing custom attributes
      // among native fields. Never physically move React-owned nodes.
      if (api.ReactDOM?.createPortal) {
        const targets = {};
        const lastSlotByField = {};
        for (const [key, afterField] of [["body", "weight"], ["breastSize", "fake_tits"], ["braSize", "fake_tits"]]) {
          const control = form.querySelector(`input[name="${afterField}"], textarea[name="${afterField}"]`);
          const row = control?.closest(".form-group");
          if (!row) continue;
          const slot = document.createElement("div");
          slot.className = "lynx-attribute-slot";
          slot.dataset.lynxSlot = key;
          // Copy native responsive Bootstrap classes, not guessed percentages.
          slot.lynxLayout = {
            row: row.className || "form-group row",
            label: row.querySelector?.("label")?.className || "col-form-label col-sm-3 col-xl-2",
            control: control.parentElement.className || "col-sm-9 col-xl-7"
          };
          // Keep breast size and cup size in order, using the same native row layout.
          (lastSlotByField[afterField] || row).insertAdjacentElement("afterend", slot);
          lastSlotByField[afterField] = slot;
          targets[key] = slot;
          cleanup.push(() => slot.remove());
        }
        setSlots(targets);
      }
      return () => cleanup.forEach(fn => fn());
    }, [performerForm, name]);
    R.useEffect(() => {
      // Formik can replace values after scraping/reset without DOM input events.
      const form = anchor.current?.closest("#performer-edit");
      form?.querySelectorAll?.("[data-lynx-choice]").forEach(select => {
        if (select.dataset.lynxChoice === "tattoos" && name) {
          select.lynxLegacyLevel = values?.[fieldKey(values, name.tattooLevel)];
        }
        select.lynxSync?.();
      });
    });
    const renderChoice = (key, label, fallback, freeText = false) => {
      const element = R.createElement(BodyTypeSelect, {key, values, onChange, name: name[key], label,
        options: name.options?.[key] || fallback, layout: slots?.[key]?.lynxLayout, freeText});
      return slots?.[key] && api.ReactDOM?.createPortal ? api.ReactDOM.createPortal(element, slots[key], key) : element;
    };
    return R.createElement(R.Fragment, null,
      R.createElement("span", {ref: anchor, hidden: true}),
      performerForm && name && R.createElement(R.Fragment, null,
        renderChoice("body", "Body Type", choices),
        ...extraFields.map(field => renderChoice(field.key, field.key === "braSize" ? name?.braLabel || field.label : field.label, field.options, field.freeText))),
      performerForm && name === false && R.createElement("p", {className: "text-warning"},
        "Lynx: Could not load attribute fields. Reload the page and check the plugin settings."),
      performerForm && name ? omitManagedInputs(original, [name.body, name.breastSize, name.cupSize, name.braSize, name.tattooLevel]) : original);
  }

  function omitManagedInputs(element, names) {
    if (!R.isValidElement(element)) return element;
    // CustomFieldInput receives the field name directly. Omit its duplicate
    // display only, without changing the original values or onChange closures.
    if (!element.props.isNew && typeof element.props.field === "string" &&
        names.some(name => name.toLowerCase() === element.props.field.trim().toLowerCase())) return null;
    if (!element.props.children) return element;
    return R.cloneElement(element, {}, R.Children.map(element.props.children, child => {
      return Array.isArray(child) ? child.map(item => omitManagedInputs(item, names)) : omitManagedInputs(child, names);
    }));
  }

  // PerformerEditPanel itself is not patchable in Stash 0.31.1.
  // CustomFieldsInput is; a local ref limits the extra field to the performer form.
  api.patch.after("CustomFieldsInput", (...args) => {
    const props = args[0];
    const original = args[args.length - 1];
    return R.createElement(CustomFieldsWithBodyType, {original, values: props.values, onChange: props.onChange});
  });

  // Filter presentation only. Keep original custom fields intact for editing.
  function hasDetailValue(value) {
    return value != null && !(typeof value === "string" &&
      (value.trim() === "" || value.trim().toLowerCase() === "none"));
  }

  function omitNativeBodyRow(element, names) {
    if (Array.isArray(element)) return element.map(child => omitNativeBodyRow(child, names));
    if (!R.isValidElement(element)) return element;
    if (element.type === api.components?.CustomFields) {
      const values = Object.fromEntries(Object.entries(element.props.values || {})
        .filter(([, value]) => hasDetailValue(value)));
      for (const name of names) delete values[fieldKey(values, name)];
      if (!Object.keys(values).length) return null;
      return R.cloneElement(element, {values});
    }
    if (!element.props.children) return element;
    return R.cloneElement(element, {}, R.Children.map(element.props.children, child => omitNativeBodyRow(child, names)));
  }

  const displayAcronyms = new Set(['BBW', 'SSBBW', 'USA', 'US', 'UK', 'EU', 'BDSM']);
  function attributeDisplay(value) {
    if (typeof value !== 'string' || /\d/.test(value) || value !== value.toUpperCase() || value === value.toLowerCase()) return value;
    let first = true;
    return value.replace(/[A-Za-z]+/g, word => {
      const initial = first;
      first = false;
      if (displayAcronyms.has(word)) return word;
      return initial ? word[0] + word.slice(1).toLowerCase() : word.toLowerCase();
    });
  }

  function normalizeDetailDisplay(root) {
    if (!root) return;
    const fields = ['gender', 'ethnicity', 'hair_color', 'hair-color', 'eye_color', 'eye-color', 'fake_tits', 'fake-tits'];
    const labels = new Set(['gender', 'ethnicity', 'hair color', 'eye color', 'fake tits', 'breast type']);
    const targets = new Set();
    for (const field of fields) {
      root.querySelectorAll(`.detail-item-value.${field}, .detail-item.${field} .detail-item-value, .detail-item.${field} .value`)
        .forEach(node => targets.add(node));
    }
    root.querySelectorAll('.detail-item').forEach(row => {
      const label = row.querySelector('.detail-item-title, .detail-item-label');
      if (label && labels.has(label.textContent.trim().toLowerCase())) {
        const value = row.querySelector('.detail-item-value, .value');
        if (value) targets.add(value);
      }
    });
    for (const target of targets) {
      const visit = node => {
        if (node.nodeType === 3) {
          const formatted = attributeDisplay(node.nodeValue);
          if (formatted !== node.nodeValue) node.nodeValue = formatted;
        } else if (node.nodeType === 1 && !node.matches('a, input, textarea, select, button, svg, label, .detail-item-title, .detail-item-label')) {
          Array.from(node.childNodes).forEach(visit);
        }
      };
      visit(target);
    }
  }

  function PerformerBodyDetails({original, performer}) {
    const detailAnchor = R.useRef(null);
    const [managedSlot,setManagedSlot] = R.useState(null);
    R.useLayoutEffect(() => {
      const refresh = () => {
        const header = detailAnchor.current?.closest('#performer-page .detail-header');
        const target = header?.querySelector('.lynx-performer-managed-slot') || null;
        setManagedSlot(previous => previous === target ? previous : target);
      };
      refresh();
      document.addEventListener('lynx:performer-detail-layout', refresh);
      return () => document.removeEventListener('lynx:performer-detail-layout', refresh);
    }, [performer.id]);
    R.useLayoutEffect(() => {
      normalizeDetailDisplay(detailAnchor.current?.closest('#performer-page'));
    });
    const name = useFieldName();
    const anchor = R.createElement('span', {ref: detailAnchor, hidden: true, 'data-lynx-attribute-display': ''});
    if (!name) return R.createElement(R.Fragment, null, omitNativeBodyRow(original, []), anchor);
    const fields = [{key: "body", label: "Body Type"}, ...extraFields].map(field => ({
      name: name[field.key], label: field.key === "braSize" ? name.braLabel : field.label,
      value: performer.custom_fields?.[fieldKey(performer.custom_fields, name[field.key])]
    })).filter(field => hasDetailValue(field.value));
    const filteredOriginal = omitNativeBodyRow(original, [...fields.map(field => field.name), name.cupSize, name.tattooLevel]);
    if (!fields.length) return R.createElement(R.Fragment, null, filteredOriginal, anchor);
    const managedRows = fields.map(field => R.createElement("div", {key: field.name, className: "lynx-body-type-detail", "data-field": "lynx_body_type"},
        R.createElement("span", {className: "lynx-body-type-label"}, field.label),
        R.createElement("span", null, field.name === name.braSize ? String(field.value) : attributeDisplay(String(field.value)))));
    return R.createElement(R.Fragment, null, filteredOriginal, anchor,
      managedSlot && api.ReactDOM?.createPortal
        ? api.ReactDOM.createPortal(managedRows, managedSlot)
        : managedRows);
  }
  api.patch.after("PerformerDetailsPanel", (...args) => R.createElement(PerformerBodyDetails,
    {original: args[args.length - 1], performer: args[0].performer}));
})();

})(window.LynxPerformerDefaults.fetchFor("LynxPerformerAttributeTags"));
