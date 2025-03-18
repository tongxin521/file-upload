
import {restoreFromStorage} from './upload/storage';
import {setupEventListeners} from './upload/event';
import {startNetworkMonitor} from './upload/network';
import {setGlobalOptions} from './upload/index';



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

