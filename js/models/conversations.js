/* global
  _,
  i18n,
  Backbone,
  ConversationController,
  MessageController,
  libsignal,
  storage,
  textsecure,
  Whisper
*/

/* eslint-disable more/no-then */

// eslint-disable-next-line func-names
(function () {
  'use strict';

  window.Whisper = window.Whisper || {};

  const { Util } = window.Signal;
  const { Conversation, Contact, Errors, Message, PhoneNumber } =
    window.Signal.Types;
  const {
    upgradeMessageSchema,
    loadAttachmentData,
    getAbsoluteAttachmentPath,
    writeNewAttachmentData,
    deleteAttachmentData,
    loadForwardContextData,
  } = window.Signal.Migrations;

  const COLORS = [
    'red',
    'deep_orange',
    'brown',
    'pink',
    'purple',
    'indigo',
    'blue',
    'teal',
    'green',
    'light_green',
    'blue_grey',
  ];

  const INTERVAL = {
    ONE_DAY: 24 * 60 * 60,
  };

  // prettier-ignore
  const NOTIFICATION_SETTING = [
    'all',
    'atme',
    'none'
  ];

  // "avatar"
  // "flag"
  const CONTACT_FIXED_ATTRS = [
    'name',
    'email',
    'timeZone',
    'department',
    'superior',
    'address',
    'gender',
    'signature',
    'privateConfigs',
    'protectedConfigs',
    'publicConfigs',
    'remarkName',
    'sourceDescribe',
  ];

  const GROUP_FIXED_ATTRS = [
    'name',
    'messageExpiry',
    'invitationRule',
    'rejoin',
    'anyoneRemove',
    'linkInviteSwitch',
    'anyoneChangeName',
  ];

  // prettier-ignore
  const SUPPORTED_LANGUAGE_ARRAY = [
    { lang: 'off', name: 'Off' },
    { lang: 'en', name: 'English' },
    { lang: 'zh-CN', name: '中文' },
  ];

  const SUPPORTED_LANGUAGE_MAPPING = SUPPORTED_LANGUAGE_ARRAY.reduce(
    (p, c) => ({ ...p, [c.lang]: c.name }),
    {}
  );

  Whisper.Translate = {
    getSupportedLanguageArray() {
      return [...SUPPORTED_LANGUAGE_ARRAY];
    },
    shouldTranslate(targetLang) {
      return this.isSupported(targetLang) && !this.isTranslateOff(targetLang);
    },
    getOffValue() {
      return SUPPORTED_LANGUAGE_ARRAY[0].lang;
    },
    isTranslateOff(targetLang) {
      return this.getOffValue() === targetLang;
    },
    isSupported(targetLang) {
      return !!SUPPORTED_LANGUAGE_MAPPING[targetLang];
    },
    getMaxSupportedTextLength() {
      const MAX_SUPPORTED_TEXT_LEN = 4096;
      return MAX_SUPPORTED_TEXT_LEN;
    },
    exceedingMaxTextLengthError() {
      return 'exceedingMaxTranslatedTextLength';
    },
  };

  Whisper.Conversation = Backbone.Model.extend({
    storeName: 'conversations',
    defaults() {
      return {
        unreadCount: 0,
        verified: textsecure.storage.protocol.VerifiedStatus.DEFAULT,
      };
    },

    idForLogging() {
      if (this.isPrivate()) {
        return this.id;
      }

      return `group(${this.getGroupV2Id()})`;
    },

    handleMessageError(message, errors) {
      this.trigger('messageError', message, errors);
    },

    getContactCollection() {
      const collection = new Backbone.Collection();
      const collator = new Intl.Collator();

      const MENTIONS_ALL_ID = 'MENTIONS_ALL';

      collection.comparator = (left, right) => {
        if (left.id === MENTIONS_ALL_ID) {
          return -1;
        }

        if (right.id === MENTIONS_ALL_ID) {
          return 1;
        }

        if (left.role === 0) {
          return -1;
        }

        if (right.role === 0) {
          return 1;
        }

        if (left.isMe()) {
          return -1;
        }

        if (right.isMe()) {
          return 1;
        }

        const leftLower = left.getTitle().toLowerCase();
        const rightLower = right.getTitle().toLowerCase();
        return collator.compare(leftLower, rightLower);
      };
      return collection;
    },

    getThreadModelCollection() {
      const collection = new Backbone.Collection();
      collection.comparator = (left, right) => {
        const leftLastMessage = left.get('lastMessage');
        const rightLastMessage = right.get('lastMessage');

        // recall message was not in thread,
        // so using getServerTimestamp is good here
        return (
          rightLastMessage?.getServerTimestamp() -
          leftLastMessage?.getServerTimestamp()
        );
      };

      collection.hasLoadedFromDB = false;

      collection.addOrUpdateThread = (model, replace = false) => {
        const messages = Array.isArray(model) ? model : [model];

        const newThreads = [];
        for (const message of messages) {
          if (!(message instanceof Whisper.Message)) {
            continue;
          }

          if (message.isExpired()) {
            continue;
          }

          const threadId = message.get('threadId');
          if (!threadId) {
            continue;
          }

          // update exists
          const exists = collection.get(threadId);
          if (exists) {
            const lastMessage = exists.get('lastMessage');
            if (
              replace ||
              lastMessage.getServerTimestamp() < message.getServerTimestamp()
            ) {
              exists.set({ lastMessage: message });
            }

            continue;
          }

          // add new
          newThreads.push({ id: threadId, lastMessage: message });
        }

        if (!newThreads.length) {
          return;
        }

        collection.add(newThreads);
      };

      return collection;
    },

    getReadPositionCollection() {
      const collection = new Backbone.Collection();

      collection.comparator = (left, right) => {
        const leftMaxServerTimestamp = left.get('maxServerTimestamp');
        const rightMaxServerTimestamp = right.get('maxServerTimestamp');

        if (leftMaxServerTimestamp === rightMaxServerTimestamp) {
          const leftReadAt = left.get('readAt');
          const rightReadAt = right.get('readAt');

          return leftReadAt - rightReadAt;
        } else {
          return leftMaxServerTimestamp - rightMaxServerTimestamp;
        }
      };

      collection.on('update', (_, options) => {
        if (options?.add) {
          const { added } = options.changes;
          if (added?.length) {
            const addedCollection = new Backbone.Collection();
            addedCollection.comparator = collection.comparator;
            addedCollection.add(added);

            this.trigger('new-read-position', addedCollection);
          }
        }
      });

      collection.addPosition = position => {
        const addId = position => {
          const { sourceDevice, conversationId, maxServerTimestamp } = position;
          position.id = `${sourceDevice}-${conversationId}-${maxServerTimestamp}`;
        };

        const start = Date.now();

        let count = 0;
        if (Array.isArray(position)) {
          position.forEach(addId);
          count = position.length;
        } else {
          addId(position);
          count = 1;
        }

        const duration = Date.now() - start;

        window.log.info(
          `loaded positions ${count} in ${duration}ms`,
          this.idForLogging()
        );

        return collection.add(position);
      };

      return collection;
    },

    getCurrentDeviceId() {
      return parseInt(textsecure.storage.user.getDeviceId());
    },

    initialize() {
      this.ourNumber = textsecure.storage.user.getNumber();

      this.cacheMemberLastActive = {};
      //已读机密消息列表
      this.readConfidentiaMessageList = [];

      // This may be overridden by ConversationController.getOrCreate, and signify
      //   our first save to the database. Or first fetch from the database.
      this.initialPromise = Promise.resolve();

      this.contactCollection = this.getContactCollection();
      this.messageCollection = new Whisper.MessageCollection([], {
        conversation: this,
      });

      this.readPositionCollection = this.getReadPositionCollection();
      this.threadModelCollection = this.getThreadModelCollection();
      this.messageCollection.on('change:errors', this.handleMessageError, this);
      this.messageCollection.on('send-error', this.onMessageError, this);

      this.throttledForceUpdatePrivateContact = _.throttle(
        this.forceUpdatePrivateContact,
        10 * 1000
      );

      // update at first call immdiately and 1s after last call
      // and if having multiple calls whoes interval less than 1s
      // update every 2 seconds
      this.debouncedUpdateLastMessage = _lodash.debounce(
        () => setTimeout(this.updateLastMessage.bind(this), 0),
        1000,
        {
          leading: true,
          maxWait: 2000,
          trailing: true,
        }
      );

      this.listenTo(
        this.messageCollection,
        'remove',
        (model, collection, options) => {
          // removed a thread message
          const threadId = model.get('threadId');
          if (threadId) {
            const threadModel = this.threadModelCollection.get(threadId);

            //removed is last message of thread
            if (threadModel?.get('lastMessage').id === model.id) {
              let updatedLastMessage;
              if (collection.hasBottomLoaded()) {
                const threadMessages = collection.where({ threadId });
                if (threadMessages.length > 0) {
                  // replace thread last message
                  updatedLastMessage =
                    threadMessages[threadMessages.length - 1];
                }
              }

              if (updatedLastMessage) {
                this.threadModelCollection.addOrUpdateThread(
                  updatedLastMessage,
                  true
                );
              } else {
                // get last message of thread from db
                const loadLastThreadMessage = async () => {
                  try {
                    const messages =
                      await window.Signal.Data.getMessagesByConversation(
                        this.id,
                        {
                          limit: 2,
                          MessageCollection: Whisper.MessageCollection,
                          threadId,
                        }
                      );

                    let lastMessage = null;
                    if (messages.length) {
                      lastMessage = messages.last();

                      // removed message same with last message for removing delay
                      if (lastMessage.id === model.id) {
                        if (messages.length > 1) {
                          lastMessage = messages.first();
                        } else {
                          lastMessage = null;
                        }
                      }
                    }

                    if (lastMessage) {
                      messages.remove(lastMessage);
                      this.threadModelCollection.addOrUpdateThread(
                        MessageController.register(lastMessage.id, lastMessage),
                        true
                      );
                    } else {
                      this.threadModelCollection.remove(threadId);
                    }
                  } catch (error) {
                    log.error('get thread message from db error', error);
                  }
                };

                // do not wait
                loadLastThreadMessage();
              }
            }
          }

          if (!collection.hasBottomLoaded()) {
            return;
          }

          // if removed was not the last message
          if (collection.length !== options?.index) {
            return;
          }

          if (
            model.getServerTimestamp() !== this.get('latestMessageTimestamp')
          ) {
            return;
          }

          // removed was the last message
          // and latestMessageTimestamp is same with serverTimestamp
          this.unset('latestMessageTimestamp');
          window.Signal.Data.updateConversation(this.attributes);
        }
      );

      this.listenTo(
        this.messageCollection,
        'add remove destroy',
        this.debouncedUpdateLastMessage
      );
      this.listenTo(this.messageCollection, 'sent', this.updateLastMessage);
      this.listenTo(
        this.messageCollection,
        'send-error',
        this.updateLastMessage
      );

      this.on('newmessage', this.onNewMessage);
      this.on('change:profileKey', this.onChangeProfileKey);

      // Listening for out-of-band data updates
      this.on('read', message => this.updateAndMerge(message, false));
      this.on('expiration-change', message =>
        this.updateAndMerge(message, false)
      );
      this.on('expired', this.onExpired);
      this.on('recalled', this.onRecalled);
      this.on('check-archive', this.onCheckArchive);

      this.on('change:members change:membersV2', () =>
        this.fetchContacts(true)
      );

      // update at first call immdiately and 5s after last call
      // and do not call bettween them
      this.debouncedUpdateCommonAvatar = _lodash.debounce(
        () => setTimeout(this.updateCommonAvatar.bind(this), 0),
        5000,
        {
          leading: true,
          trailing: true,
        }
      );

      this.on('change:commonAvatar', async () => {
        console.log(
          '--------- commonAvatar changed:',
          _.pick(this.get('commonAvatar') || {}, ['id', 'attachmentId']),
          this.idForLogging()
        );
        await this.updateCommonAvatar();
      });

      // Keep props ready
      const generateProps = () => {
        this.cachedProps = this.getProps();
      };
      this.on('change change:directoryUser change:commonAvatar', generateProps);
      generateProps();
    },

    updateMemberLastActive(number, timestamp) {
      if (this.isPrivate() || !number) {
        window.log.warn('update user LastActive failed!', number, timestamp);
        return;
      }

      const oldTimestamp = this.cacheMemberLastActive?.[number] || 0;
      if (oldTimestamp < timestamp) {
        this.cacheMemberLastActive[number] = timestamp;
      } else {
        window.log.warn(
          'update user LastActive timestamp failed, cache timestamp bigger than latest',
          number,
          timestamp
        );
      }
    },

    getCacheMemberLastActive() {
      return this.cacheMemberLastActive;
    },
    setCacheMemberLastActive(newCache) {
      this.cacheMemberLastActive = newCache;
    },

    isMe() {
      return this.id === this.ourNumber;
    },

    groupV2RoleCompare(number, role) {
      // TODO:// cache admin members.
      const membersV2 = this.get('membersV2') || [];
      const model = membersV2.filter(m => m.id === number);
      if (model && model[0] && model[0].role === role) {
        return true;
      }

      return false;
    },

    isGroupV2RoleOwner(number) {
      return this.groupV2RoleCompare(number, 0);
    },

    isGroupV2RoleAdmin(number) {
      return this.groupV2RoleCompare(number, 1);
    },

    isGroupV2RoleMember(number) {
      return this.groupV2RoleCompare(number, 2);
    },

    isMeGroupV2Owner() {
      return this.isGroupV2RoleOwner(this.ourNumber);
    },

    isMeGroupV2Admin() {
      return this.isGroupV2RoleAdmin(this.ourNumber);
    },

    isAnyoneCanRemove() {
      return this.get('anyoneRemove');
    },
    isMeCanSpeak() {
      if (
        this.get('publishRule') !== 2 &&
        !this.isPrivate() &&
        !this.isMeGroupV2Admin() &&
        !this.isMeGroupV2Owner()
      ) {
        return false;
      } else {
        return true;
      }
    },

    async cleanup() {
      await window.Signal.Types.Conversation.deleteExternalFiles(
        this.attributes,
        {
          deleteAttachmentData,
        }
      );
    },

    async updateAndMerge(message, updateLastMessage = true) {
      if (updateLastMessage) {
        this.debouncedUpdateLastMessage();
      }

      const mergeMessage = () => {
        const existing = this.messageCollection.get(message.id);
        if (!existing) {
          return;
        }

        existing.merge(message.attributes);
      };

      await this.inProgressFetch;
      mergeMessage();
    },

    async onExpired(message) {
      const removeMessage = () => {
        const { id } = message;
        const existing = this.messageCollection.get(id);
        if (!existing) {
          return;
        }

        window.log.info('Remove expired message from collection', {
          sentAt: existing.get('sent_at'),
        });

        this.messageCollection.remove(id);
        existing.trigger('expired');
      };

      // If a fetch is in progress, then we need to wait until that's complete to
      //   do this removal. Otherwise we could remove from messageCollection, then
      //   the async database fetch could include the removed message.

      await this.inProgressFetch;
      removeMessage();

      // update last message after remove
      await this.debouncedUpdateLastMessage();
    },

    async onRecalled(message) {
      await this.debouncedUpdateLastMessage();

      // remove recalled message from messageCollection
      const removeMessage = async () => {
        const { id } = message;
        const existing = this.messageCollection.get(id);
        if (!existing) {
          return;
        }

        window.log.info('Remove recalled message from collection', {
          sentAt: existing.get('sent_at'),
        });

        this.messageCollection.remove(id);
        //删除message
        await window.Signal.Data.removeMessage(id, {
          Message: Whisper.Message,
        });
        existing.trigger('recalled');
      };

      // If a fetch is in progress, then we need to wait until that's complete to
      //   do this removal. Otherwise we could remove from messageCollection, then
      //   the async database fetch could include the removed message.
      await this.inProgressFetch;
      removeMessage();
    },

    async recallMessage(recalledMessage) {
      if (!recalledMessage.isOutgoing()) {
        throw new Error('can only recall outgoing message.');
      }

      const globalConfig = window.getGlobalConfig();
      const recallConfig = globalConfig.recall;

      const targetBody =
        recalledMessage.isForwardMessage() ||
        recalledMessage.isRecallMessage() ||
        recalledMessage.isContactMessage()
          ? ''
          : recalledMessage.get('body') || '';

      const recall = {
        realSource: {
          source: recalledMessage.getSource(),
          sourceDevice: recalledMessage.getSourceDevice(),
          timestamp: recalledMessage.get('sent_at'),
          serverTimestamp: recalledMessage.getServerTimestamp(),
          sequenceId: recalledMessage.get('sequenceId'),
          notifySequenceId: recalledMessage.get('notifySequenceId'),
        },
        target: {
          id: recalledMessage.get('id'),
          body: targetBody,
          sent_at: recalledMessage.get('sent_at'),
          rapidFiles: recalledMessage.get('rapidFiles') || [],
          received_at: recalledMessage.get('received_at'),
          atPersons: recalledMessage.get('atPersons'),
          serverTimestamp: recalledMessage.getServerTimestamp(),
          sequenceId: recalledMessage.get('sequenceId'),
          notifySequenceId: recalledMessage.get('notifySequenceId'),
        },
        editableTimer: recallConfig.editableInterval,
      };

      const atPersons = (recalledMessage.get('atPersons') || '').split(';');
      const { author: quotedAuthor } = recalledMessage.get('quote') || {};
      const extension = {
        recall: {
          atPersons: atPersons,
          quotedAuthor,
          collapseId: this.makeMessageCollapseId(recall.realSource),
        },
      };

      const message = await this.forceSendMessageAuto(
        '',
        null,
        [],
        null,
        null,
        extension,
        null,
        null,
        recall
      );

      recalledMessage.set({
        recalled: {
          byId: message.get('id'),
        },
      });

      await window.Signal.Data.saveMessage(recalledMessage.attributes, {
        Message: Whisper.Message,
      });
    },

    async onNewMessage(message) {
      await this.debouncedUpdateLastMessage();

      this.set({ isArchived: false });

      if (this.hasChanged()) {
        await window.Signal.Data.updateConversation(this.attributes);
      }
    },

    addSingleMessage(message, loadOptions) {
      const Message = Whisper.Message;
      const model = message instanceof Message ? message : new Message(message);

      model.setToExpire();

      log.info('addSingleMessage', model.idForLogging());

      return this.messageCollection.addNewMessage(model, loadOptions);
    },

    format() {
      return this.cachedProps;
    },
    getUidBase58() {
      if (this.isPrivate()) {
        return window.Signal.Util.getBase58Id(this.id);
      } else {
        return '';
      }
    },
    getFakeName() {
      return window.Signal.Util.getFakeName(this.getNumber());
    },

    getProps() {
      const { format } = PhoneNumber;
      const regionCode = storage.get('regionCode');
      const color = this.getColor();

      const timestamp = this.get('timestamp');

      const result = {
        id: this.id,
        uid: this.getUidBase58(),
        joinedAt: this.get('joinedAt') ? this.get('joinedAt') : '',
        met: this.get('sourceDescribe'),
        //追加是否是好友
        directoryUser: this.isDirectoryUser(),
        isArchived: this.get('isArchived'),
        activeAt: this.get('active_at'),
        avatarPath: this.getAvatarPath(),
        color,
        type: this.isPrivate() ? 'direct' : 'group',
        isMe: this.isMe(),
        isTyping: false,
        lastUpdated: timestamp,
        name: this.getName(),
        accountName: this.getAccountName(),
        remarkName: this.getRemarkName(),
        profileName: this.getProfileName(),
        timestamp,
        title: this.getTitle(),
        unreadCount: this.getDisplayUnreadCount(),
        email: this.get('email'),
        isStick: this.get('isStick'),
        timeZone: this.get('timeZone'),
        signature: this.get('signature'),
        notificationSetting: this.get('notification_setting'),
        isMute: this.get('isMute'),
        isMeCanSpeak: this.isMeCanSpeak(),
        //判断是否是群主
        isGroupV2Owner: this.isMeGroupV2Owner(),

        phoneNumber: format(this.id, {
          ourRegionCode: regionCode,
        }),
        lastMessage: {
          status: this.get('lastMessageStatus'),
          text: this.get('lastMessage'),
        },
        atPersons: this.get('atPersons') || '',
        directoryUser: this.isPrivate() ? this.get('directoryUser') : undefined,
        members: this.isPrivate() ? null : this.get('members'),
        privateConfigs: this.get('privateConfigs'),
        protectedConfigs: this.get('protectedConfigs'),
        publicConfigs: this.get('publicConfigs'),
        markAsRead: this.markAsRead.bind(this),
        markAsUnread: this.markAsUnread.bind(this),
        draft: this.get('draft'),
        draftQuotedMessageId: this.get('draftQuotedMessageId'),
        isAliveGroup: this.isAliveGroup(),
        expireTimer: this.getConversationMessageExpiry(),
      };

      return result;
    },

    onMessageError() {
      // on error
    },
    async addTips(code) {
      if (![404, 430, 431, 432].includes(code)) {
        return;
      }

      const timestamp = Date.now();
      const lastTimestamp = this.get('timestamp') || timestamp;

      window.log.info(
        'adding tips for',
        this.idForLogging(),
        code,
        this.get('timestamp'),
        lastTimestamp
      );

      const message = new Whisper.Message({
        conversationId: this.id,
        type: 'tips',
        code,
        sent_at: lastTimestamp,
        received_at: timestamp,
        serverTimestamp: lastTimestamp,
        expireTimer: this.getConversationMessageExpiry(),
      });

      const id = await window.Signal.Data.saveMessage(message.attributes, {
        Message: Whisper.Message,
      });

      message.set({ id });
      MessageController.register(message.id, message);

      this.trigger('newmessage', message);
    },

    async onReadMessage(message) {
      // We mark as read everything older than this message - to clean up old stuff
      //   still marked unread in the database. If the user generally doesn't read in
      //   the desktop app, so the desktop app only gets read syncs, we can very
      //   easily end up with messages never marked as read (our previous early read
      //   sync handling, read syncs never sent because app was offline)

      // We queue it because we often get a whole lot of read syncs at once, and
      //   their markRead calls could very easily overlap given the async pull from DB.

      // Lastly, we don't send read syncs for any message marked read due to a read
      //   sync. That's a notification explosion we don't need.
      // return this.queueJob(() =>
      //   this.markRead(message.get('received_at'), {
      //     sendReadReceipts: false,
      //     readAt,
      //   })
      // );

      this.markReadAtMessage(message, Date.now(), { sendReadReceipts: false });
    },

    async markReadAtMessage(message, readAt, options) {
      const readPosition = {
        sourceDevice: this.getCurrentDeviceId(),
        conversationId: this.id,
        sender: message.getSource(),
        sentAt: message.get('sent_at'),
        readAt: readAt || Date.now(),
        maxServerTimestamp: message.getServerTimestamp(),
        messageType: message.get('type'),
        maxNotifySequenceId: message.get('notifySequenceId'),
      };

      await this.markRead(readPosition, options);
    },

    async onReadPosition(readPosition) {
      const markAsAt = this.get('markAsAt');

      if (!markAsAt || readPosition.maxServerTimestamp >= markAsAt) {
        this.unset('markAsFlag');
      }

      await this.markRead(readPosition, {
        sendReadReceipts: false,
        savePosition: true,
      });
    },

    validate(attributes) {
      const required = ['id', 'type'];
      const missing = _.filter(required, attr => !attributes[attr]);
      if (missing.length) {
        return `Conversation must have ${missing}`;
      }

      if (attributes.type !== 'private' && attributes.type !== 'group') {
        return `Invalid conversation type: ${attributes.type}`;
      }

      return null;
    },

    queueJob(callback) {
      const previous = this.pending || Promise.resolve();

      const taskWithTimeout = textsecure.createTaskWithTimeout(
        callback,
        `conversation ${this.idForLogging()}`
      );

      this.pending = previous.then(taskWithTimeout, taskWithTimeout);
      const current = this.pending;

      current.then(() => {
        if (this.pending === current) {
          delete this.pending;
        }
      });

      return current;
    },

    getRecipients() {
      if (this.isPrivate()) {
        return [this.id];
      }

      const me = textsecure.storage.user.getNumber();
      const members = Array.from(new Set(this.get('members')));
      return _.without(members, me);
    },

    async getQuoteAttachment(attachments) {
      if (attachments && attachments.length) {
        return Promise.all(
          attachments
            .filter(
              attachment =>
                attachment && !attachment.pending && !attachment.error
            )
            .slice(0, 1)
            .map(async attachment => {
              const { fileName, thumbnail, contentType, flags } = attachment;

              return {
                flags,
                contentType,
                // Our protos library complains about this field being undefined, so we
                //   force it to null
                fileName: fileName || null,
                thumbnail: thumbnail
                  ? {
                      ...(await loadAttachmentData(thumbnail)),
                      objectUrl: getAbsoluteAttachmentPath(thumbnail.path),
                    }
                  : null,
              };
            })
        );
      }

      return [];
    },

    async makeQuote(quotedMessage) {
      const { text, attachments } = quotedMessage.prepareForQuoted();
      const quthorContact = quotedMessage.getContact() || {};
      return {
        author: quthorContact.id,
        id: quotedMessage.get('sent_at'),
        text: text || '',
        attachments: await this.getQuoteAttachment(attachments),
        messageMode: quotedMessage.get('messageMode'),
      };
    },

    async getForwardedForwards(forwards, depth, maxDepth) {
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
        forwards.map(async forward => {
          const { forwards: nextForwards, attachments } = forward || {};
          const forwardAttachments = attachments || [];

          let newForward = {};

          if (depth === maxDepth && nextForwards && nextForwards.length > 0) {
            // already at maxDepth
            // but nextForwards still have values
            newForward.type = textsecure.protobuf.DataMessage.Forward.Type.EOF;
            newForward.body = i18n('messageCannotBeDisplayedTip');
            newForward.forwards = [];
          } else {
            newForward.attachments = await Promise.all(
              forwardAttachments.map(async attachment => {
                try {
                  return await loadAttachmentData(attachment);
                } catch (error) {
                  log.warn('forward without data 2', Errors.toLogFormat(error));
                  return { ...attachment };
                }
              })
            );

            newForward.forwards = await this.getForwardedForwards(
              nextForwards,
              depth,
              maxDepth
            );
          }

          return {
            ...forward,
            ...newForward,
            uuid: window.getGuid(),
          };
        })
      );
    },

    async makeForward(message) {
      const { forwards } = message.get('forwardContext') || {};
      const attachments = message.get('attachments') || [];
      const contacts = message.get('contacts') || [];
      const task = message.get('task');
      const vote = message.get('vote');
      const card = message.get('card');
      const mentions = message.get('mentions');

      let body = message.get('body') || '';
      if (contacts && contacts.length) {
        body = '[Contact Card]';
      }
      if (task) {
        body = '[Task]';
      }
      if (vote) {
        body = '[Poll]';
      }

      return {
        id: message.get('sent_at'),
        uuid: window.getGuid(),
        type: textsecure.protobuf.DataMessage.Forward.Type.NORMAL,
        isFromGroup: message.isGroupMessage(),
        author: message.getSource(),
        body,
        card,
        attachments: await Promise.all(
          attachments.map(async attachment => {
            try {
              return await loadAttachmentData(attachment);
            } catch (error) {
              log.warn('forwarding without data 1', Errors.toLogFormat(error));
              return { ...attachment };
            }
          })
        ),
        forwards: await this.getForwardedForwards(forwards || []),
        mentions,
      };
    },

    async makeForwardContext(forwardedMessages) {
      return {
        forwards: await Promise.all(
          forwardedMessages.map(this.makeForward.bind(this))
        ),
      };
    },

    async forceUpdateSessionV2(session) {
      this.userSessionV2 = session;
    },

    async loadSessionV2() {
      if (this.userSessionV2) {
        return;
      }

      if (this.isPrivate()) {
        const uid = this.get('id');
        const userSession = await window.Signal.Data.getSessionV2ById(uid);

        // 如果没有session，就发起网络请求
        if (!userSession?.identityKey) {
          const userKeys = await window
            .getAccountManager()
            .getKeysV3ForUids([uid]);
          if (Array.isArray(userKeys?.keys) && userKeys.keys.length) {
            const session = userKeys.keys[0];
            if (session?.uid && session?.identityKey) {
              // 保存 session
              await window.Signal.Data.createOrUpdateSessionV2({
                ...session,
              });
              this.userSessionV2 = session;
            }
          }
        } else {
          this.userSessionV2 = userSession;
        }
      }
    },

    // add extension to save call message status.
    async sendMessage(
      body,
      atPersons,
      mentions,
      attachments,
      quote,
      extension,
      forwardContext,
      contacts,
      recall,
      options
    ) {
      await this.loadSessionV2();
      this.markAsRead();

      const task = null;
      const vote = null;
      const card = null;
      const { threadContext, freeConfidential } = options || {};

      const destination = this.id;
      // const expireTimer = this.get('expireTimer');
      const recipients = this.getRecipients();

      this.unBlockBySendMessage();

      let profileKey;
      if (this.get('profileSharing')) {
        profileKey = storage.get('profileKey');
      }

      await new Promise(r => setTimeout(r, 10));
      const now = Date.now();

      window.log.info(
        'Sending message to conversation',
        this.idForLogging(),
        threadContext?.topicId || '',
        'with timestamp',
        now
      );

      const globalConfig = window.getGlobalConfig();
      let expireTimer = this.getConversationMessageExpiry(globalConfig);

      const recallConfig = globalConfig.recall;
      const recallableTimer = recallConfig.timeoutInterval;

      // outgoing message do not be auto translated
      // const translateLang = this.getTranslateLang();
      const translateLang = Whisper.Translate.getOffValue();

      // convert confidentialMode to messageMode
      const messageMode =
        this.get('confidentialMode') && !freeConfidential
          ? window.textsecure.protobuf.Mode.CONFIDENTIAL
          : window.textsecure.protobuf.Mode.NORMAL;

      const messageWithSchema = await upgradeMessageSchema({
        source: this.ourNumber,
        sourceDevice: this.getCurrentDeviceId(),
        type: 'outgoing',
        body,
        atPersons,
        mentions,
        conversationId: destination,
        quote,
        attachments,
        sent_at: now,
        received_at: now,
        serverTimestamp: now,
        expireTimer,
        recipients,
        extension,
        forwardContext,
        contacts,
        recall,
        recallableTimer,
        translateLang,
        task,
        vote,
        card,
        threadContext,
        messageMode,
      });

      if (this.isPrivate()) {
        messageWithSchema.destination = destination;
      }

      const attributes = {
        ...messageWithSchema,
        id: window.getGuid(),
      };

      const { model } = this.addSingleMessage(attributes, {
        atViewBottom: true,
      });
      const message = MessageController.register(model.id, model);

      if (threadContext) {
        if (threadContext.topicId) {
          // /topic生成的topic要传source || group@bot topic
          const { isUseTopicCommand, isAtBotTopic } = options;
          if (isUseTopicCommand || isAtBotTopic) {
            threadContext.source = {
              timestamp: message.get('sent_at'),
              source: message.getSource(),
              sourceDevice: message.getSourceDevice(),
            };

            message.set({
              threadContext: _lodash.cloneDeep(threadContext),
              isUseTopicCommand: !!isUseTopicCommand,
              isAtBotTopic: !!isAtBotTopic,
            });
          } else {
            // 其他情况
          }

          // 回复/topic生成的topic和回复@bot生成的topic
          message.set({
            threadId: threadContext.topicId,
            threadReplied: true,
          });
        } else {
          // update this message's threadId
          message.set({
            threadReplied: true,
            threadId: message.makeThreadId(threadContext),
          });
        }
      }

      const collapseId = this.makeMessageCollapseId({
        timestamp: now,
        source: message.getSource(),
        sourceDevice: message.getSourceDevice(),
      });

      message.set({
        extension: {
          ...message.attributes.extension,
          collapseId,
          deliveryScope: 'all', // to all recipients of the conversation
          isPrivate: this.isPrivate(),
          conversationId: this.isPrivate() ? this.id : this.getGroupV2Id(),
          sessionV2: this.userSessionV2, // 如果是空的，发消息时需先请求server
        },
      });

      await window.Signal.Data.saveMessage(message.attributes, {
        forceSave: true,
        Message: Whisper.Message,
      });

      this.set({
        // active_at: now,
        isArchived: false,
        draft: null,
        draftAtPersons: '',
        draftAtMentions: [],
        draftQuotedMessageId: null,
        latestMessageTimestamp: null,
      });

      //这里是处理recall,去除recall使会话置顶的情况
      if (!recall) {
        this.set({
          lastMessage: model.getNotificationText(),
          lastMessageStatus: 'sending',
          timestamp: now,
          active_at: now,
        });
      }

      await window.Signal.Data.updateConversation(this.attributes);

      // We're offline!
      if (!textsecure.messaging) {
        const errors = this.contactCollection.map(contact => {
          const error = new Error('Network is not available');
          error.name = 'SendMessageNetworkError';
          error.number = contact.id;
          return error;
        });
        await message.saveErrors(errors);
        return message;
      }

      const attachmentsWithData = await Promise.all(
        messageWithSchema.attachments.map(loadAttachmentData)
      );

      const { body: messageBody, attachments: finalAttachments } =
        Whisper.Message.getLongMessageAttachment({
          body,
          attachments: attachmentsWithData,
          now,
        });

      const finalForward = await loadForwardContextData(
        messageWithSchema.forwardContext
      );

      let dataMessage;
      try {
        if (this.isMe()) {
          dataMessage = await textsecure.messaging.getMessageProto(
            destination,
            messageBody,
            mentions,
            finalAttachments,
            quote,
            now,
            expireTimer,
            profileKey,
            null,
            finalForward,
            contacts,
            recall,
            task,
            vote,
            card,
            threadContext,
            messageMode
          );
        } else {
          const conversationType = this.get('type');
          switch (conversationType) {
            case Message.PRIVATE:
              dataMessage = await textsecure.messaging.getMessageToNumberProto(
                destination,
                messageBody,
                mentions,
                atPersons,
                finalAttachments,
                quote,
                now,
                expireTimer,
                profileKey,
                finalForward,
                contacts,
                recall,
                task,
                vote,
                card,
                threadContext,
                messageMode
              );
              break;
            case Message.GROUP:
              const groupNumbers = recipients;
              dataMessage = await textsecure.messaging.getMessageToGroupProto(
                destination,
                groupNumbers,
                messageBody,
                mentions,
                atPersons,
                finalAttachments,
                quote,
                now,
                expireTimer,
                profileKey,
                finalForward,
                contacts,
                recall,
                task,
                vote,
                card,
                threadContext,
                messageMode
              );
              break;
            default:
              throw new TypeError(
                `Invalid conversation type: '${conversationType}'`
              );
          }
        }
      } catch (error) {
        window.log.error(
          'get message proto failed,',
          error,
          message.idForLogging()
        );
        const errors = this.contactCollection.map(contact => {
          const err = new Error(error.message);
          err.name = 'OutgoingMessageError';
          err.number = contact.id;
          return err;
        });
        await message.saveErrors(errors);
        return message;
      }

      window.log.info(
        'Sending message',
        message.get('sent_at'),
        message.get('threadId') || '',
        this.idForLogging()
      );

      this.queueJob(async () => {
        if (this.isMe()) {
          return message.sendSyncMessageOnly(dataMessage);
        } else {
          return message.send(
            textsecure.messaging.sendMessageProtoNoSilent(
              dataMessage,
              message.get('extension')
            )
          );
        }
      });

      return message;
    },

    async forceSendMessageAuto(
      body,
      atPersons,
      mentions,
      attachments,
      quote,
      extension,
      forwardContext,
      contacts,
      recall,
      options
    ) {
      try {
        if (!this.isPrivate() && !this.isAliveGroup()) {
          throw new Error('can not send messages in a group not alive');
        }

        return this.sendMessage(
          body?.trim(),
          atPersons,
          mentions,
          attachments,
          quote,
          extension,
          forwardContext,
          contacts,
          recall,
          options
        );
      } catch (error) {
        window.log.error(
          'forceSendMessageAuto error:',
          error && error.stack ? error.stack : error,
          this.idForLogging()
        );
      }
    },
    async updateLastMessage() {
      if (!this.id) {
        return;
      }

      // only group update mentions
      if (!this.isPrivate()) {
        await this.updateLastMentions();
      }

      let lastMessageModel;
      if (this.hasBottomLoaded(false)) {
        lastMessageModel = this.messageCollection.reduceRight((prev, curr) => {
          if (
            curr?.isRecallMessage() ||
            curr?.isExpired() ||
            prev?.getServerTimestamp() > curr?.getServerTimestamp()
          ) {
            return prev;
          }

          return curr;
        }, null);
      }

      if (!lastMessageModel) {
        let serverTimestamp;
        if (this.hasBottomLoaded(false)) {
          serverTimestamp = this.messageCollection.getServerTimestampForLoad(
            true,
            false
          );
        }

        let round = 0;
        do {
          const messages = await window.Signal.Data.getMessagesByConversation(
            this.id,
            {
              limit: 10,
              MessageCollection: Backbone.Collection.extend({
                model: Whisper.Message,
                comparator(left, right) {
                  return left.getServerTimestamp() - right.getServerTimestamp();
                },
              }),
              serverTimestamp,
            }
          );

          if (!messages.length) {
            break;
          }

          const startPos = messages.first().getServerTimestamp();
          const endPos = messages.last().getServerTimestamp();

          try {
            await this.loadReadPositions(startPos, endPos);
          } catch (error) {
            log.info(
              'load read positons failed for ',
              this.idForLogging(),
              startPos,
              endPos,
              Errors.toLogFormat(error)
            );
          }

          const index = messages.findLastIndex(model => {
            model.correctExpireTimer();
            return !model.isExpired() && !model.isRecallMessage();
          });
          if (index !== -1) {
            lastMessageModel = messages.at(index);
            break;
          }

          round++;
          serverTimestamp = messages.at(0).getServerTimestamp();
        } while (round <= 5);
      }

      const lastMessageJSON = lastMessageModel
        ? lastMessageModel.toJSON()
        : null;
      const lastMessageStatusModel = lastMessageModel
        ? lastMessageModel.getMessagePropStatus()
        : null;
      const lastMessageUpdate = Conversation.createLastMessageUpdate({
        currentTimestamp: this.get('timestamp') || null,
        lastMessage: lastMessageJSON,
        lastMessageStatus: lastMessageStatusModel,
        lastMessageNotificationText: lastMessageModel
          ? lastMessageModel.getNotificationText()
          : null,
        lastMessageVersion: 1,
      });

      const latestMessageTimestamp = this.get('latestMessageTimestamp');
      if (latestMessageTimestamp) {
        const updateTimestamp = lastMessageUpdate.timestamp;
        if (!updateTimestamp) {
          // last message is empty -> empty conversation
          //
          if (this.hasNewerUnloadedRemoteMessages()) {
            // 1. has unloaded new remote messages, should skip updating
            return;
          } else {
            // 2. has no message, should do update
          }
        } else if (updateTimestamp < latestMessageTimestamp) {
          // updating message is older than the latest
          if (
            updateTimestamp === this.get('timestamp') &&
            lastMessageUpdate.lastMessage === this.get('lastMessage')
          ) {
            // force update if needed when it has same last message
          } else {
            // should skip updating
            return;
          }
        } else {
          // updating messages is equal or newer than the latest
          // should do update
        }
      }

      // Because we're no longer using Backbone-integrated saves, we need to manually
      //   clear the changed fields here so our hasChanged() check below is useful.
      this.changed = {};
      // maybe update timestamp
      this.set(lastMessageUpdate);

      if (this.hasChanged()) {
        await window.Signal.Data.updateConversation(this.attributes);
      }
    },
    async setArchived(isArchived) {
      this.trigger('unload', 'archive');
      const flagArchive =
        textsecure.protobuf.SyncMessage.ConversationArchive.Flag.ARCHIVE;
      await this.syncArchiveConversation(flagArchive);
      this.set({
        isArchived,
        draft: null,
        draftAtPersons: '',
        draftAtMentions: [],
        isStick: undefined,
      });
      this.markAsRead();
      await window.Signal.Data.updateConversation(this.attributes);
    },

    // before call createGroup, conversation must be created with a id
    // ConversationController.getOrCreate...
    // To create V1 group, caller should generate a random 16 bytes id
    // To create V2 group, the CreateGroupV2 API should be called firstly to
    // obtain the groupId from server.

    async createGroup(providedGroupUpdate) {
      let groupUpdate = providedGroupUpdate;

      if (this.isPrivate()) {
        throw new Error('Called update group on private conversation');
      }

      if (groupUpdate === undefined) {
        groupUpdate = this.pick(['name', 'avatar', 'members']);
      }

      const now = Date.now();

      // because iOS do not handle group update message
      // we do sync by send self a normal message,
      // so, set 'synced' = true to do not send sync message.
      const message = new Whisper.Message({
        conversationId: this.id,
        // type: 'outgoing',
        sent_at: now,
        received_at: now,
        group_update: {
          ...groupUpdate,
          joined: groupUpdate.members,
        },
        synced: true,
        serverTimestamp: now,
        expireTimer: this.getConversationMessageExpiry(),
      });

      const id = await window.Signal.Data.saveMessage(message.attributes, {
        Message: Whisper.Message,
      });
      message.set({ id });

      this.trigger('newmessage', message);

      // changed: do not need to send signal message for group change
      // changed: available temporarily
      // new group: do not need to send message any more.

      // send null message to get serverTimestamp for local message
      const extension = {
        isPrivate: this.isPrivate(),
        conversationId: this.isPrivate() ? this.id : this.getGroupV2Id(),
      };
      message.send(textsecure.messaging.syncNullMessage(extension));
    },

    async updateGroup(providedGroupUpdate, members, targetNumbers) {
      if (this.isPrivate()) {
        throw new Error('Called update group on private conversation');
      }

      // disband group don't send message
      if (providedGroupUpdate.disbanded) {
        return;
      }

      let groupUpdate = providedGroupUpdate;
      if (groupUpdate === undefined) {
        groupUpdate = this.pick(['name', 'avatar', 'members']);
      }

      const now = Date.now();
      const message = new Whisper.Message({
        conversationId: this.id,
        // type: 'outgoing',
        sent_at: now,
        received_at: now,
        group_update: groupUpdate,
        synced: true,
        serverTimestamp: now,
        expireTimer: this.getConversationMessageExpiry(),
      });

      const id = await window.Signal.Data.saveMessage(message.attributes, {
        Message: Whisper.Message,
      });
      message.set({ id });

      this.trigger('newmessage', message);

      // changed: do not need to send signal message for group change
      // changed: available temporarily
      // new Group: do not need to send message anymore

      // send null message to get serverTimestamp for local message
      const extension = {
        isPrivate: this.isPrivate(),
        conversationId: this.isPrivate() ? this.id : this.getGroupV2Id(),
      };
      message.send(textsecure.messaging.syncNullMessage(extension));
    },

    async leaveGroup(groupNumbers) {
      if (this.isPrivate()) {
        throw new Error('Called update group on private conversation');
      }

      const now = Date.now();
      const message = new Whisper.Message({
        group_update: { left: 'You' },
        conversationId: this.id,
        // type: 'outgoing',
        sent_at: now,
        received_at: now,
        synced: true,
        serverTimestamp: now,
        expireTimer: this.getConversationMessageExpiry(),
      });

      const id = await window.Signal.Data.saveMessage(message.attributes, {
        Message: Whisper.Message,
      });
      message.set({ id });

      this.trigger('newmessage', message);

      // changed: do not need to send signal message for group change
      // changed: available temporarily
      // new Group: do not need to send message any more

      // send null message to get serverTimestamp for local message
      const extension = {
        isPrivate: this.isPrivate(),
        conversationId: this.isPrivate() ? this.id : this.getGroupV2Id(),
      };
      message.send(textsecure.messaging.syncNullMessage(extension));
    },

    async leaveGroupV2() {
      const fullMembers = this.get('members');

      try {
        // call GroupV2API and update membersV2
        await this.apiRemoveGroupV2Members([this.ourNumber]);
        await this.destroyMessages(true);
        let membersV2 = this.get('membersV2');

        this.set({
          members: membersV2.map(m => m.id),
          left: true,
          // active_at: Date.now(),
          isArchived: false,
        });

        await window.Signal.Data.updateConversation(this.attributes);

        await this.leaveGroup(fullMembers);
        this.trigger('unload', 'leave group');
      } catch (error) {
        log.error('leaveGroupV2 failed, ', error);
        throw new Error('leaveGroupV2 failed.');
      }
    },

    async disbandGroupV2() {
      const fullMembers = this.get('members');
      const membersV2 = this.get('membersV2');
      let isDisbandByOwner = false;
      for (let i = 0; i < membersV2.length; i++) {
        if (
          membersV2[i].id === this.ourNumber &&
          (membersV2[i].role === 0 || membersV2[i].role === 1)
        ) {
          isDisbandByOwner = true;
        }
      }
      try {
        await this.apiDisbandGroupV2();
        await this.destroyMessages(true); //群主解散群，清除所有消息
        const now = Date.now();
        this.set({
          // active_at: now,
          isArchived: false,
        });

        await window.Signal.Data.updateConversation(this.attributes);

        const groupUpdate = {
          disbanded: true,
          isDisbandByOwner,
        };

        await this.updateGroup(groupUpdate, [], fullMembers);

        this.trigger('unload', 'disband group');
      } catch (error) {
        log.error('disbandGroupV2 failed, ', error);
        throw new Error('disbandGroupV2 failed.');
      }
    },

    async apiLoadGroupV2() {
      window.log.info('load group info ......');

      let members = Array.from(new Set(this.get('members') || []));
      let membersV2;
      const groupIdV2 = this.getGroupV2Id();

      try {
        const result = await textsecure.messaging.queryGroupV2(groupIdV2);
        const groupInfo = result.data;

        const ret_members = groupInfo.members;
        const meArray = ret_members.filter(m => m.uid === this.ourNumber) || [];
        const me = meArray.length > 0 ? meArray[0] : null;
        if (me && typeof me.notification === 'number') {
          this.set({
            notification_setting: me.notification,
            group_remark: me.remark,
          });
        }

        this.set({
          left: false,
          changeVersion: groupInfo.version,
        });

        membersV2 = ret_members.map(m => ({
          id: m.uid,
          role: m.role,
          displayName: m.displayName,
        }));
        members = membersV2.map(m => m.id);

        const commonAvatar = this.parseGroupAvatar(groupInfo.avatar);

        log.info(
          `load group: ${groupIdV2}`,
          `version: ${groupInfo.version}`,
          `avatar id: ${commonAvatar?.id}`
        );

        this.updateAttributesGroup({
          ...groupInfo,
          commonAvatar,
        });
      } catch (error) {
        window.log.error('call queryGroupV2 failed,', error);

        // load groupV2 info failed, just update groupV2 membersV2 using old members
        membersV2 = this.get('membersV2');
        if (!membersV2 || membersV2.length === 0) {
          membersV2 = members.map(m => {
            // role member, all set to member
            return { id: m, role: 2 };
          });
        }

        if (error && error.response) {
          const status = error.response.status;
          if (status === 2) {
            // you have no permission(2)
            members = members.filter(m => m != this.ourNumber);
            membersV2 = membersV2.filter(m => m.id != this.ourNumber);
            this.set({
              left: true,
            });
          } else if (status === 3) {
            // group does not exists(3).
            this.set({
              disbanded: true,
              left: true,
            });

            members = [];
            membersV2 = [];
          } else {
            throw new Error('load group info failed.');
          }
        }
      }

      this.set({
        members: members,
        membersV2: membersV2,
        group_version: 2,
      });

      await window.Signal.Data.updateConversation(this.attributes);

      // update member's group display name for echo one's changes
      await this.updateGroupContact();
    },

    async apiEditGroupV2Meta(name, owner, avatar, expiration, remindCycle) {
      if (!this.isGroupV2()) {
        throw new Error('Called edit group on non-groupv2 conversation');
      }

      const groupV2Id = this.getGroupV2Id();

      log.info('edit groupV2 for:', groupV2Id);

      // any group members can edit group remindCycle, name, expiration
      if (
        this.isMeGroupV2Owner() ||
        this.isMeGroupV2Admin() ||
        remindCycle ||
        name ||
        typeof expiration === 'number'
      ) {
        try {
          const result = await textsecure.messaging.editGroupV2(
            groupV2Id,
            name,
            owner,
            avatar,
            expiration,
            remindCycle
          );

          const { messageExpiry, messageClearAnchor } = result.data || {};

          if (
            _.isNumber(messageExpiry) &&
            _.isNumber(messageClearAnchor) &&
            messageClearAnchor > this.getMessageClearAnchor()
          ) {
            this.set({
              messageExpiry,
              messageClearAnchor,
            });
            await window.Signal.Data.updateConversation(this.attributes);
          }
        } catch (error) {
          log.error('call apiEditGroupV2Meta failed, ', error);
          throw new Error('edit group v2 info failed.');
        }
      } else {
        log.error('Current user has no rights to edit group info.');
        throw new Error('No permission to edit group v2 info, reason: member');
      }
    },

    async apiAddGroupV2Members(members) {
      if (!this.isGroupV2()) {
        throw new Error('Called add group members on non-groupv2 conversation');
      }

      const groupV2Id = this.getGroupV2Id();

      log.info('add groupV2 members for:', groupV2Id);

      let newMembers = members || [];
      newMembers = Array.from(new Set(newMembers));

      try {
        await textsecure.messaging.addGroupV2Members(groupV2Id, newMembers);

        const membersV2 = this.get('membersV2') || [];

        this.set({
          membersV2: membersV2.concat(
            newMembers.map(m => {
              return { id: m, role: 2 };
            })
          ),
        });
      } catch (error) {
        log.error('call addGroupV2Members failed, ', error);
        throw error;
      }
    },

    async addGroupCalendarTips(calendar) {
      if (!this.isGroupV2()) {
        throw new Error('Called edit group on non-groupv2 conversation');
      }

      const now = Date.now();
      await this.saveNewLocalMessage({
        sent_at: now,
        received_at: now,
        group_update: { agendaURL: calendar },
        serverTimestamp: now,
      });
    },

    async apiRemoveGroupV2Members(members) {
      if (!this.isGroupV2()) {
        throw new Error('Called edit group on non-groupv2 conversation');
      }

      if (!members || members.length === 0) {
        log.info('input members error.');
        throw new Error('members count to be removed is 0.');
      }

      const groupV2Id = this.getGroupV2Id();

      if (this.isMeGroupV2Owner()) {
        if (members.includes(this.ourNumber)) {
          log.error('group owner cannot call removeGroupV2Members to self.');
          throw new Error('No permission to leave group v2, reason:owner');
        }
      } else if (this.isMeGroupV2Admin() || this.isAnyoneCanRemove()) {
        // 1 cannot remove owner
        // 2 could remove others admin ?
        members.forEach(m => {
          if (this.isGroupV2RoleOwner(m.id) || this.isGroupV2RoleAdmin(m.id)) {
            log.error('could not remove group owner or admin.');
            throw new Error(
              'No permission to remove owner or admin, reson:owner|admin'
            );
          }
        });
      } else {
        if (members.length > 1 || !members.includes(this.ourNumber)) {
          log.error('group member cannot call removeGroupV2Members');
          throw new Error(
            'No permission to remove member(s) from group v2, reason:member'
          );
        } else {
          log.info('leave group:', members);
        }
      }

      try {
        await textsecure.messaging.removeGroupV2Members(groupV2Id, members);
        // update this conversation
        const membersV2 = this.get('membersV2');
        const remainedMembersV2 = membersV2.filter(
          m => !members.includes(m.id)
        );

        this.set({
          membersV2: remainedMembersV2,
        });
      } catch (error) {
        log.error('call apiRemoveGroupV2Members failed, ', error);
        throw error;
      }
    },

    async apiEditGroupV2Member(number, info) {
      if (!this.isGroupV2()) {
        throw new Error('Called edit group member on non-groupv2 conversation');
      }

      const { role, displayName, remark, notification } = info;

      // group owner can change another member role
      // only memberself can change it's displayName, remark and notification
      if (role && !(number === this.ourNumber && this.isMeGroupV2Owner())) {
        log.error(
          'someone can change member role only when itself is group owner.'
        );
        throw new Error('have no permission to edit role.');
      }

      const groupV2Id = this.getGroupV2Id();

      try {
        await textsecure.messaging.editGroupV2Member(
          groupV2Id,
          number,
          role,
          displayName,
          remark,
          notification
        );

        if (typeof notification === 'number') {
          this.set({
            notification_setting: notification,
          });
        }
      } catch (error) {
        log.error('call apiEditGroupV2Member failed, ', error);
        throw error;
      }
    },

    async apiEditGroupV2OnlyOwner(type, data) {
      if (!this.isGroupV2()) {
        throw new Error('Called edit group member on non-groupv2 conversation');
      }
      log.info('apiEditGroupV2OnlyOwner', type, JSON.stringify(data));

      const groupV2Id = this.getGroupV2Id();
      const update = {};
      const {
        invitationRule,
        anyoneRemove,
        rejoin,
        publishRule,
        anyoneChangeName,
        linkInviteSwitch,
      } = data;

      if (invitationRule) {
        // 邀请其他人入群规则 2:全员允许（默认），1:管理员和群主、0:群主
        update.invitationRule = invitationRule;
      }

      if (anyoneRemove !== undefined) {
        update.anyoneRemove = anyoneRemove;
      }

      if (rejoin !== undefined) {
        update.rejoin = rejoin;
      }

      if (publishRule) {
        update.publishRule = publishRule;
      }

      if (anyoneChangeName != undefined) {
        update.anyoneChangeName = anyoneChangeName;
      }

      if (linkInviteSwitch != undefined) {
        update.linkInviteSwitch = linkInviteSwitch;
      }

      try {
        await textsecure.messaging.changeGroupOnlyOwner(groupV2Id, data);
        this.set(update);
        window.Signal.Data.updateConversation(this.attributes);
      } catch (error) {
        log.error('call apiEditGroupV2InviteRule failed, ', error);
        throw error;
      }
    },

    async apiGetGroupV2Member(number) {
      if (!this.isGroupV2()) {
        throw new Error('Called edit group member on non-groupv2 conversation');
      }

      const groupV2Id = this.getGroupV2Id();

      let memberInfo;
      try {
        const result = await textsecure.messaging.getGroupV2Member(
          groupV2Id,
          number
        );
        memberInfo = result.data;
      } catch (error) {
        log.error('call apiGetGroupV2Member failed, ', error);
        throw new Error('call apiGetGroupV2Member failed');
      }

      const member = {
        id: memberInfo.uid,
        role: memberInfo.role,
        displayName: memberInfo.displayName,
      };
      let membersV2 = this.get('membersV2');
      let members = membersV2.filter(m => m.id === number);
      if (members && members.length > 0) {
        members[0] = member;
      } else {
        membersV2.push(member);
      }

      if (number === this.ourNumber) {
        this.set({
          notification_setting: memberInfo.notification,
          group_remark: memberInfo.remark,
        });
      }
    },

    async apiMoveAdmins(members, add) {
      if (!this.isGroupV2()) {
        throw new Error('Called edit group on non-groupv2 conversation');
      }

      if (!members || members.length === 0) {
        log.info('input members error.');
        throw new Error('members count to be removed is 0.');
      }

      const groupV2Id = this.getGroupV2Id();

      if (!this.isMeGroupV2Owner()) {
        log.error('No permission to apiMoveAdmins, reason: not-owner');
        throw new Error('No permission to apiMoveAdmins, reason: not-owner');
      }

      try {
        for (let i = 0; i < members.length; i += 1) {
          if (add) {
            await textsecure.messaging.addGroupAdmin(groupV2Id, members[i]);
          } else {
            await textsecure.messaging.removeGroupAdmin(groupV2Id, members[i]);
          }
        }

        // update this conversation
        const membersV2 = this.get('membersV2');
        for (let i = 0; i < membersV2.length; i += 1) {
          if (members.includes(membersV2[i].id)) {
            membersV2[i].role = add ? 1 : 2;
          }
        }

        this.trigger('change:membersV2');
        // 不能这样写，因为不会触发变更
        // this.set({
        //   membersV2: [...membersV2],
        // });
      } catch (error) {
        log.error('call apiMoveAdmins failed, ', error);
        throw error;
      }
    },

    async apiTransferOwner(id) {
      if (!this.isGroupV2()) {
        throw new Error('Called edit group on non-groupv2 conversation');
      }

      const groupV2Id = this.getGroupV2Id();

      if (!this.isMeGroupV2Owner()) {
        log.error('No permission to apiTransferOwner, reason: not-owner');
        throw new Error('No permission to apiTransferOwner, reason: not-owner');
      }

      try {
        await textsecure.messaging.transferGroupOwner(groupV2Id, id);
        let membersV2 = this.get('membersV2');
        for (let i = 0; i < membersV2.length; i += 1) {
          if (membersV2[i].id === id) {
            membersV2[i].role = 0;
          }
          if (membersV2[i].id === this.ourNumber) {
            membersV2[i].role = 1;
          }
        }
        membersV2 = membersV2.sort((a, b) => {
          return a.role - b.role;
        });

        this.set({
          membersV2: [...membersV2],
        });
      } catch (error) {
        log.error('call apiTransferOwner failed, ', error);
        throw error;
      }
    },

    async apiDisbandGroupV2() {
      if (!this.isGroupV2()) {
        throw new Error('Called edit group member on non-groupv2 conversation');
      }

      const groupV2Id = this.getGroupV2Id();

      try {
        const result = textsecure.messaging.disbandGroupV2(groupV2Id);
      } catch (error) {
        log.error('call apiDisbandGroupV2 failed, ', error);
        throw new Error('call apiDisbandGroupV2 failed');
      }

      const update = {
        left: true,
        members: [],
        membersV2: [],
      };

      this.set(update);
    },

    async apiGetGroupV2InviteCode() {
      if (!this.isGroupV2()) {
        throw new Error(
          'Called get group invite code on non-groupv2 conversation'
        );
      }

      const groupV2Id = this.getGroupV2Id();

      try {
        const result =
          await textsecure.messaging.getGroupV2InviteCode(groupV2Id);
        const { data } = result;
        const { inviteCode } = data;
        return inviteCode;
      } catch (error) {
        log.error('get group invite code failed,', error);
      }
    },

    async updateCommonAvatar() {
      const shouldUpdate = await this.updateCommonAvatarFile();
      if (shouldUpdate) {
        await window.Signal.Data.updateConversation(this.attributes);
      }
    },

    async updateCommonAvatarFile() {
      const commonAvatar = this.get('commonAvatar') || {};
      // upload avatar
      if (commonAvatar.uploadData) {
        const maybeUpdateAvatar = this.isPrivate()
          ? window.Signal.Types.Conversation.maybeUpdateProfileAvatar
          : window.Signal.Types.Conversation.maybeUpdateAvatar;

        const newAttributes = await maybeUpdateAvatar(
          this.attributes,
          commonAvatar.uploadData,
          {
            writeNewAttachmentData,
            deleteAttachmentData,
          }
        );

        newAttributes.commonAvatar = _.omit(commonAvatar, [
          'uploadData',
          'key',
        ]);
        this.set({
          ...newAttributes,
          commonAvatar: newAttributes.commonAvatar,
        });

        return true;
      }

      let shouldUpdate;

      if (this.isPrivate()) {
        const { encKey, encAlgo, attachmentId } = commonAvatar;
        if (!attachmentId) {
          await this.clearAvatar();
          return;
        }

        if (!encKey || !encAlgo) {
          return;
        }

        if (encAlgo === 'AESGCM256') {
          try {
            await this.setProfileAvatar(attachmentId, encKey);

            this.set({
              commonAvatar: _.omit(commonAvatar, ['encKey', 'encAlgo']),
            });

            shouldUpdate = true;
            log.info('avatar update success for number:', this.idForLogging());
          } catch (error) {
            if (error && error.code === 404) {
              // attachment does not exist.
              // does not retry again.
              this.set({
                commonAvatar: _.omit(commonAvatar, ['encKey', 'encAlgo']),
              });

              shouldUpdate = true;
            }

            log.error('failed to set avatar for number:', this.idForLogging());
          }
        } else {
          log.error(
            'unknown encrypt algo, ',
            encAlgo,
            'for number:',
            this.idForLogging()
          );
        }
      } else {
        const { id, key, digest, size } = commonAvatar;
        if (!id) {
          log.warn('no id in commonAvatar', this.idForLogging());
          await this.clearAvatar();
          return;
        }

        if (!key || !digest) {
          return;
        }

        try {
          const encrypted = await textsecure.messaging.getAttachment(id);
          const data = await textsecure.crypto.decryptAttachment(
            encrypted,
            window.Signal.Crypto.base64ToArrayBuffer(key),
            window.Signal.Crypto.base64ToArrayBuffer(digest)
          );

          if (!size || size !== data.byteLength) {
            throw new Error(
              `downloadAvatar: Size ${size} did not match downloaded attachment size ${data.byteLength}`
            );
          }

          const attachmentPointer = {
            ..._.omit(commonAvatar, 'key'),
            data,
          };

          const newAttributes =
            await window.Signal.Types.Conversation.maybeUpdateAvatar(
              this.attributes,
              attachmentPointer.data,
              {
                writeNewAttachmentData,
                deleteAttachmentData,
              }
            );

          newAttributes.commonAvatar = _.omit(commonAvatar, ['key']);

          this.set({
            ...newAttributes,
            commonAvatar: newAttributes.commonAvatar,
          });

          shouldUpdate = true;
        } catch (error) {
          if (error && error.code === 404) {
            // attachment does not exist.
            // does not retry again.
            this.set({
              commonAvatar: _.omit(commonAvatar, ['key']),
            });

            shouldUpdate = true;
          }

          log.error('get avatar failed,', error);
        }
      }

      return shouldUpdate;
    },

    async clearAvatar() {
      const { avatar, profileAvatar } = this.attributes;
      if (avatar || profileAvatar) {
        await window.Signal.Types.Conversation.deleteExternalFiles(
          this.attributes,
          {
            deleteAttachmentData,
          }
        );

        this.attributes.avatar = null;
        this.attributes.profileAvatar = null;
        await window.Signal.Data.updateConversation(this.attributes);
      }
    },

    async updateUnreadCount(newestUnreadDate, markReadCount) {
      const oldUnreadCount = this.get('unreadCount');
      if (!oldUnreadCount) {
        return;
      }

      log.info(
        `update unread count ${oldUnreadCount} for `,
        newestUnreadDate,
        markReadCount,
        this.idForLogging()
      );

      const { lastIncoming, lastNonOutgoing } =
        this.messageCollection.findLastMessageForMarkRead();

      const lastMessage = this.messageCollection.last();

      if (
        this.hasBottomLoaded(false) &&
        (!lastNonOutgoing ||
          lastMessage?.isOutgoing() ||
          newestUnreadDate === lastMessage?.getServerTimestamp() ||
          newestUnreadDate === lastIncoming?.getServerTimestamp() ||
          newestUnreadDate === lastNonOutgoing?.getServerTimestamp())
      ) {
        log.info('clear unread count.', newestUnreadDate, this.idForLogging());

        this.set({ unreadCount: 0, atPersons: null });
      } else {
        if (markReadCount) {
          const unreadCount = oldUnreadCount - markReadCount;

          log.info(
            'update unread count',
            oldUnreadCount,
            markReadCount,
            this.idForLogging()
          );

          this.set({
            unreadCount: unreadCount > 0 ? unreadCount : 0,
          });
        }
      }

      if (this.hasChanged()) {
        await window.Signal.Data.updateConversation(this.attributes);
      }
    },

    markRead(readPosition, providedOptions) {
      const { maxServerTimestamp: newestUnreadDate } = readPosition;

      // this can update unread count quickly when user read at bottom
      this.updateUnreadCount(newestUnreadDate);

      return this.queueJob(async () => {
        try {
          await this.updateUnreadCount(newestUnreadDate);
          await this.markReadInner(readPosition, providedOptions);
        } catch (error) {
          window.log.info(
            `failed to mark read at ${newestUnreadDate}`,
            providedOptions,
            error,
            this.idForLogging()
          );
        }
      });
    },

    async getLastReadPosition() {
      const existLastPosition = this.get('lastReadPosition');

      if (this.hasPositionBeenChecked) {
        return existLastPosition;
      }

      try {
        const topPosition = await window.Signal.Data.topReadPosition(this.id);
        if (
          topPosition &&
          (!existLastPosition ||
            topPosition.maxServerTimestamp >
              existLastPosition.maxServerTimestamp)
        ) {
          this.set({ lastReadPosition: { ...topPosition } });
          await window.Signal.Data.updateConversation(this.attributes);
        }

        this.hasPositionBeenChecked = true;
      } catch (error) {
        log.error('top read position failed,', error);
      }

      return this.get('lastReadPosition');
    },

    async loadReadPositions(startPos, endPos) {
      if (!startPos || !endPos || startPos > endPos) {
        log.error(`try to load invalid positions [${startPos}, ${endPos}]`);
        return;
      }

      const { firstPosition, lastPosition } = this.readPositionCollection;

      let begin = 0;
      let end = Number.MAX_VALUE;

      if (!_.isNumber(firstPosition) || !_.isNumber(lastPosition)) {
        // firstPosition or lastPosition is not number
        begin = startPos;
        end = endPos;
      } else if (startPos < firstPosition && endPos <= lastPosition) {
        begin = startPos;
        end = firstPosition;
      } else if (startPos < firstPosition && endPos > lastPosition) {
        // covered already loaded.
        begin = startPos;
        end = endPos;
      } else if (startPos >= firstPosition && endPos <= lastPosition) {
        // already loaded, skip
        return;
      } else if (startPos >= firstPosition && endPos >= lastPosition) {
        begin = lastPosition;
        end = endPos;
      } else {
        begin = startPos;
        end = endPos;
      }

      window.log.info(
        `loading positions [${startPos}, ${endPos}],`,
        `exists [${firstPosition}, ${lastPosition}], new [${begin}, ${end}]`,
        this.idForLogging()
      );

      try {
        let positions = await window.Signal.Data.getReadPositions(this.id, {
          begin,
          end,
          includeBegin: true,
          includeEnd: true,
          limit: -1,
        });

        // 1 not found
        // 2 end is not Number.MAX_VALUE and last position is not the end
        if (
          !positions?.length ||
          (end !== Number.MAX_VALUE &&
            positions[positions.length - 1].maxServerTimestamp !== end)
        ) {
          // read 1 more bigger than end
          const morePositions = await window.Signal.Data.getReadPositions(
            this.id,
            {
              begin: end,
              limit: 1,
            }
          );

          if (morePositions?.length) {
            if (!Array.isArray(positions)) {
              positions = morePositions;
            } else {
              positions.push(...morePositions);
            }
          }
        }

        if (!positions?.length) {
          // no positions loaded
          return;
        }

        const first = positions[0].maxServerTimestamp;
        if (!firstPosition || first < firstPosition) {
          // never loaded or should update
          this.readPositionCollection.firstPosition = first;
        }

        const last = positions[positions.length - 1].maxServerTimestamp;
        if (!lastPosition || last > lastPosition) {
          // never loaded or should update
          this.readPositionCollection.lastPosition = last;
        }

        this.readPositionCollection.addPosition(positions);
      } catch (error) {
        window.log.error('get read positions failed,', begin, end, error);
      }
    },

    async getLastSentMaxAt() {
      // get last read at position's maxServerTimestamp
      let lastSentMaxAt = this.get('lastSentMaxAt');
      if (lastSentMaxAt) {
        return lastSentMaxAt;
      }

      // change non-suitable attribute name
      lastSentMaxAt = this.get('lastSentReadAt');
      if (lastSentMaxAt) {
        this.set({ lastSentMaxAt });
        this.unset('lastSentReadAt');
        await window.Signal.Data.updateConversation(this.attributes);
        return lastSentMaxAt;
      }

      // 查找是否有旧的未读消息
      const messages = await window.Signal.Data.getMessagesByConversation(
        this.id,
        {
          onlyUnread: true,
          limit: 1,
          MessageCollection: Whisper.MessageCollection,
        }
      );

      if (!messages?.length) {
        return undefined;
      }

      // 从数据库中查找最大的一条已读消息，获取serverTimestamp后返回
      const lastHasRead = await window.Signal.Data.findLastReadMessage(
        this.id,
        { Message: Whisper.Message }
      );

      if (lastHasRead) {
        const message = MessageController.register(lastHasRead.id, lastHasRead);

        const serverTimestamp = message.getServerTimestamp();

        this.set({ lastSentMaxAt: serverTimestamp });
        await window.Signal.Data.updateConversation(this.attributes);

        return serverTimestamp;
      }

      return undefined;
    },

    async forceSyncLastReadPosition() {
      this.queueSyncMarkReadPosition();

      if (!this.hasBottomLoaded(false)) {
        return;
      }

      const positionToSync = [];

      const lastReadPosition = await this.getLastReadPosition();

      const {
        sender: lastReadSender,
        sentAt: lastReadSentAt,
        readAt: lastReadReadAt,
        sourceDevice: lastReadSourceDevice,
        maxServerTimestamp: lastReadMaxServerTimestamp,
      } = lastReadPosition || {};

      if (lastReadSourceDevice == this.getCurrentDeviceId()) {
        // last read position is marked by our device
        positionToSync.push({
          readPosition: {
            ...lastReadPosition,
            groupId: this.isPrivate() ? null : this.id,
          },
          sender: lastReadSender || '',
          timestamp: lastReadSentAt || lastReadMaxServerTimestamp,
        });
      }

      // find the last incoming message
      // which serverTimestamp is same with or before last read position
      const incoming = _lodash.findLast(
        this.messageCollection.models,
        model =>
          model.isIncoming() &&
          model.getServerTimestamp() <= lastReadMaxServerTimestamp
      );

      const currentDeviceId = this.getCurrentDeviceId();
      if (
        incoming &&
        (lastReadSourceDevice != currentDeviceId ||
          incoming.getServerTimestamp() !== lastReadMaxServerTimestamp)
      ) {
        const readPosition = {
          sourceDevice: currentDeviceId,
          conversationId: this.id,
          sender: incoming.getSource(),
          sentAt: incoming.get('sent_at'),
          readAt: lastReadReadAt || Date.now(),
          maxServerTimestamp: incoming.getServerTimestamp(),
          groupId: this.isPrivate() ? null : this.id,
          maxNotifySequenceId: incoming.get('notifySequenceId'),
        };

        positionToSync.push({
          readPosition,
          sender: readPosition.sender,
          timestamp: readPosition.sentAt,
        });
      }

      if (positionToSync.length) {
        const extension = {
          isPrivate: this.isPrivate(),
          conversationId: this.isPrivate() ? this.id : this.getGroupV2Id(),
        };

        try {
          log.debug('force sync read position:', positionToSync);

          await textsecure.messaging.syncReadMessages(
            positionToSync,
            extension
          );
        } catch (error) {
          log.error('force sync read messages failed:', error);
        }
      }
    },

    async getLastSyncedMaxAt() {
      let lastSyncedMaxAt = this.get('lastSyncedMaxAt');
      if (lastSyncedMaxAt) {
        return lastSyncedMaxAt;
      }

      lastSyncedMaxAt = this.get('lastSyncedReadAt');
      if (lastSyncedMaxAt) {
        // remove non-suitable attribute
        this.set({ lastSyncedMaxAt });
        this.unset('lastSyncedReadAt');

        await window.Signal.Data.updateConversation(this.attributes);

        return lastSyncedMaxAt;
      }

      return 0;
    },

    async syncReadPositionWithHistory() {
      let lastSyncedMaxAt = await this.getLastSyncedMaxAt();

      const limit = 30;
      const maxLen = 100;

      const positionToSync = [];
      const extension = {
        isPrivate: this.isPrivate(),
        conversationId: this.isPrivate() ? this.id : this.getGroupV2Id(),
      };

      const doSyncRequest = async () => {
        if (!positionToSync.length) {
          return;
        }

        try {
          await textsecure.messaging.syncReadMessages(
            positionToSync,
            extension
          );

          this.set({ lastSyncedMaxAt });
          if (this.hasChanged()) {
            await window.Signal.Data.updateConversation(this.attributes);
          }
        } catch (error) {
          log.error('sync read message failed', error);
        }

        positionToSync.splice(0, positionToSync.length);
      };

      do {
        const positions = await window.Signal.Data.getReadPositions(this.id, {
          limit,
          begin: lastSyncedMaxAt,
        });

        if (!positions?.length) {
          await doSyncRequest();
          return;
        }

        // filtering positions of current device
        const currentDeviceId = this.getCurrentDeviceId();
        const preparedPositions = positions
          .filter(p => p.sourceDevice == currentDeviceId)
          .map(p => ({
            sender: p.sender || '',
            timestamp: p.sentAt || p.maxServerTimestamp,
            readPosition: {
              ...p,
              groupId: this.isPrivate() ? null : this.id,
            },
          }));

        if (preparedPositions.length) {
          log.info(
            'Prepare sync read:',
            preparedPositions,
            this.idForLogging()
          );
          positionToSync.push(...preparedPositions);
        }

        // update lastSyncedMaxAt
        const maxPosition = _.max(positions, 'maxServerTimestamp');
        lastSyncedMaxAt = maxPosition?.maxServerTimestamp;

        if (positionToSync.length >= maxLen) {
          await doSyncRequest();
        }
      } while (true);
    },

    queueSyncMarkReadPosition() {
      if (!this.syncMarkReadQueue) {
        this.syncMarkReadQueue = new window.PQueue({ concurrency: 1 });
      }

      this.syncMarkReadQueue.add(async () => {
        // sync
        // 同步所有本地生产的read position 到另外的设备
        try {
          await this.syncReadPositionWithHistory();
        } catch (error) {
          log.error('syncReadPositionWithHistory failed,', error);
        }
      });
    },

    async forceResendReadReceiptsTo(
      sender,
      timestamps,
      readPosition,
      extension
    ) {
      try {
        const conversation = ConversationController.get(sender);

        await conversation.getProfile(sender);

        await textsecure.messaging.sendReadReceipts(
          {
            sender,
            timestamps,
            readPosition,
          },
          extension
        );
      } catch (error) {
        log.error('forceResendReadReceiptsTo failed,', error);
        throw error;
      }
    },

    async sendReadReceiptsTo(sender, reads, readAt, extension) {
      const timestamps = _.map(reads, 'timestamp');
      const maxReceipt = _.max(reads, 'serverTimestamp');
      const readPosition = {
        readAt,
        maxServerTimestamp: maxReceipt.serverTimestamp,
        maxNotifySequenceId: maxReceipt.notifySequenceId,
      };

      if (!this.isPrivate()) {
        readPosition.groupId = this.id;
      }

      const newExtension = { ...extension };

      try {
        await textsecure.messaging.sendReadReceipts(
          {
            sender,
            timestamps,
            readPosition,
          },
          newExtension
        );
      } catch (result) {
        let retried = false;

        const retryErrors = [];
        if (
          result instanceof Error &&
          result.name === 'OutgoingIdentityKeyError'
        ) {
          retryErrors.push({ ...result, number: sender });
        } else {
          for (const error of result.errors) {
            if (error.name === 'OutgoingIdentityKeyError') {
              retryErrors.push(error);
            }
          }
        }

        for (const error of retryErrors) {
          await this.forceResendReadReceiptsTo(
            error.number,
            timestamps,
            readPosition,
            newExtension
          );

          retried = true;
        }

        if (!retried) {
          throw result;
        }
      }
    },

    async sendReadReceiptsAll(reads, readAt) {
      if (!reads.length) {
        return;
      }

      if (this.isChatWithoutReceipt()) {
        return;
      }

      window.log.info(
        'Sending read receipts',
        reads.map(r => _.pick(r, ['sender', 'timestamp']))
      );

      const extension = {
        isPrivate: this.isPrivate(),
        conversationId: this.isPrivate() ? this.id : this.getGroupV2Id(),
      };

      // if (!storage.get('read-receipt-setting')) {
      //   return;
      // }

      await Promise.all(
        _.map(_.groupBy(reads, 'sender'), async (receipts, sender) => {
          await this.sendReadReceiptsTo(sender, receipts, readAt, extension);
        })
      );
    },

    async sendReadPositionWithHistory() {
      const lastReadPosition = await this.getLastReadPosition();
      if (!lastReadPosition) {
        log.error('get last read position failed', this.idForLogging());
        return;
      }

      let lastSentMaxAt;
      try {
        lastSentMaxAt = await this.getLastSentMaxAt();
      } catch (error) {
        log.error('getLastSentMaxAt failed,', error);
        return;
      }

      const { maxServerTimestamp } = lastReadPosition;
      if (lastSentMaxAt >= maxServerTimestamp) {
        log.info(
          'skip sendReadPositionWithHistory for already sent',
          lastSentMaxAt,
          maxServerTimestamp
        );
        return;
      }

      const unsentRead = [];

      const doSendReceiptsAll = async lastSentMaxServerTimestamp => {
        await this.sendReadReceiptsAll(unsentRead, lastReadPosition.readAt);
        this.set({ lastSentMaxAt: lastSentMaxServerTimestamp });
        await window.Signal.Data.updateConversation(this.attributes);
        unsentRead.splice(0, unsentRead.length);
      };

      let end = maxServerTimestamp;
      do {
        // NOT including start, but including end
        const unreadMessages = await window.Signal.Data.getUnreadMessages(
          this.id,
          {
            start: lastSentMaxAt,
            end,
            limit: 50,
            MessageCollection: Whisper.MessageCollection,
          }
        );

        if (!unreadMessages?.length) {
          if (unsentRead.length) {
            await doSendReceiptsAll(lastSentMaxAt);
          }

          break;
        }

        const oldUnread = unreadMessages.map(message => {
          const found = MessageController.register(message.id, message);
          return found;
        });

        let read = oldUnread.map(m => {
          return {
            sender: m.get('source'),
            timestamp: m.get('sent_at'),
            serverTimestamp: m.getServerTimestamp(),
            hasErrors: m.hasErrors(),
            envelopeType: m.get('envelopeType'),
            notifySequenceId: m.get('notifySequenceId'),
          };
        });

        // Some messages we're marking read are local notifications with no sender
        read = _.filter(read, m => Boolean(m.sender));
        read = read.filter(item => !item.hasErrors);

        window.log.info(
          `Prepare ${read.length} read receipts for ${maxServerTimestamp}`
        );

        // update lastSentMaxAt
        lastSentMaxAt = unreadMessages.last().getServerTimestamp();

        unsentRead.push(...read);
        if (unsentRead.length >= 100) {
          await doSendReceiptsAll(lastSentMaxAt);
        }
      } while (true);
    },

    queueSendMarkReadPosition() {
      if (!this.sendMarkReadQueue) {
        this.sendMarkReadQueue = new window.PQueue({ concurrency: 1 });
      }

      this.sendMarkReadQueue.add(async () => {
        // send to others
        // 发送自己已读的位置给会话内的其他人
        try {
          await this.sendReadPositionWithHistory();
        } catch (error) {
          log.error('sendReadPositionWithHistory failed,', error);
        }
      });
    },

    async markReadInner(readPosition, providedOptions) {
      const options = providedOptions || {};
      // send sync read message, except read receipts.
      _.defaults(options, { sendReadReceipts: true });

      const conversationId = this.id;
      Whisper.Notifications.remove(
        Whisper.Notifications.where({ conversationId })
      );

      const { maxServerTimestamp: newestUnreadDate } = readPosition;

      if (this.lastTryPosition?.maxServerTimestamp !== newestUnreadDate) {
        window.log.info(
          `Mark read at`,
          readPosition,
          options,
          this.idForLogging()
        );
      }

      let haveSavedSuccess = false;

      const lastReadPosition = await this.getLastReadPosition();
      const lastMaxServerTimestamp = lastReadPosition?.maxServerTimestamp || 0;
      if (!lastReadPosition || newestUnreadDate > lastMaxServerTimestamp) {
        log.info('new read position', newestUnreadDate, this.idForLogging());

        try {
          // get unread count
          const markReadCount = await window.Signal.Data.getUnreadMessageCount(
            this.id,
            lastMaxServerTimestamp,
            newestUnreadDate
          );

          // update unread count
          await this.updateUnreadCount(newestUnreadDate, markReadCount);

          this.set({ lastReadPosition: { ...readPosition } });
          await window.Signal.Data.updateConversation(this.attributes);

          this.readPositionCollection.addPosition(readPosition);
          // save current read position
          await window.Signal.Data.saveReadPosition(readPosition);

          haveSavedSuccess = true;
        } catch (error) {
          log.error(
            'failed to update read position',
            newestUnreadDate,
            error,
            this.idForLogging()
          );
        }
      } else {
        const now = Date.now();

        // last try read position should be same as last read position
        if (
          this.lastTryPosition?.maxServerTimestamp === newestUnreadDate &&
          lastMaxServerTimestamp === newestUnreadDate
        ) {
          const { lastTryAt } = this.lastTryPosition;

          // 如果未读计数>0, 且重复收到相同位置的已读
          // 校正未读数
          const currentUnreadCount = this.get('unreadCount');
          if (currentUnreadCount > 0 && Math.abs(lastTryAt - now) > 3 * 1000) {
            // force check unreadCount by count from db
            const unreadCount = await window.Signal.Data.getUnreadMessageCount(
              this.id,
              readPosition.maxServerTimestamp,
              Number.MAX_VALUE
            );

            log.info(
              'force update unread count',
              currentUnreadCount,
              unreadCount,
              this.idForLogging()
            );

            this.set({
              unreadCount: unreadCount > 0 ? unreadCount : 0,
            });

            if (this.hasChanged()) {
              await window.Signal.Data.updateConversation(this.attributes);
            }
          }
        }

        this.lastTryPosition = {
          ...readPosition,
          lastTryAt: now,
        };
      }

      if (options.savePosition && !haveSavedSuccess) {
        await window.Signal.Data.saveReadPosition(readPosition);
        this.readPositionCollection.addPosition(readPosition);
      }

      if (!options.sendReadReceipts) {
        return;
      }

      this.queueSendMarkReadPosition();
      this.queueSyncMarkReadPosition();
    },

    onChangeProfileKey() {
      if (this.isPrivate()) {
        this.getProfiles();
      }
    },

    getProfiles() {
      // request all conversation members' keys
      let ids = [];
      if (this.isPrivate()) {
        ids = [this.id];
      } else {
        ids = this.get('members');
      }
      return Promise.all(_.map(ids, this.getProfile));
    },

    async getProfile(id) {
      if (!textsecure.messaging) {
        throw new Error(
          'Conversation.getProfile: textsecure.messaging not available'
        );
      }

      const c = await ConversationController.getOrCreateAndWait(id, 'private');

      // Because we're no longer using Backbone-integrated saves, we need to manually
      //   clear the changed fields here so our hasChanged() check is useful.
      c.changed = {};

      try {
        const profile = await textsecure.messaging.getProfile(id);

        const identityKey = window.Signal.Crypto.base64ToArrayBuffer(
          profile.identityKey
        );
        const changed = await textsecure.storage.protocol.saveIdentity(
          `${id}.1`,
          identityKey,
          false
        );
        if (changed) {
          // save identity will close all sessions except for .1, so we
          // must close that one manually.
          const address = new libsignal.SignalProtocolAddress(id, 1);
          window.log.info('closing session for', address.toString());
          const sessionCipher = new libsignal.SessionCipher(
            textsecure.storage.protocol,
            address
          );
          await sessionCipher.closeOpenSessionForDevice();
        }

        await c.setProfileName(profile.name);

        // This might throw if we can't pull the avatar down, so we do it last
        // await c.setProfileAvatar(profile.avatar);
      } catch (error) {
        window.log.error(
          'getProfile error:',
          id,
          error && error.stack ? error.stack : error
        );
      } finally {
        if (c.hasChanged()) {
          await window.Signal.Data.updateConversation(c.attributes);
        }
      }
    },
    async setProfileName(encryptedName) {
      if (!encryptedName) {
        return;
      }
      const key = this.get('profileKey');
      if (!key) {
        return;
      }

      // decode
      const keyBuffer = window.Signal.Crypto.base64ToArrayBuffer(key);
      const data = window.Signal.Crypto.base64ToArrayBuffer(encryptedName);

      // decrypt
      const decrypted = await textsecure.crypto.decryptProfileName(
        data,
        keyBuffer
      );

      // encode
      const profileName = window.Signal.Crypto.stringFromBytes(decrypted);

      // set
      this.set({ profileName });
    },
    async setProfileAvatar(avatarPath, profileKey) {
      if (!avatarPath) {
        log.warn('profile avatar path is invalid');
        return;
      }

      const avatar = await textsecure.messaging.getAvatar(avatarPath);

      if (!profileKey) {
        profileKey = this.get('profileKey');
        if (!profileKey) {
          log.warn(
            'profileKey for conversation is not found:',
            this.idForLogging()
          );
          return;
        }
      }
      const keyBuffer = window.Signal.Crypto.base64ToArrayBuffer(profileKey);

      // decrypt
      const decrypted = await textsecure.crypto.decryptProfile(
        avatar,
        keyBuffer
      );

      // update the conversation avatar only if hash differs
      if (decrypted) {
        const newAttributes =
          await window.Signal.Types.Conversation.maybeUpdateProfileAvatar(
            this.attributes,
            decrypted,
            {
              writeNewAttachmentData,
              deleteAttachmentData,
            }
          );
        this.set(newAttributes);
      }
    },
    async setProfileKey(profileKey) {
      // profileKey is a string so we can compare it directly
      if (this.get('profileKey') !== profileKey) {
        this.set({ profileKey });
        await window.Signal.Data.updateConversation(this.attributes);
      }
    },

    async upgradeMessages(messages) {
      for (let max = messages.length, i = 0; i < max; i += 1) {
        const message = messages.at(i);
        const { attributes } = message;
        const { schemaVersion } = attributes;

        if (schemaVersion < Message.CURRENT_SCHEMA_VERSION) {
          // Yep, we really do want to wait for each of these
          // eslint-disable-next-line no-await-in-loop
          const upgradedMessage = await upgradeMessageSchema(attributes);
          message.set(upgradedMessage);
          // eslint-disable-next-line no-await-in-loop
          await window.Signal.Data.saveMessage(upgradedMessage, {
            Message: Whisper.Message,
          });
        }
      }
    },

    hasBottomLoaded(testThread) {
      return this.messageCollection.hasBottomLoaded(testThread);
    },

    async fetchAndResetMessages(
      serverTimestamp = Number.MAX_VALUE,
      limit = 50
    ) {
      if (this.inProgressFetch) {
        window.log.warn('Attempting to start a parallel fetch progress call 2');
        return;
      }

      window.log.info(
        'fetchAndResetMessages:',
        serverTimestamp,
        limit,
        this.idForLogging()
      );

      this.inProgressFetch = this.messageCollection.fetchAndResetMessages(
        this.id,
        serverTimestamp,
        limit
      );

      const result = await this.inProgressFetch;

      try {
        // We are now doing the work to upgrade messages before considering the load from
        //   the database complete. Note that we do save messages back, so it is a
        //   one-time hit. We do this so we have guarantees about message structure.
        await this.upgradeMessages(this.messageCollection);
      } catch (error) {
        window.log.error(
          'fetchAndResetMessages: failed to upgrade messages',
          Errors.toLogFormat(error)
        );
      }

      this.inProgressFetch = null;

      return result;
    },

    async fetchContinuousMessages(upward = true) {
      if (!this.id) {
        throw new Error('This conversation has no id!');
      }

      if (this.inProgressFetch) {
        window.log.warn('Attempting to start a parallel fetch progress call 2');
        return;
      }

      log.info(
        `fetchContinuousMessages: direction upward ${upward} for `,
        this.idForLogging()
      );

      // 不处理
      if (!upward && this.hasBottomLoaded()) {
        log.info(
          'Already at bottom, no need to load from database,',
          this.idForLogging()
        );
        return;
      }

      this.inProgressFetch = this.messageCollection.fetchContinuousMessages(
        this.id,
        undefined,
        this.get('unreadCount'),
        upward
      );

      const { count, renderPromise } = await this.inProgressFetch;

      try {
        // We are now doing the work to upgrade messages before considering the load from
        //   the database complete. Note that we do save messages back, so it is a
        //   one-time hit. We do this so we have guarantees about message structure.
        await this.upgradeMessages(this.messageCollection);
      } catch (error) {
        window.log.error(
          'fetchContinuousMessages: failed to upgrade messages',
          Errors.toLogFormat(error)
        );
      }

      this.inProgressFetch = null;

      return { count, renderPromise };
    },

    hasMember(number) {
      return _.contains(this.get('members'), number);
    },
    fetchContacts(memberChanged) {
      if (this.isPrivate()) {
        this.contactCollection.reset([this]);
        return Promise.resolve();
      }

      let promise;

      if (this.isGroupV2()) {
        const membersV2 = this.get('membersV2') || [];
        promise = ConversationController.bulkFreshGroupContact(membersV2);
      } else {
        const members = this.get('members') || [];
        const mapper = m =>
          ConversationController.getOrCreateAndWait(m, 'private');
        promise = Promise.all(members.map(mapper));
      }

      return promise.then(contacts => {
        this.contactCollection.reset(contacts);

        if (memberChanged) {
          this.trigger('update_view');
        }
      });
    },

    async deleteFriendship() {
      try {
        await textsecure.messaging.deleteFriend(this.id);
      } catch (e) {
        console.log('delete contact error', e);
        throw e;
      }

      try {
        await this.destroyMessages(true, true);
        this.trigger('unload', 'delete messages');
      } catch (error) {
        console.log(
          'Failed to successfully delete conversation after delete contact'
        );
      }
    },

    async destroyMessages(isDestoryByServer, isDeleteFriendship) {
      await window.Signal.Data.removeAllMessagesInConversation(this.id, {
        MessageCollection: Whisper.MessageCollection,
      });
      this.messageCollection.reset([], { setBottomLoaded: true });

      this.set({
        lastMessage: null,
        // timestamp: null,
        isStick: undefined,
        unreadCount: 0,
      });

      if (!isDeleteFriendship) {
        this.set({
          timestamp: null,
        });
      }

      if (isDestoryByServer) {
        this.set({
          active_at: null,
        });
      }
      await window.Signal.Data.updateConversation(this.attributes);
    },

    async stickConversation(stick) {
      if (stick) {
        const count = await window.Signal.Data.getStickConversationCount();
        const globalConfig = window.getGlobalConfig();
        let { maxStickCount } = globalConfig;

        if (typeof maxStickCount !== 'number' || maxStickCount < 0) {
          maxStickCount = 6;
        }

        if (count >= maxStickCount) {
          setImmediate(() => {
            alert(i18n('stickMaxTips', maxStickCount));
          });
          return;
        }
      }

      if (stick) {
        this.set({
          active_at: Date.now(),
          isStick: true,
          isArchived: false,
        });
      } else {
        this.set({
          isStick: undefined,
          active_at: this.get('timestamp'),
        });
      }
      await window.Signal.Data.updateConversation(this.attributes);
    },
    async muteConversation(mute) {
      let muteStatus;
      if (mute === true) {
        muteStatus = 1;
      } else {
        muteStatus = 0;
      }

      try {
        await this.apiSetConfig({ muteStatus });
        window.getInboxCollection().updateUnreadCount();
      } catch (error) {
        log.error('set conversation setting: muteStatus failed.', error);
        // TODO: show error tips
      }
    },
    isBlocked() {
      return !!this.get('isBlock') || !!this.get('blockStatus');
    },
    async setBlockStatus(blocked) {
      if (!this.isPrivate()) {
        throw new Error('Could not set block status on group');
      }

      const blockStatus = blocked === true ? 1 : 0;

      try {
        await this.apiSetConfig({ blockStatus });
      } catch (error) {
        log.error('set conversation block: blockStatus failed.', error);
        throw new Error('Set block status failed');
      }
    },
    async setRemarkName(remark) {
      try {
        const encrypted = await this.encryptPrivateRemark(remark);
        await this.apiSetConfig({ remark: encrypted });
      } catch (error) {
        log.error('set conversation remark failed.', error);
      }
    },

    getRemarkName() {
      if (this.isPrivate()) {
        return this.get('remarkName');
      }
    },

    getAccountName() {
      if (this.isPrivate()) {
        let name = this.get('name');
        if (name) {
          return name;
        }

        name = this.get('groupDisplayName');
        if (!name && this.isMe()) {
          // prefer name from profileName when there isn't a name for self.
          name = this.get('profileName');
        }
        return name || this.getFakeName();
      }

      return this.get('name') || i18n('unknownGroup');
    },

    getName() {
      if (this.isPrivate()) {
        // group display name is the name from group display name
        // server promised that this name should be same for every group
        let name = this.get('remarkName');
        if (name) {
          return name;
        }

        name = this.get('name');
        if (name) {
          return name;
        }

        name = this.get('groupDisplayName');
        if (!name && this.isMe()) {
          // prefer name from profileName when there isn't a name for self.
          name = this.get('profileName');
        }
        return name || this.getFakeName();
      }

      return this.get('name') || i18n('unknownGroup');
    },

    getTitle() {
      if (this.isPrivate()) {
        let name = this.get('remarkName');
        if (name) {
          return name;
        }

        return this.get('name') || this.getFakeName();
      }
      return this.get('name') || i18n('unknownGroup');
    },

    getProfileName() {
      if (this.isPrivate() && !this.get('name')) {
        return this.get('profileName');
      }
      return null;
    },

    getDisplayName() {
      if (!this.isPrivate()) {
        return this.getTitle();
      }

      let name = this.get('remarkName');
      if (name) {
        return name;
      }

      name = this.get('name');
      if (name) {
        return name;
      }

      const profileName = this.get('profileName');
      if (profileName) {
        return `${this.getFakeName()} ~${profileName}`;
      }

      const groupDisplayName = this.get('groupDisplayName');
      if (groupDisplayName) {
        return groupDisplayName;
      }

      return this.getFakeName();
    },

    getNumber() {
      if (!this.isPrivate()) {
        return '';
      }
      const number = this.id;
      return number;
    },

    getInitials(name) {
      if (!name) {
        return null;
      }

      const cleaned = name.replace(/[^A-Za-z\s]+/g, '').replace(/\s+/g, ' ');
      const parts = cleaned.split(' ');
      const initials = parts.map(part => part.trim()[0]);
      if (!initials.length) {
        return null;
      }

      return initials.slice(0, 2).join('');
    },
    isPrivate() {
      return this.get('type') === 'private';
    },

    isDirectoryUser() {
      if (!this.isPrivate()) {
        return undefined;
      }

      return this.get('directoryUser');
    },

    isGroupV2() {
      return this.get('type') === 'group' && this.get('group_version') === 2;
    },

    isMeLeftGroup() {
      if (this.isPrivate()) {
        return false;
      }
      return this.get('left');
    },

    isGroupDisbanded() {
      if (this.isPrivate()) {
        return false;
      }

      return this.get('disbanded');
    },

    isAliveGroup() {
      if (this.isPrivate()) {
        return false;
      }

      if (this.isMeLeftGroup() || this.isGroupDisbanded()) {
        return false;
      }

      return true;
    },

    isAliveUser() {
      return !!this.isDirectoryUser();
    },

    isAliveConversation() {
      return this.isAliveUser() || this.isAliveGroup();
    },

    // generate groupV2 ID when group version V1
    // only useful when this conversation is upgraded from V1 group
    getGroupV2Id() {
      if (this.isPrivate()) {
        return null;
      }

      let id_v2 = this.get('id_v2');
      if (!id_v2) {
        id_v2 = window.Signal.ID.convertIdToV2(this.id);
        this.set({ id_v2 });
      }

      return id_v2;
    },

    getGroupOwnerId() {
      if (this.isPrivate()) {
        return false;
      }
      if (this.isMeLeftGroup()) {
        return false;
      }
      const membersV2 = this.get('membersV2') || [];
      const model = membersV2.filter(m => m.role === 0);
      if (model && model[0] && model[0].id) {
        return model[0].id;
      }
      return false;
    },

    getColor() {
      if (!this.isPrivate()) {
        return 'signal-blue';
      }

      const { migrateColor } = Util;
      return migrateColor(this.get('color'));
    },
    getPreferredAvatar() {
      return this.get('profileAvatar') || this.get('avatar');
    },
    getAvatarPath() {
      const avatar = this.getPreferredAvatar();

      if (avatar && avatar.path) {
        return getAbsoluteAttachmentPath(avatar.path);
      }

      return null;
    },
    getAvatar() {
      const title = this.get('name');
      const color = this.getColor();
      const avatar = this.getPreferredAvatar();

      if (avatar && avatar.path) {
        return { url: getAbsoluteAttachmentPath(avatar.path), color };
      } else if (this.isPrivate()) {
        return {
          color,
          content: this.getInitials(title) || '#',
        };
      }
      return { url: 'images/group_default.png', color };
    },
    getEmail() {
      return this.get('email');
    },
    getNotificationIcon() {
      return new Promise(resolve => {
        const avatar = this.getAvatar();
        if (avatar.url) {
          resolve(avatar.url);
        } else {
          resolve(new Whisper.IdenticonSVGView(avatar).getDataUrl());
        }
      });
    },

    getNotificationSettingText() {
      let notification = this.get('notification_setting');

      if (
        notification === undefined ||
        typeof notification != 'number' ||
        notification < 0 ||
        notification > NOTIFICATION_SETTING.length - 1
      ) {
        notification = 1;
      }

      return NOTIFICATION_SETTING[notification];
    },

    transformNotificationSetting(notification) {
      return NOTIFICATION_SETTING.indexOf(notification);
    },

    notify(message) {
      const isMute = this.get('isMute');
      if (isMute) {
        return Promise.resolve();
      }

      if (!message.isIncoming()) {
        return Promise.resolve();
      }

      if (!this.isPrivate()) {
        const notificationSetting = this.getNotificationSettingText();
        if (notificationSetting === 'none') {
          window.log.info('notification off, skipping ...');
          return Promise.resolve();
        } else if (notificationSetting === 'atme') {
          const atPersons = message.getAtPersons() || '';
          const atPersonArray = atPersons.split(';');
          if (
            !atPersonArray.includes(this.ourNumber) &&
            !atPersonArray.includes(window.Signal.ID.MENTIONS_ALL_ID)
          ) {
            return Promise.resolve();
          }

          window.log.info('At me, sending notification:', this.idForLogging());
        }
      }

      const conversationId = this.id;

      return ConversationController.getOrCreateAndWait(
        message.get('source'),
        'private'
      ).then(sender =>
        sender.getNotificationIcon().then(iconUrl => {
          const messageJSON = message.toJSON();
          const messageSentAt = messageJSON.sent_at;
          const messageId = message.id;
          const isExpiringMessage = Message.hasExpiration(messageJSON);

          window.log.info('Add notification', {
            conversationId: this.idForLogging(),
            isExpiringMessage,
            messageSentAt,
          });
          Whisper.Notifications.add({
            conversationId,
            iconUrl,
            isExpiringMessage,
            message: message.getNotificationText(),
            messageId,
            messageSentAt,
            title: this.getTitle(),
            sender: sender.getTitle(),
            isGroup: !this.isPrivate(),
          });
        })
      );
    },

    notifyTyping(options = {}) {
      // const { isTyping, sender, senderDevice } = options;

      // // We don't do anything with typing messages from our other devices
      // if (sender === this.ourNumber) {
      //   return;
      // }

      return;
    },

    //清空联系人信息
    async clearAttributesPrivate() {
      if (!this.isPrivate()) {
        throw new Error('update private attributes on group.');
      }

      const attributes = {};
      CONTACT_FIXED_ATTRS.forEach(attr => {
        attributes[attr] = null;
      });
      attributes.name = null;
      attributes.avatar = null;
      attributes.profileAvatar = null;
      attributes.email = null;
      this.set(attributes);

      await window.Signal.Data.updateConversation(this.attributes);
    },

    // directly update attributes value and do not tigger change event.
    // 更新联系人信息
    updateAttributesPrivate(contact, trigger_event = false) {
      if (!this.isPrivate()) {
        throw new Error('update private attributes on group.');
      }

      let update = false;
      let attributes = {};

      const assign = attr => {
        // lodash.isEqual perform deep comparison
        if (!_lodash.isEqual(contact[attr], this.attributes[attr])) {
          attributes[attr] = contact[attr];
          return true;
        }
        return false;
      };

      if (contact['joinedAt'] !== undefined) {
        update = true;
        attributes['joinedAt'] = contact['joinedAt'];
      }

      const emailHandler = attr => {
        let email = contact[attr] || '';
        if (typeof email === 'string') {
          email = email.toLowerCase();
          if (email !== this.attributes[attr]) {
            attributes[attr] = email;
            return true;
          }
        } else {
          log.warn('Unsupported email:', email, ' for number:', this.id);
        }

        return false;
      };

      const handlers = {
        email: emailHandler,
      };

      CONTACT_FIXED_ATTRS.forEach(attr => {
        const found = handlers[attr];
        const handler = typeof found === 'function' ? found : assign;
        if (handler(attr)) {
          update = true;
          log.info(`Update contact ${attr} for: ${this.idForLogging()}`);
        }
      });

      // makesure email lower case.
      if (attributes.email) {
        attributes.email = attributes.email.toLowerCase();
      }

      const { commonAvatar = {} } = contact;
      const { attachmentId } = this.attributes.commonAvatar || {};
      if (commonAvatar.attachmentId !== attachmentId) {
        attributes.commonAvatar = commonAvatar;
        update = true;
        log.info('Update contact commonAvatar for number: ', this.id);
      }

      // if (this.isMe() && contact.flag) {
      //   // flag for me
      // }

      // update directoryUser flag for friend user
      if (contact.friend && !this.attributes.directoryUser) {
        attributes.directoryUser = true;
        window.log.info('Update contact directory flag for number:', this.id);
        update = true;
      }

      if (update) {
        if (trigger_event) {
          this.set(attributes);
        } else {
          this.attributes = {
            ...this.attributes,
            ...attributes,
          };
        }
      }
      return update;
    },
    async sendPublishRuleMessage(publishRule) {
      // let conversation = this;
      // update groups
      const updates = {
        type: 'group',
        left: false,
        // active_at: Date.now(),
        isArchived: false,
        group_version: 2,
      };

      this.set({
        ...updates,
      });
      await window.Signal.Data.updateConversation(this.attributes);
      const groupUpdate = {
        publishRule: publishRule,
      };
      await this.updateGroup(groupUpdate);
    },
    updateAttributesGroup(group, trigger_event = false) {
      if (this.isPrivate()) {
        throw new Error('update group attributes on private.');
      }

      const update = {};

      const {
        name,
        commonAvatar = {},
        messageExpiry,
        remindCycle,
        invitationRule,
        anyoneRemove,
        linkInviteSwitch,
        rejoin,
        publishRule,
        anyoneChangeName,
        messageClearAnchor,
      } = group || {};

      if (name && name != this.get('name')) {
        update.name = name;
        log.info('Update group name to ', name, ' for:', this.idForLogging());
      }

      if (
        typeof messageExpiry === 'number' &&
        messageExpiry != this.attributes.messageExpiry
      ) {
        update.messageExpiry = messageExpiry;
        log.info('Update group messageExpiry ', 'for:', this.idForLogging());
      }

      if (
        _.isNumber(messageClearAnchor) &&
        messageClearAnchor > this.attributes.messageClearAnchor
      ) {
        update.messageClearAnchor = messageClearAnchor;
        log.info(
          'Update group messageClearAnchor ',
          'for:',
          this.idForLogging()
        );
      }

      // 会话的 remindCycle 可能会是 undefined， 这个时候推送过来的数据就一定跟现在的不相等。
      // 这里需要判断一下， 如果当前通知过来的 remindCycle 是 none， 可能是设置的，也可能是默认的。
      if (!this.attributes.remindCycle && remindCycle === 'none') {
        console.log(
          'conversation has no remindCycle, and receive notification remindCycle is none, skip.....'
        );
      } else {
        if (remindCycle != this.attributes.remindCycle) {
          log.info(
            'old remindCycle:',
            this.attributes.remindCycle,
            'new remindCycle: ',
            remindCycle
          );
          update.remindCycle = remindCycle;
          log.info('Update group remindCycle ', 'for:', this.idForLogging());
        }
      }

      if (
        typeof invitationRule === 'number' &&
        invitationRule != this.attributes.invitationRule
      ) {
        update.invitationRule = invitationRule;
        log.info('Update group invitationRule ', 'for:', this.idForLogging());
      }

      if (anyoneRemove !== this.attributes.anyoneRemove) {
        update.anyoneRemove = anyoneRemove;
        log.info('Update group anyoneRemove ', 'for:', this.idForLogging());
      }

      if (rejoin !== this.attributes.rejoin) {
        update.rejoin = rejoin;
        log.info('Update group rejoin ', 'for:', this.idForLogging());
      }

      if (linkInviteSwitch !== this.attributes.linkInviteSwitch) {
        update.linkInviteSwitch = linkInviteSwitch;
        log.info('Update group linkInviteSwitch ', 'for:', this.idForLogging());
      }

      if (
        typeof publishRule === 'number' &&
        publishRule != this.attributes.publishRule
      ) {
        update.publishRule = publishRule;
        log.info('Update group publishRule ', 'for:', this.idForLogging());
      }

      if (anyoneChangeName !== this.get('anyoneChangeName')) {
        update.anyoneChangeName = anyoneChangeName;
        log.info('Update group anyoneChangeName ', 'for:', this.idForLogging());
      }

      const { id: attachmentId } = this.attributes.commonAvatar || {};
      if (commonAvatar.id && commonAvatar.id != attachmentId) {
        update.commonAvatar = commonAvatar;
        log.info(
          'Update group avatar',
          `from ${attachmentId}`,
          `to ${commonAvatar.id}`,
          'for:',
          this.idForLogging()
        );
      }

      if (Object.keys(update).length) {
        if (trigger_event) {
          this.set(update);
        } else {
          this.attributes = {
            ...this.attributes,
            ...update,
          };
        }
        return update;
      } else {
        return null;
      }
    },

    parseGroupAvatar(avatar) {
      if (avatar) {
        try {
          const dataJson = JSON.parse(avatar);
          const dataDecoded = window.Signal.Crypto.base64Decode(dataJson.data);
          const avatarJson = JSON.parse(dataDecoded);

          // be careful: serverId in avatar should not be a number
          // because of Javascript limit, a number bigger then 2^53 - 1
          // JSON.parse do not exactly parse the number.
          return {
            id: avatarJson.serverId,
            key: avatarJson.encryptionKey,
            digest: avatarJson.digest,
            size: Number(avatarJson.byteCount),
            contentType: avatarJson.contentType,
            sourceFilename: avatarJson.sourceFilename,
          };
        } catch (error) {
          log.error('invalid group avatar:', avatar, error);
        }
      }
    },

    parsePrivateAvatar(avatar) {
      // be careful: attachmentId in avatar should not be a number
      // because of Javascript limit, a number bigger then 2^53 - 1
      // JSON.parse do not exactly parse the number.
      if (avatar) {
        try {
          return JSON.parse(avatar);
        } catch (error) {
          log.error('avatar is not valid JSON:', avatar, error);
        }
      }
    },

    updatePrivateAvatar(commonAvatar) {
      this.set({ commonAvatar });
    },

    async updateGroupAvatar(
      commonAvatar,
      encryptedBin,
      b64Key,
      b64Digest,
      imageByteCount
    ) {
      try {
        const groupIdV2 = this.getGroupV2Id();

        // 上传附件到 OSS
        const attachmentId =
          await textsecure.messaging.putAttachment(encryptedBin);

        await window
          .getAccountManager()
          .putGroupAvatar(
            attachmentId,
            b64Key,
            b64Digest,
            groupIdV2,
            imageByteCount
          );

        // 界面更新渲染
        commonAvatar.id = attachmentId;
        this.set({ commonAvatar });
      } catch (e) {
        window.log.error('update avatar error', e);
        setImmediate(() => {
          if (e && e.code === 413) {
            alert(i18n('profile_too_frequent'));
            return;
          }
          alert('Update avatar error:' + e?.message);
        });
      }
    },

    // query contact details from server, then set them into conversation
    // this function may takes a long time because of network request,
    // so, use it only when really need to update from server.
    async forceUpdatePrivateContact() {
      if (!this.isPrivate()) {
        return;
      }

      try {
        const result = await textsecure.messaging.fetchDirectoryContacts([
          this.id,
        ]);

        const contact = result.contacts[0];

        if (contact && contact.number === this.id) {
          const { avatar } = contact;
          contact.commonAvatar = this.parsePrivateAvatar(avatar);
          this.updateAttributesPrivate(contact, true);
        }
      } catch (error) {
        if (
          error.name === 'HTTPError' &&
          error.code === 400 &&
          error.response?.status === 2
        ) {
          this.clearAttributesPrivate();
        }
        log.error('contact update failed.', error);
      }
    },

    shouldBeAutoArchived() {
      // block conversation archive feature.
      return false;

      if (this.isMe()) {
        return false;
      }

      if (this.get('isStick')) {
        return false;
      }

      const activeAt = this.get('active_at');
      const delta = Date.now() - activeAt;

      const globalConfig = window.getGlobalConfig();
      const conversationTimer =
        globalConfig.disappearanceTimeInterval.conversation;

      let maxIdle;
      if (this.isMe()) {
        maxIdle = conversationTimer.me;
      } else if (!this.isPrivate()) {
        maxIdle = conversationTimer.group;
      } else {
        maxIdle = conversationTimer.other;
      }

      // convert second to milisecond
      maxIdle *= 1000;

      if (
        activeAt &&
        delta > maxIdle &&
        !this.get('isArchived') &&
        !(this.get('unreadCount') > 0)
      ) {
        log.info('should be auto archived:', this.idForLogging());
        return true;
      }

      return false;
    },

    onCheckArchive(doNext = true) {
      if (this.shouldBeAutoArchived()) {
        if (doNext) {
          setTimeout(() => this.onCheckArchive(false), 0);
        } else {
          this.setArchived(true);
          this.trigger('unload', 'auto-archived');
        }

        return;
      }
    },

    async setTranslateLang(targetLang) {
      if (Whisper.Translate.isSupported(targetLang)) {
        this.set({
          translateLang: targetLang,
        });

        if (this.hasChanged('translateLang')) {
          await window.Signal.Data.updateConversation(this.attributes);

          const timestamp = Date.now();
          await this.saveNewLocalMessage({
            conversationId: this.id,
            sent_at: timestamp,
            received_at: timestamp,
            conversationTranslateChange: targetLang,
            serverTimestamp: timestamp,
          });
        }

        return true;
      } else {
        log.error('unsupported language:', targetLang);
      }

      return false;
    },

    getTranslateLang() {
      return this.get('translateLang') || Whisper.Translate.getOffValue();
    },

    makeMessageCollapseId({ timestamp, source, sourceDevice }) {
      const combined = `${timestamp}${source}${sourceDevice}`;

      const data = new TextEncoder().encode(combined);
      const md5Buffer = window.digestMD5(data);
      const collapseId = md5Buffer.toString('hex');

      // return lower case
      return collapseId;
    },

    isUserInGroup(number) {
      if (this.isPrivate()) {
        return false;
      }
      if (this.contactCollection) {
        const contactModel = this.contactCollection.get(number);
        if (contactModel) {
          return true;
        }
      }
      return false;
    },

    getGroupContactModel(number) {
      if (this.isPrivate()) {
        throw new Error(
          'Cannot get group contact model for private conversation'
        );
      }

      let contactModel;
      if (this.contactCollection) {
        contactModel = this.contactCollection.get(number);
      }

      if (!contactModel) {
        contactModel = ConversationController.get(number);
      }

      return contactModel;
    },

    getConversationMessageExpiry(globalConfig) {
      if (!globalConfig) {
        globalConfig = window.getGlobalConfig();
      }

      let messageExpiry = this.get('messageExpiry');
      if (typeof messageExpiry === 'number' && messageExpiry >= 0) {
        // using messageExpiry
      } else {
        const messageTimer = globalConfig.disappearanceTimeInterval.message;
        if (this.isMe()) {
          messageExpiry = messageTimer.me;
        } else {
          messageExpiry = messageTimer.default;
        }
      }

      // currently do NOT support nerver expired in conversations except ME
      if (this.isMe()) {
        return messageExpiry;
      } else {
        // expireTimer default to 7days (seconds)
        return messageExpiry || 7 * 24 * 60 * 60;
      }
    },

    isBot() {
      return this.isPrivate() && window.Signal.ID.isBotId(this.id);
    },
    hasBot() {
      if (this.isPrivate()) {
        return window.Signal.ID.isBotId(this.id);
      } else {
        const members = this.get('members') || [];
        const bots = members.filter(m => window.Signal.ID.isBotId(m));
        return bots.length > 0;
      }
    },

    // // must using passed in model to get displayName for group
    // getDisplayNameForGroup(model) {
    //   if (model instanceof Whisper.Conversation && model.isPrivate()) {
    //     return model.getName() || model.displayName || model.getNumber();
    //   } else {
    //     log.error('getGroupDisplayName for error model.');
    //   }

    //   return '';
    // },

    async updateGroupContact() {
      if (this.isPrivate()) {
        return;
      }

      if (!this.isGroupV2()) {
        return;
      }

      const membersV2 = this.get('membersV2') || [];
      // async call, do not wait.
      await ConversationController.bulkFreshGroupContact(membersV2);
    },
    formatThreadMessages() {
      return this.threadModelCollection.models.map(model => {
        const lastMessage = model.get('lastMessage');
        const threadContext = lastMessage.get('threadContext');
        const { source, botId } = threadContext;

        return {
          firstMessageInfo: lastMessage.findAndFormatContact(source.source),
          lastMessageInfo: lastMessage.findAndFormatContact(
            lastMessage.getSource()
          ),
          botInfo: botId ? lastMessage.findAndFormatContact(botId) : null,
          threadMessage: lastMessage,
        };
      });
    },
    async getListThreadsWithMessage() {
      if (!this.threadModelCollection.hasLoadedFromDB) {
        try {
          const collection =
            await window.Signal.Data.listThreadsWithNewestMessage(this.id, {
              MessageCollection: Whisper.MessageCollection,
            });

          if (collection.length) {
            const models = collection.models.map(message =>
              MessageController.register(message.id, message)
            );

            const minModel = _.min(models, m => m.get('serverTimestamp'));
            const maxModel = _.max(models, m => m.get('serverTimestamp'));

            await this.loadReadPositions(
              minModel?.getServerTimestamp(),
              maxModel?.getServerTimestamp()
            );

            this.threadModelCollection.addOrUpdateThread(models);
          }

          this.threadModelCollection.hasLoadedFromDB = true;
        } catch (error) {
          log.error('handling list threads with message failed', error);
        }
      }
      if (!this.threadModelCollection.length) {
        return [];
      }

      return this.formatThreadMessages(this.threadModelCollection);
    },

    async onThreadChange(model) {
      // is private conversation, skip
      if (this.isPrivate()) {
        return;
      }

      await new Promise(r => setTimeout(r, 0));

      const collection = new Whisper.MessageCollection(
        model instanceof Array ? model : [model]
      );

      const needUpdates = [];
      const updateAndAddList = (message, newAttributes) => {
        message.set(newAttributes, { silent: false });
        if (!needUpdates.includes(message)) {
          needUpdates.push(message);
        }
      };

      const handleMessageFromBot = message => {
        // handle old bot message
        // only 1v1 bot message should be collected
        // all bot message should begain with 'Message from '
        const body = message.get('body') || '';
        if (!body.startsWith('Message from ') && !body.startsWith('From ')) {
          return;
        }

        // 1v1 bot auto-forward message
        // names maybe has /, we only treat it has group
        const matched =
          body.match(
            /^.*rom ((?<group>.*)\/)?(?<name>.*) \((?<id>\d+)\/.*\):(\n.*)+$/
          ) || {};
        const { group, id } = matched.groups || {};
        // only old non-group message should be set as thread.
        if (group || !id) {
          return;
        }

        // make threadContext
        const threadContext = {
          source: {
            source: id.startsWith('+') ? id : '+' + id,
          },
          botId: message.getSource(),
        };

        const newAttributes = {
          threadContext,
          threadReplied: true,
          threadId: message.makeThreadId(threadContext),
        };
        updateAndAddList(message, newAttributes);

        return;
      };

      const handleMessageAdded = async (message, depth, maxDepth) => {
        if (!message.get('id')) {
          log.error('message has no id:', message.idForLogging());
          return;
        }

        const walkMaxDepth = maxDepth || 50;
        const walkDepth = depth || 0;

        // max walk depth
        if (walkDepth > walkMaxDepth) {
          log.error('walk to max depth.');
          return;
        }

        // message is nonThread, no need to handle
        if (message.get('nonThread')) {
          return;
        }

        // already assigned thread
        const threadContext = message.get('threadContext');
        if (threadContext) {
          if (!message.get('botContext') && !message.get('threadReplied')) {
            updateAndAddList(message, { threadReplied: true });
          }

          //1.发： a. 我 /topic
          //      b。我 reply
          //2。收： a。别人 /topic
          //       b。别人 reply
          // 通过菜单中的reply按钮生成topic在这里处理
          const { topicId, supportType, replyToUser, source } = threadContext;
          // 问题群或者支持群，
          // topicId有值说明是topic消息
          // 只要不是从bot转发，并且不是回复给用户的消息，这里需要判断原始消息

          if (topicId && supportType === 0 && !replyToUser) {
            const original = await message.loadMessageByRealSource(source);
            // 自己/topic发的消息isUseTopicCommand为true，无需设置firstMessageTopicFlag
            // 自己reply，原始消息中的firstMessageTopicFlag 为 true，无需设置firstMessageTopicFlag
            // 我收的消息 ：
            //   1。别人/topic，因为isUseTopicCommand为true，所以无需设置firstMessageTopicFlag
            //   2。别人reply，这里需要设置firstMessageTopicFlag 为 true
            if (original) {
              const originalThreadContext = original.get('threadContext');
              const originalThreadReplied = original.get('threadReplied');

              if (!originalThreadContext || !originalThreadReplied) {
                const isUseTopicCommand = original.get('isUseTopicCommand');
                const firstMessageTopicFlag = original.get(
                  'firstMessageTopicFlag'
                );

                updateAndAddList(original, {
                  threadId: topicId,
                  threadContext: originalThreadContext || threadContext,
                  firstMessageTopicFlag:
                    !isUseTopicCommand && !firstMessageTopicFlag,
                  threadReplied: true,
                });
              }
            }
          }

          this.threadModelCollection.addOrUpdateThread(message);

          return;
        }

        // is message from bot
        if (window.Signal.ID.isBotId(message.getSource())) {
          handleMessageFromBot(message);
          return;
        }

        // quote message
        const quote = message.get('quote');
        if (!quote) {
          // mark as non-thread message
          updateAndAddList(message, { nonThread: true });
          return;
        }

        const { id, author } = quote;
        if (!id || !author) {
          // mark as non-thread message
          updateAndAddList(message, { nonThread: true });
          return;
        }

        // message replied by group members
        // try to find thread from quoted message
        // found: add message to thread
        // not found: do nothing
        const original = await message.loadMessageByRealSource(
          { source: author, timestamp: id },
          true
        );
        if (!original) {
          log.error('original message was not found.', message.idForLogging());
          return;
        }

        // add original message
        await handleMessageAdded(original, walkDepth + 1, walkMaxDepth);

        // handleQuoteMessage(message, original);
        return;
      };

      // get unreplied thread messages
      const threadUnreplied = collection.filter(model => {
        if (model.get('threadContext') && !model.get('threadReplied')) {
          return true;
        }

        return false;
      });

      threadUnreplied.reverse();

      const threadGroup = _.groupBy(threadUnreplied, model => {
        return model.get('threadId');
      });

      // handle thread messages first
      for (const threadId of Object.keys(threadGroup)) {
        const messages = threadGroup[threadId];
        for (const message of messages) {
          if (message.get('botContext')) {
            // bot message, search for future message in thread
            // 1 search more in conversation messageCollection serverTimestamp bigger than ours
            //    also if found one replied or non bot messages
            // 2 if conversation has no bottom loaded
            //    search in databases serverTimestamp bigger than ours
            const threadMessages = this.messageCollection.where({ threadId });
            if (threadMessages.length) {
              const lastOne = threadMessages[threadMessages.length - 1];
              if (
                lastOne.get('serverTimestamp') > message.get('serverTimestamp')
              ) {
                if (lastOne.get('threadReplied')) {
                  const updates = await this.markAllRelatedRepliedUnsaved(
                    threadId,
                    message.get('serverTimestamp')
                  );
                  updates.forEach(m => updateAndAddList(m, {}));
                }
                break;
              } else {
                // all message in messageCollection older than ours
              }
            } else {
              // no messages in messageCollection
            }

            if (this.hasBottomLoaded()) {
              // skip this
              continue;
            }

            // try to find one newer thread [non-bot] or [replied] message in db
            const messages = await window.Signal.Data.findNewerThreadReplied(
              this.id,
              threadId,
              {
                MessageCollection: Whisper.MessageCollection,
                serverTimestamp: message.get('serverTimestamp'),
              }
            );

            if (messages.length) {
              const updates = await this.markAllRelatedRepliedUnsaved(
                threadId,
                message.get('serverTimestamp')
              );
              updates.forEach(m => updateAndAddList(m, {}));
              break;
            }
          } else {
            // non-bot message, mark all older message in thread as replied
            const updates = await this.markAllRelatedRepliedUnsaved(
              threadId,
              message.get('serverTimestamp')
            );
            updates.forEach(m => updateAndAddList(m, {}));
            break;
          }
        }
      }

      for (const model of collection.models) {
        await handleMessageAdded(model);
      }

      if (needUpdates.length) {
        window.Signal.Data.saveMessagesWithBatcher(
          needUpdates.map(m => m.attributes)
        );
      }
    },
    getGroupHistoryMessage(serverTimestamp) {
      const filterMessages = this.messageCollection.models.filter(
        message =>
          (message.isOutgoing() || message.isIncoming()) &&
          !message.isRecallMessage() &&
          !message.isRecalledMessage() &&
          !message.isVote() &&
          !message.isTask() &&
          !message.isGroupUpdate() &&
          !message.threadOnly &&
          !message.isExpired() &&
          !(
            message.get('attachments').length === 1 &&
            window.Signal.Types.MIME.isAudio(
              message.get('attachments')[0].contentType
            ) &&
            window.Signal.Types.Attachment.isVoiceMessage(
              message.get('attachments')[0]
            )
          ) &&
          message.get('serverTimestamp') <= serverTimestamp &&
          !message.isScreenshotNotification()
      );

      let filteredArray;
      if (filterMessages.length <= 20) {
        filteredArray = filterMessages;
      } else {
        filteredArray = filterMessages.slice(-20);
      }
      return filteredArray;
    },

    async markAllRelatedRepliedUnsaved(threadId, serverTimestamp) {
      const sames = this.messageCollection.where({
        threadId,
        threadReplied: false,
      });

      sames.forEach(msg => msg.set({ threadReplied: true }));

      const messages = await window.Signal.Data.getThreadMessagesUnreplied(
        this.id,
        threadId,
        {
          MessageCollection: Whisper.MessageCollection,
          serverTimestamp,
          limit: 50,
        }
      );

      const models = messages
        .filter(message => Boolean(message.id))
        .map(message => MessageController.register(message.id, message))
        .filter(message => !sames.includes(message))
        .map(message => message.set({ threadReplied: true }));

      models.push(...sames);
      return models;
    },

    async markAllRelatedReplied(threadId, serverTimestamp) {
      const messages = await this.markAllRelatedRepliedUnsaved(
        threadId,
        serverTimestamp
      );
      window.Signal.Data.saveMessagesWithBatcher(
        messages.map(m => m.attributes)
      );
    },

    isChatWithoutReceipt() {
      if (this.isPrivate()) {
        return false;
      }

      const globalConfig = window.getGlobalConfig();
      const { chatWithoutReceiptThreshold } = globalConfig?.group || {};

      if (!chatWithoutReceiptThreshold) {
        return false;
      }

      // include ME
      const members = Array.from(new Set(this.get('members')));
      if (members.length >= chatWithoutReceiptThreshold) {
        return true;
      }

      return false;
    },
    async getGroupV2InviteMessage() {
      if (this.isPrivate()) {
        throw new Error(
          'Can not get group invite message on private conversation.'
        );
      }

      try {
        const inviteCode = await this.apiGetGroupV2InviteCode();
        if (!inviteCode) {
          throw new Error('server response empty invite code');
        }

        const groupLink = `temptalk://group/join?inviteCode=${inviteCode}`;
        const me = ConversationController.get(this.ourNumber);
        return `${me.getName()} invited you to "${this.getName()}", ${groupLink}`;
      } catch (error) {
        log.error('get invite code failed, ', error);
      }

      return '';
    },
    async syncArchiveConversation(flag) {
      const number = this.isPrivate() ? this.id : null;
      const groupId = this.isPrivate() ? null : this.id;

      const extension = {
        isPrivate: this.isPrivate(),
        conversationId: this.isPrivate() ? this.id : this.getGroupV2Id(),
      };

      try {
        const result = await textsecure.messaging.syncConversationArchive(
          number,
          groupId,
          flag,
          extension
        );
        const valueFromResult = fieldName => {
          if (result[fieldName]) {
            return result[fieldName];
          }

          const values = Object.values(result[`${fieldName}Map`] || {});
          if (values?.length) {
            return values[0];
          }

          return null;
        };

        const serverTimestamp = valueFromResult('serverTimestamp');
        if (!serverTimestamp) {
          return false;
        }

        this.set({ onArchiveAt: serverTimestamp });
        if (this.hasChanged()) {
          await window.Signal.Data.updateConversation(this.attributes);
        }

        return true;
      } catch (error) {
        log.error(
          'syncConversationArchive failed,',
          this.idForLogging(),
          flag,
          error
        );
      }
    },
    async syncMarkAsReadOrUnread(flag) {
      const number = this.isPrivate() ? this.id : null;
      const groupId = this.isPrivate() ? null : this.id;

      const extension = {
        isPrivate: this.isPrivate(),
        conversationId: this.isPrivate() ? this.id : this.getGroupV2Id(),
      };

      try {
        const result = await textsecure.messaging.syncMarkAsReadOrUnread(
          number,
          groupId,
          flag,
          extension
        );

        const valueFromResult = fieldName => {
          if (result[fieldName]) {
            return result[fieldName];
          }

          const values = Object.values(result[`${fieldName}Map`] || {});
          if (values?.length) {
            return values[0];
          }

          return null;
        };

        const serverTimestamp = valueFromResult('serverTimestamp');
        if (!serverTimestamp) {
          return false;
        }

        this.set({ markAsFlag: flag, markAsAt: serverTimestamp });
        if (this.hasChanged()) {
          await window.Signal.Data.updateConversation(this.attributes);
        }

        return true;
      } catch (error) {
        log.error(
          'syncMarkAsReadOrUnread failed,',
          this.idForLogging(),
          flag,
          error
        );
      }
    },
    async markAsUnread() {
      const unreadCount = this.get('unreadCount');
      if (unreadCount) {
        return;
      }

      const flagUnread =
        textsecure.protobuf.SyncMessage.MarkAsUnread.Flag.UNREAD;
      if (await this.syncMarkAsReadOrUnread(flagUnread)) {
        return;
      }
    },
    async markAsRead() {
      window.log.info('markAsRead clear unreadCount', this.idForLogging());

      if (!this.getDisplayUnreadCount()) {
        this.set({ unreadCount: 0 });
        if (this.hasChanged()) {
          await window.Signal.Data.updateConversation(this.attributes);
        }
        return;
      }

      this.set({ unreadCount: 0 });
      if (this.hasChanged()) {
        await window.Signal.Data.updateConversation(this.attributes);
      }

      await this.unmarkAsUnread();

      const flagRead = textsecure.protobuf.SyncMessage.MarkAsUnread.Flag.READ;
      await this.syncMarkAsReadOrUnread(flagRead);

      let lastIncoming;
      let lastNonOutgoing;

      if (this.hasBottomLoaded(false)) {
        const last = this.messageCollection.findLastMessageForMarkRead();
        lastIncoming = last?.lastIncoming;
        lastNonOutgoing = last?.lastNonOutgoing;
      }

      if (!lastIncoming) {
        const found = await this.findLastMessageForMarkRead();
        if (found) {
          lastIncoming = found.lastIncoming;

          const foundNonOutgoing = found.lastNonOutgoing;
          if (
            lastNonOutgoing &&
            foundNonOutgoing &&
            foundNonOutgoing.getServerTimestamp() >
              lastNonOutgoing.getServerTimestamp()
          ) {
            lastNonOutgoing = foundNonOutgoing;
          }
        }
      }

      const readAt = Date.now();
      if (lastIncoming) {
        await this.markReadAtMessage(lastIncoming, readAt);

        // add mark read at non-outgoing message
        if (
          lastNonOutgoing &&
          lastNonOutgoing.getServerTimestamp() >
            lastIncoming.getServerTimestamp()
        ) {
          await this.markReadAtMessage(lastNonOutgoing, readAt);
        }
      } else {
        if (lastNonOutgoing) {
          await this.markReadAtMessage(lastNonOutgoing, readAt);
        }

        log.info(
          'mark as read on conversation without incoming message',
          this.idForLogging()
        );
      }
    },
    async unmarkAsUnread() {
      const markAsFlag = this.get('markAsFlag');

      const flagUnread =
        textsecure.protobuf.SyncMessage.MarkAsUnread.Flag.UNREAD;
      if (markAsFlag !== flagUnread) {
        return;
      }

      const flagClear = textsecure.protobuf.SyncMessage.MarkAsUnread.Flag.CLEAR;
      if (await this.syncMarkAsReadOrUnread(flagClear)) {
        return;
      }
    },
    getDisplayUnreadCount() {
      const unreadCount = this.get('unreadCount') || 0;
      if (unreadCount) {
        return unreadCount;
      }

      const markAsAt = this.get('markAsAt');
      if (!markAsAt) {
        return 0;
      }

      const lastReadPosition = this.get('lastReadPosition');
      if (markAsAt < lastReadPosition?.maxServerTimestamp) {
        return 0;
      }

      const markAsFlag = this.get('markAsFlag');
      const flagUnread =
        textsecure.protobuf.SyncMessage.MarkAsUnread.Flag.UNREAD;
      if (markAsFlag === flagUnread) {
        return 1;
      }

      return 0;
    },
    async findLastMessageForMarkRead(serverTimestamp) {
      let lastIncoming;
      let lastNonOutgoing;

      // find last message from db
      const lastMessages = await window.Signal.Data.findLastMessageForMarkRead(
        this.id,
        {
          Message: Whisper.Message,
          serverTimestamp,
        }
      );

      if (lastMessages.length === 2) {
        lastIncoming = lastMessages[0];
        if (lastIncoming) {
          lastIncoming = MessageController.register(
            lastIncoming.id,
            lastIncoming
          );
        }

        lastNonOutgoing = lastMessages[1];
        if (lastNonOutgoing) {
          lastNonOutgoing = MessageController.register(
            lastNonOutgoing.id,
            lastNonOutgoing
          );
        }
      }

      return { lastIncoming, lastNonOutgoing };
    },

    async unBlockBySendMessage() {
      try {
        if (this.isBlocked()) {
          await this.setBlockStatus(false);

          if (!this.isBlocked()) {
            this.trigger('blockedToSend');
          }
        }
      } catch (e) {
        log.error('set conversation Unblock: blockStatus failed.', error);
      }
    },
    hasDraft() {
      return !!(this.get('draft') || this.get('draftQuotedMessageId'));
    },

    async updateLastMentions() {
      if (!this.get('unreadCount')) {
        this.set({ atPersons: null });
        return;
      }

      const lastReadPosition = await this.getLastReadPosition();
      const maxServerTimestamp = lastReadPosition?.maxServerTimestamp;

      const mentionsAtYouMessages =
        await window.Signal.Data.getMentionsAtYouMessage(this.id, {
          Message: Whisper.Message,
          serverTimestamp: maxServerTimestamp,
          limit: 1,
        });

      if (mentionsAtYouMessages?.length) {
        this.set({ atPersons: this.ourNumber });
        return;
      }

      const mentionsAtAllMessages =
        await window.Signal.Data.getMentionsAtAllMessage(this.id, {
          Message: Whisper.Message,
          serverTimestamp: maxServerTimestamp,
          limit: 1,
        });

      if (mentionsAtAllMessages?.length) {
        this.set({ atPersons: window.Signal.ID.MENTIONS_ALL_ID });
        return;
      }

      this.unset('atPersons');
    },
    async updateMessageExpiry(messageExpiry) {
      if (messageExpiry === this.get('messageExpiry')) {
        return;
      }

      try {
        if (this.isPrivate()) {
          await this.apiSetSharedConfig({ messageExpiry });
        } else {
          await this.apiEditGroupV2Meta(null, null, null, messageExpiry);
        }
      } catch (error) {
        log.error('set messsage expiry failed.', error);
        return;
      }

      this.set({ messageExpiry });
      window.Signal.Data.updateConversation(this.attributes);

      // const timestamp = Date.now();
      // await this.saveNewLocalMessage({
      //   sent_at: timestamp,
      //   received_at: timestamp,
      //   serverTimestamp: timestamp,
      //   messageExpiryUpdate: { messageExpiry },
      // });
    },

    async updateGroupReminder(remindCycle) {
      if (this.isPrivate()) return;
      if (remindCycle === this.get('remindCycle')) return;
      try {
        await this.apiEditGroupV2Meta(null, null, null, null, remindCycle);
        this.set({ remindCycle });
        window.Signal.Data.updateConversation(this.attributes);

        const globalConfig = window.getGlobalConfig();
        const reminderOptionValues =
          globalConfig?.group?.groupRemind?.remindCycle || [];
        if (
          !reminderOptionValues.includes(remindCycle) &&
          remindCycle !== 'none'
        ) {
          return;
        }
        const timestamp = Date.now();
        const name = i18n('you');

        await this.saveNewLocalMessage({
          sent_at: timestamp,
          serverTimestamp: timestamp,
          remindCycleUpdate: {
            remindCycle,
            name,
            type: 'immediate',
          },
        });
      } catch (error) {
        log.error('set remindCycle failed.', error);
      }
    },

    // save message that only local
    async saveNewLocalMessage(attributes) {
      // message with no sender
      const message = new Whisper.Message({
        received_at: Date.now(),
        expireTimer: this.getConversationMessageExpiry(),
        ...attributes,
        conversationId: this.id,
        unread: 1,
      });

      const id = await window.Signal.Data.saveMessage(message.attributes, {
        Message: Whisper.Message,
      });
      message.set({ id });
      MessageController.register(message.id, message);

      this.trigger('newmessage', message);

      return message;
    },

    async broughtToFront() {
      if (window.isOfflineMessageLoaded()) {
        return;
      }

      try {
        const uniformId = this.getUniformId();
        await textsecure.messaging.conversationToFront(
          uniformId.getIdForRestfulAPI()
        );
      } catch (error) {
        window.log.error('currentConversationToFront failed,', error);
      }
    },

    getTopicCompatible(threadContext) {
      return !!threadContext?.topicId;
    },

    getThreadCompatible(threadContext, botContext) {
      if (!threadContext) {
        return false;
      }

      // thread by user
      if (threadContext.type === 0) {
        return true;
      }

      // topic
      const { topicId } = threadContext;
      if (!topicId) {
        return true;
      }

      // 新版本DMTopic 和atbotTopic在支持群回复
      // 只要有botConText和threadConText，ze回复时两者都要发
      if (botContext && topicId) {
        return true;
      }

      return false;
    },
    getUniformId() {
      const combinedId = {};

      if (this.isPrivate()) {
        combinedId.number = this.id;
      } else {
        combinedId.groupId = this.id;
      }

      return window.Signal.ID.getUniformId(combinedId);
    },
    hasOlderUnloadedRemoteMessages() {
      // // the oldest sequence id in pullable messages, set by conversationInfo
      // const oldestRemoteMsgSeqId = this.get('oldestRemoteMsgSeqId');
      // if (!oldestRemoteMsgSeqId) {
      //   return false;
      // }

      // // the oldest sequence id of already loaded remote messages
      // const oldestLoadedMsgSeqId = this.get('oldestLoadedMsgSeqId');
      // if (
      //   !oldestLoadedMsgSeqId ||
      //   oldestLoadedMsgSeqId > oldestRemoteMsgSeqId
      // ) {
      //   return true;
      // }

      return false;
    },
    hasNewerUnloadedRemoteMessages() {
      // const latestRemoteMsgSeqId = this.get('latestRemoteMsgSeqId');
      // if (!latestRemoteMsgSeqId) {
      //   return false;
      // }

      // const latestLoadedMsgSeqId = this.get('latestLoadedMsgSeqId');
      // if (
      //   !latestLoadedMsgSeqId ||
      //   latestLoadedMsgSeqId < latestRemoteMsgSeqId
      // ) {
      //   return true;
      // }

      return false;
    },
    async apiGetSharedConfig() {
      if (!this.isPrivate()) {
        return;
      }

      try {
        const uniformId = this.getUniformId();
        const result = await textsecure.messaging.getConversationSharedConfig(
          uniformId.getIdForRestfulAPI(),
          true
        );

        const { conversations } = result;
        if (!conversations?.length) {
          return;
        }

        const {
          messageExpiry,
          ver: newVersion,
          askedVersion,
        } = conversations[0];

        const update = {};

        if (askedVersion) {
          // has friend requesting
          const latestAskedVersion = this.get('latestAskedVersion');
          if (!latestAskedVersion || latestAskedVersion <= askedVersion) {
            Object.assign(update, {
              latestAskedVersion: askedVersion,
            });
          }

          Object.assign(update, { friendRequesting: true });
        } else {
          // no friend requesting
          Object.assign(update, { friendRequesting: false });
        }

        if (this.get('sharedSettingVersion') != newVersion) {
          Object.assign(update, {
            messageExpiry,
            sharedSettingVersion: newVersion,
          });
        }

        if (Object.keys(update).length) {
          this.set(update);
          await window.Signal.Data.updateConversation(this.attributes);
        }
      } catch (error) {
        window.log.error(
          'apiGetSharedConfig failed,',
          Errors.toLogFormat(error)
        );
        throw new Error('api get shared config failed.');
      }
    },
    async apiSetSharedConfig(config) {
      if (!this.isPrivate()) {
        return;
      }

      let result;
      try {
        const uniformId = this.getUniformId();
        result = await textsecure.messaging.setConversationSharedConfig(
          uniformId.getIdForRestfulAPI(),
          config
        );
      } catch (error) {
        throw new Error(error);
      }

      const { ver, messageExpiry, messageClearAnchor } = result || {};
      const existVer = this.get('sharedSettingVersion');
      if (!existVer || ver > existVer) {
        this.set({
          sharedSettingVersion: ver,
        });

        if (_.isNumber(messageExpiry)) {
          this.set({ messageExpiry });
        }

        if (_.isNumber(messageClearAnchor)) {
          this.set({
            messageClearAnchor: Math.max(
              this.getMessageClearAnchor(),
              messageClearAnchor
            ),
          });
        }
      }
    },
    async updateConfig(configData, saveUpdates, forceUpdate) {
      if (!configData) {
        log.warn('empty config data.', this.idForLogging());
        return;
      }

      const existVersion = this.get('settingVersion');
      const { version: settingVersion } = configData;
      const {
        sourceDescribe,
        findyouDescribe,
        muteStatus,
        blockStatus,
        confidentialMode,
        remark,
      } = configData;

      if (existVersion > settingVersion) {
        log.info(
          'remote setting version is smaller.',
          existVersion,
          settingVersion,
          this.idForLogging()
        );
        return;
      } else if (existVersion === settingVersion && !forceUpdate) {
        log.info(
          'setting version is not changed.',
          settingVersion,
          this.idForLogging()
        );
        return;
      }

      const update = {};

      if (this.get('sourceDescribe') !== sourceDescribe) {
        Object.assign(update, { sourceDescribe });
      }

      if (this.get('findyouDescribe') !== findyouDescribe) {
        Object.assign(update, { findyouDescribe });
      }

      if (this.get('muteStatus') !== muteStatus) {
        Object.assign(update, { muteStatus, isMute: !!muteStatus });
      }

      if (this.get('blockStatus') !== blockStatus) {
        Object.assign(update, { blockStatus, isBlock: !!blockStatus });
      }

      if (this.isPrivate()) {
        try {
          const updateHash =
            await window.Signal.Types.Conversation.maybeUpdateRemark(
              this.attributes,
              remark
            );

          if (updateHash) {
            Object.assign(update, updateHash);

            if (remark) {
              const remarkName = await this.decryptPrivateRemark(remark);
              if (this.get('remarkName') !== remarkName) {
                Object.assign(update, { remarkName });
              }
            } else {
              Object.assign(update, { remarkName: null });
            }
          }
        } catch (error) {
          log.error(
            'update remark failed',
            Errors.toLogFormat(error),
            this.idForLogging()
          );
        }
      }

      if (this.get('confidentialMode') !== confidentialMode) {
        Object.assign(update, { confidentialMode });
      }

      if (Object.keys(update)?.length) {
        Object.assign(update, { settingVersion });

        if (saveUpdates) {
          this.set(update);
          await window.Signal.Data.updateConversation(this.attributes);
        }

        return update;
      }
    },
    async apiSetConfig(config) {
      let result;
      try {
        const uniformId = this.getUniformId();
        result = await textsecure.messaging.setConversationConfig(
          uniformId.getIdForRestfulAPI(),
          config
        );
      } catch (error) {
        log.error(
          'apiSetConfig failed',
          config,
          Errors.toLogFormat(error),
          this.idForLogging()
        );
        throw new Error(error);
      }
      return await this.updateConfig(result?.data, true);
    },

    async apiGetConfig() {
      let result;

      try {
        const uniformId = this.getUniformId();
        result = await textsecure.messaging.getConversationConfig(
          uniformId.getIdForRestfulAPI()
        );
      } catch (error) {
        log.error(
          'apiGetConfig failed',
          Errors.toLogFormat(error),
          this.idForLogging()
        );
        throw new Error(error);
      }

      const conversations = result?.data?.conversations;

      if (!conversations?.length) {
        const error = 'Server response invalid config data.';
        log.error(error, result);
        return;
      }
      const conversation = conversations?.[0];
      return await this.updateConfig(conversation, true, true);
    },
    async decryptPrivateRemark(remark) {
      if (!this.isPrivate()) {
        throw new Error('cannot decrypt private remark on group');
      }
      if (remark === '') {
        return '';
      }

      const key = textsecure.crypto.getRemarkNameKey(this.id);
      const decrypted = await textsecure.crypto.decryptRemarkName(remark, key);
      return Signal.Crypto.stringFromBytes(decrypted);
    },

    async encryptPrivateRemark(remark) {
      if (remark?.trim() === '') {
        return '';
      }
      const key = textsecure.crypto.getRemarkNameKey(this.id);
      const buffer = dcodeIO.ByteBuffer.wrap(remark).toArrayBuffer();
      return await textsecure.crypto.encryptRemarkName(buffer, key);
    },

    async sendConfidentialReadReceipt(message) {
      if (!message) {
        return;
      }

      const extension = {
        isPrivate: this.isPrivate(),
        conversationId: this.isPrivate() ? this.id : this.getGroupV2Id(),
      };

      try {
        const readPosition = {
          sourceDevice: this.getCurrentDeviceId(),
          conversationId: this.id,
          sender: message.getSource(),
          sentAt: message.get('sent_at'),
          readAt: Date.now(),
          maxServerTimestamp: message.getServerTimestamp(),
          messageType: message.get('type'),
          maxNotifySequenceId: message.get('notifySequenceId'),
        };

        await textsecure.messaging.sendReadReceipts(
          {
            sender: readPosition.sender,
            timestamps: [readPosition.sentAt],
            readPosition,
            messageMode: textsecure.protobuf.Mode.CONFIDENTIAL,
          },
          extension
        );
      } catch (error) {
        log.error(
          'sendConfidentialReadReceipt failed,',
          Errors.toLogFormat(error)
        );
      }
    },

    async syncConfidentialReadReceipt(message) {
      if (!message) {
        return;
      }

      const extension = {
        isPrivate: this.isPrivate(),
        conversationId: this.isPrivate() ? this.id : this.getGroupV2Id(),
      };

      try {
        const readPosition = {
          sourceDevice: this.getCurrentDeviceId(),
          conversationId: this.id,
          sender: message.getSource(),
          sentAt: message.get('sent_at'),
          readAt: Date.now(),
          maxServerTimestamp: message.getServerTimestamp(),
          messageType: message.get('type'),
          maxNotifySequenceId: message.get('notifySequenceId'),
        };

        await textsecure.messaging.syncReadMessages(
          [
            {
              sender: message.getSource(),
              timestamp: message.get('sent_at'),
              messageMode: textsecure.protobuf.Mode.CONFIDENTIAL,
              readPosition,
            },
          ],
          extension
        );
      } catch (error) {
        log.error(
          'syncConfidentialReadReceipt failed,',
          Errors.toLogFormat(error)
        );
      }
    },

    async sendFriendRequest() {
      if (!this.isPrivate()) {
        throw new Error('can not call sendFriendRequest on group');
      }

      if (this.isDirectoryUser()) {
        return;
      }

      const friendSource = window.conversationFrom?.isSend
        ? {
            type: window.conversationFrom.type,
            groupID: window.conversationFrom.id,
          }
        : null;

      try {
        await textsecure.messaging.sendFriendRequest(this.id, friendSource);
      } catch (error) {
        log.error('failed to send friend request', this.idForLogging(), error);
        throw error;
      }
    },
    async acceptFriendRequest() {
      if (!this.isPrivate()) {
        throw new Error('can not call acceptFriendRequest on group');
      }

      try {
        await textsecure.messaging.sendFriendRequest(this.id, null, 'accept');
      } catch (error) {
        log.error(
          'failed to accept friend request',
          this.idForLogging(),
          error
        );
        throw new Error('failed to accept friend request');
      }
    },
    async reportAbnormalUser(type, reason, block) {
      if (!this.isPrivate()) {
        throw new Error('can not call reportAbnormalUser on group');
      }

      try {
        await textsecure.messaging.reportAbnormalUser(
          this.id,
          type,
          reason,
          block
        );
      } catch (error) {
        log.error('failed to report abnormal user', this.idForLogging(), error);
        throw new Error('failed to report abnormal user');
      }
    },
    isFriendRequesting() {
      if (!this.isPrivate()) {
        return false;
      }

      if (this.isDirectoryUser()) {
        return false;
      }

      return !!this.get('friendRequesting');
    },
    async setConfidentialMode(confidentialMode) {
      try {
        await this.apiSetConfig({ confidentialMode: confidentialMode });
      } catch (error) {
        log.error('set conversation set: confidentialMode failed.', error);
      }

      // if (this.hasChanged('confidentialMode')) {
      //通知功能后续改
      // const timestamp = Date.now();
      // await this.saveNewLocalMessage({
      //   conversationId: this.id,
      //   sent_at: timestamp,
      //   received_at: timestamp,
      //   confidentialMode: confidentialMode,
      //   serverTimestamp: timestamp,
      // });
      // }
      return true;
    },

    async markReadConfidentialMessage(message) {
      if (!message || !message.isConfidentialMessage()) {
        return;
      }

      try {
        //追加message 读取流程
        this.markReadAtMessage(message, Date.now(), {
          sendReadReceipts: false,
        });
        //已读回执
        await this.sendConfidentialReadReceipt(message);
        //已读同步
        await this.syncConfidentialReadReceipt(message);
        // add to read list
        this.readConfidentiaMessageList.push(message);
      } catch (error) {
        log.error(
          'send/sync ConfidentialReadReceipt failed',
          Errors.toLogFormat(err),
          message.idForLogging(),
          this.idForLogging()
        );
        return;
      }
    },

    hasConfidentialMessageRead(message) {
      if (!message?.isConfidentialMessage()) {
        return false;
      }

      return this.readConfidentiaMessageList.includes(message);
    },

    clearReadConfidentialMessages() {
      const list = this.readConfidentiaMessageList;
      if (list?.length) {
        // message had been deleted when it was seen
        list.forEach(message => this.trigger('expired', message));
      }

      this.readConfidentiaMessageList = [];
    },
    getIdentityKeyResetAt() {
      return this.get('identityKeyResetAt') || 0;
    },
    getMessageClearAnchor() {
      return this.get('messageClearAnchor') || 0;
    },
  });

  Whisper.ConversationCollection = Backbone.Collection.extend({
    model: Whisper.Conversation,

    comparator(m) {
      return -m.get('timestamp');
    },

    async destroyAll() {
      await Promise.all(
        this.models.map(conversation =>
          window.Signal.Data.removeConversation(conversation.id, {
            Conversation: Whisper.Conversation,
          })
        )
      );
      this.reset([]);
    },
  });

  Whisper.Conversation.COLORS = COLORS.concat(['grey', 'default']).join(' ');
})();
