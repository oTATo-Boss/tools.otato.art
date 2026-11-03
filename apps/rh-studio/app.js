const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const RH_BASE_PATH = window.location.pathname === '/rh-studio' || window.location.pathname.startsWith('/rh-studio/')
  ? '/rh-studio' : '';
const rhPath = path => RH_BASE_PATH + path;

const APPS = {
  'qwen-image-2-1-editorial': {
    key:'qwen-image-2-1-editorial',
    appId:'2104057271167791105',
    name:'Qwen 2.1 写实抓拍',
    subtitle:'Snapshot Realism · Noct Q V4',
    title:'Qwen 2.1 写实抓拍 · Snapshot Realism',
    defaultInstance:'plus',
    type:'image'
  },
  'minimax-h3-beginner-v2': {
    key:'minimax-h3-beginner-v2',
    appId:'2101232638873858050',
    name:'MiniMax-H3 多图生视频自动提示词 V2－小白全能版',
    subtitle:'Skill v4 · 多图双音频',
    title:'MiniMax-H3 多图生视频自动提示词 V2－小白全能版',
    type:'video'
  },
  'minimax-h3-long': {
    key:'minimax-h3-long',
    appId:'2103012816681041921',
    name:'Minimax-H3 无限长视频自动提示词-小白全能版',
    subtitle:'长视频 · 自动提示词',
    title:'Minimax-H3 无限长视频自动提示词-小白全能版',
    type:'video'
  }
};

const APP_KEYS = {
  qwenEditorial: 'qwen-image-2-1-editorial',
  h3BeginnerV2: 'minimax-h3-beginner-v2',
  longH3: 'minimax-h3-long'
};

const RH_UPLOAD_DIRECT = 'https://www.runninghub.ai/openapi/v2/media/upload/binary';
const MAX_RH_UPLOAD_BYTES = 30 * 1024 * 1024;

const LS = {
  key:'rhstudio.apiKey', active:'rhstudio.activeApp',
  longH3Config:'rhstudio.minimaxH3Long.config', h3V2Config:'rhstudio.minimaxH3BeginnerV2.config',
  qwenEditorialPrompt:'rhstudio.qwenEditorial.prompt', qwenEditorialAspect:'rhstudio.qwenEditorial.aspect',
  appFilter:'rhstudio.appFilter', inst:'rhstudio.instanceType',
  history:'rhstudio.generationHistory', runtimeTasks:'rhstudio.runtimeTasks.v2'
};

const MEDIA = {...QWEN_EDITORIAL_MEDIA, ...H3V2_MEDIA, ...LONG_H3_MEDIA};

const MATERIAL_LIBRARY = [
  { id:'image1', kind:'image', baseName:'图片1', accept:'image/*' },
  { id:'image2', kind:'image', baseName:'图片2', accept:'image/*' },
  { id:'image3', kind:'image', baseName:'图片3', accept:'image/*' },
  { id:'image4', kind:'image', baseName:'图片4', accept:'image/*' },
  { id:'image5', kind:'image', baseName:'图片5', accept:'image/*' },
  { id:'image6', kind:'image', baseName:'图片6', accept:'image/*' },
  { id:'video1', kind:'video', baseName:'视频1', accept:'video/*' },
  { id:'audio1', kind:'audio', baseName:'音频1', accept:'audio/*' },
  { id:'audio2', kind:'audio', baseName:'音频2', accept:'audio/*' },
  { id:'audio3', kind:'audio', baseName:'音频3', accept:'audio/*' }
];

const MATERIAL_BY_ID = Object.fromEntries(MATERIAL_LIBRARY.map(item => [item.id, item]));
const MATERIAL_DB_NAME = 'rhstudio-material-library';
const MATERIAL_DB_VERSION = 1;
const MATERIAL_STORE_NAME = 'materials';

const materialState = {
  records: {},
  objectUrls: {},
  ready: false,
  loading: null,
  dbPromise: null
};

const state = {
  activeApp: APP_KEYS.qwenEditorial,
  appFilter: 'all',
  files: {},
  objectUrls: {}
};

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({
  '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'
}[c]));

function toast(message, type='') {
  const el = $('#toast');
  el.textContent = message;
  el.className = 'toast show ' + type;
  clearTimeout(el._timer);
  el._timer = setTimeout(() => el.className = 'toast', 2600);
}

function apiKey() {
  return localStorage.getItem(LS.key) || '';
}

function maskKey(key) {
  if (!key) return '';
  if (key.length < 10) return '••••••••';
  return key.slice(0,4) + '••••••••' + key.slice(-4);
}

function instanceLabel(value) {
  return {default:'24G',plus:'48G',ultra:'84G'}[value] || value || '24G';
}

function qualityLabel(value) {
  return {'0.4':'480P','0.9':'720P','2.0':'1080P'}[String(value)] || String(value || '');
}

function updateKeyUI() {
  const key = apiKey();
  const ok = !!key;
  $('#sideDot').className = 'dot ' + (ok ? 'ok' : '');
  $('#sideStatus').textContent = ok ? 'API Key 已配置' : 'API Key 未配置';
  $('#settingsDot').className = 'dot ' + (ok ? 'ok' : '');
  $('#keyStatusText').textContent = ok ? '已保存 API Key' : '尚未保存 API Key';
  $('#keyMask').textContent = ok ? maskKey(key) : '';
  $('#settingsBadge').textContent = ok ? 'CONFIGURED' : 'NOT CONFIGURED';
  $('#settingsBadge').style.color = ok ? 'var(--good)' : 'var(--accent)';
}

function setActiveApp(key, persist=true) {
  if (!APPS[key]) key = APP_KEYS.qwenEditorial;
  state.activeApp = key;

  $$('.app-item').forEach(item => {
    item.classList.toggle('active', item.dataset.app === key);
  });

  $('#workspaceQwenEditorial').classList.toggle('hidden', key !== APP_KEYS.qwenEditorial);
  $('#workspaceLongH3').classList.toggle('hidden', key !== APP_KEYS.longH3);
  $('#workspaceH3V2').classList.toggle('hidden', key !== APP_KEYS.h3BeginnerV2);

  const app = APPS[key];
  if (!localStorage.getItem(LS.inst)) $('#instanceType').value = app.defaultInstance || 'default';
  $('#currentAppTitle').textContent = app.title;
  $('#settingsCurrentApp').textContent = app.title;

  requestAnimationFrame(() => {
    const activeWorkspace = $('.app-workspace:not(.hidden)');
    activeWorkspace?.querySelectorAll('.image-preview-stage > img.generated-image').forEach(fitGeneratedImageToStage);
  });

  if (persist) localStorage.setItem(LS.active, key);
}

