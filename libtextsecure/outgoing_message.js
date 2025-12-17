/* global textsecure, libsignal, window, btoa, _ */

/* eslint-disable more/no-then */

// prettier-ignore
const NotificationType = {
  MSG_SINGLE_NORMAL:              0,
  MSG_SINGLE_FILE:                1,
  MSG_SINGLE_REPLY:               2,
  MSG_SINGLE_CALL_RING:           3,
  MSG_SINGLE_CALL_CANCEL:         4,
  MSG_SINGLE_CALL_TIMEOUT:        5,
  MSG_GROUP_NORMAL:               6,
  MSG_GROUP_FILE:                 7,
  MSG_GROUP_AT_RECEIVER:          8,
  MSG_GROUP_AT_OTHERS:            9,
  MSG_GROUP_AT_ALL:               10,
  MSG_GROUP_REPLY_RECEIVER:       11,
  MSG_GROUP_REPLY_OTHERS:         12,
  MSG_GROUP_CALL_RING:            13,
  MSG_GROUP_CALL_CLOSE:           14,
  MSG_GROUP_CALL_OVER:            15,
  MSG_GROUP_ANNOUNCEMENT_ADDED:   16,
  MSG_GROUP_ANNOUNCEMENT_UPDATED: 17,
  MSG_RECALL_MENTIONS_OTHERS:     18,
  MSG_RECALL_MENTIONS_RECEIVER:   19,
  MSG_SINGLE_TASK:                20,

  MSG_ENC_CALL:                   22,
}

// prettier-ignore
const DetailMessageType = {
  FORWARD:  1,
  CONTACT:  2,
  RECALL:   3,
  TASK:     4,
  VOTE:     5,
  REACTION: 6,
  CARD:     7,

  CONFIDE:    8,
  SCREENSHOT: 9,

  MANUALLY_END_PRIVATE_CALL: 1001,
  MANUALLY_END_NON_PRIVATE_CALL: 1002,
};

// prettier-ignore
const CallAction = {
  RING:    'RING',
  CANCEL:  'CANCEL',
  TIMEOUT: 'TIMEOUT',
}

function makeReasonError(reason, error) {
  return { reason, error };
}

function OutgoingMessage(
  server,
  timestamp,
  numbers,
  message,
  silent,
  callback,
  extension
) {
  if (message instanceof textsecure.protobuf.DataMessage) {
    const content = new textsecure.protobuf.Content();
    content.dataMessage = message;
    // eslint-disable-next-line no-param-reassign
    message = content;
  }
  this.server = server;
  this.timestamp = timestamp;
  this.numbers = numbers;
  this.message = message; // ContentMessage proto
  this.callback = callback;
  this.silent = silent;

  this.extension = extension;

  this.numbersCompleted = 0;
  this.errors = [];
  this.successfulNumbers = [];

  this.sequenceId = 0;
  this.serverTimestamp = 0;
  this.notifySequenceId = 0;

  this.sequenceIdMap = {};
  this.serverTimestampMap = {};
  this.notifySequenceIdMap = {};

  this.initialNumbers = [...this.numbers];
  this.unavailableNumbers = [];
  this.missingNumbers = [];
  this.extraNumbers = [];
}

