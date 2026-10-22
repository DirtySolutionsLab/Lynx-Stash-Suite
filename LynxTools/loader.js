/* Lynx Tools: same-origin assets, module-local failures, no shared-spec dependency. */
(() => {
  'use strict';
  if (window.__lynxToolsLocalBoot) return;
  window.__lynxToolsLocalBoot = true;
  const bundle = 'LynxTools';
  const modules = [
    {name:'Cropper',enabled:'crop_enabled',css:['modules/cropper/LynxCropper.css'],js:['modules/cropper/LynxCropper.js']},
    {name:'Gallery Context Menu',enabled:'galleryMenu_enabled',css:['modules/galleryMenu/stashRightClickGalleries.css'],js:['modules/galleryMenu/lynxRightClickCore.js','modules/galleryMenu/stashRightClickGalleries.js']},
    {name:'Image Context Menu',enabled:'imageMenu_enabled',css:['modules/imageMenu/stashRightClickImages.css'],js:['modules/imageMenu/lynxRightClickCore.js','modules/imageMenu/stashRightClickImages.js']},
    {name:'Performer Context Menu',enabled:'performerMenu_enabled',css:['modules/performerMenu/stashRightClickPerformers.css'],js:['modules/performerMenu/lynxRightClickCore.js','modules/performerMenu/stashRightClickPerformers.js']},
    {name:'Scene Context Menu',enabled:'sceneMenu_enabled',css:['modules/sceneMenu/stashRightClickScenes.css'],js:['modules/sceneMenu/stashRightClickScenes.js']},
    {name:'Settings Context Menu',enabled:'settingsMenu_enabled',css:['modules/settingsMenu/lynxRightClickCore.css','modules/settingsMenu/stashRightClickSettings.css'],js:['modules/settingsMenu/lynxRightClickCore.js','modules/settingsMenu/stashRightClickSettings.js']},
    {name:'Tag Context Menu',enabled:'tagMenu_enabled',css:['modules/tagMenu/stashRightClickTags.css'],js:['modules/tagMenu/lynxRightClickCore.js','modules/tagMenu/stashRightClickTags.js']},
    {name:'VR Viewer',enabled:'vr_enabled',css:['modules/vrViewer/LynxVRView.css'],js:['modules/vrViewer/LynxVRView.js']}
  ];
  const promises = new Map();
  function load(path, type) {
    // The right-click core is installed as five copies. Request the current
    // revision under a distinct URL so a cached pre-alias version cannot win.
    const revision = type === 'js' && path.endsWith('/lynxRightClickCore.js') ? '?v=2.1.2-rc.2' : '?v=1.0.0-rc.2';
    const url = '/plugin/' + bundle + '/assets/' + path + revision;
    if (promises.has(url)) return promises.get(url);
    const result = new Promise((resolve,reject) => {
      const node = document.createElement(type === 'css' ? 'link' : 'script');
      if (type === 'css') { node.rel = 'stylesheet'; node.href = url; }
      else { node.src = url; node.async = false; }
      node.onload = resolve;
      node.onerror = () => { node.remove(); reject(Error('Could not load ' + path)); };
      document.head.append(node);
    });
    promises.set(url,result);
    return result;
  }
  function report(name,error) {
    console.error('[Lynx Tools / '+name+']',error);
    const node=document.createElement('p');
    node.className='lynx-suite-load-error';node.setAttribute('role','alert');
    node.textContent='Lynx Tools: '+name+' failed to load. '+error.message+'. Other modules are loaded independently.';
    document.body.append(node);
  }
  (async () => {
    const response = await fetch('/graphql',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({query:'{configuration{plugins}}'})});
    const result = await response.json();
    if (!response.ok || result.errors || !result.data?.configuration) throw Error('Could not read module settings');
    const settings=result.data.configuration.plugins?.[bundle]||{};
    for (const module of modules) {
      if (settings[module.enabled] !== true) continue;
      try {
        for (const path of module.css) await load(path,'css');
        for (const path of module.js) await load(path,'js');
      } catch (error) { report(module.name,error); }
    }
  })().catch(error=>report('Configuration',error));
})();
