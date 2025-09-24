import {
  generateKeyPair,
  createPublicKey,
  createPrivateKey,
  KeyObject,
  publicEncrypt as nodePublicEncrypt,
  privateDecrypt as nodePrivateDecrypt,
  constants,
  createSign,
  randomBytes,
  createHash,
} from 'node:crypto';
import { LoggerType } from '../../logger/types';
import { ConfigType } from '../../../app/base_config';

async function generateRSAKeyPair(): Promise<{
  publicKey: string;
  privateKey: string;
  passphrase: string;
}> {
  return new Promise((resolve, reject) => {
    const passphrase = randomBytes(32).toString('base64');

    // rsa key can be used for both encrypt&decrypt and sign&verify
    // we should use this one
    generateKeyPair(
      'rsa',
      {
        modulusLength: 4096,
        publicKeyEncoding: {
          type: 'spki',
          format: 'pem',
        },
        privateKeyEncoding: {
          type: 'pkcs8',
          format: 'pem',
          cipher: 'aes-256-cbc',
          passphrase,
        },
      },
      (err: any, publicKey: any, privateKey: any) => {
        if (err) {
          reject();
          return;
        }

        resolve({ publicKey, privateKey, passphrase });
      }
    );
  });
}

export class AsymmetricKeyManager {
  private publicKey: string;
  private privateKey?: string;
  private readonly passphrase?: string;

  // RSA generate key pair
  // modulus length: 4096
  // public key: format(pem)
  // private key: format(pem)
  static async generateNewManager(): Promise<AsymmetricKeyManager> {
    const keyPair = await generateRSAKeyPair();
    return new AsymmetricKeyManager(keyPair);
  }

  constructor({
    publicKey,
    privateKey,
    passphrase,
  }: {
    publicKey: string;
    privateKey?: string;
    passphrase?: string;
  }) {
    if (privateKey) {
      this.passphrase = passphrase;
      this.privateKey = privateKey;

      // try to load private key
      this.loadPrivateKey(this.privateKey, passphrase);
    }

    this.publicKey = publicKey;

    // try to load public key
    this.loadPublicKey(this.publicKey);
  }

  public getKeyPair() {
    return { privateKey: this.privateKey, publicKey: this.publicKey };
  }

  // RSA load public key to Object
  public loadPublicKey(pemKey: string): KeyObject {
    return createPublicKey({ key: pemKey, format: 'pem' });
  }

  // RSA load private key
  public loadPrivateKey(pemKey: string, passphrase?: string): KeyObject {
    return createPrivateKey({ key: pemKey, format: 'pem', passphrase });
  }

  // RSA encrypt using public key
  //    using oaep padding
  public publicEncrypt(plainText: string) {
    const buffer = Buffer.from(plainText);
    const encrypted = nodePublicEncrypt(
      {
        key: this.publicKey,
        oaepHash: 'sha256',
        padding: constants.RSA_PKCS1_OAEP_PADDING,
      },
      buffer
    );

    return encrypted.toString('base64');
  }

  // RSA decrypt using private key
  public privateDecrypt(secretText: string) {
    if (!this.privateKey) {
      throw new Error('invalid private key');
    }

    const buffer = Buffer.from(secretText, 'base64');
    return nodePrivateDecrypt(
      {
        key: this.privateKey,
        oaepHash: 'sha256',
        padding: constants.RSA_PKCS1_OAEP_PADDING,
        passphrase: this.passphrase,
      },
      buffer
    ).toString();
  }

  // RSA sign using private key
  //    using pss padding
  public privateSign(plainText: string) {
    if (!this.privateKey) {
      throw new Error('invalid private key');
    }

    const sign = createSign('sha256');
    sign.update(plainText);
    sign.end();
    const buffer = sign.sign({
      key: this.privateKey,
      padding: constants.RSA_PKCS1_PSS_PADDING,
      saltLength: constants.RSA_PSS_SALTLEN_DIGEST,
      passphrase: this.passphrase,
    });

    return buffer.toString('base64');
  }

  public getPublicKeyPem() {
    return this.publicKey;
  }

  public getPrivateKeyPem() {
    if (!this.privateKey) {
      throw new Error('invalid private key');
    }

    if (!this.passphrase) {
      throw new Error('emtpy passphrase');
    }

    if (!this.isPrivateKeyEncrypted()) {
      const keyObj = this.loadPrivateKey(this.privateKey, this.passphrase);
      this.privateKey = keyObj.export({
        format: 'pem',
        type: 'pkcs8',
        passphrase: this.passphrase,
        cipher: 'aes-256-cbc',
      }) as string;
    }

    return this.privateKey;
  }

