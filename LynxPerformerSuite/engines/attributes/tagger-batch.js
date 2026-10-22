/* Lynx Tagger Workbench 1.0.2: visible scrape results and batch outcome filters. */
(() => {
  'use strict';
  const LABELS={name:'Name',birthdate:'Birthdate',death_date:'Death date',country:'Country',ethnicity:'Ethnicity',hair_color:'Hair color',eye_color:'Eye color',height_cm:'Height (cm)',weight:'Weight (kg)',measurements:'Measurements',fake_tits:'Natural / augmented breasts',tattoos:'Tattoos',piercings:'Piercings',career_start:'Career start',career_end:'Career end',details:'Biography',urls:'Profile links',image:'Profile image'};
  const OPTIONAL=new Set(['name','birthdate','death_date','details','urls','image']);
  const SCRAPED='name birthdate death_date country ethnicity hair_color eye_color height weight measurements fake_tits tattoos piercings career_start career_end details urls images';
  const STORED='id name disambiguation updated_at image_path custom_fields '+Object.keys(LABELS).filter(k=>!['name','image'].includes(k)).join(' ');
  const empty=v=>v==null||v===''||(Array.isArray(v)&&!v.length);
  const same=(a,b)=>(empty(a)&&empty(b))||JSON.stringify(a)===JSON.stringify(b);
  const text=v=>empty(v)?'Not set':Array.isArray(v)?v.join('\n'):String(v);
  function httpURL(value){try{const u=new URL(value);return ['http:','https:'].includes(u.protocol)?u.href:null;}catch{return null;}}
  function imageURL(value){return typeof value==='string'&&(/^data:image\/(?:png|jpeg|webp|gif);base64,/i.test(value)||httpURL(value))?value:null;}
  function numberValue(raw,kind){
    const value=String(raw??'').trim().toLowerCase().replace(',','.');let result;
    if(kind==='height'&&/^\d+\s*['′]\s*\d+(?:\.\d+)?\s*(?:["″]|in)?$/.test(value)){
      const p=value.match(/\d+(?:\.\d+)?/g);result=(+p[0]*12 + +p[1])*2.54;
    }else{
      const m=value.match(/^(\d+(?:\.\d+)?)\s*(cm|centimeters?|kg|kilograms?|lbs?|pounds?|in|inches?|m)?$/);
      if(!m)return null;const n=Number(m[1]),u=m[2]||'';
      if(kind==='height'){
        if(!['','cm','centimeter','centimeters','in','inch','inches','m'].includes(u))return null;
        result=n*(['in','inch','inches'].includes(u)?2.54:u==='m'?100:1);
      }else{
        if(!['','kg','kilogram','kilograms','lb','lbs','pound','pounds'].includes(u))return null;
        result=n*(['lb','lbs','pound','pounds'].includes(u)?.45359237:1);
      }
    }
    return result>0&&result<=(kind==='height'?300:700)?Math.round(result):null;
  }
  function makeChanges(stored,scraped){
    const changes=[],warnings=[];
    for(const key of Object.keys(LABELS)){
      if(key==='image')continue;
      let value=key==='height_cm'?scraped.height:scraped[key];
      if(empty(value))continue; // Missing scrape data must never erase saved fields.
      if(key==='height_cm'||key==='weight'){
        const converted=numberValue(value,key==='height_cm'?'height':'weight');
        if(converted==null){warnings.push(`${LABELS[key]}: unsupported value “${value}”; not imported.`);continue;}value=converted;
      }else if(key==='urls'){
        const candidates=(Array.isArray(value)?value:[value]).map(httpURL).filter(Boolean);
        value=[...new Set([...(stored.urls||[]),...candidates])];
      }else value=String(value).trim();
      if(!same(stored[key],value))changes.push({key,before:stored[key],after:value,checked:!OPTIONAL.has(key)});
    }
    return {changes,warnings};
  }
  function importInput(record,latest,replace){
    const input={id:record.id};
    for(const c of record.changes.filter(c=>c.checked)){
      const current=c.key==='image'?latest.image_path:latest[c.key];
      if(c.key==='image'&&record.stored?.updated_at&&record.stored.updated_at!==latest.updated_at)throw Error('Performer changed since image preview. Search and preview again.');
      if(!same(current,c.before))throw Error(`${LABELS[c.key]} changed since preview. Preview this performer again.`);
      if(!replace&&!empty(current))throw Error(`${LABELS[c.key]} is not empty. Enable replacement or uncheck this field.`);
      input[c.key]=c.after;
    }
    return input;
  }
  function operationOutput(raw){
    const v=typeof raw==='string'?JSON.parse(raw):raw;
    if(!v||v.error)throw Error(v?.error||'The plugin returned no result.');
    const output=v.output??v;return typeof output==='string'?JSON.parse(output):output;
  }
  if(typeof module!=='undefined'&&module.exports){module.exports={makeChanges,importInput,numberValue,httpURL,imageURL,operationOutput,same};return;}
  if(window.__lynxAttributeTaggerBatch)return;
  // Own versioned stylesheet: avoid relying on an older cached module stylesheet.
  const style=document.createElement('link');style.rel='stylesheet';style.id='lynx-tagger-workbench-style';
  style.href='/plugin/LynxPerformerSuite/assets/engines/attributes/tagger-batch.css?v=workbench-1.0.1';document.getElementById(style.id)?.remove();document.head.append(style);
  const fetch=window.LynxPerformerDefaults.fetchFor('LynxPerformerAttributeTags'),selected=new Set();
  let rows=[],signature='',toolbar=null,panel=null,busy=false,timer=0,jobTimer=0,jobId='',epoch=0,stop=false,disposed=false,scrapers=null;
  const el=(tag,value,cls)=>{const n=document.createElement(tag);if(value!=null)n.textContent=value;if(cls)n.className=cls;return n;};
  const button=(label,action)=>{const b=el('button',label);b.type='button';b.addEventListener('click',action);return b;};
  function readRows(){return [...document.querySelectorAll('.PerformerTagger > .PerformerTagger-performer')].flatMap(row=>{
    const link=row.querySelector('.PerformerTagger-details a.PerformerTagger-header[href]');if(!link)return [];
    const m=new URL(link.getAttribute('href'),location.origin).pathname.match(/^\/performers\/([1-9]\d*)\/?$/);
    return m?[{id:m[1],name:link.textContent.trim(),row}]:[];
  });}
  const valid=token=>!disposed&&token===epoch&&readRows().map(r=>r.id).join(',')===signature&&!!toolbar?.isConnected;
  async function gql(query,variables={},timeout=90000){
    const controller=new AbortController(),deadline=setTimeout(()=>controller.abort(),timeout);
    try{
      const response=await fetch('/graphql',{method:'POST',credentials:'same-origin',signal:controller.signal,headers:{'Content-Type':'application/json'},body:JSON.stringify({query,variables})});
      if(!response.ok)throw Error(`HTTP ${response.status}`);const result=await response.json();
      if(result.errors?.length)throw Error(result.errors.map(e=>e.message).join('; '));return result.data;
    }catch(error){if(error.name==='AbortError')throw Error('Request timed out. A pending save may still finish; reload and inspect before retrying.');throw error;}
    finally{clearTimeout(deadline);}
  }
  const performer=async id=>(await gql(`query($id:ID!){findPerformer(id:$id){${STORED}}}`,{id})).findPerformer;
  function status(value){if(toolbar?.isConnected)toolbar.querySelector('[data-lynx-status]').textContent=value;}
  function controls(){
    if(!toolbar)return;
    toolbar.querySelector('[data-lynx-count]').textContent=`${rows.length} on page · ${selected.size} selected`;
    toolbar.querySelectorAll('[data-action]').forEach(b=>{const count=b.dataset.scope==='selected'?selected.size:rows.length;b.disabled=busy||!count||count>1000;});
    toolbar.querySelectorAll('[data-select]').forEach(b=>{b.disabled=busy;});toolbar.querySelector('[data-stop]').disabled=!busy||!!jobId;
    rows.forEach(({id,row})=>{const c=row.querySelector('[data-lynx-performer-id]');if(c){c.checked=selected.has(id);c.disabled=busy;}});
    if(panel)panel.inert=busy;
    panel?._review?.refresh();
    panel?.querySelectorAll('[data-save]').forEach(b=>{b.disabled=busy||b._record.saved||!b._record.changes.some(c=>c.checked);});
  }
  function targets(scope){const result=readRows().filter(r=>scope==='page'||selected.has(r.id));if(!result.length||result.length>1000)throw Error('Select between 1 and 1000 performers on this page.');return [...new Map(result.map(r=>[r.id,r])).values()];}
  function newPanel(title,note){panel?.remove();panel=el('section',null,'lynx-tagger-results');panel.dataset.lynxBatchUi='true';panel.inert=busy;panel.append(el('h3',title),el('p',note,'lynx-tagger-note'));toolbar.append(panel);return panel;}
  function rowDetail(title,open=false){const d=el('details',null,'lynx-tagger-result');d.open=open;d.append(el('summary',title));(panel._resultList||panel).append(d);return d;}
  function valueBox(label,value,cls){const box=el('div',null,`lynx-review-value ${cls}`);box.append(el('span',label,'lynx-review-label'),el('div',text(value)));return box;}
  function diffTable(parent,changes){
    const list=el('div',null,'lynx-review-fields');
    changes.forEach(c=>{const row=el('div',null,'lynx-review-field');row.append(el('strong',LABELS[c.field]||c.field),valueBox('Current value',c.before,'lynx-review-current'),valueBox(empty(c.after)?'Proposed: clear value':'Proposed value',c.after,'lynx-review-proposed'));list.append(row);});parent.append(list);
  }
  function pillLine(parent,label,tags,cls){if(!tags?.length)return;const line=el('div',null,'lynx-tagger-pills');line.append(el('span',label));tags.forEach(t=>{const p=el('span',t.name,`lynx-tagger-pill ${cls}`);if(t.reasons)p.title=t.reasons.join('; ');line.append(p);});parent.append(line);}
  function showAttribute(r,names){
    const issue=!!r.error||!!r.warnings?.length||!!r.missing_tags?.some(t=>!t.will_create);
    const d=rowDetail('',false);d.dataset.reviewState=r.error?'error':r.changed?'changed':issue?'attention':'unchanged';d.dataset.hasIssue=String(issue);
    d.dataset.reviewName=(r.name||names.get(r.id)||'#'+r.id).toLowerCase();d._preview=r;
    const summary=d.querySelector('summary');summary.append(el('span',r.name||names.get(r.id)||'#'+r.id,'lynx-review-name'),el('span',r.error?'Error':r.changed?'Changes proposed':issue?'Needs attention':'No changes',`lynx-review-badge ${d.dataset.reviewState}`));
    if(r.changed&&!r.error){const label=el('label',null,'lynx-review-pick'),check=el('input');check.type='checkbox';check.dataset.reviewId=r.id;check.setAttribute('aria-label',`Include ${r.name||names.get(r.id)} in attribute update`);check.addEventListener('change',controls);label.append(check,document.createTextNode(' Include this performer in update'));d.append(label);}
    const priority=r.error?0:r.changed?1:issue?2:3;d.dataset.priority=String(priority);
    const next=[...d.parentElement.children].find(n=>n!==d&&Number(n.dataset.priority)>priority);if(next)d.parentElement.insertBefore(d,next);
    panel._review?.refresh();
    if(r.error){d.append(el('p',r.error,'lynx-tagger-warning'));return;}
    if(r.fields.length)diffTable(d,r.fields);if(r.urls)diffTable(d,[{field:'urls',...r.urls}]);
    pillLine(d,'Add tags',r.add_tags,'lynx-tagger-add');pillLine(d,'Remove tags',r.remove_tags,'lynx-tagger-remove');
    pillLine(d,'Create and add',r.missing_tags.filter(t=>t.will_create),'lynx-tagger-add');pillLine(d,'Missing — creation disabled',r.missing_tags.filter(t=>!t.will_create),'lynx-tagger-missing');
    (r.warnings||[]).forEach(w=>d.append(el('p',`No mapping: ${w}`,'lynx-tagger-warning')));
    if(!r.changed)d.append(el('p','No field or tag changes under your current Lynx rules.'));
  }
  function reviewControls(host){
    const top=el('div',null,'lynx-review-toolbar'),stats=el('p',null,'lynx-review-stats');stats.setAttribute('role','status');
    const filter=el('select');filter.setAttribute('aria-label','Preview visibility');
    for(const [v,t] of [['changes','Changes & warnings'],['all','All performers'],['issues','Warnings & errors']]){const o=el('option',t);o.value=v;filter.append(o);}
    const search=el('input');search.type='search';search.placeholder='Find performer…';search.setAttribute('aria-label','Find performer in preview');
    const list=el('div',null,'lynx-review-list'),emptyView=el('p','No performers match this view. Choose All performers or clear the search to see more.','lynx-tagger-note');host._resultList=list;
    const update=button('Update reviewed performers (0)',()=>{const ids=[...list.querySelectorAll('[data-review-id]:checked')].map(c=>c.dataset.reviewId);void apply('reviewed',ids);});
    const all=button('Select visible changes',()=>{list.querySelectorAll('.lynx-tagger-result:not([hidden]) [data-review-id]').forEach(c=>{c.checked=true;});controls();});
    const none=button('Clear review selection',()=>{list.querySelectorAll('[data-review-id]').forEach(c=>{c.checked=false;});controls();});
    const expand=button('Expand visible',()=>{list.querySelectorAll('.lynx-tagger-result:not([hidden])').forEach(d=>{d.open=true;});});
    const collapse=button('Collapse all',()=>{list.querySelectorAll('details').forEach(d=>{d.open=false;});});
    top.append(filter,search,all,none,expand,collapse,update);host.append(stats,top,el('p','Only checked performers are updated. Each update applies all enabled Lynx rules for that performer; individual field/tag approval is not available in this rule preview.','lynx-tagger-note'),emptyView,list);
    host._review={refresh(){
      const cards=[...list.children],term=search.value.trim().toLowerCase();let visible=0;
      for(const d of cards){const s=d.dataset.reviewState;d.hidden=!(filter.value==='all'||filter.value==='issues'&&d.dataset.hasIssue==='true'||filter.value==='changes'&&s!=='unchanged')||!d.dataset.reviewName.includes(term);if(!d.hidden)visible++;}
      const count=cards.filter(d=>d.dataset.reviewState==='changed').length,checked=list.querySelectorAll('[data-review-id]:checked').length;
      const unchanged=cards.filter(d=>d.dataset.reviewState==='unchanged').length,issues=cards.filter(d=>d.dataset.hasIssue==='true').length;
      stats.textContent=`${cards.length} checked · ${count} with changes · ${unchanged} unchanged · ${issues} warnings/errors · ${visible} shown`;emptyView.hidden=visible>0||cards.length===0;
      update.textContent=`Update reviewed performers (${checked})`;update.disabled=busy||!checked;all.disabled=busy||!count;none.disabled=busy||!checked;
    }};filter.addEventListener('change',()=>host._review.refresh());search.addEventListener('input',()=>host._review.refresh());host._review.refresh();
  }
  async function preview(scope){
    if(busy)return;let list;try{list=targets(scope);}catch(e){status(e.message);return;}
    busy=true;stop=false;controls();const token=epoch;
    const host=newPanel('Attribute & tag preview','Read-only. Uses saved metadata and current Lynx settings. Finish native Tagger updates first. Updates recalculate the rules; this is not an execution snapshot.');
    reviewControls(host);
    const names=new Map(list.map(r=>[r.id,r.name]));let count=0,changed=0,errors=0;
    try{
      for(let i=0;i<list.length&&!stop;i+=25){
        status(`Previewing ${count} / ${list.length} performers…`);
        const data=await gql('mutation($id:ID!,$args:Map!){runPluginOperation(plugin_id:$id,args:$args)}',{id:'LynxPerformerAttributeTags',args:{mode:'preview_inline',performer_ids:list.slice(i,i+25).map(r=>r.id)}});
        if(!valid(token))return;const result=operationOutput(data.runPluginOperation);
        if(result?.version!==1||result.read_only!==true||!Array.isArray(result.performers))throw Error('Inline preview backend is missing. Install all three update files, then reload plugins.');
        for(const r of result.performers){showAttribute(r,names);count++;if(r.changed)changed++;if(r.error)errors++;}
      }
      if(valid(token))status(`${stop?'Stopped':'Preview complete'}: ${count} checked · ${changed} with changes · ${errors} errors. Nothing saved.`);
    }catch(e){if(valid(token)){host.append(el('p',e.message,'lynx-tagger-warning'));status('Preview could not finish. Nothing saved.');}}
    finally{busy=false;controls();}
  }
  async function monitorJob(token){
    if(!jobId||!valid(token)){jobId='';busy=false;controls();return;}
    try{
      const job=(await gql('query($id:ID!){findJob(input:{id:$id}){id status error}}',{id:jobId})).findJob;
      if(!valid(token)){jobId='';busy=false;controls();return;}
      if(!job||['FINISHED','FAILED','CANCELLED'].includes(job.status)){status(job?.error?`Update error: ${job.error}`:'Update task ended. Click Preview again to inspect remaining changes.');jobId='';busy=false;controls();return;}
      status(`Attribute update · job #${jobId} · ${job.status}`);jobTimer=setTimeout(()=>void monitorJob(token),1500);
    }catch(e){status(`Could not read job status: ${e.message}. Check Tasks before starting another update.`);jobId='';busy=false;controls();}
  }
  async function apply(scope,reviewedIds=null){
    if(busy)return;let list;try{
      if(reviewedIds===null)list=targets(scope);
      else{const ids=new Set(reviewedIds);list=readRows().filter(r=>ids.has(r.id));if(!ids.size||ids.size>1000||list.length!==ids.size)throw Error('Review selection is empty or no longer on this page. Preview again.');}
    }catch(e){status(e.message);return;}
    if(!confirm(`Update attributes and tags for ${list.length} performers?\n\nOnly this page/selection is processed. Current rules are recalculated, including enabled tag creation/removal. Finish native Tagger updates first.`))return;
    busy=true;controls();const token=epoch;
    try{
      const data=await gql('mutation($id:ID!,$task:String!,$args:Map!){runPluginTask(plugin_id:$id,task_name:$task,args_map:$args)}',{id:'LynxPerformerAttributeTags',task:'Lynx attribut – uppdatera urval',args:{mode:'apply_selected',performer_ids:JSON.stringify(list.map(r=>r.id))}});
      if(!valid(token)){busy=false;controls();return;}if(!data.runPluginTask)throw Error('Stash returned no task ID.');
      jobId=String(data.runPluginTask);status(`Attribute update queued · job #${jobId}`);jobTimer=setTimeout(()=>void monitorJob(token),1000);
    }catch(e){busy=false;controls();status(e.message);}
  }
  async function loadScrapers(){
    const bar=toolbar,data=await gql('{listScrapers(types:[PERFORMER]){id name performer{supported_scrapes urls}}}');
    if(bar!==toolbar||!bar?.isConnected)return;
    scrapers=data.listScrapers.filter(s=>s.performer?.supported_scrapes.some(m=>['NAME','URL'].includes(m))).sort((a,b)=>a.name.localeCompare(b.name));
    const select=bar.querySelector('[data-source]');select.replaceChildren();
    for(const s of scrapers){const opt=el('option',`${s.name}${s.performer.supported_scrapes.includes('NAME')?'':' — profile URL only'}`);opt.value=s.id;select.append(opt);}
    select.disabled=!scrapers.length;if(!scrapers.length)select.append(el('option','No performer scrapers installed'));
  }
  function sourceURL(stored,source){return (stored.urls||[]).find(url=>{
    const parsed=httpURL(url);if(!parsed)return false;const u=new URL(parsed);
    return (source.performer.urls||[]).some(pattern=>{try{
      const p=new URL(/^https?:\/\//i.test(pattern)?pattern:'https://'+pattern),host=u.hostname.replace(/^www\./,'').toLowerCase(),expected=p.hostname.replace(/^www\./,'').toLowerCase();
      return (host===expected||host.endsWith('.'+expected))&&(p.pathname==='/'||u.pathname.startsWith(p.pathname));
    }catch{return false;}});
  });}
  async function searchOne(stored,source,query){
    if(httpURL(query))return [(await gql(`query($url:String!){scrapePerformerURL(url:$url){${SCRAPED}}}`,{url:query})).scrapePerformerURL].filter(Boolean);
    if(source.performer.supported_scrapes.includes('NAME'))return (await gql(`query($source:ScraperSourceInput!,$input:ScrapeSinglePerformerInput!){scrapeSinglePerformer(source:$source,input:$input){${SCRAPED}}}`,{source:{scraper_id:source.id},input:{query}})).scrapeSinglePerformer||[];
    const url=sourceURL(stored,source);if(!url)throw Error('This source needs a profile URL. Paste the full profile URL into the search field.');
    return [(await gql(`query($url:String!){scrapePerformerURL(url:$url){${SCRAPED}}}`,{url})).scrapePerformerURL].filter(Boolean);
  }
  function renderImport(record,scraped,destination){
    const result=makeChanges(record.stored,scraped);record.changes=result.changes;record.saved=false;destination.replaceChildren();
    result.warnings.forEach(w=>destination.append(el('p',w,'lynx-tagger-warning')));
    const label=el('label',null,'lynx-tagger-option'),replace=el('input');replace.type='checkbox';label.append(replace,document.createTextNode(' Allow replacing existing values'));destination.append(label);
    const fields=el('div');destination.append(fields,el('p','Only checked fields are saved. Profile links are merged; missing scrape values never delete saved fields. Measurements stay unchanged.','lynx-tagger-note'));
    function draw(){
      fields.replaceChildren();const list=el('div',null,'lynx-review-fields');
      record.changes.forEach(c=>{
        const r=el('div',null,'lynx-review-field lynx-review-import'),check=el('input');check.type='checkbox';check.setAttribute('aria-label',`Import ${LABELS[c.key]} for ${record.stored.name}`);
        const protectedValue=!replace.checked&&!empty(c.before);check._protected=protectedValue;check.disabled=protectedValue||busy||record.saved;if(protectedValue)c.checked=false;check.checked=c.checked;
        check.addEventListener('change',()=>{c.checked=check.checked;decision.textContent=c.checked?'Import proposed value':protectedValue?'Keeping current — protected':'Keep current value';controls();});
        const pick=el('label',null,'lynx-review-choice'),decision=el('span',c.checked?'Import proposed value':protectedValue?'Keeping current — protected':'Keep current value','lynx-review-label');pick.append(check,el('strong',LABELS[c.key]),decision);
        r.append(pick,valueBox('Current value',c.before,'lynx-review-current'),valueBox('From scraper',c.key==='image'?'Selected profile image':c.after,'lynx-review-proposed'));list.append(r);
      });fields.append(list);controls();
    }
    replace.addEventListener('change',draw);
    const images=[...new Set((scraped.images||[]).map(imageURL).filter(Boolean))];
    if(images.length){const picker=el('details');picker.append(el('summary',`Choose profile image (${images.length}) — optional`));const list=el('div',null,'lynx-tagger-images');
      images.forEach((url,i)=>{const label=el('label'),radio=el('input'),image=el('img');radio.type='radio';radio.name=`lynx-image-${record.id}`;radio.setAttribute('aria-label',`Image ${i+1}`);
        image.src=url;image.alt=`Profile image ${i+1}`;image.loading='lazy';image.referrerPolicy='no-referrer';radio.addEventListener('change',()=>{record.changes=record.changes.filter(c=>c.key!=='image');record.changes.push({key:'image',before:record.stored.image_path,after:url,checked:empty(record.stored.image_path)||replace.checked});draw();});label.append(radio,image);list.append(label);});picker.append(list);destination.append(picker);
    }
    const save=button('Import checked fields',()=>void saveRecord(record,replace.checked,destination,draw));save.dataset.save='true';save._record=record;destination.append(save);
    if(!record.changes.length)destination.append(el('p','No differing supported fields. You may still choose a profile image.'));draw();
  }
  async function saveRecord(record,replace,destination,redraw){
    if(busy||record.saved||!valid(record.epoch))return;const chosen=record.changes.filter(c=>c.checked);if(!chosen.length)return;
    if(!confirm(`Import ${chosen.length} checked fields for ${record.stored.name}?\n\nExisting update hooks may also update tags and related items. Native Tagger updates must be finished.`))return;
    busy=true;controls();let saving=false;
    try{
      const latest=await performer(record.id);if(!valid(record.epoch))return;if(!latest)throw Error('Performer no longer exists.');
      const input=importInput(record,latest,replace);if(Object.keys(input).length<2)throw Error('No fields selected.');saving=true;
      const result=await gql('mutation($input:PerformerUpdateInput!){performerUpdate(input:$input){id}}',{input});if(!result.performerUpdate)throw Error('Stash did not return a saved performer.');
      record.saved=true;if(valid(record.epoch)){destination.append(el('p','Imported. Use Preview selected/page to inspect Lynx rule changes. Reload when finished to refresh native Tagger cards.','lynx-tagger-success'));status(`Saved ${record.stored.name}. Existing Stash hooks still apply.`);}
    }catch(e){if(valid(record.epoch)){destination.append(el('p',`${e.message}${saving?' Saving was attempted. Check the saved performer before retrying.':''}`,'lynx-tagger-warning'));status('Import not confirmed.');}}
    finally{busy=false;if(valid(record.epoch))redraw();controls();}
  }
  async function scrape(scope){
    if(busy)return;let list;try{list=targets(scope);}catch(e){status(e.message);return;}
    const source=scrapers?.find(s=>s.id===toolbar.querySelector('[data-source]').value);if(!source){status('Choose an installed performer scraper first.');return;}
    busy=true;stop=false;controls();const token=epoch;
    const host=newPanel(`${source.name} — scraper preview`,'Search outcomes are visible on each row. Expand a row with results to choose the correct profile. Nothing is selected or saved automatically.');let completed=0;
    const totals=el('p',null,'lynx-review-stats');totals.setAttribute('role','status');
    const tools=el('div',null,'lynx-review-toolbar'),filter=el('select');filter.setAttribute('aria-label','Scraper result visibility');
    for(const [value,label] of [['all','All search outcomes'],['found','With results'],['none','No results'],['error','Errors'],['pending','Not searched / searching']]){const option=el('option',label);option.value=value;filter.append(option);}
    const resultList=el('div',null,'lynx-review-list');host._resultList=resultList;
    function refreshOutcomes(){
      const cards=[...resultList.children],count=state=>cards.filter(d=>d.dataset.scrapeState===state).length;
      totals.textContent=`${count('found')} with results · ${count('none')} without results · ${count('error')} errors · ${count('pending')+count('searching')} not finished`;
      for(const d of cards)d.hidden=!(filter.value==='all'||filter.value===d.dataset.scrapeState||filter.value==='pending'&&['pending','searching'].includes(d.dataset.scrapeState));
    }
    const expand=button('Expand rows with results',()=>{resultList.querySelectorAll('[data-scrape-state="found"]').forEach(d=>{d.open=true;});});
    const collapse=button('Collapse all',()=>{resultList.querySelectorAll('details').forEach(d=>{d.open=false;});});
    tools.append(filter,expand,collapse);host.append(totals,tools,resultList);filter.addEventListener('change',refreshOutcomes);
    const entries=list.map(target=>{
      const d=rowDetail('',list.length===1),summary=d.querySelector('summary'),badge=el('span','Not searched','lynx-review-badge');
      summary.append(el('span',target.name,'lynx-review-name'),badge);d.dataset.scrapeState='pending';
      function setOutcome(state,count=0){d.dataset.scrapeState=state;d.dataset.scrapeCount=String(count);badge.className=`lynx-review-badge ${state==='found'?'changed':state==='error'?'error':state==='none'?'attention':''}`;badge.textContent=state==='found'?`${count} ${count===1?'result':'results'}`:state==='none'?'No results':state==='error'?'Search failed':state==='searching'?'Searching…':'Not searched';refreshOutcomes();}
      return {target,d,setOutcome};
    });refreshOutcomes();
    try{
      for(const {target,d,setOutcome} of entries){
        if(stop||!valid(token))break;status(`Searching ${completed+1} / ${list.length}: ${target.name}…`);setOutcome('searching');
        try{
          let stored=await performer(target.id);if(!valid(token))break;if(!stored)throw Error('Performer no longer exists.');
          const record={id:target.id,stored,epoch:token,changes:[],saved:false},search=el('input');search.type='text';search.value=stored.name;search.placeholder='Performer name or full profile URL';search.setAttribute('aria-label',`Search ${stored.name}`);
          const matches=el('div'),details=el('div'),message=el('p');message.setAttribute('role','status');
          async function performSearch(){
            record.changes=[];record.saved=false;matches.replaceChildren();details.replaceChildren();message.textContent=`Searching ${source.name}…`;setOutcome('searching');
            try{
              stored=await performer(target.id);if(!valid(token))return;if(!stored)throw Error('Performer no longer exists.');record.stored=stored;
              if(!search.value.trim())throw Error('Enter a performer name or full profile URL.');
              const results=await searchOne(stored,source,search.value.trim());if(!valid(token))return;
              setOutcome(results.length?'found':'none',results.length);
              message.textContent=results.length?`${results.length} result(s). Choose the correct profile to preview changes.`:'No match. Try another name or paste the full profile URL.';
              results.forEach(result=>{const choose=button(`Use ${result.name||'unnamed profile'}${result.birthdate?' · '+result.birthdate:''}${result.country?' · '+result.country:''}`,async()=>{
                  if(busy||record.saved||!valid(token))return;
                  const profileURL=sourceURL({urls:result.urls||[]},source);
                  if(!profileURL){renderImport(record,result,details);return;}
                  busy=true;controls();message.textContent='Loading the chosen profile…';
                  try{
                    const full=await searchOne(stored,source,profileURL);if(!valid(token))return;
                    if(full.length!==1)throw Error('No unique full profile returned. Paste the profile URL and search again.');
                    renderImport(record,{...result,...Object.fromEntries(Object.entries(full[0]).filter(([,v])=>!empty(v)))},details);
                    message.textContent='Profile loaded. Review the proposed changes below.';
                  }catch(e){if(valid(token))message.textContent=e.message;}
                  finally{busy=false;controls();details.querySelectorAll('input[type="checkbox"]').forEach(c=>{c.disabled=c._protected===true||record.saved;});}
                });
                const item=el('div',null,'lynx-tagger-match');item.append(choose);(result.urls||[]).map(httpURL).filter(Boolean).slice(0,3).forEach(url=>{const a=el('a',new URL(url).hostname);a.href=url;a.target='_blank';a.rel='noopener noreferrer';item.append(a);});matches.append(item);});
            }catch(e){if(valid(token)){message.textContent=e.message;setOutcome('error');}}
          }
          const retry=button('Search again',async()=>{if(busy||!valid(token))return;busy=true;controls();try{await performSearch();}finally{busy=false;controls();}});
          const line=el('div',null,'lynx-tagger-search');line.append(search,retry);d.append(line,message,matches,details);search.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();retry.click();}});await performSearch();
        }catch(e){if(valid(token)){d.append(el('p',e.message,'lynx-tagger-warning'));setOutcome('error');}}completed++;
      }
      if(valid(token))status(`${stop?'Stopped':'Search complete'}: ${completed} / ${list.length} performers. Choose matches below. Nothing saved.`);
    }finally{busy=false;controls();}
  }
  function makeToolbar(header){
    const bar=el('section',null,'lynx-attribute-tagger-batch');bar.dataset.lynxBatchUi='true';const count=el('span');count.dataset.lynxCount='true';bar.append(el('strong','Lynx Tagger Workbench'),count);
    for(const [scope,label] of [['page','page'],['selected','selected']])for(const [action,verb,fn] of [['preview','Preview',preview],['apply','Update attributes',apply],['scrape','Scrape',scrape]]){const b=button(`${verb} ${label}`,()=>void fn(scope));b.dataset.action=action;b.dataset.scope=scope;bar.append(b);}
    for(const [key,label] of [['all','Select page'],['none','Clear selection']]){const b=button(label,()=>{selected.clear();if(key==='all')readRows().forEach(r=>selected.add(r.id));controls();});b.dataset.select=key;bar.append(b);}
    const cancel=button('Stop preview/search',()=>{stop=true;status('Stopping after the current read-only request…');});cancel.dataset.stop='true';bar.append(cancel);
    const label=el('label','Scraper source '),source=el('select');source.dataset.source='true';source.setAttribute('aria-label','Installed performer scraper');source.append(el('option','Loading installed scrapers…'));label.append(source);
    const reload=button('Reload sources',()=>{if(!busy)void loadScrapers().catch(e=>status(e.message));});bar.append(label,reload,el('small','Finish native Tagger updates before importing or running Lynx rules. Selection applies only to this page. Existing Stash-box controls remain unchanged.'));
    const message=el('div');message.dataset.lynxStatus='true';message.setAttribute('role','status');bar.append(message);header.append(bar);return bar;
  }
  function decorate(){
    rows=readRows();const next=rows.map(r=>r.id).join(',');if(next!==signature){epoch++;stop=true;selected.clear();signature=next;panel?.remove();panel=null;}
    const header=document.querySelector('.tagger-container-header');if(!header||!rows.length){toolbar?.remove();toolbar=null;return;}
    if(!toolbar?.isConnected){if(toolbar){epoch++;panel?.remove();panel=null;}toolbar=makeToolbar(header);void loadScrapers().catch(e=>status(`Cannot load scraper sources: ${e.message}`));}
    rows.forEach(({id,name,row})=>{if(row.querySelector('[data-lynx-performer-id]'))return;const details=row.querySelector('.PerformerTagger-details');if(!details)return;
      const label=el('label',null,'lynx-attribute-tagger-select');label.dataset.lynxBatchUi='true';const check=el('input');check.type='checkbox';check.dataset.lynxPerformerId=id;check.setAttribute('aria-label',`Select ${name} for Lynx`);
      check.addEventListener('change',()=>{if(check.checked)selected.add(id);else selected.delete(id);controls();});label.addEventListener('click',e=>e.stopPropagation());label.append(check,document.createTextNode(' Select for Lynx'));details.prepend(label);});controls();
  }
  const observer=new MutationObserver(mutations=>{if(mutations.every(m=>(m.target.nodeType===1?m.target:m.target.parentElement)?.closest('[data-lynx-batch-ui]')))return;clearTimeout(timer);timer=setTimeout(decorate,150);});
  function start(){if(disposed)return;observer.observe(document.body,{childList:true,subtree:true});decorate();}
  window.__lynxAttributeTaggerBatch={dispose(){disposed=true;epoch++;stop=true;observer.disconnect();clearTimeout(timer);clearTimeout(jobTimer);toolbar?.remove();style.remove();document.querySelectorAll('.lynx-attribute-tagger-select').forEach(n=>n.remove());document.removeEventListener('DOMContentLoaded',start);delete window.__lynxAttributeTaggerBatch;}};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
