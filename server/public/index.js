function handleError$1(message) {
    console.error(message);
}

const FILE_STATUS = {
    PENDING: 'pending', // 默认状态
    UPLOADED: 'uploaded', // 上传完成
    UPLOADING: 'uploading',// 上传中
    PAUSED: 'paused', // 暂停
    UPLOADED: 'completed', // 完成
    Error: 'error', // 错误
    CANCELLED: 'cancelled', // 取消
};

function validateFile(file, option) {
    // 文件类型校验
    const ext = file.name.split('.').pop().toLowerCase();
    if (!option.allowedTypes.includes('*') && 
        !option.allowedTypes.includes(ext))
    {
        handleError(`${file.name}文件类型不支持`);
      return false;
    }
  
    // 文件大小校验
    if (file.size > option.maxSize) {
        handleError(`${file.name}文件超过大小限制 (${formatSize(option.maxSize)})`);
      return false;
    }
  
    return true;
  }


  function getProgress(fileInfo) {
    const {uploadedChunks, chunks} = fileInfo;
    return (uploadedChunks.size / chunks.length) * 100;
  }
  function getSeed(fileInfo) {
    const {startTime, file, progress} = fileInfo;
    const cureent = Date.now();
    const elapsed = (cureent - startTime) / 1000;
    const uploaded = (progress / 100) * file.size;
    const speed = elapsed > 0 ? uploaded / elapsed : 0;

    return speed;
  }

  // 辅助方法：计算剩余时间
function calculateETA(uploaded, total, speed) {
  if (speed === 0) return '--';
  const remaining = total - uploaded;
  const seconds = Math.ceil(remaining / speed);
  return `${Math.floor(seconds / 60)}分${seconds % 60}秒`;
}

function formatSpeed(bytesPerSecond) {
  if (bytesPerSecond === 0) return '0 B/s';
  const units = ['B/s', 'KB/s', 'MB/s'];
  let unitIndex = 0;
  while (bytesPerSecond >= 1024 && unitIndex < units.length - 1) {
    bytesPerSecond /= 1024;
    unitIndex++;
  }
  return `${bytesPerSecond.toFixed(1)} ${units[unitIndex]}`;
}

function formatSize$1(size) {
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let i = 0;
    while (size >= 1024 && i < units.length - 1) {
        size /= 1024;
        i++;
    }
    return size.toFixed(2) + ' ' + units[i];
}


/**
 * 将数组分割成多个指定大小的子数组块
 * @param {Array} array - 需要分割的原始数组
 * @param {number} size - 每个子数组块的大小（正整数）
 * @returns {Array<Array>} 分割后的子数组块组成的数组
 */
function chunkArray(array, size) {
    // 处理空数组的情况
    if (array.length === 0) {
        return [];
    }
  
    // 计算需要分割的块数
    const chunkCount = Math.ceil(array.length / size);
    const result = [];
  
    // 循环分割数组
    for (let i = 0; i < chunkCount; i++) {
        const start = i * size;
        const end = start + size;
        const chunk = array.slice(start, end);
        result.push(chunk);
    }
  
    return result;
}

const globalOptions = {};

function setGlobalOptions(options) {
    Object.assign(globalOptions, options);
}

function createChunks(file) {
    const chunks = [];
    let offset = 0;
    
    while (offset < file.size) {
      const end = offset + globalOptions.chunkSize;
      chunks.push({
        index: chunks.length,
        start: offset,
        end,
        blob: file.slice(offset, end),
        hash: null, // 可在后续计算分片哈希
        status: FILE_STATUS.PENDING,
      });
      offset = end;
    }

    return chunks;
}

