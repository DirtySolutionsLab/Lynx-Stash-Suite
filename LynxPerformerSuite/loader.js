/* Suite-local boot: independent of whichever older shared runtime loads first. */
(() => {
  if(window.__lynxPerformerSuiteBoot112)return;window.__lynxPerformerSuiteBoot112=true;
  const modules=[
    {name:'Performer Matcher',enabled:'matcher_enabled',css:['engines/performerMatcher/matcher.css'],js:['engines/performerMatcher/matcher.js']},
    {name:'Performer Attributes',enabled:'attributes_enabled',css:['engines/attributes/body-type.css','engines/attributes/tagger-batch.css','engines/attributes/list-attributes.css'],js:['engines/attributes/body-type.js','engines/attributes/tagger-batch.js','engines/attributes/list-attributes.js']},
    {name:'Supporting Images',enabled:'images_enabled',css:['modules/supportingImages/PerformerTagBasedSupportingImages.css'],js:['modules/supportingImages/PerformerTagBasedSupportingImages.js']}
  ];
  const asset=path=>'/plugin/LynxPerformerSuite/assets/'+path+
    (path==='modules/supportingImages/PerformerTagBasedSupportingImages.js'?'?v=1.1.2':
     path==='engines/attributes/body-type.js'?'?v=1.1.2':'');
  function load(path,type){return new Promise((resolve,reject)=>{
    const node=document.createElement(type==='css'?'link':'script');if(type==='css'){node.rel='stylesheet';node.href=asset(path);}else node.src=asset(path);
    node.onload=resolve;node.onerror=()=>reject(Error('Could not load '+path));document.head.append(node);
  });}
  (async()=>{
    const config=(await window.LynxPerformerDefaults.configuration()).LynxPerformerSuite||{};
    for(const module of modules){if(config[module.enabled]!==true)continue;
      try{for(const path of module.css)await load(path,'css');for(const path of module.js)await load(path,'js');}
      catch(error){console.error('[Lynx Performer Suite / '+module.name+']',error);const note=document.createElement('div');note.className='lynx-performer-load-error';note.textContent=module.name+' could not load. Other modules remain available. Check the browser console.';document.body.append(note);}
    }
  })().catch(error=>console.error('[Lynx Performer Suite]',error));
})();
