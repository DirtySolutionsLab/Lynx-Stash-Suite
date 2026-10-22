/* Module-scoped API compatibility. Does not intercept Stash's global fetch. */
(() => {
  'use strict';
  if(window.LynxSuite)return;
  const nativeFetch=window.fetch.bind(window);
  const map={"LynxTheme": {"bundle": "LynxTheme", "module": "theme", "prefix": "", "enabled": "theme_enabled"}, "LynxSceneCard": {"bundle": "LynxTheme", "module": "sceneCards", "prefix": "cards__", "enabled": "cards_enabled"}, "LynxEnhancedCards": {"bundle": "LynxTheme", "module": "enhancedCards", "prefix": "enhanced__", "enabled": "enhanced_enabled"}, "LynxPluginCompatibility": {"bundle": "LynxTheme", "module": "compatibility", "prefix": "compat__", "enabled": "compat_enabled"}, "LynxPerformerAttributeTags": {"bundle": "LynxPerformerSuite", "module": "attributes", "prefix": "attributes__", "enabled": "attributes_enabled"}, "LynxTagBridge": {"bundle": "LynxPerformerSuite", "module": "tagTransfer", "prefix": "tags__", "enabled": "tags_enabled"}, "LynxPerformerBridge": {"bundle": "LynxPerformerSuite", "module": "performerLinks", "prefix": "links__", "enabled": "links_enabled"}, "PerformerTagBasedSupportingImages": {"bundle": "LynxPerformerSuite", "module": "supportingImages", "prefix": "images__", "enabled": "images_enabled"}, "LynxXLGirls": {"bundle": "LynxScrapingSuite", "module": "xlGirls", "prefix": "xl__", "enabled": "xl_enabled"}, "LynxCropper": {"bundle": "LynxTools", "module": "cropper", "prefix": "crop__", "enabled": "crop_enabled"}, "stashRightClickScenes": {"bundle": "LynxTools", "module": "sceneMenu", "prefix": "sceneMenu__", "enabled": "sceneMenu_enabled"}, "stashRightClickGalleries": {"bundle": "LynxTools", "module": "galleryMenu", "prefix": "galleryMenu__", "enabled": "galleryMenu_enabled"}, "stashRightClickImages": {"bundle": "LynxTools", "module": "imageMenu", "prefix": "imageMenu__", "enabled": "imageMenu_enabled"}, "stashRightClickPerformers": {"bundle": "LynxTools", "module": "performerMenu", "prefix": "performerMenu__", "enabled": "performerMenu_enabled"}, "stashRightClickTags": {"bundle": "LynxTools", "module": "tagMenu", "prefix": "tagMenu__", "enabled": "tagMenu_enabled"}, "stashRightClickSettings": {"bundle": "LynxTools", "module": "settingsMenu", "prefix": "settingsMenu__", "enabled": "settingsMenu_enabled"}, "LynxVRView": {"bundle": "LynxTools", "module": "vrViewer", "prefix": "vr__", "enabled": "vr_enabled"}, "LynxRenamer": {"bundle": "LynxRenamer", "module": "renamer", "prefix": "", "enabled": null}};
  const tasks={"LynxTheme": {}, "LynxEnhancedCards": {}, "LynxPluginCompatibility": {}, "LynxCropper": {}, "LynxPerformerAttributeTags": {"Lynx attribut \u2013 f\u00f6rhandsgranska urval": "Attributes \u2014 Preview selected performers", "Lynx attribut \u2013 uppdatera urval": "Attributes \u2014 Update selected performers", "Lynx attribut \u2013 f\u00f6rhandsgranska alla performers": "Attributes \u2014 Preview all performers", "Lynx attribut \u2013 uppdatera alla performers": "Attributes \u2014 Update all performers", "Lynx attribut \u2013 bearbeta k\u00f6ade \u00e4ndringar": "Attributes \u2014 Process queued changes"}, "LynxPerformerBridge": {"Lynx \u2013 bearbeta performer-k\u00f6n": "Performer Links \u2014 Process queue", "Lynx \u2013 f\u00f6rhandsgranska performer\u00f6verf\u00f6ring": "Performer Links \u2014 Preview transfer", "Lynx \u2013 \u00f6verf\u00f6r performers f\u00f6r valda gallerier": "Performer Links \u2014 Transfer selected galleries"}, "LynxRenamer": {"Enable automatic renaming": "Enable automatic renaming", "Disable automatic renaming": "Disable automatic renaming", "Toggle dry-run": "Toggle dry-run", "Rename all scenes": "Rename all scenes"}, "stashRightClickGalleries": {}, "stashRightClickImages": {}, "stashRightClickPerformers": {}, "stashRightClickScenes": {}, "stashRightClickSettings": {}, "stashRightClickTags": {}, "LynxSceneCard": {}, "LynxTagBridge": {"Lynx \u2013 bearbeta k\u00f6ade \u00e4ndringar": "Tag Transfer \u2014 Process queued changes", "Lynx \u2013 f\u00f6rhandsgranska tagg\u00f6verf\u00f6ring": "Tag Transfer \u2014 Preview transfer", "Lynx \u2013 \u00f6verf\u00f6r taggar i biblioteket": "Tag Transfer \u2014 Transfer library tags"}, "LynxVRView": {}, "LynxXLGirls": {}, "PerformerTagBasedSupportingImages": {}};
  const specs={"LynxTheme": [{"enabled": "theme_enabled", "css": [], "js": ["lynx-theme.js"]}, {"enabled": "enhanced_enabled", "css": ["modules/enhancedCards/enhanced-cards.css"], "js": []}, {"enabled": "compat_enabled", "css": ["modules/compatibility/plugin-compatibility.css", "modules/compatibility/user-plugin-overrides.css"], "js": []}, {"enabled": "cards_enabled", "css": ["modules/sceneCards/LynxSceneCard.css"], "js": ["modules/sceneCards/LynxSceneCard.js"]}], "LynxPerformerSuite": [{"enabled": "attributes_enabled", "css": ["engines/attributes/body-type.css", "engines/attributes/tagger-batch.css", "engines/attributes/list-attributes.css"], "js": ["engines/attributes/body-type.js", "engines/attributes/tagger-batch.js", "engines/attributes/list-attributes.js"]}, {"enabled": "links_enabled", "css": [], "js": []}, {"enabled": "tags_enabled", "css": [], "js": []}, {"enabled": "images_enabled", "css": ["modules/supportingImages/PerformerTagBasedSupportingImages.css"], "js": ["modules/supportingImages/PerformerTagBasedSupportingImages.js"]}], "LynxTools": [{"enabled": "crop_enabled", "css": ["modules/cropper/LynxCropper.css"], "js": ["modules/cropper/LynxCropper.js"]}, {"enabled": "galleryMenu_enabled", "css": ["modules/galleryMenu/stashRightClickGalleries.css"], "js": ["modules/galleryMenu/lynxRightClickCore.js", "modules/galleryMenu/stashRightClickGalleries.js"]}, {"enabled": "imageMenu_enabled", "css": ["modules/imageMenu/stashRightClickImages.css"], "js": ["modules/imageMenu/lynxRightClickCore.js", "modules/imageMenu/stashRightClickImages.js"]}, {"enabled": "performerMenu_enabled", "css": ["modules/performerMenu/stashRightClickPerformers.css", "https://cdn.jsdelivr.net/npm/toastify-js@1.12.0/src/toastify.min.css"], "js": ["https://cdn.jsdelivr.net/npm/toastify-js@1.12.0/src/toastify.min.js", "modules/performerMenu/lynxRightClickCore.js", "modules/performerMenu/stashRightClickPerformers.js"]}, {"enabled": "sceneMenu_enabled", "css": ["modules/sceneMenu/stashRightClickScenes.css"], "js": ["modules/sceneMenu/stashRightClickScenes.js"]}, {"enabled": "settingsMenu_enabled", "css": ["modules/settingsMenu/lynxRightClickCore.css", "modules/settingsMenu/stashRightClickSettings.css"], "js": ["modules/settingsMenu/lynxRightClickCore.js", "modules/settingsMenu/stashRightClickSettings.js"]}, {"enabled": "tagMenu_enabled", "css": ["modules/tagMenu/stashRightClickTags.css"], "js": ["modules/tagMenu/lynxRightClickCore.js", "modules/tagMenu/stashRightClickTags.js"]}, {"enabled": "vr_enabled", "css": ["modules/vrViewer/LynxVRView.css"], "js": ["modules/vrViewer/LynxVRView.js"]}], "LynxRenamer": [{"enabled": null, "css": ["LynxRenamer.css"], "js": ["LynxRenamer.js"]}], "LynxScrapingSuite": [{"enabled": "xl_enabled", "css": ["engines/xlGirls/tagger.css", "engines/xlGirls/batch.css"], "js": ["engines/xlGirls/tagger.js", "engines/xlGirls/batch.js"]}]};
  function aliases(configuration){
    const result={...configuration};
    for(const [legacy,spec] of Object.entries(map)){
      if(legacy===spec.bundle&&!spec.prefix)continue;
      const saved=configuration[spec.bundle]||{};
      const values={};
      for(const [key,value] of Object.entries(saved))if(key.startsWith(spec.prefix))values[key.slice(spec.prefix.length)]=value;
      if(spec.enabled&&saved[spec.enabled]!==true){values.automatic=false;values.automaticBraSize=false;}
      result[legacy]=values;
    }
    return result;
  }
  function route(body,actor){
    const result={...body,variables:{...(body.variables||{})}};
    const operation=/\b(runPluginOperation|runPluginTask|configurePlugin)\s*\(/.exec(result.query||'');
    if(!operation)return result;
    const target=/plugin_id\s*:\s*(?:"([^"]+)"|\$(\w+))/.exec(result.query);
    if(!target)throw Error('Cannot safely route this plugin request.');
    const legacy=target[1]||result.variables[target[2]], spec=map[legacy];
    if(!spec)return result;
    if(target[1])result.query=result.query.replace(target[0],`plugin_id:"${spec.bundle}"`);
    else result.variables[target[2]]=spec.bundle;
    if(operation[1]==='runPluginOperation'&&spec.bundle!==legacy){
      const arg=/\bargs\s*:\s*\$(\w+)/.exec(result.query);
      if(!arg)throw Error('Module operations require an explicit argument map.');
      result.variables[arg[1]]={...(result.variables[arg[1]]||{}),module:spec.module};
    }
    if(operation[1]==='configurePlugin'&&spec.prefix){
      const arg=/\binput\s*:\s*\$(\w+)/.exec(result.query);
      if(!arg)throw Error('Settings changes require an explicit input map.');
      result.variables[arg[1]]=Object.fromEntries(Object.entries(result.variables[arg[1]]||{}).map(([key,value])=>[spec.prefix+key,value]));
    }
    if(operation[1]==='runPluginTask'){
      const argumentMap=/\bargs_map\s*:\s*\$(\w+)/.exec(result.query);
      if(argumentMap && spec.bundle!==legacy)result.variables[argumentMap[1]]={...(result.variables[argumentMap[1]]||{}),module:spec.module};
      const task=/task_name\s*:\s*(?:"([^"]+)"|\$(\w+))/.exec(result.query);
      if(!task)throw Error('A named module task is required.');
      const old=task[1]||result.variables[task[2]], name=tasks[legacy]?.[old];
      if(!name)throw Error('Unknown module task: '+old);
      if(task[1])result.query=result.query.replace(task[0],`task_name:${JSON.stringify(name)}`);
      else result.variables[task[2]]=name;
    }
    return result;
  }
  function fetchFor(actor){
    return async (input,init)=>{
      let request=init, graphql=false;
      const url=typeof input==='string'?input:input?.url;
      if(url&&new URL(url,location.origin).pathname==='/graphql'&&typeof init?.body==='string'){
        const body=JSON.parse(init.body);
        request={...init,body:JSON.stringify(route(body,actor))};graphql=true;
      }
      const response=await nativeFetch(input,request);
      if(!graphql||!response.ok)return response;
      const data=await response.clone().json();
      if(data.data?.configuration?.plugins){
        data.data.configuration.plugins=aliases(data.data.configuration.plugins);
        const headers=new Headers(response.headers);headers.delete('Content-Length');
        return new Response(JSON.stringify(data),{status:response.status,statusText:response.statusText,headers});
      }
      return response;
    };
  }
  async function runTask(legacy,name){
    const response=await fetchFor(legacy)('/graphql',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({
      query:'mutation($id:ID!,$name:String!){runPluginTask(plugin_id:$id,task_name:$name)}',variables:{id:legacy,name}})});
    const data=await response.json();if(!response.ok||data.errors)throw Error(data.errors?.map(e=>e.message).join('; ')||`HTTP ${response.status}`);
    return data.data.runPluginTask;
  }
  let configPromise;
  function configuration(){
    return configPromise||(configPromise=nativeFetch('/graphql',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({query:'{configuration{plugins}}'})}).then(async response=>{
        const data=await response.json();if(!response.ok||data.errors)throw Error('Could not load Lynx module settings.');
        return data.data.configuration.plugins;
      }));
  }
  const loaded=new Set();
  const asset=(bundle,path)=>/^https?:\/\//.test(path)?path:`/plugin/${encodeURIComponent(bundle)}/assets/${path.split('/').map(encodeURIComponent).join('/')}`;
  let customLayer;
  function lastCustomLayer(){if(customLayer?.isConnected)document.head.append(customLayer);}
  async function script(bundle,path){
    const url=asset(bundle,path);if(loaded.has(url))return;
    await new Promise((resolve,reject)=>{const node=document.createElement('script');node.src=url;node.onload=()=>{loaded.add(url);resolve();};node.onerror=()=>reject(Error('Could not load '+path));document.head.append(node);});
  }
  function style(bundle,path){
    const url=asset(bundle,path);if(loaded.has(url))return Promise.resolve();
    return new Promise((resolve,reject)=>{const node=document.createElement('link');node.rel='stylesheet';node.href=url;
      node.onload=()=>{loaded.add(url);lastCustomLayer();resolve();};node.onerror=()=>reject(Error('Could not load '+path));
      document.head.append(node);});
  }
  async function boot(bundle){
    try{
      const config=(await configuration())[bundle]||{};
      for(const component of specs[bundle]||[]){
        if(component.enabled&&config[component.enabled]!==true)continue;
        for(const path of component.css||[])await style(bundle,path);
        for(const path of component.js||[])await script(bundle,path);
      }
      if(bundle==='LynxTheme'&&config.theme_enabled===true){
        customLayer=document.createElement('link');customLayer.rel='stylesheet';customLayer.href=asset(bundle,'css/stash-custom-layer.css');
        customLayer.dataset.lynxCustomLayer='true';document.head.append(customLayer);
      }
      lastCustomLayer();
    }catch(error){console.error('[Lynx Suite]',error);const message=document.createElement('p');message.className='lynx-suite-load-error';message.textContent='Lynx module failed to load. Check the browser console and reload the page.';document.body.append(message);}
  }
  window.LynxSuite={map,tasks,route,aliases,fetchFor,runTask,boot,asset};
})();
