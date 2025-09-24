const CURRENT_ENCRYPTION_VERSION = 2;
const MINIMUM_ENCRYPTION_VERSION = 2;

function getCombinedVersion() {
  return (CURRENT_ENCRYPTION_VERSION << 4) | MINIMUM_ENCRYPTION_VERSION;
}

function bufferToAB(buffer, encoding) {
  return dcodeIO.ByteBuffer.wrap(buffer, encoding).toArrayBuffer();
}

function ABToB64(arrayBuffer) {
  return dcodeIO.ByteBuffer.wrap(arrayBuffer).toString('base64');
}

function B64ToAB(b64Text) {
  return bufferToAB(b64Text, 'base64');
}

async function getOurKeyPair() {
  const store = textsecure.storage.protocol;

  try {
    const ourKeyPair = await store.getIdentityKeyPair();

    return {
      publicKey: ourKeyPair.pubKey,
      privateKey: ourKeyPair.privKey,
    };
  } catch (error) {
    throw new Error('get our identity key error');
  }
}

/////////////////////////////////////////////////////////////////////
// UserSessionCipher
//
class UserSessionCipher {
  #uid;
  #session;

  constructor(uid) {
    if (!uid) {
      throw new Error('uid can not be empty');
    }

    this.#uid = uid;
  }

  async #loadSession(force = false) {
    if (this.#session && !force) {
      return;
    }

    let session;

