/* global _, textsecure, WebAPI, libsignal, OutgoingMessage, window */

/* eslint-disable more/no-then, no-bitwise */

function stringToArrayBuffer(str) {
  if (typeof str !== 'string') {
    throw new Error('Passed non-string to stringToArrayBuffer');
  }
  const res = new ArrayBuffer(str.length);
  const uint = new Uint8Array(res);
  for (let i = 0; i < str.length; i += 1) {
    uint[i] = str.charCodeAt(i);
  }
  return res;
}

function Message(options) {
  this.body = options.body;
  this.mentions = options.mentions;
  this.atPersons = options.atPersons;
  this.attachments = options.attachments || [];
  this.quote = options.quote;
  this.group = options.group;
  this.flags = options.flags;
  this.recipients = options.recipients;
  this.timestamp = options.timestamp;
  this.needsSync = options.needsSync;
  this.expireTimer = options.expireTimer;
  this.profileKey = options.profileKey;
  this.forwardContext = options.forwardContext;
  this.contacts = options.contacts;
  this.recall = options.recall;
  this.task = options.task;
  this.vote = options.vote;
  this.card = options.card;
  this.threadContext = options.threadContext;
  this.reaction = options.reaction;
  this.messageMode = options.messageMode;

  if (!(this.recipients instanceof Array)) {
    throw new Error('Invalid recipient list');
  }

  if (!this.group && this.recipients.length !== 1) {
    throw new Error('Invalid recipient list for non-group');
  }

  if (typeof this.timestamp !== 'number') {
    throw new Error('Invalid timestamp');
  }

  if (this.expireTimer !== undefined && this.expireTimer !== null) {
    if (typeof this.expireTimer !== 'number' || !(this.expireTimer >= 0)) {
      throw new Error('Invalid expireTimer');
    }
  }

  if (this.attachments) {
    if (!(this.attachments instanceof Array)) {
      throw new Error('Invalid message attachments');
    }
  }

  if (this.flags !== undefined && this.flags !== null) {
    if (typeof this.flags !== 'number') {
      throw new Error('Invalid message flags');
    }
  }

  if (this.forwardContext) {
    const { forwards, rapidFiles } = this.forwardContext;
    if (forwards && !(forwards instanceof Array)) {
      throw new Error('Invalid message forwardContext.forward.forwards');
    }

    if (rapidFiles && !(rapidFiles instanceof Array)) {
      throw new Error('Invalid message forwardContext.rapidFiles');
    }
  }

  if (this.contacts) {
    if (!(this.contacts instanceof Array)) {
      throw new Error('Invalid message contacts');
    }
  }

  if (this.recall && this.recall.realSource) {
    const { source, timestamp, serverTimestamp } = this.recall.realSource;
    if (typeof timestamp != 'number') {
      throw new Error('Invalid recall timestamp');
    }

    if (serverTimestamp && typeof serverTimestamp !== 'number') {
      throw new Error('Invalid recall serverTimestamp');
    }

    if (source != textsecure.storage.user.getNumber()) {
      throw new Error('only can recall messages from ourselves.');
    }
  }

  if (this.task) {
    const { taskId, name } = this.task;
    if (!taskId || !name) {
      throw new Error('Invalid task id or name');
    }
  }

  if (this.vote) {
    const { voteId, name } = this.vote;
    if (!voteId || !name) {
      throw new Error('Invalid vote id or name');
    }
  }

  if (this.card) {
    const { content } = this.card;
    if (!content) {
      throw new Error('Invalid card content');
    }
  }

  if (this.threadContext) {
    if (this.threadContext.source) {
      const { source } = this.threadContext.source;
      if (!source || typeof source !== 'string') {
        throw new Error('Invalid topic/thread context source source');
      }
    } else {
      throw new Error('Invalid topic/thread context source');
    }
    // for threadContext,
    // topicCompatible or threadCompatible should be true at least one.
    const { threadCompatible, topicCompatible } = this.threadContext;
    if (topicCompatible) {
      const { type, supportType, topicId } = this.threadContext;
      if (typeof type !== 'number') {
        throw new Error('Invalid topic context type');
      }

      if (typeof supportType !== 'number') {
        throw new Error('Invalid topic context supportType');
      }

      if (typeof topicId !== 'string') {
        throw new Error('Invalid topic context topicId');
      }
    } else {
      if (!threadCompatible) {
        // neither thread nor topic compatbile
        throw new Error('Invalid neither topic nor thread context compatible');
      } else {
        // only compatible for thread
      }
    }
  }

  if (this.reaction) {
    const { source, sourceDevice, timestamp } = this.reaction.source || {};
    if (!source || typeof source !== 'string') {
      throw new Error('Invalid reaction source source');
    }

    if (typeof timestamp != 'number') {
      throw new Error('Invalid reaction source timestamp');
    }

    if (typeof sourceDevice != 'number') {
      throw new Error('Invalid reaction source sourceDevice');
    }

    if (typeof this.reaction.emoji !== 'string') {
      throw new Error('Invalid reaction emoji');
    }
  }

  if (this.isEndSession()) {
    if (
      this.body !== null ||
      this.group !== null ||
      this.attachments.length !== 0
    ) {
      throw new Error('Invalid end session message');
    }
  } else {
    if (
      typeof this.timestamp !== 'number' ||
      (this.body && typeof this.body !== 'string')
    ) {
      throw new Error('Invalid message body');
    }
    if (this.group) {
      if (
        typeof this.group.id !== 'string' ||
        typeof this.group.type !== 'number'
      ) {
        throw new Error('Invalid group context');
      }
    }
  }
}