function rechunkRemainingFile(file, chunks, uploadedChunks, newChunkSize) {
    // 确定已上传的总字节数
    let uploadedSize = chunks
        .filter(chunk => chunk.status === FILE_STATUS.SUCCESS)
        .reduce((size, chunk) => size + (chunk.end - chunk.start), 0);

    // 剩余未上传的文件部分
    let remainingFile = file.slice(uploadedSize);

    // 使用新的 chunkSize 对剩余文件部分进行切片
    let newChunks = [];
    let offset = 0;

    const lastChunkIndex = Math.max(...uploadedChunks);

    while (offset < remainingFile.size) {
        const end = offset + newChunkSize;
        newChunks.push({
            index: lastChunkIndex + newChunks.length,
            start: uploadedSize + offset, // 注意这里要使用原始文件的偏移量
            end: uploadedSize + end,
            blob: remainingFile.slice(offset, end),
            hash: null,
            status: FILE_STATUS.PENDING,
        });
        offset = end;
    }

    return newChunks;
}

function createFileItem(fileId) {
  const fileInfo = uploadQueue.get(fileId);
  if (!fileInfo) return;

  const container = document.getElementById('uploadList');
  // 创建列表项容器
  const listItem = document.createElement('div');
  listItem.className = 'file-item';
  listItem.dataset.fileId = fileId;
  listItem.innerHTML = `
    <div class="file-header">
      <div class="file-meta">
        <span class="file-name">${fileInfo.file.name}</span>
        <span class="file-size">${formatSize$1(fileInfo.file.size)}</span>
      </div>
      <div class="file-actions">
        <button class="pause-btn" title="暂停/继续">⏯</button>
        <button class="cancel-btn" title="取消上传">✕</button>
      </div>
    </div>
    <div class="progress-container">
      <div class="progress-bar" style="width: 0"></div>
      <div class="progress-text">0%</div>
    </div>
    <div class="status-info">
      <span class="speed">速度: 0 KB/s</span>
      <span class="eta">剩余时间: --</span>
      <span class="status-indicator">等待中</span>
    </div>
  `;

  container.appendChild(listItem);

  return listItem;
}

function updateFileStatus(fileId, status, message) {
  const fileInfo = uploadQueue.get(fileId);
  const listItem = document.querySelector(`[data-file-id="${fileId}"]`);
  if (!listItem || !fileInfo) return;

  const statusIndicator = listItem.querySelector('.status-indicator');
  const progressBar = listItem.querySelector('.progress-bar');
  const progressText = listItem.querySelector('.progress-text');
  const pauseBtn = listItem.querySelector('.pause-btn');

  // 状态样式更新
  listItem.className = `file-item status-${status}`;
  
  switch(status) {
    case FILE_STATUS.UPLOADING:
      statusIndicator.textContent = message || '上传中...';
      pauseBtn.textContent = '⏸';
      break;
    case FILE_STATUS.PAUSED:
      statusIndicator.textContent = message || '已暂停';
      pauseBtn.textContent = '▶';
      break;
    case FILE_STATUS.UPLOADED:
      statusIndicator.textContent = '上传完成';
      progressBar.style.width = '100%';
      progressText.textContent = '100%';
      listItem.querySelector('.file-actions').remove();
      listItem.querySelector('.speed').remove();
      listItem.querySelector('.eta').remove();
      break;
    case FILE_STATUS.ERROR:
      statusIndicator.textContent = `错误: ${message}`;
      listItem.classList.add('error');
      break;
    case FILE_STATUS.CANCELLED: 
      statusIndicator.textContent = '已取消';
      listItem.classList.add('cancelled');
      listItem.querySelector('.file-actions').remove();
      listItem.querySelector('.speed').remove();
      listItem.querySelector('.eta').remove();
      listItem.querySelector('.progress-bar').classList.add('progress-cancelled');
      break;
    default:
      statusIndicator.textContent = message || '等待开始';
  }
}

