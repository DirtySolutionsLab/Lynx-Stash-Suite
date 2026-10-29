/* Suite-local settings UI. Native switches keep their original save handlers. */
(() => {
  const api=window.PluginApi,R=api?.React,D=window.LynxPerformerDefaults;
  if(!R||!api.patch||!D||window.__lynxPerformerSettings110)return;
  window.__lynxPerformerSettings110=true;
  const h=R.createElement,ID='LynxPerformerSuite';
  // Explicit safe scope: never include inference, automation, removal or transfer.
  const attributeRuleKeys=['country','hair','eyes','ethnicity','body','breasts','breastSize','tattoos','piercings','age'].map(name=>'attributes__'+name);
  const titles={attributes:'Performer Attributes - create tags',matcher:'Performer Matcher',links:'Performer Links - copy people',tags:'Tag Transfer - copy tags only',images:'Supporting Images'};
  const purposes={attributes:'Turn performer information into tags. Edit dropdown choices and tagging rules here.',matcher:'Use Match performers above the Images or Galleries list. Scan selected items, the current page or the current filter. Review grouped name proposals, search existing performers, and explicitly create missing names. Only reviewed items are linked by default; forwarding through Performer Links is optional.',tags:'Copy tags between performers, scenes, images and galleries in the directions you choose.',links:'Copy performer associations between galleries and their images. This is separate from copying tags.',images:'Choose supporting-image categories and customize the image panel.'};
  const catalogPromise=fetch('/plugin/'+ID+'/assets/settings-catalog.json?v=1.1.3').then(r=>{if(!r.ok)throw Error('Settings catalog could not be loaded.');return r.json();});
  function Fold({id,title,note,search,children}){
    let remembered={};try{remembered=JSON.parse(localStorage.getItem('lynx-performer-folds-v2')||'{}');}catch{}
    return h('details',{className:'lynx-p-fold',open:search?true:!!remembered[id],onToggle:e=>{if(search)return;remembered[id]=e.currentTarget.open;localStorage.setItem('lynx-performer-folds-v2',JSON.stringify(remembered));}},h('summary',null,title,note&&h('small',null,note)),children);
  }
  function Editor({settingKey,meta,configuration,onSaved}){
    const module=meta.module,prefix=module+'__',name=settingKey.slice(prefix.length);
    const resolved=module in {attributes:1,tags:1,links:1}?D.resolve(configuration,module):{values:{},sources:{}};
    const effective=resolved.values[name]??configuration[ID]?.[settingKey]??'';
    const [draft,setDraft]=R.useState(String(effective)),[status,setStatus]=R.useState(''),[busy,setBusy]=R.useState(false);
    R.useEffect(()=>setDraft(String(effective)),[effective]);
    const isList=/Map$|Rules$|Choices$/.test(name),source=resolved.sources[name]||'saved';
    async function save(){
      setBusy(true);setStatus('');
      try{
        const value=draft.trim();
        if(/Map$/.test(name)&&value&&value.split(';').some(rule=>rule.trim()&&!/^[^=]+=[^=]+$/.test(rule.trim())))throw Error('Use source=Tag Name; separate rules with semicolons.');
        if(name==='measurementUnits'&&!['auto','cm','inches'].includes(value))throw Error('Use auto, cm or inches.');
        onSaved(await D.save({[settingKey]:value}));setStatus('Saved. No tagging task was started.');
      }catch(error){setStatus(error.message);}finally{setBusy(false);}
    }
    return h('div',{className:'lynx-p-editor'},
      h('div',{className:'lynx-p-source'},source==='recovered'?'Recovered from your previous plugin':source==='default'?'Bundled starter value':'Saved custom value'),
      h('p',null,meta.description),
      isList?h('textarea',{rows:name==='countryMap'?10:6,value:draft.replace(/;\s*/g,';\n'),spellCheck:false,'aria-label':meta.displayName,onChange:e=>setDraft(e.target.value)}):h('input',{value:draft,'aria-label':meta.displayName,onChange:e=>setDraft(e.target.value)}),
      h('div',{className:'lynx-p-actions'},h('button',{type:'button',disabled:busy||draft===String(effective),onClick:save},busy?'Saving…':'Save this setting'),h('button',{type:'button',onClick:()=>{setDraft(String(effective));setStatus('');}},'Discard edits'),Object.hasOwn(D.defaults,name)&&h('button',{type:'button',onClick:()=>setDraft(D.defaults[name])},'Use starter value')),
      h('small',{role:'status'},status||'Changing a list does not enable its tagging rule or start a task.'));
  }
  function ImageCategory({category,configuration,onSaved,search}){
    const {values,sources}=D.resolve(configuration,'images');
    const keys=[category.labelKey,category.tagKey,category.subKey,category.scanKey];
    const effective=Object.fromEntries(keys.map(key=>[key,values[key]]));
    const signature=JSON.stringify(effective);
    const [draft,setDraft]=R.useState(effective),[busy,setBusy]=R.useState(false),[status,setStatus]=R.useState('');
    R.useEffect(()=>setDraft(effective),[signature]);
    const change=(key,value)=>setDraft(previous=>({...previous,[key]:value}));
    const source=sources[category.tagKey];
    const label=values[category.labelKey],tags=values[category.tagKey];
    async function save(){
      setBusy(true);setStatus('');
      try{
        const scan=draft[category.scanKey].trim().toLowerCase();
        if(scan&&!['breasts','ass','genitals','face'].includes(scan))throw Error('Lab target must be breasts, ass, genitals or face, or left blank.');
        const patch={};
        for(const key of keys)patch['images__'+key]=typeof draft[key]==='string'?draft[key].trim():draft[key];
        patch['images__'+category.labelKey]=patch['images__'+category.labelKey]||category.label;
        patch['images__'+category.scanKey]=scan;
        onSaved(await D.save(patch));setStatus('Category saved. Reload the performer page to refresh its images.');
      }catch(error){setStatus(error.message);}finally{setBusy(false);}
    }
    const nameId='lynx-image-category-'+category.slot;
    return h(Fold,{id:'images/category'+category.slot,title:label,note:tags?tags+(values[category.subKey]?' + subtags':''):'Manual selection only',search},
      h('div',{className:'lynx-p-editor lynx-p-image-category'},
        h('div',{className:'lynx-p-source'},'Category '+category.slot+' · '+(source==='recovered'?'Recovered previous category':source==='default'?'Starter category':'Custom category')),
        h('div',{className:'lynx-p-image-fields'},
          h('label',{htmlFor:nameId+'-label'},'Category name',h('input',{id:nameId+'-label',value:draft[category.labelKey],disabled:busy,onChange:e=>change(category.labelKey,e.target.value)})),
          h('label',{htmlFor:nameId+'-tags'},'Matching image tags',h('input',{id:nameId+'-tags',value:draft[category.tagKey],placeholder:category.tags,disabled:busy,onChange:e=>change(category.tagKey,e.target.value)}))),
        h('label',{className:'lynx-p-image-check'},h('input',{type:'checkbox',checked:draft[category.subKey],disabled:busy,onChange:e=>change(category.subKey,e.target.checked)}),'Include subtags'),
        h('p',null,'Use the name of a tag in your library. Include subtags also matches images tagged with its descendants. Multiple comma-separated tags are all required, not alternatives. Leave tags empty for manual selection only.'),
        h(Fold,{id:'images/lab'+category.slot,title:'Advanced: Supporting Image Lab',note:'Optional integration',search:false},
          h('label',null,'Lab scan target',h('input',{value:draft[category.scanKey],disabled:busy,placeholder:'Leave blank unless you use Supporting Image Lab',onChange:e=>change(category.scanKey,e.target.value)})),
          h('p',null,'Only used by the separate Supporting Image Lab integration. Valid targets: breasts, ass, genitals, face. Not required for tag matching or manual image selection.')),
        h('div',{className:'lynx-p-actions'},
          h('button',{type:'button',disabled:busy||JSON.stringify(draft)===signature,onClick:save},busy?'Saving…':'Save category'),
          h('button',{type:'button',disabled:busy,onClick:()=>{setDraft(effective);setStatus('');}},'Discard edits'),
          h('button',{type:'button',disabled:busy,onClick:()=>{setDraft({[category.labelKey]:category.label,[category.tagKey]:category.tags,[category.subKey]:true,[category.scanKey]:''});setStatus('Starter values loaded into this editor. Click Save category to apply.');}},'Use starter category')),
        h('small',{role:'status','aria-live':'polite'},status||'Saving changes only this category. Your manual image choices and crops are kept.')));
  }
  function SupportingSettings({configuration,onSaved,nativeSettings,catalog,search}){
    const resolved=D.resolve(configuration,'images').values;
    const matches=text=>!search||String(text).toLowerCase().includes(search)||'supporting images'.includes(search);
    const categories=D.imageCategories.filter(c=>matches([resolved[c.labelKey],resolved[c.tagKey],'categories matching image tags subtags'].join(' ')));
    const categoryKeys=new Set(D.imageCategories.flatMap(c=>[c.labelKey,c.tagKey,c.subKey,c.scanKey].map(key=>'images__'+key)));
    const controls=Object.entries(catalog).filter(([key,meta])=>meta.module==='images'&&!categoryKeys.has(key)&&nativeSettings.has(key)&&matches(meta.displayName+' '+meta.description));
    const groups=new Map();
    for(const [key,meta] of controls){
      const name=key.split('__')[1]||'',group=key==='images_enabled'?'Module':meta.group==='Card Preview'?'Card hover preview':/Slideshow|Transition|loopSlots/.test(name)?'Slideshow and animation':/Color|Opacity|Font/.test(name)?'Colors and text':'Panel layout';
      if(!groups.has(group))groups.set(group,[]);groups.get(group).push([key,meta]);
    }
    return h(R.Fragment,null,
      h('p',{className:'lynx-p-purpose'},'Six editable image categories. Open a category to change its title and matching tags. Empty categories remain available for manual image selection on the performer page.'),
      categories.length>0&&h(Fold,{id:'images/categories',title:'Image categories',note:categories.length+' categories',search},
        h('p',null,'Starter categories: Face, Breasts, Dressed, Ass, Body Type and Eyes. Existing custom categories take priority. Category numbers stay unchanged to preserve your chosen images.'),
        categories.map(category=>h(ImageCategory,{key:category.slot,category,configuration,onSaved,search}))),
      [...groups].map(([group,items])=>h(Fold,{key:group,id:'images/'+group,title:group,note:items.length+' settings',search},items.map(([key,meta])=>meta.type!=='STRING'?nativeSettings.get(key):h(Fold,{key,id:key,title:meta.displayName,search},h(Editor,{settingKey:key,meta,configuration,onSaved}))))));
  }
  function Panel({nativeSettings}){
    const [query,setQuery]=R.useState(''),[configuration,setConfiguration]=R.useState(null),[catalog,setCatalog]=R.useState(null),[error,setError]=R.useState('');
    const [rulesBusy,setRulesBusy]=R.useState(false),[rulesStatus,setRulesStatus]=R.useState('');
    R.useEffect(()=>{let active=true;Promise.all([D.configuration(),catalogPromise]).then(([config,meta])=>{if(active){setConfiguration(config);setCatalog(meta);}}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;};},[]);
    if(error)return h('div',{className:'lynx-p-settings'},h('p',{role:'alert'},error),[...nativeSettings.values()]);
    if(!configuration||!catalog)return h('p',null,'Loading Lynx settings…');
    const enabledRuleCount=attributeRuleKeys.filter(key=>configuration[ID]?.[key]===true).length;
    async function saveAttributeRules(enabled,onlyKey){
      if(rulesBusy)return;
      setRulesBusy(true);setRulesStatus('');
      try{
        const keys=onlyKey?[onlyKey]:attributeRuleKeys;
        if(keys.some(key=>!attributeRuleKeys.includes(key)))throw Error('Unknown attribute rule.');
        setConfiguration(await D.save(Object.fromEntries(keys.map(key=>[key,enabled]))));
        setRulesStatus(onlyKey?'Attribute rule saved.':enabled?'All 10 attribute rules enabled.':'All 10 attribute rules disabled.');
      }catch(error){setRulesStatus('Could not save: '+error.message);}finally{setRulesBusy(false);}
    }
    async function saveTransfer(patch){
      if(rulesBusy)return;
      setRulesBusy(true);setRulesStatus('');
      try{setConfiguration(await D.save(patch));setRulesStatus('Transfer settings saved. No library task was started.');}
      catch(error){setRulesStatus('Could not save: '+error.message);}finally{setRulesBusy(false);}
    }
    const current=configuration[ID]||{};
    const linkDefault={links__galleryToImages:true,links__imagesToGallery:false,links__galleryStudio:true};
    const transferGuide=h('div',{className:'lynx-p-transfer-guide'},
      h('h4',null,'What do you want to copy?'),
      h('p',null,'Performer Links copies people assigned to media. Tag Transfer copies labels. These are separate features.'),
      h('ul',null,
        h('li',null,h('strong',null,'People: '),'Gallery → its images: '+((current.links__galleryToImages??true)?'ON':'OFF')+' · Images → their galleries: '+(current.links__imagesToGallery?'ON':'OFF')+'. Automatic performer copying: '+(current.links_enabled&&current.links__automatic?'ON':'OFF')+'.'),
        h('li',null,h('strong',null,'Tags: '),'Automatic tag copying is '+(current.tags_enabled&&current.tags__automatic?'ON':'OFF')+'. Choose label-copying directions under Tag Transfer. Updating a performer may check all media linked to that performer, not the entire library.')),
      h('div',{className:'lynx-p-actions'},
        h('button',{type:'button',disabled:rulesBusy,onClick:()=>saveTransfer({links_enabled:true,links__automatic:true,links__galleryToImages:true,links__imagesToGallery:false})},'Set performer copying: Gallery → Images'),
        current.tags_enabled&&current.tags__automatic&&h('button',{type:'button',disabled:rulesBusy,onClick:()=>saveTransfer({tags__automatic:false})},'Turn off automatic tag copying')),
      h('small',null,'The performer preset does not change tags or studio inheritance. It only saves settings; it does not scan or update your library.'),
      h('p',{role:'status','aria-live':'polite'},rulesStatus));
    const quickActions=h('div',{className:'lynx-p-editor',style:{border:'1px solid #354151',borderRadius:'10px',padding:'1rem',margin:'1rem 0'}},
      h('h4',null,'Attribute rules — quick setup'),
      h('p',null,enabledRuleCount+' of '+attributeRuleKeys.length+' rules enabled. Enable them together, then switch off any individual rules you do not want.'),
      h('div',{className:'lynx-p-actions'},
        h('button',{type:'button',disabled:rulesBusy||enabledRuleCount===attributeRuleKeys.length,onClick:()=>saveAttributeRules(true)},rulesBusy?'Saving…':'Enable all attribute rules'),
        h('button',{type:'button',disabled:rulesBusy||enabledRuleCount===0,onClick:()=>saveAttributeRules(false)},'Disable all attribute rules')),
      h('p',null,'Includes nationality, ethnicity, hair color, eye color, body type, breast type, breast size, tattoos, piercings and age group. Your custom lists are kept.'),
      h('small',null,'Does not change automatic processing, tag creation/removal, measurement estimates, transfer routes or module switches. No tagging task is started.'),
      configuration[ID]?.attributes_enabled!==true&&h('p',{className:'lynx-p-warning'},'The Attributes module is disabled. Enable Performer Attributes and reload the page to use these rules.'),
      h('p',{role:'status','aria-live':'polite'},rulesStatus));
    const search=query.trim().toLowerCase();
    const sections=Object.entries(titles).map(([module,title])=>{
      if(module==='images'){
        const values=D.resolve(configuration,'images').values;
        const texts=Object.values(values).join(' ')+' supporting images categories matching image tags subtags '+Object.values(catalog).filter(meta=>meta.module==='images').map(meta=>meta.displayName+' '+meta.description).join(' ');
        if(search&&!texts.toLowerCase().includes(search))return null;
        return h(Fold,{key:module,id:module,title,note:configuration[ID]?.images_enabled===true?'Enabled':'Disabled',search},h(SupportingSettings,{configuration,onSaved:setConfiguration,nativeSettings,catalog,search}));
      }
      const entries=Object.entries(catalog).filter(([key,meta])=>meta.module===module&&(nativeSettings.has(key)||module==='attributes')&&(!search||(meta.displayName+' '+meta.description+' '+meta.group+' '+title).toLowerCase().includes(search)));
      if(!entries.length)return null;
      const enabled=configuration[ID]?.[module+'_enabled']===true,groups=new Map();
      for(const entry of entries){const group=entry[0].endsWith('_enabled')?'Module':entry[1].group;if(!groups.has(group))groups.set(group,[]);groups.get(group).push(entry);}
      return h(Fold,{key:module,id:module,title,note:enabled?'Enabled':'Disabled',search},h('p',{className:'lynx-p-purpose'},purposes[module]),[...groups].map(([group,items])=>h(Fold,{key:group,id:module+'/'+group,title:group,note:items.length+' settings',search},items.map(([key,meta])=>{
        const native=nativeSettings.get(key);
        if(module==='links'&&meta.type==='BOOLEAN')return h('div',{key,className:'lynx-p-editor'},
          h('label',null,h('input',{type:'checkbox',role:'switch',checked:current[key]??linkDefault[key]??false,disabled:rulesBusy,
            style:{width:'auto',marginRight:'.65rem'},onChange:event=>saveTransfer({[key]:event.target.checked})}),meta.displayName),h('p',null,meta.description));
        // Controlled switches stay synchronized after a bulk save. Unrelated native controls remain unchanged.
        if(attributeRuleKeys.includes(key))return h('div',{key,className:'lynx-p-editor'},
          h('label',null,h('input',{type:'checkbox',role:'switch',checked:configuration[ID]?.[key]===true,disabled:rulesBusy,
            style:{width:'auto',marginRight:'.65rem'},onChange:event=>saveAttributeRules(event.target.checked,key)}),meta.displayName),h('p',null,meta.description));
        if(meta.type!=='STRING')return native||null;
        const name=key.split('__')[1],resolved=module in {attributes:1,tags:1,links:1}?D.resolve(configuration,module):{values:{}};
        const value=String(resolved.values[name]??configuration[ID]?.[key]??'');
        return h(Fold,{key,id:key,title:meta.displayName,note:/Map$|Rules$|Choices$/.test(name)?value.split(';').filter(x=>x.trim()).length+' rules / choices':value?'Configured':'Not restricted',search},h(Editor,{settingKey:key,meta,configuration,onSaved:setConfiguration}));
      }))));
    });
    return h('section',{className:'lynx-p-settings'},h('h3',null,'Lynx Performer Suite'),h('p',null,'Choose a module, then open only the settings you need. Existing custom rules are kept. Starter lists are used when no custom list is saved.'),transferGuide,quickActions,configuration[ID]?.attributes__automatic&&h('p',{className:'lynx-p-warning'},'Automatic attribute processing is enabled. Preview your rules before updating performer metadata.'),h('label',null,'Find a setting',h('input',{type:'search',placeholder:'Country, hair, body type, transfer…',value:query,onChange:e=>setQuery(e.target.value)})),sections.some(Boolean)?sections:h('p',null,'No matching settings.'),h('p',{className:'lynx-p-footer'},'Preview first: use Attributes — Preview selected performers, Performer Links — Preview transfer, or Tag Transfer — Preview transfer in Tasks. Manual tag transfer can cover the library; manual performer transfer requires gallery IDs. Reload the page after changing a module switch.'));
  }
  api.patch.after('PluginSettings',(...args)=>{
    if(args[0]?.pluginID!==ID)return args.at(-1);
    const original=args.at(-1),settings=new Map();
    function isLegacy(element){return element.props.pluginID===ID&&element.props.settings instanceof Map;}
    function collect(element){
      if(!R.isValidElement(element))return;
      if(isLegacy(element)){for(const entry of element.props.settings)settings.set(...entry);return;}
      if(element.props.pluginID===ID&&element.props.setting){settings.set(element.props.setting.name,element);return;}
      R.Children.map(element.props.children,collect);
    }
    collect(original);if(!settings.size)return original;
    let inserted=false;
    function replace(element){
      if(!R.isValidElement(element))return element;
      if(isLegacy(element)||element.props.pluginID===ID&&element.props.setting){if(inserted)return null;inserted=true;return h(Panel,{key:'lynx-performer-settings',nativeSettings:settings});}
      return element.props.children?R.cloneElement(element,{},R.Children.map(element.props.children,replace)):element;
    }
    return replace(original);
  });
})();
