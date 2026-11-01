import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import test from 'node:test';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const context = {};
runInNewContext(read('apps/rh-studio/qwen-nsfw-config.js'), context);
const build = (images, options) => JSON.parse(JSON.stringify(runInNewContext(
  'qwenNsfwBuildNodes(' + JSON.stringify(images) + ',' + JSON.stringify(options) + ')', context
)));
const field = (nodes, id, name) =>
  nodes.find(n => n.nodeId === id && n.fieldName === name)?.fieldValue;
const images = ['ref1.png','ref2.png','ref3.png','ref4.png','ref5.png','ref6.png'];

test('the exact RunningHub API image node order and documented defaults', () => {
  const nodes = build(['openapi/first.png'], {prompt:'编辑图1的构图'});
  assert.equal(nodes.length, 18);
  assert.deepEqual(nodes.slice(0,6).map(n => n.nodeId), ['476','491','477','492','495','494']);
  assert.equal(field(nodes,'476','image'),'openapi/first.png');
  assert.equal(field(nodes,'491','image'),'None');
  assert.equal(field(nodes,'532','value'),'2.0000000000000004');
  assert.equal(field(nodes,'13','aspect_ratio'),'9:16 (Portrait Widescreen)');
  assert.equal(field(nodes,'521','value'),'false');
  assert.equal(field(nodes,'527','value'),'1');
  assert.equal(field(nodes,'515','value'),'false');
  assert.equal(field(nodes,'525','value'),'false');
  assert.equal(field(nodes,'528','value'),'true');
  assert.equal(field(nodes,'497','prompt'),'编辑图1的构图');
  assert.ok(nodes.every(n => n.description === null));
});

test('LoRA model names and weights remain fixed even when overridden in settings', () => {
  const nodes = build(images, {
    prompt:'保留人物身份',
    aspect:'3:4 (Portrait Standard)',
    lora1Name:'override.safetensors', lora1Strength:'0',
    lora2Name:'override.safetensors', lora2Strength:'0'
  });
  assert.equal(field(nodes,'534','lora_name'),'NSFW Qwen by TheseAlpacas V2.safetensors');
  assert.equal(field(nodes,'534','strength_model'),'0.8');
  assert.equal(field(nodes,'526','lora_name'),'Pornmaster_QI2.1_Breasts_Slider_V1.safetensors');
  assert.equal(field(nodes,'526','strength_model'),'1');
  assert.equal(field(nodes,'13','aspect_ratio'),'3:4 (Portrait Standard)');
  assert.deepEqual(nodes.slice(0,6).map(n => n.fieldValue), images);
});

test('required image, prompt, image count and aspect validation', () => {
  assert.throws(()=>build([], {prompt:'a'}), /图 1/);
  assert.throws(()=>build(['None'], {prompt:'a'}), /图 1/);
  assert.throws(()=>build(['img'], {prompt:''}), /提示词/);
  assert.throws(()=>build(['img'], {prompt:'x',aspect:'custom'}), /比例/);
  assert.throws(()=>build([...images,'extra.png'], {prompt:'x'}), /最多/);
  for(const aspect of [
    '1:1 (Square)','2:3 (Portrait Photo)','3:2 (Photo)','3:4 (Portrait Standard)',
    '4:3 (Standard)','9:16 (Portrait Widescreen)','16:9 (Widescreen)','21:9 (Ultrawide)'
  ]) {
    assert.equal(field(build(['img'], {prompt:'x',aspect}), '13','aspect_ratio'), aspect);
  }
});

test('workspace, script imports, shared media, task recovery and build are registered', () => {
  const html = read('apps/rh-studio/index.html');
  const app = read('apps/rh-studio/app.js');
  const runtime = read('apps/rh-studio/qwen-nsfw-runtime.js');
  const buildScript = read('apps/rh-studio/build.mjs');
  assert.match(html,/data-app="qwen-image-2-1-nsfw"/);
  assert.match(html,/id="workspaceQwenNsfw"/);
  for(const nodeId of ['476','491','477','492','495','494']) {
    assert.match(html,new RegExp('data-slot="nsfwImg'+nodeId+'"'));
  }
  const start = html.indexOf('id="workspaceQwenNsfw"');
  const end = html.indexOf('id="workspaceH3V2"',start);
  assert.ok(start > 0 && end > start);
  const workspace = html.slice(start,end);
  assert.match(workspace,/id="qwenNsfwAspectRatio"/);
  assert.match(workspace,/id="qwenNsfwPromptInput"/);
  assert.doesNotMatch(workspace,/id="qwenNsfwCount"|id="qwenNsfwQuality"|data-nsfw-lora-strength=/);
  assert.match(app,/qwenNsfw: 'qwen-image-2-1-nsfw'/);
  assert.match(app,/\[APP_KEYS\.qwenNsfw\]:/);
  assert.match(app,/QWEN_NSFW_MEDIA\[slot\]/);
  assert.match(runtime,/qwenNsfwRestoreMedia/);
  assert.match(runtime,/upsertHistory\(APP_KEYS\.qwenNsfw/);
  assert.match(runtime,/queryRH\(taskId\)/);
  assert.match(runtime,/runRHApp\(/);
  assert.match(buildScript,/qwen-nsfw-config\.js/);
  assert.match(buildScript,/qwen-nsfw-runtime\.js/);
});
