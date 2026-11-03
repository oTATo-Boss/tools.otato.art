import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import test from 'node:test';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const config=read('apps/rh-studio/qwen-editorial-config.js');
const runtime=read('apps/rh-studio/qwen-editorial-runtime.js');
const build=(images,options)=>{
  const sandbox={};
  runInNewContext(config,sandbox);
  return JSON.parse(JSON.stringify(runInNewContext(
    'qwenEditorialBuildNodes('+JSON.stringify(images)+','+JSON.stringify(options)+')',sandbox
  )));
};
const field=(nodes,id,name)=>nodes.find(x=>x.nodeId===id&&x.fieldName===name)?.fieldValue;

test('24 API fields work with no reference image',()=>{
  const nodes=build([],{prompt:'high-contrast editorial portrait'});
  assert.equal(nodes.length,24);
  assert.deepEqual(nodes.slice(0,6).map(x=>x.nodeId),['476','491','477','492','495','494']);
  assert.ok(nodes.slice(0,6).every(x=>x.fieldValue==='None'));
  assert.equal(field(nodes,'497','prompt'),'high-contrast editorial portrait');
  assert.equal(field(nodes,'13','aspect_ratio'),'9:16 (Portrait Widescreen)');
  assert.equal(field(nodes,'13','megapixels'),'2');
  assert.equal(field(nodes,'527','value'),'1');
  for(const id of ['528','515'])assert.equal(field(nodes,id,'value'),'true');
  for(const id of ['521','525'])assert.equal(field(nodes,id,'value'),'false');
  assert.equal(field(nodes,'554','text'),'以下为高级设置区，不懂请保持默认。\nAdvanced Settings Section. Leave as default if unsure.');
  assert.equal(field(nodes,'484','sampler_name'),'er_sde');
  assert.equal(field(nodes,'484','scheduler'),'beta');
  assert.equal(field(nodes,'484','steps'),'40');
  assert.equal(field(nodes,'484','cfg'),'3.5');
  assert.ok(nodes.every(x=>x.description===null));
});

test('screenshot checkpoint and LoRA combination remain locked',()=>{
  const nodes=build(['example.png'],{prompt:'studio fashion',lora1Strength:0,lora2Name:'overridden'});
  assert.equal(field(nodes,'479','unet_name'),'noctQUncensoredRealismBuiltOn_v40Base_bf16.safetensors');
  assert.equal(field(nodes,'510','lora_name'),'casual_snapshot_realism_qwen21.safetensors');
  assert.equal(field(nodes,'510','strength_model'),'0.8');
  assert.equal(field(nodes,'526','lora_name'),'cndamiph_Candid_Amateur_iPhone_Qwen21_v1.safetensors');
  assert.equal(field(nodes,'526','strength_model'),'0.5');
  assert.equal(field(nodes,'476','image'),'example.png');
  assert.equal(field(nodes,'491','image'),'None');
});

test('six image order, aspect options and validation',()=>{
  const refs=Array.from({length:6},(_,i)=>'ref'+i+'.png');
  const nodes=build(refs,{prompt:'fashion',aspect:'3:4 (Portrait Standard)'});
  assert.deepEqual(nodes.slice(0,6).map(n=>n.fieldValue),refs);
  assert.equal(field(nodes,'13','aspect_ratio'),'3:4 (Portrait Standard)');
  assert.throws(()=>build([],{prompt:''}),/提示词/);
  assert.throws(()=>build(Array(7).fill('x'),{prompt:'yes'}),/6 张/);
  assert.throws(()=>build([],{prompt:'yes',aspect:'none'}),/比例/);
});

test('navigation, independent slots, shared media wiring and build assets',()=>{
  const html=read('apps/rh-studio/index.html');
  const app=read('apps/rh-studio/app.js');
  const pack=read('apps/rh-studio/build.mjs');
  assert.match(html,/data-app="qwen-image-2-1-editorial"/);
  assert.match(html,/id="workspaceQwenEditorial"/);
  for(const id of ['476','491','477','492','495','494'])
    assert.match(html,new RegExp('data-slot="editorialImg'+id+'"'));
  assert.match(html,/qwen-editorial-config\.js\?v=20261103-1/);
  assert.match(html,/qwen-editorial-runtime\.js\?v=20261103-1/);
  assert.ok(html.indexOf('qwen-editorial-config.js')<html.indexOf('qwen-editorial-runtime.js'));
  assert.ok(html.indexOf('qwen-editorial-runtime.js')<html.indexOf('./app.js?v=20261103-qwen-snapshot-1'));
  assert.match(app,/qwenEditorial: 'qwen-image-2-1-editorial'/);
  assert.match(app,/\[APP_KEYS\.qwenEditorial\]:/);
  assert.match(app,/QWEN_EDITORIAL_MEDIA\[slot\]/);
  assert.match(app,/qwenEditorialRestoreMedia\(\)/);
  assert.match(pack,/qwen-editorial-config\.js/);
  assert.match(pack,/qwen-editorial-runtime\.js/);
});

