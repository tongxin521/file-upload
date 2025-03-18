import { globalOptions, setGlobalOptions } from "./index";
import {uploadQueue, toggleUpload, resumeUpload} from './upload';
import {FILE_STATUS} from './../shared/index';
import {rechunkRemainingFile} from './chunk';
// 网络监控
export function startNetworkMonitor() {
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
        toggleUpload(fileId)
        const argChunk = rechunkRemainingFile(fileInfo.file, fileInfo.chunks, fileInfo.uploadedChunks, newChunkSize);
        const lastChunkIndex = Math.max(...fileInfo.uploadedChunks);
        const uploadChunks = fileInfo.chunks.slice(0, lastChunkIndex);
        fileInfo.chunks = [...uploadChunks, ...argChunk]
        resumeUpload(fileId);
      }
    }

    setGlobalOptions({...globalOptions, chunkSize: newChunkSize, concurrency});
}