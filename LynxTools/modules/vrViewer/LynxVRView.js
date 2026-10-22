(function(fetch){
/*
 * Lynx VR View 1.1.0
 * Flat single-eye viewing modes for stereoscopic Stash scenes.
 *
 * No media is transcoded or modified. The selected eye is displayed by
 * positioning the browser's native video surface. This avoids copying every
 * decoded frame into a canvas and keeps large 4K/6K/8K files responsive.
 */
(function () {
    "use strict";

    if (window.__lynxVRViewLoaded) { return; }
    window.__lynxVRViewLoaded = true;

    var PLUGIN_PREFIX = "[Lynx VR View]";
    var MODES = [
        { id: "original", label: "Original" },
        { id: "sbs-left", label: "SBS Left" },
        { id: "sbs-right", label: "SBS Right" },
        { id: "ou-top", label: "Over/Under Top" },
        { id: "ou-bottom", label: "Over/Under Bottom" }
    ];
    var MODE_IDS = MODES.map(function (mode) { return mode.id; });
    var MODE_CLASSES = MODE_IDS.map(function (id) {
        return "lynx-vr-mode-" + id;
    });

    var state = {
        sceneId: null,
        scenePrefix: "",
        metadataSceneId: null,
        metadataPending: false,
        detected: false,
        detectionReason: "",
        mode: "original",
        player: null,
        video: null,
        button: null,
        menu: null,
        resizeObserver: null,
        videoCleanup: null,
        abortController: null,
        routeToken: 0,
        scheduled: null
    };

    function debug(message, detail) {
        if (!window.console || !console.debug) { return; }
        if (typeof detail === "undefined") {
            console.debug(PLUGIN_PREFIX + " " + message);
        } else {
            console.debug(PLUGIN_PREFIX + " " + message, detail);
        }
    }

    function warn(message, detail) {
        if (!window.console || !console.warn) { return; }
        console.warn(PLUGIN_PREFIX + " " + message, detail || "");
    }

    function routeInfo() {
        var match = window.location.pathname.match(/^(.*)\/scenes\/([^/?#]+)/i);
        if (!match) { return null; }
        var id;
        try {
            id = decodeURIComponent(match[2]);
        } catch (e) {
            id = match[2];
        }
        return { id: id, prefix: match[1] || "" };
    }

    function normalize(value) {
        var text = String(value || "");
        if (text.normalize) { text = text.normalize("NFKD"); }
        return text
            .toLowerCase()
            .replace(/\u00b0/g, " degree ")
            .replace(/[^a-z0-9]+/g, " ")
            .replace(/^\s+|\s+$/g, "")
            .replace(/\s+/g, " ");
    }

    var EXACT_VR_TAGS = (function () {
        var values = [
            "VR", "Virtual Reality",
            "VR180", "180VR", "VR 180", "180 VR", "180 degree VR",
            "VR360", "360VR", "VR 360", "360 VR", "360 degree VR",
            "180", "180 degree", "360", "360 degree",
            "SBS", "3D SBS", "Side by Side", "Left Right", "LR",
            "OU", "O/U", "3D OU", "Over Under", "Top Bottom", "TB"
        ];
        var result = Object.create(null);
        values.forEach(function (value) { result[normalize(value)] = true; });
        return result;
    }());

    function tagTrigger(value) {
        var text = normalize(value);
        if (!text) { return false; }
        if (EXACT_VR_TAGS[text]) { return true; }
        return /^(?:vr\s*(?:180|360)|(?:180|360)\s*vr)(?:\s+(?:sbs|ou|tb|lr))?$/.test(text);
    }

    function filenameTrigger(value) {
        var raw = String(value || "");
        if (!raw) { return false; }
        var basename = raw.split(/[\\/]/).pop() || raw;
        var stem = basename.replace(/\.[a-z0-9]{1,8}(?:[?#].*)?$/i, "");
        var compact = stem.toLowerCase().replace(/[^a-z0-9]+/g, "");
        var words = normalize(stem);

        if (/(?:vr180|180vr|vr360|360vr)/.test(compact)) { return true; }
        if (/(?:sidebyside|overunder|topbottom)/.test(compact)) { return true; }
        if (/side by side/.test(words)) { return true; }

        var padded = " " + words + " ";
        return /\s(?:vr|sbs|ou|tb|lr)\s/.test(padded) ||
            /\s(?:180|360)\s+(?:sbs|vr)\s/.test(padded) ||
            /\s(?:sbs|vr)\s+(?:180|360)\s/.test(padded);
    }

    function detectMetadata(scene) {
        if (!scene) { return null; }
        var tags = Array.isArray(scene.tags) ? scene.tags : [];
        for (var i = 0; i < tags.length; i++) {
            var tagName = tags[i] && typeof tags[i] === "object" ? tags[i].name : tags[i];
            if (tagTrigger(tagName)) {
                return "tag: " + tagName;
            }
        }

        var files = Array.isArray(scene.files) ? scene.files : [];
        for (var j = 0; j < files.length; j++) {
            var file = files[j] || {};
            var candidate = file.basename || file.path || "";
            if (filenameTrigger(candidate)) {
                return "filename: " + candidate;
            }
        }
        return null;
    }

    function detectFromDOM() {
        var tagNodes = document.querySelectorAll(
            ".scene-tabs .tag-item, .scene-tabs a[href*='/tags/'], " +
            ".scene-details .tag-item, .scene-details a[href*='/tags/']"
        );
        for (var i = 0; i < tagNodes.length; i++) {
            var label = (tagNodes[i].textContent || "").trim();
            if (tagTrigger(label)) { return "visible tag: " + label; }
        }

        var fileNodes = document.querySelectorAll(
            ".scene-file-info, .file-info, [class*='file-info'], " +
            ".scene-tabs video[src], .scene-tabs source[src]"
        );
        for (var j = 0; j < fileNodes.length; j++) {
            var node = fileNodes[j];
            var candidate = node.getAttribute("src") || node.textContent || "";
            if (filenameTrigger(candidate)) { return "visible filename: " + candidate.trim(); }
        }
        return null;
    }

    function graphqlEndpoint(prefix) {
        return (prefix || "") + "/graphql";
    }

    function fetchSceneMetadata(sceneId, prefix, token) {
        if (state.abortController) { state.abortController.abort(); }
        state.abortController = typeof AbortController === "function" ? new AbortController() : null;
        state.metadataPending = true;
        state.metadataSceneId = sceneId;

        var query = [
            "query LynxVRViewScene($id: ID!) {",
            "  findScene(id: $id) {",
            "    id",
            "    tags { name }",
            "    files { basename path }",
            "  }",
            "}"
        ].join("\n");
        var options = {
            method: "POST",
            credentials: "same-origin",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ query: query, variables: { id: sceneId } })
        };
        if (state.abortController) { options.signal = state.abortController.signal; }

        fetch(graphqlEndpoint(prefix), options)
            .then(function (response) {
                if (!response.ok) { throw new Error("GraphQL HTTP " + response.status); }
                return response.json();
            })
            .then(function (payload) {
                if (token !== state.routeToken || sceneId !== state.sceneId) { return; }
                if (payload.errors && payload.errors.length) {
                    throw new Error(payload.errors[0].message || "GraphQL query failed");
                }
                state.metadataPending = false;
                var scene = payload.data && payload.data.findScene;
                var reason = detectMetadata(scene) || detectFromDOM();
                state.detected = Boolean(reason);
                state.detectionReason = reason || "";
                if (state.detected) {
                    debug("VR scene detected via " + state.detectionReason);
                    mountPlayerUI();
                } else {
                    unmountPlayerUI(false);
                }
            })
            .catch(function (error) {
                if (error && error.name === "AbortError") { return; }
                if (token !== state.routeToken || sceneId !== state.sceneId) { return; }
                state.metadataPending = false;
                var reason = detectFromDOM();
                state.detected = Boolean(reason);
                state.detectionReason = reason || "";
                if (state.detected) { mountPlayerUI(); }
                debug("Metadata request unavailable; DOM fallback used", error);
            });
    }

    function findScenePlayer() {
        var selectors = [
            ".scene-tabs .video-js",
            ".scene-player .video-js",
            ".video-wrapper .video-js",
            ".video-js"
        ];
        var candidates = [];
        var seen = [];
        selectors.forEach(function (selector) {
            var nodes = document.querySelectorAll(selector);
            for (var i = 0; i < nodes.length; i++) {
                var node = nodes[i];
                if (seen.indexOf(node) !== -1) { continue; }
                seen.push(node);
                if (node.querySelector("video") && node.querySelector(".vjs-control-bar")) {
                    candidates.push(node);
                }
            }
        });
        if (!candidates.length) { return null; }
        candidates.sort(function (a, b) {
            var ar = a.getBoundingClientRect();
            var br = b.getBoundingClientRect();
            return (br.width * br.height) - (ar.width * ar.height);
        });
        return candidates[0];
    }

    function iconMarkup() {
        return [
            '<span class="lynx-vr-view-icon" aria-hidden="true">',
            '<svg viewBox="0 0 24 24" focusable="false">',
            '<path d="M3.5 7.25h17a1.75 1.75 0 0 1 1.75 1.75v6A1.75 1.75 0 0 1 20.5 16.75h-4.15a2.8 2.8 0 0 1-2.42-1.4l-.43-.75h-3l-.43.75a2.8 2.8 0 0 1-2.42 1.4H3.5A1.75 1.75 0 0 1 1.75 15V9A1.75 1.75 0 0 1 3.5 7.25Z"/>',
            '<path d="M12 8v6.5"/>',
            '</svg>',
            '</span>',
            '<span class="vjs-control-text">VR View</span>'
        ].join("");
    }

    function makeButton(controlBar) {
        var button = document.createElement("button");
        button.type = "button";
        button.className = "vjs-control vjs-button lynx-vr-view-button";
        button.setAttribute("aria-haspopup", "menu");
        button.setAttribute("aria-expanded", "false");
        button.innerHTML = iconMarkup();
        button.addEventListener("click", function (event) {
            event.preventDefault();
            event.stopPropagation();
            toggleMenu();
        });

        var fullscreen = controlBar.querySelector(".vjs-fullscreen-control");
        controlBar.insertBefore(button, fullscreen || null);
        return button;
    }

    function makeMenu(player) {
        var menu = document.createElement("div");
        menu.className = "lynx-vr-view-menu";
        menu.id = "lynx-vr-view-menu-" + Math.random().toString(36).slice(2);
        menu.setAttribute("role", "menu");
        menu.setAttribute("aria-label", "VR viewing mode");
        menu.hidden = true;

        var title = document.createElement("div");
        title.className = "lynx-vr-view-menu-title";
        title.textContent = "VR View";
        menu.appendChild(title);

        MODES.forEach(function (mode) {
            var item = document.createElement("button");
            item.type = "button";
            item.className = "lynx-vr-view-menu-item";
            item.setAttribute("role", "menuitemradio");
            item.setAttribute("data-mode", mode.id);
            item.innerHTML = '<span class="lynx-vr-view-check" aria-hidden="true"></span>' +
                '<span>' + mode.label + '</span>';
            item.addEventListener("click", function (event) {
                event.preventDefault();
                event.stopPropagation();
                setMode(mode.id);
                closeMenu();
                if (state.button) { state.button.focus(); }
            });
            menu.appendChild(item);
        });

        menu.addEventListener("pointerdown", function (event) { event.stopPropagation(); });
        menu.addEventListener("click", function (event) { event.stopPropagation(); });
        menu.addEventListener("keydown", onMenuKeydown);
        player.appendChild(menu);
        return menu;
    }

    function menuItems() {
        return state.menu ? Array.prototype.slice.call(
            state.menu.querySelectorAll(".lynx-vr-view-menu-item")
        ) : [];
    }

    function onMenuKeydown(event) {
        var items = menuItems();
        if (!items.length) { return; }
        var current = items.indexOf(document.activeElement);
        var next = current;
        if (event.key === "ArrowDown") { next = (current + 1 + items.length) % items.length; }
        else if (event.key === "ArrowUp") { next = (current - 1 + items.length) % items.length; }
        else if (event.key === "Home") { next = 0; }
        else if (event.key === "End") { next = items.length - 1; }
        else if (event.key === "Escape") {
            event.preventDefault();
            closeMenu();
            if (state.button) { state.button.focus(); }
            return;
        } else { return; }
        event.preventDefault();
        items[next].focus();
    }

    function openMenu() {
        if (!state.menu || !state.button) { return; }
        state.menu.hidden = false;
        state.menu.classList.add("is-open");
        state.button.setAttribute("aria-expanded", "true");
        var selected = state.menu.querySelector('[data-mode="' + state.mode + '"]');
        if (selected) { selected.focus(); }
    }

    function closeMenu() {
        if (!state.menu || !state.button) { return; }
        state.menu.classList.remove("is-open");
        state.menu.hidden = true;
        state.button.setAttribute("aria-expanded", "false");
    }

    function toggleMenu() {
        if (!state.menu) { return; }
        if (state.menu.hidden) { openMenu(); } else { closeMenu(); }
    }

    function updateControls() {
        var selectedLabel = "Original";
        MODES.forEach(function (mode) {
            if (mode.id === state.mode) { selectedLabel = mode.label; }
        });
        if (state.button) {
            var active = state.mode !== "original";
            state.button.classList.toggle("is-active", active);
            state.button.setAttribute("aria-pressed", active ? "true" : "false");
            state.button.setAttribute("aria-label", "VR View: " + selectedLabel);
            state.button.title = "VR View: " + selectedLabel;
        }
        menuItems().forEach(function (item) {
            var selected = item.getAttribute("data-mode") === state.mode;
            item.classList.toggle("is-selected", selected);
            item.setAttribute("aria-checked", selected ? "true" : "false");
        });
    }

    function cropForMode(mode, width, height) {
        if (mode === "sbs-left") {
            return { x: 0, y: 0, width: width / 2, height: height };
        }
        if (mode === "sbs-right") {
            return { x: width / 2, y: 0, width: width / 2, height: height };
        }
        if (mode === "ou-top") {
            return { x: 0, y: 0, width: width, height: height / 2 };
        }
        if (mode === "ou-bottom") {
            return { x: 0, y: height / 2, width: width, height: height / 2 };
        }
        return { x: 0, y: 0, width: width, height: height };
    }

    function clearCssCrop() {
        if (!state.player) { return; }
        state.player.style.removeProperty("--lynx-vr-video-width");
        state.player.style.removeProperty("--lynx-vr-video-height");
        state.player.style.removeProperty("--lynx-vr-video-left");
        state.player.style.removeProperty("--lynx-vr-video-top");
    }

    function layoutCssCrop() {
        var player = state.player;
        var video = state.video;
        if (!player || !video || state.mode === "original" ||
            !video.videoWidth || !video.videoHeight) {
            return;
        }

        var playerWidth = Math.max(1, player.clientWidth);
        var playerHeight = Math.max(1, player.clientHeight);
        var source = cropForMode(state.mode, video.videoWidth, video.videoHeight);
        var scale = Math.min(playerWidth / source.width, playerHeight / source.height);
        var eyeWidth = source.width * scale;
        var eyeHeight = source.height * scale;
        var fullWidth = video.videoWidth * scale;
        var fullHeight = video.videoHeight * scale;
        var left = (playerWidth - eyeWidth) / 2 - source.x * scale;
        var top = (playerHeight - eyeHeight) / 2 - source.y * scale;

        player.style.setProperty("--lynx-vr-video-width", fullWidth + "px");
        player.style.setProperty("--lynx-vr-video-height", fullHeight + "px");
        player.style.setProperty("--lynx-vr-video-left", left + "px");
        player.style.setProperty("--lynx-vr-video-top", top + "px");
    }

    function bindVideo(video) {
        if (state.videoCleanup) { state.videoCleanup(); }
        var onRefresh = function () { layoutCssCrop(); };
        var events = ["loadedmetadata", "loadeddata", "emptied"];
        events.forEach(function (name) { video.addEventListener(name, onRefresh); });
        state.videoCleanup = function () {
            events.forEach(function (name) { video.removeEventListener(name, onRefresh); });
        };
    }

    function setMode(mode) {
        if (MODE_IDS.indexOf(mode) === -1) { mode = "original"; }
        state.mode = mode;
        if (!state.player || !state.video) { return; }

        MODE_CLASSES.forEach(function (className) {
            state.player.classList.remove(className);
        });
        state.player.classList.remove("lynx-vr-canvas-fallback", "lynx-vr-css-crop");
        state.player.classList.add("lynx-vr-mode-" + mode);

        if (mode === "original") {
            state.player.classList.remove("lynx-vr-view-enabled");
            state.video.classList.remove("lynx-vr-view-source-hidden");
            clearCssCrop();
        } else {
            state.player.classList.add("lynx-vr-view-enabled", "lynx-vr-css-crop");
            state.video.classList.remove("lynx-vr-view-source-hidden");
            layoutCssCrop();
        }
        updateControls();
    }

    function clearPlayerClasses(player) {
        if (!player) { return; }
        player.classList.remove("lynx-vr-view-enabled", "lynx-vr-canvas-fallback", "lynx-vr-css-crop");
        MODE_CLASSES.forEach(function (className) { player.classList.remove(className); });
        player.style.removeProperty("--lynx-vr-video-width");
        player.style.removeProperty("--lynx-vr-video-height");
        player.style.removeProperty("--lynx-vr-video-left");
        player.style.removeProperty("--lynx-vr-video-top");
    }

    function unmountPlayerUI(resetMode) {
        if (state.videoCleanup) { state.videoCleanup(); }
        state.videoCleanup = null;
        if (state.resizeObserver) { state.resizeObserver.disconnect(); }
        state.resizeObserver = null;
        if (state.video) { state.video.classList.remove("lynx-vr-view-source-hidden"); }
        clearPlayerClasses(state.player);
        if (state.button && state.button.parentNode) { state.button.parentNode.removeChild(state.button); }
        if (state.menu && state.menu.parentNode) { state.menu.parentNode.removeChild(state.menu); }
        state.player = null;
        state.video = null;
        state.button = null;
        state.menu = null;
        if (resetMode) { state.mode = "original"; }
    }

    function mountPlayerUI() {
        if (!state.detected || !state.sceneId) { return; }
        var player = findScenePlayer();
        if (!player) { return; }
        var video = player.querySelector("video");
        var controlBar = player.querySelector(".vjs-control-bar");
        if (!video || !controlBar) { return; }

        if (state.player === player && state.video === video &&
            state.button && state.button.isConnected && state.menu && state.menu.isConnected) {
            return;
        }

        unmountPlayerUI(false);
        state.player = player;
        state.video = video;
        state.button = makeButton(controlBar);
        state.menu = makeMenu(player);
        state.button.setAttribute("aria-controls", state.menu.id);
        bindVideo(video);

        if (typeof ResizeObserver === "function") {
            state.resizeObserver = new ResizeObserver(function () {
                layoutCssCrop();
            });
            state.resizeObserver.observe(player);
        }
        setMode(state.mode);
    }

    function resetForRoute(info) {
        state.routeToken += 1;
        if (state.abortController) { state.abortController.abort(); }
        state.abortController = null;
        unmountPlayerUI(true);
        state.sceneId = info ? info.id : null;
        state.scenePrefix = info ? info.prefix : "";
        state.metadataSceneId = null;
        state.metadataPending = false;
        state.detected = false;
        state.detectionReason = "";
    }

    function processPage() {
        state.scheduled = null;
        var info = routeInfo();
        var nextId = info ? info.id : null;
        if (nextId !== state.sceneId) { resetForRoute(info); }
        if (!info) { return; }

        if (state.detected) {
            mountPlayerUI();
            return;
        }
        if (state.metadataPending) { return; }
        if (state.metadataSceneId !== info.id) {
            fetchSceneMetadata(info.id, info.prefix, state.routeToken);
            return;
        }

        var reason = detectFromDOM();
        if (reason) {
            state.detected = true;
            state.detectionReason = reason;
            debug("VR scene detected via " + reason);
            mountPlayerUI();
        }
    }

    function schedulePageCheck() {
        window.clearTimeout(state.scheduled);
        state.scheduled = window.setTimeout(processPage, 80);
    }

    function installLocationHooks() {
        ["pushState", "replaceState"].forEach(function (name) {
            var original = window.history[name];
            if (!original || original.__lynxVRWrapped) { return; }
            var wrapped = function () {
                var result = original.apply(this, arguments);
                schedulePageCheck();
                return result;
            };
            wrapped.__lynxVRWrapped = true;
            window.history[name] = wrapped;
        });
        window.addEventListener("popstate", schedulePageCheck);
        if (window.PluginApi && PluginApi.Event && PluginApi.Event.addEventListener) {
            PluginApi.Event.addEventListener("stash:location", schedulePageCheck);
        }
    }

    function boot() {
        installLocationHooks();
        document.addEventListener("pointerdown", function (event) {
            if (!state.menu || state.menu.hidden) { return; }
            if (state.menu.contains(event.target) ||
                (state.button && state.button.contains(event.target))) { return; }
            closeMenu();
        }, true);
        document.addEventListener("keydown", function (event) {
            if (event.key === "Escape" && state.menu && !state.menu.hidden) {
                closeMenu();
                if (state.button) { state.button.focus(); }
            }
        });
        new MutationObserver(schedulePageCheck).observe(document.body, {
            childList: true,
            subtree: true
        });
        processPage();
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", boot, { once: true });
    } else {
        boot();
    }
}());

})(window.LynxToolsRuntime.fetchFor("LynxVRView"));
