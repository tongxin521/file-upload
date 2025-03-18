import {globalOptions} from './index'
import {FILE_STATUS} from './../shared/index';

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

export function rechunkRemainingFile(file, chunks, uploadedChunks, newChunkSize) {
    // 确定已上传的总字节数
    let uploadedSize = chunks
        .filter(chunk => chunk.status === FILE_STATUS.SUCCESS)
        .reduce((size, chunk) => size + (chunk.end - chunk.start), 0);

    // 剩余未上传的文件部分
    let remainingFile = file.slice(uploadedSize);

    // 使用新的 chunkSize 对剩余文件部分进行切片
    let newChunks = [];
    let offset = 0;

    const lastChunkIndex = Math.max(...uploadedChunks)

    while (offset < remainingFile.size) {
        const end = offset + newChunkSize;
        newChunks.push({
            index: lastChunkIndex + newChunks.length,
            start: uploadedSize + offset, // 注意这里要使用原始文件的偏移量
            end: uploadedSize + end,
            blob: remainingFile.slice(offset, end),
            hash: null,
            status: FILE_STATUS.PENDING,
        });
        offset = end;
    }

    return newChunks;
}