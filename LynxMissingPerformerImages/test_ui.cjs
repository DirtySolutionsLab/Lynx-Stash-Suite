// Offline tests: node --test test_ui.cjs. No connection to Stash.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {Q,ranked,all,getCandidates,getGalleryCandidates,assign,esc}=require('./missing_performer_images.js');
const image=(id,w=800,h=1200)=>({id:String(id),files:[{width:w,height:h}],paths:{image:'/image/'+id+'/image'}});
test('portraits, resolution, stable ID and deduplication',()=>{
  assert.deepEqual(ranked([image(1,3000,2000),image(3),image(2),image(4,1600,2400),image(2)]).map(i=>i.id),['4','2','3','1']);
});
test('missing image metadata is excluded',()=>assert.equal(ranked([{id:'1',files:[],paths:{}},image(2)]).length,1));
test('HTML from metadata is escaped',()=>assert.equal(esc('<img src="x">&'), '&lt;img src=&quot;x&quot;&gt;&amp;'));
test('paginated retrieval covers all results before writes',async()=>{
  const items=Array.from({length:205},(_,i)=>({id:String(i)}));
  const got=await all(async(q,v)=>({findPerformers:{count:205,performers:items.slice((v.page-1)*100,v.page*100)}}),Q.missing,'findPerformers','performers');
  assert.equal(got.length,205);
});
test('direct candidate lookup does not request galleries',async()=>{
  const got=await getCandidates(async(q,v)=>{assert.equal(q,Q.images);assert.deepEqual(v.criteria.performers.value,['9']);return {findImages:{count:1,images:[image(1)]}};},'9');
  assert.equal(got[0].source,'direct');
});
test('gallery candidates are sorted and do not duplicate direct candidates',async()=>{
  const got=await getGalleryCandidates(async(q,v)=>q===Q.galleries?{findGalleries:{count:1,galleries:[{id:'4'}]}}:{findImages:{count:3,images:[image(1),image(2),image(3,2000,3000)]}},'9',[image(1)]);
  assert.deepEqual(got.map(i=>i.id),['3','2']);assert.ok(got.every(i=>i.source==='gallery'));
});
test('existing image blocks both download and mutation',async()=>{
  let downloads=0;const result=await assign(async(q)=>{assert.equal(q,Q.check);return {findPerformers:{performers:[]}};},'9',image(1),async()=>downloads++);
  assert.equal(result,'protected');assert.equal(downloads,0);
});
test('image added during download blocks update',async()=>{
  let checks=0;const result=await assign(async(q)=>{assert.equal(q,Q.check);return {findPerformers:{performers:checks++ ? [] : [{id:'9'}]}};},'9',image(1),async()=>'data:image/jpeg;base64,x');
  assert.equal(result,'protected');assert.equal(checks,2);
});
test('only approved performer and image are updated',async()=>{
  const calls=[];const result=await assign(async(q,v)=>{calls.push([q,v]);return q===Q.check?{findPerformers:{performers:[{id:'9'}]}}:{performerUpdate:{id:'9'}};},'9',image(1),async()=>'data:image/jpeg;base64,x');
  assert.equal(result,'saved');assert.equal(calls.length,3);assert.deepEqual(calls[2][1],{input:{id:'9',image:'data:image/jpeg;base64,x'}});
});
test('download failure causes no mutation',async()=>{
  const calls=[];await assert.rejects(assign(async(q)=>{calls.push(q);return {findPerformers:{performers:[{id:'9'}]}};},'9',image(1),async()=>{throw Error('download');}),/download/);assert.deepEqual(calls,[Q.check]);
});
test('failed final check causes no mutation',async()=>{
  let checks=0;await assert.rejects(assign(async(q)=>{assert.equal(q,Q.check);if(checks++)throw Error('check');return {findPerformers:{performers:[{id:'9'}]}};},'9',image(1),async()=>'data'),/check/);
});
test('ambiguous mutation failure is not retried',async()=>{
  let updates=0;await assert.rejects(assign(async(q)=>{if(q===Q.check)return {findPerformers:{performers:[{id:'9'}]}};updates++;throw Error('timeout');},'9',image(1),async()=>'data'),/timeout/);assert.equal(updates,1);
});