function renderAppFilter(filter='all', persist=true, autoSelect=true) {
  const validFilters = new Set(['all','image','video']);
  if (!validFilters.has(filter)) filter = 'all';
  state.appFilter = filter;

  const counts = {all:0,image:0,video:0};
  Object.values(APPS).forEach(app => {
    counts.all += 1;
    if (counts[app.type] != null) counts[app.type] += 1;
  });

  const countEls = {
    all:$('#appFilterCountAll'),
    image:$('#appFilterCountImage'),
    video:$('#appFilterCountVideo')
  };
  Object.entries(countEls).forEach(([key,el]) => {
    if (el) el.textContent = String(counts[key] || 0);
  });

  const visibleItems = [];
  $$('.app-item').forEach(item => {
    const app = APPS[item.dataset.app];
    const visible = filter === 'all' || app?.type === filter;
    item.classList.toggle('filter-hidden', !visible);
    if (visible) visibleItems.push(item);
  });

  $$('.app-filter-btn').forEach(button => {
    const active = button.dataset.appFilter === filter;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', active ? 'true' : 'false');
  });

  const empty = $('#appFilterEmpty');
  if (empty) {
    const labels = {image:'图片',video:'视频',all:'全部'};
    empty.classList.toggle('hidden', visibleItems.length > 0);
    const strong = empty.querySelector('strong');
    const span = empty.querySelector('span');
    if (strong) strong.textContent = visibleItems.length ? '' : '暂无' + labels[filter] + '应用';
    if (span) span.textContent = visibleItems.length ? '' : '这个分类还没有接入应用。';
  }

  if (autoSelect && filter !== 'all') {
    const activeApp = APPS[state.activeApp];
    if (activeApp?.type !== filter && visibleItems.length) {
      setActiveApp(visibleItems[0].dataset.app);
    }
  }

  if (persist) localStorage.setItem(LS.appFilter, filter);
}

function loadConfig() {
  longH3LoadConfig();
  h3V2LoadConfig();
  qwenEditorialLoadConfig();
  state.appFilter = localStorage.getItem(LS.appFilter) || 'all';
  $('#instanceType').value = localStorage.getItem(LS.inst) || 'default';
}

$('#instanceType').addEventListener('change', () => {
  localStorage.setItem(LS.inst, $('#instanceType').value);
});

$$('.app-item').forEach(item => {
  item.addEventListener('click', () => setActiveApp(item.dataset.app));
});

$$('.app-filter-btn').forEach(button => {
  button.addEventListener('click', () => {
    renderAppFilter(button.dataset.appFilter || 'all');
  });
});

