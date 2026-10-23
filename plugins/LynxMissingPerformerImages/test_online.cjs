const {test}=require('node:test'),assert=require('node:assert/strict');
const {Q,Review,safeImage,safeWebURL,onlineChoices,download,assign}=require('./missing_performer_images.js');
const png='data:image/png;base64,iVBORw0KGgo=';
test('unsafe image and source protocols are rejected',()=>{
  for(const value of ['javascript:alert(1)','file:///C:/x','data:image/svg+xml;base64,PHN2Zz4=','http://user:secret@example.com/x']){assert.equal(safeImage(value),'');assert.equal(safeWebURL(value),'');}
  assert.equal(safeImage(png),png);assert.equal(safeWebURL('https://example.com/p/1'),'https://example.com/p/1');
});
test('search results keep source identity, deduplicate photos and allow profile-only matches',()=>{
  const choices=onlineChoices([{name:'Alice',images:[png,png],urls:['javascript:x','https://example.com/alice']},{name:'Beth',urls:['https://example.com/beth']}],'Test source');
  assert.equal(choices.length,2);assert.equal(choices[0].name,'Alice');assert.equal(choices[0].provider,'Test source');assert.equal(choices[1].data,'');
});
test('online candidate result count is bounded',()=>assert.equal(onlineChoices(Array.from({length:100},(_,i)=>({name:'Person'+i,urls:['https://example.com/'+i]})),'Test').length,40));
test('only downloaded data is accepted when saving an online image',async()=>{
  assert.equal(await download({source:'online',data:png}),png);
  await assert.rejects(download({source:'online',data:'https://example.com/image.jpg'}),/Preview and load/);
});
test('scraped image assignment never imports name, tags or other metadata',async()=>{
  let update;
  const result=await assign(async(q,v)=>q===Q.check?{findPerformers:{performers:[{id:'42'}]}}:(update=v.input,{performerUpdate:{id:'42'}}),'42',{source:'online',data:png,name:'Wrong metadata',tags:['X']},download);
  assert.equal(result,'saved');assert.deepEqual(update,{id:'42',image:png});
});
test('online name search uses the typed name, never appends disambiguation, and performs no mutation',async()=>{
  const calls=[];global.fetch=async(url,options)=>{const body=JSON.parse(options.body);calls.push(body);return{ok:true,json:async()=>({data:{scrapeSinglePerformer:[{name:'Alice',images:[png]}]}})};};
  const review=Object.create(Review.prototype),m={pid:'1',abort:new AbortController(),online:{query:'Alice',source:'test',results:[],busy:false}};
  review.modal=m;review.sources=[{id:'test',name:'Test'}];review.renderModal=()=>{};
  await review.searchOnline();assert.equal(calls.length,1);assert.deepEqual(calls[0].variables,{source:{scraper_id:'test'},input:{query:'Alice'}});assert.equal(m.online.results.length,1);assert.equal(m.online.busy,false);assert(!calls[0].query.includes('mutation'));
});
test('closing the picker ignores a late online response',async()=>{
  let finish;global.fetch=async()=>({ok:true,json:()=>new Promise(resolve=>finish=resolve)});
  const review=Object.create(Review.prototype),m={pid:'1',abort:new AbortController(),online:{query:'Alice',source:'test',results:[],busy:false}};
  review.modal=m;review.renderModal=()=>{};const pending=review.searchOnline();await Promise.resolve();await Promise.resolve();review.modal=null;
  finish({data:{scrapeSinglePerformer:[{name:'Alice',images:[png]}]}});await pending;assert.deepEqual(m.online.results,[]);
});
test('empty library picker renders without an image and exposes online tab',()=>{
  const review=Object.create(Review.prototype);let html='';review.people=[{id:'1',name:'Alice'}];review.cards=new Map([['1',{choices:[],galleryLoaded:true}]]);review.modal={pid:'1',mode:'library',index:0,limit:24};
  review.dialog={querySelector:selector=>selector==='.mpi-dialog-content'?{set innerHTML(value){html=value;}}:null};review.renderModal();assert(html.includes('No library images available'));assert(html.includes('Find online / upload'));
});
test('online search failure provides a readable error without auto retry',async()=>{
  let calls=0;global.fetch=async()=>{calls++;return{ok:true,json:async()=>({errors:[{message:'Scraper dependency missing'}]})};};
  const review=Object.create(Review.prototype);review.modal={abort:new AbortController(),online:{query:'Alice',source:'test',results:[],busy:false}};review.renderModal=()=>{};await review.searchOnline();assert.equal(calls,1);assert(review.modal.online.status.includes('Scraper dependency missing'));
});
test('Use this image selects a candidate without calling the API or saving metadata',async()=>{
  let requests=0;global.fetch=async()=>{requests++;throw Error('Must not call API');};
  const review=Object.create(Review.prototype),candidate={source:'online',data:png,name:'Alice'};
  review.modal={pid:'1',online:{results:[candidate],selected:0}};review.cards=new Map([['1',{choices:[],checked:true}]]);
  review.dialog={close:()=>{}};review.renderCard=()=>{};review.updateToolbar=()=>{};
  await review.click({target:{closest:selector=>selector==='[data-action]'?{dataset:{action:'use-online'},closest:()=>null}:null}});
  assert.equal(requests,0);assert.equal(review.cards.get('1').choices[0],candidate);assert.equal(review.cards.get('1').status,'ready');assert.equal(review.cards.get('1').checked,false);
});
test('backend download handles operation output wrappers and forwards no performer metadata',async()=>{
  let args;global.fetch=async(url,options)=>{args=JSON.parse(options.body);return{ok:true,json:async()=>({data:{runPluginOperation:{output:JSON.stringify({image:png})}}})};};
  const review=Object.create(Review.prototype);
  assert.equal(await review.materialize({data:'https://example.com/a.jpg',name:'Alice'},{abort:new AbortController()}),png);
  assert.deepEqual(args.variables,{id:'missing_performer_images',args:{mode:'fetch_image',url:'https://example.com/a.jpg'}});
});
