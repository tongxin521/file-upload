一、背景与挑战
1.1 业务需求
* 支持大文件上传
* 实现断点续传
* 提供实时进度反馈
1.2 技术挑战
* 浏览器内存限制
* 网络不稳定问题
* 上传性能优化
* 用户体验保障

二、核心功能设计
2.1 功能架构
graph TD
    A[文件选择] --> B[分片切割]
    B --> C[哈希计算]
    C --> D[断点续传检查]
    D --> E[分片上传]
    E --> F[进度监控]
    F --> G[合并确认]
2.2 关键技术点
* 分片上传：将大文件切割为多个小分片
* 断点续传：记录已上传分片，支持从中断处继续
* 并发控制：动态调整上传并发数
* 错误恢复：自动重试失败分片
* 进度反馈：实时计算上传进度和速度

三、详细实现方案
3.1 文件分片
export function createChunks(file) {
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
3.2 断点续传
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
3.3 并发控制
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
3.4 错误处理
async function uploadWithRetry() {
  let attempt = 0;

  while (attempt < globalOptions.maxRetries) {
    try {
      ...
    } catch (error) {
      attempt++;
      if (attempt >= maxRetries) {
        throw normalizeError(error);
      }
  }
}

四、性能优化策略
4.1 内存优化
* 使用流式读取（FileReader API）
* 及时释放已上传分片内存
* 限制并发分片数
4.2 网络优化
* 动态调整分片大小
* 启用HTTP/2多路复用
4.3 用户体验优化
* 虚拟进度条（平滑过渡）
* 预估剩余时间
* 网络状态感知

五、监控与调试
5.1 关键指标
指标
目标值
测量方法
上传成功率
>99.9%
成功请求数/总请求数
平均上传速度
>5MB/s
总字节数/总时间
分片重传率
<1%
重传分片数/总分片数
内存占用峰值
<100MB
性能面板记录
5.2 调试工具
* Chrome DevTools 性能面板
* Network 面板查看请求详情
* Lighthouse 性能分析

六、生产环境实践
6.1 安全防护
* 文件类型校验
* 文件大小限制
* 请求频率限制
6.2 错误处理
错误类型
处理策略
恢复方案
网络中断
指数退避重试（3次）
保留已上传分片状态
服务端错误
自动降级（切换备用域名）
用户手动触发重试
本地存储异常
降级使用SessionStorage
提示用户重新选择文件
文件内容变化
哈希比对检测
终止上传流程
6.3 监控报警
* 上传成功率低于99.9%
* 分片重传率高于5%
* 平均上传速度低于100KB/s

七、演进方向
7.1 WebTransport支持
* 基于QUIC协议
* 0-RTT连接
* 前向纠错
7.2 P2P传输
* WebRTC直连
* 分布式文件传输
* 带宽成本优化
7.3 WASM优化
* 高性能哈希计算
* SIMD加速
* 多线程处理