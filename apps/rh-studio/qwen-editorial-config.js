// RunningHub AI App 2104057271167791105 · snapshot realism · Skill 3.0.1 defaults.
// The screenshot-selected base checkpoint and both LoRA files are locked here.
// Unidentified flags and sampling parameters match the supplied RunningHub API sample.
const QWEN_EDITORIAL_APP_ID = '2104057271167791105';
const QWEN_EDITORIAL_BASE_MODEL = 'noctQUncensoredRealismBuiltOn_v40Base_bf16.safetensors';
const QWEN_EDITORIAL_LORA = 'cndamiph_Candid_Amateur_iPhone_Qwen21_v1.safetensors';
const QWEN_EDITORIAL_ASPECTS = Object.freeze([
  '1:1 (Square)', '2:3 (Portrait Photo)', '3:2 (Photo)',
  '3:4 (Portrait Standard)', '4:3 (Standard)',
  '9:16 (Portrait Widescreen)', '16:9 (Widescreen)', '21:9 (Ultrawide)'
]);
const QWEN_EDITORIAL_IMAGE_NODES = Object.freeze(['476','491','477','492','495','494']);
const QWEN_EDITORIAL_MEDIA = Object.freeze(Object.fromEntries(
  QWEN_EDITORIAL_IMAGE_NODES.map((nodeId,index)=>[
    'editorialImg'+nodeId,
    {nodeId,fieldName:'image',kind:'image',label:'参考图 '+(index+1),order:index+1}
  ])
));
function qwenEditorialBuildNodes(images=[], {prompt='',aspect='9:16 (Portrait Widescreen)'}={}){
  if(!Array.isArray(images) || images.length>6)throw new Error('最多支持 6 张参考图');
  if(!String(prompt).trim())throw new Error('请输入图片生成提示词');
  if(!QWEN_EDITORIAL_ASPECTS.includes(aspect))throw new Error('不支持的画幅比例');
  const node=(nodeId,fieldName,fieldValue)=>({
    nodeId:String(nodeId),fieldName,fieldValue:String(fieldValue),description:null
  });
  return [
    ...QWEN_EDITORIAL_IMAGE_NODES.map((nodeId,index)=>
      node(nodeId,'image',String(images[index]||'None').trim()||'None')
    ),
    node('497','prompt',String(prompt).trim()),
    node('528','value','true'),
    node('515','value','true'),
    node('13','aspect_ratio',aspect),
    node('521','value','false'),
    node('13','megapixels','2'),
    node('527','value','1'),
    node('510','lora_name','casual_snapshot_realism_qwen21.safetensors'),
    node('510','strength_model','0.8'),
    node('526','lora_name',QWEN_EDITORIAL_LORA),
    node('526','strength_model','0.5'),
    node('525','value','false'),
    node('554','text','以下为高级设置区，不懂请保持默认。\nAdvanced Settings Section. Leave as default if unsure.'),
    node('479','unet_name',QWEN_EDITORIAL_BASE_MODEL),
    node('484','sampler_name','er_sde'),
    node('484','scheduler','beta'),
    node('484','steps','40'),
    node('484','cfg','3.5')
  ];
}
