// Source: oTATo-Boss/my-skills/skills/video/ai/rh-minimax-h3 v4.0.0 (2026-10-28).
// RunningHub MiniMax-H3 多图生视频自动提示词 V2－小白全能版 / AI App 2101232638873858050.
const H3V2_IMAGE_IDS=['438','435','437','439','431','429'];
const H3V2_AUDIO_IDS=['841','842'];
const H3V2_MEDIA=Object.fromEntries([
  ...H3V2_IMAGE_IDS.map((nodeId,i)=>['h3v2Img'+nodeId,{nodeId,fieldName:'image',kind:'image',label:'参考图 '+(i+1),order:i+1}]),
  ...H3V2_AUDIO_IDS.map((nodeId,i)=>['h3v2Audio'+nodeId,{nodeId,fieldName:'audio',kind:'audio',label:'音频 '+(i+1),order:i+1}])
]);
const H3V2_QUALITIES=Object.freeze({'480P':'0.5','720P':'1.0','1080P':'2.0'});
const H3V2_ASPECTS=[
  '1:1 (Square)','2:3 (Portrait Photo)','3:2 (Photo)','3:4 (Portrait Standard)',
  '4:3 (Standard)','9:16 (Portrait Widescreen)','16:9 (Widescreen)','21:9 (Ultrawide)'
];
const H3V2_DEFAULTS=Object.freeze({
  prompt:'',duration:'15',aspect:'9:16 (Portrait Widescreen)',quality:'720P',customMegapixels:'1',
  instance:'plus',
  lora1Name:'MysticXXX_MMH3-V5.1.safetensors',lora1Strength:'0.4',
  lora2Name:'Minimax-H3-Digicam-Realism Improve Lora.safetensors',lora2Strength:'0.5',
  lora3Name:'h3-realism-people-t2v-i2v-r2v_new.safetensors',lora3Strength:'0.5',
  lora4Name:'H3电影感V2.safetensors',lora4Strength:'0.5',
  trigger:'dynv2,r34l1sm',versionSwitch:'true',outputFormat:'video'
});
// Snapshot of reference/node_map.json: preserve the entire app-specific node list.
const H3V2_NODE_MAP=Object.freeze([
  ['438','image','None'],['435','image','None'],['437','image','None'],
  ['439','image','None'],['431','image','None'],['429','image','None'],
  ['827','value','1'],['841','audio','None'],['842','audio','None'],
  ['462','aspect_ratio','9:16 (Portrait Widescreen)'],['462','megapixels','1.0'],
  ['804','value','15'],['881','value','true'],['456','text',''],
  ['774','unet_name','minimax_h3_hybrid_fl2va_ref2va_b25-49-int8_r.safetensors'],
  ['813','lora_name','MysticXXX_MMH3-V5.1.safetensors'],['813','strength_model','0.4'],
  ['817','lora_name','Minimax-H3-Digicam-Realism Improve Lora.safetensors'],['817','strength_model','0.5'],
  ['815','lora_name','h3-realism-people-t2v-i2v-r2v_new.safetensors'],['815','strength_model','0.5'],
  ['888','lora_name','H3电影感V2.safetensors'],['888','strength_model','0.5'],
  ['816','text','dynv2,r34l1sm'],['824','value','false']
]);
function h3V2BuildNodes(images,audios,values={}){
  const cfg={...H3V2_DEFAULTS,...values};
  if(!String(cfg.prompt).trim())throw new Error('请输入视频提示词');
  if(!Array.isArray(images)||images.length<1||images.length>6||images.some(x=>typeof x!=='string'||!x.trim())){
    throw new Error('须提供 1–6 张图片，纯文生未验证');
  }
  if(!Array.isArray(audios)||audios.length>2||audios.some(x=>typeof x!=='string'||!x.trim())){
    throw new Error('最多支持 2 段参考音频');
  }
  if(!H3V2_ASPECTS.includes(cfg.aspect))throw new Error('画面比例不在当前工作流支持范围内');
  const seconds=Number(cfg.duration);
  if(!/^\d+$/.test(String(cfg.duration))||seconds<5||seconds>15)throw new Error('视频时长为 5–15 秒');
  const mp=cfg.quality==='custom'?Number(cfg.customMegapixels):Number(H3V2_QUALITIES[cfg.quality]);
  if(!Number.isFinite(mp)||mp<0.1||mp>16)throw new Error('目标百万像素须在 0.1–16 MP 之间');
  if(!['default','plus','ultra'].includes(cfg.instance))throw new Error('实例类型无效');
  if(mp>=2&&cfg.instance!=='ultra')throw new Error('2 MP 及以上必须手动选择 Ultra (84G)');
  if(!['true','false'].includes(cfg.versionSwitch))throw new Error('节点 881 的值必须为 true 或 false');
  if(!['video','zip'].includes(cfg.outputFormat))throw new Error('输出格式配置无效');
  const nodes=H3V2_NODE_MAP.map(([nodeId,fieldName,fieldValue])=>({
    nodeId,fieldName,fieldValue,description:null
  }));
  const set=(id,field,value)=>{
    const item=nodes.find(x=>x.nodeId===id&&x.fieldName===field);
    if(!item)throw new Error('节点映射缺失：'+id+'/'+field);
    item.fieldValue=String(value);
  };
  H3V2_IMAGE_IDS.forEach((id,index)=>set(id,'image',images[index]||images[images.length-1]));
  set('827','value',images.length);
  H3V2_AUDIO_IDS.forEach((id,index)=>set(id,'audio',audios[index]||'None'));
  set('456','text',String(cfg.prompt).trim());
  set('804','value',seconds);
  set('462','aspect_ratio',cfg.aspect);
  set('462','megapixels',cfg.quality==='custom'?String(mp):H3V2_QUALITIES[cfg.quality]);
  set('881','value',cfg.versionSwitch);
  set('824','value',String(cfg.outputFormat==='zip'));
  [['813',1],['817',2],['815',3],['888',4]].forEach(([id,index])=>{
    const name=String(cfg['lora'+index+'Name']||'').trim();
    const weightText=String(cfg['lora'+index+'Strength']);
    const weight=Number(weightText);
    if(!name)throw new Error('LoRA '+index+' 模型名不能为空');
    if(!weightText.trim()||!Number.isFinite(weight)||weight<-100||weight>100){
      throw new Error('LoRA '+index+' 强度必须为 -100–100 的有限数值');
    }
    set(id,'lora_name',name);
    set(id,'strength_model',weightText);
  });
  set('816','text',cfg.trigger);
  return nodes;
}
