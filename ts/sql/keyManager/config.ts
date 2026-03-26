import path from 'path';
import fse from 'fs-extra';
import { isString } from 'lodash';
import { app, safeStorage } from 'electron/main';

import { formatError } from '../../logger/utils';
import { start } from '../../../app/base_config';
import { AsymmetricKeyManager, xorAuxiliary } from './secretCrypto';
import { isLinux } from '../../OS';

import type { LoggerType } from '../../logger/types';
import type { ConfigType } from '../../../app/base_config';

function isNonEmptyString(value: unknown): value is string {
  return isString(value) && value.trim() !== '';
}

function _updateAuxiliraies(
  logger: LoggerType,
  userConfig: ConfigType,
  publicKey: string,
  auxiliraies: (string | undefined)[],
  fieldPrefix: string,
  keyFPField: string
) {
  try {
    const keyMgr = new AsymmetricKeyManager({ publicKey });

    for (const [idx, aux] of auxiliraies.entries()) {
      const fieldName = `${fieldPrefix}${idx}`;
      if (aux === undefined) {
        logger.info('skip field', fieldName);
      } else {
        const encrypted = keyMgr.publicEncrypt(aux);
        userConfig.set(fieldName, encrypted);
        logger.info('update field', fieldName);
      }
    }

    userConfig.set(keyFPField, keyMgr.getPublicKeyFingerprint());
  } catch (error) {
    logger.warn(`update ${fieldPrefix} error:`, formatError(error));
    throw new Error(`failed to update ${fieldPrefix}`);
  }
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
    _updateAuxiliraies(
      logger,
      userConfig,
      publicKey,
      auxiliraies,
      'auxiliary',
      'auxKeyFP'
    );
  } catch (error) {
    logger.warn('updateAuxiliraies error', formatError(error));
  }
}

function isSafeStorageAvaiable(logger: LoggerType) {
  if (!safeStorage.isEncryptionAvailable()) {
    logger.warn('storage encryption is not available');
    return false;
  }

  if (isLinux() && safeStorage.getSelectedStorageBackend() === 'basic_text') {
    logger.warn('storage encryption is not avaliable on current linux');
    return false;
  }

  return true;
}

export class SecretAuxiliary {
  private readonly prefix = 'v1:';
  private logger: LoggerType;
  private userConfig: ConfigType;
  private sqlConfig: ConfigType;

  constructor(
    logger: LoggerType,
    userConfig: ConfigType,
    sqlConfig: ConfigType
  ) {
    this.logger = logger;
    this.userConfig = userConfig;
    this.sqlConfig = sqlConfig;
  }

  private isSafeStorageAvaiable() {
    return isSafeStorageAvaiable(this.logger);
  }

  public save(auxiliary: string) {
    if (!this.isSafeStorageAvaiable()) {
      throw new Error('can not encrypt auxiliary');
    }

    try {
      const encrypted = safeStorage.encryptString(auxiliary);
      const secretAuxiliary = this.prefix + encrypted.toString('base64');

      this.userConfig.set('secretAuxiliary', undefined);
      this.sqlConfig.set('secretAuxiliary', secretAuxiliary);
    } catch (error) {
      this.logger.warn('save secret auxiliary error:', formatError(error));
      throw new Error('update auxiliary error');
    }
  }

  public read(): string | undefined {
    try {
      let rawAuxValue = this.sqlConfig.get('secretAuxiliary');
      if (isNonEmptyString(rawAuxValue)) {
        if (!this.isSafeStorageAvaiable()) {
          throw new Error('can not decrypt auxiliary');
        }

        const auxBuffer = Buffer.from(
          rawAuxValue.slice(this.prefix.length),
          'base64'
        );

        return safeStorage.decryptString(auxBuffer);
      }

      // old style
      rawAuxValue = this.userConfig.get('secretAuxiliary');
      if (!isNonEmptyString(rawAuxValue)) {
        return undefined;
      }

      const secret = xorAuxiliary(Buffer.from(rawAuxValue, 'base64'));

      try {
        this.save(secret);
      } catch (error) {
        this.logger.warn('can not upgrade auxiliary', formatError(error));
      }

      return secret;
    } catch (error) {
      this.logger.error('read secret error', formatError(error));
      throw new Error('failed to read secret');
    }
  }

  public tryToMigrateIfNeeded() {
    try {
      if (isNonEmptyString(this.sqlConfig.get('secretAuxiliary'))) {
        // already migrated
        return;
      }

      const rawAuxValue = this.userConfig.get('secretAuxiliary');
      if (!isNonEmptyString(rawAuxValue)) {
        return;
      }

      const secret = xorAuxiliary(Buffer.from(rawAuxValue, 'base64'));
      this.save(secret);
    } catch (error) {
      this.logger.error('upgrade auxiliary error', formatError(error));
      // throw new Error('failed to upgrade auxiliary');
    }
  }
}

const KEY_ALREADY_UPGRADED = '__KEY_ALREADY_UPGRADED__TRY_THE_LATEST_APP__';

export class LegacyDBKey {
  private userConfig: ConfigType;
  private logger: LoggerType;
  private readonly legacyKeyField = 'key';
  private readonly modernKeyField = 'encryptedKey';

