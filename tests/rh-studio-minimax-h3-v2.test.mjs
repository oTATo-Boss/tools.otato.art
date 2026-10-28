import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import test from 'node:test';

const config=readFileSync(new URL('../apps/rh-studio/minimax-h3-v2-config.js',import.meta.url),'utf8');
const context={};
runInNewContext(config,context);
const build=(images,audios,settings={})=>JSON.parse(JSON.stringify(
  runInNewContext('h3V2BuildNodes('+JSON.stringify(images)+','+JSON.stringify(audios)+','+JSON.stringify(settings)+')',context)
));
const node=(nodes,id,field)=>nodes.find(x=>x.nodeId===id&&x.fieldName===field)?.fieldValue;
const prompt={prompt:'夜色中人物走过街口，镜头跟随，光影交替。'};

test('exact Skill v4.0.0 node count, names, defaults and six input nodes',()=>{
  const nodes=build(['openapi/img1.png'],[],prompt);
  assert.equal(nodes.length,25);
  assert.deepEqual(nodes.slice(0,6).map(x=>x.nodeId),['438','435','437','439','431','429']);
  assert.equal(node(nodes,'827','value'),'1');
  for(const id of ['438','435','437','439','431','429'])assert.equal(node(nodes,id,'image'),'openapi/img1.png');
  assert.equal(node(nodes,'841','audio'),'None');
  assert.equal(node(nodes,'842','audio'),'None');
  assert.equal(node(nodes,'804','value'),'15');
  assert.equal(node(nodes,'456','text'),prompt.prompt);
  assert.equal(node(nodes,'462','aspect_ratio'),'9:16 (Portrait Widescreen)');
  assert.equal(node(nodes,'462','megapixels'),'1.0');
  assert.equal(node(nodes,'774','unet_name'),'minimax_h3_hybrid_fl2va_ref2va_b25-49-int8_r.safetensors');
  assert.equal(node(nodes,'881','value'),'true');
  assert.equal(node(nodes,'824','value'),'false');
  assert.equal(node(nodes,'813','lora_name'),'MysticXXX_MMH3-V5.1.safetensors');
  assert.equal(node(nodes,'813','strength_model'),'0.4');
  assert.equal(node(nodes,'817','lora_name'),'Minimax-H3-Digicam-Realism Improve Lora.safetensors');
  assert.equal(node(nodes,'817','strength_model'),'0.5');
  assert.equal(node(nodes,'815','lora_name'),'h3-realism-people-t2v-i2v-r2v_new.safetensors');
  assert.equal(node(nodes,'815','strength_model'),'0.5');
  assert.equal(node(nodes,'888','lora_name'),'H3电影感V2.safetensors');
  assert.equal(node(nodes,'888','strength_model'),'0.5');
  assert.equal(node(nodes,'816','text'),'dynv2,r34l1sm');
  assert.ok(nodes.every(x=>x.description===null));
});

test('two or six images count is actual, unused slots duplicate last, optional audio works',()=>{
  const nodes=build(['openapi/one.png','openapi/two.png'],['openapi/voice.mp3'],prompt);
  assert.equal(node(nodes,'827','value'),'2');
  assert.equal(node(nodes,'438','image'),'openapi/one.png');
  for(const id of ['435','437','439','431','429'])assert.equal(node(nodes,id,'image'),'openapi/two.png');
  assert.equal(node(nodes,'841','audio'),'openapi/voice.mp3');
  assert.equal(node(nodes,'842','audio'),'None');
  const six=build(Array.from({length:6},(_,i)=>'openapi/'+i+'.png'),['a.wav','b.wav'],prompt);
  assert.equal(node(six,'827','value'),'6');
  assert.equal(node(six,'429','image'),'openapi/5.png');
  assert.equal(node(six,'842','audio'),'b.wav');
});

