/* Lynx Performer Matcher 1.0.2. Keep uncertain source folders separate. */
(() => {
  'use strict';
  const api=window.PluginApi,R=api?.React;
  if(!R||!api.patch||window.__lynxPerformerMatcher)return;
  window.__lynxPerformerMatcher=true;
  const h=R.createElement,fetcher=window.fetch.bind(window);
  const statusNames={exact:'Exact match',new:'New performer',review:'Needs review',none:'No match'};
  let active=null;
  const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!=null)n.textContent=text;if(cls)n.className=cls;return n;};
  const button=(text,action,cls)=>{const b=el('button',text,cls);b.type='button';b.addEventListener('click',action);return b;};
  const check=(text,checked=false)=>{const label=el('label',null,'lpm-check'),input=el('input');input.type='checkbox';input.checked=checked;label.append(input,el('span',text));return {label,input};};
  const norm=value=>String(value).normalize('NFKC').toLocaleLowerCase().replace(/[_\s.-]+/g,' ').trim();
  function notice(s,text){s.status.textContent=text;}
  function samePage(s){return location.pathname+location.search===s.location;}
  async function call(args){
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),100000);
    try{
      const response=await fetcher('/graphql',{method:'POST',credentials:'same-origin',signal:controller.signal,headers:{'Content-Type':'application/json'},
        body:JSON.stringify({query:'mutation($id:ID!,$args:Map!){runPluginOperation(plugin_id:$id,args:$args)}',variables:{id:'LynxPerformerSuite',args:{module:'performerMatcher',...args}}})});
      if(!response.ok)throw Error('Stash returned HTTP '+response.status);
      const data=await response.json();if(data.errors?.length)throw Error(data.errors.map(e=>e.message).join('; '));
      let result=data.data?.runPluginOperation;if(typeof result==='string')result=JSON.parse(result);
      if(result?.error)throw Error(result.error);
      if(!result)throw Error('No result from Performer Matcher. Check that the module is enabled.');
      return result;
    }finally{clearTimeout(timer);}
  }
  function currentItems(s,g){return g.items.filter(i=>!g.excluded.has(i.key)&&!s.finished.has(i.key));}
  function busy(s,value){
    s.busy=value;
    s.dialog.querySelectorAll('button,input,select').forEach(n=>{n.disabled=value;});
    s.stopButton.disabled=!value;s.close.disabled=value;
    if(!value){s.apply.disabled=!s.token||!s.groups.size;s.export.disabled=!s.report.length;updateCounts(s);}
    if(!value)s.dialog.querySelectorAll('[data-lpm-finished]').forEach(n=>{n.disabled=true;});
  }
  function updateCounts(s){
    let count=0,groups=0;const totals={exact:0,new:0,review:0,none:0};
    for(const g of s.groups.values()){
      totals[g.proposal.status]+=g.items.length;
      if(g.enabled){count+=currentItems(s,g).length;groups++;}
      g.checkbox.checked=g.enabled;
      g.count.textContent=g.items.length+' item(s)';
      g.destination.textContent=targetLabel(g,s);
      g.node.hidden=s.view.value!=='all'&&s.view.value!==g.proposal.status;
    }
    s.summary.textContent=Object.entries(totals).map(([k,v])=>statusNames[k]+': '+v).join(' · ')+
      ' — '+count+' checked item(s) in '+groups+' group(s)';
  }
  function targetLabel(g,s){
    const target=g.target;
    if(!target)return 'Choose a performer';
    if(target.create)return 'Create / reuse: '+target.create;
    const p=s.people.find(p=>String(p.id)===String(target.id));
    return p?p.name+(p.disambiguation?' ('+p.disambiguation+')':''):'Performer #'+target.id;
  }
  function renderTargets(s,g){
    g.targetBox.replaceChildren(el('strong',targetLabel(g,s)));
    const matches=g.proposal.matches.map(id=>s.people.find(p=>String(p.id)===String(id))).filter(Boolean);
    if(matches.length){
      const select=el('select');select.setAttribute('aria-label','Choose matching performer');
      const empty=el('option','Choose a match…');empty.value='';select.append(empty);
      for(const p of matches){const o=el('option',p.name+(p.disambiguation?' ('+p.disambiguation+')':'')+' · #'+p.id);o.value=p.id;select.append(o);}
      select.value=g.target?.id||'';select.onchange=()=>{g.target=select.value?{id:select.value}:null;g.enabled=!!g.target;renderTargets(s,g);updateCounts(s);};
      g.targetBox.append(select);
    }
    const name=el('input');g.nameInput=name;name.value=g.target?.create||g.proposal.name;name.placeholder='New performer name';name.maxLength=100;name.setAttribute('aria-label','New performer name');
    g.targetBox.append(name,button('Use this new name',()=>{
      if(!name.value.trim())return;
      g.target={create:name.value.trim()};g.enabled=true;renderTargets(s,g);updateCounts(s);
    }));
    g.targetBox.append(el('small','Or check this group and use the performer search above.'));
    g.targetBox.querySelectorAll('button,input,select').forEach(n=>{n.disabled=s.busy;});
  }
  function useProposedNames(s){
    if(s.busy)return;
    let prepared=0,skipped=0,checked=0;
    for(const g of s.groups.values()){
      if(!g.enabled||!currentItems(s,g).length)continue;
      checked++;
      // Preserve existing matches and explicit assignments made during review.
      if(g.target||g.proposal.matches.length){skipped++;continue;}
      const name=(g.nameInput?.value||'').trim();
      if(name.length<2||name.length>100||!/[\p{L}]/u.test(name)||/[\x00-\x1f/\\<>|]/.test(name)){skipped++;continue;}
      g.target={create:name};renderTargets(s,g);prepared++;
    }
    updateCounts(s);
    notice(s,checked?
      'Prepared '+prepared+' checked group(s), each with its own proposed name. '+skipped+' group(s) kept or skipped. Click Apply reviewed matches to save.':
      'Check the groups you want, or use Select new performer groups first.');
  }
  function itemList(s,g){
    g.itemList.replaceChildren();
    const items=g.items.slice(0,g.shown);
    for(const item of items){
      const row=el('div',null,'lpm-item'),c=check('',!g.excluded.has(item.key));
      c.input.setAttribute('aria-label','Include '+(item.title||item.key));c.input.disabled=s.busy||s.finished.has(item.key);
      if(s.finished.has(item.key))c.input.dataset.lpmFinished='true';
      c.input.onchange=()=>{if(c.input.checked)g.excluded.delete(item.key);else g.excluded.add(item.key);updateCounts(s);};
      if(item.thumbnail){const image=el('img');image.src=item.thumbnail;image.loading='lazy';image.alt='Preview';row.append(image);}
      const details=el('div'),link=el('a',item.title||item.key);link.href='/'+(item.kind==='Image'?'images':'galleries')+'/'+item.id;link.target='_blank';link.rel='noopener';
      details.append(link,el('small',item.source_paths.map(p=>p.path).join(' · ')||'No file path'));
      if(item.inherited_from)details.append(el('small','Included from gallery #'+item.inherited_from));
      if(s.finished.has(item.key))details.append(el('small',s.finished.get(item.key)));
      row.append(c.label,details);g.itemList.append(row);
    }
    if(g.shown<g.items.length)g.itemList.append(button('Show next 100 items',()=>{g.shown+=100;itemList(s,g);}));
  }
  function addItems(s,items){
    for(const item of items){
      if(s.seen.has(item.key))continue;s.seen.add(item.key);
      const p=item.proposal;
      const folders=[...new Set((item.source_paths||[]).map(source=>{
        const path=String(source.path||'').replace(/\//g,'\\').replace(/\\+$/,'');
        return (source.is_file===true?path.replace(/\\[^\\]*$/,''):path).normalize('NFKC').toLowerCase();
      }).filter(Boolean))].sort();
      // Only an unambiguous existing performer can combine different source folders.
      // Without a name, keep each item separate even when it shares a folder.
      const source=p.status==='exact'?null:p.status==='none'?item.key:
        [folders.length?folders:[item.key],item.inherited_from||null];
      const key=JSON.stringify([p.status,norm(p.name),p.matches.slice().sort(),source]);
      let g=s.groups.get(key);
      if(!g){
        g={proposal:p,items:[],excluded:new Set(),enabled:false,target:p.status==='exact'?{id:String(p.matches[0])}:null,shown:100};
        g.node=el('details',null,'lpm-group');const summary=el('summary'),c=check('',false);g.checkbox=c.input;
        c.input.setAttribute('aria-label','Select group '+(p.name||'No match'));c.label.onclick=e=>e.stopPropagation();
        c.input.onchange=()=>{g.enabled=c.input.checked;updateCounts(s);};
        g.count=el('small');g.destination=el('small',null,'lpm-destination');summary.append(c.label,el('strong',p.name||'No name found'),el('span',statusNames[p.status],'lpm-badge lpm-'+p.status),g.count,g.destination);
        g.node.append(summary);g.thumbs=el('div',null,'lpm-thumbnails');g.node.append(g.thumbs,el('p',p.reason,'lpm-muted'));
        g.targetBox=el('div',null,'lpm-target');g.node.append(g.targetBox);
        g.evidence=el('p',p.evidence.map(e=>e.join(': ')).join(' · '),'lpm-path');g.node.append(g.evidence);
        g.itemList=el('div',null,'lpm-items');g.node.append(g.itemList);
        g.node.addEventListener('toggle',()=>{if(g.node.open)itemList(s,g);});
        renderTargets(s,g);s.groups.set(key,g);s.results.append(g.node);
      }
      g.items.push(item);
      if(item.thumbnail&&g.thumbs.children.length<3){const img=el('img');img.src=item.thumbnail;img.alt='Group preview';img.loading='lazy';g.thumbs.append(img);}
      if(item.child_warning)g.node.append(el('p',item.child_warning,'lpm-warning'));
    }
    updateCounts(s);
  }
  function reset(s){
    s.token=null;s.groups.clear();s.seen.clear();s.finished.clear();s.results.replaceChildren();s.people=[];
    s.bridgeBox.hidden=true;notice(s,'Options changed. Scan again.');updateCounts(s);
  }
  function scopeFor(s){
    if(s.scope.value==='selected')return {mode:'ids',ids:s.context.selected};
    if(s.scope.value==='page')return {mode:'ids',ids:s.context.ids};
    if(!s.context.criteria)throw Error('Current filter is unavailable. Use current-page items.');
    return {mode:'filter',criteria:s.context.criteria,search:s.context.search};
  }
  async function scan(s){
    if(s.busy)return;
    if(!samePage(s)){notice(s,'The page changed. Close Matcher and reopen it on the intended list.');return;}
    reset(s);busy(s,true);s.stop=false;
    try{
      notice(s,'Loading performer names and aliases…');
      const start=await call({mode:'start',kind:s.context.kind,scope:scopeFor(s),only_missing:s.missing.checked,children:s.children.checked,limit:Number(s.limit.value)});
      s.token=start.token;s.people=start.people;s.bridgeBox.hidden=!start.bridge;
      s.bridgeAck.checked=false;
      while(!s.stop&&samePage(s)){
        const result=await call({mode:'scan',token:s.token});addItems(s,result.items);
        notice(s,'Scanned '+result.scanned+' / '+result.total+' source item(s). '+s.seen.size+' items available for review. Nothing saved.');
        if(result.done){
          if(result.limited)notice(s,s.status.textContent+' Scan limit reached; narrow the filter or increase the limit.');
          break;
        }
        await new Promise(resolve=>setTimeout(resolve,30));
      }
      if(s.stop||!samePage(s))notice(s,'Scan stopped. The proposals already shown can be reviewed. Nothing saved.');
      searchPeople(s);
    }catch(e){notice(s,'Scan stopped: '+e.message+' Nothing was imported.');}
    finally{busy(s,false);}
  }
  function searchPeople(s){
    s.searchResults.replaceChildren();const query=norm(s.search.value);if(query.length<2)return;
    const people=s.people.filter(p=>[p.name,...(p.alias_list||[])].some(name=>norm(name).includes(query))).slice(0,20);
    for(const p of people){
      s.searchResults.append(button(p.name+(p.disambiguation?' ('+p.disambiguation+')':'')+' · #'+p.id,()=>{
        let changed=0;
        for(const g of s.groups.values())if(g.enabled){g.target={id:String(p.id)};renderTargets(s,g);changed++;}
        notice(s,changed?'Assigned '+p.name+' to '+changed+' checked group(s) in the preview. Click Apply reviewed matches to save.':'Check one or more groups first.');
        updateCounts(s);
      }));
    }
    if(!people.length)s.searchResults.append(el('small','No existing performer found. You can explicitly use this as a new name.'));
  }
  async function apply(s){
    if(s.busy)return;
    if(!samePage(s)){notice(s,'The page changed. Reopen Matcher before importing.');return;}
    const groups=[...s.groups.values()].filter(g=>g.enabled&&currentItems(s,g).length);
    if(!groups.length){notice(s,'Check one or more groups first.');return;}
    if(groups.some(g=>!g.target)){notice(s,'Choose a performer for every checked group first.');return;}
    const total=groups.reduce((n,g)=>n+currentItems(s,g).length,0);
    const names=[...new Set(groups.map(g=>g.target.create).filter(Boolean))];
    if(!confirm('Apply performer links to '+total+' reviewed item(s)?'+
      (names.length?'\n\nCreate or reuse '+names.length+' name(s): '+names.slice(0,15).join(', ')+(names.length>15?'…':''):'')+
      (s.bridgeAck.checked?'\n\nYour enabled Performer Links automation may also update linked galleries/images.':'')+
      '\n\nExisting performer links are kept.'))return;
    const plans=groups.map(g=>({g,items:currentItems(s,g),target:{...g.target}})),allowBridge=s.bridgeAck.checked;
    busy(s,true);s.stop=false;let completed=0;
    try{
      for(const {g,items,target} of plans){
        for(let i=0;i<items.length;i+=100){
          if(s.stop||!samePage(s))break;
          const chunk=items.slice(i,i+100);
          notice(s,'Applying '+(completed+1)+'–'+(completed+chunk.length)+' / '+total+' · '+targetLabel(g,s));
          const result=await call({mode:'apply',token:s.token,keys:chunk.map(x=>x.key),target,ack_bridge:allowBridge});
          if(result.created&&!s.people.some(p=>p.id===result.created.id))s.people.push(result.created);
          if(result.performer){target.id=String(result.performer.id);delete target.create;g.target={...target};}
          for(const row of result.results){s.report.push({...row,at:new Date().toISOString()});s.finished.set(row.key,row.status+(row.message?': '+row.message:''));}
          completed+=chunk.length;
          if(result.results.some(r=>r.status==='unconfirmed')){s.stop=true;break;}
        }
        if(g.node.open)itemList(s,g);
        if(s.stop||!samePage(s))break;
      }
      const counts={};for(const row of s.report)counts[row.status]=(counts[row.status]||0)+1;
      notice(s,(s.stop?'Stopped. ':'Finished. ')+Object.entries(counts).map(([k,v])=>k+': '+v).join(' · ')+'. Reload Stash to refresh the cards.');
    }catch(e){notice(s,'Stopped: '+e.message+'. Check the affected items before retrying. Completed results remain in the report.');}
    finally{busy(s,false);}
  }
  function open(context){
    if(active)return;
    const dialog=el('dialog',null,'lpm-dialog');
    const s={dialog,context,location:location.pathname+location.search,groups:new Map(),seen:new Set(),finished:new Map(),people:[],report:[],busy:false};
    active=s;
    const heading=el('header');s.close=button('Close',()=>{if(s.busy)return;dialog.close();dialog.remove();active=null;});
    heading.append(el('h2','Performer Matcher'),s.close);dialog.append(heading,el('p','Review filename and folder matches, then assign existing performers or create the names you choose.','lpm-muted'));
    const options=el('section',null,'lpm-options');
    s.scope=el('select');s.scope.setAttribute('aria-label','Scan scope');
    for(const [value,label] of [['selected','Selected items ('+context.selected.length+')'],['page','Current page ('+context.ids.length+')'],['filter','Current filter — all pages']]){
      const option=el('option',label);option.value=value;option.disabled=value==='selected'&&!context.selected.length||value==='filter'&&!context.criteria;s.scope.append(option);
    }
    s.scope.value=context.selected.length?'selected':'page';
    s.limit=el('input');s.limit.type='number';s.limit.min='1';s.limit.max='10000';s.limit.value='2000';s.limit.setAttribute('aria-label','Maximum source items to scan');
    const limitLabel=el('label','Scan limit ');limitLabel.append(s.limit);
    const missing=check('Only items without performers',true);s.missing=missing.input;
    const children=check('Also review unassigned images in these galleries');s.children=children.input;children.label.hidden=context.kind!=='Gallery';
    options.append(s.scope,limitLabel,missing.label,children.label);options.addEventListener('change',()=>{if(!s.busy)reset(s);});
    dialog.append(options);
    const actions=el('div',null,'lpm-actions');s.scan=button('Scan for matches',()=>void scan(s),'lpm-primary');
    s.stopButton=button('Stop after current request',()=>{s.stop=true;notice(s,'Stopping after the current request…');});s.stopButton.disabled=true;
    s.apply=button('Apply reviewed matches',()=>void apply(s),'lpm-primary');s.apply.disabled=true;
    s.export=button('Download report',()=>{
      const url=URL.createObjectURL(new Blob([JSON.stringify(s.report,null,2)],{type:'application/json'}));const a=el('a');a.href=url;a.download='lynx-performer-matcher-report.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    });s.export.disabled=true;actions.append(s.scan,s.stopButton,s.apply,s.export);dialog.append(actions);
    s.status=el('p','Choose the scope and scan. Scanning does not change performer links.','lpm-status');s.status.setAttribute('role','status');dialog.append(s.status);
    s.bridgeBox=el('aside',null,'lpm-warning');s.bridgeBox.hidden=true;
    s.bridgeBox.append(el('strong','Optional: forward changes through Performer Links.'),el('p','Matcher applies your reviewed links. By default these updates do not start Lynx Performer Bridge jobs. Enable this option to also run your current Bridge rules on related galleries and images.'));
    const ack=check('Also run my enabled Bridge rules on related items');s.bridgeAck=ack.input;s.bridgeBox.append(ack.label);dialog.append(s.bridgeBox);
    const review=el('section',null,'lpm-review-tools');
    s.view=el('select');s.view.setAttribute('aria-label','Review status');
    for(const [value,label] of [['all','All proposals'],...Object.entries(statusNames)]){const o=el('option',label);o.value=value;s.view.append(o);}
    s.view.onchange=()=>updateCounts(s);
    review.append(s.view,button('Select exact matches',()=>{for(const g of s.groups.values())g.enabled=g.proposal.status==='exact';updateCounts(s);}),
      button('Select new performer groups',()=>{for(const g of s.groups.values())g.enabled=g.proposal.status==='new'&&currentItems(s,g).length>0;updateCounts(s);}),
      button('Select visible groups',()=>{for(const g of s.groups.values())if(!g.node.hidden)g.enabled=true;updateCounts(s);}),
      button('Clear selection',()=>{for(const g of s.groups.values())g.enabled=false;updateCounts(s);}));
    review.append(button('Use proposed names for checked groups',()=>useProposedNames(s)),
      el('small','Use each checked group’s own name for a new performer. Existing matches and chosen performers are kept. Save with Apply reviewed matches.','lpm-muted'));
    const manual=el('div',null,'lpm-manual');s.search=el('input');s.search.type='search';s.search.placeholder='Find a performer for checked groups…';s.search.setAttribute('aria-label','Find an existing performer');s.search.maxLength=100;
    s.searchResults=el('div',null,'lpm-search-results');s.search.oninput=()=>searchPeople(s);
    manual.append(s.search,button('Use typed name as new performer',()=>{
      const name=s.search.value.trim();if(!name)return;
      let count=0;for(const g of s.groups.values())if(g.enabled){g.target={create:name};renderTargets(s,g);count++;}
      notice(s,count?'New name assigned to '+count+' checked groups in the preview. Review, then apply.':'Check one or more groups first.');updateCounts(s);
    }),s.searchResults);review.append(manual);dialog.append(review);
    s.summary=el('p',null,'lpm-summary');s.results=el('section',null,'lpm-results');dialog.append(s.summary,s.results);
    dialog.addEventListener('cancel',e=>{e.preventDefault();if(s.busy){s.stop=true;notice(s,'Stopping after the current request…');}else s.close.click();});
    document.body.append(dialog);dialog.showModal();updateCounts(s);
  }
  function Toolbar({kind,items,filter,selectedIds}){
    if(location.pathname.replace(/\/$/,'')!==(kind==='Image'?'/images':'/galleries'))return null;
    return h('div',{className:'lpm-toolbar'},h('button',{type:'button',className:'btn btn-secondary',onClick:()=>{
      let criteria=null,search='';try{criteria=filter.makeFilter();search=filter.makeFindFilter().q||'';}catch{}
      open({kind,ids:items.map(i=>String(i.id)),selected:[...(selectedIds||[])].map(String),criteria,search});
    }},'Match performers'),h('small',null,'Review names from filenames and folders'));
  }
  for(const [name,kind,field] of [['ImageList','Image','images'],['GalleryList','Gallery','galleries']]){
    api.patch.after(name,(...args)=>{
      const props=args[0],result=args.at(-1);
      if(!props?.[field]||!props.filter)return result;
      return h(R.Fragment,null,h(Toolbar,{kind,items:props[field],filter:props.filter,selectedIds:props.selectedIds}),result);
    });
  }
})();
