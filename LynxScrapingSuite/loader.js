/* Lynx Scraping Suite: module-local assets and isolated source loading. */
(() => {
  'use strict';
  if (window.__lynxScrapingSuiteBoot) return;
  window.__lynxScrapingSuiteBoot = true;
  const modules = [
    {name:'XL Girls', key:'xl_enabled', dir:'xlGirls'},
    {name:'Mature.nl', key:'mature_enabled', dir:'matureNL'}
  ];
  const asset = path => '/plugin/LynxScrapingSuite/assets/' + path + '?v=1.0.0-rc.4';
  function load(path) {
    return new Promise((resolve, reject) => {
      const css = path.endsWith('.css'), node = document.createElement(css ? 'link' : 'script');
      if (css) {node.rel='stylesheet';node.href=asset(path);} else {node.src=asset(path);node.async=false;}
      node.onload=resolve;node.onerror=()=>{node.remove();reject(Error('Could not load '+path));};
      document.head.append(node);
    });
  }
  function report(name,error) {
    console.error('[Lynx Scraping Suite / '+name+']',error);
    const node=document.createElement('p');node.className='lynx-suite-load-error';
    node.setAttribute('role','alert');node.textContent='Lynx Scraping Suite: '+name+' could not load. '+error.message;
    document.body.append(node);
  }
  (async()=>{
    const response=await fetch('/graphql',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({query:'{configuration{plugins}}'})});
    const data=await response.json();
    if(!response.ok||data.errors||!data.data?.configuration)throw Error('Could not read module settings.');
    const settings=data.data.configuration.plugins?.LynxScrapingSuite||{};
    for(const source of modules) {
      if(settings[source.key]!==true)continue;
      try {for(const file of ['tagger.css','batch.css','tagger.js','batch.js'])await load('engines/'+source.dir+'/'+file);}
      catch(error){report(source.name,error);}
    }
  })().catch(error=>report('Configuration',error));
})();
