/* global window: false */
/* global textsecure: false */
/* global WebAPI: false */
/* global libsignal: false */
/* global WebSocketResource: false */
/* global WebSocket: false */
/* global Event: false */
/* global dcodeIO: false */
/* global _: false */
/* global Worker: false */

/* eslint-disable more/no-then */

const RETRY_TIMEOUT = 2 * 60 * 1000;

const WORKER_TIMEOUT = 60 * 1000; // one minute

const MIN_QUEUE_PENDING_SIZE = 5;

const PRIORITY = {
  DEDAULT: 0,
  PULL_MSG: 10,
  PREVIEW_MSG: 99,
  CALL_MSG: 999,
};

const _utilWorker = new Worker(
  `${window.UTIL_WORKER_ROOT ?? ''}js/util_worker.js`
);

const _jobs = Object.create(null);
const _DEBUG = false;
let _jobCounter = 0;

function _makeJob(fnName) {
  _jobCounter += 1;
  const id = _jobCounter;

  if (_DEBUG) {
    window.log.info(`Worker job ${id} (${fnName}) started`);
  }
  _jobs[id] = {
    fnName,
    start: Date.now(),
  };

  return id;
}

function _updateJob(id, data) {
  const { resolve, reject } = data;
  const { fnName, start } = _jobs[id];

  _jobs[id] = {
    ..._jobs[id],
    ...data,
    resolve: value => {
      _removeJob(id);
      const delta = Date.now() - start;
      if (delta > 10) {
        window.log.info(`Worker job ${id} (${fnName}) succeeded in ${delta}ms`);
      }
      return resolve(value);
    },
    reject: error => {
      _removeJob(id);
      const end = Date.now();
      window.log.info(
        `Worker job ${id} (${fnName}) failed in ${end - start}ms`
      );
      return reject(error);
    },
  };
}

function _removeJob(id) {
  if (_DEBUG) {
    _jobs[id].complete = true;
  } else {
    delete _jobs[id];
  }
}

function _getJob(id) {
  return _jobs[id];
}

async function callWorker(fnName, ...args) {
  const jobId = _makeJob(fnName);

  return new Promise((resolve, reject) => {
    _utilWorker.postMessage([jobId, fnName, ...args]);

    _updateJob(jobId, {
      resolve,
      reject,
      args: _DEBUG ? args : null,
    });

    setTimeout(
      () => reject(new Error(`Worker job ${jobId} (${fnName}) timed out`)),
      WORKER_TIMEOUT
    );
  });
}

_utilWorker.onmessage = e => {
  const [jobId, errorForDisplay, result] = e.data;

  const job = _getJob(jobId);
  if (!job) {
    throw new Error(
      `Received worker reply to job ${jobId}, but did not have it in our registry!`
    );
  }

  const { resolve, reject, fnName } = job;

  if (errorForDisplay) {
    return reject(
      new Error(
        `Error received from worker job ${jobId} (${fnName}): ${errorForDisplay}`
      )
    );
  }

  return resolve(result);
};

function MessageReceiver(username, password, signalingKey, options = {}) {
  this.count = 0;

  this.signalingKey = signalingKey;
  this.username = username;
  this.password = password;
  this.server = WebAPI.connect({
    username,
    password,
    firstRun: options.firstRun,
  });

  const address = libsignal.SignalProtocolAddress.fromString(username);
  this.number = address.getName();
  this.deviceId = address.getDeviceId();

  this.conversationQueue = new window.PQueue({ concurrency: 1 });
  this.incomingQueue = new window.PQueue({ concurrency: 1, autoStart: false });
  this.pendingQueue = new window.PQueue({ concurrency: 1 });
  this.appQueue = new window.PQueue({ concurrency: 1 });

  this.cacheAddBatcher = window.Signal.Util.createBatcher({
    name: 'cacheAddBatcher',
    wait: 200,
    maxSize: 20,
    processBatch: this.cacheAndQueueBatch.bind(this),
  });

  this.cacheUpdateBatcher = window.Signal.Util.createBatcher({
    name: 'cacheUpdateBatcher',
    wait: 200,
    maxSize: 10,
    processBatch: this.cacheUpdateBatch.bind(this),
  });
  this.cacheRemoveBatcher = window.Signal.Util.createBatcher({
    name: 'cacheRemoveBatcher',
    wait: 200,
    maxSize: 10,
    processBatch: this.cacheRemoveBatch.bind(this),
  });

  this.incomingQueue.add(async () => {
    const evEmpty = new Event('empty');
    await this.dispatchAndWait(evEmpty);
  });

  // always processed cached messages first
  // and will resume the incomingQueue when it is done.
  this.pendingQueue.add(() => this.queueAllCached());
}

MessageReceiver.stringToArrayBuffer = string =>
  Promise.resolve(dcodeIO.ByteBuffer.wrap(string, 'binary').toArrayBuffer());

MessageReceiver.arrayBufferToUTF8String = arrayBuffer =>
  Promise.resolve(dcodeIO.ByteBuffer.wrap(arrayBuffer).toString('utf8'));

MessageReceiver.arrayBufferToString = arrayBuffer =>
  Promise.resolve(dcodeIO.ByteBuffer.wrap(arrayBuffer).toString('binary'));

MessageReceiver.stringToArrayBufferBase64 = string =>
  callWorker('stringToArrayBufferBase64', string);
MessageReceiver.arrayBufferToStringBase64 = arrayBuffer =>
  callWorker('arrayBufferToStringBase64', arrayBuffer);

// MessageReceiver.stringToAB = string =>
//   dcodeIO.ByteBuffer.wrap(string, 'binary').toArrayBuffer();
// MessageReceiver.ABToString = arrayBuffer =>
//   dcodeIO.ByteBuffer.wrap(arrayBuffer).toString('binary');
// MessageReceiver.stringToABBase64 = string =>
//   dcodeIO.ByteBuffer.wrap(string, 'base64').toArrayBuffer();
// MessageReceiver.ABToStringBase64 = arrayBuffer =>
//   dcodeIO.ByteBuffer.wrap(arrayBuffer).toString('base64');