test('resolution quality and manual instance validation honor Skill 4.0.0',()=>{
  const base=['openapi/x.png'];
  assert.equal(node(build(base,[],{...prompt,quality:'480P'}),'462','megapixels'),'0.5');
  assert.equal(node(build(base,[],{...prompt,quality:'1080P',instance:'ultra'}),'462','megapixels'),'2.0');
  assert.equal(node(build(base,[],{...prompt,quality:'custom',customMegapixels:'1.3'}),'462','megapixels'),'1.3');
  assert.throws(()=>build(base,[],{...prompt,quality:'1080P',instance:'plus'}),/Ultra/);
  assert.throws(()=>build(base,[],{...prompt,quality:'custom',customMegapixels:'2',instance:'default'}),/Ultra/);
});

test('advanced LoRA, triggers, switches, durations and aspect stay within this app',()=>{
  const nodes=build(['a.png'],[],{...prompt,
    duration:'7',aspect:'21:9 (Ultrawide)',lora1Name:'custom.safetensors',
    lora1Strength:'0.6',trigger:'new-trigger',versionSwitch:'false',outputFormat:'zip'});
  assert.equal(node(nodes,'804','value'),'7');
  assert.equal(node(nodes,'462','aspect_ratio'),'21:9 (Ultrawide)');
  assert.equal(node(nodes,'813','lora_name'),'custom.safetensors');
  assert.equal(node(nodes,'813','strength_model'),'0.6');
  assert.equal(node(nodes,'816','text'),'new-trigger');
  assert.equal(node(nodes,'881','value'),'false');
  assert.equal(node(nodes,'824','value'),'true');
});

test('required image and prompt, 5–15 sec, audio count and numeric validation',()=>{
  const cases=[
    [[],[],prompt], [['x.png'],[],{prompt:' '}],
    [['x.png'],[],{...prompt,duration:'4'}],
    [['x.png'],[],{...prompt,duration:'16'}],
    [['x.png'],[],{...prompt,duration:'7.5'}],
    [['x.png'],[],{...prompt,aspect:'wrong'}],
    [['x.png'],[],{...prompt,quality:'custom',customMegapixels:'0.01'}],
    [['x.png'],[],{...prompt,lora2Strength:'NaN'}],
    [['x.png'],['a','b','c'],prompt],
    [Array.from({length:7},()=> 'x.png'),[],prompt]
  ];
  for(const args of cases)assert.throws(()=>build(...args));
});

test('site integration, app isolation, persistence, history and build assets',()=>{
  const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
  const app=read('apps/rh-studio/app.js');
  const html=read('apps/rh-studio/index.html');
  const pack=read('apps/rh-studio/build.mjs');
  const runtime=read('apps/rh-studio/minimax-h3-v2-runtime.js');
  assert.match(app,/appId:'2101232638873858050'/);
  assert.match(app,/h3BeginnerV2: 'minimax-h3-beginner-v2'/);
  assert.match(app,/\[APP_KEYS\.h3BeginnerV2\]:/);
  assert.match(app,/h3V2RestoreMedia\(\)/);
  assert.match(app,/H3V2_MEDIA\[slot\]/);
  assert.match(html,/data-app="minimax-h3-beginner-v2"/);
  assert.match(html,/id="workspaceH3V2"/);
  for(const id of ['438','435','437','439','431','429'])assert.match(html,new RegExp('data-slot="h3v2Img'+id+'"'));
  for(const id of ['841','842'])assert.match(html,new RegExp('data-slot="h3v2Audio'+id+'"'));
  assert.match(html,/minimax-h3-v2-config\.js\?v=/);
  assert.match(html,/minimax-h3-v2-runtime\.js\?v=/);
  assert.match(pack,/minimax-h3-v2-config\.js/);
  assert.match(pack,/minimax-h3-v2-runtime\.js/);
  assert.match(runtime,/upsertHistory\(APP_KEYS\.h3BeginnerV2/);
  assert.match(runtime,/runRHApp\(APPS\[APP_KEYS\.h3BeginnerV2\]\.appId/);
  assert.match(html,/data-app="minimax-h3-long"/);
  assert.match(html,/data-app="minimax-h3-multi-fast"/);
});