function getHistory() {
  try {
    const value = JSON.parse(localStorage.getItem(LS.history) || '[]');
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function saveHistory(items) {
  try {
    localStorage.setItem(LS.history, JSON.stringify(items.slice(0, 50)));
  } catch {}
}


function getRuntimeTasks() {
  try {
    const value = JSON.parse(localStorage.getItem(LS.runtimeTasks) || '{}');
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  } catch {
    return {};
  }
}

function compactRuntimeResults(results) {
  if (!Array.isArray(results)) return [];
  return results.slice(0, 20).map(item => ({
    url:String(item?.url || ''),
    outputType:String(item?.outputType || ''),
    text:String(item?.text || '')
  })).filter(item => item.url || item.text);
}

function saveRuntimeTask(appKey, task, extra={}) {
  const taskId = String(task?.taskId || extra.taskId || '').trim();
  if (!taskId || !APPS[appKey]) return;

  const all = getRuntimeTasks();
  const previous = all[appKey] || {};
  const nextResults = compactRuntimeResults(task?.results);
  const status = String(task?.status || extra.status || previous.status || 'RUNNING');

  all[appKey] = {
    taskId,
    status,
    results:nextResults.length ? nextResults : (Array.isArray(previous.results) ? previous.results : []),
    errorCode:String(task?.errorCode || previous.errorCode || ''),
    errorMessage:String(task?.errorMessage || previous.errorMessage || ''),
    createdAt:Number(previous.createdAt || extra.createdAt || Date.now()),
    updatedAt:Date.now()
  };

  try {
    localStorage.setItem(LS.runtimeTasks, JSON.stringify(all));
  } catch {}
}

function clearRuntimeTask(appKey) {
  const all = getRuntimeTasks();
  if (!Object.prototype.hasOwnProperty.call(all, appKey)) return;
  delete all[appKey];
  try {
    localStorage.setItem(LS.runtimeTasks, JSON.stringify(all));
  } catch {}
}

function markRuntimeTaskFailed(appKey, taskId, message='任务查询失败') {
  saveRuntimeTask(appKey, {
    taskId,
    status:'FAILED',
    results:[],
    errorMessage:String(message || '任务查询失败')
  });
}

function runtimeSnapshotFromHistory(appKey) {
  const item = getHistory().find(entry => entry?.appKey === appKey && entry?.taskId);
  if (!item) return null;

  const status = String(item.status || '').toUpperCase();
  if (!['SUCCESS','FAILED'].includes(status)) return null;

  const result = item.resultUrl
    ? [{url:item.resultUrl, outputType:item.outputType || '', text:''}]
    : [];

  return {
    taskId:String(item.taskId || ''),
    status,
    results:result,
    errorCode:String(item.errorCode || ''),
    errorMessage:String(item.errorMessage || ''),
    createdAt:Number(item.createdAt || Date.now()),
    updatedAt:Number(item.updatedAt || item.createdAt || Date.now())
  };
}

function runtimeViews() {
  return {
    [APP_KEYS.qwenEditorial]: {state:qwenEditorialState, renderLoading:renderQwenEditorialLoading, renderSuccess:renderQwenEditorialSuccess, renderFailed:renderQwenEditorialFailed, query:queryQwenEditorialTask},
    [APP_KEYS.h3BeginnerV2]: {state:h3V2State, renderLoading:renderH3V2Loading, renderSuccess:renderH3V2Success, renderFailed:renderH3V2Failed, query:queryH3V2Task},
    [APP_KEYS.longH3]: {state:longH3State, renderLoading:renderLongH3Loading, renderSuccess:renderLongH3Success, renderFailed:renderLongH3Failed, query:queryLongH3Task}
  };
}

function restoreRuntimeTasks(skipApp='') {
  const saved = getRuntimeTasks();
  const views = runtimeViews();

  Object.entries(views).forEach(([appKey, view]) => {
    if (appKey === skipApp) return;

    const snapshot = saved[appKey] || runtimeSnapshotFromHistory(appKey);
    if (!snapshot?.taskId) return;

    view.state.task = snapshot;
    const status = String(snapshot.status || 'RUNNING').toUpperCase();

    if (status === 'SUCCESS') {
      view.renderSuccess(snapshot);
      if (!saved[appKey]) saveRuntimeTask(appKey, snapshot);
      return;
    }

    if (status === 'FAILED') {
      view.renderFailed(snapshot, snapshot.errorMessage || '生成失败');
      if (!saved[appKey]) saveRuntimeTask(appKey, snapshot);
      return;
    }

    view.renderLoading(status, snapshot.taskId);

    if (!apiKey()) return;

    clearInterval(view.state.poll);
    view.state.poll = setInterval(() => view.query(snapshot.taskId), 3000);
    view.query(snapshot.taskId);
  });
}

function isVideo(item) {
  const type = String(item?.outputType || '').toLowerCase();
  const url = String(item?.url || '').toLowerCase();
  return type.includes('video') || ['mp4','webm','mov','m4v'].includes(type) || /\.(mp4|webm|mov|m4v)(\?|$)/.test(url);
}

function isImage(item) {
  const type = String(item?.outputType || '').toLowerCase();
  const url = String(item?.url || '').toLowerCase();
  return type.includes('image') || ['png','jpg','jpeg','webp','gif','avif'].includes(type) || /\.(png|jpe?g|webp|gif|avif)(\?|$)/.test(url);
}

function upsertHistory(appKey, task, extra={}) {
  const taskId = String(task?.taskId || extra.taskId || '').trim();
  if (!taskId) return;

  const app = APPS[appKey] || APPS[APP_KEYS.qwenEditorial];
  const items = getHistory();
  const previous = items.find(item => item.taskId === taskId) || {};
  const results = Array.isArray(task?.results) ? task.results : [];
  const primary = results.find(isVideo) || results.find(isImage) || results[0] || null;

  const next = {
    ...previous,
    taskId,
    appKey,
    appName: app.name,
    status: task?.status || extra.status || previous.status || 'RUNNING',
    createdAt: previous.createdAt || extra.createdAt || Date.now(),
    updatedAt: Date.now(),
    aspect: extra.aspect || previous.aspect || '',
    quality: extra.quality || previous.quality || '',
    duration: extra.duration || previous.duration || '',
    instance: extra.instance || previous.instance || instanceLabel($('#instanceType').value),
    prompt: extra.prompt ?? previous.prompt ?? '',
    resultUrl: primary?.url || previous.resultUrl || '',
    outputType: primary?.outputType || previous.outputType || '',
    errorCode: task?.errorCode || previous.errorCode || '',
    errorMessage: task?.errorMessage || previous.errorMessage || '',
    batchId: extra.batchId ?? previous.batchId ?? '',
    batchIndex: Number(extra.batchIndex ?? previous.batchIndex ?? 0),
    batchTotal: Number(extra.batchTotal ?? previous.batchTotal ?? 0),
    clothesSeed: extra.clothesSeed ?? previous.clothesSeed ?? '',
    performanceSeed: extra.performanceSeed ?? previous.performanceSeed ?? '',
    personaSeed: extra.personaSeed ?? previous.personaSeed ?? '',
    personaId: extra.personaId ?? previous.personaId ?? '',
    personaName: extra.personaName ?? previous.personaName ?? '',
    actionCount: Number(extra.actionCount ?? previous.actionCount ?? 0),
    signatureCount: Number(extra.signatureCount ?? previous.signatureCount ?? 0),
    arc: extra.arc ?? previous.arc ?? ''
  };

  saveHistory([next, ...items.filter(item => item.taskId !== taskId)]);
  if (!next.batchId) saveRuntimeTask(appKey, task, extra);
}

function closeDrawers() {
  $$('.drawer-overlay').forEach(el => el.classList.add('hidden'));
  document.body.style.overflow = '';
}

function openSettings() {
  closeDrawers();
  $('#apiKeyInput').value = '';
  $('#settingsCurrentApp').textContent = APPS[state.activeApp].title;
  $('#settingsOverlay').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function openHistory() {
  window.location.href = rhPath('/history');
}

$('#openSettings').onclick = openSettings;
$('#openHistory').onclick = openHistory;
$('#openMaterialSettings').onclick = openMaterialSettings;
$('#quickFillMaterials').onclick = fillSavedMaterials;
$$('[data-close]').forEach(el => el.onclick = closeDrawers);

window.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeDrawers();
});


function openMaterialDB() {
  if (!('indexedDB' in window)) {
    return Promise.reject(new Error('当前浏览器不支持本地素材缓存'));
  }
  if (materialState.dbPromise) return materialState.dbPromise;

  materialState.dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(MATERIAL_DB_NAME, MATERIAL_DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(MATERIAL_STORE_NAME)) {
        db.createObjectStore(MATERIAL_STORE_NAME, { keyPath:'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('打开本地素材缓存失败'));
    request.onblocked = () => reject(new Error('素材缓存数据库被其他页面占用，请关闭旧页面后重试'));
  });

  return materialState.dbPromise;
}

function materialExtension(file) {
  const fromName = String(file?.name || '').match(/\.([a-zA-Z0-9]{1,8})$/);
  if (fromName) return '.' + fromName[1].toLowerCase();

  const type = String(file?.type || '').toLowerCase();
  const map = {
    'image/jpeg':'.jpg','image/png':'.png','image/webp':'.webp','image/gif':'.gif','image/avif':'.avif',
    'video/mp4':'.mp4','video/webm':'.webm','video/quicktime':'.mov','video/x-m4v':'.m4v',
    'audio/mpeg':'.mp3','audio/wav':'.wav','audio/x-wav':'.wav','audio/mp4':'.m4a','audio/aac':'.aac','audio/ogg':'.ogg','audio/webm':'.webm'
  };
  return map[type] || '';
}

function renamedMaterialFile(config, file) {
  const ext = materialExtension(file);
  return new File([file], config.baseName + ext, {
    type:file.type || '',
    lastModified:Date.now()
  });
}

function fileFromMaterialRecord(record) {
  if (!record?.blob) return null;
  return new File([record.blob], record.fileName || record.baseName || '素材', {
    type:record.type || record.blob.type || '',
    lastModified:record.updatedAt || Date.now()
  });
}

function formatMaterialBytes(bytes) {
  const value = Number(bytes || 0);
  if (value < 1024) return value + ' B';
  if (value < 1024 * 1024) return (value / 1024).toFixed(value < 10 * 1024 ? 1 : 0) + ' KB';
  return (value / (1024 * 1024)).toFixed(value < 10 * 1024 * 1024 ? 1 : 0) + ' MB';
}

function clearMaterialPreviewUrls() {
  Object.values(materialState.objectUrls).forEach(url => {
    try { URL.revokeObjectURL(url); } catch {}
  });
  materialState.objectUrls = {};
}

function updateMaterialLibraryBadges() {
  const count = MATERIAL_LIBRARY.filter(config => !!materialState.records[config.id]).length;
  const saved = $('#materialSavedCount');
  const badge = $('#materialLibraryBadge');
  if (saved) saved.textContent = String(count);
  if (badge) badge.textContent = count + ' / ' + MATERIAL_LIBRARY.length;
}

function materialPreviewHtml(config, record) {
  if (!record?.blob) {
    const label = config.kind === 'image' ? 'IMG' : config.kind === 'video' ? 'VIDEO' : 'AUDIO';
    return '<span class="material-kind-icon' + (config.kind === 'audio' ? ' audio' : '') + '">' +
      (config.kind === 'audio' ? '♪' : label) + '</span>';
  }

  const url = URL.createObjectURL(record.blob);
  materialState.objectUrls[config.id] = url;

  if (config.kind === 'image') {
    return '<img src="' + esc(url) + '" alt="' + esc(config.baseName) + '">';
  }
  if (config.kind === 'video') {
    return '<video src="' + esc(url) + '" muted playsinline preload="metadata"></video>';
  }
  return '<span class="material-kind-icon audio">♪</span>';
}

function renderMaterialLibrary() {
  const grid = $('#materialLibraryGrid');
  if (!grid) return;

  clearMaterialPreviewUrls();

  grid.innerHTML = MATERIAL_LIBRARY.map(config => {
    const record = materialState.records[config.id];
    const kindLabel = config.kind === 'image' ? 'IMAGE' : config.kind === 'video' ? 'VIDEO' : 'AUDIO';
    const meta = record
      ? ((record.fileName || config.baseName) + ' · ' + formatMaterialBytes(record.size))
      : '未设置 · 点击上传后自动保存';

    return (
      '<article class="material-card ' + (record ? 'has-file' : '') + '" data-material-card="' + esc(config.id) + '">' +
        '<div class="material-card-preview">' + materialPreviewHtml(config, record) + '</div>' +
        '<div class="material-card-body">' +
          '<div class="material-card-copy">' +
            '<strong>' + esc(config.baseName) + '</strong>' +
            '<b>' + kindLabel + '</b>' +
          '</div>' +
          '<span class="material-card-meta">' + esc(meta) + '</span>' +
          '<div class="material-card-actions">' +
            '<button class="material-upload-btn" data-material-upload="' + esc(config.id) + '" type="button">' + (record ? '更换' : '上传') + '</button>' +
            '<button class="material-delete-btn" data-material-delete="' + esc(config.id) + '" type="button" ' + (record ? '' : 'disabled') + '>删除</button>' +
          '</div>' +
          '<input data-material-input="' + esc(config.id) + '" type="file" accept="' + esc(config.accept) + '" hidden>' +
        '</div>' +
      '</article>'
    );
  }).join('');

  document.querySelectorAll('[data-material-upload]').forEach(button => {
    button.addEventListener('click', () => {
      const id = button.dataset.materialUpload;
      const input = $('[data-material-input="' + id + '"]');
      input?.click();
    });
  });

  document.querySelectorAll('[data-material-input]').forEach(input => {
    input.addEventListener('change', async () => {
      const file = input.files?.[0];
      if (!file) return;
      await savePersistentMaterial(input.dataset.materialInput, file);
      input.value = '';
    });
  });

  document.querySelectorAll('[data-material-delete]').forEach(button => {
    button.addEventListener('click', async () => {
      if (button.disabled) return;
      await deletePersistentMaterial(button.dataset.materialDelete);
    });
  });

  updateMaterialLibraryBadges();
}

async function ensureMaterialLibrary() {
  if (materialState.ready) return materialState.records;
  if (materialState.loading) return materialState.loading;

  materialState.loading = (async () => {
    const db = await openMaterialDB();
    const records = await new Promise((resolve, reject) => {
      const tx = db.transaction(MATERIAL_STORE_NAME, 'readonly');
      const request = tx.objectStore(MATERIAL_STORE_NAME).getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error || new Error('读取本地素材失败'));
    });

    materialState.records = {};
    records.forEach(record => {
      if (record?.id && MATERIAL_BY_ID[record.id]) materialState.records[record.id] = record;
    });
    materialState.ready = true;
    updateMaterialLibraryBadges();
    if ($('#materialSettingsOverlay') && !$('#materialSettingsOverlay').classList.contains('hidden')) {
      renderMaterialLibrary();
    }

    try { navigator.storage?.persist?.(); } catch {}
    return materialState.records;
  })();

  try {
    return await materialState.loading;
  } finally {
    materialState.loading = null;
  }
}

async function savePersistentMaterial(id, file) {
  const config = MATERIAL_BY_ID[id];
  if (!config || !file) return;

  if (file.size > MAX_RH_UPLOAD_BYTES) {
    toast('单个素材不能超过 30MB：' + file.name, 'bad');
    return;
  }

  if (file.type && !file.type.startsWith(config.kind + '/')) {
    toast('文件类型不匹配：' + config.baseName, 'bad');
    return;
  }

  const renamed = renamedMaterialFile(config, file);
  const record = {
    id:config.id,
    kind:config.kind,
    baseName:config.baseName,
    fileName:renamed.name,
    type:renamed.type,
    size:renamed.size,
    updatedAt:Date.now(),
    blob:renamed
  };

  try {
    const db = await openMaterialDB();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(MATERIAL_STORE_NAME, 'readwrite');
      tx.objectStore(MATERIAL_STORE_NAME).put(record);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error('素材保存失败'));
      tx.onabort = () => reject(tx.error || new Error('素材保存被中止'));
    });

    materialState.records[id] = record;
    materialState.ready = true;
    renderMaterialLibrary();
    toast(config.baseName + ' 已保存', 'good');
  } catch (error) {
    toast(error?.name === 'QuotaExceededError' ? '浏览器存储空间不足，素材未保存' : (error?.message || '素材保存失败'), 'bad');
  }
}

