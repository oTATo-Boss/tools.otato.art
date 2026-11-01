// Standalone runtime for RunningHub Qwen Image 2.1 fixed dual-LoRA editor.
// Uses RH Studio shared upload, task polling, history, preview and download helpers.
const qwenNsfwState = {
  task:null, poll:null, running:false, queryPending:false,
  outputUrl:'', outputSourceUrl:'', outputType:''
};
let qwenNsfwDbPromise = null;

function qwenNsfwSaveConfig() {
  localStorage.setItem(LS.qwenNsfwPrompt, $('#qwenNsfwPromptInput').value);
  localStorage.setItem(LS.qwenNsfwAspect, $('#qwenNsfwAspectRatio').value);
  $('#qwenNsfwPromptCount').textContent = String($('#qwenNsfwPromptInput').value.length);
}
function qwenNsfwLoadConfig() {
  $('#qwenNsfwPromptInput').value = localStorage.getItem(LS.qwenNsfwPrompt) || '';
  const aspect = localStorage.getItem(LS.qwenNsfwAspect);
  $('#qwenNsfwAspectRatio').value = QWEN_NSFW_ASPECTS.includes(aspect)
    ? aspect : '9:16 (Portrait Widescreen)';
  $('#qwenNsfwPromptCount').textContent = String($('#qwenNsfwPromptInput').value.length);
}
function qwenNsfwStatus(status, meta='') {
  const labels = {
    IDLE:'等待生成', UPLOADING:'上传参考图', SUBMITTING:'提交任务',
    QUEUED:'排队中', RUNNING:'生成中', SUCCESS:'生成完成', FAILED:'生成失败'
  };
  statusClass($('#qwenNsfwStatusDot'), status);
  $('#qwenNsfwStatusText').textContent = labels[status] || status;
  $('#qwenNsfwTaskMeta').textContent = meta || 'READY';
}
function qwenNsfwDownload(url='', type='') {
  qwenNsfwState.outputSourceUrl = url || '';
  qwenNsfwState.outputUrl = toMediaUrl(url || '');
  qwenNsfwState.outputType = String(type || 'png');
  $('#qwenNsfwDownloadBtn').disabled = !qwenNsfwState.outputUrl;
}
function renderQwenNsfwIdle() {
  qwenNsfwStatus('IDLE');
  qwenNsfwDownload();
  $('#qwenNsfwResultArea').innerHTML =
    '<div class="empty-state"><div class="empty-mark">＋</div>' +
    '<strong>准备编辑图片</strong><span>上传参考图并输入提示词，生成图片会显示在这里。</span></div>';
}
function renderQwenNsfwLoading(status, taskId) {
  qwenNsfwStatus(status, taskId ? 'TASK · ' + taskId : 'PROCESSING');
  qwenNsfwDownload();
  $('#qwenNsfwResultArea').innerHTML =
    '<div class="loading-state"><div class="loading-mark"></div>' +
    '<strong>' + (status === 'UPLOADING' ? '正在上传参考图' : status === 'QUEUED' ? '任务正在排队' : '图片正在生成') +
    '</strong><span>任务提交后，每 3 秒自动查询状态。</span></div>';
}
function renderQwenNsfwSuccess(task) {
  const results = Array.isArray(task?.results) ? task.results : [];
  const images = results.filter(item => isImage(item) && item?.url);
  const primary = images[0] || results.find(item => item?.url || item?.text);
  qwenNsfwStatus('SUCCESS', task?.taskId ? 'TASK · ' + task.taskId : 'DONE');
  qwenNsfwDownload(primary?.url || '', primary?.outputType || 'png');

  const area = $('#qwenNsfwResultArea');
  if (images.length > 1) {
    area.innerHTML = '<div class="image-result-grid">' +
      images.map(item => generatedImageTag(item.url)).join('') + '</div>';
    bindGeneratedImageFallbacks(area);
  } else if (images.length === 1) {
    area.innerHTML = generatedImageTag(images[0].url);
    bindGeneratedImageFallbacks(area);
  } else if (primary?.text) {
    area.innerHTML = '<div class="file-state"><strong>' + esc(primary.text) + '</strong></div>';
  } else if (primary?.url) {
    const original = String(primary.url);
    const safe = /^https:\/\//i.test(original) ? original : '';
    area.innerHTML = safe
      ? '<div class="file-state"><a href="' + esc(safe) +
        '" target="_blank" rel="noopener noreferrer">查看生成文件</a></div>'
      : '<div class="empty-state"><strong>任务已完成</strong><span>返回了无法预览的文件。</span></div>';
  } else {
    area.innerHTML = '<div class="empty-state"><strong>任务已完成</strong><span>没有返回图片结果。</span></div>';
  }
}
function renderQwenNsfwFailed(task, message) {
  qwenNsfwStatus('FAILED', task?.taskId ? 'TASK · ' + task.taskId : 'ERROR');
  qwenNsfwDownload();
  $('#qwenNsfwResultArea').innerHTML = failureHtml(task, message || task?.errorMessage || '图片生成失败');
}
async function runQwenNsfwTask() {
  if (qwenNsfwState.running) return;
  const key = apiKey();
  if (!key) {
    toast('请先在设置中保存 RunningHub API Key', 'bad');
    openSettings();
    return;
  }
  const prompt = $('#qwenNsfwPromptInput').value.trim();
  if (!prompt) {
    toast('请输入图片编辑提示词', 'bad');
    $('#qwenNsfwPromptInput').focus();
    return;
  }
  const files = Object.keys(QWEN_NSFW_MEDIA).map(slot => state.files[slot] || null);
  if (!files[0]) {
    toast('请从参考图 1 开始上传图片', 'bad');
    return;
  }

  qwenNsfwState.running = true;
  qwenNsfwState.task = null;
  clearRuntimeTask(APP_KEYS.qwenNsfw);
  clearInterval(qwenNsfwState.poll);
  qwenNsfwState.poll = null;
  $('#qwenNsfwRunBtn').disabled = true;
  $('.qwen-nsfw-generate-label').textContent = '准备任务…';
  qwenNsfwDownload();
  try {
    const uploaded = Array(6).fill('None');
    const selectedCount = files.filter(Boolean).length;
    let count = 0;
    for (let i=0; i<files.length; i++) {
      if (!files[i]) continue;
      count++;
      renderQwenNsfwLoading('UPLOADING');
      qwenNsfwStatus('UPLOADING', count + ' / ' + selectedCount);
      $('.qwen-nsfw-generate-label').textContent = '上传参考图 ' + count + '/' + selectedCount;
      uploaded[i] = await uploadFile(files[i], key);
    }
    qwenNsfwStatus('SUBMITTING', 'RUNNINGHUB');
    $('.qwen-nsfw-generate-label').textContent = '提交任务…';
    const data = await runRHApp(
      QWEN_NSFW_APP_ID,
      qwenNsfwBuildNodes(uploaded, {
        prompt, aspect:$('#qwenNsfwAspectRatio').value
      })
    );
    qwenNsfwState.task = data;
    upsertHistory(APP_KEYS.qwenNsfw, data, {
      createdAt:Date.now(),
      aspect:$('#qwenNsfwAspectRatio').value,
      prompt:prompt.slice(0,120),
      instance:instanceLabel($('#instanceType').value)
    });
    if (data.status === 'SUCCESS') renderQwenNsfwSuccess(data);
    else if (data.status === 'FAILED') renderQwenNsfwFailed(data);
    else {
      renderQwenNsfwLoading(data.status || 'RUNNING', data.taskId);
      qwenNsfwState.poll = setInterval(() => queryQwenNsfwTask(data.taskId), 3000);
    }
    toast('Qwen 双 LoRA 图片任务已提交', 'good');
  } catch (error) {
    renderQwenNsfwFailed(qwenNsfwState.task, error?.message || '运行失败');
    toast(error?.message || '运行失败', 'bad');
  } finally {
    qwenNsfwState.running = false;
    $('#qwenNsfwRunBtn').disabled = false;
    $('.qwen-nsfw-generate-label').textContent = '开始生成';
  }
}
async function queryQwenNsfwTask(taskId) {
  if (qwenNsfwState.queryPending) return;
  qwenNsfwState.queryPending = true;
  try {
    const data = await queryRH(taskId);
    qwenNsfwState.task = data;
    upsertHistory(APP_KEYS.qwenNsfw, data, {taskId});
    if (data.status === 'SUCCESS' || data.status === 'FAILED') {
      clearInterval(qwenNsfwState.poll);
      qwenNsfwState.poll = null;
      if (data.status === 'SUCCESS') renderQwenNsfwSuccess(data);
      else renderQwenNsfwFailed(data);
      toast(data.status === 'SUCCESS' ? '图片生成完成' : '图片生成失败',
        data.status === 'SUCCESS' ? 'good' : 'bad');
    } else {
      renderQwenNsfwLoading(data.status || 'RUNNING', data.taskId || taskId);
    }
  } catch (error) {
    qwenNsfwStatus('RUNNING', '查询异常，将继续重试 · TASK ' + taskId);
    console.warn('[QWEN_NSFW_QUERY]', String(error?.message || '查询失败'));
  } finally {
    qwenNsfwState.queryPending = false;
  }
}

