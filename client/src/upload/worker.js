/**
 * 生成文件的哈希值（使用 Web Worker）
 * @param {File} file - 需要计算哈希的文件对象
 * @param {number} [chunkSize=2 * 1024 * 1024] - 分片大小（默认2MB）
 * @returns {Promise<string>} - 返回包含文件哈希的Promise
 */
export function generateFileHash(file, chunkSize = 2097152) {
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

