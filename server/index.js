const express = require('express');
const multer = require('multer');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const PORT = 3000;
const UPLOAD_DIR = path.join(__dirname, 'uploads');

const app = express();
app.use(cors());
app.use(express.json()); // 解析 JSON 请求体
app.use(express.urlencoded({ extended: true })); // 解析 URL 编码请求体
app.use(express.static(path.join(__dirname, 'public')));


// 检查分片状态的接口
app.get('/api/check', async (req, res) => {
  try {

    return res.json({
      exists: false,
      uploadedChunks: []
    });
  } catch (error) {
    res.status(500).json({
      error: 'Internal server error'
    });
  }
});;

// 配置 multer 分片存储
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    try {
      const { fileId } = req.body;
      
      const fileDir = path.join(UPLOAD_DIR, fileId);
      cb(null, targetDir);
    } catch (error) {
      cb(error);
    }
  },
  filename: (req, file, cb) => {
    try {
      const { chunkIndex } = req.body;
      
      // 生成标准化分片文件名（5位补零）
      const formattedIndex = String(chunkIndex).padStart(5, '0');
      cb(null, `chunk_${formattedIndex}`);
    } catch (error) {
      cb(error);
    }
  }
});
const upload = multer({
  storage,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB分片大小限制
    files: 1
  },
  fileFilter: (req, file, cb) => {
    cb(null, true);
  }
});
// 分片上传接口
app.post('/api/upload',upload.single('chunk'),async (req, res) => {
  try {
    setTimeout(() => {
      res.status(200).json({
        success: true,
        fileId: req.body.fileId,
        chunkIndex: req.body.chunkIndex,
      });
    }, 2000)
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message || 'File upload failed'
    });
  }
});

app.get('/index.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/index.js', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.js'));
});


async function ensureUploadDir() {
  fs.access(UPLOAD_DIR, fs.constants.F_OK, (err) => {
    fs.mkdir(UPLOAD_DIR, { recursive: true }, (err) => {
      if(err) {
        console.error('创建上传目录失败:', err);
      }
      
    })
  });
}

async function startServer() {
  await ensureUploadDir();
  app.listen(PORT, () => {
    console.log(`Server running http://localhost:${PORT}`);
  });
}
// 启动服务
startServer();