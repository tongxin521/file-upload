import {globalOptions} from './index';

/**
 * 检查服务器上的文件上传状态
 * @param {string} fileId - 文件唯一标识
 * @returns {Promise<{exists: boolean, uploadedChunks: number[]}>}
 */
export async function checkServerStatus(fileId) {
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