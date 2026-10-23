/* LynxTheme: grouped performer header. Preserve native components and callbacks. */
(() => {
  'use strict';
  const api=window.PluginApi,R=api?.React;
  if(!R||!api.patch||window.__lynxGroupedPerformerDetails)return;
  window.__lynxGroupedPerformerDetails=true;
  const h=R.createElement;
  const appearance=new Set(['hair_color','eye_color','height','weight','measurements','fake_tits','tattoos','piercings','penis_length','circumcised']);
  const profile=new Set(['gender','age','country','ethnicity','career_length','death_date']);
  function hasValue(value){return value!=null&&value!==false&&value!==''&&!(typeof value==='string'&&['','none','na'].includes(value.trim().toLowerCase()));}
  function formatValue(value){
    if(typeof value!=='string'||/\d/.test(value)||value!==value.toUpperCase()||value===value.toLowerCase()||['BBW','SSBBW','USA','US','UK','EU'].includes(value))return value;
    return value[0]+value.slice(1).toLowerCase();
  }
  function countryRow(element,performer){
    const nativeFlag=element.props.value;
    if(!R.isValidElement(nativeFlag))return element;
    const iso=String(performer.country||'').trim();let name=iso;
    try{if(/^[A-Z]{2}$/i.test(iso)&&typeof Intl.DisplayNames==='function')name=new Intl.DisplayNames(['en'],{type:'region'}).of(iso.toUpperCase())||iso;}catch{}
    return R.cloneElement(element,{value:h('span',{className:'lynx-performer-country'},
      R.cloneElement(nativeFlag,{includeName:false,includeOverlay:false,className:'lynx-performer-country-flag'}),h('span',null,name))});
  }
  function buildLayout(original,performer){
    const groups={profile:[],appearance:[],tags:[],ids:[],other:[]};
    R.Children.toArray(original.props.children).forEach(element=>{
      if(!R.isValidElement(element)){if(element)groups.other.push(element);return;}
      const id=element.props.id;
      if(id){
        if(!hasValue(element.props.value)&&!element.props.showEmpty)return;
        if(id==='country')element=countryRow(element,performer);
        else if(['gender','ethnicity','hair_color','eye_color','fake_tits'].includes(id))element=R.cloneElement(element,{value:formatValue(element.props.value)});
        if(id==='fake_tits')element=R.cloneElement(element,{label:'Breast Type'});
        const group=id==='tags'?'tags':id==='stash_ids'?'ids':profile.has(id)?'profile':appearance.has(id)?'appearance':'other';
        groups[group].push(element);
      }else groups.other.push(element);
    });
    const box=(key,title,content)=>h('section',{key,className:'lynx-performer-box lynx-performer-box--'+key,'aria-label':title},
      h('h3',{className:'lynx-performer-box-title'},title),h('div',{className:'lynx-performer-field-grid'},content),
      key==='appearance'&&h('div',{className:'lynx-performer-managed-slot'}));
    return h('div',{className:'detail-group lynx-performer-panel'},
      groups.profile.length>0&&box('profile','Profile',groups.profile),box('appearance','Appearance',groups.appearance),
      groups.tags.length>0&&box('tags','Tags',groups.tags),
      groups.ids.length>0&&h('details',{className:'lynx-performer-stash-ids'},h('summary',null,'Stash IDs'),groups.ids),
      groups.other.length>0&&h('div',{className:'lynx-performer-other-details'},groups.other));
  }
  function HeaderLayout({original,performer,fullWidth}){
    const anchor=R.useRef(null),[active,setActive]=R.useState(false);
    R.useLayoutEffect(()=>{
      const inHeader=!!anchor.current?.closest('#performer-page .detail-header');
      setActive(previous=>previous===inHeader?previous:inHeader);
    },[performer?.id,fullWidth]);
    R.useLayoutEffect(()=>{
      if(active&&!fullWidth)document.dispatchEvent(new CustomEvent('lynx:performer-detail-layout'));
    },[active,fullWidth,performer?.id]);
    return h(R.Fragment,null,active&&!fullWidth?buildLayout(original,performer):original,h('span',{ref:anchor,hidden:true}));
  }
  api.patch.after('PerformerDetailsPanel.DetailGroup',(...args)=>{
    const props=args[0]||{},original=args.at(-1);
    if(!props.performer||!R.isValidElement(original))return original;
    return h(HeaderLayout,{original,performer:props.performer,fullWidth:props.fullWidth});
  });
})();
