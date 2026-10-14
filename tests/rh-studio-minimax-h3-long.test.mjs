import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import test from 'node:test';

const js = readFileSync(new URL('../apps/rh-studio/minimax-h3-long.js', import.meta.url), 'utf8');
const context = {
  document:{getElementById:()=>null, querySelectorAll:()=>[]},
  window:{location:{href:'https://tools.otato.art/rh-studio/'}},
};
runInNewContext(js, context);
const build = (uploads, values) =>
  runInNewContext('longH3BuildNodes(' + JSON.stringify(uploads) + ',' + JSON.stringify(values) + ')', context)
    .map(row => JSON.parse(JSON.stringify(row)));
const node = (items, id, name) => items.find(item => item.nodeId === id && item.fieldName === name);

test('six image nodes and exact application defaults', () => {
  const nodes = build({longH3Img28:'openapi/test.jpg'}, {prompt:'镜头内容'});
  assert.equal(nodes.length, 19);
  assert.deepEqual(nodes.slice(0,6).map(item=>item.nodeId), ['28','273','285','436','462','463']);
  assert.equal(nodes[0].fieldValue,'openapi/test.jpg');
  assert.equal(nodes[1].fieldValue,'None');
  assert.equal(node(nodes,'426','aspect_ratio').fieldValue,'16:9 (Widescreen)');
  assert.equal(node(nodes,'426','megapixels').fieldValue,'0.5');
  assert.equal(node(nodes,'291','value').fieldValue,'35');
  assert.equal(node(nodes,'59','prompt').fieldValue,'镜头内容');
  assert.equal(node(nodes,'446','lora_name').fieldValue,'MysticXXX-ref2va-V4.safetensors');
  assert.equal(node(nodes,'446','strength_model').fieldValue,'0.4000000000000001');
  assert.equal(node(nodes,'444','lora_name').fieldValue,'HMNSFW-AIO-V2.5.safetensors');
  assert.equal(node(nodes,'444','strength_model').fieldValue,'0.5000000000000001');
  assert.equal(node(nodes,'443','lora_name').fieldValue,'H3_Motion_BoosterV2.safetensors');
  assert.equal(node(nodes,'443','strength_model').fieldValue,'0.6000000000000001');
  assert.equal(node(nodes,'393','value').fieldValue,'false');
  assert.equal(node(nodes,'272','value').fieldValue,'false');
  assert.equal(node(nodes,'442','text').fieldValue,'dynv2,');
});
test('custom aspect, duration, megapixels, and advanced values remain isolated', () => {
  const nodes = build({},{
    prompt:'35 秒的长镜头', aspect:'9:16 (Portrait Widescreen)',
    duration:'70', megapixels:'1.0',strength446:'0.7',
    flag393:'true',text442:'custom,'
  });
  assert.equal(node(nodes,'426','aspect_ratio').fieldValue,'9:16 (Portrait Widescreen)');
  assert.equal(node(nodes,'291','value').fieldValue,'70');
  assert.equal(node(nodes,'426','megapixels').fieldValue,'1.0');
  assert.equal(node(nodes,'446','strength_model').fieldValue,'0.7');
  assert.equal(node(nodes,'393','value').fieldValue,'true');
  assert.equal(node(nodes,'442','text').fieldValue,'custom,');
});
test('invalid prompt, duration, pixels, and ratio fail before upload', () => {
  for (const values of [
    {prompt:' '},{prompt:'test', duration:'0'},
    {prompt:'test', duration:'3.5'},{prompt:'test',megapixels:'0'},
    {prompt:'test',aspect:'unknown'}
  ]) assert.throws(()=>build({},values));
});