async function deletePersistentMaterial(id) {
  const config = MATERIAL_BY_ID[id];
  if (!config) return;

  try {
    const db = await openMaterialDB();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(MATERIAL_STORE_NAME, 'readwrite');
      tx.objectStore(MATERIAL_STORE_NAME).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error('删除素材失败'));
      tx.onabort = () => reject(tx.error || new Error('删除素材被中止'));
    });

    delete materialState.records[id];
    materialState.ready = true;
    renderMaterialLibrary();
    toast(config.baseName + ' 已删除');
  } catch (error) {
    toast(error?.message || '删除素材失败', 'bad');
  }
}

async function openMaterialSettings() {
  closeDrawers();
  $('#materialSettingsOverlay').classList.remove('hidden');
  document.body.style.overflow = 'hidden';

  try {
    await ensureMaterialLibrary();
    renderMaterialLibrary();
  } catch (error) {
    toast(error?.message || '无法读取本地素材', 'bad');
  }
}

async function fillSavedMaterials() {
  try { await ensureMaterialLibrary(); }
  catch (error) { toast(error?.message || '无法读取本地素材', 'bad'); return; }
  const slots = activeWorkspaceUploadSlots();
  const positions = {};
  let count = 0;
  for (const config of MATERIAL_LIBRARY) {
    const index = positions[config.kind] || 0;
    positions[config.kind] = index + 1;
    const target = slots.filter(item => item.config.kind === config.kind)[index];
    const record = materialState.records[config.id];
    if (!target || !record) continue;
    const file = fileFromMaterialRecord(record);
    if (!file) continue;
    setFile(target.slot, file);
    count++;
  }
  if (!count) {
    toast('没有适合当前应用的已保存素材', 'bad');
    openMaterialSettings();
    return;
  }
  toast('已填入 ' + count + ' 个保存素材', 'good');
}

