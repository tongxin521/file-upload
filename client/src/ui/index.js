import './style.css';
import {formatSize, FILE_STATUS, getSeed, calculateETA, formatSpeed} from '../shared/index';
import {uploadQueue} from './../upload/upload';


export function createFileItem(fileId) {
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
        <span class="file-size">${formatSize(fileInfo.file.size)}</span>
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

export function updateFileStatus(fileId, status, message) {
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

export function updateProgress(fileId) {
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