function updateProgress(fileId) {
  const fileInfo = uploadQueue.get(fileId);
  const listItem = document.querySelector(`[data-file-id="${fileId}"]`);
  
  if (!listItem || !fileInfo) return;

  // 计算进度
  const progress = fileInfo.progress;
  const progressBar = listItem.querySelector('.progress-bar');
  const progressText = listItem.querySelector('.progress-text');
  
  // 进度条动画
  progressBar.style.width = `${progress.toFixed(1)}%`;
  progressText.textContent = `${progress.toFixed(1)}%`;

  if (fileInfo.status === FILE_STATUS.UPLOADED) {
    return;
  }
  
  const uploaded = (progress / 100) * fileInfo.file.size;
  // 计算上传速度
  const speed = fileInfo.speed;
  
  // 更新统计信息
  const speedElement = listItem.querySelector('.speed');
  const etaElement = listItem.querySelector('.eta');
  
  speedElement.textContent = `速度: ${formatSpeed(speed)}`;
  etaElement.textContent = `剩余时间: ${calculateETA(uploaded, fileInfo.file.size, speed)}`;
}

/**
 * 生成文件的哈希值（使用 Web Worker）
 * @param {File} file - 需要计算哈希的文件对象
 * @param {number} [chunkSize=2 * 1024 * 1024] - 分片大小（默认2MB）
 * @returns {Promise<string>} - 返回包含文件哈希的Promise
 */
