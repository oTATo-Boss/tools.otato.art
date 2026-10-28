// RH Studio runtime for rh-minimax-h3 v4.0.0 / MiniMax H3 V2 beginner.
const h3V2State={
  task:null,poll:null,running:false,queryPending:false,
  outputUrl:'',outputSourceUrl:'',outputType:''
};
let h3V2DbPromise=null;
function h3V2ReadConfig(){
  const cfg={...H3V2_DEFAULTS};
  document.querySelectorAll('#workspaceH3V2 [data-h3-v2-field]').forEach(el=>{
    cfg[el.dataset.h3V2Field]=el.value;
  });
  return cfg;
}
function h3V2UpdateUI(){
  const prompt=$('#h3V2PromptInput'),count=$('#h3V2PromptCount');
  if(prompt&&count)count.textContent=String(prompt.value.length);
  const quality=$('#h3V2Quality');
  const custom=$('#h3V2CustomMPField');
  if(quality&&custom)custom.classList.toggle('hidden',quality.value!=='custom');
  const note=$('#h3V2QualityNote');
  if(note&&quality)note.textContent=quality.value==='custom'
    ?'自定义目标 MP；实际输出尺寸以文件为准'
    :'目标 '+(H3V2_QUALITIES[quality.value]||'?')+' MP · 不是固定输出宽高';
}
function h3V2LoadConfig(){
  let saved={};
  try{saved=JSON.parse(localStorage.getItem(LS.h3V2Config)||'{}')||{};}catch{}
  document.querySelectorAll('#workspaceH3V2 [data-h3-v2-field]').forEach(el=>{
    const name=el.dataset.h3V2Field;
    el.value=String(saved[name]??H3V2_DEFAULTS[name]??'');
    if(el.tagName==='SELECT'&&!el.value)el.value=String(H3V2_DEFAULTS[name]);
  });
  h3V2UpdateUI();
}
function h3V2SaveConfig(){
  localStorage.setItem(LS.h3V2Config,JSON.stringify(h3V2ReadConfig()));
  h3V2UpdateUI();
}
function h3V2Status(status,meta=''){
  const labels={IDLE:'等待生成',UPLOADING:'上传参考素材',SUBMITTING:'提交任务',
    QUEUED:'排队中',RUNNING:'生成中',SUCCESS:'生成完成',FAILED:'生成失败'};
  statusClass($('#h3V2StatusDot'),status);
  $('#h3V2StatusText').textContent=labels[status]||status;
  $('#h3V2TaskMeta').textContent=meta||'READY';
}
function h3V2SafeUrl(url){
  try{const x=new URL(String(url||''),window.location.href);
    return x.protocol==='https:'||x.protocol==='http:'?x.href:'';
  }catch{return '';}
}
function h3V2Download(url='',type=''){
  const safe=h3V2SafeUrl(url);
  h3V2State.outputSourceUrl=safe;
  h3V2State.outputUrl=safe?toMediaUrl(safe):'';
  h3V2State.outputType=String(type||'').toLowerCase();
  $('#h3V2DownloadBtn').disabled=!h3V2State.outputUrl;
}
function h3V2ExtraResults(task,primary){
  const box=$('#h3V2ExtraResults');
  box.replaceChildren();
  const extras=(Array.isArray(task?.results)?task.results:[])
    .filter(x=>x!==primary&&(x?.url||x?.text));
  box.classList.toggle('hidden',!extras.length);
  extras.forEach((item,index)=>{
    const url=h3V2SafeUrl(item.url);
    const el=document.createElement(url?'a':'span');
    el.textContent='结果 '+(index+2)+' · '+String(item.outputType||(item.text?'TXT':'FILE'));
    if(url){el.href=toMediaUrl(url);el.target='_blank';el.rel='noopener noreferrer';el.download='rh-studio-h3-v2-'+(index+2);}
    else if(item.text)el.title=String(item.text);
    box.appendChild(el);
  });
}
function renderH3V2Idle(){
  h3V2Status('IDLE');h3V2Download();
  $('#h3V2ExtraResults').classList.add('hidden');
  $('#h3V2ResultArea').innerHTML='<div class="empty-state"><div class="empty-mark">▶</div>'+
    '<strong>准备生成视频</strong><span>上传至少一张参考图片并输入提示词。</span></div>';
  $('#h3V2RunBtn').disabled=false;$('#h3V2RunLabel').textContent='开始生成';
}
function renderH3V2Loading(status,taskId){
  h3V2Status(status,taskId?'TASK · '+taskId:'PROCESSING');
  h3V2Download();$('#h3V2ExtraResults').classList.add('hidden');
  $('#h3V2ResultArea').innerHTML='<div class="loading-state"><div class="loading-mark"></div>'+
    '<strong>'+(status==='QUEUED'?'任务正在排队':status==='UPLOADING'?'正在上传素材':'视频正在生成')+'</strong>'+
    '<span>'+(status==='UPLOADING'?'完成上传后自动提交任务':'每 3 秒检查任务，刷新页面可以恢复')+'</span></div>';
  $('#h3V2RunBtn').disabled=!!h3V2State.running||!!h3V2State.poll||!!taskId;
  $('#h3V2RunLabel').textContent='生成中…';
}
function renderH3V2Success(task){
  const results=Array.isArray(task?.results)?task.results:[];
  const primary=results.find(isVideo)||results.find(isImage)||results[0];
  h3V2Status('SUCCESS',task?.taskId?'TASK · '+task.taskId:'DONE');
  h3V2Download(primary?.url,primary?.outputType);
  h3V2ExtraResults(task,primary);
  const area=$('#h3V2ResultArea');
  const url=h3V2SafeUrl(primary?.url);
  if(primary&&isVideo(primary)&&url){
    area.innerHTML='<video class="generated-video" src="'+esc(toMediaUrl(url))+
      '" controls playsinline preload="metadata"></video>';
    area.querySelector('video')?.addEventListener('error',()=>toast('视频已生成，但浏览器预览失败','bad'),{once:true});
  }else if(primary&&isImage(primary)&&url){
    area.innerHTML=generatedImageTag(url);
    bindGeneratedImageFallbacks(area);
  }else if(primary?.text){
    area.innerHTML='<pre class="h3-v2-text-output">'+esc(primary.text)+'</pre>';
  }else{
    area.innerHTML='<div class="empty-state"><div class="empty-mark">✓</div>'+
      '<strong>任务完成</strong><span>'+(url?'点击下载获得生成文件':'没有可预览的媒体')+'</span></div>';
  }
  $('#h3V2RunBtn').disabled=false;$('#h3V2RunLabel').textContent='开始生成';
}
function renderH3V2Failed(task,message){
  h3V2Status('FAILED',task?.taskId?'TASK · '+task.taskId:'ERROR');
  h3V2Download();$('#h3V2ExtraResults').classList.add('hidden');
  $('#h3V2ResultArea').innerHTML=failureHtml(task,message);
  $('#h3V2RunBtn').disabled=false;$('#h3V2RunLabel').textContent='重新生成';
}
async function runH3V2Task(){
  if(h3V2State.running||h3V2State.poll)return;
  if(!apiKey()){toast('请先在设置中保存 RunningHub API Key','bad');openSettings();return;}
  const config=h3V2ReadConfig();
  const selectedImages=Object.keys(H3V2_MEDIA).filter(slot=>H3V2_MEDIA[slot].kind==='image'&&state.files[slot]);
  const selectedAudios=Object.keys(H3V2_MEDIA).filter(slot=>H3V2_MEDIA[slot].kind==='audio'&&state.files[slot]);
  try{
    h3V2BuildNodes(selectedImages.map(x=>'pending:'+x),selectedAudios.map(x=>'pending:'+x),config);
  }catch(error){toast(error.message,'bad');return;}
  h3V2State.running=true;$('#h3V2RunBtn').disabled=true;
  clearRuntimeTask(APP_KEYS.h3BeginnerV2);h3V2State.task=null;h3V2Download();
  let startedSubmission=false;
  try{
    const uploaded=new Map();
    async function uploadSlot(slot){
      const file=state.files[slot];
      if(uploaded.has(file))return uploaded.get(file);
      const fileName=await uploadFile(file,apiKey());
      uploaded.set(file,fileName);
      return fileName;
    }
    const images=[],audios=[];
    const slots=[...selectedImages,...selectedAudios];
    for(let i=0;i<slots.length;i++){
      const slot=slots[i];
      renderH3V2Loading('UPLOADING');
      h3V2Status('UPLOADING',(i+1)+' / '+slots.length);
      const fileName=await uploadSlot(slot);
      if(H3V2_MEDIA[slot].kind==='image')images.push(fileName);else audios.push(fileName);
    }
    const nodeInfoList=h3V2BuildNodes(images,audios,config);
    renderH3V2Loading('SUBMITTING');h3V2Status('SUBMITTING','RUNNINGHUB');
    startedSubmission=true;
    const result=await runRHApp(APPS[APP_KEYS.h3BeginnerV2].appId,nodeInfoList,{instanceType:config.instance});
    startedSubmission=false;
    h3V2State.task=result;
    upsertHistory(APP_KEYS.h3BeginnerV2,result,{
      createdAt:Date.now(),prompt:String(config.prompt).slice(0,120),
      aspect:config.aspect.split(' ')[0],duration:config.duration+'s',
      quality:config.quality==='custom'?config.customMegapixels+' MP':config.quality,
      instance:instanceLabel(config.instance)
    });
    toast('视频生成任务已提交','good');
    if(result.status==='SUCCESS')renderH3V2Success(result);
    else if(result.status==='FAILED')renderH3V2Failed(result);
    else{
      h3V2State.poll=setInterval(()=>queryH3V2Task(result.taskId),3000);
      renderH3V2Loading(result.status||'RUNNING',result.taskId);
    }
  }catch(error){
    const message=startedSubmission
      ?'任务提交状态不明确：'+(error?.message||'网络错误')+'。请先在 RunningHub 核实，避免重复提交扣费。'
      :error?.message||'生成失败';
    renderH3V2Failed(h3V2State.task,message);toast(message,'bad');
  }finally{
    h3V2State.running=false;
    $('#h3V2RunBtn').disabled=!!h3V2State.poll;
    if(h3V2State.poll)$('#h3V2RunLabel').textContent='生成中…';
  }
}
async function queryH3V2Task(taskId){
  if(h3V2State.queryPending)return;
  h3V2State.queryPending=true;
  try{
    const data=await queryRH(taskId);
    h3V2State.task=data;upsertHistory(APP_KEYS.h3BeginnerV2,data,{taskId});
    if(data.status==='SUCCESS'||data.status==='FAILED'){
      clearInterval(h3V2State.poll);h3V2State.poll=null;
      if(data.status==='SUCCESS'){renderH3V2Success(data);toast('视频生成完成','good');}
      else{renderH3V2Failed(data);toast('视频生成失败','bad');}
    }else renderH3V2Loading(data.status||'RUNNING',data.taskId||taskId);
  }catch(error){
    h3V2Status('RUNNING','查询异常，等待重试 · TASK '+taskId);
    console.warn('[RH_H3_V2_QUERY]',String(error?.message||'查询失败'));
  }finally{h3V2State.queryPending=false;}
}
function h3V2OpenDb(){
  if(h3V2DbPromise)return h3V2DbPromise;
  if(!('indexedDB' in window))return Promise.reject(new Error('浏览器不支持 IndexedDB'));
  h3V2DbPromise=new Promise((resolve,reject)=>{
    const req=indexedDB.open('rhstudio-minimax-h3-v2-materials',1);
    req.onupgradeneeded=()=>req.result.createObjectStore('media',{keyPath:'slot'});
    req.onsuccess=()=>resolve(req.result);
    req.onerror=()=>{h3V2DbPromise=null;reject(req.error);};
  });
  return h3V2DbPromise;
}
async function h3V2SaveMedia(slot,file){
  if(!H3V2_MEDIA[slot])return;
  const db=await h3V2OpenDb();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction('media','readwrite');tx.objectStore('media').put({slot,file});
    tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);
  });
}
async function h3V2RemoveMedia(slot){
  if(!H3V2_MEDIA[slot])return;
  const db=await h3V2OpenDb();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction('media','readwrite');tx.objectStore('media').delete(slot);
    tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);
  });
}
async function h3V2ClearAllMedia(){
  const db=await h3V2OpenDb();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction('media','readwrite');tx.objectStore('media').clear();
    tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);
  });
}
async function h3V2RestoreMedia(){
  const db=await h3V2OpenDb();
  const records=await new Promise((resolve,reject)=>{
    const req=db.transaction('media').objectStore('media').getAll();
    req.onsuccess=()=>resolve(req.result||[]);req.onerror=()=>reject(req.error);
  });
  records.forEach(({slot,file})=>{
    if(!H3V2_MEDIA[slot]||!file||state.files[slot])return;
    state.files[slot]=file;
    if(file.type.startsWith('image/')||file.type.startsWith('video/')){
      state.objectUrls[slot]=URL.createObjectURL(file);
    }
    renderFileSlot(slot);
  });
}
document.querySelectorAll('#workspaceH3V2 [data-h3-v2-field]').forEach(el=>{
  el.addEventListener('input',h3V2SaveConfig);
  el.addEventListener('change',h3V2SaveConfig);
});
document.querySelectorAll('#workspaceH3V2 .upload-slot[data-slot]').forEach(el=>{
  el.addEventListener('dragover',event=>{event.preventDefault();el.classList.add('drag-over');});
  el.addEventListener('dragleave',()=>el.classList.remove('drag-over'));
  el.addEventListener('drop',event=>{
    event.preventDefault();el.classList.remove('drag-over');
    const file=Array.from(event.dataTransfer?.files||[])[0];if(!file)return;
    const expected=H3V2_MEDIA[el.dataset.slot]?.kind;
    if(mediaKindFromFile(file)!==expected)return toast('文件类型与输入槽不匹配','bad');
    setFile(el.dataset.slot,file);
  });
});
$('#h3V2RunBtn')?.addEventListener('click',runH3V2Task);
$('#h3V2DownloadBtn')?.addEventListener('click',()=>triggerDownload(
  h3V2State,$('#h3V2DownloadBtn'),'rh-studio-minimax-h3-v2'
));
