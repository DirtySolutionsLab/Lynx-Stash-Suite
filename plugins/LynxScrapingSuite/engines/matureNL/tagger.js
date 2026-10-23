(function(fetch){
/* Lynx Mature.nl: a separate source button, preserving StashDB's Tagger flow. */
(() => {
  'use strict';
  if (window.__lynxMatureNL) return;
  const ID = 'LynxScrapingSuite';
  const labels = {"body_type":"Body Type","breast_size":"Breast Size","age_range":"Add age-range tag","height_category":"Add height-category tag","body_mods":"Add body-modification tag","ethnicity":"Ethnicity (from Skincolor)","country":"Country","name":"Name","details":"Biography","image":"Profile Image"};
  let active = null, timer = 0;

  function el(tag, text, className) {
    const element = document.createElement(tag);
    if (text != null) element.textContent = text;
    if (className) element.className = className;
    return element;
  }
  function target(row) {
    const link = row.querySelector('.PerformerTagger-details a.PerformerTagger-header[href]');
    if (!link) return null;
    const match = new URL(link.getAttribute('href'), location.origin).pathname.match(/^\/performers\/([1-9]\d*)\/?$/);
    return match ? {id:match[1], name:link.textContent.trim(), row} : null;
  }
  function isCurrent(state) {
    return active === state && state.dialog.isConnected && state.item.row.isConnected &&
      target(state.item.row)?.id === state.item.id;
  }
  async function call(state, args) {
    state.abort?.abort();
    const abort = new AbortController(); state.abort = abort;
    const timeout = setTimeout(() => abort.abort(), 80000);
    try {
      const response = await fetch('/graphql', {method:'POST', credentials:'same-origin', signal:abort.signal,
        headers:{'Content-Type':'application/json'}, body:JSON.stringify({
          query:'mutation($id:ID!,$args:Map!){runPluginOperation(plugin_id:$id,args:$args)}',
          variables:{id:ID,args:{...args,module:"matureNL"}}
        })});
      if (!response.ok) throw new Error(`Stash returned HTTP ${response.status}.`);
      const data = await response.json();
      if (data.errors?.length) throw new Error(data.errors.map(e => e.message).join('; '));
      let result = data.data.runPluginOperation;
      if (typeof result === 'string') result = JSON.parse(result);
      if (!result) throw new Error('The plugin returned no result. Check that the Mature.nl module is enabled.');
      return result;
    } finally { clearTimeout(timeout); }
  }
  function busy(state, value, message) {
    state.busy = value;
    state.dialog.querySelectorAll('button,input').forEach(node => { node.disabled = value; });
    state.close.disabled = state.saving;
    state.status.textContent = message;
    if (!value && state.save) updateSave(state);
  }
  function updateSave(state) {
    if (state.save) state.save.disabled = state.busy || !state.body.querySelector('input[data-field]:checked');
  }
  function close(state) {
    if (state.saving) return;
    state.abort?.abort();
    state.dialog.close(); state.dialog.remove();
    if (active === state) active = null;
    if (state.opener?.isConnected) state.opener.focus();
  }
  function errorMessage(error, saving) {
    if (saving) return `The save could not be confirmed: ${error.message}. Check the performer before retrying; the change may already have been saved.`;
    return error.name === 'AbortError' ? 'The request was cancelled or timed out. Try again.' : error.message;
  }
  async function loadSearchName(state) {
    // Header text also contains disambiguation. Read only Stash's actual name,
    // rather than stripping parentheses that might be part of a real name.
    busy(state,true,'Loading the performer name without disambiguation…');
    const abort=new AbortController();state.abort=abort;
    const timeout=setTimeout(()=>abort.abort(),10000);
    try {
      const response=await fetch('/graphql',{method:'POST',credentials:'same-origin',signal:abort.signal,
        headers:{'Content-Type':'application/json'},body:JSON.stringify({
          query:'query LynxXLSearchName($id:ID!){findPerformer(id:$id){id name}}',variables:{id:state.item.id}
        })});
      if(!response.ok)throw Error(`HTTP ${response.status}`);
      const result=await response.json();
      if(result.errors?.length)throw Error(result.errors.map(e=>e.message).join('; '));
      const performer=result.data?.findPerformer;
      if(!performer||String(performer.id)!==state.item.id||!performer.name?.trim())throw Error('Could not read the performer name.');
      if(!isCurrent(state))return;
      state.query.value=performer.name.trim();
      state.query.placeholder='Name or Mature.nl profile URL';
      busy(state,false,'Search by performer name or paste an Mature.nl profile URL. Nothing is saved until you approve the import.');
      state.query.focus();state.query.select();
    } catch(error) {
      if(isCurrent(state)){
        state.query.placeholder='Enter name or profile URL';
        busy(state,false,'Could not read the name from Stash. Enter the name without disambiguation, or paste the profile URL.');
      }
    } finally {clearTimeout(timeout);}
  }
  async function preview(state, url) {
    busy(state, true, 'Loading the profile and comparing it with your performer…');
    state.body.replaceChildren(); state.save = null;
    try {
      const result = await call(state, {mode:'preview', performer_id:state.item.id, url});
      if (!isCurrent(state)) return;
      state.preview = result;
      renderPreview(state, result);
      busy(state, false, 'Select fields to import. Existing values are overwritten only when selected.');
    } catch (error) { if (isCurrent(state)) busy(state,false,errorMessage(error,false)); }
  }
  function renderPreview(state, result) {
    const source = {...result.profile.fields, ...result.profile.custom, ...result.profile.tag_fields};
    state.body.append(el('h3', `Mature.nl: ${result.profile.fields.name}`));
    const link = el('a', 'Open source profile ↗'); link.href = result.profile.url;
    link.target='_blank'; link.rel='noopener noreferrer'; state.body.append(link);
    state.body.append(el('p', `Import to ${result.performer_name} · Stash-ID ${result.performer_id}`, 'lmnl-note'));
    const header = el('div', null, 'lmnl-field lmnl-field-header');
    header.append(el('span','Import'),el('span','Current Stash value'),el('span','From Mature.nl'));
    state.body.append(header);
    for (const [key, value] of Object.entries(source)) {
      if (!(key in labels)) continue;
      const current = result.current[key];
      const row = el('div', null, 'lmnl-field');
      const label = el('label'); const check = el('input'); check.type='checkbox'; check.dataset.field=key;
      check.checked = (current == null || current === '' || (current === value && result.cleanup?.[key]?.length)) && !['name','details'].includes(key);
      check.addEventListener('change', () => updateSave(state));
      label.append(check, el('span',labels[key]));
      row.append(label, el('span',current == null || current === '' ? '—' : String(current)), el('strong',String(value)));
      if(result.cleanup?.[key]?.length) row.append(el('small','Import also removes the matching old custom field: '+result.cleanup[key].join(', '),'lmnl-note'));
      state.body.append(row);
    }
    if (result.profile.image) {
      const row = el('div',null,'lmnl-field lmnl-image-field');
      const label = el('label'); const check = el('input'); check.type='checkbox'; check.dataset.field='image';
      check.checked=false; check.addEventListener('change',()=>updateSave(state));
      label.append(check,el('span','Import profile image'));
      const currentBox=el('div',null,'lmnl-image-cell');
      if (result.current.image?.path) {
        const currentImage=el('img');currentImage.src=result.current.image.path;currentImage.alt='Current profile image in Stash';
        currentBox.append(currentImage);
      } else currentBox.append(el('span','No image'));
      const sourceBox=el('div',null,'lmnl-image-cell');const sourceImage=el('img');
      sourceImage.src=result.profile.image.data_uri;sourceImage.alt=`Mature.nl profile image for ${result.profile.fields.name}`;
      sourceBox.append(sourceImage);row.append(label,currentBox,sourceBox);state.body.append(row);
      state.body.append(el('p','Image import is off by default. Selecting it replaces the Stash profile image; other images are untouched. Save the old image first if you want to restore it later.','lmnl-note'));
    }
    if (result.profile.warnings.length) {
      const warnings = el('ul',null,'lmnl-note');
      result.profile.warnings.forEach(text => warnings.append(el('li',text)));
      state.body.append(warnings);
    }
    const originals = el('details'); originals.append(el('summary','Show original source categories'));
    for (const [key,value] of Object.entries(result.profile.original)) originals.append(el('div',`${key}: ${value}`));
    state.body.append(originals);
    state.save = el('button','Import selected fields','lmnl-primary'); state.save.type='button';
    state.save.addEventListener('click',() => void save(state)); state.body.append(state.save);
  }
  async function save(state) {
    if (state.busy || !isCurrent(state) || !state.preview) return;
    const fields = [...state.body.querySelectorAll('input[data-field]:checked')].map(input=>input.dataset.field);
    if (!fields.length) return;
    const p=state.preview;
    if (!window.confirm(`Import ${fields.length} selected fields for ${p.performer_name} (#${p.performer_id}) from ${p.profile.fields.name}?\n\nSelected existing field values will be replaced. Selected tags are added; existing tags are kept. Matching legacy Mature.nl fields shown in the preview are removed for selected imports.${fields.includes('image') ? '\nYou selected the profile image: the current image will be replaced with the Mature.nl image.' : ''}\nOther fields are preserved. The source profile URL is added. Enabled attribute/bridge hooks may then update tags and related objects.`)) return;
    state.saving=true; busy(state,true,'Saving selected fields…');
    try {
      const result=await call(state,{mode:'import',performer_id:state.item.id,url:p.profile.url,fields,
        expected:p.current,source_expected:{...p.profile.fields,...p.profile.custom,...p.profile.tag_fields,
          ...(p.profile.image ? {image:{url:p.profile.image.url,sha256:p.profile.image.sha256}} : {})},custom_names:p.custom_names});
      state.saving=false;
      if (active !== state) return;
      state.body.replaceChildren(); state.save=null; state.preview=null;
      state.body.append(el('p',result.changed?'Fields saved in Stash.':'The fields were already identical.'));
      const reload=el('button','Reload page'); reload.type='button'; reload.addEventListener('click',()=>location.reload());
      state.body.append(reload);
      busy(state,false,'Done. Enabled attribute/Bridge modules may continue processing in the background.');
    } catch(error) {
      state.saving=false;
      if (active === state) { state.preview=null; state.body.replaceChildren(); state.save=null; busy(state,false,errorMessage(error,true)); }
    }
  }
  async function search(state) {
    if (state.busy || !isCurrent(state)) return;
    const query=state.query.value.trim();
    if (/^https:\/\//i.test(query)) { await preview(state,query); return; }
    busy(state,true,'Searching the public model directory… Search results appear before you choose a profile.');
    state.body.replaceChildren(); state.preview=null; state.save=null;
    try {
      const result=await call(state,{mode:'search',name:query});
      if (!isCurrent(state)) return;
      for (const item of result.results) {
        const button=el('button',`${item.name} · ${item.url.split('/').filter(Boolean).at(-1)}`,'lmnl-result');button.type='button';
        button.addEventListener('click',()=>void preview(state,item.url));state.body.append(button);
      }
      busy(state,false,result.warning || (result.results.length?'Choose the correct profile to preview.':'No match. Try the full Mature.nl model name or paste the profile URL.'));
    } catch(error) {if(isCurrent(state)) busy(state,false,errorMessage(error,false));}
  }
  function open(item, opener) {
    if(active?.saving) return;
    if(active) close(active);
    const dialog=el('dialog',null,'lmnl-dialog');dialog.dataset.lmnlUi='true';
    const title=el('h2',`Lynx Mature.nl · ${item.name}`); title.id='lmnl-title';dialog.setAttribute('aria-labelledby',title.id);
    const state={dialog,item,opener,busy:false,saving:false,abort:null,preview:null,save:null};
    state.close=el('button','Close','lmnl-close');state.close.type='button';state.close.addEventListener('click',()=>close(state));
    const top=el('header');top.append(title,state.close);
    const form=el('form',null,'lmnl-search'); const label=el('label','Name or Mature.nl profile URL');
    state.query=el('input');state.query.placeholder='Loading name…';state.query.maxLength=300;state.query.setAttribute('aria-label','Name or Mature.nl profile URL');
    label.append(state.query);const submit=el('button','Search / fetch','lmnl-primary');submit.type='submit';form.append(label,submit);
    form.addEventListener('submit',event=>{event.preventDefault();void search(state);});
    state.status=el('p','Search and choose a profile. Nothing is saved before you approve the import.','lmnl-status');state.status.setAttribute('role','status');
    state.body=el('section',null,'lmnl-body');dialog.append(top,form,state.status,state.body);
    dialog.addEventListener('cancel',event=>{event.preventDefault();close(state);});
    document.body.append(dialog);active=state;dialog.showModal();void loadSearchName(state);
  }
  function decorate() {
    if(active && !isCurrent(active) && !active.saving) close(active);
    for (const row of document.querySelectorAll('.PerformerTagger > .PerformerTagger-performer')) {
      const item=target(row); if(!item) continue;
      const details=row.querySelector('.PerformerTagger-details');if(!details || details.querySelector('.lmnl-source-button'))continue;
      const button=el('button','Mature.nl','lmnl-source-button');button.type='button';button.dataset.lmnlUi='true';
      button.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();const current=target(row);if(current)open(current,button);});
      details.append(button);
    }
  }
  const observer=new MutationObserver(records=>{
    if(records.every(record => record.target instanceof Element && record.target.closest('[data-lmnl-ui]')))return;
    clearTimeout(timer);timer=setTimeout(decorate,180);
  });
  function start(){observer.observe(document.body,{childList:true,subtree:true});decorate();}
  window.__lynxMatureNL={dispose(){if(active?.saving)return;observer.disconnect();clearTimeout(timer);if(active)close(active);
    document.querySelectorAll('.lmnl-source-button').forEach(node=>node.remove());delete window.__lynxMatureNL;}};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();

})(window.fetch.bind(window));
