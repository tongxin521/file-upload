export * from './error'
export * from './status'
export * from './file'

export function formatSize(size) {
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
export function chunkArray(array, size) {
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
