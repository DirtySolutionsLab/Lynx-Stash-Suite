/* Lynx Missing Performer Images 1.2.1. See CREDITS.md for provenance.
 * No external JavaScript dependencies or build step. Public revision 2026-10-23.
 */
(function () {
  "use strict";
  const PAGE_SIZE_KEY="mpiPerformerImagePageSize", DEFAULT_PAGE_SIZE=40, MAX_BYTES=32 * 1024 * 1024;
  const Q = {
    missing: `query Missing($page:Int!){findPerformers(performer_filter:{is_missing:"image"},filter:{page:$page,per_page:100,sort:"name",direction:ASC}){count performers{id name disambiguation}}}`,
    images: `query Images($criteria:ImageFilterType!,$page:Int!){findImages(image_filter:$criteria,filter:{page:$page,per_page:100,sort:"id",direction:ASC}){count images{id files{width height} paths{image thumbnail}}}}`,
    galleries: `query Galleries($criteria:GalleryFilterType!,$page:Int!){findGalleries(gallery_filter:$criteria,filter:{page:$page,per_page:100,sort:"id",direction:ASC}){count galleries{id}}}`,
    check: `query Check($ids:[ID!]!){findPerformers(ids:$ids,performer_filter:{is_missing:"image"},filter:{per_page:-1}){performers{id}}}`,
    update: `mutation Assign($input:PerformerUpdateInput!){performerUpdate(input:$input){id}}`,
    scrapers: `query PortraitSources{listScrapers(types:[PERFORMER]){id name performer{supported_scrapes}}}`,
    search: `query PortraitSearch($source:ScraperSourceInput!,$input:ScrapeSinglePerformerInput!){scrapeSinglePerformer(source:$source,input:$input){name disambiguation urls image images}}`,
    profile: `query PortraitProfile($url:String!){scrapePerformerURL(url:$url){name disambiguation urls image images}}`,
    fetchImage: `mutation PortraitDownload($id:ID!,$args:Map!){runPluginOperation(plugin_id:$id,args:$args)}`
  };
  const esc = value => String(value == null ? "" : value).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const dimensions = image => image.files && image.files[0] || {width:0,height:0};
  function ranked(images) {
    return [...new Map(images.filter(i => {
      const d = dimensions(i); return d.width > 0 && d.height > 0 && i.paths && i.paths.image;
    }).map(i => [i.id,i])).values()].sort((a,b) => {
      const x=dimensions(a), y=dimensions(b);
      return Number(y.height>y.width)-Number(x.height>x.width) || y.width*y.height-x.width*x.height || Math.min(y.width,y.height)-Math.min(x.width,x.height) || Number(a.id)-Number(b.id);
    });
  }
  function safeWebURL(value){try{const u=new URL(value);return ['http:','https:'].includes(u.protocol)&&!u.username&&!u.password?u.href:'';}catch{return '';}}
  function safeImage(value){return typeof value==='string'&&/^data:image\/(jpeg|png|gif|webp);base64,[a-z0-9+/=\r\n]+$/i.test(value)&&value.length<=MAX_BYTES*1.4?value:safeWebURL(value);}
  const imageURL = (image, thumb=false) => image?.source==='online'?safeImage(image.data):`/image/${encodeURIComponent(image.id)}/${thumb ? "thumbnail" : "image"}`;
  const describe = i => {if(i.source==='online')return i.provider||'Selected online image';const d=dimensions(i);return `${d.width} × ${d.height} · ${d.height>d.width ? "Portrait" : d.height===d.width ? "Square" : "Landscape"}`;};
  const sourceLabel = i => i.source==='online'?'Online / uploaded':i.source === "direct" ? "Linked image" : "Linked gallery";
  function onlineChoices(records,provider){const choices=[],seen=new Set();for(const record of records||[]){if(!record)continue;const profile=(record.urls||[]).map(safeWebURL).find(Boolean)||'';const photos=[...new Set([...(record.images||[]),record.image].map(safeImage).filter(Boolean))];for(const data of photos.length?photos:['']){const key=data||profile+'|'+record.name;if(seen.has(key))continue;seen.add(key);choices.push({source:'online',id:'online-'+choices.length,name:record.name||'Unknown name',provider,profile,data});if(choices.length===40)return choices;}}return choices;}
  async function gql(query, variables, signal) {
    const r=await fetch("/graphql",{method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json"},body:JSON.stringify({query,variables}),signal});
    if(!r.ok) throw new Error(`Stash returned HTTP ${r.status}.`);
    const json=await r.json();
    if(json.errors && json.errors.length) throw new Error(json.errors.map(e=>e.message).join("; "));
    if(!json.data) throw new Error("Stash returned no result.");
    return json.data;
  }
  async function all(client,query,key,items,criteria) {
    const result=[];
    for(let page=1;;page++) {
      const data=(await client(query,{page,...(criteria ? {criteria}: {})}))[key];
      result.push(...data[items]);
      if(page*100>=data.count) return result;
      if(!data[items].length) throw new Error("Search stopped: a result page was unexpectedly empty.");
    }
  }
  async function getCandidates(client,pid) {
    const filter={performers:{value:[pid],modifier:"INCLUDES"}};
    const direct=ranked(await all(client,Q.images,"findImages","images",filter)).map(i=>({...i,source:"direct"}));
    return direct;
  }
  async function getGalleryCandidates(client,pid,direct) {
    const galleries=await all(client,Q.galleries,"findGalleries","galleries",{performers:{value:[pid],modifier:"INCLUDES"}});
    const items=[];
    for(let index=0;index<galleries.length;index+=100) {
      items.push(...await all(client,Q.images,"findImages","images",{galleries:{value:galleries.slice(index,index+100).map(i=>i.id),modifier:"INCLUDES"}}));
    }
    const ids=new Set(direct.map(i=>i.id));
    return ranked(items).filter(i=>!ids.has(i.id)).map(i=>({...i,source:"gallery"}));
  }
  async function missing(client,pid) {
    return (await client(Q.check,{ids:[pid]})).findPerformers.performers.some(p=>String(p.id)===String(pid));
  }
  async function download(image,signal) {
    if(image.source==='online'){
      const data=safeImage(image.data);
      if(!data||!data.startsWith('data:'))throw Error('Preview and load the online image before saving.');
      return data;
    }
    const response=await fetch(imageURL(image),{credentials:"same-origin",signal});
    if(!response.ok) throw new Error("Could not download this image. Choose another image.");
    if(Number(response.headers.get("content-length"))>MAX_BYTES) throw new Error("Image exceeds 32 MiB. Choose another image.");
    const reader=response.body.getReader(); const chunks=[]; let size=0;
    try { for(;;) {const {done,value}=await reader.read(); if(done) break;size+=value.length;if(size>MAX_BYTES) throw new Error("Image exceeds 32 MiB. Choose another image.");chunks.push(value);} }
    finally { await reader.cancel(); }
    const blob=new Blob(chunks); const head=new Uint8Array(await blob.slice(0,12).arrayBuffer());
    let mime="";
    if(head[0]===255&&head[1]===216&&head[2]===255) mime="image/jpeg";
    else if([137,80,78,71,13,10,26,10].every((b,i)=>head[i]===b)) mime="image/png";
    else if(String.fromCharCode(...head.slice(0,6)).match(/^GIF8[79]a$/)) mime="image/gif";
    else if(String.fromCharCode(...head.slice(0,4))==="RIFF"&&String.fromCharCode(...head.slice(8,12))==="WEBP") mime="image/webp";
    if(!mime) throw new Error("Unsupported image format. Use JPEG, PNG, GIF or WebP.");
    return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=()=>reject(new Error("Could not read the image."));r.readAsDataURL(new Blob(chunks,{type:mime}));});
  }
  async function assign(client,pid,image,fetchImage) {
    if(!await missing(client,pid)) return "protected";
    const data=await fetchImage(image);
    if(!await missing(client,pid)) return "protected";
    const result=await client(Q.update,{input:{id:pid,image:data}});
    if(!result.performerUpdate||String(result.performerUpdate.id)!==String(pid)) throw new Error("Stash did not confirm the change. Refresh the list to check whether it was saved.");
    return "saved";
  }
  class Review {
    constructor(root) {
      this.root=root;this.people=[];this.cards=new Map();this.page=0;this.search="";this.busy=false;this.loading=false;this.generation=0;this.destroyed=false;this.pageSize=this.readPageSize();
      this.abort=new AbortController();this.client=(q,v)=>gql(q,v,this.abort.signal);
      this.root.innerHTML=`<section class="mpi-review">
        <header class="mpi-header"><div><span class="mpi-eyebrow">MISSING PERFORMER IMAGES</span><h1>Find missing profile images</h1><p>Review an image, choose another if needed, then approve it to save.</p></div><button class="mpi-button mpi-primary" data-action="refresh">Load performers</button></header>
        <div class="mpi-note">Only performers without a profile image are shown. Pause other profile-image imports while saving.</div>
        <ol class="mpi-steps"><li><strong>Load</strong> performers missing an image.</li><li><strong>Review</strong> a library suggestion, or choose <strong>Find online</strong>.</li><li><strong>Approve &amp; save</strong> only after checking the correct person is shown.</li></ol>
        <div class="mpi-toolbar"><label class="mpi-search">Filter performers<input type="search" placeholder="Filter by name…" aria-label="Filter performers"></label><label class="mpi-page-size">Performers per page<select data-action="page-size" aria-label="Performers per page">${[...new Set([20,40,60,120,250,500,1000,this.pageSize])].sort((a,b)=>a-b).map(n=>`<option value="${n}" ${this.pageSize===n?"selected":""}>${n}</option>`).join("")}<option value="custom">Custom number…</option></select></label><div class="mpi-custom-size" hidden><label>Custom number<input data-action="custom-size" type="number" min="1" step="1" value="${this.pageSize}" aria-label="Custom performers per page"></label><button class="mpi-button" data-action="apply-page-size">Apply</button></div><div class="mpi-stats" aria-live="polite"></div></div>
        <div class="mpi-batch"><label><input type="checkbox" data-action="select-page"> Select reviewed suggestions on this page</label><button class="mpi-button mpi-primary" data-action="save-selected" disabled>Save selected (0)</button><span>Review each image before selecting it.</span></div>
        <div class="mpi-message" role="status" aria-live="polite">Click Load performers to start. Nothing is saved automatically.</div>
        <div class="mpi-grid"></div><div class="mpi-pagination"></div>
        <dialog class="mpi-dialog" aria-label="Choose an image"><div class="mpi-dialog-content"></div></dialog>
      </section>`;
      root.addEventListener("click",this.onClick=e=>this.click(e));
      root.addEventListener("change",this.onChange=e=>this.change(e));
      root.querySelector('input[type="search"]').addEventListener("input",e=>{this.search=e.target.value;this.page=0;this.renderPage();});
      this.dialog=root.querySelector("dialog");
      this.dialog.addEventListener("close",()=>{this.modal?.abort.abort();this.modal=null;});
    }
    destroy(){this.destroyed=true;this.abort.abort();this.modal?.abort.abort();this.dialog.close();this.root.removeEventListener("click",this.onClick);this.root.removeEventListener("change",this.onChange);}
    visible(){return this.people.filter(p=>`${p.name} ${p.disambiguation||""}`.toLocaleLowerCase().includes(this.search.toLocaleLowerCase()));}
    readPageSize(){try{const value=Number(localStorage.getItem(PAGE_SIZE_KEY));return Number.isSafeInteger(value)&&value>0?value:DEFAULT_PAGE_SIZE;}catch(_){return DEFAULT_PAGE_SIZE;}}
    setPageSize(value){if(!Number.isSafeInteger(value)||value<1)return;this.pageSize=value;try{localStorage.setItem(PAGE_SIZE_KEY,String(value));}catch(_){}const select=this.root.querySelector('[data-action="page-size"]');if(![...select.options].some(o=>Number(o.value)===value)){const custom=select.querySelector('option[value="custom"]');select.insertBefore(new Option(String(value),String(value)),custom);}select.value=String(value);this.page=0;this.renderPage();}
    current(){return this.visible().slice(this.page*this.pageSize,(this.page+1)*this.pageSize);}
    message(text,error=false){const n=this.root.querySelector(".mpi-message");n.textContent=text;n.classList.toggle("mpi-error",error);}
    async refresh(){
      if(this.busy||this.loading)return;
      this.loading=true;this.updateToolbar();this.message("Loading performers without a profile image…");
      try {
        const people=await all(this.client,Q.missing,"findPerformers","performers");
        if(this.destroyed)return;
        this.generation++;this.people=[...new Map(people.map(p=>[p.id,p])).values()];this.cards.clear();this.page=0;this.loaded=true;
        this.message(this.people.length ? "Choose Approve & save on a card, or select several reviewed suggestions." : "All done! No performers are missing a profile image.");
        this.renderPage();
      }catch(e){if(!this.destroyed)this.message(e.message,true);}
      finally{this.loading=false;if(!this.destroyed)this.updateToolbar();}
    }
    updateToolbar(){
      const current=this.current(); const selected=current.filter(p=>{const s=this.cards.get(p.id);return s&&s.checked&&s.status==="ready"&&!s.imageFailed;});
      const eligible=current.filter(p=>{const s=this.cards.get(p.id);return s&&s.status==="ready"&&!s.imageFailed;});
      const check=this.root.querySelector('[data-action="select-page"]');
      check.checked=eligible.length>0&&selected.length===eligible.length;check.indeterminate=selected.length>0&&selected.length<eligible.length;check.disabled=this.busy||!eligible.length;
      const save=this.root.querySelector('[data-action="save-selected"]');save.textContent=`Save selected (${selected.length})`;save.disabled=this.busy||!selected.length;
      const refresh=this.root.querySelector('[data-action="refresh"]');refresh.disabled=this.busy||this.loading;refresh.textContent=this.loading?"Loading…":this.loaded?"Refresh list":"Load performers";
      this.root.querySelector('input[type="search"]').disabled=this.busy;
      const saved=[...this.cards.values()].filter(s=>s.status==="saved").length;
      this.root.querySelector(".mpi-stats").textContent=this.loaded?`${this.people.length} missing at last search · ${saved} saved this session`:"";
      this.root.querySelectorAll('.mpi-pagination button').forEach(b=>{b.disabled=this.busy||(b.dataset.action==="previous"?this.page===0:(this.page+1)*this.pageSize>=this.visible().length);});
    }
    renderPage(){
      if(this.destroyed)return;
      this.generation++;
      for(const state of this.cards.values())if(state.status==="loading")state.status="pending";
      const filtered=this.visible();this.page=Math.min(this.page,Math.max(0,Math.ceil(filtered.length/this.pageSize)-1));
      this.root.querySelector(".mpi-grid").innerHTML=this.current().map(p=>`<article class="mpi-card" data-pid="${esc(p.id)}" aria-label="${esc(p.name)}"></article>`).join("");
      for(const p of this.current()) {if(!this.cards.has(p.id))this.cards.set(p.id,{status:"pending",choices:[],checked:false});this.renderCard(p.id);}
      this.root.querySelector(".mpi-pagination").innerHTML=filtered.length?`<button class="mpi-button" data-action="previous">← Previous</button><span>Showing ${this.page*this.pageSize+1}–${Math.min((this.page+1)*this.pageSize,filtered.length)} of ${filtered.length} · Page ${this.page+1} of ${Math.ceil(filtered.length/this.pageSize)}</span><button class="mpi-button" data-action="next">Next →</button>`:"";
      this.updateToolbar();this.loadVisible();
    }
    async loadVisible(){
      const jobs=this.current().filter(p=>this.cards.get(p.id).status==="pending");const generation=this.generation;
      // Mark all before awaiting so page/search changes do not duplicate requests.
      for(const p of jobs){const state=this.cards.get(p.id);state.status="loading";state.requestId=generation;}
      const worker=async()=>{while(jobs.length&&!this.destroyed&&generation===this.generation){const p=jobs.shift();const s=this.cards.get(p.id);this.renderCard(p.id);
        try {let choices=await getCandidates(this.client,p.id);if(generation!==this.generation||s.requestId!==generation)continue;if(!choices.length){choices=await getGalleryCandidates(this.client,p.id,[]);if(generation!==this.generation||s.requestId!==generation)continue;s.galleryLoaded=true;}s.choices=choices;s.selected=0;s.status=s.choices.length?"ready":"empty";}
        catch(e){if(generation!==this.generation||s.requestId!==generation)continue;s.status="error";s.error=e.message;}
        if(!this.destroyed&&generation===this.generation){this.renderCard(p.id);this.updateToolbar();}
      }};
      await Promise.all([worker(),worker(),worker()]);
    }
    renderCard(pid){
      const node=[...this.root.querySelectorAll(".mpi-card")].find(n=>n.dataset.pid===pid);if(!node)return;
      const p=this.people.find(p=>p.id===pid),s=this.cards.get(pid),image=s.choices[s.selected||0];
      const terminal={saved:"✓ Profile image saved",protected:"Existing image protected — no changes made",skipped:"Skipped for this review"};
      let body;
      if(terminal[s.status]) body=`<div class="mpi-result ${s.status=== "saved"?"mpi-success":""}">${terminal[s.status]}</div>${s.status==="skipped"?'<button class="mpi-button" data-action="undo">Undo skip</button>':""}`;
      else if(s.status==="empty")body='<div class="mpi-placeholder">No linked images found<p>Search your installed performer sources or upload an image instead.</p></div><button class="mpi-button mpi-primary" data-action="find-online">Find online / upload</button>';
      else if(s.status==="pending"||s.status==="loading")body='<div class="mpi-placeholder" role="status">Finding image suggestions…</div>';
      else if(s.status==="error"&&!image)body=`<div class="mpi-error">${esc(s.error)}</div><button class="mpi-button" data-action="retry">Try again</button><button class="mpi-button" data-action="find-online">Find online / upload</button>`;
      else body=`<button class="mpi-image" data-action="choose" aria-label="Preview or change image for ${esc(p.name)}" ${this.busy?"disabled":""}><img src="${esc(imageURL(image,true))}" alt="Suggested image for ${esc(p.name)}" loading="lazy"><span>Preview / choose another</span></button>
        <div class="mpi-meta"><span class="mpi-source ${image.source=== "gallery"?"mpi-gallery":""}">${sourceLabel(image)}</span><span>${describe(image)}</span></div>
        ${s.imageFailed?'<p class="mpi-error">Could not display this image. Choose another.</p>':""}${s.error?`<p class="mpi-error">${esc(s.error)}</p>`:""}
        <label class="mpi-select"><input type="checkbox" data-action="select" ${s.checked?"checked":""} ${this.busy||s.imageFailed?"disabled":""}> Select to save</label>
        <div class="mpi-actions"><button class="mpi-button mpi-primary" data-action="save" ${this.busy||s.imageFailed?"disabled":""}>${s.status==="saving"?"Saving…":"Approve & save"}</button><button class="mpi-button" data-action="choose" ${this.busy?"disabled":""}>Choose image</button><button class="mpi-button mpi-quiet" data-action="skip" ${this.busy?"disabled":""}>Skip</button></div>`;
      node.innerHTML=`<div class="mpi-card-heading"><h2>${esc(p.name)}</h2>${p.disambiguation?`<span>${esc(p.disambiguation)}</span>`:""}<a href="/performers/${encodeURIComponent(pid)}" target="_blank" rel="noopener" aria-label="Open ${esc(p.name)} in a new tab">↗</a></div>${body}`;
      const img=node.querySelector("img");if(img)img.addEventListener("error",()=>{if(s.imageFailed)return;s.imageFailed=true;s.checked=false;this.renderCard(pid);this.updateToolbar();},{once:true});
    }
    change(event){
      if(this.busy)return;const action=event.target.dataset.action;
      if(action==='upload-online'){this.uploadOnline(event.target.files?.[0]);return;}
      if(action==="page-size"){if(event.target.value==="custom"){const box=this.root.querySelector(".mpi-custom-size");box.hidden=false;box.querySelector("input").focus();}else{this.setPageSize(Number(event.target.value));this.root.querySelector(".mpi-custom-size").hidden=true;}return;}
      if(action==="select"){const pid=event.target.closest("[data-pid]").dataset.pid;this.cards.get(pid).checked=event.target.checked;}
      if(action==="select-page"){for(const p of this.current()){const s=this.cards.get(p.id);if(s.status==="ready"&&!s.imageFailed)s.checked=event.target.checked;this.renderCard(p.id);}}
      this.updateToolbar();
    }
    async click(event){
      const button=event.target.closest("[data-action]");if(!button||button.disabled)return;const action=button.dataset.action;
      if(action==="refresh")return this.refresh();
      if(action==="apply-page-size"){const input=this.root.querySelector('[data-action="custom-size"]');const value=Number(input.value);if(!Number.isSafeInteger(value)||value<1){input.setCustomValidity("Enter a whole number of at least 1.");input.reportValidity();return;}input.setCustomValidity("");this.setPageSize(value);this.root.querySelector(".mpi-custom-size").hidden=true;return;}
      if(action==="close"){this.dialog.close();return;}
      if(this.busy)return;
      const article=button.closest("[data-pid]");const pid=article&&article.dataset.pid;const s=pid&&this.cards.get(pid);
      if(action==="previous"||action==="next"){this.page+=action==="next"?1:-1;this.renderPage();this.root.scrollIntoView({block:"start"});}
      if(action==="retry"){s.status="pending";this.loadVisible();}
      if(action==="skip"||action==="undo"){s.status=action==="skip"?"skipped":"ready";s.checked=false;this.renderCard(pid);this.updateToolbar();}
      if(action==="choose")this.openModal(pid);
      if(action==='find-online')this.openModal(pid,'online');
      if(action==='picker-mode'){this.modal.mode=button.dataset.mode;this.renderModal();if(this.modal.mode==='online')this.loadSources();return;}
      if(action==='online-search'){await this.searchOnline();return;}
      if(action==='online-option'){await this.previewOnline(Number(button.dataset.index));return;}
      if(action==='profile-photos'){await this.searchOnline(button.dataset.url);return;}
      if(action==='import-url'){await this.previewOnline(-1);return;}
      if(action==='use-online'){const m=this.modal,c=this.cards.get(m.pid),image=m.online.results[m.online.selected];if(!image?.data?.startsWith('data:'))return;c.choices.push(image);c.selected=c.choices.length-1;c.checked=false;c.imageFailed=false;c.error=null;c.status='ready';this.dialog.close();this.renderCard(m.pid);this.updateToolbar();return;}
      if(action==="option"){this.modal.index=Number(button.dataset.index);this.renderModal();}
      if(action==="more"){this.modal.limit+=24;this.renderModal();}
      if(action==="gallery")this.loadGallery();
      if(action==="use-choice"){const m=this.modal,c=this.cards.get(m.pid);c.selected=m.index;c.checked=false;c.imageFailed=false;c.error=null;c.status="ready";this.dialog.close();this.renderCard(m.pid);this.updateToolbar();}
      if(action==="save")await this.save([pid]);
      if(action==="save-selected")await this.save(this.current().filter(p=>{const c=this.cards.get(p.id);return c.checked&&c.status==="ready"&&!c.imageFailed;}).map(p=>p.id));
    }
    openModal(pid,mode='library'){const s=this.cards.get(pid),p=this.people.find(p=>p.id===pid);this.modal={pid,index:s.selected||0,limit:24,mode,abort:new AbortController(),online:{query:p.name,source:'',results:[],selected:-1,busy:false,status:'Choose a source, then search by name. Or paste a performer profile URL.',imageURL:''}};this.renderModal();this.dialog.showModal();if(mode==='online')this.loadSources();}
    renderModal(){
      const m=this.modal;if(!m)return;const p=this.people.find(p=>p.id===m.pid),s=this.cards.get(m.pid),image=s.choices[m.index];
      if(m.mode==='online'){this.renderOnline();return;}
      this.dialog.querySelector(".mpi-dialog-content").innerHTML=`<header><div><h2>${esc(p.name)}</h2><p>Choose an image below. It is saved only after you approve the card.</p></div><button class="mpi-button" data-action="close" aria-label="Close image picker">Close ×</button></header>
      ${this.pickerTabs('library')}
      <div class="mpi-picker"><div class="mpi-large">${image?`<img src="${esc(imageURL(image))}" alt="Preview image for ${esc(p.name)}"><p>${sourceLabel(image)} · ${describe(image)}</p><button class="mpi-button mpi-primary" data-action="use-choice">Use this image</button>`:'<div class="mpi-placeholder">No library images available. Choose Find online to search another source or upload a file.</div>'}</div>
      <div class="mpi-alternatives"><h3>${s.choices.length} image choices</h3><div class="mpi-thumbnails">${s.choices.slice(0,m.limit).map((i,index)=>`<button data-action="option" data-index="${index}" aria-label="Choose image ${esc(i.id)}, ${sourceLabel(i)}, ${describe(i)}" aria-pressed="${index===m.index}" class="${index===m.index?"mpi-chosen":""}"><img src="${imageURL(i,true)}" alt="Option ${index+1}" loading="lazy"><span>${sourceLabel(i)}<br>${describe(i)}</span></button>`).join("")}</div>
      ${s.choices.length>m.limit?'<button class="mpi-button" data-action="more">Show more images</button>':""}
      ${!s.galleryLoaded?`<button class="mpi-button" data-action="gallery" ${m.galleryLoading?"disabled":""}>${m.galleryLoading?"Loading gallery images…":"Include linked gallery images"}</button>`:""}
      ${m.error?`<p class="mpi-error">${esc(m.error)}</p>`:""}<p class="mpi-help">A gallery link does not guarantee that every image shows the correct person.</p></div></div>`;
      const large=this.dialog.querySelector(".mpi-large img");if(large)large.addEventListener("error",()=>{const use=this.dialog.querySelector('[data-action="use-choice"]');if(use)use.disabled=true;const note=this.dialog.querySelector(".mpi-large p");if(note)note.textContent="Could not display this image. Choose another option.";},{once:true});
    }
    pickerTabs(active){return `<div class="mpi-picker-tabs" aria-label="Image sources"><button class="mpi-button ${active==='library'?'mpi-primary':''}" data-action="picker-mode" data-mode="library" aria-pressed="${active==='library'}">Library images</button><button class="mpi-button ${active==='online'?'mpi-primary':''}" data-action="picker-mode" data-mode="online" aria-pressed="${active==='online'}">Find online / upload</button></div>`;}
    async loadSources(){
      const m=this.modal;if(!m||this.sources)return;
      try{this.sources=(await gql(Q.scrapers,{},m.abort.signal)).listScrapers.filter(source=>source.performer?.supported_scrapes?.includes('NAME')).sort((a,b)=>a.name.localeCompare(b.name));}
      catch(error){if(this.modal===m)m.online.status='Could not load search sources: '+error.message;}
      if(this.modal===m&&!this.destroyed)this.renderModal();
    }
    renderOnline(){
      const m=this.modal,o=m.online,p=this.people.find(p=>p.id===m.pid),selected=o.results[o.selected];
      if(!o.source&&this.sources?.length)o.source=this.sources[0].id;
      const locked=o.busy?'disabled':'';
      this.dialog.querySelector('.mpi-dialog-content').innerHTML=`<header><div><h2>${esc(p.name)}</h2><p>Find a profile image. Only the image is imported — no other metadata is changed.</p></div><button class="mpi-button" data-action="close">Close ×</button></header>
        ${this.pickerTabs('online')}
        <div class="mpi-online-form"><label>Performer name or profile URL<input data-online="query" value="${esc(o.query)}" ${locked} placeholder="Name, or https://…/performer/profile"></label><label>Search source<select data-online="source" ${locked}>${(this.sources||[]).map(source=>`<option value="${esc(source.id)}" ${source.id===o.source?'selected':''}>${esc(source.name)}</option>`).join('')||'<option value="">No name-search sources available</option>'}</select></label><button class="mpi-button mpi-primary" data-action="online-search" ${locked}>${o.busy?'Working…':'Search profiles'}</button></div>
        <p class="mpi-online-status" role="status" aria-live="polite">${esc(o.status)}</p>
        <div class="mpi-online-layout"><section class="mpi-online-results" aria-label="Online search results">${o.results.map((choice,index)=>`<article class="mpi-online-result ${index===o.selected?'mpi-chosen':''}"><button class="mpi-online-photo" data-action="online-option" data-index="${index}" ${locked} aria-label="Preview ${esc(choice.name)}">${choice.data?`<img src="${esc(safeImage(choice.data))}" alt="${esc(choice.name)}" loading="lazy" referrerpolicy="no-referrer">`:'<span>No preview yet<br>Click to load profile photos</span>'}</button><strong>${esc(choice.name)}</strong><small>${esc(choice.provider)}</small>${choice.profile?`<a href="${esc(choice.profile)}" target="_blank" rel="noopener noreferrer">View source ↗</a><button class="mpi-button mpi-quiet" data-action="profile-photos" data-url="${esc(choice.profile)}" ${locked}>Load profile photos</button>`:''}</article>`).join('')||'<div class="mpi-placeholder">Search results will appear here. Check the name and photo before selecting.</div>'}</section>
        <aside class="mpi-online-preview">${selected?.data?.startsWith('data:')?`<img src="${esc(selected.data)}" alt="Selected image for ${esc(selected.name)}"><strong>${esc(selected.name)}</strong><p>${esc(selected.provider)}</p><button class="mpi-button mpi-primary" data-action="use-online" ${locked}>Use this image</button><small>Next: approve the performer card to save.</small>`:'<div class="mpi-placeholder">Select a result to preview its image here.</div>'}</aside></div>
        <details class="mpi-online-fallback"><summary>More ways to add an image</summary><p>Use a direct image URL or upload a saved JPEG, PNG, GIF or WebP. External downloads are limited to 8 MiB.</p><div class="mpi-online-form"><label>Direct image URL<input data-online="imageURL" value="${esc(o.imageURL)}" ${locked} placeholder="https://example.com/photo.jpg"></label><button class="mpi-button" data-action="import-url" ${locked}>Preview image URL</button><label class="mpi-button">Upload image<input type="file" accept="image/jpeg,image/png,image/gif,image/webp" data-action="upload-online" ${locked}></label></div><a class="mpi-button" data-google href="https://www.google.com/search?tbm=isch&amp;q=${encodeURIComponent(o.query||p.name)}" target="_blank" rel="noopener noreferrer">Google Images ↗ (opens another tab)</a><p class="mpi-help">Google is a separate search shortcut, not an embedded results source. Return here to preview a direct image link or upload a saved image. Only use images you are entitled to store.</p></details>`;
      this.dialog.querySelectorAll('[data-online]').forEach(input=>input.addEventListener(input.tagName==='SELECT'?'change':'input',()=>{o[input.dataset.online]=input.value;const google=this.dialog.querySelector('[data-google]');if(google)google.href='https://www.google.com/search?tbm=isch&q='+encodeURIComponent(o.query||p.name);}));
      const preview=this.dialog.querySelector('.mpi-online-preview img');if(preview)preview.addEventListener('error',()=>{const use=this.dialog.querySelector('[data-action="use-online"]');if(use)use.disabled=true;o.status='This image could not be displayed. Choose another image.';this.dialog.querySelector('.mpi-online-status').textContent=o.status;},{once:true});
    }
    async searchOnline(profileURL){
      const m=this.modal;if(!m||m.online.busy)return;const o=m.online,query=(profileURL||o.query).trim();if(!query)return;
      o.busy=true;o.status='Contacting the selected source…';this.renderModal();
      try{
        let records,provider;
        if(/^https?:\/\//i.test(query)){const url=safeWebURL(query);if(!url)throw Error('Enter a valid public profile URL.');records=[(await gql(Q.profile,{url},m.abort.signal)).scrapePerformerURL];provider=new URL(url).hostname;}
        else{if(!o.source)throw Error('Install a performer scraper with name-search support, or paste a supported performer profile URL.');records=(await gql(Q.search,{source:{scraper_id:o.source},input:{query}},m.abort.signal)).scrapeSinglePerformer;provider=this.sources?.find(source=>source.id===o.source)?.name||'Performer scraper';}
        if(this.modal!==m||this.destroyed)return;
        o.results=onlineChoices(records,provider);o.selected=-1;o.status=o.results.length?o.results.length+' results. Select a photo to preview, or load profile photos if the search only returned a profile.':'No matching profiles or images returned. Try another source, name or profile URL.';
      }catch(error){if(this.modal===m)o.status=error.name==='AbortError'?'Search cancelled.':'Search failed: '+error.message+' Try another source. Scraper dependencies and site access must work in Stash.';}
      finally{if(this.modal===m&&!this.destroyed){o.busy=false;this.renderModal();}}
    }
    async materialize(choice,m){
      const data=safeImage(choice.data);if(!data)throw Error('No supported image in this result. Load its profile photos instead.');
      if(data.startsWith('data:'))return data;
      let result=(await gql(Q.fetchImage,{id:'missing_performer_images',args:{mode:'fetch_image',url:data}},m.abort.signal)).runPluginOperation;
      if(typeof result==='string')result=JSON.parse(result);
      if(result?.error)throw Error(result.error);
      if(result?.output){result=typeof result.output==='string'?JSON.parse(result.output):result.output;}
      if(!safeImage(result?.image)?.startsWith('data:'))throw Error('Image download returned no usable image.');
      return result.image;
    }
    async previewOnline(index){
      const m=this.modal;if(!m||m.online.busy)return;const o=m.online;
      let choice=index<0?{source:'online',id:'url-'+Date.now(),name:this.people.find(p=>p.id===m.pid).name,provider:'Direct image URL',data:safeWebURL(o.imageURL),profile:''}:o.results[index];
      if(!choice)return;if(!choice.data&&choice.profile){await this.searchOnline(choice.profile);return;}
      o.busy=true;o.status='Loading the selected image for preview…';this.renderModal();
      try{const data=await this.materialize(choice,m);if(this.modal!==m||this.destroyed)return;choice={...choice,data};if(index<0){o.results.push(choice);index=o.results.length-1;}else o.results[index]=choice;o.selected=index;o.status='Check the preview, then choose Use this image. Nothing has been saved yet.';}
      catch(error){if(this.modal===m)o.status='Could not load image: '+error.message;}
      finally{if(this.modal===m&&!this.destroyed){o.busy=false;this.renderModal();}}
    }
    async uploadOnline(file){
      const m=this.modal;if(!m||!file||m.online.busy)return;const o=m.online;
      o.busy=true;o.status='Reading image file…';this.renderModal();
      try{
        if(file.size>8*1024*1024)throw Error('Uploaded image exceeds 8 MiB.');
        const head=new Uint8Array(await file.slice(0,12).arrayBuffer());let mime='';
        if(head[0]===255&&head[1]===216&&head[2]===255)mime='image/jpeg';else if([137,80,78,71,13,10,26,10].every((n,i)=>head[i]===n))mime='image/png';else if(/^GIF8[79]a$/.test(String.fromCharCode(...head.slice(0,6))))mime='image/gif';else if(String.fromCharCode(...head.slice(0,4))==='RIFF'&&String.fromCharCode(...head.slice(8,12))==='WEBP')mime='image/webp';
        if(!mime)throw Error('Use a JPEG, PNG, GIF or WebP image file.');
        const data=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(Error('Could not read image file.'));reader.readAsDataURL(new Blob([file],{type:mime}));});
        if(this.modal!==m||this.destroyed)return;o.results.push({source:'online',id:'upload-'+Date.now(),name:this.people.find(p=>p.id===m.pid).name,provider:'Uploaded image',profile:'',data});o.selected=o.results.length-1;o.status='Check the preview, then choose Use this image. Nothing has been saved yet.';
      }catch(error){if(this.modal===m)o.status=error.message;}
      finally{if(this.modal===m&&!this.destroyed){o.busy=false;this.renderModal();}}
    }
    async loadGallery(){const m=this.modal;if(!m||m.galleryLoading)return;const s=this.cards.get(m.pid);m.galleryLoading=true;this.renderModal();try{s.choices.push(...await getGalleryCandidates(this.client,m.pid,s.choices));s.galleryLoaded=true;}catch(e){m.error=e.message;}finally{m.galleryLoading=false;if(this.modal===m&&!this.destroyed)this.renderModal();}}
    async save(ids){
      if(this.busy||!ids.length)return;this.busy=true;this.updateToolbar();for(const p of this.current())this.renderCard(p.id);
      let saved=0,protectedCount=0,failed=0;
      const operation=async()=>{for(const pid of ids){if(this.destroyed)break;const s=this.cards.get(pid);s.status="saving";s.checked=false;this.renderCard(pid);
        try{s.status=await assign(this.client,pid,s.choices[s.selected||0],i=>download(i,this.abort.signal));if(s.status==="saved")saved++;else protectedCount++;s.error=null;}
        catch(e){s.status="ready";s.error=`${e.message} No automatic retry was made. After a connection error, refresh the list to check whether the image was saved.`;failed++;}
        if(!this.destroyed){this.renderCard(pid);this.message(`${saved} saved · ${protectedCount} already have an image · ${failed} errors`);}
      }};
      try{if(navigator.locks)await navigator.locks.request("missing-performer-images-assign",{ifAvailable:true},async lock=>{if(!lock)throw new Error("Another review tab is currently saving. Wait for it to finish.");await operation();});else await operation();}
      catch(e){if(!this.destroyed)this.message(e.message,true);}
      finally{this.busy=false;if(!this.destroyed){for(const p of this.current())this.renderCard(p.id);this.updateToolbar();}}
    }
  }
  if(typeof module!=="undefined"&&module.exports){module.exports={Q,ranked,all,getCandidates,getGalleryCandidates,assign,esc,safeImage,safeWebURL,onlineChoices,download,Review};return;}
  const api=window.PluginApi;if(!api)return;
  const React=api.React,h=React.createElement;
  function Page(){const ref=React.useRef(null);React.useEffect(()=>{const review=new Review(ref.current);return()=>review.destroy();},[]);return h("div",{ref});}
  function PortraitIcon(){return h("svg",{viewBox:"0 0 24 24",width:"20",height:"20",fill:"none",stroke:"currentColor","stroke-width":"1.8","stroke-linecap":"round","stroke-linejoin":"round","aria-hidden":"true",focusable:"false"},h("rect",{x:"3.5",y:"3.5",width:"17",height:"17",rx:"3"}),h("circle",{cx:"12",cy:"9",r:"2.6"}),h("path",{d:"M7.5 18c.45-2.35 2.06-3.65 4.5-3.65s4.05 1.3 4.5 3.65"}));}
  const route="/plugins/missing-performer-images";
  api.register.route(route,Page);
  api.patch.before("MainNavBar.UtilityItems",props=>[{
    ...props,children:h(React.Fragment,null,props.children,h(api.libraries.ReactRouterDOM.NavLink,{to:route,className:"nav-utility mpi-nav",title:"Review performer images","aria-label":"Review performer images"},h(PortraitIcon)))
  }]);
})();
