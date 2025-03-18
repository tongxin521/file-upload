const keyStorage = new Map();
// 生成文件加密密钥
async function generateFileKey() {
  const key = await crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );
  keyStorage.set(fileId, key);
  return key;
}

// 分片加密流程
async function processChunk(chunk, key) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    await chunk.arrayBuffer()
  );
  return { encrypted, iv };
}

  // 分片加密处理
async function encryptChunk(chunk) {
  const key = await crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    await chunk.arrayBuffer()
  );
  return { encrypted, iv, key };
}