function generateFileHash(file, chunkSize = 2097152) {
  return new Promise((resolve, reject) => {
    if (!file) {
      reject(new Error('无效的文件对象'));
      return;
    }

    try {
      // 创建 Web Worker
      const worker = new Worker('./hash.worker.js');
      // 发送文件信息和分片大小
        worker.postMessage({
          file,
          chunkSize
        });

        // 接收 Worker 消息
        worker.onmessage = (event) => {
          const data = event.data;

          switch (data.type) {
            case 'progress':
              console.log(`计算进度: ${(data.value * 100).toFixed(1)}%`);
              break;
            case 'hash':
              worker.terminate();
              resolve(data.value);
              break;
            case 'error':
              worker.terminate();
              reject(new Error(data.message));
              break;
          }
        };

        // 错误处理
        worker.onerror = (error) => {
          worker.terminate();
          reject(new Error(`Worker 错误: ${error.message}`));
        };
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * 检查服务器上的文件上传状态
 * @param {string} fileId - 文件唯一标识
 * @returns {Promise<{exists: boolean, uploadedChunks: number[]}>}
 */
async function checkServerStatus(fileId) {
  let attempt = 0;

  while (attempt < globalOptions.maxRetries) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(`${globalOptions.server.check}?fileId=${fileId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-Request-ID': crypto.randomUUID()
        },
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP错误: ${response.status}`);
      }

      const data = await response.json();

      // 验证响应数据格式
      if (!Array.isArray(data?.uploadedChunks)) {
        throw new Error('无效的服务器响应格式');
      }

      return {
        exists: data.uploadedChunks.length > 0,
        uploadedChunks: data.uploadedChunks
      };
    } catch (error) {
      attempt++;
      if (attempt >= maxRetries) {
        throw normalizeError(error);
      }
    }
  }
}

/**
 * 标准化错误处理
 * @param {Error} error - 原始错误对象
 */
function normalizeError(error) {
  if (error.name === 'AbortError') {
    return new Error('请求超时，请检查网络连接');
  }
  if (error.message.includes('Failed to fetch')) {
    return new Error('网络连接失败');
  }
  return error;
}

const uploadQueue = new Map();

function createFileInfo(file) {
  return {
    //上传文件
    file,
    // 文件名称
    name: file.name,
    // 文件大小
    size: file.size,
    // 文件类型
    type: file.type,
    // 分片信息
    chunks: createChunks(file),
    // 已上传分片集合
    uploadedChunks: new Set(),
    status: FILE_STATUS.PENDING,
    // 重试次数
    retryCount: 0,
    progress: 0, // 上传进度
    speed: 0, // 上传速度
    // 上传开始时间戳
    startTime: Date.now(),
    // 上次更新时间戳
    lastTime: Date.now(),
    abortControllers: new Map(),
  };}

async function handleFiles(files) {
    // 转换为数组并过滤无效文件
    const fileArray = Array.from(files).filter(file => {
      if (file.size === 0) {
        handleError$1(`${file.name}文件为空`);
        return false;
      }
      return true;
    });

    // 并发处理每个文件（限制并发数量）
    const concurrency = Math.max(1, navigator.hardwareConcurrency || 4);
    const chunkedFiles = chunkArray(fileArray, concurrency);
    for (const fileGroup of chunkedFiles) {
      await Promise.all(fileGroup.map(async (file) => {
        try {
          // 1. 文件验证
          if (!validateFile(file, globalOptions)) return;

          // 2. 生成文件哈希（Web Worker计算）
          const fileId = await generateFileHash(file, globalOptions.chunkSize);
          
          // 3. 避免重复添加
          if (uploadQueue.has(fileId)) {
            handleError$1(`${file.name}文件已存在上传队列`);
            return;
          }

          // 4. 创建分片并保存
          const fileInfo = createFileInfo(file);

          uploadQueue.set(fileId, fileInfo);
          // 绑定控制按钮事件
          const fileItemDome = createFileItem(fileId);
          const pauseBtn = fileItemDome.querySelector('.pause-btn');
          const cancelBtn = fileItemDome.querySelector('.cancel-btn');

          pauseBtn.addEventListener('click', () => toggleUpload(fileId));
          cancelBtn.addEventListener('click', () => cancelUpload(fileId));
          // 5. 检查服务器状态并开始上传
          await checkServerStatus(fileId);
          startUpload(fileId);
        } catch (error) {
            handleError$1(`${file.name}处理失败: ${error.message}`);
        }
      }));
    }
}
/**
 * 启动文件上传
 * @param {string} fileId - 文件的唯一标识
 */
function startUpload(fileId) {
  // 1. 获取文件信息
  const fileInfo = uploadQueue.get(fileId);
  if (!fileInfo) {
    handleError$1(`未找到文件ID为 ${fileId} 的文件信息`);
    return;
  }

  // 2. 检查状态
  if ([FILE_STATUS.UPLOADED, FILE_STATUS.UPLOADING, FILE_STATUS.PAUSED].includes(fileInfo.status)) {
    handleError$1(`文件 ${fileInfo.name} 当前状态不允许启动上传`);
    return;
  }

  // 更新状态为上传中
  fileInfo.status = FILE_STATUS.UPLOADING;
  updateFileStatus(fileId, FILE_STATUS.UPLOADING, '上传中...');

  // 3. 开始上传
  // 获取所有需要上传的分片索引（这里假设一开始都没有上传过，所以上传所有分片）
  const chunksToUpload = Array.from({ length: fileInfo.chunks.length }, (_, i) => i);
  uploadChunks(fileId, chunksToUpload);
}



function toggleUpload(fileId) {
  const fileInfo = uploadQueue.get(fileId);
  if (!fileInfo) return;

  switch (fileInfo.status) {
    case FILE_STATUS.UPLOADING:
      pauseUpload(fileId);
      break;
    case FILE_STATUS.PAUSED:
      resumeUpload(fileId);
      break;
  }
}

/**
   * 暂停文件上传
   * @param {string} fileInfo - 上传文件信息
 */
async function pauseUpload(fileId) {
  const fileInfo = uploadQueue.get(fileId);
  if (!fileInfo || fileInfo.status !== FILE_STATUS.UPLOADING) return;

  // 中止所有进行中的上传请求
  fileInfo.abortControllers.forEach(controller => controller.abort());
  fileInfo.abortControllers.clear();

  // 更新状态并保存进度
  fileInfo.status = FILE_STATUS.PAUSED;
  fileInfo.lastTime = Date.now();
  saveToStorage();

  // 更新UI
  updateFileStatus(fileId, FILE_STATUS.PAUSED, '上传已暂停');
}

 

/**
   * 分片上传核心方法（支持中止）
   * @param {string} fileInfo - 文件
   * @param {number[]} chunkIndexes - 需要上传的分片索引数组
   */
async function uploadChunks(fileId, chunkIndexes) {
  const fileInfo = uploadQueue.get(fileId);
  if (!fileInfo) {
    handleError$1(`未找到文件ID为 ${fileId} 的文件信息`);
    return;
  }

  // 并发控制
  const concurrency = globalOptions.concurrency || navigator.hardwareConcurrency;
  const queue = [...chunkIndexes];
  
  const worker = async () => {
    while (queue.length > 0 && fileInfo.status === FILE_STATUS.UPLOADING) {
      const chunkIndex = queue.shift();
      const controller = new AbortController();
      fileInfo.abortControllers.set(chunkIndex, controller);
      try {
        const chunkData = fileInfo.chunks[chunkIndex];
        chunkData.status = FILE_STATUS.UPLOADING;
        await uploadChunk(
          fileId,
          chunkIndex,
          fileInfo.chunks[chunkIndex],
          controller.signal
        );
        
      } catch (error) {
        if (error.name !== 'AbortError') {
          console.error(`分片 ${chunkIndex} 上传失败:`, error);
          queue.push(chunkIndex); // 重新加入队列等待重试
        }
      } finally {
        fileInfo.abortControllers.delete(chunkIndex);
      }
    }
  };
  // 启动并发任务
  const workers = Array(concurrency).fill().map(() => worker());
  await Promise.all(workers);
}

async function uploadChunk(fileId, chunkIndex, chunkData, signal) {
  const formData = new FormData();
  formData.append('file', chunkData);
  formData.append('fileId', fileId);
  formData.append('chunkIndex', chunkIndex);

  const response = await fetch(globalOptions.server.upload, {
    method: 'POST',
    body: formData,
    signal // 绑定中止信号
  });

  if (!response.ok) {
    throw new Error(`HTTP错误: ${response.status}`);
  }
  chunkData.status = FILE_STATUS.UPLOADED;
  
  const fileInfo = uploadQueue.get(fileId);
  fileInfo.uploadedChunks.add(chunkIndex);
  const isUploaded = fileInfo.chunks.length === fileInfo.uploadedChunks.size;
  const upload_status = isUploaded ? FILE_STATUS.UPLOADED : FILE_STATUS.UPLOADING;
  if (isUploaded) {
    fileInfo.status = FILE_STATUS.UPLOADED;
    updateFileStatus(fileId, upload_status);
    fileInfo.chunks = [];
    uploadQueue.delete(fileId);
    cleanupLocalChunks(fileId);
  }
  else {
    fileInfo.chunks.splice(chunkIndex, 1);
    fileInfo.progress = getProgress(fileInfo);
    fileInfo.speed = getSeed(fileInfo);
    updateProgress(fileId);
  }
}

function cancelUpload(fileId) {
  const fileQueue = uploadQueue.get(fileId);
  if (!fileQueue) return;

  fileQueue.abortControllers.forEach(controller => controller.abort());
  
  
  
  // 更新UI状态
  updateFileStatus(fileId, 'cancelled');

  // 清理上传队列
  uploadQueue.delete(fileId);
  
  // 5. 可选：清理本地缓存
  cleanupLocalChunks(fileId);
}


/**
   * 恢复文件上传
   * @param {string} fileInfo - 上传文件信息
   */
async function resumeUpload(fileId) {
  console.log('恢复上传');
  const fileInfo = uploadQueue.get(fileId);
  if (!fileInfo || fileInfo.status !== FILE_STATUS.PAUSED) return;

  // 检查服务器状态（防止分片重复上传）
  try {
    const { uploadedChunks } = await checkServerStatus(fileId);
    fileInfo.uploadedChunks = uploadedChunks.length ? new Set(uploadedChunks) : fileInfo.uploadedChunks;
    fileInfo.startTime = Date.now();
  } catch (error) {
    updateFileStatus(fileId, 'error', `恢复失败: ${error.message}`);
    return;
  }

  // 更新状态
  fileInfo.status = FILE_STATUS.UPLOADING;
  updateFileStatus(fileId, FILE_STATUS.UPLOADING, '上传中...');

  // 获取需要上传的分片索引
  const chunksToUpload = [];
  for (let i = 0; i < fileInfo.chunks.length; i++) {
    if (!fileInfo.uploadedChunks.has(i)) {
      chunksToUpload.push(i);
    }
  }

  // 重新开始上传
  uploadChunks(fileId, chunksToUpload);
}

const INDEXEDDB_NAME = 'UploadDB';
async function restoreFromStorage() {
    try {
      // 从 IndexedDB 恢复
      const storedData = await readIndexedDB();

      if (storedData) {
        Object.entries(storedData).forEach(([fileId, fileInfo]) => {
            fileInfo.abortControllers = new Map();
            uploadQueue.set(fileId, Object.assign({}, fileInfo));

            // 重建 UI 状态
            const itemDom = createFileItem(fileId);
            updateFileStatus(fileId, fileInfo.status);
            if ([FILE_STATUS.UPLOADING, FILE_STATUS.PAUSED].includes(fileInfo.status)) {
                // 绑定控制按钮事件
                const pauseBtn = itemDom.querySelector('.pause-btn');
                const cancelBtn = itemDom.querySelector('.cancel-btn');

                pauseBtn.addEventListener('click', () => toggleUpload(fileId));
                cancelBtn.addEventListener('click', () => cancelUpload(fileId));
            }

            if (fileInfo.status === FILE_STATUS.PAUSED) {
                updateProgress(fileId);
            }
        });

        

        console.log('恢复上传队列:', uploadQueue.size, '个文件');
      }
    } catch (error) {
      console.error('存储恢复失败:', error);
    }
}

async function readIndexedDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(INDEXEDDB_NAME, 1);

      request.onsuccess = (event) => {
        const db = event.target.result;
        const transaction = db.transaction('files', 'readonly');
        const store = transaction.objectStore('files');
        const getAllRequest = store.getAll();

        getAllRequest.onsuccess = () => {
          resolve(getAllRequest.result.reduce((acc, item) => {
            acc[item.fileId] = item.fileInfo;
            console.log(item.fileInfo);
            return acc;
          }, {}));
        };

        getAllRequest.onerror = reject;
      };

      request.onerror = reject;
    });
}