Message.prototype = {
  constructor: Message,
  isEndSession() {
    return this.flags & textsecure.protobuf.DataMessage.Flags.END_SESSION;
  },
  toProto() {
    if (this.dataMessage instanceof textsecure.protobuf.DataMessage) {
      return this.dataMessage;
    }
    const proto = new textsecure.protobuf.DataMessage();

    const updateRequiredProtocalVersion = requiredVersion => {
      if (
        !proto.requiredProtocolVersion ||
        proto.requiredProtocolVersion < requiredVersion
      ) {
        proto.requiredProtocolVersion = requiredVersion;
      }
    };

    const assignRealSource = sourceObject => {
      const realSource = new textsecure.protobuf.DataMessage.RealSource();

      const {
        source,
        sourceDevice,
        timestamp,
        serverTimestamp,
        sequenceId,
        notifySequenceId,
      } = sourceObject;

      // source should be always exists
      realSource.source = source;

      if (sourceDevice) {
        realSource.sourceDevice = sourceDevice;
      }

      if (timestamp) {
        realSource.timestamp = timestamp;
      }

      if (serverTimestamp) {
        realSource.serverTimestamp = serverTimestamp;
      }

      if (sequenceId) {
        realSource.sequenceId = sequenceId;
      }

      if (notifySequenceId) {
        realSource.notifySequenceId = notifySequenceId;
      }

      return realSource;
    };

    // 此字段未知原因，之前一直没有赋值，今天就修复这个问题
    if (this.timestamp) {
      proto.timestamp = this.timestamp;
    }

    if (this.body) {
      proto.body = this.body;
    }

    if (this.atPersons && this.atPersons.length > 0) {
      proto.atPersons = this.atPersons;
    }

    let rapidFiles = [];

    if (this.attachmentPointers && this.attachmentPointers.length > 0) {
      proto.attachments = this.attachmentPointers;
      rapidFiles = this.attachments.map(attachment =>
        _.pick(attachment, [
          'authorizeId',
          'digest',
          'rapidKey',
          'rapidHash',
          'rapidSize',
          'path',
        ])
      );
    }

    if (this.flags) {
      proto.flags = this.flags;
    }

    if (this.group) {
      proto.group = new textsecure.protobuf.GroupContext();
      proto.group.id = stringToArrayBuffer(this.group.id);
      proto.group.type = this.group.type;
    }

    if (this.quote) {
      const { QuotedAttachment } = textsecure.protobuf.DataMessage.Quote;
      const { Quote } = textsecure.protobuf.DataMessage;

      proto.quote = new Quote();
      const { quote } = proto;

      quote.id = this.quote.id;
      quote.author = this.quote.author;
      quote.text = this.quote.text;
      quote.attachments = (this.quote.attachments || []).map(attachment => {
        const quotedAttachment = new QuotedAttachment();

        quotedAttachment.contentType = attachment.contentType;
        quotedAttachment.fileName = attachment.fileName;
        if (attachment.attachmentPointer) {
          quotedAttachment.thumbnail = attachment.attachmentPointer;
        }

        return quotedAttachment;
      });
    }

    if (this.expireTimer) {
      proto.expireTimer = this.expireTimer;
    }

    if (this.profileKey) {
      proto.profileKey = this.profileKey;
    }

    if (this.forwardContext) {
      const { Forward, ForwardContext } = textsecure.protobuf.DataMessage;

      const assignForwards = (forwards, depth, maxDepth) => {
        if (!forwards || forwards.length < 1) {
          return null;
        }

        depth = depth || 1;
        maxDepth = maxDepth || textsecure.MAX_FORWARD_DEPTH;
        if (depth > maxDepth || depth < 1) {
          return null;
        }

        return forwards.map(forward => {
          let newForward = new Forward();

          if (forward.id) {
            newForward.id = forward.id;
          }

          if (forward.type) {
            newForward.type = forward.type;
          }

          if (forward.author) {
            newForward.author = forward.author;
          }

          if (forward.body) {
            newForward.body = forward.body;
          }

          if (forward.card) {
            newForward.card = forward.card;
          }

          if (forward.isFromGroup) {
            newForward.isFromGroup = forward.isFromGroup;
          }

          const { attachmentPointers } = forward;
          if (attachmentPointers && attachmentPointers.length > 0) {
            newForward.attachments = attachmentPointers;
            rapidFiles = rapidFiles.concat(
              forward.attachments.map(attachment =>
                _.pick(attachment, [
                  'authorizeId',
                  'digest',
                  'rapidKey',
                  'rapidHash',
                  'rapidSize',
                  'path',
                ])
              )
            );
          }

          const { mentions } = forward;
          if (mentions && mentions.length > 0) {
            newForward.mentions = mentions;
          }

          const nextForwards = assignForwards(
            forward.forwards,
            depth,
            maxDepth
          );
          if (nextForwards && nextForwards.length > 0) {
            newForward.forwards = nextForwards;
          }

          return newForward;
        });
      };

      proto.forwardContext = new ForwardContext();

      updateRequiredProtocalVersion(
        textsecure.protobuf.DataMessage.ProtocolVersion.FORWARD
      );

      const { forwards } = this.forwardContext;
      if (forwards && forwards.length > 0) {
        proto.forwardContext.forwards = assignForwards(forwards);
      }

      if (rapidFiles && rapidFiles.length > 0) {
        const RapidFile = textsecure.protobuf.RapidFile;
        proto.forwardContext.rapidFiles = rapidFiles.map(rapidFile => {
          let newRapidFile = new RapidFile();
          if (rapidFile.rapidHash) {
            newRapidFile.rapidHash = rapidFile.rapidHash;
          }

          if (rapidFile.authorizeId) {
            newRapidFile.authorizeId = rapidFile.authorizeId;
          }

          return newRapidFile;
        });
      }
    }

    if (this.contacts && this.contacts.length > 0) {
      const { Contact } = textsecure.protobuf.DataMessage;
      const { Name, Phone } = Contact;

      proto.contacts = this.contacts.map(contact => {
        const { name, number } = contact;

        let protoContact = new Contact();
        if (name) {
          protoContact.name = new Name({ displayName: name });
        }

        if (number) {
          protoContact.number = new Phone({ value: number, type: 3 });
        }

        return protoContact;
      });

      updateRequiredProtocalVersion(
        textsecure.protobuf.DataMessage.ProtocolVersion.CONTACT
      );
    }

    if (this.recall && this.recall.realSource) {
      const recall = new textsecure.protobuf.DataMessage.Recall();

      recall.realSource = assignRealSource(this.recall.realSource);
      proto.recall = recall;

      updateRequiredProtocalVersion(
        textsecure.protobuf.DataMessage.ProtocolVersion.RECALL
      );
    }

    if (this.task) {
      const { Task } = textsecure.protobuf.DataMessage;
      const task = new Task();
      task.taskId = this.task.taskId || null;
      task.version = this.task.version || null;
      task.creator = this.task.creator || null;
      task.timestamp = this.task.timestamp || null;
      task.name = this.task.name || null;
      task.notes = this.task.notes || null;
      task.assignees = this.task.assignees || null;
      task.dueTime = this.task.dueTime || null;
      task.priority = this.task.priority || null;
      task.followers = this.task.followers || null;
      task.status = this.task.status || null;

      proto.task = task;
      updateRequiredProtocalVersion(
        textsecure.protobuf.DataMessage.ProtocolVersion.TASK
      );
    }

    if (this.vote) {
      const { Vote } = textsecure.protobuf.DataMessage;
      const vote = new Vote();
      vote.voteId = this.vote.voteId || null;
      vote.version = this.vote.version || null;
      vote.creator = this.vote.creator || null;
      vote.name = this.vote.name || null;
      vote.multiple = !!this.vote.multiple;
      vote.dueTime = this.vote.dueTime || null;
      vote.status = this.vote.status || null;
      vote.options = this.vote.options || null;
      vote.anonymous = this.vote.anonymous === 2 ? 2 : 1;

      proto.vote = vote;
      updateRequiredProtocalVersion(
        textsecure.protobuf.DataMessage.ProtocolVersion.VOTE
      );
    }

    if (this.card) {
      const { Card } = textsecure.protobuf.DataMessage;
      const card = new Card();
      card.appId = this.card.appId || null;
      card.cardId = this.card.cardId || null;
      card.version = this.card.version || null;
      card.creator = this.card.creator || null;
      card.timestamp = this.card.timestamp || null;
      card.content = this.card.content || null;
      card.contentType = this.card.contentType || null;
      card.type = this.card.type || null;
      proto.card = card;
      updateRequiredProtocalVersion(
        textsecure.protobuf.DataMessage.ProtocolVersion.CARD
      );
    }

    if (this.mentions && Array.isArray(this.mentions) && this.mentions.length) {
      const { Mention } = textsecure.protobuf.DataMessage;
      proto.mentions = this.mentions.map(mention => {
        const { start, length, uid, type } = mention;
        const protoMention = new Mention();
        protoMention.start = start;
        protoMention.length = length;
        protoMention.uid = uid;
        protoMention.type = type;
        return protoMention;
      });
    }

    if (this.threadContext) {
      const {
        source,
        botId,
        replyToUser,
        groupId,
        // compatible,
        topicCompatible,
        threadCompatible,
        type,
        topicId,
        supportType,
        sourceBrief,
        // sendAll,
        sourceDisplayName,
        groupName,
      } = this.threadContext;

      const context = {};

      context.source = assignRealSource(source);
      context.botId = botId;
      context.replyToUser = !!replyToUser;

      if (typeof groupId === 'string' && groupId) {
        context.groupId = stringToArrayBuffer(groupId);
      }

      // if compatible is set for this.threadContext
      // should send proto ThreadContext for compatible
      //compatible && !sendAll
      // compatible for old thread
      if (threadCompatible) {
        const { ThreadContext } = textsecure.protobuf.DataMessage;
        proto.threadContext = new ThreadContext(context);
      }
      // compatible for new topic
      if (topicCompatible) {
        context.type = type;
        context.topicId = topicId;
        context.supportType = supportType;
        context.sourceBrief = sourceBrief || null;
        context.sourceDisplayName = sourceDisplayName || null;
        context.groupName = groupName || null;
        const { TopicContext } = textsecure.protobuf.DataMessage;
        proto.topicContext = new TopicContext(context);
      }
    }

    if (this.reaction && this.reaction.source) {
      const reaction = new textsecure.protobuf.DataMessage.Reaction();

      reaction.source = assignRealSource(this.reaction.source);
      reaction.emoji = this.reaction.emoji;
      reaction.remove = !!this.reaction.remove;

      proto.reaction = reaction;

      updateRequiredProtocalVersion(
        textsecure.protobuf.DataMessage.ProtocolVersion.REACTION
      );
    }

    proto.messageMode = this.messageMode || textsecure.protobuf.Mode.NORMAL;

    this.rapidFiles = rapidFiles;
    this.dataMessage = proto;

    return proto;
  },
  toArrayBuffer() {
    return this.toProto().toArrayBuffer();
  },
};

