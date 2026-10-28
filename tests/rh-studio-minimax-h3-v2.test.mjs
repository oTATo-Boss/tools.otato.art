import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import test from 'node:test';

const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const config=read('apps/rh-studio/minimax-h3-v2-config.js');
const context={};
runInNewContext(config,context);
const build=(images,audios,settings={})=>JSON.parse(JSON.stringify(
  runInNewContext('h3V2BuildNodes('+JSON.stringify(images)+','+JSON.stringify(audios)+','+JSON.stringify(settings)+')',context)
));
const validateGlobal=(quality,instance)=>runInNewContext(
  'h3V2ValidateGlobalInstance('+JSON.stringify(quality)+','+JSON.stringify(instance)+')',context
);
const node=(nodes,id,field)=>nodes.find(x=>x.nodeId===id&&x.fieldName===field)?.fieldValue;
const prompt={prompt:'夜色中人物走过街口，镜头跟随，光影交替。'};

test('25 node Skill snapshot, image reuse and default video parameters',()=>{
  const nodes=build(['openapi/image.png'],[],prompt);
  assert.equal(nodes.length,25);
  assert.deepEqual(nodes.slice(0,6).map(x=>x.nodeId),['438','435','437','439','431','429']);
  for(const id of ['438','435','437','439','431','429'])assert.equal(node(nodes,id,'image'),'openapi/image.png');
  assert.equal(node(nodes,'827','value'),'1');
  assert.equal(node(nodes,'841','audio'),'None');
  assert.equal(node(nodes,'842','audio'),'None');
  assert.equal(node(nodes,'804','value'),'15');
  assert.equal(node(nodes,'456','text'),prompt.prompt);
  assert.equal(node(nodes,'462','aspect_ratio'),'9:16 (Portrait Widescreen)');
  assert.equal(node(nodes,'462','megapixels'),'1.0');
  assert.ok(nodes.every(x=>x.description===null));
});

test('multiple images are compressed; audio is optional',()=>{
  const nodes=build(['image1.png','image2.png'],['audio1.wav'],prompt);
  assert.equal(node(nodes,'827','value'),'2');
  assert.equal(node(nodes,'438','image'),'image1.png');
  for(const id of ['435','437','439','431','429'])assert.equal(node(nodes,id,'image'),'image2.png');
  assert.equal(node(nodes,'841','audio'),'audio1.wav');
  assert.equal(node(nodes,'842','audio'),'None');
  const six=build(Array.from({length:6},(_,i)=>'img'+i+'.png'),['a','b'],prompt);
  assert.equal(node(six,'827','value'),'6');
  assert.equal(node(six,'429','image'),'img5.png');
  assert.equal(node(six,'842','audio'),'b');
});

test('Skill v4 LoRAs, trigger and workflow flags remain fixed even with legacy saved values',()=>{
  const nodes=build(['a.png'],[],{...prompt,lora1Name:'changed.safetensors',
    lora1Strength:'97',lora2Name:'changed.safetensors',lora2Strength:'-3',
    lora3Name:'changed.safetensors',lora3Strength:'-4',
    lora4Name:'changed.safetensors',lora4Strength:'99',
    trigger:'different',versionSwitch:'false',outputFormat:'zip'});
  const fixed=[
    ['813','MysticXXX_MMH3-V5.1.safetensors','0.4'],
    ['817','Minimax-H3-Digicam-Realism Improve Lora.safetensors','0.5'],
    ['815','h3-realism-people-t2v-i2v-r2v_new.safetensors','0.5'],
    ['888','H3电影感V2.safetensors','0.5']
  ];
  for(const [id,name,weight] of fixed){
    assert.equal(node(nodes,id,'lora_name'),name);
    assert.equal(node(nodes,id,'strength_model'),weight);
  }
  assert.equal(node(nodes,'816','text'),'dynv2,r34l1sm');
  assert.equal(node(nodes,'881','value'),'true');
  assert.equal(node(nodes,'824','value'),'false');
  assert.equal(node(nodes,'774','unet_name'),'minimax_h3_hybrid_fl2va_ref2va_b25-49-int8_r.safetensors');
});

test('resolution has exactly three quality presets and global instance safety',()=>{
  const images=['a.png'];
  for(const [quality,mp] of [['480P','0.5'],['720P','1.0'],['1080P','2.0']]){
    assert.equal(node(build(images,[],{...prompt,quality}),'462','megapixels'),mp);
  }
  assert.throws(()=>build(images,[],{...prompt,quality:'custom'}),/480P/);
  assert.throws(()=>build(images,[],{...prompt,quality:'4K'}),/480P/);
  assert.doesNotThrow(()=>validateGlobal('480P','default'));
  assert.doesNotThrow(()=>validateGlobal('720P','plus'));
  assert.doesNotThrow(()=>validateGlobal('1080P','ultra'));
  assert.throws(()=>validateGlobal('1080P','default'),/全局设置/);
  assert.throws(()=>validateGlobal('1080P','plus'),/全局设置/);
});