async function saveToStorage() {
    try {
        for (const fileInfo of Object.values(uploadQueue)) {
            fileInfo.lastTime = Date.now();
            if (FILE_STATUS.UPLOADING === fileInfo.status) {
                fileInfo.status = FILE_STATUS.PAUSED;
            }
        }
        // IndexedDB 存储
        writeIndexedDB(uploadQueue);
        
        
      } catch (error) {
        console.error('存储保存失败:', error);
      }
}

async function writeIndexedDB(data) {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(INDEXEDDB_NAME, 1);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains('files')) {
          db.createObjectStore('files', { keyPath: 'fileId' });
        }
      };

      request.onsuccess = (event) => {
        const db = event.target.result;
        const transaction = db.transaction('files', 'readwrite');
        const store = transaction.objectStore('files');

        Array.from(uploadQueue.entries()).forEach(([fileId, fileInfo]) => {
            const data = {
                fileInfo: {...fileInfo},
                fileId,
            };
            delete data.fileInfo.abortControllers;
            store.put(data);
        });

        transaction.oncomplete = resolve;
        transaction.onerror = reject;
      };

      request.onerror = reject;
    });
}

function cleanupLocalChunks(fileId) {
  const request = indexedDB.open(INDEXEDDB_NAME, 1);

  request.onsuccess = (event) => {
    const db = event.target.result;
    const transaction = db.transaction('files', 'readwrite');
    const store = transaction.objectStore('files');
    store.delete(fileId);
  };
}

