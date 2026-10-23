/* Shared suite settings: retain native elements, values and save callbacks. */
(() => {
  'use strict';
  const api = window.PluginApi;
  if (!api?.React || !api.patch || window.__LynxScrapingSuiteSettings) return;
  window.__LynxScrapingSuiteSettings = true;
  const R = api.React;
  const bundles = new Set(['LynxScrapingSuite']);
  const sections = {
    LynxTheme: [['Appearance',''],['Scene Cards','cards__'],['Enhanced Cards','enhanced__'],['Compatibility','compat__']],
    LynxPerformerSuite: [['Performer Attributes','attributes__'],['Tag Transfer','tags__'],['Performer Links','links__'],['Supporting Images','images__']],
    LynxTools: [['Scene Context Menu','sceneMenu__'],['Gallery Context Menu','galleryMenu__'],['Image Context Menu','imageMenu__'],['Performer Context Menu','performerMenu__'],['Tag Context Menu','tagMenu__'],['Settings Context Menu','settingsMenu__'],['Image Cropper','crop__'],['VR Viewer','vr__']],
    LynxScrapingSuite: [['Mature.nl','mature__'],['XL Girls','xl__']],
    LynxRenamer: [['Renaming & Safety','']]
  };
  function Panel({pluginID, settings = new Map()}) {
    if (!(settings instanceof Map)) settings = new Map(Array.isArray(settings) ? settings : []);
    const [query,setQuery] = R.useState('');
    const used = new Set();
    let remembered={};try{remembered=JSON.parse(localStorage.getItem('lynx-suite-settings-open-v1')||'{}');}catch{}
    const fold=(key)=>({open:query?true:!!remembered[pluginID+'/'+key],onToggle:event=>{if(query)return;remembered[pluginID+'/'+key]=event.currentTarget.open;localStorage.setItem('lynx-suite-settings-open-v1',JSON.stringify(remembered));}});
    const matches = element => {
      const meta = element.props.setting;
      return !query || `${meta.display_name||meta.displayName||''} ${meta.description||''}`.toLowerCase().includes(query.toLowerCase());
    };
    const cards = sections[pluginID].map(([title,prefix]) => {
      const switches={'attributes__':'attributes_enabled','tags__':'tags_enabled','links__':'links_enabled','images__':'images_enabled','cards__':'cards_enabled','enhanced__':'enhanced_enabled','compat__':'compat_enabled','crop__':'crop_enabled','vr__':'vr_enabled','xl__':'xl_enabled'};
      const toggle=switches[prefix]||(prefix.endsWith('__')?prefix.slice(0,-2)+'_enabled':null);
      const content = [...settings].filter(([key]) => prefix ? key.startsWith(prefix)||key===toggle : !key.includes('__')&&!key.endsWith('_enabled')||key==='theme_enabled');
      content.forEach(([key])=>used.add(key));
      const visible = content.filter(([,element])=>matches(element));
      if(!visible.length)return null;
      const control=([key,element])=>{
          const isLong = /Map$|Rules$|Choices$|Field$|Allow$|Tags$|configJson$/.test(key);
          if(!isLong)return element;
          const meta=element.props.setting;
          return R.createElement('details',{key,className:'lynx-suite-editor',...fold(key)},
            R.createElement('summary',null,meta.display_name||meta.displayName||key),element);
        };
      let controls=visible.map(control);
      if(prefix==='attributes__'||prefix==='images__'){
        const groups=new Map();
        for(const entry of visible){
          const key=entry[0].split('__').pop();
          let group='Automation & Safety';
          if(prefix==='images__')group=/slot(\d)/.test(key)?'Image Category '+key.match(/slot(\d)/)[1]:/cardPreview/.test(key)?'Card Preview':'Panel Appearance & Behaviour';
          else if(/country/i.test(key))group='Country';
          else if(/ethnicity/i.test(key))group='Ethnicity';
          else if(/hair|eyes/i.test(key))group='Hair & Eyes';
          else if(/body|shape/i.test(key))group='Body Type';
          else if(/breast|bust|cup/i.test(key))group='Breast Type & Size';
          else if(/tattoo|inked|piercing/i.test(key))group='Tattoos & Piercings';
          else if(/age/i.test(key)&&!/^manage/.test(key))group='Age';
          if(!groups.has(group))groups.set(group,[]);groups.get(group).push(entry);
        }
        controls=[...groups].map(([group,entries])=>R.createElement('details',{key:group,className:'lynx-suite-editor',...fold(prefix+group)},R.createElement('summary',null,group),entries.map(control)));
      }
      return R.createElement('details',{key:prefix||title,className:'lynx-suite-section',...fold(prefix||title)},
        R.createElement('summary',null,title,R.createElement('span',{className:'lynx-suite-count'},`${visible.length} settings`)),
        R.createElement('div',{className:'lynx-suite-controls'},controls));
    });
    const remaining=[...settings].filter(([key])=>!used.has(key)).filter(([,element])=>matches(element));
    if(remaining.length)cards.push(R.createElement('details',{key:'other',className:'lynx-suite-section',open:query?true:undefined},
      R.createElement('summary',null,'Modules & Advanced'),remaining.map(([,element])=>element)));
    return R.createElement('section',{className:'lynx-suite-settings'},
      R.createElement('p',{className:'lynx-suite-note'},'Open a section to edit its settings. Preview before applying bulk changes. Module changes require a page reload.'),
      R.createElement('label',{className:'lynx-suite-search'},'Find a setting',
        R.createElement('input',{type:'search',value:query,placeholder:'Search settings…',onChange:e=>setQuery(e.target.value)})),
      cards.some(Boolean)?cards:R.createElement('p',null,'No matching settings.'));
  }
  api.patch.after('PluginSettings',(...args)=>{
    const original=args[args.length-1], pluginID=args[0]?.pluginID;
    if(!bundles.has(pluginID))return original;
    const settings=new Map();
    function collect(element){
      if(!R.isValidElement(element))return;
      if(element.props.pluginID===pluginID && element.props.setting){settings.set(element.props.setting.name,element);return;}
      R.Children.map(element.props.children,collect);
    }
    collect(original);
    if(!settings.size)return original;
    let inserted=false;
    function replace(element){
      if(!R.isValidElement(element))return element;
      if(element.props.pluginID===pluginID && element.props.setting){
        if(inserted)return null;
        inserted=true;
        return R.createElement(Panel,{key:'lynx-suite-settings',pluginID,settings});
      }
      if(!element.props.children)return element;
      return R.cloneElement(element,{},R.Children.map(element.props.children,replace));
    }
    return replace(original);
  });
})();