  constructor(logger: LoggerType, userConfig: ConfigType) {
    this.logger = logger;
    this.userConfig = userConfig;
  }

  private isSafeStorageAvaiable() {
    return isSafeStorageAvaiable(this.logger);
  }

  private isUpgraded(key: string) {
    return key === KEY_ALREADY_UPGRADED;
  }

  public read() {
    const legacyKey = this.userConfig.get(this.legacyKeyField);
    const modernKey = this.userConfig.get(this.modernKeyField);

    if (isNonEmptyString(modernKey)) {
      if (this.isSafeStorageAvaiable()) {
        const keyBuffer = Buffer.from(modernKey, 'base64');
        return safeStorage.decryptString(keyBuffer);
      } else {
        throw new Error('safe storage is not available');
      }
    } else if (isNonEmptyString(legacyKey)) {
      if (this.isUpgraded(legacyKey)) {
        throw new Error('the legacy key has already been upgraded');
      } else {
        try {
          this.save(legacyKey);
        } catch (error) {
          this.logger.warn('failed to encrypt legacy db key', error);
        }
        return legacyKey;
      }
    } else {
      this.logger.info('there is no db key found');
      return undefined;
    }
  }

  public save(key: string) {
    if (!this.isSafeStorageAvaiable()) {
      throw new Error('can not encrypt db key');
    }

    try {
      const encryptedKey = safeStorage.encryptString(key);

      this.markUpgraded();
      this.userConfig.set(this.modernKeyField, encryptedKey.toString('base64'));

      updateAuxiliraies(this.logger, this.userConfig, [key]);
    } catch (error) {
      this.userConfig.set(this.legacyKeyField, key);
      this.logger.warn('save db key error and fallback:', formatError(error));
      throw new Error('save db key error');
    }
  }

  public markUpgraded() {
    const keyInCfg = this.userConfig.get(this.legacyKeyField);

    if (keyInCfg !== KEY_ALREADY_UPGRADED) {
      this.userConfig.set(this.legacyKeyField, KEY_ALREADY_UPGRADED);
    }

    // clear modern key filed
    if (this.userConfig.get(this.modernKeyField)) {
      this.userConfig.set(this.modernKeyField, undefined);
    }
  }

  public tryToUpgradeIfNeeded() {
    const legacyKey = this.userConfig.get(this.legacyKeyField);
    if (!isNonEmptyString(legacyKey)) {
      this.logger.warn('there is no valid key in config');
      return;
    }

    if (this.isUpgraded(legacyKey)) {
      // this.logger.info('the key has already been upgraded');
      const auxiliary0 = this.userConfig.get('auxiliary0');
      if (isNonEmptyString(auxiliary0)) {
        return;
      }

      const modernKey = this.userConfig.get(this.modernKeyField);
      if (!isNonEmptyString(modernKey)) {
        return;
      }

      // modernKey
      try {
        this.logger.info('try to update auxiliary0 for modernKey');
        if (this.isSafeStorageAvaiable()) {
          const keyBuffer = Buffer.from(modernKey, 'base64');
          const dbKey = safeStorage.decryptString(keyBuffer);

          updateAuxiliraies(this.logger, this.userConfig, [dbKey]);
        } else {
          throw new Error('safe storage is not available');
        }
      } catch (error) {
        this.logger.warn(
          'update auxiliary0 for modernKey error',
          formatError(error)
        );
      }

      return;
    }

    try {
      this.save(legacyKey);
    } catch (error) {
      this.logger.error('upgrade legacy key error', formatError(error));
    }
  }
}

async function tryToUpgradeBackup(logger: LoggerType, backupPath: string) {
  try {
    if (!(await fse.exists(backupPath))) {
      logger.warn('backup folder does not exist', backupPath);
      return;
    }

    const userConfig = start('config', path.join(backupPath, 'config.json'));
    const sqlConfig = start('sql', path.join(backupPath, 'sql.json'), {
      allowMalformedOnStartup: true,
    });

    const legacyKey = new LegacyDBKey(logger, userConfig);
    legacyKey.tryToUpgradeIfNeeded();

    const secAuxiliary = new SecretAuxiliary(logger, userConfig, sqlConfig);
    secAuxiliary.tryToMigrateIfNeeded();
  } catch (error) {
    logger.error(
      'upgrade db key in backup folder error',
      backupPath,
      formatError(error)
    );
  }
}

async function _upgradeBackupSqls(logger: LoggerType) {
  const userData = app.getPath('userData');
  const sqlPath = path.join(userData, 'sql');

  const dirents = await fse.readdir(sqlPath, {
    withFileTypes: true,
    recursive: false,
  });
  for (const dirent of dirents) {
    if (!dirent.isDirectory()) {
      continue;
    }

    const folderName = dirent.name;
    if (!folderName.startsWith('sqlBackup')) {
      continue;
    }

    await tryToUpgradeBackup(logger, path.join(sqlPath, folderName));
  }
}

export function upgradeBackupSqls(logger: LoggerType) {
  _upgradeBackupSqls(logger).catch(error => {
    logger.error('upgrade backup sqls error', formatError(error));
  });
}
