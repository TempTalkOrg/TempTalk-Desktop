const MAX_RETRY_COUNT = 3;

class OutgoingCall {
  #server;
  #callOptions;
  #roomCipher;
  #retry = 0;
  #missingCallees = [];

  constructor(server, callOptions, roomCipher) {
    this.#server = server;

    /*
    type CallOptions = {
      roomId?: string;
      conversationId?: {
        number?: string;
        groupId?: string;
      };
      roomName?: string;
      ourNumber: string;
      type: string;
      version: number;
      timestamp: number;
      callees: string[];
      callMessage: CallMessage;
      needSync?: boolean;
    };
    */
    this.#callOptions = callOptions;

    // roomCipher: CallRoomCipher
    this.#roomCipher = roomCipher;
  }

  #uidEmkMapToArray(uidEmkMap) {
    return Object.entries(uidEmkMap).map(([uid, emk]) => ({
      uid,
      emk: ABToB64(emk),
    }));
  }

  async #doBatchUpdateCiphers(uids, fnGetNewKeys) {
    const updateCipherMap = UserSessionCipher.userCipherMapFromUids(uids);
    const updateUids = Object.keys(updateCipherMap);
    if (!updateUids.length) {
      throw new Error('do batch update ciphers error');
    }

    try {
      const errorMap = await UserSessionCipher.batchUpdateCiphers(
        updateCipherMap,
        fnGetNewKeys
      );

      if (errorMap) {
        throw new Error('do batch update ciphers return error');
      }
    } catch (error) {
      throw new Error('do batch update ciphers error');
    }
  }

  async #doBatchLoadCiphers(uids, fnGetNewKeys) {
    try {
      const { ciphers, errorMap } = await UserSessionCipher.batchLoadCiphers(
        uids,
        fnGetNewKeys
      );

      if (errorMap) {
        throw new Error('do batch load ciphers return error');
      }

      return ciphers;
    } catch (error) {
      throw new Error('do batch load ciphers error');
    }
  }

  async #getKeys(uids) {
    let res;
    try {
      res = await this.#server.getKeysV3ForUids(uids);
    } catch (error) {
      throw new Error('get keys for uids error');
    }

    const { keys } = res || {};
    if (!Array.isArray(keys) || !keys.length) {
      throw new Error('server response invalid data when getting keys');
    }

    return keys;
  }

  #getEncMeta(metaObj) {
    // all data in meta should be encrypted using roomCipher
    return Object.entries(metaObj).reduce(
      (prevMap, [key, value]) => ({
        ...prevMap,
        [key]: this.#roomCipher.encrypt(value),
      }),
      {}
    );
  }

  #getPaddedLen(messageLength) {
    const lenWithTerminator = messageLength + 1;
    let messagePartCount = Math.floor(lenWithTerminator / 160);

    if (lenWithTerminator % 160 !== 0) {
      messagePartCount += 1;
    }

    return messagePartCount * 160;
  }

  #pad(data) {
    const dataLen = data.byteLength;
    const padded = new Uint8Array(this.#getPaddedLen(dataLen + 1) - 1);

    padded.set(new Uint8Array(data));
    padded[dataLen] = 0x80;

    return padded;
  }

  async #getCipherMessages(ciphers, fnGetProtoAB) {
    const { ourNumber, needSync } = this.#callOptions;
    const cipherMessages = [];

    for (const cipher of ciphers) {
      const uid = cipher.getUid();

      if (!needSync && uid === ourNumber) {
        // not need sync
        continue;
      }

      const protoAB = fnGetProtoAB(uid);
      const paddedAB = this.#pad(protoAB);
      const { cipherObject, receipt } = await cipher.encrypt(paddedAB);

      cipherMessages.push({
        ...receipt,
        content: textsecure.EncryptedContent.encode(cipherObject),
      });
    }

    return cipherMessages;
  }

  #getNotification() {
    return {
      type: NotificationType.MSG_ENC_CALL,
      args: {
        collapseId: this.#callOptions.collapseId,
      },
    };
  }

  #getMessageDetailType() {
    const { callMessage, type } = this.#callOptions;
    const proto = callMessage.toProto();
    if ((proto.cancel || proto.reject || proto.hangup) && type === '1on1') {
      return DetailMessageType.MANUALLY_END_PRIVATE_CALL;
    } else if (proto.hangup && type !== '1on1') {
      return DetailMessageType.MANUALLY_END_NON_PRIVATE_CALL;
    }

    return undefined;
  }

  #getConversation() {
    const { type, conversationId } = this.#callOptions;

    switch (type) {
      case CallType.OneOnOne: {
        const conversation = conversationId?.number;
        if (!conversation) {
          throw new Error('not specified conversationId for 1on1');
        }
        return conversation;
      }
      case CallType.Group: {
        const conversation = conversationId?.groupId;
        if (!conversation) {
          throw new Error('not specified conversationId for group');
        }
        return conversation;
      }
      case CallType.Instant:
        return null;
      default:
        throw new Error('unknown call type');
    }
  }

  async #handleInvalidSessionUsers(data, fnRetry) {
    let shouldRetry = false;
    const { stale, missing, extra } = data || {};

    // stale: some of members has invalid session
    if (Array.isArray(stale) && stale.length) {
      const staleUids = stale.map(key => key?.uid).filter(Boolean);
      try {
        await this.#doBatchUpdateCiphers(staleUids, () => stale);
      } catch (error) {
        throw new Error('could not update stale users');
      }

      shouldRetry = true;
    }

    // missing: there is not enough members
    if (Array.isArray(missing) && missing.length) {
      const missingUids = missing.map(key => key?.uid).filter(Boolean);
      try {
        await this.#doBatchUpdateCiphers(missingUids, () => missing);
      } catch (error) {
        throw new Error('could not update missing users');
      }

      shouldRetry = true;
      this.#missingCallees = Array.from(
        new Set([...this.#missingCallees, ...missingUids])
      );
    }

    if (shouldRetry) {
      return await fnRetry();
    }

    if (extra) {
      // extra: some of members no longer logged in for any reasons
      window.log.warn('has extra users');
      return data;
    }
  }

  /*
  https://documenter.getpostman.com/view/18949240/2s84DkUQru#590db2e3-8a9b-4ca5-a65a-5874317076b1
   √ type
   √ version
   √ timestamp
   ? roomId
   √ conversation
   √ notification
   √ publicKey
   x encMeta  NOT SUPPORTED YET
   √ encInfos
   √ cipherMessages
  */
  async startCall() {
    this.#retry += 1;

    // start a new call
    window.log.info('start a new call', this.#retry);

    if (this.#retry > MAX_RETRY_COUNT) {
      throw new Error('maximum retry times exceeded');
    }

    const callOptions = this.#callOptions;
    const callData = {};
    const assginCallData = obj => Object.assign(callData, obj);

    const { type, version, timestamp, ourNumber } = callOptions;
    if (!type) {
      throw new Error('call type was not set');
    }

    if (!ourNumber) {
      throw new Error('ourNumber was not set');
    }

    // assgin some fixed fields
    assginCallData({
      type,
      version,
      timestamp: timestamp || Date.now(),
    });

    const { callMessage } = callOptions;
    if (typeof callMessage?.toArrayBuffer !== 'function') {
      throw new Error('no valid toArrayBuffer function on callMessage');
    }

    assginCallData({
      notification: this.#getNotification(),
      conversation: this.#getConversation(),
    });

    // // NOT SUPPORTED YET
    // try {
    //   const { name } = callOptions;
    //   assginCallData({ encMeta: this.#getEncMeta({ name }) });
    // } catch (error) {
    //   //
    //   throw new Error('encrypt call meta info error');
    // }

    let ciphers;

    try {
      const { callees } = callOptions;
      const total = callees.concat(this.#missingCallees);
      total.push(ourNumber);

      ciphers = await this.#doBatchLoadCiphers(
        Array.from(new Set(total)),
        uids => this.#getKeys(uids)
      );
    } catch (error) {
      //
      throw new Error('can not load all users session');
    }

    let fnGetProtoAB;

    let ourEmk;
    try {
      const { uidEmkMap, publicKey } = this.#roomCipher.exportEMKeys(ciphers);
      ourEmk = uidEmkMap[ourNumber];

      const encInfos = this.#uidEmkMapToArray(uidEmkMap);
      assginCallData({ encInfos, publicKey: ABToB64(publicKey) });

      const { number, groupId } = this.#callOptions.conversationId || {};
      const { createCallMsg, controlType, timestamp, callees } =
        this.#callOptions;

      fnGetProtoAB = uid => {
        let conversationId;

        if (type === CallType.OneOnOne && number) {
          conversationId = { number: uid === ourNumber ? number : ourNumber };
        } else if (type === CallType.Group && groupId) {
          conversationId = { groupId };
        }

        const options = {
          emk: uidEmkMap[uid],
          publicKey: publicKey,
          conversationId,
          createCallMsg,
          controlType,
          callees: callees.filter(c => c !== ourNumber),
          timestamp,
        };

        return callMessage.toArrayBuffer(options);
      };
    } catch (error) {
      //
      throw new Error('');
    }

    // encrypt content for all callees one by one
    try {
      const cipherMessages = await this.#getCipherMessages(
        ciphers,
        fnGetProtoAB
      );
      assginCallData({ cipherMessages });
    } catch (error) {
      throw new Error('encrypt call content error');
    } finally {
      fnGetProtoAB = undefined;
    }

    // call server api
    try {
      let result;
      const { overrideRequest } = this.#callOptions;

      if (overrideRequest && typeof overrideRequest === 'function') {
        result = await overrideRequest(callData);
      } else {
        result = await this.#server.startCall(callData);
      }

      return Object.assign(result, {
        emkStale: ABToB64(ourEmk) !== result.emk, // check if emk is stale
        missingCallees: this.#missingCallees,
      });
    } catch (error) {
      const { name, code, response } = error || {};

      if (name === 'HTTPError' && code === 400 && response) {
        const { API_STATUS } = window.Signal.Types.APIStatus;
        const { status, data } = error.response;
        if (status === API_STATUS.MismatchedUsers) {
          const fnRetry = () => this.startCall();
          return await this.#handleInvalidSessionUsers(data, fnRetry);
        }
      }

      throw error;
    }
  }

  async joinCall() {
    this.#retry += 1;

    // join an existing call
    window.log.info('join an existing call', this.#retry);

    if (this.#retry > MAX_RETRY_COUNT) {
      throw new Error('maximum retry times exceeded');
    }

    const callOptions = this.#callOptions;
    const callData = {};
    const assginCallData = obj => Object.assign(callData, obj);

    const { type, roomId, version, timestamp } = callOptions;
    if (!type) {
      throw new Error('call type must be set');
    }

    if (!roomId) {
      throw new Error('call roomId must set');
    }

    // assgin some fixed fields
    assginCallData({
      type,
      roomId,
      version,
      timestamp: timestamp || Date.now(),
    });

    // call server api
    try {
      let result;
      const { overrideRequest } = this.#callOptions;

      if (overrideRequest && typeof overrideRequest === 'function') {
        result = await overrideRequest(callData);
      } else {
        result = await this.#server.joinCall(callData);
      }

      return result;
    } catch (error) {
      throw error;
    }
  }

  async inviteCall() {
    this.#retry += 1;

    // invite to an existing call
    window.log.info('invite to an existing call', this.#retry);

    if (this.#retry > MAX_RETRY_COUNT) {
      throw new Error('maximum retry times exceeded');
    }

    const callOptions = this.#callOptions;
    const callData = {};
    const assginCallData = obj => Object.assign(callData, obj);

    const { roomId, version, timestamp, callMessage } = callOptions;
    if (!roomId) {
      throw new Error('roomId must be set for inviteCall');
    }

    if (typeof callMessage?.toArrayBuffer !== 'function') {
      throw new Error('no valid toArrayBuffer function on callMessage');
    }

    // assgin some fixed fields
    assginCallData({
      roomId,
      version,
      timestamp: timestamp || Date.now(),
      notification: this.#getNotification(),
    });

    window.log.info('invite users into an existing call');

    // // NOT SUPPORTED YET
    // try {
    //   const { name } = callOptions;
    //   assginCallData({ encMeta: this.#getEncMeta({ name }) });
    // } catch (error) {
    //   //
    //   throw new Error('encrypt call meta info error');
    // }

    let ciphers;

    try {
      const { callees, caller, createCallMsg } = callOptions;

      if (createCallMsg) {
        callees.push(caller);
      }

      const total = callees.concat(this.#missingCallees);
      ciphers = await this.#doBatchLoadCiphers(total, uids =>
        this.#getKeys(uids)
      );
    } catch (error) {
      //
      throw new Error('can not load all users session');
    }

    let fnGetProtoAB;

    try {
      const { uidEmkMap, publicKey } = this.#roomCipher.exportEMKeys(ciphers);

      const encInfos = this.#uidEmkMapToArray(uidEmkMap);
      assginCallData({ encInfos, publicKey: ABToB64(publicKey) });

      // only group call invite should send with conversationId
      const { groupId } = this.#callOptions.conversationId || {};
      const { createCallMsg, controlType, caller, callees, timestamp } =
        this.#callOptions;

      fnGetProtoAB = uid => {
        const options = {
          emk: uidEmkMap[uid],
          publicKey: publicKey,
          conversationId: groupId ? { groupId } : null,
          createCallMsg,
          controlType,
          callees: callees.filter(c => c !== caller),
          timestamp,
        };
        return callMessage.toArrayBuffer(options);
      };
    } catch (error) {
      //
      throw new Error('export emk for all users error');
    }

    // encrypt content for all callees one by one
    try {
      const cipherMessages = await this.#getCipherMessages(
        ciphers,
        fnGetProtoAB
      );
      assginCallData({ cipherMessages });
    } catch (error) {
      throw new Error('encrypt call content error');
    } finally {
      fnGetProtoAB = undefined;
    }

    // call server api
    try {
      const result = await this.#server.inviteCall(callData);
      return Object.assign(result, { missingCallees: this.#missingCallees });
    } catch (error) {
      const { name, code, response } = error || {};

      if (name === 'HTTPError' && code === 400 && response) {
        const { API_STATUS } = window.Signal.Types.APIStatus;
        const { status, data } = error.response;
        if (status === API_STATUS.MismatchedUsers) {
          const fnRetry = () => this.inviteCall();
          return await this.#handleInvalidSessionUsers(data, fnRetry);
        }
      }

      throw new Error('call inviteCall webapi error');
    }
  }

  async controlCall() {
    this.#retry += 1;

    // control an existing call
    window.log.info('control an existing call', this.#retry);

    if (this.#retry > MAX_RETRY_COUNT) {
      throw new Error('maximum retry times exceeded');
    }

    const callOptions = this.#callOptions;
    const callData = {};
    const assginCallData = obj => Object.assign(callData, obj);

    const { roomId, timestamp, callMessage } = callOptions;
    if (!roomId) {
      throw new Error('roomId must be set for controlCall');
    }

    if (typeof callMessage?.toArrayBuffer !== 'function') {
      throw new Error('no valid toArrayBuffer function on callMessage');
    }

    // assgin some fixed fields
    assginCallData({
      roomId,
      timestamp: timestamp || Date.now(),
      notification: this.#getNotification(),
      detailMessageType: this.#getMessageDetailType(),
    });

    window.log.info('control an existing call');

    let ciphers;

    try {
      const { callees, needSync, ourNumber } = callOptions;
      const total = callees.concat(this.#missingCallees);

      if (needSync) {
        total.push(ourNumber);
      }

      ciphers = await this.#doBatchLoadCiphers(
        Array.from(new Set(total)),
        uids => this.#getKeys(uids)
      );
    } catch (error) {
      //
      throw new Error('can not load all users session');
    }

    let fnGetProtoAB;

    try {
      const { uidEmkMap, publicKey } = this.#roomCipher.exportEMKeys(ciphers);

      const encInfos = this.#uidEmkMapToArray(uidEmkMap);
      assginCallData({ encInfos, publicKey: ABToB64(publicKey) });

      const protoAB = callMessage.toArrayBuffer();
      fnGetProtoAB = () => protoAB;
    } catch (error) {
      //
      throw new Error('export emk for all users error');
    }

    // encrypt content for all callees one by one
    try {
      const cipherMessages = await this.#getCipherMessages(
        ciphers,
        fnGetProtoAB
      );
      assginCallData({ cipherMessages });
    } catch (error) {
      throw new Error('encrypt call content error');
    } finally {
      fnGetProtoAB = undefined;
    }

    // call server api
    try {
      const result = await this.#server.controlCall(callData);
      return Object.assign(result, { missingCallees: this.#missingCallees });
    } catch (error) {
      const { name, code, response } = error || {};

      if (name === 'HTTPError' && code === 400 && response) {
        const { API_STATUS } = window.Signal.Types.APIStatus;
        const { status, data } = error.response;
        if (status === API_STATUS.MismatchedUsers) {
          const fnRetry = () => this.controlCall();
          return await this.#handleInvalidSessionUsers(data, fnRetry);
        }
      }

      throw new Error('call controlCall webapi error');
    }
  }
}