MessageReceiver.prototype = new textsecure.EventTarget();
MessageReceiver.prototype.extend({
  constructor: MessageReceiver,
  connect() {
    if (this.confirmTimeout) {
      clearTimeout(this.confirmTimeout);
      this.confirmTimeout = null;
    }

    if (this.calledClose) {
      return;
    }

    this.count = 0;
    if (this.hasConnected) {
      const ev = new Event('reconnect');
      this.dispatchEvent(ev);
    }

    this.isEmptied = false;
    this.hasConnected = true;

    if (this.socket && this.socket.readyState !== WebSocket.CLOSED) {
      this.socket.close();
      this.wsr.close();
    }
    // initialize the socket and start listening for messages
    this.socket = this.server.getMessageSocket();

    const connectTimeout = 30 * 1000;
    this.connectTimeoutTimer = setTimeout(() => {
      log.error('websocket connect timeout.');
      if (this.socket) {
        this.socket.close();
      }

      if (this.wsr) {
        this.wsr.close();
      }

      this.shutdown();
    }, connectTimeout);

    this.socket.onclose = this.onclose.bind(this);
    this.socket.onerror = this.onerror.bind(this);
    this.socket.onopen = this.onopen.bind(this);
    this.wsr = new WebSocketResource(this.socket, {
      handleRequest: this.handleRequest.bind(this),
      keepalive: {
        path: '/v1/keepalive',
        disconnect: true,
      },
    });

    // Because sometimes the socket doesn't properly emit its close event
    this._onClose = this.onclose.bind(this);
    this.wsr.addEventListener('close', this._onClose);
  },
  stopProcessing() {
    window.log.info('MessageReceiver: stopProcessing requested');
    this.stoppingProcessing = true;
    return this.close();
  },
  unregisterBatchers() {
    window.log.info('MessageReceiver: unregister batchers');
    this.cacheAddBatcher.unregister();
    this.cacheUpdateBatcher.unregister();
    this.cacheRemoveBatcher.unregister();
  },
  async waitForBatchers() {
    window.log.info('MessageReceiver: wait for batchers');
    try {
      await Promise.all([
        this.cacheAddBatcher.flushAndWait(),
        this.cacheUpdateBatcher.flushAndWait(),
        this.cacheRemoveBatcher.flushAndWait(),
      ]);
    } catch (error) {
      window.log.error(
        'MessageReceiver: wait for batchers failed:',
        error && error.stack ? error.stack : error
      );
    }
  },
  shutdown() {
    if (this.socket) {
      this.socket.onclose = null;
      this.socket.onerror = null;
      this.socket.onopen = null;
      this.socket = null;
    }

    if (this.wsr) {
      this.wsr.removeEventListener('close', this._onClose);
      this.wsr = null;
    }
  },
  close() {
    window.log.info('MessageReceiver.close()');
    this.calledClose = true;

    // Our WebSocketResource instance will close the socket and emit a 'close' event
    //   if the socket doesn't emit one quickly enough.
    if (this.wsr) {
      this.wsr.close(3000, 'called close');
    }

    this.clearRetryTimeout();

    return this.drain();
  },
  checkStatus() {
    window.log.info('receiver checking websocket status ...');

    if (this.wsr) {
      this.wsr.checkStatus();
    }
  },
  onopen() {
    window.log.info('websocket open');
    clearTimeout(this.connectTimeoutTimer);
  },
  onerror() {
    window.log.error('websocket error');
    clearTimeout(this.connectTimeoutTimer);
  },
  dispatchAndWait(event) {
    const { priority = 0 } = event;
    this.appQueue.add(() => Promise.all(this.dispatchEvent(event)), {
      priority,
    });

    return Promise.resolve();
  },
  onclose(ev) {
    window.log.info(
      'websocket closed',
      ev.code,
      ev.reason || '',
      'calledClose:',
      this.calledClose
    );

    clearTimeout(this.connectTimeoutTimer);
    clearTimeout(this.confirmTimeout);

    this.shutdown();

    if (this.calledClose) {
      return Promise.resolve();
    }
    if (ev.code === 3000) {
      return Promise.resolve();
    }
    if (ev.code === 3001) {
      this.onEmpty();
    }
    // possible 403 or network issue. Make an request to confirm
    return this.server
      .getDevices(this.number)
      .then(() => {
        // No HTTP error? Reconnect
        const now = Date.now();
        const lastConfirmAt = this.confirmAt || now;

        const minTimeout = 5000;
        const delta = minTimeout - Math.abs(now - lastConfirmAt);
        const timeout = delta > 0 ? delta : 0;

        this.confirmTimeout = setTimeout(() => {
          if (this.confirmTimeout) {
            clearTimeout(this.confirmTimeout);
            this.confirmTimeout = null;
          }

          this.confirmAt = Date.now();
          try {
            this.connect();
          } catch (e) {
            const event = new Event('error');
            event.error = e;
            return this.dispatchAndWait(event);
          }
        }, timeout);
      })
      .catch(e => {
        const event = new Event('error');
        event.error = e;
        return this.dispatchAndWait(event);
      });
  },
  async handleConversationInfo(conversationPreview) {
    try {
      const {
        conversationId,
        readPosition,
        unreadCorrection,
        latestMessage,
        onePageMessages = [],
        latestMsgNtfSeqId,
        maxOutgoingMsgNtfSeqId,
        maxOutgoingMsgSeqId,
      } = conversationPreview || {};

      if (conversationId?.groupId) {
        conversationId.groupId = conversationId.groupId.toBinary();
      }

      const uniformId = window.Signal.ID.getUniformId(conversationId);

      const conversationInfo = {
        conversationPreview: {
          conversationId: uniformId.getIdForCompatible(),
          unreadCorrection,
          latestMsgNtfSeqId: latestMsgNtfSeqId?.toNumber(),
          maxOutgoingMsgNtfSeqId: maxOutgoingMsgNtfSeqId?.toNumber(),
          maxOutgoingMsgSeqId: maxOutgoingMsgSeqId?.toNumber(),
        },
      };

      if (readPosition) {
        const {
          groupId,
          readAt,
          maxServerTimestamp,
          maxNotifySequenceId,
          maxSequenceId,
        } = readPosition;

        let hasError = false;
        if (groupId) {
          const tempId = window.Signal.ID.getUniformId({ groupId });
          if (!_.isEqual(tempId, uniformId)) {
            log.error('group id is not matched', groupId, conversationId);
            hasError = true;
          }
        }

        if (!hasError) {
          conversationInfo.conversationPreview.readPosition = {
            groupId: uniformId.getIdForCompatible().groupId,
            readAt: readAt?.toNumber(),
            maxServerTimestamp: maxServerTimestamp?.toNumber(),
            maxNotifySequenceId: maxNotifySequenceId?.toNumber(),
            maxSequenceId: maxSequenceId?.toNumber(),
          };
        }
      }

      if (latestMessage) {
        const id = window.getGuid();
        const conversationPushedAt = Date.now();

        window.log.info(
          'handling conversation latest message',
          `${id} at ${conversationPushedAt}`,
          uniformId.getIdForLogging()
        );

        const envelope = {
          ...latestMessage,
          id,
          conversationPushedAt,
          priority: PRIORITY.PREVIEW_MSG,
          conversationId: uniformId.getIdForCompatible(),
        };

        const envelopeId = this.getEnvelopeId(envelope);
        if (!(await this.waitForQueuesAvailable(envelopeId))) {
          window.log.info('stop processing latest message', envelopeId);
          return;
        }

        this.queueEnvelope(envelope);
      }

      const ev = new Event('conversationInfo');
      ev.conversationInfo = conversationInfo;
      await this.dispatchAndWait(ev);
    } catch (error) {
      console.log('handleConversationInfo failed', error);
    }
  },
  async handleMessageRequest(request) {
    const { body, respond } = request || {};
    let envelope = {};

    try {
      const plaintext = await textsecure.crypto.decryptWebsocketMessage(
        body,
        this.signalingKey
      );

      const { Envelope } = textsecure.protobuf;
      envelope = Envelope.decode(plaintext);
      // After this point, decoding errors are not the server's
      //   fault, and we should handle them gracefully and tell the
      //   user they received an invalid message

      envelope.id = window.getGuid();
      envelope.priority =
        envelope.messageType === Envelope.MsgType.MSG_ENC_CALL
          ? PRIORITY.CALL_MSG
          : PRIORITY.DEDAULT;

      await this.cacheAndQueuePlain(envelope, plaintext, request);
    } catch (error) {
      if (typeof respond === 'function') {
        try {
          respond.call(request, 500, 'Bad encrypted websocket message');
        } catch (error) {
          window.log.error('failed to response 500', error?.stack || error);
        }
      }

      window.log.error(
        'Error handling incoming message:',
        error && error.stack ? error.stack : error,
        this.getEnvelopeId(envelope)
      );

      this.reportException(
        {
          brief: 'Bad encrypted websocket message',
          error: error && error.stack ? error.stack : error,
          message: error?.message || 'Unkown error message',
        },
        envelope
      );

      const ev = new Event('error');
      ev.error = error;
      await this.dispatchAndWait(ev);
    }
  },
  async handleConversationRequest(request) {
    const { body, respond } = request || {};

    let preview;

    const simplePreview = () => {
      _.pick(preview || {}, [
        'conversationId',
        'readPosition',
        'latestMsgNtfSeqId',
        'maxOutgoingMsgNtfSeqId',
        'maxOutgoingMsgSeqId',
      ]);
    };

    try {
      preview = textsecure.protobuf.ConversationPreview.decode(body);

      await this.handleConversationInfo(preview);

      if (typeof respond === 'function') {
        try {
          respond.call(request, 200, 'OK');
        } catch (error) {
          window.log.error(
            'Error respond 200 for conversation preview',
            simplePreview(),
            error && error.stack ? error.stack : error
          );
        }
      }
    } catch (error) {
      if (typeof respond === 'function') {
        try {
          respond.call(request, 500, 'Bad websocket message');
        } catch (error) {
          window.log.error(
            'Error respond 500 for conversation preview',
            simplePreview(),
            error && error.stack ? error.stack : error
          );
        }
      }

      window.log.error(
        'Error handling conversation preview:',
        error && error.stack ? error.stack : error
      );

      this.reportException({
        brief: 'Bad encrypted websocket conversation preview',
        error: error && error.stack ? error.stack : error,
        message: error?.message || 'Unkown error message',
      });

      const ev = new Event('error');
      ev.error = error;
      await this.dispatchAndWait(ev);
    }
  },
  handleRequest(request) {
    // We do the message decryption here, instead of in the ordered pending queue,
    // to avoid exposing the time it took us to process messages through the time-to-ack.
    const { verb, path } = request;

    if (path === '/api/v1/message') {
      this.incomingQueue.add(() => this.handleMessageRequest(request));
    } else if (verb === 'PUT' && path === '/api/v1/conversation') {
      this.conversationQueue.add(() => this.handleConversationRequest(request));
    } else {
      window.log.info('got request', request.verb, request.path);
      request.respond(200, 'OK');

      if (verb === 'PUT' && path === '/api/v1/queue/empty') {
        this.incomingQueue.add(() => this.onEmpty(true));
      } else if (
        verb === 'PUT' &&
        path === '/api/v1/queue/conversation/empty'
      ) {
        this.conversationQueue.add(() => {
          console.log('conversation queue empty');
        });
      }

      return;
    }
  },
  addToPendingQueue(task, priority = 0) {
    if (priority === PRIORITY.PULL_MSG) {
      this.count += 1;
    }

    const promise = this.pendingQueue.add(task, { priority });

    if (priority === PRIORITY.PULL_MSG) {
      const { count } = this;
      const update = () => this.updateProgress(count);
      promise.then(update, update);
    }

    return promise;
  },
  onEmpty(incomingQueueEmpty) {
    const emitEmpty = () => {
      window.log.info("MessageReceiver: emitting 'empty' event");

      const ev = new Event('empty');
      ev.incomingQueueEmpty = !!incomingQueueEmpty;
      this.dispatchAndWait(ev);

      this.isEmptied = true;

      this.maybeScheduleRetryTimeout();
    };

    const waitForPendingQueue = () => {
      window.log.info(
        "MessageReceiver: finished processing messages after 'empty', now waiting for application"
      );

      // We don't await here because we don't want this to gate future message processing
      this.appQueue.add(emitEmpty);
    };

    const waitForIncomingQueue = () => {
      this.addToPendingQueue(waitForPendingQueue);

      // Note: this.count is used in addToPendingQueue
      // Resetting count so everything from the websocket after this starts at zero
      this.count = 0;
    };

    const waitForCacheAddBatcher = async () => {
      await this.cacheAddBatcher.onIdle();
      this.incomingQueue.add(waitForIncomingQueue);
    };

    waitForCacheAddBatcher();
  },
  drain() {
    const waitForIncomingQueue = () =>
      this.addToPendingQueue(() => {
        window.log.info('drained');
      });

    return this.incomingQueue.add(waitForIncomingQueue);
  },
  updateProgress(count) {
    // count by 10s
    if (count % 10 !== 0) {
      return;
    }
    const ev = new Event('progress');
    ev.count = count;
    this.dispatchEvent(ev);
  },
  async queueAllCached() {
    let itemCaches = [];

    try {
      itemCaches = await this.getAllFromCache();
    } catch (error) {
      window.log.error(
        'getAllFromCache failed:',
        error && error.stack ? error.stack : error
      );
    }

    const total = itemCaches.length;

    const handleCaches = async () => {
      window.log.info(`handleCaches with: ${itemCaches.length}/${total}`);

      if (this.stoppingProcessing) {
        window.log.info(`stop handleCaches at: ${itemCaches.length}/${total}`);
        this.incomingQueue.start();
        return;
      }

      const items = itemCaches.splice(0, 50);

      for (const item of items) {
        try {
          const { requiredProtocolVersion = 0 } = item;
          const current =
            textsecure.protobuf.DataMessage.ProtocolVersion.CURRENT;

          if (
            typeof requiredProtocolVersion === 'number' &&
            current < requiredProtocolVersion
          ) {
            log.info(
              `Unsupported protocol version ${requiredProtocolVersion}`,
              item.id
            );

            continue;
          }

          const attempts = 1 + (item.attempts || 0);

          if (attempts >= 3) {
            window.log.warn(
              'queueAllCached final attempt for envelope',
              item.id,
              attempts
            );

            this.removeFromCache(item);
          } else {
            this.updateCacheOfOptions(item.id, item, { attempts });
          }

          await this.onQueueNotBusy(
            this.appQueue,
            MIN_QUEUE_PENDING_SIZE,
            'appQueue'
          );

          await this.queueCached(item);

          // break task
          await new Promise(r => setTimeout(r, 0));
        } catch (error) {
          window.log.error(
            'handle cache failed,',
            error && error.stack ? error.stack : error
          );
        }
      }

      if (itemCaches.length) {
        this.pendingQueue.add(async () => {
          try {
            await handleCaches();
          } catch (error) {
            window.log.error(
              'handleCaches error 2, resume incoming queue: ',
              error && error.stack ? error.stack : error
            );
            this.incomingQueue.start();
          }
        });
      } else {
        window.log.info('handleCaches done, resume incoming queue');
        this.incomingQueue.start();
      }
    };

    if (itemCaches.length) {
      this.incomingQueue.pause();
      try {
        await handleCaches();
      } catch (error) {
        window.log.error(
          'handleCaches error 1, resume incoming queue: ',
          error && error.stack ? error.stack : error
        );
        this.incomingQueue.start();
      }
    } else {
      if (this.incomingQueue.isPaused) {
        window.log.info('empty handleCaches, resume incoming queue');
        this.incomingQueue.start();
      }
    }
  },
  async queueCached(item) {
    window.log.info(
      `queueing cache item ${item?.id} cached at ${item?.timestamp}`
    );

    if (this.stoppingProcessing) {
      window.log.info('stop processing queue cache item:', item?.id);
      return;
    }

    try {
      let envelopePlaintext = item.envelope;

      if (item.version === 2) {
        envelopePlaintext =
          await MessageReceiver.stringToArrayBufferBase64(envelopePlaintext);
      }

      if (typeof envelopePlaintext === 'string') {
        envelopePlaintext =
          await MessageReceiver.stringToArrayBuffer(envelopePlaintext);
      }
      const envelope = textsecure.protobuf.Envelope.decode(envelopePlaintext);
      envelope.id = envelope.serverGuid || item.id;
      envelope.source = envelope.source || item.source;
      envelope.sourceDevice = envelope.sourceDevice || item.sourceDevice;
      // envelope.serverTimestamp =
      //   envelope.serverTimestamp || item.serverTimestamp;

      // info for external
      envelope.external = envelope.external || item.external;

      // cache for future update of data
      envelope.dataCache = item;

      const { decrypted } = item;
      if (decrypted) {
        let payloadPlaintext = decrypted;

        if (item.version === 2) {
          payloadPlaintext =
            await MessageReceiver.stringToArrayBufferBase64(payloadPlaintext);
        }

        if (typeof payloadPlaintext === 'string') {
          payloadPlaintext =
            await MessageReceiver.stringToArrayBuffer(payloadPlaintext);
        }
        this.queueDecryptedEnvelope(envelope, payloadPlaintext);
      } else {
        this.queueEnvelope(envelope);
      }
    } catch (error) {
      window.log.error(
        'queueCached error handling item',
        item.id,
        'removing it. Error:',
        error && error.stack ? error.stack : error
      );

      this.reportException(
        {
          brief: 'queueCached error handling item',
          error: error && error.stack ? error.stack : error,
          message: error?.message || 'Unkown error message',
        },
        item
      );

      // remove error item
      this.removeFromCache(item);
    }
  },
  getEnvelopeId(envelope) {
    if (envelope?.source) {
      return `${envelope.source}.${
        envelope.sourceDevice
      } ${envelope.timestamp.toNumber()} (${envelope.id})`;
    }

    return envelope?.id;
  },
  clearRetryTimeout() {
    if (this.retryCachedTimeout) {
      clearInterval(this.retryCachedTimeout);
      this.retryCachedTimeout = null;
    }
  },
  maybeScheduleRetryTimeout() {
    if (this.isEmptied) {
      this.clearRetryTimeout();
      this.retryCachedTimeout = setTimeout(() => {
        this.pendingQueue.add(() => this.queueAllCached());
      }, RETRY_TIMEOUT);
    }
  },
  async getAllFromCache() {
    window.log.info('getAllFromCache');

    const count = await textsecure.storage.unprocessed.getCount();
    if (count > 100) {
      window.log.info('unprocessed count: ', count);
      // try to de-duplicate
      const duplicated =
        await textsecure.storage.unprocessed.getDupilicateCount();
      window.log.info('duplicate unprocessed count: ', duplicated);
      if (duplicated > 100 || duplicated > count / 3) {
        await textsecure.storage.unprocessed.deduplicate();
      }
    }

    if (count > 0) {
      const items = await textsecure.storage.unprocessed.getAll();
      window.log.info(
        'getAllFromCache loaded',
        items.length,
        'saved envelopes'
      );
      return items;
    } else {
      return [];
    }
  },

  async cacheAndQueueBatch(items) {
    // break task
    await new Promise(r => setTimeout(r, 0));

    const dataArray = items.map(item => item.data);

    window.log.info('cacheAndQueueBatch with items:', items.length);

    try {
      await textsecure.storage.unprocessed.batchAdd(dataArray);

      for (const item of items) {
        const { envelope, data, request } = item;
        const envelopeId = this.getEnvelopeId(envelope || data);

        // stop processing
        if (this.stoppingProcessing) {
          window.log.info('cacheAndQueueBatch stop processing', envelopeId);
          return;
        }

        const { respond, handleDone } = request || {};
        if (typeof respond === 'function') {
          try {
            respond.call(request, 200, 'OK');
          } catch (error) {
            window.log.error(
              'failed to response 200, still queueing envelope',
              envelopeId,
              error && error.stack ? error.stack : error
            );
          }
        }

        if (!(await this.waitForQueuesAvailable(envelopeId))) {
          window.log.info('stop processing cacheAndQueueBatch', envelopeId);
          return;
        }

        if (envelope) {
          this.queueEnvelope(envelope).finally(() => {
            if (typeof handleDone === 'function') {
              handleDone();
            }
          });
        } else {
          this.queueCached(data);
        }

        // break task
        await new Promise(r => setTimeout(r, 0));
      }

      this.maybeScheduleRetryTimeout();
    } catch (error) {
      items.forEach(item => {
        const { request } = item;
        const { respond, handleDone } = request || {};

        if (typeof respond === 'function') {
          try {
            respond.call(request, 500, 'Failed to cache message');
          } catch (error) {
            window.log.error(
              'failed to response 500 when batch add failed: ',
              error && error.stack ? error.stack : error
            );
          }
        }

        if (typeof handleDone === 'function') {
          handleDone();
        }
      });
      window.log.error(
        'cacheAndQueueBatch error trying to add messages to cache:',
        error && error.stack ? error.stack : error
      );
    }
  },
  async onQueueNotBusy(queue, limit, queueName) {
    const queueSize = queue.size;
    if (queueSize <= limit) {
      return;
    }

    const start = Date.now();

    window.log.info(`onQueueNotBusy ${queueName} with begin size:`, queueSize);

    return new Promise(resolve => {
      const listener = () => {
        const delta = Date.now() - start;

        if (queue.size <= limit) {
          queue.removeListener('next', listener);

          window.log.info(`onQueueNotBusy ${queueName} done with ${delta}ms`);

          resolve();
        } else {
          if (this.stoppingProcessing) {
            window.log.info(`onQueueNotBusy ${queueName} stop with ${delta}ms`);
            resolve();
          }
        }
      };

      queue.on('next', listener);
    });
  },
  async waitForQueuesAvailable(envelopeId) {
    if (this.stoppingProcessing) {
      window.log.info('stop processing at begin:', envelopeId);
      return false;
    }

    await this.onQueueNotBusy(
      this.pendingQueue,
      MIN_QUEUE_PENDING_SIZE,
      'pendingQueue'
    );

    if (this.stoppingProcessing) {
      window.log.info('stop processing after pendingQueue:', envelopeId);
      return false;
    }

    await this.onQueueNotBusy(
      this.appQueue,
      MIN_QUEUE_PENDING_SIZE,
      'appQueue'
    );

    if (this.stoppingProcessing) {
      window.log.info('stop processing after appQueue:', envelopeId);
      return false;
    }

    return true;
  },
  async cacheAndQueuePlain(envelope, plaintext, request) {
    const { id, priority = 0 } = envelope;
    const timestamp = Date.now();
    const data = {
      id,
      version: 2,
      envelope:
        typeof plaintext === 'string'
          ? plaintext
          : await MessageReceiver.arrayBufferToStringBase64(plaintext),
      timestamp,
      attempts: 1,
    };

    const envelopeId = this.getEnvelopeId(envelope);
    window.log.info(`cacheAndQueuePlain add ${envelopeId} at ${timestamp}`);

    this.cacheAddBatcher.add({ request, envelope, data }, { priority });
  },
  async cacheAndQueueExternal(base64Text, external) {
    const timestamp = Date.now();
    const data = {
      id: window.getGuid(),
      version: 2,
      envelope: base64Text, // base64 encoded
      timestamp,
      attempts: 1,
      external,
    };

    window.log.info(`cacheAndQueueExternal (${data.id}) at ${timestamp}`);

    this.cacheAddBatcher.add({ data });
  },
  async cacheUpdateBatch(items) {
    // get latest
    const updates = [];
    items.reduceRight((previous, current) => {
      const { id } = current;
      if (id && !previous.includes(id)) {
        previous.push(id);
        updates.push(current);
      }

      return previous;
    }, []);

    window.log.info(
      `batch update unprocesseds for ` + `${updates.length} in ${items.length}`
    );

    try {
      // updates: [{id, data}]
      await textsecure.storage.unprocessed.updateUnprocesseds(updates);
    } catch (error) {
      window.log.error(
        'updateUnprocesseds failed:',
        updates.map(u => u.id),
        error && error.stack ? error.stack : error
      );
    }
  },
  async updateCache(envelope, plaintext) {
    const { id } = envelope;
    const data = {
      source: envelope.source,
      sourceDevice: envelope.sourceDevice,
      // serverTimestamp: envelope.serverTimestamp,
      external: envelope.external,
      decrypted: await MessageReceiver.arrayBufferToStringBase64(plaintext),
      requiredProtocolVersion: 0,
    };

    // save cache for future use.
    envelope.dataCache = data;

    this.cacheUpdateBatcher.add({ id, data });
  },
  updateCacheOfOptions(id, data, options) {
    // update for attempts/requiredProtocolVersion
    this.cacheUpdateBatcher.add({
      id,
      data: {
        ...data,
        ...options,
      },
    });
  },
  async cacheRemoveBatch(ids) {
    const removedIds = ids.filter(id => typeof id === 'string' && id.length);

    window.log.info(
      `batch remove unprocessed ${removedIds.length} in ${ids.length}`
    );

    if (removedIds.length) {
      try {
        await textsecure.storage.unprocessed.remove(removedIds);
      } catch (error) {
        window.log.error('remove unprocesseds failed:', error, removedIds);
      }
    }
  },
  removeFromCache(item) {
    const { id } = item;
    this.cacheRemoveBatcher.add(id);
    return Promise.resolve();
  },
  queueDecryptedEnvelope(envelope, plaintext) {
    const id = this.getEnvelopeId(envelope);
    window.log.info('queueing decrypted envelope', id);

    if (this.stoppingProcessing) {
      window.log.info('stop processing queueing decrypted envelope:', id);
      return;
    }

    const task = this.handleDecryptedEnvelope.bind(this, envelope, plaintext);
    const taskWithTimeout = textsecure.createTaskWithTimeout(
      task,
      `queueEncryptedEnvelope ${id}`
    );
    const promise = this.addToPendingQueue(taskWithTimeout);

    return promise.catch(error => {
      window.log.error(
        `queueDecryptedEnvelope error handling envelope ${id}:`,
        error && error.stack ? error.stack : error
      );
    });
  },
  queueEnvelope(envelope) {
    const id = this.getEnvelopeId(envelope);
    window.log.info('queueing envelope', id);

    if (this.stoppingProcessing) {
      window.log.info('stop processing queueing envelope:', id);
      return;
    }

    const task = this.handleEnvelope.bind(this, envelope);
    const taskWithTimeout = textsecure.createTaskWithTimeout(
      task,
      `queueEnvelope ${id}`
    );

    const { priority = 0 } = envelope;

    const promise = this.addToPendingQueue(taskWithTimeout, priority);

    return promise.catch(error => {
      window.log.error(
        'queueEnvelope error handling envelope',
        id,
        ':',
        error && error.stack ? error.stack : error
      );

      this.reportException(
        {
          brief: 'queueEnvelope error handling envelope',
          error: error && error.stack ? error.stack : error,
          message: error?.message || 'Unkown error message',
        },
        envelope
      );
    });
  },
  // Same as handleEnvelope, just without the decryption step. Necessary for handling
  //   messages which were successfully decrypted, but application logic didn't finish
  //   processing.
  async handleDecryptedEnvelope(envelope, plaintext) {
    // break task
    await new Promise(r => setTimeout(r, 0));

    if (this.stoppingProcessing) {
      return Promise.resolve();
    }
    // No decryption is required for delivery receipts, so the decrypted field of
    //   the Unprocessed model will never be set

    if (envelope.content) {
      return this.innerHandleContentMessage(envelope, plaintext);
    } else if (envelope.legacyMessage) {
      return this.innerHandleLegacyMessage(envelope, plaintext);
    }
    this.removeFromCache(envelope);
    throw new Error('Received message with no content and no legacyMessage');
  },
  async handleEnvelope(envelope) {
    // break task
    await new Promise(r => setTimeout(r, 0));

    if (this.stoppingProcessing) {
      return Promise.resolve();
    }

    if (envelope.type === textsecure.protobuf.Envelope.Type.RECEIPT) {
      return this.onDeliveryReceipt(envelope);
    } else if (
      envelope.type === textsecure.protobuf.Envelope.Type.NOTIFICATION
    ) {
      return this.onChangeNotification(envelope);
    }

    if (envelope.content) {
      return this.handleContentMessage(envelope);
    } else if (envelope.legacyMessage) {
      return this.handleLegacyMessage(envelope);
    }
    this.removeFromCache(envelope);

    this.reportException(
      {
        brief: 'Received message with no content and no legacyMessage',
        message: 'Received message with no content and no legacyMessage',
      },
      envelope
    );

    throw new Error('Received message with no content and no legacyMessage');
  },
  getStatus() {
    if (this.socket) {
      return this.socket.readyState;
    } else if (this.hasConnected) {
      return WebSocket.CLOSED;
    }
    return -1;
  },
  onDeliveryReceipt(envelope) {
    // delivery receipt no longer supported
    window.log.info('Unsupported onDeliveryReceipt');
    return this.removeFromCache(envelope);
  },
  onChangeNotification(envelope) {
    return new Promise((resolve, reject) => {
      if (!envelope.content) {
        throw new Error('notification has no content.');
      }

      return MessageReceiver.arrayBufferToUTF8String(envelope.content).then(
        notification => {
          const ev = new Event('notification');
          ev.confirm = this.removeFromCache.bind(this, envelope);

          try {
            ev.notification = JSON.parse(notification);
          } catch (e) {
            log.error('JSON parse failed: ' + notification + ', err:' + e);
            throw new Error('Notification format is not valid json.');
          }

          this.dispatchAndWait(ev).then(resolve, reject);
        }
      );
    });
  },
  unpad(paddedData) {
    const paddedPlaintext = new Uint8Array(paddedData);
    let plaintext;

    for (let i = paddedPlaintext.length - 1; i >= 0; i -= 1) {
      if (paddedPlaintext[i] === 0x80) {
        plaintext = new Uint8Array(i);
        plaintext.set(paddedPlaintext.subarray(0, i));
        plaintext = plaintext.buffer;
        break;
      } else if (paddedPlaintext[i] !== 0x00) {
        throw new Error('Invalid padding');
      }
    }

    return plaintext;
  },
  async decrypt(envelope, ciphertext) {
    let promise;

    const getSignalAddress = () => {
      return new libsignal.SignalProtocolAddress(
        envelope.source,
        envelope.sourceDevice
      );
    };

    const createSessionCipher = address => {
      const ourNumber = textsecure.storage.user.getNumber();
      const number = address.toString().split('.')[0];
      const options = {};

      // No limit on message keys if we're communicating with our other devices
      if (ourNumber === number) {
        options.messageKeysLimit = false;
      }

      return new libsignal.SessionCipher(
        textsecure.storage.protocol,
        address,
        options
      );
    };

    let address;

    switch (envelope.type) {
      case textsecure.protobuf.Envelope.Type.CIPHERTEXT:
        window.log.info('message from', this.getEnvelopeId(envelope));
        address = getSignalAddress();
        promise = createSessionCipher(address)
          .decryptWhisperMessage(ciphertext)
          .then(this.unpad);
        break;
      // case textsecure.protobuf.Envelope.Type.PREKEY_BUNDLE:
      //   window.log.info('prekey message from', this.getEnvelopeId(envelope));
      //   address = getSignalAddress();
      //   promise = this.decryptPreKeyWhisperMessage(
      //     ciphertext,
      //     createSessionCipher(address),
      //     address
      //   );
      //   break;
      case textsecure.protobuf.Envelope.Type.PLAINTEXT:
        window.log.info('1 message from', this.getEnvelopeId(envelope));
        promise = Promise.resolve(ciphertext.toArrayBuffer());
        break;
      case textsecure.protobuf.Envelope.Type.ENCRYPTEDTEXT:
        window.log.info(
          '1 ENCRYPTEDTEXT message from',
          this.getEnvelopeId(envelope)
        );

        let cipherObject;
        try {
          cipherObject = textsecure.EncryptedContent.decode(
            ciphertext.toArrayBuffer()
          );
        } catch (error) {
          window.log.warn('decode EncryptedContent error', error);
          promise = Promise.reject('Decode EncryptedContent error');
          break;
        }

        let plaintext;
        try {
          plaintext = await textsecure.decryptWithoutSessionCipher(
            cipherObject,
            undefined,
            envelope.identityKey,
            envelope.peerContext
          );
        } catch (error) {
          window.log.warn('decrypt envelope content error', error);
          promise = Promise.reject('decrypt envelope content error');
          break;
        }

        promise = Promise.resolve(this.unpad(plaintext));
        break;
      default:
        promise = Promise.reject(new Error('Unknown message type'));
    }

    return promise
      .then(plaintext => {
        const { isMe } = plaintext || {};
        if (isMe) {
          this.removeFromCache(envelope);
          return null;
        }

        // Note: this is an out of band update; there are cases where the item in the
        //   cache has already been deleted by the time this runs. That's okay.
        this.updateCache(envelope, plaintext);

        return plaintext;
      })
      .catch(error => {
        let errorToThrow = error;

        if (error && error.message === 'Unknown identity key') {
          // create an error that the UI will pick up and ask the
          // user if they want to re-negotiate
          const buffer = dcodeIO.ByteBuffer.wrap(ciphertext);
          errorToThrow = new textsecure.IncomingIdentityKeyError(
            address?.toString(),
            buffer.toArrayBuffer(),
            error.identityKey
          );
        }
        const ev = new Event('error');
        ev.error = errorToThrow;
        ev.proto = envelope;
        ev.confirm = this.removeFromCache.bind(this, envelope);

        const returnError = () => Promise.reject(errorToThrow);
        return this.dispatchAndWait(ev).then(returnError, returnError);
      });
  },
  async decryptPreKeyWhisperMessage(ciphertext, sessionCipher, address) {
    const padded = await sessionCipher.decryptPreKeyWhisperMessage(ciphertext);

    try {
      return this.unpad(padded);
    } catch (e) {
      if (e.message === 'Unknown identity key') {
        // create an error that the UI will pick up and ask the
        // user if they want to re-negotiate
        const buffer = dcodeIO.ByteBuffer.wrap(ciphertext);
        throw new textsecure.IncomingIdentityKeyError(
          address.toString(),
          buffer.toArrayBuffer(),
          e.identityKey
        );
      }
      throw e;
    }
  },
  handleSentMessage(envelope, sentContainer, msg) {
    const {
      destination,
      timestamp,
      expirationStartTimestamp,
      rapidFiles,
      serverTimestamp,
      sequenceId,
      notifySequenceId,
    } = sentContainer;

    let p = Promise.resolve();
    // eslint-disable-next-line no-bitwise
    if (msg.flags & textsecure.protobuf.DataMessage.Flags.END_SESSION) {
      p = this.handleEndSession(destination);
    }
    return p.then(() =>
      this.processDecrypted(envelope, msg).then(message => {
        const ev = new Event('sent');
        ev.confirm = () => {
          if (!message.unexpected) {
            this.removeFromCache(envelope);
          }
        };
        ev.data = {
          destination,
          timestamp: timestamp.toNumber(),
          device: envelope.sourceDevice,
          message,
          conversationPushedAt: envelope.conversationPushedAt,
        };
        if (expirationStartTimestamp) {
          ev.data.expirationStartTimestamp =
            expirationStartTimestamp.toNumber();
        }

        if (rapidFiles && rapidFiles.length > 0) {
          ev.data.rapidFiles = rapidFiles;
        }

        if (serverTimestamp) {
          ev.data.serverTimestamp = serverTimestamp.toNumber();
        } else {
          ev.data.serverTimestamp = ev.data.timestamp;
        }

        if (sequenceId) {
          ev.data.sequenceId = sequenceId.toNumber();
        }

        if (notifySequenceId) {
          ev.data.notifySequenceId = notifySequenceId.toNumber();
        }

        ev.priority = envelope.priority;

        return this.dispatchAndWait(ev);
      })
    );
  },
  handleDataMessage(envelope, msg) {
    window.log.info('data message from', this.getEnvelopeId(envelope));
    let p = Promise.resolve();
    // eslint-disable-next-line no-bitwise
    if (msg.flags & textsecure.protobuf.DataMessage.Flags.END_SESSION) {
      p = this.handleEndSession(envelope.source);
    }
    return p.then(() =>
      this.processDecrypted(envelope, msg).then(message => {
        const groupId = message.group && message.group.id;
        const isMe = envelope.source === textsecure.storage.user.getNumber();

        const eventName = envelope.external
          ? 'externalMessage'
          : isMe
            ? 'sent'
            : 'message';

        const ev = new Event(eventName);
        ev.confirm = () => {
          if (!message.unexpected) {
            this.removeFromCache(envelope);
          }
        };

        if (eventName === 'sent') {
          const number = envelope.conversationId?.number || envelope.source;

          ev.data = {
            destination: groupId ? null : number,
            timestamp: envelope.timestamp.toNumber(),
            device: envelope.sourceDevice,
            message,
            sequenceId: envelope.sequenceId?.toNumber(),
            serverTimestamp: envelope.systemShowTimestamp?.toNumber(),
            notifySequenceId: envelope.notifySequenceId?.toNumber(),
            conversationPushedAt: envelope.conversationPushedAt,
          };
        } else {
          ev.data = {
            source: envelope.source,
            sourceDevice: envelope.sourceDevice,
            timestamp: envelope.timestamp.toNumber(),
            receivedAt: envelope.receivedAt,
            message,
            envelopeType: envelope.type,
            external: envelope.external,
            sequenceId: envelope.sequenceId?.toNumber(),
            serverTimestamp: envelope.systemShowTimestamp?.toNumber(),
            notifySequenceId: envelope.notifySequenceId?.toNumber(),
            messageType: envelope.messageType,
            conversationPushedAt: envelope.conversationPushedAt,
          };
        }

        ev.priority = envelope.priority;

        window.log.info('dispatch message', this.getEnvelopeId(envelope));

        return this.dispatchAndWait(ev);
      })
    );
  },
  handleLegacyMessage(envelope) {
    return this.decrypt(envelope, envelope.legacyMessage).then(plaintext => {
      if (!plaintext) {
        window.log.warn('handleLegacyMessage: plaintext was falsey');
        return null;
      }
      return this.innerHandleLegacyMessage(envelope, plaintext);
    });
  },
  innerHandleLegacyMessage(envelope, plaintext) {
    const message = textsecure.protobuf.DataMessage.decode(plaintext);
    return this.handleDataMessage(envelope, message);
  },
  handleContentMessage(envelope) {
    return this.decrypt(envelope, envelope.content).then(plaintext => {
      if (!plaintext) {
        window.log.warn('handleContentMessage: plaintext was falsey');
        return null;
      }
      return this.innerHandleContentMessage(envelope, plaintext);
    });
  },
  innerHandleContentMessage(envelope, plaintext) {
    let errorMessage;
    const content = textsecure.protobuf.Content.decode(plaintext);
    if (content.syncMessage) {
      return this.handleSyncMessage(envelope, content.syncMessage);
    } else if (content.dataMessage) {
      // This prevents replay attacks by the service.
      if (
        envelope.timestamp &&
        content.dataMessage.timestamp &&
        envelope.timestamp.toNumber() !==
          content.dataMessage.timestamp.toNumber()
      ) {
        errorMessage =
          'Ignoring message with non-matching data message timestamp';
        console.log(errorMessage + envelope.source);
      } else {
        return this.handleDataMessage(envelope, content.dataMessage);
      }
    } else if (content.nullMessage) {
      return this.handleNullMessage(envelope, content.nullMessage);
    } else if (content.callMessage) {
      return this.handleCallMessage(envelope, content.callMessage);
    } else if (content.receiptMessage) {
      return this.handleReceiptMessage(envelope, content.receiptMessage);
    } else if (content.typingMessage) {
      return this.handleTypingMessage(envelope, content.typingMessage);
    }
    this.removeFromCache(envelope);

    this.reportException(
      {
        brief: 'Unsupported content message',
        message: errorMessage || 'Unsupported content message',
      },
      envelope
    );

    throw new Error('Unsupported content message');
  },
  handleCallMessage(envelope, callMessage) {
    window.log.info('call message from', this.getEnvelopeId(envelope));

    const newCallMessage = {};

    const { calling, joined, cancel, reject, hangup } = callMessage;

    if (calling) {
      let { roomId } = calling;
      const { roomId: envelopeRoomId, source } = envelope;

      if (roomId && envelopeRoomId && roomId !== envelopeRoomId) {
        this.removeFromCache(envelope);
        throw new Error('roomId error, roomId mismatch');
      } else {
        roomId = roomId || envelopeRoomId;
      }

      newCallMessage.calling = {
        ..._.pick(calling, [
          'roomName',
          'caller',
          'emk',
          'publicKey',
          'createCallMsg',
          'controlType',
          'callees',
          'timestamp',
        ]),
      };

      newCallMessage.calling.roomId = roomId;

      const { conversationId } = calling;
      if (conversationId) {
        const { groupId, number } = conversationId;
        const uniformId = window.Signal.ID.getUniformId({
          groupId: groupId?.toBinary(),
          number,
        });

        newCallMessage.calling.conversationId = uniformId.getIdForCompatible();
      }

      if (newCallMessage.calling.createCallMsg) {
        const ourNumber = textsecure.storage.user.getNumber();
        const isMe = source === ourNumber;
        const eventName = isMe ? 'sent' : 'message';

        const conversationId = newCallMessage.calling.conversationId;

        let saveMessageIds;
        const { controlType } = newCallMessage.calling;

        if (controlType === textsecure.CallActionType.InviteMembers) {
          saveMessageIds = isMe ? calling.callees : [source];
        } else if (controlType === textsecure.CallActionType.StartCall) {
          saveMessageIds = [
            conversationId.groupId || (isMe ? conversationId.number : source),
          ];
        }

        let type;
        let isPrivate;
        if (conversationId) {
          isPrivate = !!conversationId.number;
          type = isPrivate ? '1on1' : 'group';
        } else {
          isPrivate = true;
          type = 'instant';
        }

        for (const id of saveMessageIds) {
          const ev = new Event(eventName);
          ev.confirm = () => {};

          const message = {};

          const createCallMessageOptions = {
            timestamp: calling.timestamp?.toNumber(),
            action: controlType,
            callees: calling.callees,
            source,
            ourNumber,
            id,
            type,
          };

          // start group call
          const isGroup =
            saveMessageIds.length === 1 && id === conversationId?.groupId;
          if (isGroup) {
            message.group = {
              id: conversationId?.groupId,
              type: textsecure.protobuf.GroupContext.Type.DELIVER,
            };
          }

          if (eventName === 'sent') {
            const number = id;

            ev.data = {
              destination: message.group ? null : number,
              device: envelope.sourceDevice,
              message,
              sequenceId: envelope.sequenceId?.toNumber(),
              serverTimestamp: envelope.systemShowTimestamp?.toNumber(),
              notifySequenceId: envelope.notifySequenceId?.toNumber(),
              conversationPushedAt: envelope.conversationPushedAt,
              createCallMessageOptions,
            };
          } else {
            ev.data = {
              source: envelope.source,
              sourceDevice: envelope.sourceDevice,
              receivedAt: envelope.receivedAt,
              message,
              envelopeType: textsecure.protobuf.Envelope.Type.ENCRYPTEDTEXT,
              external: envelope.external,
              sequenceId: envelope.sequenceId?.toNumber(),
              serverTimestamp: envelope.systemShowTimestamp?.toNumber(),
              notifySequenceId: envelope.notifySequenceId?.toNumber(),
              messageType: textsecure.protobuf.Envelope.MsgType.MSG_NORMAL,
              conversationPushedAt: envelope.conversationPushedAt,
              createCallMessageOptions,
            };
          }

          ev.priority = envelope.priority;
          this.dispatchAndWait(ev);
        }
      }

      window.log.info(
        'receiving calling message',
        _.pick(calling, ['roomId', 'caller', 'conversationId'])
      );
    } else if (joined) {
      window.log.info('receiving joined message', joined.roomId);
      newCallMessage.joined = joined;
    } else if (cancel) {
      window.log.info('receiving cancel message', cancel.roomId);
      newCallMessage.cancel = cancel;
    } else if (reject) {
      window.log.info('receiving reject message', reject.roomId);
      newCallMessage.reject = reject;
    } else if (hangup) {
      window.log.info('receiving hangup message', hangup.roomId);
      newCallMessage.hangup = hangup;
    } else {
      window.log.error('unknown call message');
      return this.removeFromCache(envelope);
    }

    const ev = new Event('callMessage');
    ev.callMessage = newCallMessage;
    ev.source = envelope.source;
    ev.serverTimestamp = envelope.systemShowTimestamp.toNumber();
    ev.sourceDevice = envelope.sourceDevice;
    ev.confirm = this.removeFromCache.bind(this, envelope);
    return this.dispatchAndWait(ev);
  },
  handleReceiptMessage(envelope, receiptMessage) {
    const results = [];
    if (
      receiptMessage.type === textsecure.protobuf.ReceiptMessage.Type.DELIVERY
    ) {
      window.log.info('Unsupported handleReceiptMessage DELIVERY');
      // delivery receipt no longer supported
      return this.removeFromCache(envelope);
    } else if (
      receiptMessage.type === textsecure.protobuf.ReceiptMessage.Type.READ
    ) {
      const {
        timestamp: timestamps,
        readPosition,
        messageMode,
      } = receiptMessage;

      const ev = new Event('read');
      ev.confirm = this.removeFromCache.bind(this, envelope);
      ev.timestamp = envelope.timestamp.toNumber();
      ev.reads = timestamps.map(timestamp => ({
        timestamp: timestamp.toNumber(),
        reader: envelope.source,
        envelopedAt: ev.timestamp,
        sourceDevice: envelope.sourceDevice,
        messageMode: messageMode || textsecure.protobuf.Mode.NORMAL,
      }));

      // add read position if exists
      if (readPosition) {
        const reader = envelope.source;
        const groupId = readPosition.groupId?.toBinary();

        ev.readPosition = {
          reader,
          groupId,
          conversationId: groupId || reader,
          sourceDevice: envelope.sourceDevice,
          readAt: readPosition.readAt?.toNumber(),
          maxServerTimestamp: readPosition.maxServerTimestamp?.toNumber(),
          maxNotifySequenceId: readPosition.maxNotifySequenceId?.toNumber(),
        };
      }

      ev.priority = envelope.priority;

      results.push(this.dispatchAndWait(ev));
    }
    return Promise.all(results);
  },
  handleTypingMessage(envelope, typingMessage) {
    window.log.info('typing');

    // typing message is not supported yet.
    return this.removeFromCache(envelope);

    // const ev = new Event('typing');

    // this.removeFromCache(envelope);

    // if (envelope.timestamp && typingMessage.timestamp) {
    //   const envelopeTimestamp = envelope.timestamp.toNumber();
    //   const typingTimestamp = typingMessage.timestamp.toNumber();

    //   if (typingTimestamp !== envelopeTimestamp) {
    //     window.log.warn(
    //       `Typing message envelope timestamp (${envelopeTimestamp}) did not match typing timestamp (${typingTimestamp})`
    //     );
    //     return null;
    //   }
    // }

    // ev.sender = envelope.source;
    // ev.senderDevice = envelope.sourceDevice;
    // ev.typing = {
    //   typingMessage,
    //   timestamp: typingMessage.timestamp
    //     ? typingMessage.timestamp.toNumber()
    //     : Date.now(),
    //   groupId: typingMessage.groupId
    //     ? typingMessage.groupId.toString('binary')
    //     : null,
    //   started:
    //     typingMessage.action ===
    //     textsecure.protobuf.TypingMessage.Action.STARTED,
    //   stopped:
    //     typingMessage.action ===
    //     textsecure.protobuf.TypingMessage.Action.STOPPED,
    // };

    // return this.dispatchEvent(ev);
  },
  handleNullMessage(envelope) {
    window.log.info('null message from', this.getEnvelopeId(envelope));
    this.removeFromCache(envelope);
  },
  handleSyncMessage(envelope, syncMessage) {
    if (envelope.source !== this.number) {
      throw new Error('Received sync message from another number');
    }
    // eslint-disable-next-line eqeqeq
    // preview message and pulled message both has conversationId
    if (envelope.conversationId && envelope.sourceDevice == this.deviceId) {
      throw new Error('Received sync message from our own device');
    }
    if (syncMessage.sent) {
      const sentMessage = syncMessage.sent;
      const to = sentMessage.message.group
        ? `group(${sentMessage.message.group.id.toBinary()})`
        : sentMessage.destination;

      window.log.info(
        'sent message to',
        to,
        sentMessage.timestamp.toNumber(),
        'from',
        this.getEnvelopeId(envelope)
      );
      return this.handleSentMessage(envelope, sentMessage, sentMessage.message);
    } else if (syncMessage.contacts) {
      return this.handleContacts(envelope, syncMessage.contacts);
    } else if (syncMessage.groups) {
      return this.handleGroups(envelope, syncMessage.groups);
    } else if (syncMessage.blocked) {
      return this.handleBlocked(envelope, syncMessage.blocked);
    } else if (syncMessage.request) {
      window.log.info('Got SyncMessage Request');
      return this.removeFromCache(envelope);
    } else if (syncMessage.read && syncMessage.read.length) {
      window.log.info('read messages from', this.getEnvelopeId(envelope));
      return this.handleRead(envelope, syncMessage.read);
    } else if (syncMessage.verified) {
      return this.handleVerified(envelope, syncMessage.verified);
    } else if (syncMessage.configuration) {
      return this.handleConfiguration(envelope, syncMessage.configuration);
    } else if (syncMessage.tasks && syncMessage.tasks.length) {
      return this.handleTask(envelope, syncMessage.tasks);
    } else if (syncMessage.markAsUnread) {
      return this.handleMarkAsUnread(envelope, syncMessage.markAsUnread);
    } else if (syncMessage.conversationArchive) {
      return this.handleConversationArchive(
        envelope,
        syncMessage.conversationArchive
      );
    }
    throw new Error('Got empty SyncMessage');
  },
  handleConfiguration(envelope, configuration) {
    window.log.info('got configuration sync message');

    // mobile device no longer response the configuration sync request
    // we do not handle these messages either
    return this.removeFromCache(envelope);

    // const ev = new Event('configuration');
    // ev.confirm = this.removeFromCache.bind(this, envelope);
    // ev.configuration = configuration;
    // return this.dispatchAndWait(ev);
  },
  handleVerified(envelope, verified) {
    window.log.info('Unsupported syncing verified', verified);
    return this.removeFromCache(envelope);
  },
  handleRead(envelope, reads) {
    const results = [];

    const ev = new Event('readSync');
    ev.confirm = this.removeFromCache.bind(this, envelope);
    ev.timestamp = envelope.timestamp.toNumber();
    ev.reads = reads.map(read => {
      const { sender, timestamp, readPosition, messageMode } = read;

      const syncedRead = {
        timestamp: timestamp.toNumber(),
        sender,
        envelopedAt: ev.timestamp,
        sourceDevice: envelope.sourceDevice,
        messageMode: messageMode || textsecure.protobuf.Mode.NORMAL,
      };

      if (readPosition) {
        const groupId = readPosition.groupId?.toBinary();

        syncedRead.readPosition = {
          sender,
          sentAt: syncedRead.timestamp,
          groupId,
          conversationId: groupId || sender,
          sourceDevice: envelope.sourceDevice,
          readAt: readPosition.readAt?.toNumber(),
          maxServerTimestamp: readPosition.maxServerTimestamp?.toNumber(),
          maxNotifySequenceId: readPosition.maxNotifySequenceId?.toNumber(),
        };
      }

      return syncedRead;
    });

    ev.priority = envelope.priority;

    results.push(this.dispatchAndWait(ev));

    return Promise.all(results);
  },
  handleContacts(envelope, contacts) {
    window.log.info('Unsupported syncing contacts', contacts);

    // mobile device no longer response the contact sync request
    // we do not handle these messages either
    return this.removeFromCache(envelope);
  },
  handleGroups(envelope, groups) {
    window.log.info('Unsupported syncing groups', groups);

    // mobile device no longer response the group sync request
    // we do not handle these messages either
    return this.removeFromCache(envelope);
  },
  handleBlocked(envelope, blocked) {
    window.log.info('Unsupported blocked:', blocked);
    return this.removeFromCache(envelope);
  },
  handleTask(envelope, tasks) {
    window.log.info('Unsupported tasks,', tasks);
    return this.removeFromCache(envelope);
  },
  handleConversationArchive(envelope, conversationArchive) {
    window.log.info('handling for archive conversation,', conversationArchive);

    const { conversationId, flag } = conversationArchive;
    const ev = new Event('onArchive');
    ev.confirm = this.removeFromCache.bind(this, envelope);
    ev.timestamp = envelope.timestamp.toNumber();
    ev.conversationArchive = {
      timestamp: ev.timestamp,
      flag,
    };
    const groupId = conversationId?.groupId?.toBinary();
    if (groupId) {
      ev.conversationArchive.conversationId = groupId;
    } else {
      ev.conversationArchive.conversationId = conversationId?.number;
    }

    return this.dispatchAndWait(ev);
  },
  handleMarkAsUnread(envelope, markAsUnread) {
    window.log.info('handling for mark as unread,', markAsUnread);

    const { conversationId, flag } = markAsUnread;
    const ev = new Event('markAsUnread');
    ev.confirm = this.removeFromCache.bind(this, envelope);
    ev.timestamp = envelope.timestamp.toNumber();
    ev.markAsUnread = {
      timestamp: ev.timestamp,
      flag,
    };

    const groupId = conversationId?.groupId?.toBinary();
    if (groupId) {
      ev.markAsUnread.conversationId = groupId;
    } else {
      ev.markAsUnread.conversationId = conversationId?.number;
    }

    return this.dispatchAndWait(ev);
  },
  cleanAttachment(attachment) {
    const key = attachment.key ? attachment.key.toString('base64') : null;
    return {
      ..._.omit(attachment, 'thumbnail'),
      id: attachment.id.toString(),
      key,
      rapidKey: key,
      rapidSize: attachment.size,
      digest: attachment.digest ? attachment.digest.toString('base64') : null,
    };
  },
  async downloadAttachment(attachment) {
    const { key, digest, size } = attachment;

    const digestAB = window.Signal.Crypto.base64ToArrayBuffer(digest);
    const keyAB = window.Signal.Crypto.base64ToArrayBuffer(key);

    let rapidHash;
    let encryptedBin;

    const digestLength = digestAB.byteLength;
    if (digestLength === 16) {
      const hash = await crypto.subtle.digest({ name: 'SHA-256' }, keyAB);
      rapidHash = dcodeIO.ByteBuffer.wrap(hash).toString('base64');
      const downloaded = await this.server.getAttachmentNew(
        rapidHash,
        attachment.id,
        attachment.gid
      );

      encryptedBin = downloaded.encryptedBin;
    } else if (digestLength === 32) {
      encryptedBin = await this.server.getAttachment(attachment.id);
    } else {
      throw new Error('unknown digest length.');
    }

    let data;
    try {
      data = await textsecure.crypto.decryptAttachment(
        encryptedBin,
        keyAB,
        digestAB
      );

      if (!size || size !== data.byteLength) {
        throw new Error(
          `downloadAttachment: Size ${size} did not match downloaded attachment size ${data.byteLength}`
        );
      }
    } catch (error) {
      // file verfied failed, report.
      try {
        await this.server.reportFileBroken(rapidHash, attachment.id);
      } catch (err) {
        log.error('report file broken failed.', err);
      }

      throw error;
    }

    return {
      ..._.omit(attachment, 'key'),
      data,
    };
  },
  handleAttachment(attachment) {
    const cleaned = this.cleanAttachment(attachment);
    return this.downloadAttachment(cleaned);
  },
  async handleEndSession(number) {
    window.log.info('got end session', number);
  },
  cleanForwards(forwards, depth, maxDepth) {
    if (!forwards || forwards.length < 1) {
      return;
    }

    depth = depth || 1;
    maxDepth = maxDepth || textsecure.MAX_FORWARD_DEPTH;
    if (depth > maxDepth || depth < 1) {
      return;
    }
    depth++;

    return forwards.map(forward => {
      const { body, forwards, attachments } = forward;

      const type =
        forward.type || textsecure.protobuf.DataMessage.Forward.Type.NORMAL;

      let displayBody;
      switch (type) {
        case textsecure.protobuf.DataMessage.Forward.Type.NORMAL:
          displayBody = body || '';
          break;
        case textsecure.protobuf.DataMessage.Forward.Type.EOF:
          displayBody = i18n('messageCannotBeDisplayedTip');
          break;
        default:
          this.hasUnsupportedForward = true;
          displayBody = i18n('unsupportedMessageTip');
      }

      return {
        ...forward,
        uuid: window.getGuid(),
        body: displayBody,
        attachments: (attachments || []).map(this.cleanAttachment.bind(this)),
        forwards: this.cleanForwards(forwards || [], depth, maxDepth),
      };
    });
  },
  cleanRealSource(realSource) {
    const { timestamp, serverTimestamp, sequenceId, notifySequenceId } =
      realSource || {};

    if (timestamp) {
      realSource.timestamp = timestamp.toNumber();
    }

    if (serverTimestamp) {
      realSource.serverTimestamp = serverTimestamp.toNumber();
    }

    if (sequenceId) {
      realSource.sequenceId = sequenceId.toNumber();
    }

    if (notifySequenceId) {
      realSource.notifySequenceId = notifySequenceId.toNumber();
    }

    return realSource;
  },
  processDecrypted(envelope, decrypted) {
    /* eslint-disable no-bitwise, no-param-reassign */
    const FLAGS = textsecure.protobuf.DataMessage.Flags;

    // Now that its decrypted, validate the message and clean it up for consumer
    //   processing
    // Note that messages may (generally) only perform one action and we ignore remaining
    //   fields after the first action.

    let unexpected = true;

    if (decrypted.flags == null) {
      decrypted.flags = 0;
    }
    if (decrypted.expireTimer == null) {
      decrypted.expireTimer = 0;
    }

    if (decrypted.flags & FLAGS.END_SESSION) {
      unexpected = false;
      decrypted.body = null;
      decrypted.attachments = [];
      decrypted.group = null;
      return Promise.resolve(decrypted);
    } else if (decrypted.flags & FLAGS.EXPIRATION_TIMER_UPDATE) {
      decrypted.body = null;
      decrypted.attachments = [];
    } else if (decrypted.flags & FLAGS.PROFILE_KEY_UPDATE) {
      decrypted.body = null;
      decrypted.attachments = [];
    } else if (decrypted.flags !== 0) {
      throw new Error('Unknown flags in message');
    }

    if (decrypted.group !== null) {
      decrypted.group.id = decrypted.group.id.toBinary();

      switch (decrypted.group.type) {
        // case textsecure.protobuf.GroupContext.Type.UPDATE:
        //   decrypted.body = null;
        //   decrypted.attachments = [];
        //   break;
        // case textsecure.protobuf.GroupContext.Type.QUIT:
        //   decrypted.body = null;
        //   decrypted.attachments = [];
        //   break;
        case textsecure.protobuf.GroupContext.Type.DELIVER:
          decrypted.group.name = null;
          decrypted.group.members = [];
          decrypted.group.avatar = null;
          break;
        // case textsecure.protobuf.GroupContext.Type.REQUEST_INFO:
        //   window.log.info('group message type REQUEST_INFO is not implemented.');
        default:
          this.removeFromCache(envelope);
          throw new Error(
            'Unknown or deprecated group message type:' + decrypted.group.type
          );
      }
    }

    const attachmentCount = (decrypted.attachments || []).length;
    const ATTACHMENT_MAX = 32;
    if (attachmentCount > ATTACHMENT_MAX) {
      throw new Error(
        `Too many attachments: ${attachmentCount} included in one message, max is ${ATTACHMENT_MAX}`
      );
    }

    // Here we go from binary to string/base64 in all AttachmentPointer digest/key fields

    if (
      decrypted.group &&
      decrypted.group.type === textsecure.protobuf.GroupContext.Type.UPDATE
    ) {
      if (decrypted.group.avatar !== null) {
        decrypted.group.avatar = this.cleanAttachment(decrypted.group.avatar);
      }
    }

    if ((decrypted.attachments || []).length > 0) {
      unexpected = false;
      decrypted.attachments = decrypted.attachments.map(
        this.cleanAttachment.bind(this)
      );
    }

    if ((decrypted.contacts || []).length > 0) {
      unexpected = false;
      decrypted.contacts = decrypted.contacts.map(item => {
        let number;
        if (item.number instanceof Array && item.number.length) {
          number = item.number[0].value;
        }
        let name;
        if (item.name) {
          name = item.name.displayName || number;
        }
        return {
          number,
          name,
        };
      });
    }

    if (decrypted.quote) {
      unexpected = false;

      if (decrypted.quote.id) {
        decrypted.quote.id = decrypted.quote.id.toNumber();
      }

      decrypted.quote.attachments = (decrypted.quote.attachments || []).map(
        item => {
          const { thumbnail } = item;

          if (!thumbnail) {
            return item;
          }

          return {
            ...item,
            thumbnail: this.cleanAttachment(item.thumbnail),
          };
        }
      );
    }

    if (decrypted.recall?.realSource) {
      const { realSource } = decrypted.recall;
      if (realSource.source !== envelope.source) {
        this.removeFromCache(envelope);
        window.log.warn(
          'Recall ignored: source does not match the original message:',
          realSource,
          envelope.source
        );
        throw new Error('Unexpected recall messsage from non-owner');
      }

      unexpected = false;

      this.cleanRealSource(decrypted.recall.realSource);
    }

    if (decrypted.task) {
      unexpected = false;
      const { timestamp, dueTime } = decrypted.task;
      decrypted.task.timestamp = timestamp.toNumber();
      if (dueTime) {
        decrypted.task.dueTime = dueTime.toNumber();
      }
    }

    if (decrypted.vote) {
      unexpected = false;
      const { dueTime } = decrypted.vote;
      if (dueTime) {
        decrypted.vote.dueTime = dueTime.toNumber();
      }
    }

    if (decrypted.card) {
      const { timestamp } = decrypted.card;
      if (timestamp) {
        decrypted.card.timestamp = timestamp.toNumber();
      }

      // set body with card content to support search
      decrypted.body = decrypted.card.content;
    }

    if (decrypted.botContext && decrypted.botContext.source) {
      unexpected = false;

      this.cleanRealSource(decrypted.botContext.source);

      const groupId = decrypted.botContext.groupId;
      if (groupId) {
        decrypted.botContext.groupId = groupId.toBinary();
      }
    }

    if (decrypted.threadContext && decrypted.threadContext.source) {
      unexpected = false;

      this.cleanRealSource(decrypted.threadContext.source);

      const groupId = decrypted.threadContext.groupId;
      if (groupId) {
        decrypted.threadContext.groupId = groupId.toBinary();
      }
    }

    if (decrypted.topicContext) {
      unexpected = false;

      const { source, groupId } = decrypted.topicContext;

      this.cleanRealSource(source);

      if (groupId) {
        decrypted.topicContext.groupId = groupId.toBinary();
      }
    }

    if (decrypted.reaction && decrypted.reaction.source) {
      unexpected = false;

      this.cleanRealSource(decrypted.reaction.source);
    }

    // forward should be checked at the last
    const { forwards } = decrypted.forwardContext || {};
    if (forwards && forwards.length > 0) {
      // forward message may has body, but unsupported.
      this.hasUnsupportedForward = false;
      decrypted.forwardContext.forwards = this.cleanForwards(forwards || []);
      unexpected = this.hasUnsupportedForward;
    }

    if (decrypted.screenshot) {
      unexpected = false;

      this.cleanRealSource(decrypted.screenshot.source);
    }

    const promises = [];

    const requiredProtocolVersion = decrypted.requiredProtocolVersion;
    if (typeof requiredProtocolVersion === 'number') {
      const data = envelope.dataCache;
      if (data?.requiredProtocolVersion !== requiredProtocolVersion) {
        this.updateCacheOfOptions(envelope.id, data, {
          requiredProtocolVersion,
        });
      }

      const current = textsecure.protobuf.DataMessage.ProtocolVersion.CURRENT;
      if (current >= requiredProtocolVersion) {
        unexpected = false;
      } else {
        unexpected = true;
      }
    } else if (
      requiredProtocolVersion === null ||
      requiredProtocolVersion === undefined
    ) {
      // body has value is not always expected
      // some message may has body for backforward compatibility purpose
      // and old messages have no requiredProtocolVersion
      if (typeof decrypted.body === 'string' && decrypted.body.length > 0) {
        unexpected = false;
      }
    } else {
      // window.log.error('unexpected requiredProtocolVersion,', requiredProtocolVersion);
    }

    decrypted.unexpected = unexpected;

    return Promise.all(promises).then(() => decrypted);
    /* eslint-enable no-bitwise, no-param-reassign */
  },
  async reportException(description, envelope) {
    try {
      const reportData = { description };

      if (envelope) {
        const picked = _.pick(envelope, [
          'id',
          'type',
          'source',
          'sourceDevice',
          'relay',
          'serverGuid',
          'serverTimestamp',
          'external',
        ]);

        let timestamp;

        if (typeof envelope.timestamp?.toNumber === 'function') {
          timestamp = envelope.timestamp.toNumber();
        } else {
          timestamp = envelope.timestamp;
        }

        reportData.envelope = {
          ...picked,
          timestamp,
          contentLength: envelope.content?.buffer?.length,
        };

        const { dataCache } = envelope;
        if (dataCache) {
          reportData.envelope.cache = _.pick(dataCache, [
            'timestamp',
            'attempts',
          ]);
        }
      }

      window.log.info('report exception:', reportData);

      await this.server.reportException(reportData);
    } catch (error) {
      window.log.info(
        'report failed:',
        error && error.stack ? error.stack : error
      );
    }
  },
  async handleExternalEnvelope(envelopeBase64Text, external) {
    await this.cacheAndQueueExternal(envelopeBase64Text, external);
  },
});