function clearFile(slot, rerender=true) {
  if (rerender && H3V2_MEDIA[slot]) h3V2RemoveMedia(slot).catch(()=>{});
  if (rerender && QWEN_EDITORIAL_MEDIA[slot]) qwenEditorialRemoveMedia(slot).catch(()=>{});
  if (rerender && LONG_H3_MEDIA[slot]) longH3RemoveImage(slot).catch(()=>{});
  if (state.objectUrls[slot]) {
    URL.revokeObjectURL(state.objectUrls[slot]);
    delete state.objectUrls[slot];
  }
  delete state.files[slot];
  if (rerender) renderFileSlot(slot);
}

function setFile(slot, file) {
  clearFile(slot, false);
  if (!file) return;

  if (file.size > MAX_RH_UPLOAD_BYTES) {
    toast('单个文件不能超过 30MB：' + file.name, 'bad');
    return;
  }

  state.files[slot] = file;
  if (LONG_H3_MEDIA[slot]) longH3SaveImage(slot, file).catch(()=>toast('图片本地保存失败','bad'));
  if (H3V2_MEDIA[slot]) h3V2SaveMedia(slot, file).catch(()=>toast('参考素材本地保存失败','bad'));
  if (QWEN_EDITORIAL_MEDIA[slot]) qwenEditorialSaveMedia(slot, file).catch(()=>toast('参考素材本地保存失败','bad'));
  if (file.type.startsWith('image/') || file.type.startsWith('video/')) {
    state.objectUrls[slot] = URL.createObjectURL(file);
  }
  renderFileSlot(slot);
}

function renderFileSlot(slot) {
  const config = MEDIA[slot];
  if (!config) return;
  const file = state.files[slot];
  const el = $('.upload-slot[data-slot="' + slot + '"]');
  if (!el) return;

  el.classList.toggle('has-file', !!file);
  el.querySelector('.slot-clear')?.classList.toggle('hidden', !file);

  if (config.kind === 'image') {
    const preview = el.querySelector('.media-preview');
    const caption = el.querySelector('.media-caption strong');
    const index = config.order || 1;

    if (file) {
      preview.innerHTML = '<img src="' + esc(state.objectUrls[slot]) + '" alt="">';
      caption.textContent = file.name;
    } else {
      preview.innerHTML = '<span>' + String(index).padStart(2,'0') + '</span><i>＋</i>';
      caption.textContent = config.label;
    }
  }

  if (config.kind === 'video') {
    const preview = el.querySelector('.video-reference-preview');
    const title = el.querySelector('.video-reference-copy strong');
    const subtitle = el.querySelector('.video-reference-copy small');

    if (file) {
      preview.innerHTML = '<video src="' + esc(state.objectUrls[slot]) + '" muted playsinline preload="metadata"></video>';
      title.textContent = file.name;
      subtitle.textContent = '已选择参考视频';
    } else {
      preview.innerHTML = '<span>VIDEO</span><i>＋</i>';
      title.textContent = config.label || '参考视频';
      subtitle.textContent = config.subtitle || '支持上传本地视频作为结构 / 动作 / 镜头参考';
    }
  }

  if (config.kind === 'audio') {
    const title = el.querySelector('strong');
    const small = el.querySelector('small');
    title.textContent = file ? file.name : config.label;
    small.textContent = file ? '已选择' : 'AUDIO';
  }

}