OutgoingMessage.prototype = {
  constructor: OutgoingMessage,
  numberCompleted() {
    this.numbersCompleted += 1;
    if (this.numbersCompleted >= this.numbers.length) {
      this.callback({
        sequenceId: this.sequenceId,
        serverTimestamp: this.serverTimestamp,
        notifySequenceId: this.notifySequenceId,

        sequenceIdMap: this.sequenceIdMap,
        serverTimestampMap: this.serverTimestampMap,
        notifySequenceIdMap: this.notifySequenceIdMap,

        successfulNumbers: this.successfulNumbers,
        errors: this.errors,

        unavailableNumbers: this.unavailableNumbers,
        missingNumbers: this.missingNumbers,
        extraNumbers: this.extraNumbers,
      });
    }
  },
  registerError(number, reason, error) {
    // error.message will be shown
    if (!error || (error.name === 'HTTPError' && error.code !== 404)) {
      // eslint-disable-next-line no-param-reassign
      error = new textsecure.OutgoingMessageError(
        number,
        reason,
        this.timestamp,
        error
      );
    }

    // eslint-disable-next-line no-param-reassign
    error.number = number;
    // eslint-disable-next-line no-param-reassign
    error.reason = reason;
    this.errors[this.errors.length] = error;
    this.numberCompleted();
  },
  registerErrorEach(fnGetUserError) {
    this.numbers.forEach(number => {
      const { reason, error } = fnGetUserError(number);
      this.registerError(number, reason, error);
    });
  },
  getPaddedMessageLength(messageLength) {
    const messageLengthWithTerminator = messageLength + 1;
    let messagePartCount = Math.floor(messageLengthWithTerminator / 160);

    if (messageLengthWithTerminator % 160 !== 0) {
      messagePartCount += 1;
    }

    return messagePartCount * 160;
  },

  getPlaintext() {
    if (!this.plaintext) {
      const messageBuffer = this.message.toArrayBuffer();
      this.plaintext = new Uint8Array(
        this.getPaddedMessageLength(messageBuffer.byteLength + 1) - 1
      );
      this.plaintext.set(new Uint8Array(messageBuffer));
      this.plaintext[messageBuffer.byteLength] = 0x80;
    }
    return this.plaintext;
  },

  getDetailMessageType() {
    const { dataMessage } = this.message;
    const { DataMessage } = textsecure.protobuf;
    if (dataMessage instanceof DataMessage) {
      const { reaction, forwardContext, contacts, recall, task, vote, card } =
        dataMessage;
      if (forwardContext?.forwards?.length > 0) {
        return DetailMessageType.FORWARD;
      } else if (contacts?.length > 0) {
        return DetailMessageType.CONTACT;
      } else if (recall?.realSource) {
        return DetailMessageType.RECALL;
      } else if (task instanceof DataMessage.Task) {
        return DetailMessageType.TASK;
      } else if (vote instanceof DataMessage.Vote) {
        return DetailMessageType.VOTE;
      } else if (card instanceof DataMessage.Card) {
        return DetailMessageType.CARD;
      } else if (reaction instanceof DataMessage.Reaction) {
        return DetailMessageType.REACTION;
      } else {
        //
        return null;
      }
    }
  },

  getMessageType() {
    const MessageType = textsecure.protobuf.Envelope.MsgType;
    let messageType = MessageType.MSG_UNKNOWN;

    do {
      const { receiptMessage } = this.message;
      if (receiptMessage instanceof textsecure.protobuf.ReceiptMessage) {
        messageType = MessageType.MSG_READ_RECEIPT;
        break;
      }

      const { dataMessage } = this.message;
      if (dataMessage instanceof textsecure.protobuf.DataMessage) {
        const { recall } = dataMessage;
        if (recall instanceof textsecure.protobuf.DataMessage.Recall) {
          messageType = MessageType.MSG_RECALL;
        } else {
          messageType = MessageType.MSG_NORMAL;
        }

        break;
      }

      const { syncMessage } = this.message;
      if (syncMessage instanceof textsecure.protobuf.SyncMessage) {
        const { sent, read } = syncMessage;
        if (sent instanceof textsecure.protobuf.SyncMessage.Sent) {
          const { reaction } = sent.message || {};
          if (reaction instanceof textsecure.protobuf.DataMessage.Reaction) {
            messageType = MessageType.MSG_SYNC;
          } else {
            messageType = MessageType.MSG_SYNC_PREVIEWABLE;
          }
        } else if (
          read?.length &&
          read[0] instanceof textsecure.protobuf.SyncMessage.Read
        ) {
          messageType = MessageType.MSG_SYNC_READ_RECEIPT;
        } else {
          messageType = MessageType.MSG_SYNC;
        }
        break;
      }
    } while (false);

    return messageType;
  },

  getNotificationForNumber(number) {
    let notification = {};
    let passthrough = {};

    // add notification for group sync messages
    if (this.message.syncMessage instanceof textsecure.protobuf.SyncMessage) {
      const group = this.message.syncMessage.sent?.message?.group;
      if (group) {
        const groupId = dcodeIO.ByteBuffer.wrap(group.id).toString('binary');
        const conversation = ConversationController.get(groupId);

        notification.type = -1;
        notification.args = {
          gname: conversation.getName(),
        };

        if (conversation.isGroupV2()) {
          notification.args.gid = conversation.getGroupV2Id();
        }
      }
      return notification;
    }

    const proto = this.message.dataMessage;
    if (!proto || !(proto instanceof textsecure.protobuf.DataMessage)) {
      return notification;
    }

    const ourNumber = textsecure.storage.user.getNumber();
    const { channelName, meetingName, callAction, collapseId, recall } =
      this.extension || {};

    let realCollapseId = collapseId;
    if (channelName) {
      realCollapseId = channelName;
    } else if (proto.recall) {
      realCollapseId = recall?.collapseId;
    }

    notification.args = {
      collapseId: realCollapseId,
    };

    if (proto.group) {
      // group chat
      const groupIdB64 = dcodeIO.ByteBuffer.wrap(proto.group.id).toString(
        'base64'
      );
      passthrough = {
        conversationId: groupIdB64,
      };

      const groupId = dcodeIO.ByteBuffer.wrap(proto.group.id).toString(
        'binary'
      );
      const conversation = ConversationController.get(groupId);

      notification.args.gname = conversation.getName();
      if (conversation.isGroupV2()) {
        notification.args.gid = conversation.getGroupV2Id();
      }

      const MENTIONS_ALL_ID = 'MENTIONS_ALL';

      if (proto.recall) {
        // atPersons in recall is an array of persons
        const { atPersons, quotedAuthor } = recall;

        const mentionedPersons = [];
        if (quotedAuthor) {
          mentionedPersons.push(quotedAuthor);

          if (quotedAuthor === number) {
            notification.type = NotificationType.MSG_RECALL_MENTIONS_RECEIVER;
          } else {
            notification.type = NotificationType.MSG_RECALL_MENTIONS_OTHERS;
          }
        } else if (atPersons instanceof Array && atPersons.length > 0) {
          mentionedPersons.push(...atPersons);

          if (
            atPersons.includes(MENTIONS_ALL_ID) ||
            atPersons.includes(number)
          ) {
            notification.type = NotificationType.MSG_RECALL_MENTIONS_RECEIVER;
          } else {
            notification.type = NotificationType.MSG_RECALL_MENTIONS_OTHERS;
          }
        }

        if (mentionedPersons.length > 0) {
          notification.args = {
            ...notification.args,
            mentionedPersons,
          };
        }
      } else if (proto.attachments && proto.attachments.length > 0) {
        // attachments
        notification.type = NotificationType.MSG_GROUP_FILE;
      } else if (proto.quote) {
        // quote
        if (proto.quote.author === number) {
          notification.type = NotificationType.MSG_GROUP_REPLY_RECEIVER;
        } else {
          notification.type = NotificationType.MSG_GROUP_REPLY_OTHERS;
          notification.args = {
            ...notification.args,
            mentionedPersons: [proto.quote.author],
          };
        }
      } else if (callAction === CallAction.RING) {
        notification.type = NotificationType.MSG_GROUP_CALL_RING;

        passthrough = {
          ...passthrough,
          callInfo: {
            mode: 'group',
            caller: ourNumber,
            channelName: channelName,
            meetingName: meetingName,
            groupId: groupIdB64,
          },
        };
      } else if (proto.atPersons) {
        // at persons
        const persons = proto.atPersons.split(';');

        notification.args = {
          ...notification.args,
          mentionedPersons: persons,
        };

        if (persons.includes(MENTIONS_ALL_ID)) {
          notification.type = NotificationType.MSG_GROUP_AT_ALL;
        } else if (persons.includes(number)) {
          notification.type = NotificationType.MSG_GROUP_AT_RECEIVER;
        } else {
          notification.type = NotificationType.MSG_GROUP_AT_OTHERS;
        }
      } else {
        notification.type = NotificationType.MSG_GROUP_NORMAL;

        // if (callAction === CallAction.RING) {
        //   notification.type = NotificationType.MSG_GROUP_CALL_RING;

        //   passthrough = {
        //     ...passthrough,
        //     callInfo: {
        //       mode: 'group',
        //       caller: ourNumber,
        //       channelName: channelName,
        //       meetingName: meetingName,
        //       groupId: groupIdB64,
        //     },
        //   };
        // }
      }
    } else {
      passthrough = {
        conversationId: ourNumber,
      };

      // single chat
      if (proto.attachments && proto.attachments.length > 0) {
        notification.type = NotificationType.MSG_SINGLE_FILE;
      } else if (proto.quote) {
        notification.type = NotificationType.MSG_SINGLE_REPLY;
      } else if (proto.task) {
        notification.type = NotificationType.MSG_SINGLE_TASK;
      } else {
        // default to normal message
        notification.type = NotificationType.MSG_SINGLE_NORMAL;

        if (callAction === CallAction.RING) {
          // 群拉人通知的情况
          if (meetingName) {
            const me = ConversationController.get(ourNumber);
            notification.args.gname = me.getDisplayName();
            notification.type = NotificationType.MSG_GROUP_CALL_RING;
            passthrough = {
              ...passthrough,
              callInfo: {
                mode: 'group',
                caller: ourNumber,
                channelName,
                meetingName,
                groupId: '', // 必须设置为空
              },
            };
          } else {
            notification.type = NotificationType.MSG_SINGLE_CALL_RING;
            passthrough = {
              ...passthrough,
              callInfo: {
                mode: 'private',
                caller: ourNumber,
                channelName: channelName,
              },
            };
          }
        } else if (callAction === CallAction.CANCEL) {
          notification.type = NotificationType.MSG_SINGLE_CALL_CANCEL;
        } else if (callAction === CallAction.TIMEOUT) {
          notification.type = NotificationType.MSG_SINGLE_CALL_TIMEOUT;
        }
      }
    }

    notification.args = {
      ...notification.args,
      passthrough: JSON.stringify(passthrough),
    };

    return notification;
  },

  async doBatchUpdateCiphers(uids, fnGetNewKeys) {
    const updateCipherMap = UserSessionCipher.userCipherMapFromUids(uids);
    const updateUids = Object.keys(updateCipherMap);

    let errorMap;
    try {
      errorMap = await UserSessionCipher.batchUpdateCiphers(
        updateCipherMap,
        fnGetNewKeys
      );
    } catch (error) {
      window.log.error('batchUpdateCiphers error', error);

      this.registerErrorEach(number => {
        const reason = updateUids.includes(number)
          ? 'update session error'
          : 'other user update session error';

        return makeReasonError(reason);
      });

      throw new Error('do batch update ciphers error');
    }

    if (errorMap) {
      const errorUids = Object.keys(errorMap);

      this.registerErrorEach(number => {
        const reason = errorUids.includes(number)
          ? errorMap[number]
          : 'other user update session error';

        return makeReasonError(reason);
      });

      throw new Error('do batch update ciphers error');
    }
  },

  async sendToGroup(tryTimes = 3) {
    if (tryTimes <= 0) {
      this.registerErrorEach(() =>
        makeReasonError('Maximum retry attempts reached.')
      );
      return;
    }

    const proto = this.message.dataMessage;
    if (!(proto instanceof textsecure.protobuf.DataMessage) || !proto.group) {
      this.registerErrorEach(() =>
        makeReasonError('Cannot send non group dataMessage.')
      );
      return;
    }

    const notification = this.getNotificationForNumber();

    let sessionCipher;

    try {
      const { ciphers, errorMap } = await UserSessionCipher.batchLoadCiphers(
        this.numbers,
        uids => this.server.getKeysV3ForUids(uids).then(data => data?.keys)
      );

      if (errorMap && Object.keys(errorMap).length) {
        const errorUids = Object.keys(errorMap);
        this.registerErrorEach(number => {
          const reason = errorUids.includes(number)
            ? errorMap[number]
            : 'other user update session error';

          return makeReasonError(reason);
        });

        return;
      }

      sessionCipher = GroupSessionCipher.from(ciphers);
    } catch (error) {
      window.log.error('batchLoadCiphers error', error);

      this.registerErrorEach(() =>
        makeReasonError('load and update session error')
      );

      return;
    }

    let content;
    let recipients;

    try {
      const plaintext = this.getPlaintext();
      const { cipherObject, receipts } = await sessionCipher.encrypt(plaintext);
      content = textsecure.EncryptedContent.encode(cipherObject);
      recipients = receipts;
    } catch (error) {
      window.log.error('encrypt and encode content error', error);

      this.registerErrorEach(() =>
        makeReasonError('encrypt and encode content error')
      );
    }

    const withLegacy = false;

    const jsonData = {
      type: textsecure.protobuf.Envelope.Type.ENCRYPTEDTEXT,
      legacyContent: withLegacy ? this.message.toBase64() : null,
      content,
      notification,
      msgType: this.getMessageType(),
      detailMessageType: this.getDetailMessageType(),
      recipients,
    };

    const MessageType = textsecure.protobuf.Envelope.MsgType;
    if (jsonData.msgType === MessageType.MSG_RECALL) {
      const { realSource } = this.message.dataMessage?.recall;
      if (realSource) {
        jsonData.realSource = {
          ...realSource,
        };
      }
    }

    const { isPrivate, conversationId } = this.extension || {};
    if (conversationId) {
      if (isPrivate) {
        // just log it, should never be here
        window.log.warn("sendToGroup shouldn't have isPrivate.");
        jsonData.conversation = { number: conversationId };
      } else {
        jsonData.conversation = { gid: conversationId };
      }
    }

    // we just reuse notification.args.gid, as this is the groupV2Id
    this.server
      .sendMessageV3ToGroup(
        notification.args.gid,
        jsonData,
        this.timestamp,
        this.silent
      )
      .then(async response => {
        const { status, data } = response || {};
        if (status !== 0) {
          window.log.info('sendMessageV3ToGroup response status:', status);
        }

        // server must response data
        if (!data) {
          this.registerErrorEach(() =>
            makeReasonError('Server response empty data')
          );
          return;
        }

        const { API_STATUS } = window.Signal.Types.APIStatus;
        if (status === API_STATUS.MismatchedUsers) {
          const { missing, stale, extra } = data;

          let shouldRetry = false;

          // missing someone's key
          if (Array.isArray(missing) && missing.length) {
            const missingNumbers = missing.map(key => key?.uid);

            window.log.info('missing users:', missingNumbers);

            try {
              await this.doBatchUpdateCiphers(missingNumbers, () => missing);
              shouldRetry = true;
            } catch (error) {
              window.log.error('update ciphers for missing error', error);
              return;
            }

            this.missingNumbers = missingNumbers;

            this.numbers = Array.from(
              new Set([...this.numbers, ...this.missingNumbers])
            );
          }

          // someone has stale key
          if (Array.isArray(stale) && stale.length) {
            const staleNumbers = stale.map(key => key?.uid);

            window.log.info('stale users:', staleNumbers);

            try {
              await this.doBatchUpdateCiphers(staleNumbers, () => stale);
              shouldRetry = true;
            } catch (error) {
              window.log.error('update ciphers for stale error', error);
              return;
            }
          }

          if (shouldRetry) {
            return this.sendToGroup(tryTimes - 1);
          } else {
            if (extra) {
              this.extraNumbers = extra.map(key => key?.uid);
              window.log.info('extra users', this.extraNumbers);
            } else {
              throw new Error('Server responsed unexpected data');
            }
          }
        } else if (status === API_STATUS.UnsupportedEncLevel) {
          // unsuppported encryption level
          window.log.warn('sendMessageV3ToGroup unsupported encryption level');
        }

        const { unavailableUsers } = data;
        if (Array.isArray(unavailableUsers) && unavailableUsers.length) {
          window.log.warn('unavailable users:', unavailableUsers);
          for (const user of unavailableUsers) {
            const { uid, reason } = user;
            const error = new textsecure.UnavailableUserError(uid);
            this.registerError(uid, reason, error);
            this.unavailableNumbers.push(uid);
          }
        }

        this.sequenceId = data.sequenceId;
        this.serverTimestamp = data.systemShowTimestamp;
        this.notifySequenceId = data.notifySequenceId;

        this.numbers.forEach(number => {
          if (!this.unavailableNumbers.includes(number)) {
            this.successfulNumbers.push(number);
            this.numberCompleted();
          }
        });
      })
      .catch(e => {
        this.registerErrorEach(number => {
          let error;
          if (e.name === 'HTTPError') {
            if (e.code === 404) {
              error = new textsecure.UnregisteredUserError(number, e);
            } else if ([430, 431, 432].includes(e.code)) {
              error = new textsecure.ForbiddenUserError(number, e);
            } else {
              error = new textsecure.SendMessageNetworkError(
                number,
                jsonData,
                e,
                this.timestamp
              );
            }
          } else {
            error = new Error(e.message);
            error.stack = e.stack;
          }

          return makeReasonError('Send message to group failed.', error);
        });
      });
  },

  async sendToNumberV3(number, tryTimes = 3) {
    if (tryTimes <= 0) {
      this.registerError(number, 'Maximum retry attempts reached');
      return;
    }

    const { receiptMessage } = this.message;
    const notification = this.getNotificationForNumber();

    let sessionCipher;

    try {
      const { ciphers, errorMap } = await UserSessionCipher.batchLoadCiphers(
        [number],
        uids => this.server.getKeysV3ForUids(uids).then(data => data?.keys)
      );

      if (errorMap && Object.keys(errorMap).length) {
        this.registerError(number, errorMap[number]);
        return;
      }

      sessionCipher = ciphers[0];
    } catch (error) {
      this.registerError(number, 'load and update session error', error);
      return;
    }

    let content;
    const recipients = [];

    try {
      const plaintext = this.getPlaintext();
      const { cipherObject, receipt } = await sessionCipher.encrypt(plaintext);
      content = textsecure.EncryptedContent.encode(cipherObject);
      recipients.push(receipt);
    } catch (error) {
      this.registerError(number, 'Can not construct content', error);
    }

    const withLegacy = window.Signal.ID.isBotId(number);

    const jsonData = {
      type: textsecure.protobuf.Envelope.Type.ENCRYPTEDTEXT,
      content,
      legacyContent: withLegacy ? this.message.toBase64() : null,
      notification,
      readReceipt: receiptMessage instanceof textsecure.protobuf.ReceiptMessage,
      msgType: this.getMessageType(),
      detailMessageType: this.getDetailMessageType(),
      recipients,
    };

    const MessageType = textsecure.protobuf.Envelope.MsgType;
    if (jsonData.msgType === MessageType.MSG_SYNC_READ_RECEIPT) {
      const reads = this.message.syncMessage.read;
      jsonData.readPositions = reads.map(read => {
        const { readPosition } = read;
        return {
          groupId: readPosition.groupId ? this.extension?.conversationId : null,
          maxServerTime: readPosition.maxServerTimestamp,
          ..._.pick(readPosition, ['readAt', 'maxNotifySequenceId']),
        };
      });
    } else if (jsonData.msgType === MessageType.MSG_RECALL) {
      const { realSource } = this.message.dataMessage?.recall;
      if (realSource) {
        jsonData.realSource = {
          ...realSource,
        };
      }
    } else if (jsonData.msgType === MessageType.MSG_SYNC_PREVIEWABLE) {
      const { sent } = this.message.syncMessage;
      if (sent) {
        jsonData.realSource = {
          source: textsecure.storage.user.getNumber(),
          sourceDevice: parseInt(textsecure.storage.user.getDeviceId()),
          timestamp: sent.timestamp,
          serverTimestamp: sent.serverTimestamp,
          sequenceId: sent.sequenceId,
          notifySequenceId: sent.notifySequenceId,
        };
      }
    }

    const { isPrivate, conversationId } = this.extension || {};
    if (conversationId) {
      if (isPrivate) {
        jsonData.conversation = { number: conversationId };
      } else {
        jsonData.conversation = { gid: conversationId };
      }
    }

    this.server
      .sendMessageV3ToNumber(number, jsonData, this.timestamp, this.silent)
      .then(async response => {
        const { status, data } = response || {};
        if (status !== 0) {
          window.log.info('sendMessageV3ToNumber response status:', status);
        }

        if (!data) {
          this.registerError(number, 'Server response empty data');
          return;
        }

        const { API_STATUS } = window.Signal.Types.APIStatus;
        if (status === API_STATUS.MismatchedUsers) {
          const { stale } = data;
          if (Array.isArray(stale) && stale.length) {
            const staleNumbers = stale.map(key => key?.uid);

            window.log.info('stale user:', staleNumbers);

            try {
              await this.doBatchUpdateCiphers(staleNumbers, () => stale);
            } catch (error) {
              // already handle errors for every number
              return;
            }

            return this.sendToNumberV3(number, tryTimes - 1);
          } else {
            this.registerError(number, 'Bad stale data.');
          }
          return;
        } else if (status === API_STATUS.UnsupportedEncLevel) {
          //
          window.log.warn('sendMessageV3ToNumber unsupported encryption level');
        }

        this.sequenceIdMap[number] = data.sequenceId;
        this.serverTimestampMap[number] = data.systemShowTimestamp;
        this.notifySequenceIdMap[number] = data.notifySequenceId;

        this.successfulNumbers.push(number);
        this.numberCompleted();
      })
      .catch(e => {
        let error;
        if (e.name === 'HTTPError') {
          const conversation = ConversationController.get(number);
          if (conversation) {
            conversation.addTips(e.code);
          }

          // 404 should throw UnregisteredUserError
          // 430 should throw ForbiddenUserError
          // all other network errors can be retried later.
          if (e.code === 404) {
            error = new textsecure.UnregisteredUserError(number, e);
          } else if ([430, 431, 432].includes(e.code)) {
            error = new textsecure.ForbiddenUserError(number, e);
          } else {
            error = new textsecure.SendMessageNetworkError(
              number,
              jsonData,
              e,
              this.timestamp
            );
          }
        } else {
          error = e;
        }

        this.registerError(number, 'Send message to number failed.', error);
      });
  },
};