const eventTypes = ['change', 'dragover', 'dragleave', 'drop', 'click'];

function setupEventListeners() {
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');
    // 文件选择事件
    addEvent(fileInput, 'change', (e) => {
      handleFiles(e.target.files);
    });

    // 拖拽事件
    const dragHandlers = {
      dragover: (e) => {
        e.preventDefault();
        dropZone.classList.add('dragover');
      },
      dragleave: () => {
        dropZone.classList.remove('dragover');
      },
      drop: (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        handleFiles(e.dataTransfer.files);
      },
      click: () => {
        fileInput.click();
      }
    };

    eventTypes.forEach((eventName) => {
      addEvent(dropZone, eventName, dragHandlers[eventName]);
    });

    // 窗口关闭前保存状态
    window.addEventListener('beforeunload', () => {
        saveToStorage();
    });
  }


function addEvent(element, eventName, handle) {
  element.addEventListener(eventName, handle);
}

// 网络监控
function startNetworkMonitor() {
    const connection = navigator.connection;
    if (connection) {
      connection.addEventListener('change', () => {
        adaptUploadStrategy();
      });
      adaptUploadStrategy();
    }
}


// 动态调整上传策略
function adaptUploadStrategy() {
    // 根据网络类型调整分片大小和并发数
    const connection = navigator.connection;
    if (!connection) return;
    let newChunkSize = globalOptions.chunkSize;
    let concurrency = globalOptions.concurrency;
    // 2g以下使用1MB分片，3g使用2MB分片
    switch (connection.effectiveType) {
      case 'slow-2g':
        newChunkSize = 256 * 1024;
        concurrency = 1;
        break;
      case '2g':
        newChunkSize = 512 * 1024;
        concurrency = 2;
        break;
      case '3g':
        newChunkSize = 1 * 1024 * 1024;
        concurrency = 3;
        break;
      case '4g':
        newChunkSize = 2 * 1024 * 1024;
        concurrency = 5;
        break;
      case '5g':
        newChunkSize = 5 * 1024 * 1024;
        concurrency = 6;
        break;
    }

    const { downlink, rtt } = connection;
    
    // 带宽估算算法（Mbps转Bytes/ms）
    const availableBW = (downlink * 125000) / (rtt || 100);
    
    // 根据带宽调整分片大小
    if (availableBW > 5000) {      // >40Mbps
      newChunkSize = 5 * 1024 * 1024;
    } else if (availableBW > 2500) { // 20-40Mbps
      newChunkSize = 2 * 1024 * 1024;
    }

    for (const [fileId, fileInfo] of uploadQueue.entries()) {
      if (fileInfo.status === FILE_STATUS.UPLOADING) {
        toggleUpload(fileId);
        const argChunk = rechunkRemainingFile(fileInfo.file, fileInfo.chunks, fileInfo.uploadedChunks, newChunkSize);
        const lastChunkIndex = Math.max(...fileInfo.uploadedChunks);
        const uploadChunks = fileInfo.chunks.slice(0, lastChunkIndex);
        fileInfo.chunks = [...uploadChunks, ...argChunk];
        resumeUpload(fileId);
      }
    }

    setGlobalOptions({...globalOptions, chunkSize: newChunkSize, concurrency});
}

function ininitializeFileUpload({
    chunkSize = 10 * 1024 * 1024, // 切片大小 默认10MB
    concurrency = 5, // 并发数
    maxRetries = 3, // 最大重试次数
    maxSize = 50 * 1024 * 1024 * 1024, // 最大文件大小 50GB
    allowedTypes = ['*'], // 允许的文件类型
    bandwidthLimit = null, // 带宽限制
    security = { // 安全配置
        encrypt: true, // 加密上传
        verifyHash: true // 验证哈希
    },
    server = {
        check: '/api/check',
        upload: '/api/upload',
    }

} = {}) {
    setGlobalOptions({
        chunkSize,
        concurrency,
        maxRetries,
        maxSize,
        allowedTypes,
        bandwidthLimit,
        security,
        server,
    });
    setupEventListeners();
    restoreFromStorage(); // 从本地存储恢复上传状态
    startNetworkMonitor();

}

ininitializeFileUpload({
    // 切片大小
    chunkSize: 500 * 1024, // 10MB
    // 带宽限制
    bandwidthLimit: 5 * 1024 * 1024, // 5MB/s
    // 安全配置
    security: {
      encrypt: true, // 加密上传
      verifyHash: true // 验证哈希
    }
});
