import {handleError, FILE_STATUS, validateFile, getProgress, getSeed} from './../shared/index';
import {createChunks} from './chunk';
import {updateFileStatus, updateProgress, createFileItem} from '../ui/index';
import {chunkArray} from './../shared/index'
import {globalOptions} from './index';
import {generateFileHash} from './worker';
import {checkServerStatus} from './server';
import {saveToStorage, cleanupLocalChunks} from './storage';

export const uploadQueue = new Map();

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
  };;
}

export async function handleFiles(files) {
    // 转换为数组并过滤无效文件
    const fileArray = Array.from(files).filter(file => {
      if (file.size === 0) {
        handleError(`${file.name}文件为空`)
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
            handleError(`${file.name}文件已存在上传队列`)
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
            handleError(`${file.name}处理失败: ${error.message}`);
        }
      }));
    }
}
/**
 * 启动文件上传
 * @param {string} fileId - 文件的唯一标识
 */
export function startUpload(fileId) {
  // 1. 获取文件信息
  const fileInfo = uploadQueue.get(fileId);
  if (!fileInfo) {
    handleError(`未找到文件ID为 ${fileId} 的文件信息`);
    return;
  }

  // 2. 检查状态
  if ([FILE_STATUS.UPLOADED, FILE_STATUS.UPLOADING, FILE_STATUS.PAUSED].includes(fileInfo.status)) {
    handleError(`文件 ${fileInfo.name} 当前状态不允许启动上传`);
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



export function toggleUpload(fileId) {
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
export async function pauseUpload(fileId) {
  const fileInfo = uploadQueue.get(fileId);
  if (!fileInfo || fileInfo.status !== FILE_STATUS.UPLOADING) return;

  // 中止所有进行中的上传请求
  fileInfo.abortControllers.forEach(controller => controller.abort());
  fileInfo.abortControllers.clear();

  // 更新状态并保存进度
  fileInfo.status = FILE_STATUS.PAUSED;
  fileInfo.lastTime = Date.now();
  saveToStorage(fileInfo);

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
    handleError(`未找到文件ID为 ${fileId} 的文件信息`);
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
    fileInfo.status = FILE_STATUS.UPLOADED
    updateFileStatus(fileId, upload_status);
    fileInfo.chunks = [];
    uploadQueue.delete(fileId);
    cleanupLocalChunks(fileId);
  }
  else {
    fileInfo.chunks.splice(chunkIndex, 1);
    fileInfo.progress = getProgress(fileInfo);
    fileInfo.speed = getSeed(fileInfo)
    updateProgress(fileId);
  }
}

export function cancelUpload(fileId) {
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
export async function resumeUpload(fileId) {
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