  public getPassphrase() {
    if (!this.passphrase) {
      throw new Error('emtpy passphrase');
    }

    return this.passphrase;
  }

  public isPrivateKeyEncrypted() {
    if (!this.privateKey) {
      throw new Error('invalid private key');
    }

    if (!this.passphrase) {
      throw new Error('emtpy passphrase');
    }

    return this.privateKey.startsWith('-----BEGIN ENCRYPTED PRIVATE KEY-----');
  }

  public getPublicKeyFingerprint() {
    const keyObj = this.loadPublicKey(this.publicKey);

    // using der format for calculating fingerprint
    const der = keyObj.export({ type: 'spki', format: 'der' });

    const hash = createHash('sha256');
    hash.update(der);
    return 'SHA256:' + hash.digest('base64');
  }
}

export function generateNewDBKey() {
  return randomBytes(32).toString('hex');
}

export function xorAuxiliary(buffer: Buffer) {
  const magic = BigInt(
    '0xace6ce6a12fd1c2d406eae50e6e419dfaef58caa431a54e82c42335bb730f162'
  );

  const xor = magic ^ BigInt(`0x${buffer.toString('hex')}`);

  // must be padded with 0 if length < hexLen
  // Buffer.from(hex, 'hex') hex must be even，
  const hexLen = 64;
  const hex = xor.toString(16).padStart(hexLen, '0');
  return Buffer.from(hex, 'hex').toString('base64');
}

// only for test
export function testXor(round: number) {
  let count = 0;

  do {
    const test = randomBytes(32).toString('base64');

    const xor1 = xorAuxiliary(Buffer.from(test, 'base64'));
    const xor2 = xorAuxiliary(Buffer.from(xor1, 'base64'));

    if (test !== xor2) {
      throw new Error('xorAuxiliary failed');
    }

    count++;
  } while (count < round);
}

export function updateAuxiliraies(
  logger: LoggerType,
  userConfig: ConfigType,
  auxiliraies: string[]
) {
  const publicKey = `-----BEGIN PUBLIC KEY-----
MIICIjANBgkqhkiG9w0BAQEFAAOCAg8AMIICCgKCAgEApyjamkP5DZ9DpHG51i8L
het17x8EuteQ5QX2lvXD9mF++5hcty4VsUKpivCAMCvIdQQbksax/3aZ1nmaB8Yi
f4d11Ga125zFDHQ/I/3tNEwMX40crS61vlXBdLH2PXYlJNPywaWNViky2L9hu2Jb
8rrKgZDABPM8l6PUJjRROmNdhTjdr/bWNrEW4xwUjrR8PFcRn6IAzCwEYX+tioCx
gyJO9bmFFnNjBaHQKTUFGh1P6vgtHTWVb5oI5JmxcGwVJzF3XYTkC/2IxGdCPHfn
qeA0933tRDZ/GuypGgD84Rsi0/b42pufnCJcCyDrLv9Z8UvuYjQ2Al7vHbW2KW56
kXKMTewMMe7uuRLowG0ZgXYs/+J9hDbE6jOQ98Ltc4T/nKHYOPv3MXGgVphUaSdy
dezWdrY7IePzuQ8vnJsToMD3Co2R9ZaGmWj4ijVFg/KlFjP9uVVfbmAmiIVkpQyP
lQn1q/fe21pvZmjw8CEeDRl75q9vcYpmebYSpPEp+BJrwgAU+X4JYf06SA0R2udg
o/554iIGDUOCW1LOQ2gcI32Lnp9XBxWcouwgm5NcCUFrq/oP3PJPcvAOabD5h9Fr
w1JA0K0Sa7cY2lEAPLtq1zArfIy4xosVjmeI5CEmEfIVHmVDqPrxxii2BR46ulE4
vV1oGGQJyGzZS/DnnnCsXk8CAwEAAQ==
-----END PUBLIC KEY-----
`;

  try {
    const auxiliaryMgr = new AsymmetricKeyManager({ publicKey });

    for (const [idx, aux] of auxiliraies.entries()) {
      if (!aux) {
        logger.warn(`There is no value for auxiliary[${idx}].`);
        continue;
      }

      const encrypted = auxiliaryMgr.publicEncrypt(aux);
      userConfig.set(`auxiliary${idx}`, encrypted);
    }

    userConfig.set('auxKeyFP', auxiliaryMgr.getPublicKeyFingerprint());
  } catch (error) {
    logger.error('update auxiliary failed', error);
  }
}
