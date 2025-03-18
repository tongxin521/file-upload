export function validateFile(file, option) {
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


  export function getProgress(fileInfo) {
    const {uploadedChunks, chunks} = fileInfo;
    return (uploadedChunks.size / chunks.length) * 100;
  }
  export function getSeed(fileInfo) {
    const {startTime, file, progress} = fileInfo;
    const cureent = Date.now();
    const elapsed = (cureent - startTime) / 1000;
    const uploaded = (progress / 100) * file.size;
    const speed = elapsed > 0 ? uploaded / elapsed : 0;

    return speed;
  }

  // 辅助方法：计算剩余时间
export function calculateETA(uploaded, total, speed) {
  if (speed === 0) return '--';
  const remaining = total - uploaded;
  const seconds = Math.ceil(remaining / speed);
  return `${Math.floor(seconds / 60)}分${seconds % 60}秒`;
}

export function formatSpeed(bytesPerSecond) {
  if (bytesPerSecond === 0) return '0 B/s';
  const units = ['B/s', 'KB/s', 'MB/s'];
  let unitIndex = 0;
  while (bytesPerSecond >= 1024 && unitIndex < units.length - 1) {
    bytesPerSecond /= 1024;
    unitIndex++;
  }
  return `${bytesPerSecond.toFixed(1)} ${units[unitIndex]}`;
}