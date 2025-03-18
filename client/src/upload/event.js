import { saveToStorage} from './storage';
import {handleFiles} from './upload';
const eventTypes = ['change', 'dragover', 'dragleave', 'drop', 'click'];

export function setupEventListeners() {
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');
    // 文件选择事件
    addEvent(fileInput, 'change', (e) => {
      handleFiles(e.target.files)
    });

    // 拖拽事件
    const dragHandlers = {
      dragover: (e) => {
        e.preventDefault();
        dropZone.classList.add('dragover');
      },
      dragleave: () => {
        dropZone.classList.remove('dragover');
      },
      drop: (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        handleFiles(e.dataTransfer.files);
      },
      click: () => {
        fileInput.click();
      }
    };

    eventTypes.forEach((eventName) => {
      addEvent(dropZone, eventName, dragHandlers[eventName]);
    });

    // 窗口关闭前保存状态
    window.addEventListener('beforeunload', () => {
        saveToStorage();
    });
  }


function addEvent(element, eventName, handle) {
  element.addEventListener(eventName, handle);
}