// RunningHub AI App 2104225323949101057.
// These defaults are taken from the user's workflow API example.
const QWEN_NSFW_APP_ID = '2104225323949101057';
const QWEN_NSFW_ASPECTS = Object.freeze([
  '1:1 (Square)', '2:3 (Portrait Photo)', '3:2 (Photo)',
  '3:4 (Portrait Standard)', '4:3 (Standard)',
  '9:16 (Portrait Widescreen)', '16:9 (Widescreen)', '21:9 (Ultrawide)'
]);
const QWEN_NSFW_IMAGE_NODES = Object.freeze(['476','491','477','492','495','494']);
const QWEN_NSFW_MEDIA = Object.freeze(Object.fromEntries(
  QWEN_NSFW_IMAGE_NODES.map((nodeId, index) => [
    'nsfwImg' + nodeId,
    {nodeId, fieldName:'image', kind:'image', label:'参考图 ' + (index + 1), order:index + 1}
  ])
));
function qwenNsfwBuildNodes(images, {prompt='', aspect='9:16 (Portrait Widescreen)'}={}) {
  if (!Array.isArray(images) || !images.length || images.length > 6 ||
      !String(images[0] || '').trim() || images[0] === 'None') {
    throw new Error('请从参考图 1 开始上传，最多 6 张图片');
  }
  if (!String(prompt).trim()) throw new Error('请输入图片编辑提示词');
  if (!QWEN_NSFW_ASPECTS.includes(aspect)) throw new Error('不支持的图片比例');
  const node = (nodeId, fieldName, fieldValue) => ({
    nodeId:String(nodeId), fieldName, fieldValue:String(fieldValue), description:null
  });
  return [
    ...QWEN_NSFW_IMAGE_NODES.map((nodeId, index) =>
      node(nodeId, 'image', String(images[index] || '').trim() || 'None')
    ),
    node('532', 'value', '2.0000000000000004'),
    node('13', 'aspect_ratio', aspect),
    node('521', 'value', 'false'),
    node('527', 'value', '1'),
    node('534', 'lora_name', 'NSFW Qwen by TheseAlpacas V2.safetensors'),
    node('534', 'strength_model', '0.4'),
    node('526', 'lora_name', 'casual_snapshot_realism_qwen21.safetensors'),
    node('526', 'strength_model', '0.8'),
    node('515', 'value', 'false'),
    node('525', 'value', 'false'),
    node('528', 'value', 'true'),
    node('497', 'prompt', String(prompt).trim())
  ];
}
