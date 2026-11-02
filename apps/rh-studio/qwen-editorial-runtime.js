// Standalone runtime for RunningHub Qwen Image 2.1 fixed dual-LoRA editor.
// Uses RH Studio shared upload, task polling, history, preview and download helpers.
const qwenEditorialState = {
  task:null, poll:null, running:false, queryPending:false,
  outputUrl:'', outputSourceUrl:'', outputType:''
};
let qwenEditorialDbPromise = null;

function qwenEditorialSaveConfig() {
  localStorage.setItem(LS.qwenEditorialPrompt, $('#qwenEditorialPromptInput').value);
  localStorage.setItem(LS.qwenEditorialAspect, $('#qwenEditorialAspectRatio').value);
  $('#qwenEditorialPromptCount').textContent = String($('#qwenEditorialPromptInput').value.length);
}
function qwenEditorialLoadConfig() {
  $('#qwenEditorialPromptInput').value = localStorage.getItem(LS.qwenEditorialPrompt) || '';
  const aspect = localStorage.getItem(LS.qwenEditorialAspect);
  $('#qwenEditorialAspectRatio').value = QWEN_EDITORIAL_ASPECTS.includes(aspect)
    ? aspect : '9:16 (Portrait Widescreen)';
  $('#qwenEditorialPromptCount').textContent = String($('#qwenEditorialPromptInput').value.length);
}
function qwenEditorialStatus(status, meta='') {
  const labels = {
    IDLE:'等待生成', UPLOADING:'上传参考图', SUBMITTING:'提交任务',
    QUEUED:'排队中', RUNNING:'生成中', SUCCESS:'生成完成', FAILED:'生成失败'
  };
  statusClass($('#qwenEditorialStatusDot'), status);
  $('#qwenEditorialStatusText').textContent = labels[status] || status;
  $('#qwenEditorialTaskMeta').textContent = meta || 'READY';
}
function qwenEditorialDownload(url='', type='') {
  qwenEditorialState.outputSourceUrl = url || '';
  qwenEditorialState.outputUrl = toMediaUrl(url || '');
  qwenEditorialState.outputType = String(type || 'png');
  $('#qwenEditorialDownloadBtn').disabled = !qwenEditorialState.outputUrl;
}
function renderQwenEditorialIdle() {
  qwenEditorialStatus('IDLE');
  qwenEditorialDownload();
  $('#qwenEditorialResultArea').innerHTML =
    '<div class="empty-state"><div class="empty-mark">＋</div>' +
    '<strong>准备生成时尚摄影作品</strong><span>输入提示词即可生成，也可以上传参考图。</span></div>';
}
function renderQwenEditorialLoading(status, taskId) {
  qwenEditorialStatus(status, taskId ? 'TASK · ' + taskId : 'PROCESSING');
  qwenEditorialDownload();
  $('#qwenEditorialResultArea').innerHTML =
    '<div class="loading-state"><div class="loading-mark"></div>' +
    '<strong>' + (status === 'UPLOADING' ? '正在上传参考图' : status === 'QUEUED' ? '任务正在排队' : '图片正在生成') +
    '</strong><span>任务提交后，每 3 秒自动查询状态。</span></div>';
}
function renderQwenEditorialSuccess(task) {
  const results = Array.isArray(task?.results) ? task.results : [];
  const images = results.filter(item => isImage(item) && item?.url);
  const primary = images[0] || results.find(item => item?.url || item?.text);
  qwenEditorialStatus('SUCCESS', task?.taskId ? 'TASK · ' + task.taskId : 'DONE');
  qwenEditorialDownload(primary?.url || '', primary?.outputType || 'png');

  const area = $('#qwenEditorialResultArea');
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
function renderQwenEditorialFailed(task, message) {
  qwenEditorialStatus('FAILED', task?.taskId ? 'TASK · ' + task.taskId : 'ERROR');
  qwenEditorialDownload();
  $('#qwenEditorialResultArea').innerHTML = failureHtml(task, message || task?.errorMessage || '图片生成失败');
}
async function runQwenEditorialTask() {
  if (qwenEditorialState.running) return;
  const key = apiKey();
  if (!key) {
    toast('请先在设置中保存 RunningHub API Key', 'bad');
    openSettings();
    return;
  }
  const prompt = $('#qwenEditorialPromptInput').value.trim();
  if (!prompt) {
    toast('请输入图片编辑提示词', 'bad');
    $('#qwenEditorialPromptInput').focus();
    return;
  }
  const files = Object.keys(QWEN_EDITORIAL_MEDIA).map(slot => state.files[slot] || null);

  qwenEditorialState.running = true;
  qwenEditorialState.task = null;
  clearRuntimeTask(APP_KEYS.qwenEditorial);
  clearInterval(qwenEditorialState.poll);
  qwenEditorialState.poll = null;
  $('#qwenEditorialRunBtn').disabled = true;
  $('.qwen-editorial-generate-label').textContent = '准备任务…';
  qwenEditorialDownload();
  try {
    const uploaded = Array(6).fill('None');
    const selectedCount = files.filter(Boolean).length;
    let count = 0;
    for (let i=0; i<files.length; i++) {
      if (!files[i]) continue;
      count++;
      renderQwenEditorialLoading('UPLOADING');
      qwenEditorialStatus('UPLOADING', count + ' / ' + selectedCount);
      $('.qwen-editorial-generate-label').textContent = '上传参考图 ' + count + '/' + selectedCount;
      uploaded[i] = await uploadFile(files[i], key);
    }
    qwenEditorialStatus('SUBMITTING', 'RUNNINGHUB');
    $('.qwen-editorial-generate-label').textContent = '提交任务…';
    const data = await runRHApp(
      QWEN_EDITORIAL_APP_ID,
      qwenEditorialBuildNodes(uploaded, {
        prompt, aspect:$('#qwenEditorialAspectRatio').value
      })
    );
    qwenEditorialState.task = data;
    upsertHistory(APP_KEYS.qwenEditorial, data, {
      createdAt:Date.now(),
      aspect:$('#qwenEditorialAspectRatio').value,
      prompt:prompt.slice(0,120),
      instance:instanceLabel($('#instanceType').value)
    });
    if (data.status === 'SUCCESS') renderQwenEditorialSuccess(data);
    else if (data.status === 'FAILED') renderQwenEditorialFailed(data);
    else {
      renderQwenEditorialLoading(data.status || 'RUNNING', data.taskId);
      qwenEditorialState.poll = setInterval(() => queryQwenEditorialTask(data.taskId), 3000);
    }
    toast('高对比时尚摄影任务已提交', 'good');
  } catch (error) {
    renderQwenEditorialFailed(qwenEditorialState.task, error?.message || '运行失败');
    toast(error?.message || '运行失败', 'bad');
  } finally {
    qwenEditorialState.running = false;
    $('#qwenEditorialRunBtn').disabled = false;
    $('.qwen-editorial-generate-label').textContent = '开始生成';
  }
}
async function queryQwenEditorialTask(taskId) {
  if (qwenEditorialState.queryPending) return;
  qwenEditorialState.queryPending = true;
  try {
    const data = await queryRH(taskId);
    qwenEditorialState.task = data;
    upsertHistory(APP_KEYS.qwenEditorial, data, {taskId});
    if (data.status === 'SUCCESS' || data.status === 'FAILED') {
      clearInterval(qwenEditorialState.poll);
      qwenEditorialState.poll = null;
      if (data.status === 'SUCCESS') renderQwenEditorialSuccess(data);
      else renderQwenEditorialFailed(data);
      toast(data.status === 'SUCCESS' ? '图片生成完成' : '图片生成失败',
        data.status === 'SUCCESS' ? 'good' : 'bad');
    } else {
      renderQwenEditorialLoading(data.status || 'RUNNING', data.taskId || taskId);
    }
  } catch (error) {
    qwenEditorialStatus('RUNNING', '查询异常，将继续重试 · TASK ' + taskId);
    console.warn('[QWEN_EDITORIAL_QUERY]', String(error?.message || '查询失败'));
  } finally {
    qwenEditorialState.queryPending = false;
  }
}

function qwenEditorialOpenDb() {
  if (qwenEditorialDbPromise) return qwenEditorialDbPromise;
  if (!('indexedDB' in window)) return Promise.reject(new Error('浏览器不支持 IndexedDB'));
  qwenEditorialDbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open('rhstudio-qwen-editorial-materials', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('media', {keyPath:'slot'});
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      qwenEditorialDbPromise = null;
      reject(request.error);
    };
  });
  return qwenEditorialDbPromise;
}
async function qwenEditorialSaveMedia(slot, file) {
  if (!QWEN_EDITORIAL_MEDIA[slot]) return;
  const db = await qwenEditorialOpenDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('media', 'readwrite');
    tx.objectStore('media').put({slot, file});
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}
async function qwenEditorialRemoveMedia(slot) {
  if (!QWEN_EDITORIAL_MEDIA[slot]) return;
  const db = await qwenEditorialOpenDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('media', 'readwrite');
    tx.objectStore('media').delete(slot);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}
