(function(fetch){
/* Explicit current-page Mature.nl batches. One bounded request per performer. */
(() => {
  'use strict';
  if (window.__lynxMatureNLBatch) return;
  const fields = {"body_type":"Body Type","breast_size":"Breast Size","age_range":"Add age-range tag","height_category":"Add height-category tag","body_mods":"Add body-modification tag","ethnicity":"Ethnicity (from Skincolor)","country":"Country","name":"Name","details":"Biography","image":"Profile Image"};
  const selected = new Set();
  let toolbar, signature='', timer, active;
  function el(tag,text,cls) {const n=document.createElement(tag);if(text!=null)n.textContent=text;if(cls)n.className=cls;return n;}
  function rows() {
    return [...document.querySelectorAll('.PerformerTagger > .PerformerTagger-performer')].flatMap(row=>{
      const link=row.querySelector('.PerformerTagger-details a.PerformerTagger-header[href]');
      if(!link)return [];
      const match=new URL(link.getAttribute('href'),location.origin).pathname.match(/^\/performers\/([1-9]\d*)\/?$/);
      return match?[{id:match[1],name:link.textContent.trim(),row}]:[];
    });
  }
  function refresh() {
    if(!toolbar)return;
    toolbar.querySelector('[data-count]').textContent=`${selected.size} selected on this page · maximum 100 per batch`;
    toolbar.querySelector('[data-open]').disabled=Boolean(active)||!selected.size||selected.size>100;
    document.querySelectorAll('[data-lmnl-batch-check]').forEach(n=>{n.checked=selected.has(n.dataset.lmnlBatchCheck);n.disabled=Boolean(active);});
  }
  async function call(args) {
    const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),90000);
    try {
      const r=await fetch('/graphql',{method:'POST',credentials:'same-origin',signal:controller.signal,headers:{'Content-Type':'application/json'},body:JSON.stringify({query:'mutation($id:ID!,$args:Map!){runPluginOperation(plugin_id:$id,args:$args)}',variables:{id:'LynxScrapingSuite',args:{...args,module:'matureNL'}}})});
      if(!r.ok)throw Error(`HTTP ${r.status}`);
      const data=await r.json();if(data.errors?.length)throw Error(data.errors.map(e=>e.message).join('; '));
      let result=data.data.runPluginOperation;if(typeof result==='string')result=JSON.parse(result);
      if(!result)throw Error('The plugin returned no response.');return result;
    } finally {clearTimeout(timeout);}
  }
  function button(text,action,cls) {const b=el('button',text,cls);b.type='button';b.addEventListener('click',action);return b;}
  function close(s) {if(s.busy){s.stop=true;s.status.textContent='Stopping after the current performer…';return;}s.dialog.close();s.dialog.remove();if(active===s)active=null;refresh();}
  function scopeValid(s) {return s.scope===rows().map(r=>r.id).join(',');}
  function controls(s,busy) {s.busy=busy;s.preview.disabled=busy;s.save.disabled=busy||!s.records.some(r=>r.box.querySelector('input:checked'));s.config.querySelectorAll('input').forEach(n=>n.disabled=busy);s.results.querySelectorAll('input').forEach(n=>n.disabled=busy);s.close.disabled=busy;s.stopButton.disabled=!busy;}
  function renderRecord(s,p) {
    const box=el('details',null,'lmnl-batch-record');box.open=false;
    box.append(el('summary',p.performer_name));
    const source={...p.profile.fields,...p.profile.custom,...p.profile.tag_fields};const record={p,box};
    const chosen=new Set([...s.config.querySelectorAll('[data-field]:checked')].map(n=>n.dataset.field));
    const replace=s.config.querySelector('[data-replace]').checked;
    let count=0;
    for(const [key,label] of Object.entries(fields)) {
      if(!chosen.has(key))continue;
      const value=key==='image'?p.profile.image:source[key];const old=p.current[key];
      const empty=key==='image'?!old?.path:old==null||old==='';
      const cleanup=p.cleanup?.[key]?.length && String(old??'')===String(value);
      if(value==null||value==='')continue;
      if(!replace&&!empty&&!cleanup)continue;
      if(key!=='image'&&String(old??'')===String(value)&&!cleanup)continue;
      const line=el('label',null,'lmnl-batch-value');const check=el('input');check.type='checkbox';check.dataset.field=key;check.checked=true;check.disabled=s.busy;
      check.addEventListener('change',()=>controls(s,false));
      line.append(check,el('span',label),el('span',key==='image'?(old?.path?'Existing image':'No image'):`${old??'—'} → ${value}`));
      if(key==='image'){const image=el('img');image.src=value.data_uri;image.alt=`Profile Image: ${p.performer_name}`;line.append(image);}
      if(p.cleanup?.[key]?.length) line.append(el('small','Also removes matching legacy fields: '+p.cleanup[key].join(', '),'lmnl-note'));
      box.append(line);count++;
    }
    box.append(el('small',p.profile.warnings.join(' · ')||'Only checked fields are requested for import.'));
    if(!count)box.append(el('p','No selected fields need updating with these options.'));
    box.querySelector('summary').textContent=p.performer_name+' — '+count+' proposed field(s)';record.status=el('p','Previewed','lmnl-note');box.append(record.status);s.results.append(box);s.records.push(record);
  }
  async function preview(s) {
    if(s.busy)return;
    if(!scopeValid(s)){s.status.textContent='The page changed. Close this dialog and select performers again.';return;}
    if(!s.config.querySelector('[data-field]:checked')){s.status.textContent='Select at least one field to preview.';return;}
    s.stop=false;s.records=[];s.results.replaceChildren();controls(s,true);
    const image=s.config.querySelector('[data-field="image"]').checked;let done=0,skipped=0,failed=0;
    try {
      for(const target of s.targets) {
        if(s.stop||!scopeValid(s))break;
        s.status.textContent=`Previewing ${++done}/${s.targets.length}: ${target.name}`;
        try {const p=await call({mode:'batch_preview',performer_id:target.id,include_image:image});
          if(p.skipped){skipped++;s.results.append(el('p',`${p.performer_name||target.name}: ${p.skipped}`,'lmnl-note'));}else renderRecord(s,p);
        } catch(e){failed++;s.results.append(el('p',`${target.name}: ${e.message}`,'lmnl-note'));}
        await new Promise(resolve=>setTimeout(resolve,350));
      }
      s.status.textContent=`${s.stop||!scopeValid(s)?'Stopped. ':''}${s.records.length} previewed · ${skipped} skipped · ${failed} errors. Nothing was saved.`;
    } finally {controls(s,false);}
  }
  async function save(s) {
    if(s.busy)return;
    if(!scopeValid(s)){s.status.textContent='The page changed. Close this dialog and select performers again.';return;}
    const plans=s.records.map(r=>({r,keys:[...r.box.querySelectorAll('input:checked')].map(n=>n.dataset.field)})).filter(p=>p.keys.length);
    if(!plans.length)return;
    if(!confirm(`Import selected fields into ${plans.length} performers?\n\n${plans.some(p=>p.keys.includes('image'))?'Selected profile images replace current images.\n':''}Selected tags are added and existing tags are kept. Matching legacy fields shown in the preview are removed for selected imports. Enabled Attributes/Bridge hooks may also update tags and related objects.`))return;
    controls(s,true);s.stop=false;let saved=0,failed=0,skipped=0;
    try {
      for(const {r,keys} of plans) {
        if(s.stop||!scopeValid(s))break;
        const p=r.p;s.status.textContent=`Importing ${saved+failed+skipped+1}/${plans.length}: ${p.performer_name}`;
        try {const result=await call({mode:'batch_import',performer_id:p.performer_id,url:p.profile.url,resolution:p.resolution,fields:keys,expected:p.current,source_expected:{...p.profile.fields,...p.profile.custom,...p.profile.tag_fields,...(p.profile.image?{image:{url:p.profile.image.url,sha256:p.profile.image.sha256}}:{})},custom_names:p.custom_names});
          if(result.skipped){skipped++;r.status.textContent=result.skipped;}else{saved++;r.status.textContent=result.changed?'Saved.':'Already identical.';}
        } catch(e){failed++;r.status.textContent=`The save could not be confirmed: ${e.message}. Check the performer before retrying.`;}
        r.box.querySelectorAll('input').forEach(n=>{n.checked=false;});
        await new Promise(resolve=>setTimeout(resolve,350));
      }
      s.status.textContent=`${s.stop||!scopeValid(s)?'Stopped. ':''}${saved} completed · ${skipped} skipped · ${failed} errors. Reload the page to see saved values.`;
    } finally {controls(s,false);}
  }
  function open() {
    if(active||document.querySelector('.lmnl-dialog[open]'))return;
    const current=rows(), targets=[...new Map(current.filter(r=>selected.has(r.id)).map(r=>[r.id,r])).values()];if(!targets.length||targets.length>100)return;
    const dialog=el('dialog',null,'lmnl-dialog lmnl-batch-dialog');dialog.dataset.lmnlBatchUi='true';
    const s={dialog,targets,scope:current.map(r=>r.id).join(','),records:[],busy:false,stop:false};active=s;
    const h=el('h2',`Mature.nl – ${targets.length} selected performers`);h.id='lmnl-batch-title';dialog.setAttribute('aria-labelledby',h.id);
    s.config=el('section',null,'lmnl-batch-config');
    for(const [key,label] of Object.entries(fields)){const wrap=el('label');const n=el('input');n.type='checkbox';n.dataset.field=key;n.checked=!['image','name','details'].includes(key);wrap.append(n,el('span',label));s.config.append(wrap);}
    const replace=el('label',null,'lmnl-batch-replace');const n=el('input');n.type='checkbox';n.dataset.replace='true';replace.append(n,el('span','Overwrite existing values for selected fields'));s.config.append(replace);
    s.config.addEventListener('change',()=>{s.records=[];s.results.replaceChildren();s.status.textContent='Options changed. Preview again.';controls(s,false);});
    s.status=el('p','Uses a saved Mature.nl URL, otherwise name search without disambiguation. Requires one unique exact match. Maximum 100 per batch.','lmnl-status');s.status.setAttribute('role','status');
    s.results=el('section',null,'lmnl-batch-results');
    s.preview=button('Preview',()=>void preview(s),'lmnl-primary');s.save=button('Import selected fields',()=>void save(s),'lmnl-primary');
    s.stopButton=button('Stop after current',()=>{s.stop=true;s.status.textContent='Stopping after the current performer…';});s.close=button('Close',()=>close(s));
    const actions=el('div',null,'lmnl-batch-actions');actions.append(s.preview,s.save,s.stopButton,s.close);
    dialog.append(h,s.config,el('p','Fills empty fields and adds missing tags by default. Matching legacy fields listed in the preview are removed when their replacement is selected. Name, biography and profile images are initially off. Normal Stash attribute/bridge hooks may run after import.','lmnl-note'),actions,s.status,s.results);
    dialog.addEventListener('cancel',e=>{e.preventDefault();close(s);});document.body.append(dialog);dialog.showModal();controls(s,false);refresh();
  }
  function decorate() {
    const current=rows(), header=document.querySelector('.tagger-container-header'), next=current.map(r=>r.id).join(',');
    if(next!==signature){selected.clear();signature=next;if(active?.busy)active.stop=true;}
    if(!header||!current.length){toolbar?.remove();toolbar=null;return;}
    if(!toolbar?.isConnected){toolbar=el('section',null,'lmnl-batch-toolbar');toolbar.dataset.lmnlBatchUi='true';const count=el('span');count.dataset.count='true';
      const launch=button('Mature.nl – batch',open);launch.dataset.open='true';
      toolbar.append(el('strong','Mature.nl'),count,button('Select page',()=>{if(active)return;currentRowsSelect(true);}),button('Clear selection',()=>{if(active)return;selected.clear();refresh();}),launch);header.append(toolbar);}
    for(const item of current){if(item.row.querySelector('[data-lmnl-batch-check]'))continue;
      const label=el('label',null,'lmnl-batch-select');label.dataset.lmnlBatchUi='true';const n=el('input');n.type='checkbox';n.dataset.lmnlBatchCheck=item.id;n.setAttribute('aria-label',`Select ${item.name} for Mature.nl`);
      n.addEventListener('change',()=>{if(n.checked)selected.add(item.id);else selected.delete(item.id);refresh();});label.addEventListener('click',e=>e.stopPropagation());label.append(n,el('span',' Mature.nl'));item.row.querySelector('.PerformerTagger-details')?.prepend(label);}
    refresh();
  }
  function currentRowsSelect(all){selected.clear();if(all)rows().forEach(r=>selected.add(r.id));refresh();}
  const observer=new MutationObserver(records=>{if(records.every(r=>r.target instanceof Element&&r.target.closest('[data-lmnl-batch-ui]')))return;clearTimeout(timer);timer=setTimeout(decorate,180);});
  function start(){observer.observe(document.body,{childList:true,subtree:true});decorate();}
  window.__lynxMatureNLBatch={dispose(){if(active?.busy){active.stop=true;return;}observer.disconnect();clearTimeout(timer);if(active)close(active);toolbar?.remove();document.querySelectorAll('.lmnl-batch-select').forEach(n=>n.remove());delete window.__lynxMatureNLBatch;}};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();

})(window.fetch.bind(window));
