import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import test from 'node:test';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const app=read('apps/rh-studio/app.js');
const registry=app.slice(app.indexOf('const APPS ='),app.indexOf('const RH_UPLOAD_DIRECT'));
const expected=['minimax-h3-beginner-v2','minimax-h3-long','qwen-image-2-1-editorial'];

test('only one image app and two video apps are registered and navigable',()=>{
  const sandbox={};runInNewContext(registry,sandbox);
  const apps=JSON.parse(JSON.stringify(runInNewContext('APPS',sandbox)));
  assert.deepEqual(Object.keys(apps).sort(),expected);
  assert.equal(Object.values(apps).filter(x=>x.type==='image').length,1);
  assert.equal(Object.values(apps).filter(x=>x.type==='video').length,2);
  const html=read('apps/rh-studio/index.html');
  const buttons=Array.from(html.matchAll(/<button[^>]*class="app-item[^>]*data-app="([^"]+)"/g),m=>m[1]);
  assert.deepEqual(buttons.sort(),expected);
  assert.equal(Array.from(html.matchAll(/class="workspace app-workspace/g)).length,3);
});

test('retired applications cannot be resumed by runtime recovery',()=>{
  const source=app.slice(app.indexOf('function runtimeViews()'),app.indexOf('function restoreRuntimeTasks('));
  const sandbox={};runInNewContext(registry,sandbox);
  for(const match of source.matchAll(/(?:state|renderLoading|renderSuccess|renderFailed|query):([A-Za-z0-9_]+)/g))sandbox[match[1]]=()=>{};
  runInNewContext(source,sandbox);
  assert.deepEqual(Array.from(runInNewContext('Object.keys(runtimeViews()).sort()',sandbox)),expected);
});

test('saved materials fill the active retained workspace by kind and position',async()=>{
  const source=app.slice(app.indexOf('async function fillSavedMaterials()'),app.indexOf('function clearFile('));
  const assigned=[];
  const sandbox={MATERIAL_LIBRARY:[{id:'image1',targetSlot:'img141',kind:'image'},{id:'image2',targetSlot:'img142',kind:'image'},{id:'audio1',targetSlot:'audio144',kind:'audio'},{id:'video1',targetSlot:'video164',kind:'video'}],
    materialState:{records:{image1:'a',image2:'b',audio1:'c',video1:'d'}},
    ensureMaterialLibrary:async()=>{},fileFromMaterialRecord:value=>value,
    activeWorkspaceUploadSlots:()=>[{slot:'h3v2Img1',config:{kind:'image'}},{slot:'h3v2Img2',config:{kind:'image'}},{slot:'h3v2Audio1',config:{kind:'audio'}}],
    setFile:(slot,file)=>assigned.push([slot,file]),toast(){},openMaterialSettings(){}
  };
  runInNewContext(source,sandbox);
  await runInNewContext('fillSavedMaterials()',sandbox);
  assert.deepEqual(assigned,[['h3v2Img1','a'],['h3v2Img2','b'],['h3v2Audio1','c']]);
});

test('retired app links do not import their task into a different app',()=>{
  const setup=app.slice(app.indexOf('const params ='),app.indexOf('const initialApp ='));
  for(const [key,expectedTask] of [['image-2mp',null],['qwen-image-2-1-editorial','old-task']]){
    const sandbox={URLSearchParams,window:{location:{search:'?app='+key+'&task=old-task'}}};
    runInNewContext(registry+setup,sandbox);
    assert.equal(runInNewContext('recoveryTaskId || null',sandbox),expectedTask);
  }
});
