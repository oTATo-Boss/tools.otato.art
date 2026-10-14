// Minimax-H3 无限长视频自动提示词-小白全能版 — independent RH adapter
const LONG_H3_IMAGE_NODES = ['28', '273', '285', '436', '462', '463'];
const LONG_H3_MEDIA = Object.fromEntries(LONG_H3_IMAGE_NODES.map((nodeId, index) => [
  'longH3Img' + nodeId,
  { nodeId, fieldName:'image', kind:'image', label:'参考图 ' + (index + 1), order:index + 1 }
]));
const LONG_H3_DEFAULTS = Object.freeze({
  prompt:'', aspect:'16:9 (Widescreen)', megapixels:'0.5', duration:'35',
  strength446:'0.4', strength444:'0.5', strength443:'0.6',
  text442:'dynv2,', flag393:'false', flag272:'false'
});
const longH3State = {
  task:null, poll:null, running:false, queryPending:false,
  outputUrl:'', outputSourceUrl:'', outputType:''
};
let longH3DBPromise = null;

function longH3ReadConfig() {
  const value = {...LONG_H3_DEFAULTS};
  document.querySelectorAll('#workspaceLongH3 [data-long-h3-field]').forEach(input => {
    value[input.dataset.longH3Field] = input.value;
  });
  return value;
}
function longH3LoadConfig() {
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(LS.longH3Config) || '{}') || {}; } catch {}
  document.querySelectorAll('#workspaceLongH3 [data-long-h3-field]').forEach(input => {
    const field = input.dataset.longH3Field;
    input.value = String(saved[field] ?? LONG_H3_DEFAULTS[field] ?? '');
    if (input.tagName === 'SELECT' && !input.value) input.value = String(LONG_H3_DEFAULTS[field]);
  });
  longH3UpdatePromptCount();
}
function longH3SaveConfig() {
  localStorage.setItem(LS.longH3Config, JSON.stringify(longH3ReadConfig()));
  longH3UpdatePromptCount();
}
function longH3UpdatePromptCount() {
  const input = document.getElementById('longH3PromptInput');
  const count = document.getElementById('longH3PromptCount');
  if (input && count) count.textContent = String(input.value.length);
}
function longH3BuildNodes(uploads, fields) {
  const s = {...LONG_H3_DEFAULTS, ...fields};
  if (!String(s.prompt).trim()) throw new Error('请输入视频提示词');
  const allowed = [
    '1:1 (Square)', '2:3 (Portrait Photo)', '3:2 (Photo)', '3:4 (Portrait Standard)',
    '4:3 (Standard)', '9:16 (Portrait Widescreen)', '16:9 (Widescreen)', '21:9 (Ultrawide)'
  ];
  if (!allowed.includes(s.aspect)) throw new Error('画面比例不在工作流支持范围内');
  const duration = Number(s.duration);
  if (!/^[0-9]+$/.test(String(s.duration)) || !Number.isSafeInteger(duration) || duration < 1) {
    throw new Error('时长必须是大于 0 的整数');
  }
  if (!Number.isFinite(Number(s.megapixels)) || Number(s.megapixels) <= 0) {
    throw new Error('像素参数必须是大于 0 的数字');
  }
  for (const field of ['strength446', 'strength444', 'strength443']) {
    if (String(s[field]).trim() === '' || !Number.isFinite(Number(s[field]))) {
      throw new Error('LoRA 权重必须是有效数字');
    }
  }
  if (!['true', 'false'].includes(String(s.flag393)) || !['true', 'false'].includes(String(s.flag272))) {
    throw new Error('节点布尔参数不合法');
  }
  const make = (nodeId, fieldName, value) => ({
    nodeId:String(nodeId), fieldName, fieldValue:String(value), description:null
  });
  const nodes = Object.entries(LONG_H3_MEDIA).map(([slot, info]) =>
    make(info.nodeId, info.fieldName, uploads?.[slot] || 'None')
  );
  nodes.push(make('426','aspect_ratio',s.aspect));
  nodes.push(make('426','megapixels',s.megapixels));
  nodes.push(make('291','value',s.duration));
  nodes.push(make('393','value',s.flag393));
  nodes.push(make('59','prompt',String(s.prompt).trim()));
  nodes.push(make('446','lora_name','MysticXXX-ref2va-V4.safetensors'));
  nodes.push(make('446','strength_model',String(s.strength446)==='0.4' ? '0.4000000000000001' : s.strength446));
  nodes.push(make('444','lora_name','HMNSFW-AIO-V2.5.safetensors'));
  nodes.push(make('444','strength_model',String(s.strength444)==='0.5' ? '0.5000000000000001' : s.strength444));
  nodes.push(make('443','lora_name','H3_Motion_BoosterV2.safetensors'));
  nodes.push(make('443','strength_model',String(s.strength443)==='0.6' ? '0.6000000000000001' : s.strength443));
  nodes.push(make('442','text',s.text442));
  nodes.push(make('272','value',s.flag272));
  return nodes;
}
function longH3Status(status, meta='') {
  const names = {
    IDLE:'等待生成', UPLOADING:'上传参考素材', SUBMITTING:'提交任务',
    QUEUED:'排队中', RUNNING:'生成中', SUCCESS:'生成完成', FAILED:'生成失败'
  };
  statusClass($('#longH3StatusDot'), status);
  $('#longH3StatusText').textContent = names[status] || status;
  $('#longH3TaskMeta').textContent = meta || 'READY';
}
function longH3SafeUrl(url) {
  try {
    const parsed = new URL(String(url || ''), window.location.href);
    return ['http:', 'https:'].includes(parsed.protocol) ? parsed.href : '';
  } catch { return ''; }
}
function longH3Download(url='', type='') {
  const safe = longH3SafeUrl(url);
  longH3State.outputSourceUrl = safe;
  longH3State.outputUrl = safe ? toMediaUrl(safe) : '';
  longH3State.outputType = String(type || '').toLowerCase();
  $('#longH3DownloadBtn').disabled = !longH3State.outputUrl;
}
function longH3ExtraResults(task, primary) {
  const container = $('#longH3ExtraResults');
  const other = (Array.isArray(task?.results) ? task.results : [])
    .filter(item => item !== primary && (item?.url || item?.text));
  container.replaceChildren();
  if (!other.length) { container.classList.add('hidden'); return; }
  container.classList.remove('hidden');
  other.forEach((item, index) => {
    const url = longH3SafeUrl(item.url);
    const element = document.createElement(url ? 'a' : 'span');
    element.textContent = '结果 ' + (index + 2) + ' · ' + (item.outputType || (item.text ? 'TEXT' : 'FILE'));
    if (url) {
      element.href = toMediaUrl(url);
      element.target = '_blank';
      element.rel = 'noopener noreferrer';
      element.download = 'minimax-h3-output-' + (index + 2);
    } else if (item.text) {
      element.title = String(item.text);
    }
    container.appendChild(element);
  });
}
function renderLongH3Idle() {
  longH3Status('IDLE');
  longH3Download();
  $('#longH3ExtraResults').classList.add('hidden');
  $('#longH3ResultArea').innerHTML =
    '<div class="empty-state"><div class="empty-mark">▶</div>' +
    '<strong>准备生成视频</strong><span>添加参考图片并填写提示词。</span></div>';
  $('#longH3RunBtn').disabled = false;
  $('#longH3RunLabel').textContent = '开始生成';
}
function renderLongH3Loading(status, taskId) {
  longH3Status(status, taskId ? 'TASK · ' + taskId : 'PROCESSING');
  longH3Download();
  $('#longH3ExtraResults').classList.add('hidden');
  $('#longH3ResultArea').innerHTML =
    '<div class="loading-state"><div class="loading-mark"></div><strong>' +
    (status === 'QUEUED' ? '任务正在排队' : status === 'UPLOADING' ? '正在上传图片' : '视频正在生成') +
    '</strong><span>' + (status === 'UPLOADING' ? '上传结束后自动提交任务' : '任务状态每 3 秒更新') + '</span></div>';
  $('#longH3RunBtn').disabled = !!longH3State.poll || longH3State.running || !!taskId;
  $('#longH3RunLabel').textContent = '生成中…';
}
function renderLongH3Success(task) {
  const results = Array.isArray(task?.results) ? task.results : [];
  const primary = results.find(isVideo) || results.find(isImage) || results[0];
  longH3Status('SUCCESS', task?.taskId ? 'TASK · ' + task.taskId : 'DONE');
  longH3Download(primary?.url, primary?.outputType);
  longH3ExtraResults(task, primary);
  const area = $('#longH3ResultArea');
  const url = longH3SafeUrl(primary?.url);
  if (primary && isVideo(primary) && url) {
    area.innerHTML = '<video class="generated-video" controls playsinline preload="metadata" src="' +
      esc(toMediaUrl(url)) + '"></video>';
    area.querySelector('video')?.addEventListener('error', () => toast('视频已生成，但浏览器预览失败','bad'), {once:true});
  } else if (primary && isImage(primary) && url) {
    area.innerHTML = generatedImageTag(url);
    bindGeneratedImageFallbacks(area);
  } else if (primary?.text) {
    area.innerHTML = '<pre class="long-h3-text-output">' + esc(primary.text) + '</pre>';
  } else {
    area.innerHTML = '<div class="empty-state"><div class="empty-mark">✓</div>' +
      '<strong>任务已完成</strong><span>' + (url ? '请点击下载获取结果' : '没有返回可预览媒体') + '</span></div>';
  }
  $('#longH3RunBtn').disabled = false;
  $('#longH3RunLabel').textContent = '开始生成';
}
function renderLongH3Failed(task, message) {
  longH3Status('FAILED', task?.taskId ? 'TASK · ' + task.taskId : 'ERROR');
  longH3Download();
  $('#longH3ExtraResults').classList.add('hidden');
  $('#longH3ResultArea').innerHTML = failureHtml(task, message);
  $('#longH3RunBtn').disabled = false;
  $('#longH3RunLabel').textContent = '重新生成';
}
async function runLongH3Task() {
  if (longH3State.running || longH3State.poll) return;
  if (!apiKey()) { toast('请先在设置中保存 RunningHub API Key','bad'); openSettings(); return; }
  const config = longH3ReadConfig();
  try { longH3BuildNodes({}, config); }
  catch (error) { toast(error.message,'bad'); return; }
  longH3State.running = true;
  $('#longH3RunBtn').disabled = true;
  clearRuntimeTask(APP_KEYS.longH3);
  longH3State.task = null;
  longH3Download();
  try {
    const uploads = {};
    const selected = Object.keys(LONG_H3_MEDIA).filter(slot => !!state.files[slot]);
    for (let index = 0; index < selected.length; index++) {
      const slot = selected[index];
      renderLongH3Loading('UPLOADING');
      longH3Status('UPLOADING', (index + 1) + '/' + selected.length);
      uploads[slot] = await uploadFile(state.files[slot], apiKey());
    }
    renderLongH3Loading('SUBMITTING');
    longH3Status('SUBMITTING', 'RUNNINGHUB');
    const nodes = longH3BuildNodes(uploads, config);
    const result = await runRHApp(APPS[APP_KEYS.longH3].appId, nodes);
    longH3State.task = result;
    upsertHistory(APP_KEYS.longH3, result, {
      createdAt:Date.now(), prompt:String(config.prompt).slice(0,120),
      aspect:config.aspect.split(' ')[0], duration:String(config.duration) + 's',
      quality:String(config.megapixels) + ' MP', instance:instanceLabel($('#instanceType').value)
    });
    toast('视频生成任务已提交','good');
    if (result.status === 'SUCCESS') renderLongH3Success(result);
    else if (result.status === 'FAILED') renderLongH3Failed(result);
    else {
      longH3State.poll = setInterval(() => queryLongH3Task(result.taskId), 3000);
      renderLongH3Loading(result.status || 'RUNNING', result.taskId);
    }
  } catch (error) {
    renderLongH3Failed(longH3State.task, error?.message || '提交失败');
    toast(error?.message || '提交失败','bad');
  } finally {
    longH3State.running = false;
    $('#longH3RunBtn').disabled = !!longH3State.poll;
    if (longH3State.poll) $('#longH3RunLabel').textContent = '生成中…';
  }
}
async function queryLongH3Task(taskId) {
  if (longH3State.queryPending) return;
  longH3State.queryPending = true;
  try {
    const task = await queryRH(taskId);
    longH3State.task = task;
    upsertHistory(APP_KEYS.longH3, task, {taskId});
    if (task.status === 'SUCCESS' || task.status === 'FAILED') {
      clearInterval(longH3State.poll);
      longH3State.poll = null;
      if (task.status === 'SUCCESS') { renderLongH3Success(task); toast('视频生成完成','good'); }
      else { renderLongH3Failed(task); toast('视频生成失败','bad'); }
    } else {
      renderLongH3Loading(task.status || 'RUNNING', task.taskId || taskId);
    }
  } catch (error) {
    longH3Status('RUNNING', '查询失败，等待重试 · TASK ' + taskId);
    console.warn('[RH_LONG_H3_QUERY]', String(error?.message || '查询失败'));
  } finally {
    longH3State.queryPending = false;
  }
}
function longH3OpenDB() {
  if (longH3DBPromise) return longH3DBPromise;
  if (!('indexedDB' in window)) return Promise.reject(new Error('浏览器不支持 IndexedDB'));
  longH3DBPromise = new Promise((resolve,reject) => {
    const request = indexedDB.open('rhstudio-minimax-h3-long-materials', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('images', {keyPath:'slot'});
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => { longH3DBPromise = null; reject(request.error); };
  });
  return longH3DBPromise;
}
async function longH3SaveImage(slot, file) {
  if (!LONG_H3_MEDIA[slot]) return;
  const db = await longH3OpenDB();
  return new Promise((resolve,reject) => {
    const tx = db.transaction('images','readwrite');
    tx.objectStore('images').put({slot,file});
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}
async function longH3RemoveImage(slot) {
  if (!LONG_H3_MEDIA[slot]) return;
  const db = await longH3OpenDB();
  return new Promise((resolve,reject) => {
    const tx = db.transaction('images','readwrite');
    tx.objectStore('images').delete(slot);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}
async function clearAllLongH3Images() {
  const db = await longH3OpenDB();
  return new Promise((resolve,reject) => {
    const tx = db.transaction('images','readwrite');
    tx.objectStore('images').clear();
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}
async function restoreLongH3Images() {
  const db = await longH3OpenDB();
  const records = await new Promise((resolve,reject) => {
    const request = db.transaction('images').objectStore('images').getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
  records.forEach(({slot,file}) => {
    if (!LONG_H3_MEDIA[slot] || state.files[slot] || !file) return;
    state.files[slot] = file;
    if (file.type.startsWith('image/')) state.objectUrls[slot] = URL.createObjectURL(file);
    renderFileSlot(slot);
  });
}
document.querySelectorAll('#workspaceLongH3 .upload-slot[data-slot]').forEach(el => {
  el.addEventListener('dragover', event => {
    event.preventDefault();
    el.classList.add('drag-over');
  });
  el.addEventListener('dragleave', () => el.classList.remove('drag-over'));
  el.addEventListener('drop', event => {
    event.preventDefault();
    el.classList.remove('drag-over');
    const file = Array.from(event.dataTransfer?.files || [])[0];
    if (!file) return;
    if (file.type.startsWith('image/') || /\.(png|jpe?g|webp|gif|avif|bmp)$/i.test(file.name)) {
      setFile(el.dataset.slot, file);
    } else {
      toast('该输入槽仅支持图片', 'bad');
    }
  });
});
document.getElementById('longH3RunBtn')?.addEventListener('click', runLongH3Task);
document.getElementById('longH3DownloadBtn')?.addEventListener('click', () =>
  triggerDownload(longH3State, $('#longH3DownloadBtn'), 'rh-studio-minimax-h3-long')
);
document.querySelectorAll('#workspaceLongH3 [data-long-h3-field]').forEach(el =>
  el.addEventListener('input', longH3SaveConfig)
);