$$('.upload-slot').forEach(el => {
  const slot = el.dataset.slot;
  const input = el.querySelector('input[type="file"]');

  el.addEventListener('click', e => {
    if (e.target.closest('.slot-clear')) {
      e.preventDefault();
      e.stopPropagation();
      clearFile(slot);
      input.value = '';
      return;
    }
    input.click();
  });

  input.addEventListener('click', e => e.stopPropagation());
  input.addEventListener('change', e => {
    e.stopPropagation();
    const file = input.files[0];
    if (file) setFile(slot, file);
  });
});


function mediaKindFromFile(file) {
  const type = String(file?.type || '').toLowerCase();
  if (type.startsWith('image/')) return 'image';
  if (type.startsWith('video/')) return 'video';
  if (type.startsWith('audio/')) return 'audio';

  const name = String(file?.name || '').toLowerCase();
  if (/\.(png|jpe?g|webp|gif|avif|bmp|tiff?)$/.test(name)) return 'image';
  if (/\.(mp4|webm|mov|m4v|mkv|avi)$/.test(name)) return 'video';
  if (/\.(mp3|wav|m4a|aac|ogg|flac|webm)$/.test(name)) return 'audio';
  return '';
}

function clipboardFiles(event) {
  const transfer = event?.clipboardData;
  if (!transfer) return [];

  const directFiles = [...(transfer.files || [])].filter(Boolean);
  if (directFiles.length) return directFiles;

  return [...(transfer.items || [])]
    .filter(item => item.kind === 'file')
    .map(item => item.getAsFile())
    .filter(Boolean);
}

function activeWorkspaceUploadSlots() {
  const workspace = $('.app-workspace:not(.hidden)');
  if (!workspace) return [];

  return [...workspace.querySelectorAll('.upload-slot[data-slot]')]
    .map(el => {
      const slot = el.dataset.slot;
      const config = MEDIA[slot];
      return config ? {el, slot, config} : null;
    })
    .filter(Boolean);
}

function pasteFilesIntoActiveWorkspace(files) {
  const normalized = files.filter(file => file && file.size > 0);
  if (!normalized.length) return {filled:0, skipped:0, oversized:0};

  let filled = 0;
  let skipped = 0;
  let oversized = 0;

  const slots = activeWorkspaceUploadSlots();

  for (const file of normalized) {
    const kind = mediaKindFromFile(file);
    if (!kind) {
      skipped++;
      continue;
    }

    if (file.size > MAX_RH_UPLOAD_BYTES) {
      oversized++;
      continue;
    }

    const target = slots.find(item =>
      item.config.kind === kind &&
      !state.files[item.slot]
    );

    if (!target) {
      skipped++;
      continue;
    }

    setFile(target.slot, file);
    filled++;
  }

  return {filled, skipped, oversized};
}

window.addEventListener('paste', event => {
  const files = clipboardFiles(event);
  if (!files.length) return;

  // Drawers contain their own editing controls; avoid silently filling the
  // hidden workspace while a settings drawer is open.
  if ($('.drawer-overlay:not(.hidden)')) return;

  event.preventDefault();

  const result = pasteFilesIntoActiveWorkspace(files);
  const parts = [];

  if (result.filled) parts.push('已按顺序填入 ' + result.filled + ' 个文件');
  if (result.oversized) parts.push(result.oversized + ' 个文件超过 30MB');
  if (result.skipped) parts.push(result.skipped + ' 个文件没有匹配的空栏');

  if (result.filled) {
    toast(parts.join(' · '), 'good');
  } else {
    toast(parts.join(' · ') || '当前应用没有可用的空素材栏', 'bad');
  }
});


function extractUploadValue(data) {
  return (
    data?.data?.fileName ||
    data?.data?.download_url ||
    data?.fileName ||
    data?.download_url ||
    ''
  );
}

async function parseUploadResponse(res) {
  const data = await res.json().catch(() => ({}));
  const apiFailed = data?.code != null && Number(data.code) !== 0;

  if (!res.ok || apiFailed) {
    throw new Error(
      data?.message ||
      data?.msg ||
      data?.errorMessage ||
      data?.error ||
      ('RunningHub 上传失败 (' + res.status + ')')
    );
  }

  const value = extractUploadValue(data);
  if (!value) throw new Error('RunningHub 上传接口未返回可用文件值');
  return value;
}

async function uploadViaRewrite(file, key) {
  const fd = new FormData();
  fd.append('file', file, file.name);

  const res = await fetch(rhPath('/rh-upload'), {
    method:'POST',
    headers:{ Authorization:'Bearer ' + key },
    body:fd
  });

  return parseUploadResponse(res);
}

async function uploadDirect(file, key) {
  const fd = new FormData();
  fd.append('file', file, file.name);

  const res = await fetch(RH_UPLOAD_DIRECT, {
    method:'POST',
    mode:'cors',
    headers:{ Authorization:'Bearer ' + key },
    body:fd
  });

  return parseUploadResponse(res);
}

