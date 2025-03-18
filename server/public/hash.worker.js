self.importScripts('https://cdnjs.cloudflare.com/ajax/libs/spark-md5/3.0.2/spark-md5.min.js');

self.onmessage = async (event) => {
  const { file, chunkSize } = event.data;
  // 创建 SparkMD5 实例
  const spark = new self.SparkMD5.ArrayBuffer();
  // 计算分片的个数
  const totalChunks = Math.ceil(file.size / chunkSize);
  // 初始化已处理分片数
  let processedChunks = 0;

  try {
    // 分片读取文件
    for (let i = 0; i < totalChunks; i++) {
      const start = i * chunkSize;
      const end = Math.min(start + chunkSize, file.size);
      const chunk = file.slice(start, end);
      
      // 读取分片内容
      const arrayBuffer = await readChunk(chunk);
      spark.append(arrayBuffer);
      processedChunks++;

      // 发送进度更新
      self.postMessage({
        type: 'progress',
        value: processedChunks / totalChunks
      });
    }

    // 返回最终哈希
    self.postMessage({
      type: 'hash',
      value: spark.end()
    });
  } catch (error) {
    self.postMessage({
      type: 'error',
      message: error.message
    });
  }
};

// 读取分片的 Promise 封装
function readChunk(chunk) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('分片读取失败'));
    
    reader.readAsArrayBuffer(chunk);
  });
}