    try {
      session = await window.Signal.Data.getSessionV2ById(this.#uid);
    } catch (error) {
      throw new Error('load session from storage error');
    }

    if (!session) {
      throw new Error('not found session in storage');
    }

    const { identityKey, registrationId, msgEncVersion } = session;
    if (!identityKey || !registrationId) {
      throw new Error('load invalid session');
    }

    this.#session = {
      identityKey,
      rawIdentityKey: B64ToAB(identityKey).slice(1),
      registrationId,
      msgEncVersion,
    };
  }

  async #updateSession(session) {
    if (!session) {
      throw new Error('empty session');
    }

    if (session.uid !== this.#uid) {
      throw new Error('session to update do not belong to current user');
    }

    const { identityKey, registrationId, msgEncVersion } = session;
    if (!identityKey || !registrationId) {
      throw new Error('can not update invalid session');
    }

    try {
      await window.Signal.Data.createOrUpdateSessionV2({
        uid: this.#uid,
        identityKey,
        registrationId,
        msgEncVersion,
      });
    } catch (error) {
      // try to load session if update failed
      try {
        await this.#loadSession(true);
      } catch (error) {
        // throw new Error('reload session error when updating');
      }

      throw new Error('update session error');
    }

    this.#session = {
      identityKey,
      rawIdentityKey: B64ToAB(identityKey).slice(1),
      registrationId,
      msgEncVersion,
    };
  }

  // plaintext & ourPrivateKey should be type ArrayBuffer
  #encrypt(plaintext, ourPrivateKey) {
    // all buffer to libCryptoClient should be ArrayBuffer
    return window.libCryptoClient.encrypt_message(
      CURRENT_ENCRYPTION_VERSION,
      this.#session.rawIdentityKey,
      {}, // must be empty object
      ourPrivateKey,
      plaintext
    );
  }

  async loadSession() {
    // TODO: queue this operation
    return this.#loadSession();
  }

  async updateSession(session) {
    // TODO: queue this operation
    return this.#updateSession(session);
  }

  async encrypt(buffer, encoding, ourPrivateKeyAB = undefined) {
    let privateKeyAB = ourPrivateKeyAB;
    if (!privateKeyAB) {
      privateKeyAB = (await getOurKeyPair()).privateKey;
    }

    const plaintextAB = bufferToAB(buffer, encoding);
    const cipherObject = this.#encrypt(plaintextAB, privateKeyAB);

    return {
      cipherObject,
      receipt: {
        uid: this.getUid(),
        registrationId: this.getRegistrationId(),
      },
    };
  }

  getRegistrationId() {
    if (!this.#session) {
      throw new Error('session was not loaded before using');
    }

    return this.#session.registrationId;
  }

  getRawIdentityKey() {
    if (!this.#session) {
      throw new Error('session was not loaded before using');
    }

    return this.#session.rawIdentityKey;
  }

  getUid() {
    return this.#uid;
  }

  // static methods

  static from(uid) {
    return new UserSessionCipher(uid);
  }

  static uidKeyMapFromCiphers(ciphers) {
    return ciphers.reduce(
      (prevMap, cipher) => ({
        ...prevMap,
        [cipher.getUid()]: cipher.getRawIdentityKey(),
      }),
      {}
    );
  }

  static userCipherMapFromUids(uids) {
    return uids.reduce((prevMap, uid) => {
      if (!uid || typeof uid !== 'string') {
        window.log.warn('skipping invalid uid', uid);
        return prevMap;
      }

      return { ...prevMap, [uid]: UserSessionCipher.from(uid) };
    }, {});
  }

  static async batchUpdateCiphers(userCipherMap, fnGetNewKeys) {
    const allUids = Object.keys(userCipherMap);
    if (!allUids.length) {
      throw new Error('passed in empty user session cipher map');
    }

    // get new keys
    let newKeys;
    try {
      newKeys = await fnGetNewKeys(allUids);
    } catch (error) {
      log.error('call fnGetNewKeys error', error);
    }

    if (!Array.isArray(newKeys)) {
      // invalid new keys response
      log.error('invalid new keys returned');

      return allUids.reduce((prevMap, uid) => {
        return { ...prevMap, [uid]: 'failed to get new key' };
      }, {});
    }

    // construct new keys map
    const userNewKeysMap = newKeys.reduce((prevMap, key) => {
      const { uid } = key || {};
      if (uid && allUids.includes(uid)) {
        // validate other key fields
        const { identityKey, registrationId, msgEncVersion } = key;

        if (!identityKey || !registrationId) {
          // empty identityKey or registrationId
          return prevMap;
        }

        return {
          ...prevMap,
          [uid]: { uid, identityKey, registrationId, msgEncVersion },
        };
      } else {
        // unexpected uid
        return prevMap;
      }
    }, {});

    const updatePromises = [];
    for (const uid of allUids) {
      const key = userNewKeysMap[uid];
      if (key) {
        updatePromises.push(userCipherMap[uid].updateSession(key));
      } else {
        updatePromises.push(Promise.reject('not found key for user'));
      }
    }

    const errorMap = {};

    (await Promise.allSettled(updatePromises)).forEach((result, index) => {
      const { status, reason } = result;
      if (status === 'rejected') {
        const uid = allUids[index];
        errorMap[uid] = reason;
        window.log.warn('update cipher error', uid, reason);
      }
    });

    return Object.keys(errorMap).length ? errorMap : null;
  }

  static async batchLoadCiphers(uids, fnGetNewKeys) {
    const allUids = uids?.filter(uid => uid && typeof uid === 'string');
    if (!allUids?.length) {
      throw new Error('invalid input uids');
    }

    const updateCipherMap = {};

    // try to load all user sessions
    const ciphers = allUids.map(UserSessionCipher.from);
    const promises = ciphers.map(session => session.loadSession());
    (await Promise.allSettled(promises)).forEach((result, index) => {
      const { status, reason } = result;
      if (status === 'rejected') {
        const cipher = ciphers[index];
        const uid = cipher.getUid();
        updateCipherMap[uid] = cipher;
        window.log.warn('session load error for', uid, reason);
      }
    });

    if (Object.keys(updateCipherMap).length) {
      try {
        const errorMap = await UserSessionCipher.batchUpdateCiphers(
          updateCipherMap,
          fnGetNewKeys
        );

        return { ciphers, errorMap };
      } catch (error) {
        throw new Error('failed to batch update ciphers');
      }
    }

    return { ciphers };
  }
}

/////////////////////////////////////////////////////////////////////
// GroupSessionCipher
//

class GroupSessionCipher {
  // user session ciphers
  #ciphers;

  static from(ciphers) {
    return new GroupSessionCipher(ciphers);
  }

  constructor(ciphers) {
    this.#ciphers = ciphers;
  }

