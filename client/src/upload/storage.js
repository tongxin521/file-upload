import {uploadQueue, toggleUpload, cancelUpload} from './upload';
import {createFileItem, updateFileStatus, updateProgress} from './../ui/index';
import {FILE_STATUS} from './../shared/index'

const INDEXEDDB_NAME = 'UploadDB';
export async function restoreFromStorage() {
    try {
      // 从 IndexedDB 恢复
      const storedData = await readIndexedDB();

      if (storedData) {
        Object.entries(storedData).forEach(([fileId, fileInfo]) => {
            fileInfo.abortControllers = new Map();
            uploadQueue.set(fileId, Object.assign({}, fileInfo));

            // 重建 UI 状态
            const itemDom = createFileItem(fileId);
            updateFileStatus(fileId, fileInfo.status)
            if ([FILE_STATUS.UPLOADING, FILE_STATUS.PAUSED].includes(fileInfo.status)) {
                // 绑定控制按钮事件
                const pauseBtn = itemDom.querySelector('.pause-btn');
                const cancelBtn = itemDom.querySelector('.cancel-btn');

                pauseBtn.addEventListener('click', () => toggleUpload(fileId));
                cancelBtn.addEventListener('click', () => cancelUpload(fileId));
            }

            if (fileInfo.status === FILE_STATUS.PAUSED) {
                updateProgress(fileId);
            }
        });

        

        console.log('恢复上传队列:', uploadQueue.size, '个文件');
      }
    } catch (error) {
      console.error('存储恢复失败:', error);
    }
}

async function readIndexedDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(INDEXEDDB_NAME, 1);

      request.onsuccess = (event) => {
        const db = event.target.result;
        const transaction = db.transaction('files', 'readonly');
        const store = transaction.objectStore('files');
        const getAllRequest = store.getAll();

        getAllRequest.onsuccess = () => {
          resolve(getAllRequest.result.reduce((acc, item) => {
            acc[item.fileId] = item.fileInfo;
            console.log(item.fileInfo);
            return acc;
          }, {}));
        };

        getAllRequest.onerror = reject;
      };

      request.onerror = reject;
    });
}

export async function saveToStorage() {
    try {
        for (const fileInfo of Object.values(uploadQueue)) {
            fileInfo.lastTime = Date.now();
            if (FILE_STATUS.UPLOADING === fileInfo.status) {
                fileInfo.status = FILE_STATUS.PAUSED;
            }
        }
        // IndexedDB 存储
        writeIndexedDB(uploadQueue)
        
        
      } catch (error) {
        console.error('存储保存失败:', error);
      }
}

async function writeIndexedDB(data) {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(INDEXEDDB_NAME, 1);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains('files')) {
          db.createObjectStore('files', { keyPath: 'fileId' });
        }
      };

      request.onsuccess = (event) => {
        const db = event.target.result;
        const transaction = db.transaction('files', 'readwrite');
        const store = transaction.objectStore('files');

        Array.from(uploadQueue.entries()).forEach(([fileId, fileInfo]) => {
            const data = {
                fileInfo: {...fileInfo},
                fileId,
            }
            delete data.fileInfo.abortControllers
            store.put(data);
        });

        transaction.oncomplete = resolve;
        transaction.onerror = reject;
      };

      request.onerror = reject;
    });
}

export function cleanupLocalChunks(fileId) {
  const request = indexedDB.open(INDEXEDDB_NAME, 1);

  request.onsuccess = (event) => {
    const db = event.target.result;
    const transaction = db.transaction('files', 'readwrite');
    const store = transaction.objectStore('files');
    store.delete(fileId)
  };
}