function MessageSender(username, password) {
  this.server = WebAPI.connect({ username, password });
  this.pendingMessages = {};
}

MessageSender.prototype = {
  constructor: MessageSender,

  //  makeAttachmentPointer :: Attachment -> Promise AttachmentPointerProto
  makeAttachmentPointer(attachment, numbers) {
    if (typeof attachment !== 'object' || attachment == null) {
      return Promise.resolve(undefined);
    }

    const { data, rapidKey, rapidSize } = attachment;
    if (rapidKey && rapidSize) {
      // maybe rapid upload
    } else if (!(data instanceof ArrayBuffer) && !ArrayBuffer.isView(data)) {
      return Promise.reject(
        new TypeError(
          `\`attachment.data\` must be an \`ArrayBuffer\` or \`ArrayBufferView\`; got: ${typeof data}`
        )
      );
    }

    let timestamp;
    let promise;
    if (rapidKey && rapidSize) {
      promise = Promise.resolve(
        dcodeIO.ByteBuffer.wrap(rapidKey, 'base64').toArrayBuffer()
      );
    } else {
      timestamp = Date.now();
      promise = crypto.subtle.digest({ name: 'SHA-512' }, data);
    }

    const fillProtoIfRapid = (result, proto) => {
      const { exists, cipherHash, attachmentId, authorizeId } = result;
      if (exists && cipherHash && attachmentId && authorizeId) {
        log.info('rapid upload success, ', attachmentId, cipherHash);

        proto.id = authorizeId;
        proto.digest = dcodeIO.ByteBuffer.wrap(
          cipherHash,
          'hex'
        ).toArrayBuffer();
        return true;
      }
    };

    return promise.then(async dataDigest => {
      if (timestamp) {
        log.info('calculate data digest delta:', Date.now() - timestamp);
      }

      const proto = new textsecure.protobuf.AttachmentPointer();
      proto.key = dataDigest;

      const twiceHash = await crypto.subtle.digest(
        { name: 'SHA-256' },
        dataDigest
      );
      const rapidHash = dcodeIO.ByteBuffer.wrap(twiceHash).toString('base64');

      const ourNumber = textsecure.storage.user.getNumber();
      numbers = Array.from(new Set([...numbers, ourNumber]));

      const rapidResult = await this.server.rapidUpload(rapidHash, numbers);

      if (!fillProtoIfRapid(rapidResult, proto)) {
        const { attachmentId, url: ossUrl, urls: ossUrls } = rapidResult;
        if (
          !attachmentId ||
          (!ossUrl && !(Array.isArray(ossUrls) && ossUrls.length > 0))
        ) {
          // upload failed.
          log.error('rapid upload error for response is invalid.');
          throw new Error('rapid upload server response invalid result.');
        }

        if (!(data instanceof ArrayBuffer) && !ArrayBuffer.isView(data)) {
          log.error('can not rapid upload and no valid attachment data');
          throw new Error('can not rapid upload without valid attachment data');
        }

        // verify local saved file when rapid upload failed.
        if (rapidKey && rapidSize) {
          log.warn(
            'forward attachments, but rapid upload failed, try to upload it.'
          );

          const dataHash = await crypto.subtle.digest(
            { name: 'SHA-512' },
            data
          );
          const dataHashB64 =
            dcodeIO.ByteBuffer.wrap(dataHash).toString('base64');

          if (rapidKey != dataHashB64 || data.byteLength != rapidSize) {
            log.error('local saved file changed before forwarding.');
            throw new Error('file changed before forwarding');
          }
        }

        // encrypt
        const encryptData = await textsecure.crypto.encryptAttachment(
          attachment.data,
          proto.key,
          libsignal.crypto.getRandomBytes(16)
        );

        timestamp = Date.now();

        const digestHexUpper = dcodeIO.ByteBuffer.wrap(encryptData.digest)
          .toString('hex')
          .toUpperCase();

        // upload
        const putResult = await this.server.putAttachmentNew(
          encryptData.ciphertext,
          digestHexUpper,
          attachment.data.byteLength,
          ossUrl,
          ossUrls,
          attachmentId,
          rapidHash,
          attachment.isVoiceNote ? 1 : 0,
          numbers
        );

        log.info(
          'upload:',
          putResult.exists,
          attachmentId,
          ' delta:',
          Date.now() - timestamp
        );

        if (!fillProtoIfRapid(putResult, proto)) {
          const { authorizeId } = putResult;
          if (!authorizeId) {
            log.error('authorizeId not found in server result.');
            throw new Error('Server response invalid data.');
          }

          proto.id = authorizeId;
          proto.digest = encryptData.digest;
        }
      }

      attachment.rapidHash = rapidHash;
      attachment.authorizeId = proto.id;

      proto.contentType = attachment.contentType;

      if (rapidKey && rapidSize) {
        proto.size = rapidSize;
      } else if (attachment.size) {
        proto.size = attachment.size;
      } else {
        log.error('There is no field size in attachment:', rapidHash);
        throw new Error('attachment has no size.');
      }

      attachment.digest = dcodeIO.ByteBuffer.wrap(proto.digest).toString(
        'base64'
      );
      attachment.rapidKey = dcodeIO.ByteBuffer.wrap(proto.key).toString(
        'base64'
      );
      attachment.rapidSize = proto.size;

      proto.fileName = attachment.fileName || null;
      proto.flags = attachment.flags || null;
      proto.width = attachment.width || null;
      proto.height = attachment.height || null;
      proto.caption = attachment.caption || null;

      return proto;
    });
  },

  queueJobForNumber(number, runJob) {
    const taskWithTimeout = textsecure.createTaskWithTimeout(
      runJob,
      `queueJobForNumber ${number}`
    );

    const runPrevious = this.pendingMessages[number] || Promise.resolve();
    this.pendingMessages[number] = runPrevious.then(
      taskWithTimeout,
      taskWithTimeout
    );

    const runCurrent = this.pendingMessages[number];
    runCurrent.then(() => {
      if (this.pendingMessages[number] === runCurrent) {
        delete this.pendingMessages[number];
      }
    });
  },

  uploadObjectAttachments(object, recipients) {
    const makePointer = this.makeAttachmentPointer.bind(this);
    const { attachments } = object;

    if (!attachments || attachments.length < 1) {
      return Promise.resolve();
    }

    return Promise.all(
      attachments.map(attachment => makePointer(attachment, recipients))
    ).then(pointers => (object.attachmentPointers = pointers));
  },

  uploadForwardsAttachments(forwards, recipients, depth, maxDepth) {
    if (!forwards || forwards.length < 1) {
      return Promise.resolve();
    }

    depth = depth || 1;
    maxDepth = maxDepth || textsecure.MAX_FORWARD_DEPTH;
    if (depth > maxDepth || depth < 1) {
      return Promise.resolve();
    }
    depth++;

    return Promise.all(
      forwards.map(forward =>
        this.uploadObjectAttachments(forward, recipients).then(() =>
          this.uploadForwardsAttachments(
            forward.forwards || [],
            recipients,
            depth,
            maxDepth
          )
        )
      )
    );
  },

  uploadAttachments(message) {
    const { recipients, forwardContext } = message;
    const { forwards } = forwardContext || {};

    return this.uploadObjectAttachments(message, recipients)
      .then(() => this.uploadForwardsAttachments(forwards || [], recipients))
      .catch(error => {
        if (error instanceof Error && error.name === 'HTTPError') {
          throw new textsecure.MessageError(message, error);
        } else {
          throw error;
        }
      });
  },

  uploadThumbnails(message) {
    const makePointer = this.makeAttachmentPointer.bind(this);
    const { quote } = message;

    if (!quote || !quote.attachments || quote.attachments.length === 0) {
      return Promise.resolve();
    }

    return Promise.all(
      quote.attachments.map(attachment => {
        const { thumbnail } = attachment;
        if (!thumbnail) {
          return null;
        }

        return makePointer(thumbnail, message.recipients).then(pointer => {
          // eslint-disable-next-line no-param-reassign
          attachment.attachmentPointer = pointer;
        });
      })
    ).catch(error => {
      if (error instanceof Error && error.name === 'HTTPError') {
        throw new textsecure.MessageError(message, error);
      } else {
        throw error;
      }
    });
  },

  deleteFileAuthorization(message) {
    const { target } = message.recall || {};
    if (target) {
      const { rapidFiles } = target;
      if (rapidFiles instanceof Array && rapidFiles.length > 0) {
        const filesMap = {};
        rapidFiles.forEach(file => {
          const { rapidHash, authorizeId } = file;
          if (filesMap[rapidHash]) {
            filesMap[rapidHash].push(authorizeId);
          } else {
            filesMap[rapidHash] = [authorizeId];
          }
        });

        const combinedFiles = Object.keys(filesMap).map(key => ({
          fileHash: key,
          authorizeIds: _.uniq(filesMap[key]),
        }));

        return this.server.deleteAuthorization(combinedFiles);
      }
    }

    return Promise.resolve();
  },

  sendMessage(attrs, extension) {
    const message = new Message(attrs);
    const silent = false;

    let promise;

    if (message.recall) {
      promise = this.deleteFileAuthorization(message);
    } else {
      promise = Promise.all([
        this.uploadAttachments(message),
        this.uploadThumbnails(message),
      ]);
    }

    return promise.then(
      () =>
        new Promise((resolve, reject) => {
          this.sendMessageProto(
            message.timestamp,
            message.recipients,
            message.toProto(),
            res => {
              res.rapidFiles = message.rapidFiles;
              res.dataMessage = message.toArrayBuffer();
              if (res.errors.length > 0) {
                reject(res);
              } else {
                resolve(res);
              }
            },
            silent,
            extension
          );
        })
    );
  },

  sendMessageProtoNoSilent(message, extension) {
    if (message.group && message.recipients.length === 0) {
      return Promise.resolve({
        successfulNumbers: [],
        failoverNumbers: [],
        errors: [],
        rapidFiles: message.rapidFiles,
        dataMessage: message.toArrayBuffer(),
      });
    }

    return new Promise((resolve, reject) => {
      const silent = false;

      this.sendMessageProto(
        message.timestamp,
        message.recipients,
        message.toProto(),
        res => {
          res.rapidFiles = message.rapidFiles;
          res.dataMessage = message.toArrayBuffer();
          if (res.errors.length > 0) {
            reject(res);
          } else {
            resolve(res);
          }
        },
        silent,
        extension
      );
    });
  },

  sendMessageProto(timestamp, numbers, message, callback, silent, extension) {
    const outgoing = new OutgoingMessage(
      this.server,
      timestamp,
      numbers,
      message,
      silent,
      callback,
      extension
    );

    // deliveryScope
    //  'all': to all recipients of the conversation
    //  'individual': to each of the recipients(numbers) individually
    const { isPrivate, deliveryScope = 'individual' } = extension || {};
    if (!isPrivate && deliveryScope === 'all') {
      outgoing.sendToGroup();
    } else {
      const sendToNumber = outgoing.sendToNumberV3.bind(outgoing);
      numbers.forEach(number => {
        this.queueJobForNumber(number, () => sendToNumber(number));
      });
    }
  },

  sendMessageProtoAndWait(timestamp, numbers, message, silent) {
    return new Promise((resolve, reject) => {
      const callback = result => {
        if (result && result.errors && result.errors.length > 0) {
          return reject(result);
        }

        return resolve(result);
      };

      this.sendMessageProto(timestamp, numbers, message, callback, silent);
    });
  },

  sendIndividualProto(number, proto, timestamp, silent, extension) {
    return new Promise((resolve, reject) => {
      const callback = res => {
        if (res && res.errors && res.errors.length > 0) {
          reject(res);
        } else {
          resolve(res);
        }
      };
      this.sendMessageProto(
        timestamp,
        [number],
        proto,
        callback,
        silent,
        _.pick(extension || {}, ['isPrivate', 'conversationId'])
      );
    });
  },

  createSyncMessage() {
    const syncMessage = new textsecure.protobuf.SyncMessage();

    // Generate a random int from 1 and 512
    const buffer = libsignal.crypto.getRandomBytes(1);
    const paddingLength = (new Uint8Array(buffer)[0] & 0x1ff) + 1;

    // Generate a random padding buffer of the chosen size
    syncMessage.padding = libsignal.crypto.getRandomBytes(paddingLength);

    return syncMessage;
  },

  sendSyncMessage(
    encodedDataMessage,
    timestamp,
    destination,
    expirationStartTimestamp,
    rapidFiles,
    extension,
    serverTimestamp,
    sequenceId,
    notifySequenceId
  ) {
    const myNumber = textsecure.storage.user.getNumber();
    const myDevice = textsecure.storage.user.getDeviceId();

    const { conversationId } = extension || {};

    if (myDevice == 1 && myNumber !== conversationId) {
      return Promise.resolve();
    }

    const dataMessage =
      textsecure.protobuf.DataMessage.decode(encodedDataMessage);
    const sentMessage = new textsecure.protobuf.SyncMessage.Sent();
    sentMessage.timestamp = timestamp;
    sentMessage.message = dataMessage;
    if (destination) {
      sentMessage.destination = destination;
    }
    if (expirationStartTimestamp) {
      sentMessage.expirationStartTimestamp = expirationStartTimestamp;
    }

    if (rapidFiles instanceof Array && rapidFiles.length > 0) {
      const { RapidFile } = textsecure.protobuf;
      sentMessage.rapidFiles = rapidFiles.map(r => {
        const rapidFile = new RapidFile();
        rapidFile.rapidHash = r.rapidHash;
        rapidFile.authorizeId = r.authorizeId;
        return rapidFile;
      });
    }

    if (serverTimestamp) {
      sentMessage.serverTimestamp = serverTimestamp;
    }

    if (sequenceId) {
      sentMessage.sequenceId = sequenceId;
    }

    if (notifySequenceId) {
      sentMessage.notifySequenceId = notifySequenceId;
    }

    const syncMessage = this.createSyncMessage();
    syncMessage.sent = sentMessage;
    const contentMessage = new textsecure.protobuf.Content();
    contentMessage.syncMessage = syncMessage;

    window.log.info(`syncing conversation ${destination} message ${timestamp}`);

    const silent = true;
    return this.sendIndividualProto(
      myNumber,
      contentMessage,
      timestamp,
      silent,
      extension
    );
  },

  async getProfile(number) {
    return this.server.getProfile(number);
  },

  getAvatar(path) {
    return this.server.getAvatar(path);
  },

  sendReadReceipts(receipts, extension) {
    const { sender, timestamps, readPosition, messageMode } = receipts;

    const receiptMessage = new textsecure.protobuf.ReceiptMessage();
    receiptMessage.type = textsecure.protobuf.ReceiptMessage.Type.READ;
    receiptMessage.timestamp = timestamps;

    if (messageMode) {
      receiptMessage.messageMode = messageMode;
    }

    if (readPosition) {
      const { groupId, readAt, maxServerTimestamp, maxNotifySequenceId } =
        readPosition;

      const position = new textsecure.protobuf.ReadPosition();
      position.readAt = readAt;
      position.maxServerTimestamp = maxServerTimestamp;

      if (maxNotifySequenceId) {
        position.maxNotifySequenceId = maxNotifySequenceId;
      }

      if (groupId) {
        position.groupId = stringToArrayBuffer(groupId);
      }

      receiptMessage.readPosition = position;
    }

    const contentMessage = new textsecure.protobuf.Content();
    contentMessage.receiptMessage = receiptMessage;

    const silent = true;
    return this.sendIndividualProto(
      sender,
      contentMessage,
      Date.now(),
      silent,
      extension
    );
  },
  syncReadMessages(reads, extension) {
    const myNumber = textsecure.storage.user.getNumber();

    const syncMessage = this.createSyncMessage();
    syncMessage.read = [];
    for (let i = 0; i < reads.length; i += 1) {
      const { timestamp, sender, readPosition, messageMode } = reads[i];
      if (!timestamp || !sender) {
        window.log.warn('invalid read', reads[i]);
        continue;
      }

      const read = new textsecure.protobuf.SyncMessage.Read();

      read.timestamp = timestamp;
      read.sender = sender;

      if (messageMode) {
        read.messageMode = messageMode;
      }

      if (readPosition) {
        const {
          groupId,
          readAt = 0,
          maxServerTimestamp,
          maxNotifySequenceId,
        } = readPosition;

        const position = new textsecure.protobuf.ReadPosition();
        position.readAt = readAt;
        position.maxServerTimestamp = maxServerTimestamp;

        if (maxNotifySequenceId) {
          position.maxNotifySequenceId = maxNotifySequenceId;
        }

        if (groupId) {
          position.groupId = stringToArrayBuffer(groupId);
        }

        read.readPosition = position;
      }

      syncMessage.read.push(read);
    }

    if (!syncMessage.read.length) {
      return Promise.reject('empty valid reads');
    }

    const contentMessage = new textsecure.protobuf.Content();
    contentMessage.syncMessage = syncMessage;

    const silent = true;
    return this.sendIndividualProto(
      myNumber,
      contentMessage,
      Date.now(),
      silent,
      extension
    );
  },
  syncMarkAsReadOrUnread(number, groupId, flag, extension) {
    const myNumber = textsecure.storage.user.getNumber();
    // const myDevice = textsecure.storage.user.getDeviceId();

    // do not check deviceId here
    // we will use the serverTimestamp from server
    if (!number && !groupId) {
      throw new Error('number or groupId can not be both null');
    }

    const conversationId = new textsecure.protobuf.ConversationId();
    if (groupId) {
      conversationId.groupId = stringToArrayBuffer(groupId);
    } else {
      conversationId.number = number;
    }

    const markAsUnread = new textsecure.protobuf.SyncMessage.MarkAsUnread();
    markAsUnread.conversationId = conversationId;

    // unread flag: //0: 清除设定的未读状态 1、置未读  2、置全部已读
    markAsUnread.flag = flag;

    const syncMessage = this.createSyncMessage();
    syncMessage.markAsUnread = markAsUnread;

    const contentMessage = new textsecure.protobuf.Content();
    contentMessage.syncMessage = syncMessage;

    const silent = true;
    return this.sendIndividualProto(
      myNumber,
      contentMessage,
      Date.now(),
      silent,
      extension
    );
  },
  syncConversationArchive(number, groupId, flag, extension) {
    const myNumber = textsecure.storage.user.getNumber();
    if (!number && !groupId) {
      throw new Error('number or groupId can not be both null');
    }

    const conversationId = new textsecure.protobuf.ConversationId();
    if (groupId) {
      conversationId.groupId = stringToArrayBuffer(groupId);
    } else {
      conversationId.number = number;
    }

    const conversationArchive =
      new textsecure.protobuf.SyncMessage.ConversationArchive();
    conversationArchive.conversationId = conversationId;
    // 0: 解档  1:归档
    conversationArchive.flag = flag;

    const syncMessage = this.createSyncMessage();
    syncMessage.conversationArchive = conversationArchive;

    const contentMessage = new textsecure.protobuf.Content();
    contentMessage.syncMessage = syncMessage;

    const silent = true;
    return this.sendIndividualProto(
      myNumber,
      contentMessage,
      Date.now(),
      silent,
      extension
    );
  },

  syncTaskRead(taskReads, extension) {
    const myNumber = textsecure.storage.user.getNumber();
    const myDevice = textsecure.storage.user.getDeviceId();
    if (myDevice != 1) {
      const syncMessage = this.createSyncMessage();
      syncMessage.tasks = [];
      for (let i = 0; i < taskReads.length; i += 1) {
        const task = new textsecure.protobuf.SyncMessage.Task();

        task.type = textsecure.protobuf.SyncMessage.Task.Type.READ;
        task.taskId = taskReads[i].taskId;
        task.version = taskReads[i].version;
        task.timestamp = taskReads[i].timestamp;

        syncMessage.tasks.push(task);
      }
      const contentMessage = new textsecure.protobuf.Content();
      contentMessage.syncMessage = syncMessage;

      const silent = true;
      return this.sendIndividualProto(
        myNumber,
        contentMessage,
        Date.now(),
        silent,
        extension
      );
    }

    return Promise.resolve();
  },

  syncNullMessage(extension) {
    const myNumber = textsecure.storage.user.getNumber();
    const now = Date.now();

    const syncMessage = this.createSyncMessage();
    const contentMessage = new textsecure.protobuf.Content();
    contentMessage.syncMessage = syncMessage;

    const silent = true;
    return this.sendIndividualProto(
      myNumber,
      contentMessage,
      now,
      silent,
      extension
    );
  },

  async getMessageProto(
    number,
    body,
    mentions,
    attachments,
    quote,
    timestamp,
    expireTimer,
    profileKey,
    flags,
    forwardContext,
    contacts,
    recall,
    task,
    vote,
    card,
    threadContext,
    messageMode,
    reaction
  ) {
    const attributes = {
      recipients: [number],
      body,
      mentions,
      timestamp,
      attachments,
      quote,
      expireTimer,
      profileKey,
      flags,
      forwardContext,
      contacts,
      recall,
      task,
      vote,
      card,
      threadContext,
      reaction,
      messageMode,
    };

    return this.getMessageProtoObject(attributes);
  },

  async getMessageProtoObject(attributes) {
    const message = new Message(attributes);

    if (message.recall) {
      await this.deleteFileAuthorization(message);
    } else {
      await Promise.all([
        this.uploadAttachments(message),
        this.uploadThumbnails(message),
      ]);
    }

    // make proto ready here
    message.toProto();

    return message;
  },

  async getMessageProtoBuffer(attributes) {
    return this.getMessageProtoObject(attributes).then(message =>
      message.toArrayBuffer()
    );
  },

  async getMessageToNumberProto(
    number,
    body,
    mentions,
    atPersons,
    attachments,
    quote,
    timestamp,
    expireTimer,
    profileKey,
    forwardContext,
    contacts,
    recall,
    task,
    vote,
    card,
    threadContext,
    messageMode
  ) {
    const attributes = {
      recipients: [number],
      body,
      mentions,
      atPersons,
      timestamp,
      attachments,
      quote,
      needsSync: true,
      expireTimer,
      profileKey,
      forwardContext,
      contacts,
      recall,
      task,
      vote,
      card,
      threadContext,
      messageMode,
    };

    return this.getMessageProtoObject(attributes);
  },

  sendMessageToNumber(
    number,
    messageText,
    mentions,
    attachments,
    quote,
    timestamp,
    expireTimer,
    profileKey,
    extension,
    forwardContext,
    contacts,
    recall,
    task,
    vote,
    card,
    threadContext,
    messageMode
  ) {
    return this.sendMessage(
      {
        recipients: [number],
        body: messageText,
        mentions,
        timestamp,
        attachments,
        quote,
        needsSync: true,
        expireTimer,
        profileKey,
        forwardContext,
        contacts,
        recall,
        task,
        vote,
        card,
        threadContext,
        messageMode,
      },
      extension
    );
  },

  async getMessageToGroupProto(
    groupId,
    groupNumbers,
    messageText,
    mentions,
    atPersons,
    attachments,
    quote,
    timestamp,
    expireTimer,
    profileKey,
    forwardContext,
    contacts,
    recall,
    task,
    vote,
    card,
    threadContext,
    messageMode
  ) {
    const me = textsecure.storage.user.getNumber();
    const numbers = groupNumbers.filter(number => number !== me);
    const attrs = {
      recipients: numbers,
      body: messageText,
      mentions,
      atPersons,
      timestamp,
      attachments,
      quote,
      needsSync: true,
      expireTimer,
      profileKey,
      group: {
        id: groupId,
        type: textsecure.protobuf.GroupContext.Type.DELIVER,
      },
      forwardContext,
      contacts,
      recall,
      task,
      vote,
      card,
      threadContext,
      messageMode,
    };

    return this.getMessageProtoObject(attrs);
  },

  sendReactionMessage(attrs, extension) {
    const message = new Message(attrs);
    const silent = true;

    return new Promise((resolve, reject) => {
      this.sendMessageProto(
        message.timestamp,
        message.recipients,
        message.toProto(),
        res => {
          res.dataMessage = message.toArrayBuffer();
          if (res.errors.length > 0) {
            reject(res);
          } else {
            resolve(res);
          }
        },
        silent,
        extension
      );
    });
  },

  sendReactionToNumber(number, timestamp, reaction, extension) {
    return this.sendReactionMessage(
      {
        recipients: [number],
        timestamp,
        needsSync: true,
        reaction,
      },
      extension
    );
  },

  async sendReactionToGroup(
    groupId,
    groupNumbers,
    timestamp,
    reaction,
    extension
  ) {
    const me = textsecure.storage.user.getNumber();
    const numbers = groupNumbers.filter(number => number !== me);
    const attrs = {
      recipients: numbers,
      timestamp,
      needsSync: true,
      group: {
        id: groupId,
        type: textsecure.protobuf.GroupContext.Type.DELIVER,
      },
      reaction,
    };

    if (numbers.length === 0) {
      return Promise.resolve({
        successfulNumbers: [],
        failoverNumbers: [],
        errors: [],
        dataMessage: await this.getMessageProtoBuffer(attrs),
      });
    }

    return this.sendReactionMessage(attrs, extension);
  },

  // fetch someone's profile
  // if properties is not set, only fetch basic properties
  fetchContactProfile(number, properties) {
    if (typeof number !== 'string') {
      log.error('Invalid number type');
      throw Error('Invalid input number.');
    }

    return this.fetchDirectoryContacts([number], properties).then(
      data => data.contacts[0]
    );
  },

  // fetch directory c
  fetchDirectoryContacts(numbers, properties) {
    return this.server
      .fetchDirectoryContacts(numbers, properties)
      .then(result => {
        const { data = {} } = result;
        const { contacts = [] } = data;

        return Promise.all(
          contacts.map(contact => {
            const { remark } = contact;
            if (!remark) {
              return;
            }

            const { number } = contact;

            try {
              const key = textsecure.crypto.getRemarkNameKey(number);
              return textsecure.crypto
                .decryptRemarkName(remark, key)
                .then(
                  decrypted =>
                    (contact.remarkName =
                      dcodeIO.ByteBuffer.wrap(decrypted).toString('utf8'))
                )
                .catch(error => {
                  log.info('invalid remark for conact', number, error);
                });
            } catch (error) {
              log.info('invalid remark for conact', number, error);
            }
          })
        ).then(() => data);
      });
  },

  // return promise
  createGroupV2(groupName, groupAvatar, expiration, members) {
    return this.server.createGroupV2(
      groupName,
      groupAvatar,
      expiration,
      members
    );
  },
  editGroupV2(
    groupId,
    groupName,
    groupOwner,
    groupAvatar,
    expiration,
    remindCycle
  ) {
    return this.server.editGroupV2(
      groupId,
      groupName,
      groupOwner,
      groupAvatar,
      expiration,
      remindCycle
    );
  },
  queryGroupV2(groupId) {
    return this.server.queryGroupV2(groupId);
  },
  getGroupV2List() {
    return this.server.getGroupV2List();
  },
  addGroupV2Members(groupId, members) {
    return this.server.addGroupV2Members(groupId, members);
  },
  removeGroupV2Members(groupId, members) {
    return this.server.removeGroupV2Members(groupId, members);
  },
  addGroupAdmin(groupId, member) {
    return this.server.addGroupAdmin(groupId, member);
  },
  removeGroupAdmin(groupId, member) {
    return this.server.removeGroupAdmin(groupId, member);
  },
  transferGroupOwner(groupId, member) {
    return this.server.transferGroupOwner(groupId, member);
  },
  editGroupV2Member(groupId, number, role, displayName, remark, notification) {
    return this.server.editGroupV2Member(
      groupId,
      number,
      role,
      displayName,
      remark,
      notification
    );
  },
  getGroupV2Member(groupId, number) {
    return this.server.getGroupV2Member(groupId, number);
  },
  disbandGroupV2(groupId) {
    return this.server.disbandGroupV2(groupId);
  },
  getGroupV2InviteCode(groupId) {
    return this.server.getGroupV2InviteCode(groupId);
  },
  getGroupV2InfoByInviteCode(groupInviteCode) {
    return this.server.getGroupV2InfoByInviteCode(groupInviteCode);
  },
  joinGroupV2ByInviteCode(groupInviteCode) {
    return this.server.joinGroupV2ByInviteCode(groupInviteCode);
  },
  changeGroupOnlyOwner(groupId, data) {
    return this.server.editGroupV2OnlyOwner(groupId, data);
  },
  getAttachment(id) {
    return this.server.getAttachment(id);
  },
  putAttachment(id) {
    return this.server.putAttachment(id);
  },
  translateContent(contents, targetLang, sourceLang) {
    return this.server.translateContent(contents, targetLang, sourceLang);
  },

  // conversation
  conversationToFront(conversationId) {
    return this.server.conversationToFront(conversationId);
  },

  queryUserByInviteCode(pi) {
    return this.server.queryUserByInviteCode(pi);
  },
  queryUserById(cids) {
    return this.server.fetchDirectoryContacts(cids);
  },
  generateInviteCode(regenerate, short) {
    return this.server.generateInviteCode(regenerate, short);
  },

  getConversationSharedConfig(conversationId, checkAsk = false) {
    const ourNumber = textsecure.storage.user.getNumber();
    return this.server.getConversationSharedConfig(
      ourNumber,
      conversationId,
      checkAsk
    );
  },
  setConversationSharedConfig(conversationId, config) {
    const ourNumber = textsecure.storage.user.getNumber();
    return this.server.setConversationSharedConfig(
      ourNumber,
      conversationId,
      config
    );
  },

  getConversationConfig(idOrIds) {
    return this.server.getConversationConfig(idOrIds);
  },

  setConversationConfig(conversationId, config) {
    return this.server.setConversationConfig(conversationId, config);
  },

  // friendship
  reportAbnormalUser(uid, type, reason, block) {
    return this.server.reportAbnormalUser(uid, type, reason, block);
  },
  sendFriendRequest(uid, source, action) {
    return this.server.sendFriendRequest(uid, source, action);
  },
  deleteFriend(uid) {
    return this.server.deleteFriend(uid);
  },
  speechToText(attachment) {
    return this.server.speechToText(attachment);
  },
};