test('duration, aspect and required input bounds',()=>{
  const nodes=build(['x.png'],[],{...prompt,duration:'6',aspect:'21:9 (Ultrawide)'});
  assert.equal(node(nodes,'804','value'),'6');
  assert.equal(node(nodes,'462','aspect_ratio'),'21:9 (Ultrawide)');
  const invalid=[
    [[],[],prompt],[['x.png'],[],{prompt:''}],
    [['x.png'],[],{...prompt,duration:'4'}],
    [['x.png'],[],{...prompt,duration:'16'}],
    [['x.png'],[],{...prompt,duration:'7.5'}],
    [['x.png'],[],{...prompt,aspect:'unknown'}],
    [['x.png'],['a','b','c'],prompt],
    [Array.from({length:7},()=> 'x'),[],prompt]
  ];
  for(const args of invalid)assert.throws(()=>build(...args));
});

test('UI exposes exactly aspect, resolution, duration; global settings controls instance',()=>{
  const html=read('apps/rh-studio/index.html');
  const app=read('apps/rh-studio/app.js');
  const runtime=read('apps/rh-studio/minimax-h3-v2-runtime.js');
  const pack=read('apps/rh-studio/build.mjs');
  const start=html.indexOf('id="workspaceH3V2"');
  const end=html.indexOf('id="workspaceLongH3"',start);
  assert.ok(start>0&&end>start);
  const workspace=html.slice(start,end);
  assert.deepEqual([...workspace.matchAll(/data-h3-v2-field="([^"]+)"/g)].map(x=>x[1]),
    ['prompt','aspect','quality','duration']);
  assert.deepEqual([...workspace.matchAll(/<option value="(480P|720P|1080P)"/g)].map(x=>x[1]),
    ['480P','720P','1080P']);
  assert.doesNotMatch(workspace,/h3V2Instance|h3-v2-advanced|h3V2CustomMPField|h3V2QualityNote|运行实例/);
  assert.match(runtime,/const instanceType=\$\('#instanceType'\)\.value/);
  assert.match(runtime,/runRHApp\(APPS\[APP_KEYS\.h3BeginnerV2\]\.appId,nodeInfoList,\{instanceType\}\)/);
  assert.match(app,/appId:'2101232638873858050'/);
  assert.match(app,/\[APP_KEYS\.h3BeginnerV2\]:/);
  assert.match(app,/H3V2_MEDIA\[slot\]/);
  assert.match(html,/data-app="minimax-h3-beginner-v2"/);
  assert.match(html,/data-app="minimax-h3-long"/);
  assert.match(html,/data-app="minimax-h3-multi-fast"/);
  assert.match(pack,/minimax-h3-v2-config\.js/);
  assert.match(pack,/minimax-h3-v2-runtime\.js/);
});


test('H3 V2 duration uses the shared video slider with live value and saved configuration',()=>{
  const html=read('apps/rh-studio/index.html');
  const runtime=read('apps/rh-studio/minimax-h3-v2-runtime.js');
  const css=read('apps/rh-studio/style.css');
  const start=html.indexOf('id="workspaceH3V2"');
  const end=html.indexOf('id="workspaceLongH3"',start);
  assert.ok(start>0&&end>start);
  const workspace=html.slice(start,end);
  assert.match(workspace,/class="duration-control"/);
  assert.match(workspace,/class="duration-head"/);
  assert.match(workspace,/class="duration-scale"/);
  assert.match(workspace,/id="h3V2DurationValue">15s/);
  assert.match(workspace,/<input id="h3V2DurationRange" data-h3-v2-field="duration" type="range" min="5" max="15" step="1" value="15">/);
  assert.doesNotMatch(workspace,/data-h3-v2-field="duration" type="number"/);
  assert.match(runtime,/el.addEventListener\('input',h3V2SaveConfig\)/);
  assert.match(runtime,/localStorage.setItem\(LS.h3V2Config,JSON.stringify\(h3V2ReadConfig\(\)\)\)/);
  assert.match(css,/\.duration-control input\[type="range"\]/);
  const updateSource=runtime.match(/function h3V2UpdateUI\(\)\{[\s\S]*?\n\}/)?.[0];
  assert.ok(updateSource);
  const slider={min:'5',max:'15',value:'7',style:{}};
  const display={textContent:''};
  const prompt={value:'prompt'};
  const counter={textContent:''};
  const elements={
    '#h3V2PromptInput':prompt,
    '#h3V2PromptCount':counter,
    '#h3V2DurationRange':slider,
    '#h3V2DurationValue':display
  };
  const $=selector=>elements[selector]??null;
  runInNewContext(updateSource+'\nh3V2UpdateUI();',{$});
  assert.equal(display.textContent,'7s');
  assert.match(slider.style.background,/20%/);
  assert.equal(counter.textContent,'6');
  slider.value='15';
  runInNewContext(updateSource+'\nh3V2UpdateUI();',{$});
  assert.equal(display.textContent,'15s');
  assert.match(slider.style.background,/100%/);
});