window.textsecure = window.textsecure || {};

textsecure.MessageReceiver = function MessageReceiverWrapper(
  username,
  password,
  signalingKey,
  options
) {
  const messageReceiver = new MessageReceiver(
    username,
    password,
    signalingKey,
    options
  );
  this.addEventListener =
    messageReceiver.addEventListener.bind(messageReceiver);
  this.removeEventListener =
    messageReceiver.removeEventListener.bind(messageReceiver);
  this.getStatus = messageReceiver.getStatus.bind(messageReceiver);
  this.close = messageReceiver.close.bind(messageReceiver);
  this.checkStatus = messageReceiver.checkStatus.bind(messageReceiver);

  this.downloadAttachment =
    messageReceiver.downloadAttachment.bind(messageReceiver);
  this.stopProcessing = messageReceiver.stopProcessing.bind(messageReceiver);
  this.handleExternalEnvelope =
    messageReceiver.handleExternalEnvelope.bind(messageReceiver);
  this.unregisterBatchers =
    messageReceiver.unregisterBatchers.bind(messageReceiver);
  this.waitForBatchers = messageReceiver.waitForBatchers.bind(messageReceiver);

  messageReceiver.connect();
};

textsecure.MessageReceiver.prototype = {
  constructor: textsecure.MessageReceiver,
};

textsecure.MessageReceiver.stringToArrayBuffer =
  MessageReceiver.stringToArrayBuffer;
textsecure.MessageReceiver.arrayBufferToString =
  MessageReceiver.arrayBufferToString;
textsecure.MessageReceiver.stringToArrayBufferBase64 =
  MessageReceiver.stringToArrayBufferBase64;
textsecure.MessageReceiver.arrayBufferToStringBase64 =
  MessageReceiver.arrayBufferToStringBase64;
