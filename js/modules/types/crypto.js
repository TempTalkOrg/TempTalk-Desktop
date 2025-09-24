const crypto = require('crypto');
const toArrayBuffer = require('to-arraybuffer');

exports.getKeys = () => {
  return crypto.randomBytes(64);
};

exports.encryptAttachment = async (plaintext, keys) => {
  try {
    const keyForEncryption = keys.subarray(0, 32);
    const keyForHmac = keys.subarray(32);

    const iv = crypto.randomBytes(16);

    const cipher = crypto.createCipheriv('aes-256-ctr', keyForEncryption, iv);
    const encryptedData = Buffer.concat([
      cipher.update(Buffer.from(plaintext)),
      cipher.final(),
    ]);

    const hmac = crypto
      .createHmac('sha256', keyForHmac)
      .update(encryptedData)
      .digest();

    const magicHeader = Buffer.from('ETAT');
    const version = Buffer.alloc(1);
    version.writeUInt8(1, 0);

    const combinedBuffer = Buffer.concat([
      magicHeader,
      version,
      iv,
      hmac,
      encryptedData,
    ]);

    return toArrayBuffer(combinedBuffer);
  } catch (e) {
    console.error('encrypt attachment failed', e);
    throw e;
  }
};

exports.decryptAttachment = async (ciphertext, keys) => {
  try {
    const fileBuffer = Buffer.from(ciphertext);

    const keyForEncryption = keys.subarray(0, 32);
    const keyForHmac = keys.subarray(32);

    const headerSize = 4 + 1 + 16 + 32; // 文件头总长度（53字节）
    const headerBuffer = fileBuffer.subarray(0, headerSize);
    const magicNumber = headerBuffer.subarray(0, 4).toString();

    // 2. 解析文件头
    if (magicNumber !== 'ETAT') {
      throw new Error('不是有效的加密音频文件');
    }

    const version = headerBuffer.readUInt8(4);
    const iv = headerBuffer.subarray(5, 21);
    const storedHmac = headerBuffer.subarray(21, 53);

    // 3. 获取文件大小和加密数据
    const encryptedData = fileBuffer.subarray(headerSize);

    const calculatedHmac = crypto
      .createHmac('sha256', keyForHmac)
      .update(encryptedData)
      .digest();

    if (!crypto.timingSafeEqual(storedHmac, calculatedHmac)) {
      throw new Error('文件验证失败，数据可能已被篡改');
    }

    // 5. 解密数据
    const decipher = crypto.createDecipheriv(
      'aes-256-ctr',
      keyForEncryption,
      iv
    );

    const decryptedData = Buffer.concat([
      decipher.update(encryptedData),
      decipher.final(),
    ]);

    return toArrayBuffer(decryptedData);
  } catch (e) {
    console.error('decrypt attachment failed', e);
    throw e;
  }
};
