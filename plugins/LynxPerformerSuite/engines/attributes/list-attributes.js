(function(fetch){
/* Display-only columns for the native performer table, which has no patch API. */
(() => {
  'use strict';
  if (window.__lynxAttributeListColumns) return;
  window.__lynxAttributeListColumns = true;
  const columns = [
    {key:'body',label:'Body Type',custom:'bodyField',fallback:'Body Type'},
    {key:'breastSize',label:'Breast Size',custom:'breastSizeField',fallback:'Breast Size'},
    {key:'tattoos',label:'Tattoos',field:'tattoos'},
    {key:'piercings',label:'Piercings',field:'piercings'}
  ];
  const nativeColumns = [
    ['image','Image'],['name','Name'],['aliases','Alias'],['gender','Gender'],
    ['rating','Rating'],['age','Age'],['death_date','Death Date'],['favourite','Favorite'],
    ['country','Country'],['ethnicity','Ethnicity'],['hair_color','Hair Color'],['eye_color','Eye Color'],
    ['height_cm','Height (cm)'],['weight_kg','Weight (kg)'],['penis_length_cm','Penis Length (cm)'],
    ['circumcised','Circumcised'],['measurements','Measurements'],['fake_tits','Breast Type (Natural / Fake)'],
    ['career_length','Career'],['scene_count','Scenes'],['gallery_count','Galleries'],
    ['image_count','Images'],['o_counter','O Count']
  ];
  function fieldValue(item, column, config) {
    if (column.field) return item[column.field];
    const name = String(config[column.custom] || column.fallback).trim() || column.fallback;
    const fields = item.custom_fields || {};
    const key = Object.keys(fields).find(key => key.trim().toLowerCase() === name.toLowerCase());
    return key === undefined ? null : fields[key];
  }
  let enabled = columns.map(column=>column.key);
  try {
    const saved = JSON.parse(localStorage.getItem('lynx-performer-list-attributes'));
    if (Array.isArray(saved)) enabled = saved.filter(key=>columns.some(column=>column.key===key));
  } catch (_) {}
  let timer, activeTable, activeRows = [], generation = 0, controller, configPromise;
  const snapshots = new Map();
  async function query(query, variables, signal) {
    const response = await fetch('/graphql',{method:'POST',credentials:'same-origin',signal,
      headers:{'Content-Type':'application/json'},body:JSON.stringify({query,variables})});
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const result = await response.json();
    if (result.errors) throw new Error(result.errors.map(error=>error.message).join('; '));
    return result.data;
  }
  function settings() {
    if (!configPromise) configPromise = query('query LynxListConfig { configuration { plugins ui } }')
      .then(data=>({plugin:data.configuration.plugins?.LynxPerformerAttributeTags || {},ui:data.configuration.ui || {}}))
      .catch(error=>{configPromise=null;throw error;});
    return configPromise;
  }
  function text(value) { return value===null || value===undefined || String(value).trim()==='' ? '—' : String(value); }
  function cell(tag, column, value) {
    const element = document.createElement(tag);
    element.dataset.lynxAttributeColumn = column.key;
    element.className = 'lynx-list-attribute-value';
    element.textContent = value;
    if (tag==='td') element.title=value;
    return element;
  }
  function rows(table) {
    return Array.from(table.querySelectorAll('tbody > tr')).map(row=>{
      const link = row.querySelector('td.name-data a[href]');
      const match = link?.getAttribute('href')?.match(/\/performers\/(\d+)(?:[/?#]|$)/);
      return match ? {row,id:match[1]} : null;
    }).filter(Boolean);
  }
  function paint(table, records, config) {
    table.querySelectorAll('[data-lynx-attribute-column]').forEach(element=>element.remove());
    const header = table.querySelector('thead > tr');
    if (!header) return;
    const selected = columns.filter(column=>enabled.includes(column.key));
    const headAnchor = header.querySelector('.career_length-head, .scene_count-head');
    selected.forEach(column=>header.insertBefore(cell('th',column,column.label),headAnchor));
    for (const {row,id} of records) {
      const anchor = row.querySelector('.career_length-data, .scene_count-data');
      const item = snapshots.get(id);
      selected.forEach(column=>{
        const value = item ? text(fieldValue(item,column,config)) : '…';
        row.insertBefore(cell('td',column,value),anchor);
      });
    }
  }
  function toolbar(wrapper, config, table) {
    if (wrapper.querySelector('.lynx-list-attributes-toolbar')) return;
    const bar = document.createElement('details');
    bar.className='lynx-list-attributes-toolbar';
    const summary=document.createElement('summary'); summary.textContent='Choose columns';bar.append(summary);
    const help=document.createElement('p');help.textContent='Select the columns you want and click Save columns. Name is always visible. Your filters are retained when the list reloads.';bar.append(help);
    const nativeSelected=new Set(config.ui.tableColumns?.performers || Array.from(table.querySelectorAll('thead > tr:first-child > th')).map(head=>head.className.replace(/-head$/,'')));
    const pendingExtra=new Set(enabled);
    for (const [key,title] of [...nativeColumns,...columns.map(column=>['lynx_'+column.key,column.label])]) {
      const label=document.createElement('label'), input=document.createElement('input');
      const extra=key.startsWith('lynx_');const name=extra?key.slice(5):key;
      input.type='checkbox';input.checked=extra?pendingExtra.has(name):nativeSelected.has(key);
      if (key==='name') { input.checked=true;input.disabled=true; }
      input.addEventListener('change',()=>{
        const selected=extra?pendingExtra:nativeSelected;
        if (input.checked) selected.add(name); else selected.delete(name);
      });
      label.append(input,document.createTextNode(title));bar.append(label);
    }
    const save=document.createElement('button');save.type='button';save.className='btn btn-primary';save.textContent='Save columns';bar.append(save);
    const status=document.createElement('p');status.setAttribute('role','status');bar.append(status);
    save.addEventListener('click',async()=>{
      save.disabled=true;status.textContent='Sparar kolumnval…';
      try {
        // Read latest UI config so other tables/settings are not overwritten.
        const latest=await query('query LynxColumnPreferences { configuration { ui } }');
        const ui=latest.configuration.ui || {};
        const selected=nativeColumns.map(([key])=>key).filter(key=>key==='name' || nativeSelected.has(key));
        await query('mutation LynxSaveColumnPreferences($partial:Map!) { configureUI(partial:$partial) }',
          {partial:{tableColumns:{...ui.tableColumns,performers:selected}}});
        enabled=[...pendingExtra];
        try { localStorage.setItem('lynx-performer-list-attributes',JSON.stringify(enabled)); } catch (_) {}
        window.location.reload();
      } catch (error) { status.textContent='Kunde inte spara: '+error.message;save.disabled=false; }
    });
    wrapper.prepend(bar);
    wrapper.classList.add('lynx-unified-column-picker');
  }
  async function refresh() {
    const wrapper=document.querySelector('.performer-table');
    const table=wrapper?.querySelector('table');
    if (!table) {
      generation++;controller?.abort();controller=null;activeTable=null;activeRows=[];snapshots.clear();return;
    }
    const records=rows(table);
    const changed=table!==activeTable || records.length!==activeRows.length || records.some((entry,index)=>entry.row!==activeRows[index]?.row || entry.id!==activeRows[index]?.id);
    if (changed) {
      generation++;controller?.abort();controller=null;snapshots.clear();activeTable=table;activeRows=records;
    }
    const thisGeneration=generation;
    try {
      const config=await settings();
      if (thisGeneration!==generation) return;
      toolbar(wrapper,config,table);
      paint(table,records,config.plugin);
      if (controller || !enabled.length || !records.length || snapshots.size===new Set(records.map(entry=>entry.id)).size) return;
      controller=new AbortController();
      const signal=controller.signal;
      const ids=[...new Set(records.map(entry=>entry.id))];
      for (let offset=0;offset<ids.length;offset+=100) {
        const batch=ids.slice(offset,offset+100);
        const variables=Object.fromEntries(batch.map((id,index)=>['id'+index,id]));
        const definitions=batch.map((_,index)=>`$id${index}: ID!`).join(',');
        const selections=batch.map((_,index)=>`p${index}:findPerformer(id:$id${index}){id tattoos piercings custom_fields}`).join(' ');
        const data=await query(`query LynxListAttributes(${definitions}) { ${selections} }`,variables,signal);
        if (thisGeneration!==generation) return;
        for (const item of Object.values(data)) if (item) snapshots.set(String(item.id),item);
        paint(table,records,config.plugin);
      }
    } catch (error) {
      if (error.name!=='AbortError' && thisGeneration===generation) {
        console.error('[Lynx attributlistor]',error);
        const summary=wrapper.querySelector('.lynx-list-attributes-toolbar summary');
        if (summary) summary.textContent='Choose columns — could not load values (reload the page)';
      }
    } finally { if (thisGeneration===generation) controller=null; }
  }
  function schedule() { clearTimeout(timer);timer=setTimeout(refresh,150); }
  const observer=new MutationObserver(records=>{
    if (records.some(record=>{
      const target=record.target;
      if (target.nodeType===1 && target.closest('[data-lynx-attribute-column], .lynx-list-attributes-toolbar')) return false;
      const nodes=[...record.addedNodes,...record.removedNodes].filter(node=>node.nodeType===1);
      if (nodes.length && nodes.every(node=>node.matches('[data-lynx-attribute-column], .lynx-list-attributes-toolbar'))) return false;
      return target.nodeType===1 && target.closest('.performer-table') || nodes.some(node=>node.matches('.performer-table') || node.querySelector('.performer-table')) || activeTable && !activeTable.isConnected;
    })) schedule();
  });
  observer.observe(document.getElementById('root') || document.body,{childList:true,subtree:true});
  window.addEventListener('popstate',schedule);
  schedule();
})();

})(window.LynxPerformerDefaults.fetchFor("LynxPerformerAttributeTags"));