function qwenNsfwOpenDb() {
  if (qwenNsfwDbPromise) return qwenNsfwDbPromise;
  if (!('indexedDB' in window)) return Promise.reject(new Error('浏览器不支持 IndexedDB'));
  qwenNsfwDbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open('rhstudio-qwen-nsfw-materials', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('media', {keyPath:'slot'});
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      qwenNsfwDbPromise = null;
      reject(request.error);
    };
  });
  return qwenNsfwDbPromise;
}
async function qwenNsfwSaveMedia(slot, file) {
  if (!QWEN_NSFW_MEDIA[slot]) return;
  const db = await qwenNsfwOpenDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('media', 'readwrite');
    tx.objectStore('media').put({slot, file});
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}
async function qwenNsfwRemoveMedia(slot) {
  if (!QWEN_NSFW_MEDIA[slot]) return;
  const db = await qwenNsfwOpenDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('media', 'readwrite');
    tx.objectStore('media').delete(slot);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}
async function qwenNsfwClearAllMedia() {
  const db = await qwenNsfwOpenDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('media', 'readwrite');
    tx.objectStore('media').clear();
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}
async function qwenNsfwRestoreMedia() {
  const db = await qwenNsfwOpenDb();
  const records = await new Promise((resolve, reject) => {
    const request = db.transaction('media').objectStore('media').getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
  records.forEach(({slot, file}) => {
    if (!QWEN_NSFW_MEDIA[slot] || !file || state.files[slot]) return;
    state.files[slot] = file;
    state.objectUrls[slot] = URL.createObjectURL(file);
    renderFileSlot(slot);
  });
}

$('#qwenNsfwPromptInput').addEventListener('input', qwenNsfwSaveConfig);
$('#qwenNsfwAspectRatio').addEventListener('change', qwenNsfwSaveConfig);
$('#qwenNsfwRunBtn').addEventListener('click', runQwenNsfwTask);
$('#qwenNsfwDownloadBtn').addEventListener('click', () =>
  triggerDownload(qwenNsfwState, $('#qwenNsfwDownloadBtn'), 'rh-studio-qwen-nsfw')
);
document.querySelectorAll('#workspaceQwenNsfw .upload-slot[data-slot]').forEach(el => {
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
    if (mediaKindFromFile(file) !== 'image') return toast('请上传图片文件', 'bad');
    setFile(el.dataset.slot, file);
  });
});