  #encrypt(plaintext, ourPrivateKey) {
    const uidKeyMap = UserSessionCipher.uidKeyMapFromCiphers(this.#ciphers);

    // all buffer to libCryptoClient should be ArrayBuffer
    return window.libCryptoClient.encrypt_message(
      CURRENT_ENCRYPTION_VERSION,
      new ArrayBuffer(0), // must be empty ArrayBuffer
      uidKeyMap,
      ourPrivateKey,
      plaintext
    );
  }

  async encrypt(buffer, encoding, ourPrivateKey = undefined) {
    let privateKey = ourPrivateKey;
    if (!privateKey) {
      privateKey = (await getOurKeyPair()).privateKey;
    }

    const plaintextAB = bufferToAB(buffer, encoding);
    const cipherObject = this.#encrypt(plaintextAB, privateKey);

    return {
      cipherObject,
      receipts: this.#ciphers.map(cipher => {
        const uid = cipher.getUid();
        const peerContext = ABToB64(cipherObject.erm_keys[uid]);

        return {
          uid,
          registrationId: cipher.getRegistrationId(),
          peerContext,
        };
      }),
    };
  }
}

async function decryptWithoutSessionCipher(
  cipherObject,
  ourPrivateKeyAB,
  theirIdentityKeyB64,
  ermKeyB64
) {
  const { cipher_text, signed_e_key, e_key, identity_key, version } =
    cipherObject;

  let privateKeyAB = ourPrivateKeyAB;
  if (!privateKeyAB) {
    privateKeyAB = (await getOurKeyPair()).privateKey;
  }

  const theirIdentityKey = B64ToAB(theirIdentityKeyB64).slice(1);
  const ermKey = ermKeyB64 ? B64ToAB(ermKeyB64) : new ArrayBuffer(0);

  const result = window.libCryptoClient.decrypt_message(
    version,
    signed_e_key,
    identity_key,
    theirIdentityKey,
    e_key,
    privateKeyAB,
    ermKey,
    cipher_text
  );

  if (!result?.verified_id_result) {
    window.log.warn(
      'decrypt_message verified_id_result',
      result?.verified_id_result
    );
  }

  return result.plain_text;
}

/////////////////////////////////////////////////////////////////////
// CallRoomCipher
//

class CallRoomCipher {
  #mKey;

  constructor(mKey, encoding) {
    if (!mKey) {
      throw new Error('mkey could not be empty');
    }

    this.#mKey = bufferToAB(mKey, encoding);
  }

  static async from(emk, publicKey, ourPrivateKey = undefined) {
    let privateKey = ourPrivateKey;
    if (!privateKey) {
      privateKey = (await getOurKeyPair()).privateKey;
    }

    let decrypted;

    try {
      decrypted = window.libCryptoClient.decrypt_key(
        CURRENT_ENCRYPTION_VERSION,
        publicKey,
        privateKey,
        emk
      );
    } catch (error) {
      throw new Error('decrypt emk error');
    }

    const { m_key } = decrypted || {};
    if (!m_key) {
      throw new Error('no valid decrypted m_key returned');
    }

    return new CallRoomCipher(m_key);
  }

  static async fromNewKey() {
    try {
      const mKey = window.libCryptoClient.generate_key(
        CURRENT_ENCRYPTION_VERSION
      );
      if (!mKey) {
        throw new Error('encrypt key error');
      }

      return new CallRoomCipher(mKey);
    } catch (error) {
      throw new Error('generate new mKey error');
    }
  }

  exportMKey() {
    return this.#mKey;
  }

  exportEMKeys(userCiphers) {
    if (!userCiphers?.length) {
      throw new Error('there are no valid ciphers for key encrypting');
    }

    const mKey = this.#mKey;
    if (!mKey) {
      throw new Error('there is no valid mKey');
    }

    try {
      const uidKeys = UserSessionCipher.uidKeyMapFromCiphers(userCiphers);

      const encrypted = window.libCryptoClient.encrypt_key(
        CURRENT_ENCRYPTION_VERSION,
        uidKeys,
        mKey
      );

      const { e_m_keys, e_key } = encrypted || {};
      if (!e_m_keys || !e_key) {
        throw new Error('encrypt key error');
      }

      return { uidEmkMap: e_m_keys, publicKey: e_key };
    } catch (error) {
      //
      throw new Error('generate emkeys failed');
    }
  }