async function qwenEditorialClearAllMedia() {
  const db = await qwenEditorialOpenDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('media', 'readwrite');
    tx.objectStore('media').clear();
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}
async function qwenEditorialRestoreMedia() {
  const db = await qwenEditorialOpenDb();
  const records = await new Promise((resolve, reject) => {
    const request = db.transaction('media').objectStore('media').getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
  records.forEach(({slot, file}) => {
    if (!QWEN_EDITORIAL_MEDIA[slot] || !file || state.files[slot]) return;
    state.files[slot] = file;
    state.objectUrls[slot] = URL.createObjectURL(file);
    renderFileSlot(slot);
  });
}

// This runtime loads before app.js, which declares the dollar selector.
// Use native DOM methods at script evaluation to avoid early ReferenceError.
document.getElementById('qwenEditorialPromptInput').addEventListener('input', qwenEditorialSaveConfig);
document.getElementById('qwenEditorialAspectRatio').addEventListener('change', qwenEditorialSaveConfig);
document.getElementById('qwenEditorialRunBtn').addEventListener('click', runQwenEditorialTask);
document.getElementById('qwenEditorialDownloadBtn').addEventListener('click', () =>
  triggerDownload(qwenEditorialState, document.getElementById('qwenEditorialDownloadBtn'), 'rh-studio-qwen-editorial')
);
document.querySelectorAll('#workspaceQwenEditorial .upload-slot[data-slot]').forEach(el => {
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