async function uploadViaLegacyFunction(file, key) {
  const fd = new FormData();
  fd.append('file', file, file.name);

  const res = await fetch(rhPath('/api/rh/upload'), {
    method:'POST',
    headers:{'x-rh-key':key},
    body:fd
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || ('文件上传失败 (' + res.status + ')'));

  const value = extractUploadValue(data);
  if (!value) throw new Error('RunningHub 上传接口未返回可用文件值');
  return value;
}

async function uploadFile(file, key) {
  if (file.size > MAX_RH_UPLOAD_BYTES) {
    throw new Error('单个文件不能超过 30MB：' + file.name);
  }

  try {
    return await uploadViaRewrite(file, key);
  } catch (rewriteError) {
    try {
      return await uploadDirect(file, key);
    } catch (directError) {
      if (file.size < 4 * 1024 * 1024) {
        try {
          return await uploadViaLegacyFunction(file, key);
        } catch {}
      }

      throw new Error(
        '文件直传 RunningHub 失败：' +
        (directError?.message || rewriteError?.message || '未知上传错误')
      );
    }
  }
}

async function runRHApp(appId, nodeInfoList, options={}) {
  const res = await fetch(rhPath('/api/rh/run'), {
    method:'POST',
    headers:{
      'Content-Type':'application/json',
      'x-rh-key':apiKey()
    },
    body:JSON.stringify({
      appId,
      nodeInfoList,
      instanceType:options.instanceType || $('#instanceType').value || 'default',
      usePersonalQueue:'false'
    })
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || ('提交失败 (' + res.status + ')'));

  const taskId = String(data?.taskId || '').trim();
  if (!taskId) {
    throw new Error(
      data?.errorMessage ||
      data?.message ||
      data?.msg ||
      'RunningHub 未返回 taskId，任务未创建'
    );
  }

  data.taskId = taskId;
  if (data.status) data.status = String(data.status).toUpperCase();
  return data;
}

async function queryRH(taskId) {
  const res = await fetch(rhPath('/api/rh/query'), {
    method:'POST',
    headers:{
      'Content-Type':'application/json',
      'x-rh-key':apiKey()
    },
    body:JSON.stringify({taskId})
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || ('查询失败 (' + res.status + ')'));

  const status = String(data?.status || '').trim().toUpperCase();
  if (!status) {
    throw new Error(
      data?.errorMessage ||
      data?.message ||
      data?.msg ||
      'RunningHub 查询响应缺少 status'
    );
  }

  data.status = status;
  return data;
}

function toMediaUrl(url) {
  if (!url) return '';
  try {
    const parsed = new URL(url, window.location.href);
    if (parsed.hostname === 'rh-images-1252422369.cos.ap-beijing.myqcloud.com') {
      return rhPath('/rh-media') + parsed.pathname + parsed.search;
    }
    if (parsed.hostname === 'rh-hk-images-1252422369.cos.ap-hongkong.myqcloud.com') {
      return rhPath('/rh-media-hk') + parsed.pathname + parsed.search;
    }
  } catch {}
  return url;
}

function generatedImageTag(url, className='') {
  const direct = String(url || '');
  const proxy = toMediaUrl(direct);
  const fallback = proxy && proxy !== direct ? proxy : '';
  const classes = ['generated-image', className].filter(Boolean).join(' ');

  return '<img src="' + esc(direct) + '"' +
    (fallback ? ' data-fallback-src="' + esc(fallback) + '"' : '') +
    ' referrerpolicy="no-referrer"' +
    ' class="' + esc(classes) + '"' +
    ' alt="generated image">';
}

function fitGeneratedImageToStage(img) {
  const stage = img.closest('.image-preview-stage');
  if (!stage || img.closest('.image-result-grid')) return;

  const naturalWidth = Number(img.naturalWidth || 0);
  const naturalHeight = Number(img.naturalHeight || 0);
  const stageWidth = Number(stage.clientWidth || 0);
  const stageHeight = Number(stage.clientHeight || 0);

  if (!naturalWidth || !naturalHeight || !stageWidth || !stageHeight) return;

  const scale = Math.min(stageWidth / naturalWidth, stageHeight / naturalHeight);
  const width = Math.max(1, Math.floor(naturalWidth * scale));
  const height = Math.max(1, Math.floor(naturalHeight * scale));

  img.style.width = width + 'px';
  img.style.height = height + 'px';
}

function bindGeneratedImageFallbacks(root) {
  if (!root) return;

  root.querySelectorAll('img.generated-image').forEach(img => {
    img.addEventListener('load', () => fitGeneratedImageToStage(img));

    img.addEventListener('error', () => {
      if (!img.dataset.fallbackTried && img.dataset.fallbackSrc) {
        img.dataset.fallbackTried = '1';
        img.src = img.dataset.fallbackSrc;
        return;
      }

      img.closest('.image-result-grid')?.classList.add('has-load-error');
      img.closest('.image-preview-stage')?.classList.add('has-load-error');
      toast('图片已生成，但预览加载失败', 'bad');
    });

    if (img.complete && img.naturalWidth) fitGeneratedImageToStage(img);
  });
}

function refitAllGeneratedImagePreviews() {
  $$('.image-preview-stage > img.generated-image').forEach(fitGeneratedImageToStage);
}

window.addEventListener('resize', refitAllGeneratedImagePreviews);

if ('ResizeObserver' in window) {
  const imagePreviewResizeObserver = new ResizeObserver(entries => {
    entries.forEach(entry => {
      entry.target.querySelectorAll('img.generated-image').forEach(fitGeneratedImageToStage);
    });
  });
  $$('.image-preview-stage').forEach(stage => imagePreviewResizeObserver.observe(stage));
}

function parseMaybeJson(value) {
  if (value == null || value === '') return null;
  if (typeof value !== 'string') return value;
  try { return JSON.parse(value); } catch { return value; }
}

function formatDiagnostic(value) {
  const parsed = parseMaybeJson(value);
  if (parsed == null || parsed === '') return '';

  if (typeof parsed === 'object') {
    if (!Array.isArray(parsed) && Object.keys(parsed).length === 0) return '';
    try {
      const text = JSON.stringify(parsed, null, 2);
      return text.length > 3600 ? text.slice(0,3600) + '\n…' : text;
    } catch {}
  }

  const text = String(parsed);
  return text.length > 3600 ? text.slice(0,3600) + '\n…' : text;
}

function collectFailureNodes(task) {
  const nodes = new Set();
  const tips = parseMaybeJson(task?.promptTips);
  const reason = parseMaybeJson(task?.failedReason);

  if (tips && typeof tips === 'object' && tips.node_errors && typeof tips.node_errors === 'object') {
    Object.keys(tips.node_errors).forEach(id => nodes.add(String(id)));
  }

  const visit = (value, depth=0) => {
    if (value == null || depth > 6) return;

    if (Array.isArray(value)) {
      value.forEach(v => visit(v, depth + 1));
      return;
    }

    if (typeof value !== 'object') return;

    for (const [key,val] of Object.entries(value)) {
      if (/^(nodeId|node_id)$/i.test(key) && val != null && val !== '') {
        nodes.add(String(val));
      } else if (/^\d+$/.test(key) && val && typeof val === 'object') {
        nodes.add(key);
      }
      visit(val, depth + 1);
    }
  };

  visit(reason);
  return [...nodes];
}

function failureHtml(task, message) {
  const errorCode = String(task?.errorCode || '').trim();
  const errorMessage = String(message || task?.errorMessage || 'RunningHub 返回任务失败。').trim();
  const nodes = collectFailureNodes(task);
  const failedReason = formatDiagnostic(task?.failedReason);
  const promptTips = formatDiagnostic(task?.promptTips);

  let details = '';
  if (errorCode) {
    details += '<div class="failure-row"><span>ERROR CODE</span><b>' + esc(errorCode) + '</b></div>';
  }
  if (nodes.length) {
    details += '<div class="failure-row"><span>出错节点</span><b>' + esc(nodes.join(', ')) + '</b></div>';
  }
  if (failedReason) {
    details += '<details class="failure-detail" open><summary>failedReason</summary><pre>' + esc(failedReason) + '</pre></details>';
  }
  if (promptTips) {
    details += '<details class="failure-detail"><summary>promptTips</summary><pre>' + esc(promptTips) + '</pre></details>';
  }

  return (
    '<div class="error-state diagnostic-error">' +
      '<div class="empty-mark">!</div>' +
      '<strong>生成失败</strong>' +
      '<span class="failure-message">' + esc(errorMessage) + '</span>' +
      (details ? '<div class="failure-diagnostics">' + details + '</div>' : '') +
    '</div>'
  );
}

function statusClass(dot, status) {
  dot.className = 'status-dot';
  if (['RUNNING','QUEUED','UPLOADING','SUBMITTING'].includes(status)) dot.classList.add('running');
  if (status === 'SUCCESS') dot.classList.add('success');
  if (status === 'FAILED') dot.classList.add('failed');
}

function triggerDownload(outputState, button, prefix) {
  if (!outputState.outputUrl) return;

  const original = button.innerHTML;
  button.disabled = true;
  button.innerHTML = '<span>下载中</span><b>↓</b>';

  try {
    const ext = (outputState.outputType || 'bin').replace(/[^a-z0-9]/gi,'') || 'bin';
    const a = document.createElement('a');
    a.href = outputState.outputUrl;
    a.download = prefix + '.' + ext;
    a.rel = 'noreferrer';
    document.body.appendChild(a);
    a.click();
    a.remove();
    toast('已开始下载','good');
  } catch {
    const fallback = outputState.outputSourceUrl || outputState.outputUrl;
    window.open(fallback, '_blank', 'noopener,noreferrer');
    toast('下载失败，已打开原文件','bad');
  } finally {
    setTimeout(() => {
      button.disabled = !outputState.outputUrl;
      button.innerHTML = original;
    }, 450);
  }
}

$('#toggleKey').onclick = () => {
  const input = $('#apiKeyInput');
  input.type = input.type === 'password' ? 'text' : 'password';
  $('#toggleKey').textContent = input.type === 'password' ? '显示' : '隐藏';
};

$('#saveKey').onclick = () => {
  const value = $('#apiKeyInput').value.trim();
  if (!value) return toast('请输入 API Key','bad');

  localStorage.setItem(LS.key,value);
  $('#apiKeyInput').value = '';
  updateKeyUI();
  restoreRuntimeTasks('');
  toast('API Key 已保存到当前浏览器','good');
};

$('#clearKey').onclick = () => {
  localStorage.removeItem(LS.key);
  $('#apiKeyInput').value = '';
  updateKeyUI();
  toast('API Key 已清除');
};

$('#clearLocal').onclick = () => {
  [LS.active, LS.longH3Config, LS.h3V2Config, LS.qwenEditorialPrompt,
    LS.qwenEditorialAspect, LS.appFilter, LS.inst, LS.runtimeTasks]
    .forEach(key => localStorage.removeItem(key));
  Object.keys(state.files).forEach(slot => clearFile(slot));
  loadConfig();
  renderQwenEditorialIdle();
  renderLongH3Idle();
  renderH3V2Idle();
  clearAllLongH3Images().catch(()=>{});
  h3V2ClearAllMedia().catch(()=>{});
  qwenEditorialClearAllMedia().catch(()=>{});
  renderAppFilter('all', false, false);
  setActiveApp(APP_KEYS.qwenEditorial);
  toast('本地应用配置已重置');
};

loadConfig();
updateKeyUI();
Object.keys(MEDIA).forEach(renderFileSlot);
restoreLongH3Images().catch(()=>{});
h3V2RestoreMedia().catch(()=>{});
qwenEditorialRestoreMedia().catch(()=>{});
ensureMaterialLibrary().catch(() => updateMaterialLibraryBadges());
renderQwenEditorialIdle();
renderLongH3Idle();
renderH3V2Idle();

const params = new URLSearchParams(window.location.search);
const requestedApp = params.get('app');
const recoveryTaskId = (!requestedApp || APPS[requestedApp]) ? params.get('task') : '';
const initialApp = APPS[requestedApp]
  ? requestedApp
  : (APPS[localStorage.getItem(LS.active)] ? localStorage.getItem(LS.active) : APP_KEYS.qwenEditorial);

setActiveApp(initialApp, false);
if (requestedApp && !APPS[requestedApp]) toast('这个应用已移除，已有结果仍可在生成记录中查看');
renderAppFilter(state.appFilter, false, true);
restoreRuntimeTasks(recoveryTaskId ? initialApp : '');

window.addEventListener('pageshow', event => {
  if (event.persisted) restoreRuntimeTasks('');
});

if (recoveryTaskId) {
  const view = runtimeViews()[initialApp] || runtimeViews()[APP_KEYS.qwenEditorial];
  const snapshot = {
    taskId:recoveryTaskId,
    status:'RUNNING',
    results:[],
    errorCode:'',
    errorMessage:'',
    createdAt:Date.now(),
    updatedAt:Date.now()
  };

  view.state.task = snapshot;
  view.renderLoading('RUNNING', recoveryTaskId);
  saveRuntimeTask(initialApp, snapshot);

  if (!apiKey()) {
    toast('请先在设置中保存 API Key，再恢复任务', 'bad');
  } else {
    clearInterval(view.state.poll);
    view.state.poll = setInterval(() => view.query(recoveryTaskId), 3000);
    view.query(recoveryTaskId);
  }
}