test('start button binds before app.js creates its dollar selector',async()=>{
  const listeners=new Map();
  const document={
    getElementById(id){return {addEventListener(kind,fn){listeners.set(id+':'+kind,fn);}};},
    querySelectorAll(){return [];}
  };
  let warning='',opened=false;
  runInNewContext(runtime,{
    document,apiKey:()=>'',toast:value=>{warning=value;},openSettings:()=>{opened=true;}
  });
  assert.equal(typeof listeners.get('qwenEditorialRunBtn:click'),'function');
  await listeners.get('qwenEditorialRunBtn:click')();
  assert.match(warning,/API Key/);
  assert.equal(opened,true);
});

test('clicking generate submits a text-only task with all six None images',async()=>{
  const listeners=new Map(),els=new Map();
  function el(id){
    if(!els.has(id))els.set(id,{
      value:'',textContent:'',innerHTML:'',disabled:false,
      addEventListener(type,fn){listeners.set(id+':'+type,fn);}
    });
    return els.get(id);
  }
  const document={getElementById:el,querySelectorAll:()=>[]};
  const $=selector=>el(selector.slice(1));
  el('qwenEditorialPromptInput').value='fashion campaign portrait';
  el('qwenEditorialAspectRatio').value='9:16 (Portrait Widescreen)';
  el('instanceType').value='default';
  let submitted=null,history=null;
  const ctx={
    document,$,state:{files:{}},APP_KEYS:{qwenEditorial:'qwen-image-2-1-editorial'},
    apiKey:()=> 'test-only-key',clearRuntimeTask:()=>{},
    clearInterval:()=>{},setInterval:()=>1,
    toast:()=>{},statusClass:()=>{},toMediaUrl:value=>value,
    instanceLabel:()=> '24G',failureHtml:()=>'',console:{warn:()=>{}},
    runRHApp:async(appId,nodes)=>{submitted={appId,nodes};return {taskId:'test-id',status:'QUEUED'};},
    uploadFile:async()=>{throw new Error('Unexpected upload in text-only mode');},
    upsertHistory:(appKey,task)=>{history={appKey,task};}
  };
  runInNewContext(config,ctx);
  runInNewContext(runtime,ctx);
  assert.equal(typeof listeners.get('qwenEditorialRunBtn:click'),'function');
  await listeners.get('qwenEditorialRunBtn:click')();
  assert.equal(submitted?.appId,'2104057271167791105');
  assert.equal(submitted?.nodes?.length,24);
  assert.ok(submitted.nodes.slice(0,6).every(n=>n.fieldValue==='None'));
  assert.equal(history?.task.taskId,'test-id');
  assert.equal(el('qwenEditorialRunBtn').disabled,false);
});

// Exercise the real app switch: new visitors get the app default, while saved global choices win.
test('Qwen defaults to Plus without replacing a saved global instance or other app defaults',()=>{
  const app=read('apps/rh-studio/app.js');
  const registry=app.slice(app.indexOf('const APPS ='),app.indexOf('const APP_KEYS ='));
  const switchApp=app.slice(app.indexOf('function setActiveApp('),app.indexOf('function renderAppFilter('));
  const elements=new Map();
  const $=key=>{if(!elements.has(key))elements.set(key,{value:'default',classList:{toggle(){}},textContent:''});return elements.get(key);};
  let saved=null;
  const context={$,
    $$:()=>[],state:{},APP_KEYS:{video:'minimax-h3',qwenEditorial:'qwen-image-2-1-editorial'},LS:{inst:'instance',active:'active'},
    localStorage:{getItem:()=>saved,setItem(){}},
    syncAutoGenerateAvailability(){},requestAnimationFrame(){}
  };
  runInNewContext(registry+switchApp,context);
  runInNewContext("setActiveApp('qwen-image-2-1-editorial')",context);
  assert.equal($('#instanceType').value,'plus');
  runInNewContext("setActiveApp('minimax-h3')",context);
  assert.equal($('#instanceType').value,'default');
  for(const choice of ['default','plus','ultra']){
    saved=choice;$('#instanceType').value=choice;
    runInNewContext("setActiveApp('qwen-image-2-1-editorial')",context);
    assert.equal($('#instanceType').value,choice);
  }
});
