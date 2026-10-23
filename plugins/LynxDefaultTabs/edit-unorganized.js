/*
 * Lynx Default Tabs 0.3.1 — a modified adaptation of edit-unorganized.
 * Original plugin: feederbox826, https://github.com/feederbox826/plugins
 * Lynx adaptation maintained by DirtySolutionsLab. Modified 2026-10-23.
 * MIT license; see LICENSE and CREDITS.md.
 * Standalone detail-tab handling, without csLib/wfke dependencies.
 */
(() => {
  'use strict';
  if (window.__lynxEditUnorganized030) return;
  window.__lynxEditUnorganized030 = true;
  const ID = 'edit-unorganized';
  const defaults = {organized: false, targetTabScenes: 'edit', targetTabImages: 'edit', targetTabGalleries: 'edit'};
  const kinds = {scenes: 'scene', images: 'image', galleries: 'gallery'};
  const settings = {scenes: 'targetTabScenes', images: 'targetTabImages', galleries: 'targetTabGalleries'};
  const allowed = {scenes: ['details', 'queue', 'markers', 'video-filter', 'file-info', 'history', 'edit'], images: ['details', 'file-info', 'edit'], galleries: ['details', 'chapters', 'edit']};
  let config, currentPath, observer, debounce, expiry, stopped = false;
  function cleanup() {
    observer?.disconnect(); observer = undefined;
    clearTimeout(debounce); clearTimeout(expiry);
  }
  function targetFor(kind) {
    let value = String(config[settings[kind]] || config.targetTab || 'edit').trim().toLowerCase();
    value = value.replace(new RegExp('^' + kinds[kind] + '-'), '').replace(/-panel$/, '');
    if (kind === 'scenes' && value === 'filters') value = 'video-filter';
    return allowed[kind].includes(value) ? value : null;
  }
  function check() {
    debounce = undefined;
    if (!config || stopped) return;
    const match = location.pathname.match(/\/(scenes|images|galleries)\/\d+\/?$/);
    if (!match) return;
    const kind = match[1], tab = targetFor(kind);
    if (!tab) {
      console.warn('[edit-unorganized] Invalid target tab for ' + kind + '. Check plugin settings.');
      stopped = true; cleanup(); return;
    }
    const target = document.querySelector('[data-rb-event-key="' + kinds[kind] + '-' + tab + '-panel"]');
    if (!target || !target.isConnected) return;
    // Wait for the organized control too; do not treat an unfinished page as organized.
    if (config.organized !== true) {
      const organized = document.querySelector('button.organized-button');
      if (!organized) return;
      if (!organized.classList.contains('not-organized')) { stopped = true; cleanup(); return; }
    }
    // Stop before clicking: the resulting React render must not trigger another click.
    stopped = true; cleanup();
    if (target.getAttribute('aria-selected') !== 'true' && !target.classList.contains('active')) target.click();
  }
  function schedule() {
    if (stopped || debounce) return;
    debounce = setTimeout(check, 60);
  }
  function navigate() {
    if (!config || currentPath === location.pathname) return;
    currentPath = location.pathname;
    cleanup(); stopped = false;
    if (!/\/(scenes|images|galleries)\/\d+\/?$/.test(currentPath)) { stopped = true; return; }
    observer = new MutationObserver(schedule);
    observer.observe(document.body, {childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'data-rb-event-key']});
    expiry = setTimeout(() => { stopped = true; cleanup(); }, 30000);
    schedule();
  }
  // Handle Stash's client-side navigation as well as direct page loads.
  for (const method of ['pushState', 'replaceState']) {
    const original = history[method];
    history[method] = function(...args) {
      const result = original.apply(this, args);
      navigate();
      return result;
    };
  }
  window.addEventListener('popstate', navigate);
  window.addEventListener('pageshow', navigate);
  async function init() {
    try {
      const response = await fetch('/graphql', {method: 'POST', credentials: 'same-origin', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({query: '{configuration{plugins}}'})});
      const result = await response.json();
      if (!response.ok || result.errors) throw Error(result.errors?.map(e => e.message).join('; ') || 'Could not load settings.');
      config = {...defaults, ...(result.data?.configuration?.plugins?.[ID] || {})};
      if (document.body) navigate();
      else document.addEventListener('DOMContentLoaded', navigate, {once: true});
    } catch (error) { console.error('[edit-unorganized] Could not start:', error); }
  }
  init();
})();