  async encrypt(buffer, privateKeyAB = undefined) {
    const mKey = this.#mKey;
    if (!mKey) {
      throw new Error('there is no valid key for encrypting');
    }
    if (!privateKeyAB) {
      privateKeyAB = (await getOurKeyPair()).privateKey;
    }

    const result = libCryptoClient.encrypt_rtm_message(
      CURRENT_ENCRYPTION_VERSION,
      mKey.slice(0, 32),
      privateKeyAB,
      buffer
    );

    return {
      payload: ABToB64(result.cipher_text),
      signature: ABToB64(result.signed_e_key),
    };
  }

  async decrypt(cipherObject, theirPublicKeyAB) {
    const mKey = this.#mKey;
    if (!mKey) {
      throw new Error('there is no valid key for decrypting');
    }

    if (!theirPublicKeyAB) {
      theirPublicKeyAB = new ArrayBuffer(0);
    }

    const payload = B64ToAB(cipherObject.payload);
    const signature = B64ToAB(cipherObject.signature);

    const result = libCryptoClient.decrypt_rtm_message(
      CURRENT_ENCRYPTION_VERSION,
      signature,
      theirPublicKeyAB,
      mKey.slice(0, 32),
      payload
    );

    if (!result?.verified_id_result) {
      window.log.warn(
        'decrypt_rtm_message verified_id_result',
        result?.verified_id_result
      );
    }

    return result.plain_text;
  }
}

/////////////////////////////////////////////////////////////////////
// EncryptedContent
//

function encodeEncryptedContent(cipherObject) {
  // all the fields from libCryptoClient are ArrayBuffer
  const { cipher_text, signed_e_key, e_key, identity_key } = cipherObject;

  const proto = new textsecure.protobuf.EncryptedContent({
    version: CURRENT_ENCRYPTION_VERSION,
    cipherText: cipher_text,
    signedEKey: signed_e_key,
    eKey: e_key,
    identityKey: identity_key,
  });

  const data = new Uint8Array(proto.toArrayBuffer());
  const header = new Uint8Array([getCombinedVersion()]);

  const contentBuffer = new ArrayBuffer(data.byteLength + header.byteLength);
  const contentView = new Uint8Array(contentBuffer);

  // set combined version header
  contentView.set(header);

  // set proto ArrayBuffer
  contentView.set(data, header.byteLength);

  return ABToB64(contentBuffer);
}

function decodeEncryptedContent(ciphertextAB) {
  const header = new DataView(ciphertextAB).getUint8(0);
  const incomingCurrentVersion = header >> 4;
  // const incomingMinimumVersion = combinedVersion & 0xf;

  if (
    incomingCurrentVersion > CURRENT_ENCRYPTION_VERSION ||
    incomingCurrentVersion < MINIMUM_ENCRYPTION_VERSION
  ) {
    window.log.info('Bad encryption version:' + incomingCurrentVersion);
    throw new Error('Unsupported encryption version in ciphertext');
  }

  const contentBuffer = new Uint8Array(ciphertextAB.slice(1));
  const decrypted = textsecure.protobuf.EncryptedContent.decode(contentBuffer);

  if (incomingCurrentVersion !== decrypted.version) {
    // throw new Error('Invalid version of encryption');
    window.log.warn(
      'EncryptedContent version not matched',
      incomingCurrentVersion,
      decrypted.version
    );
  }

  return {
    cipher_text: decrypted.cipherText?.toArrayBuffer(),
    e_key: decrypted.eKey?.toArrayBuffer(),
    identity_key: decrypted.identityKey?.toArrayBuffer(),
    signed_e_key: decrypted.signedEKey?.toArrayBuffer(),
    version: decrypted.version || incomingCurrentVersion,
  };
}

// exports

window.textsecure = window.textsecure || {};
textsecure.UserSessionCipher = UserSessionCipher;
textsecure.GroupSessionCipher = GroupSessionCipher;
textsecure.CallRoomCipher = CallRoomCipher;

textsecure.decryptWithoutSessionCipher = decryptWithoutSessionCipher;

textsecure.EncryptedContent = {
  encode: encodeEncryptedContent,
  decode: decodeEncryptedContent,
};