window.textsecure = window.textsecure || {};

textsecure.MessageSender = function MessageSenderWrapper(username, password) {
  const sender = new MessageSender(username, password);

  this.sendMessageToNumber = sender.sendMessageToNumber.bind(sender);
  this.sendMessage = sender.sendMessage.bind(sender);

  this.sendSyncMessage = sender.sendSyncMessage.bind(sender);
  this.getProfile = sender.getProfile.bind(sender);
  this.getAvatar = sender.getAvatar.bind(sender);
  this.syncReadMessages = sender.syncReadMessages.bind(sender);
  this.sendReadReceipts = sender.sendReadReceipts.bind(sender);
  this.getMessageProto = sender.getMessageProto.bind(sender);

  this.createGroupV2 = sender.createGroupV2.bind(sender);
  this.editGroupV2 = sender.editGroupV2.bind(sender);
  this.queryGroupV2 = sender.queryGroupV2.bind(sender);
  this.getGroupV2List = sender.getGroupV2List.bind(sender);
  this.addGroupV2Members = sender.addGroupV2Members.bind(sender);
  this.removeGroupV2Members = sender.removeGroupV2Members.bind(sender);
  this.addGroupAdmin = sender.addGroupAdmin.bind(sender);
  this.removeGroupAdmin = sender.removeGroupAdmin.bind(sender);
  this.transferGroupOwner = sender.transferGroupOwner.bind(sender);
  this.editGroupV2Member = sender.editGroupV2Member.bind(sender);
  this.getGroupV2Member = sender.getGroupV2Member.bind(sender);
  this.disbandGroupV2 = sender.disbandGroupV2.bind(sender);
  this.getGroupV2InviteCode = sender.getGroupV2InviteCode.bind(sender);
  this.getGroupV2InfoByInviteCode =
    sender.getGroupV2InfoByInviteCode.bind(sender);
  this.joinGroupV2ByInviteCode = sender.joinGroupV2ByInviteCode.bind(sender);
  this.changeGroupOnlyOwner = sender.changeGroupOnlyOwner.bind(sender);

  this.getAttachment = sender.getAttachment.bind(sender);
  this.putAttachment = sender.putAttachment.bind(sender);
  this.fetchContactProfile = sender.fetchContactProfile.bind(sender);
  this.fetchDirectoryContacts = sender.fetchDirectoryContacts.bind(sender);
  this.getMessageToGroupProto = sender.getMessageToGroupProto.bind(sender);
  this.getMessageToNumberProto = sender.getMessageToNumberProto.bind(sender);
  this.sendMessageProtoNoSilent = sender.sendMessageProtoNoSilent.bind(sender);
  this.translateContent = sender.translateContent.bind(sender);

  // reaction
  this.sendReactionToGroup = sender.sendReactionToGroup.bind(sender);
  this.sendReactionToNumber = sender.sendReactionToNumber.bind(sender);

  // mark as unread
  this.syncMarkAsReadOrUnread = sender.syncMarkAsReadOrUnread.bind(sender);

  // conversation archived
  this.syncConversationArchive = sender.syncConversationArchive.bind(sender);

  // sync null message
  this.syncNullMessage = sender.syncNullMessage.bind(sender);

  // conversation
  this.conversationToFront = sender.conversationToFront.bind(sender);

  // 根据邀请码查询用户id
  this.queryUserByInviteCode = sender.queryUserByInviteCode.bind(sender);

  // 根据用户id 查询用户的信息
  this.queryUserById = sender.queryUserById.bind(sender);

  // 获取邀请码
  this.generateInviteCode = sender.generateInviteCode.bind(sender);

  // conversation shared config
  this.getConversationSharedConfig =
    sender.getConversationSharedConfig.bind(sender);
  this.setConversationSharedConfig =
    sender.setConversationSharedConfig.bind(sender);

  // conversation config
  this.getConversationConfig = sender.getConversationConfig.bind(sender);
  this.setConversationConfig = sender.setConversationConfig.bind(sender);

  // friendship
  this.reportAbnormalUser = sender.reportAbnormalUser.bind(sender);
  this.sendFriendRequest = sender.sendFriendRequest.bind(sender);
  this.deleteFriend = sender.deleteFriend.bind(sender);

  this.makeAttachmentPointer = sender.makeAttachmentPointer.bind(sender);
  this.speechToText = sender.speechToText.bind(sender);
};

textsecure.MessageSender.prototype = {
  constructor: textsecure.MessageSender,
};
