/* global
  _,
  Backbone,
  storage,
  filesize,
  ConversationController,
  MessageController,
  getAccountManager,
  i18n,
  Signal,
  textsecure,
  Whisper
*/

/* eslint-disable more/no-then */

// eslint-disable-next-line func-names
(function () {
  'use strict';

  window.Whisper = window.Whisper || {};

  const {
    Message: TypedMessage,
    Contact,
    PhoneNumber,
    Errors,
    Mentions,
  } = Signal.Types;

  const {
    deleteExternalMessageFiles,
    getAbsoluteAttachmentPath,
    loadAttachmentData,
    loadQuoteData,
    upgradeMessageSchema,
    loadForwardContextData,
  } = window.Signal.Migrations;
  const { bytesFromString } = window.Signal.Crypto;

  window.AccountCache = Object.create(null);
  window.AccountJobs = Object.create(null);

  const REACTION_EMOJIS = [
    '👍',
    '😄',
    '😢',
    '👌',
    '🎉',
    '😂',
    '❤️',
    '🤝',
    '👏',
    '✅',
    '🔥',
    '🙏',
  ];

  window.doesAcountCheckJobExist = number =>
    Boolean(window.AccountJobs[number]);
  window.checkForSignalAccount = number => {
    if (window.AccountJobs[number]) {
      return window.AccountJobs[number];
    }

    let job;
    if (textsecure.messaging) {
      // eslint-disable-next-line more/no-then
      job = textsecure.messaging
        .getProfile(number)
        .then(() => {
          window.AccountCache[number] = true;
        })
        .catch(() => {
          window.AccountCache[number] = false;
        });
    } else {
      // We're offline!
      job = Promise.resolve().then(() => {
        window.AccountCache[number] = false;
      });
    }

    window.AccountJobs[number] = job;

    return job;
  };

  window.isSignalAccountCheckComplete = number =>
    window.AccountCache[number] !== undefined;
  window.hasSignalAccount = number => window.AccountCache[number];

  window.Whisper.Message = Backbone.Model.extend({
    initialize(attributes) {
      if (_.isObject(attributes)) {
        this.set(
          TypedMessage.initializeSchemaVersion({
            message: attributes,
            logger: window.log,
          })
        );
      }

      this.OUR_NUMBER = textsecure.storage.user.getNumber();

      this.on('destroy', this.onDestroy);
      this.on('change:expirationStartTimestamp', this.setToExpire);
      this.on('change:expireTimer', this.setToExpire);
      this.on('unload', this.unload);
      this.on('expired', this.onExpired);
      this.on('change:threadId', () =>
        this.getConversation()?.trigger('messageThreadIdChanged', this)
      );

      this.updateExpirationStartTimestamp();
      this.updateExpiresAtMs();
      this.setToExpire();

      // Keep props ready
      const generateProps = () => {
        if (this.isUnsupportedMessage()) {
          this.propsForMessage = this.getPropsForUnsupportedMessage();
        } else if (this.isExpirationTimerUpdate()) {
          this.propsForTimerNotification = this.getPropsForTimerNotification();
        } else if (this.isTips()) {
          this.propsForTipsNotification = this.getPropsTipsNotification();
        } else if (this.isKeyChange()) {
          this.propsForSafetyNumberNotification =
            this.getPropsForSafetyNumberNotification();
        } else if (this.isVerifiedChange()) {
          this.propsForVerificationNotification =
            this.getPropsForVerificationNotification();
        } else if (this.isEndSession()) {
          this.propsForResetSessionNotification =
            this.getPropsForResetSessionNotification();
        } else if (this.isGroupUpdate()) {
          this.propsForGroupNotification = this.getPropsForGroupNotification();
        } else if (this.isRecallMessage()) {
          this.propsForRecallMessageNotification =
            this.getPropsForRecallMessageNotification();
        } else if (this.isConversationTranslateChange()) {
          this.propsForTranslateChangeNotification =
            this.getPropsForTranslateChangeNotification();
        } else if (this.isMessageExpiryUpdate()) {
          this.propsForMessageExpiryNotification =
            this.getPropsForMessageExpiryNotification();
        } else if (this.isRemindCycleUpdate()) {
          this.propsForRemindCycleNotification =
            this.getPropsForRemindCycleNotification();
        } else if (this.isReminderNotifyUpdate()) {
          this.propsForReminderNotification =
            this.getPropsForReminderNotification();
        } else if (this.isScreenshotNotification()) {
          this.propsForScreenshotNotification =
            this.getPropsForScreenshotNotification();
        } else if (this.isIdentityKeyResetNotification()) {
          this.propsForIdentityKeyResetNotification =
            this.getPropsForIdentityKeyResetNotification();
        } else {
          // comment this, because it's not used for now.
          // this.propsForSearchResult = this.getPropsForSearchResult();
          this.propsForMessage = this.getPropsForMessage();
        }
      };

      this.forceGenerateProps = generateProps;

      this.on('change change:serverTimestamp', generateProps);

      // reload current message
      this.on('change:serverTimestamp', () => {
        // must resort collection immidiately
        this.trigger('resort', this);

        ///reload message
        this.trigger('reload-message', this);
      });

      const applicableConversationChanges =
        'change:color change:name change:number change:profileName change:remarkName ' +
        'change:profileAvatar change:avatar change:commonAvatar update_view change:external';

      const listenToConversation = () => {
        if (this.conversation?.id === this.get('conversationId')) {
          return;
        }

        if (this.conversation) {
          this.stopListening(this.conversation);
        }

        const conversation = this.getConversation();
        if (conversation) {
          this.conversation = conversation;

          this.listenTo(conversation, 'change:external', () => {
            generateProps();
            this.trigger('change:external');
          });

          this.listenTo(
            conversation,
            applicableConversationChanges,
            generateProps
          );

          this.listenTo(conversation, 'new-read-position', newPositions => {
            if (this.hasExpired) {
              this.stopListening(conversation, 'new-read-position');
              return;
            }

            if (this.updateExpirationStartTimestamp(newPositions)) {
              this.updateExpiresAtMs();
              this.trigger('update-expiration-timestamp');

              if (this.isExpired()) {
                this.onExpired();
                this.trigger('change');
              }
            }
          });

          this.listenTo(
            conversation,
            'change:identityKeyResetAt change:messageClearAnchor',
            () => {
              if (this.isExpired()) {
                this.onExpired();
                this.trigger('change');
              }
            }
          );

          this.listenTo(conversation, 'change:messageExpiry', () => {
            this.updateExpiresAtMs();
            this.trigger('update-expiration-timestamp');
            if (this.isExpired()) {
              this.onExpired();
              this.trigger('change');
            }
          });
        }
      };

      listenToConversation();
      this.on('change:conversationId', listenToConversation);

      const fromContact = this.getContact();
      if (fromContact) {
        this.listenTo(
          fromContact,
          applicableConversationChanges,
          generateProps
        );
      }

      const includeContact = this.getIncludeContact();
      if (includeContact) {
        this.listenTo(
          includeContact,
          applicableConversationChanges,
          generateProps
        );
      }

      generateProps();
    },
    idForLogging() {
      return (
        `${this.get('source')}.${this.get('sourceDevice')} ` +
        `${this.get('sent_at')} ` +
        `(${this.getServerTimestamp()} ` +
        `${this.get('notifySequenceId')} ` +
        `${this.get('sequenceId')}) ` +
        `${this.get('conversationId')} ` +
        `${this.get('threadId') || ''}`
      );
    },
    defaults() {
      return {
        timestamp: new Date().getTime(),
        attachments: [],
      };
    },
    validate(attributes) {
      const required = ['conversationId', 'received_at', 'sent_at'];
      const missing = _.filter(required, attr => !attributes[attr]);
      if (missing.length) {
        window.log.warn(`Message missing attributes: ${missing}`);
      }
    },
    isSystemNotification() {
      return (
        this.isScreenshotNotification() ||
        this.isGroupUpdate() ||
        this.isExpirationTimerUpdate() ||
        this.isTips() ||
        this.isKeyChange() ||
        this.isEndSession() ||
        this.isConversationTranslateChange() ||
        this.isMessageExpiryUpdate() ||
        this.isRemindCycleUpdate() ||
        this.isReminderNotifyUpdate() ||
        this.isVerifiedChange() ||
        this.isRecallMessage() ||
        this.isIdentityKeyResetNotification()
      );
    },
    isEndSession() {
      const flag = textsecure.protobuf.DataMessage.Flags.END_SESSION;
      // eslint-disable-next-line no-bitwise
      return !!(this.get('flags') & flag);
    },
    isExpirationTimerUpdate() {
      const flag =
        textsecure.protobuf.DataMessage.Flags.EXPIRATION_TIMER_UPDATE;
      // eslint-disable-next-line no-bitwise
      return !!(this.get('flags') & flag);
    },
    isGroupUpdate() {
      return !!this.get('group_update');
    },
    isIncoming() {
      return this.get('type') === 'incoming';
    },
    isUnread() {
      return !!this.get('unread');
    },
    isNoNeedReceipts() {
      return !!this.get('noNeedReceipts');
    },
    isForwardable() {
      if (this.isUnsupportedMessage()) {
        return false;
      }

      if (this.isEndSession()) {
        return false;
      }

      if (this.isExpirationTimerUpdate()) {
        return false;
      }

      if (this.isTips()) {
        return false;
      }

      if (this.isKeyChange()) {
        return false;
      }

      if (this.isEndSession()) {
        return false;
      }

      if (this.isGroupUpdate()) {
        return false;
      }

      if (this.isRecallMessage()) {
        return false;
      }

      // task message cannot be forwarded
      if (this.get('task')) {
        return false;
      }

      // vote(poll) message cannot be forwarded
      if (this.get('vote')) {
        return false;
      }

      // card message can be forwarded
      if (this.get('card')) {
        return true;
      }

      const attachments = this.get('attachments') || [];
      if (attachments.length > 0) {
        // voice message cannot forwarded
        if (attachments.some(window.Signal.Types.Attachment.isVoiceMessage)) {
          return false;
        }
      }

      if (this.isIncoming() || this.isOutgoing()) {
        return true;
      }

      return false;
    },
    isMessageExpiryUpdate() {
      return !!this.get('messageExpiryUpdate');
    },
    isRemindCycleUpdate() {
      return !!this.get('remindCycleUpdate');
    },
    isReminderNotifyUpdate() {
      return !!this.get('reminderNotifyUpdate');
    },
    isScreenshotNotification() {
      return !!this.get('screenshot');
    },
    isIdentityKeyResetNotification() {
      return !!this.get('identityKeyReset');
    },
    // Important to allow for this.unset('unread'), save to db, then fetch()
    // to propagate. We don't want the unset key in the db so our unread index
    // stays small.
    merge(model) {
      const attributes = model.attributes || model;

      const { unread } = attributes;
      if (typeof unread === 'undefined') {
        this.unset('unread');
      }

      // do not use incomming attributes, may different current
      // this.set(attributes);
    },
    getNameForNumber(number) {
      const conversation = ConversationController.get(number);
      if (!conversation) {
        return number;
      }
      return conversation.getDisplayName();
    },
    getDescription(useGenericAttachment) {
      if (this.isGroupUpdate()) {
        const groupUpdate = this.get('group_update');

        if (groupUpdate.normalString) {
          return groupUpdate.normalString;
        }

        if (groupUpdate.agendaURL) {
          return groupUpdate.agendaURL;
        }

        // 群主转移
        if (groupUpdate.changeOwner) {
          if (groupUpdate.changeOwner === this.OUR_NUMBER) {
            return i18n('becomeNewOwnerOfTheGroup', i18n('you'));
          }
          return i18n(
            'becomeNewOwnerOfTheGroup',
            this.getNameForNumber(groupUpdate.changeOwner)
          );
        }

        if (groupUpdate.publishRule && !groupUpdate.joined) {
          if (groupUpdate.publishRule !== 2) {
            return i18n('onlyOwnerOrAdminCanSpeak');
          } else {
            return i18n('everyoneCanSpeak');
          }
        }

        if (groupUpdate.disbanded) {
          if (groupUpdate.isDisbandByOwner) {
            return i18n('groupDisbandedByOwner');
          }
          return i18n('groupDisbanded');
        }

        if (groupUpdate.left === 'You') {
          return i18n('youLeftTheGroup');
        } else if (groupUpdate.left) {
          return i18n('leftTheGroup', this.getNameForNumber(groupUpdate.left));
        }

        const messages = [];
        if (
          !groupUpdate.name &&
          !groupUpdate.joined &&
          !groupUpdate.removed &&
          !groupUpdate.addAdmins &&
          !groupUpdate.removeAdmins &&
          !groupUpdate.avatar
        ) {
          messages.push(i18n('updatedTheGroup'));
        }

        if (groupUpdate.name) {
          const { name, operator } = groupUpdate;
          if (operator) {
            // let someone;
            // if (operator === this.OUR_NUMBER) {
            //   someone = i18n('you');
            // } else {
            //   someone = this.getNameForNumber(operator);
            // }

            const someone = this.getNameForNumber(operator);
            messages.push(i18n('titleChangedBySomeone', [someone, name]));
          } else {
            messages.push(i18n('titleIsNow', name));
          }
        }
        if (groupUpdate.avatar) {
          messages.push(i18n('groupAvatarChange'));
        }

        const joined = groupUpdate.joined;
        if (joined && joined.length) {
          if (joined.includes(this.OUR_NUMBER)) {
            messages.push(i18n('youJoinedTheGroup'));
          }

          const names = _.map(
            joined.filter(m => m != this.OUR_NUMBER),
            this.getNameForNumber.bind(this)
          );

          if (names.length > 1) {
            messages.push(i18n('multipleJoinedTheGroup', names.join(', ')));
          } else if (names.length === 1) {
            messages.push(i18n('joinedTheGroup', names[0]));
          }
        }

        const removed = groupUpdate.removed;
        const inviteCode = groupUpdate.inviteCode;
        if (removed && removed.length) {
          if (removed.includes(this.OUR_NUMBER)) {
            const rejoin = inviteCode ? '. Rejoin' : '';
            messages.push(i18n('youWereRemovedFromTheGroup') + rejoin);
          }

          const names = _.map(
            removed.filter(m => m != this.OUR_NUMBER),
            this.getNameForNumber.bind(this)
          );

          if (names.length > 1) {
            messages.push(
              i18n('multipleRemovedFromTheGroup', names.join(', '))
            );
          } else if (names.length === 1) {
            messages.push(i18n('removedFromTheGroup', names[0]));
          }
        }

        const addAdmins = groupUpdate.addAdmins;
        if (addAdmins && addAdmins.length) {
          if (addAdmins.includes(this.OUR_NUMBER)) {
            messages.push(i18n('becomeNewAdminOfTheGroup', i18n('you')));
          }

          const names = _.map(
            addAdmins.filter(m => m != this.OUR_NUMBER),
            this.getNameForNumber.bind(this)
          );

          if (names.length > 1) {
            messages.push(i18n('becomeNewAdminOfTheGroup', names.join(', ')));
          } else if (names.length === 1) {
            messages.push(i18n('becomeNewAdminOfTheGroup', names[0]));
          }
        }

        const removeAdmins = groupUpdate.removeAdmins;
        if (removeAdmins && removeAdmins.length) {
          if (removeAdmins.includes(this.OUR_NUMBER)) {
            messages.push(i18n('removeAdminOfTheGroup', i18n('you')));
          }

          const names = _.map(
            removeAdmins.filter(m => m != this.OUR_NUMBER),
            this.getNameForNumber.bind(this)
          );

          if (names.length > 1) {
            messages.push(
              i18n('removeAdminOfTheGroupMultiple', names.join(', '))
            );
          } else if (names.length === 1) {
            messages.push(i18n('removeAdminOfTheGroup', names[0]));
          }
        }

        return messages.join(', ');
      }

      if (this.isConfidentialMessage()) {
        return i18n('confidential-message-description');
      }

      if (this.isEndSession()) {
        return i18n('sessionEnded');
      }

      if (this.isIncoming() && this.hasErrors()) {
        return i18n('incomingError');
      }

      if (this.isUnsupportedMessage()) {
        return i18n('unsupportedMessageTip');
      }

      if (this.isTips()) {
        let text;
        if (this.get('code') === 404) {
          text = i18n('number_not_register_error');
        }
        if (this.get('code') === 430) {
          text = i18n('different_subteam_error');
        }
        if (this.get('code') === 431) {
          text = i18n('number_not_active_error');
        }
        if (this.get('code') === 432) {
          text = i18n('number_not_friend_error');
        }
        return text;
      }

      if (this.isRecallMessage()) {
        const source = this.getSource();
        if (source === this.OUR_NUMBER) {
          return i18n('youRecalledAMessage');
        } else {
          return i18n(
            'recalledAMessage',
            '"' + this.getNameForNumber(source) + '"'
          );
        }
      }

      const { forwards } = this.get('forwardContext') || {};
      if (forwards && forwards.length > 0) {
        return i18n('placeholderWrapperForChatHistory');
      }

      const contacts = this.get('contacts');
      if (contacts && contacts.length) {
        return i18n('shortForContactMessage');
      }

      const task = this.get('task');
      if (task) {
        return i18n('shortForTaskMessage');
      }

      const vote = this.get('vote');
      if (vote) {
        return i18n('shortForPollMessage');
      }

      // const card = this.get('card');
      // if (card) {
      //   if (!card.contentType || card.contentType === 0) {
      //     return card.content;
      //   } else {
      //     return i18n('unsupportedMessageTip');
      //   }
      //   // return i18n('shortForCardMessage');
      // }

      if (this.isConversationTranslateChange()) {
        return this.getTranslationChangeTitle();
      }

      if (this.isMessageExpiryUpdate()) {
        const { messageExpiry } = this.get('messageExpiryUpdate');
        return i18n('messageExpiryUpdated', [
          Signal.Util.humanizeSeconds(messageExpiry),
        ]);
      }

      if (this.isRemindCycleUpdate()) {
        const { remindCycle, name, type } =
          this.getPropsForRemindCycleNotification();
        if (type === 'cycle') {
          const lang = window.getLocalLanguage();
          if (lang === 'zh-CN') {
            return (
              i18n(remindCycle + '_time_tip') +
              i18n('group_remind') +
              "Don't forget to update!"
            );
          } else {
            return (
              i18n(remindCycle + '_time_tip') +
              i18n('group_remind') +
              "Don't forget to update!"
            );
          }
        } else if (type === 'immediate') {
          if (remindCycle === 'none') {
            return name + i18n('turn_off_remind_cycle_tip');
          } else if (remindCycle === 'daily') {
            return (
              name +
              i18n('remind_cycle_tip', [i18n('daily_time_tip')]) +
              "Don't forget to update!"
            );
          } else if (remindCycle === 'weekly') {
            return (
              name +
              i18n('remind_cycle_tip', [i18n('weekly_time_tip')]) +
              "Don't forget to update!"
            );
          } else if (remindCycle === 'monthly') {
            return (
              name +
              i18n('remind_cycle_tip', [i18n('monthly_time_tip')]) +
              "Don't forget to update!"
            );
          }
        }
      }

      if (this.isReminderNotifyUpdate()) {
        const { description, creatorName, displayText } =
          this.getPropsForReminderNotification();
        // return `${i18n('reminderBy')} @${creatorName}: ${description}`;
        return displayText;
      }

      if (this.isScreenshotNotification()) {
        const source = this.getSource();
        if (source === this.OUR_NUMBER) {
          return i18n('tookAScreenshot', i18n('you'));
        } else {
          return i18n(
            'tookAScreenshot',
            '"' + this.getNameForNumber(source) + '"'
          );
        }
      }

      const description = this.getAttachmentsDescription(
        this.get('attachments'),
        useGenericAttachment
      );
      return description + (this.get('body') || '');
    },
    getAttachmentsDescription(attachments, useGenericAttachment) {
      if (!attachments || attachments.length <= 0) {
        // no valid attachments
        return '';
      }

      if (attachments.length === 1 && !useGenericAttachment) {
        const firstAttachment = attachments[0];
        const { contentType } = firstAttachment;

        if (window.Signal.Util.GoogleChrome.isImageTypeSupported(contentType)) {
          return i18n('shortForImage');
        }

        if (
          window.Signal.Types.MIME.isAudio(contentType) &&
          window.Signal.Types.Attachment.isVoiceMessage(firstAttachment)
        ) {
          return i18n('shortForVoice');
        }

        if (window.Signal.Types.MIME.isAudio(contentType)) {
          return i18n('shortForAudio');
        }

        if (window.Signal.Util.GoogleChrome.isVideoTypeSupported(contentType)) {
          return i18n('shortForVideo');
        }
      }

      return i18n('shortForAttachment');
    },
    isVerifiedChange() {
      return this.get('type') === 'verified-change';
    },
    isKeyChange() {
      return this.get('type') === 'keychange';
    },
    isTips() {
      return this.get('type') === 'tips';
    },
    isForwardMessage() {
      const { forwards } = this.get('forwardContext') || {};
      return forwards instanceof Array && forwards.length > 0;
    },
    isRecallMessage() {
      return !!this.get('recall');
    },
    isVote() {
      return !!this.get('vote');
    },
    isTask() {
      return !!this.get('task');
    },
    isRecalledMessage() {
      return !!this.get('recalled');
    },
    isContactMessage() {
      const contacts = this.get('contacts');
      return contacts instanceof Array && contacts.length > 0;
    },
    isConversationTranslateChange() {
      return !!this.get('conversationTranslateChange');
    },
    getAtPersons() {
      return this.get('atPersons') || '';
    },
    getNotificationText() {
      const description = this.getDescription();
      if (description) {
        if (
          !this.isConversationTranslateChange() &&
          !this.isMessageExpiryUpdate() &&
          !this.isRemindCycleUpdate() &&
          !this.isGroupUpdate() &&
          !this.isEndSession() &&
          !this.hasErrors() &&
          !this.isTips() &&
          !this.isReminderNotifyUpdate()
        ) {
          const conversation = this.getConversation();
          if (conversation && !conversation.isPrivate()) {
            const source = this.getSource();
            const contact = this.findAndFormatContact(source);

            return `${contact.name}: ${description}`;
          }
        }

        return description;
      }

      if (this.isKeyChange()) {
        const phoneNumber = this.get('key_changed');
        const conversation = this.findContact(phoneNumber);
        return i18n(
          'safetyNumberChangedGroup',
          conversation ? conversation.getTitle() : null
        );
      }

      return '';
    },
    onDestroy() {
      this.cleanup();
    },
    async cleanup() {
      MessageController.unregister(this.id);
      this.unload();
      await deleteExternalMessageFiles(this.attributes);
    },
    unload() {
      // if (this.quotedMessage) {
      //   this.quotedMessage = null;
      // }
    },
    onExpired() {
      if (!this.hasExpired) {
        log.info('message has expired', this.idForLogging());
        this.hasExpired = true;
      }
    },

    getPropsForTimerNotification() {
      const timerUpdate = this.get('expirationTimerUpdate');
      if (!timerUpdate) {
        return null;
      }

      const { expireTimer, fromSync, source } = timerUpdate;
      const timespan = Whisper.ExpirationTimerOptions.getName(expireTimer || 0);
      const disabled = !expireTimer;

      const basicProps = {
        type: 'fromOther',
        ...this.findAndFormatContact(source),
        timespan,
        disabled,
      };

      if (fromSync) {
        return {
          ...basicProps,
          type: 'fromSync',
        };
      } else if (source === this.OUR_NUMBER) {
        return {
          ...basicProps,
          type: 'fromMe',
        };
      }

      return basicProps;
    },
    getPropsForMessageExpiryNotification() {
      const messageExpiryUpdate = this.get('messageExpiryUpdate');
      if (!messageExpiryUpdate) {
        return null;
      }

      const { messageExpiry } = messageExpiryUpdate;

      return {
        messageExpiry,
      };
    },

    getPropsForRemindCycleNotification() {
      const remindCycleUpdate = this.get('remindCycleUpdate');
      if (!remindCycleUpdate) {
        return null;
      }
      const { remindCycle, name, type } = remindCycleUpdate;
      const globalConfig = window.getGlobalConfig();
      const groupRemind = globalConfig?.group?.groupRemind || {};
      return {
        remindCycle,
        groupRemind,
        name,
        type,
      };
    },

    getPropsForReminderNotification() {
      return this.get('reminderNotifyUpdate') || null;
    },

    getPropsTipsNotification() {
      return {
        code: this.get('code'),
      };
    },
    getPropsForSafetyNumberNotification() {
      const isGroup = this.isGroupMessage();
      const phoneNumber = this.get('key_changed');
      const onVerify = () =>
        this.trigger('show-identity', this.findContact(phoneNumber));

      return {
        isGroup,
        contact: this.findAndFormatContact(phoneNumber),
        onVerify,
      };
    },
    getPropsForVerificationNotification() {
      const type = this.get('verified') ? 'markVerified' : 'markNotVerified';
      const isLocal = this.get('local');
      const phoneNumber = this.get('verifiedChanged');

      return {
        type,
        isLocal,
        contact: this.findAndFormatContact(phoneNumber),
      };
    },
    getPropsForResetSessionNotification() {
      // It doesn't need anything right now!
      return {};
    },
    getPropsForScreenshotNotification() {
      const source = this.getSource();

      return {
        contact: this.findAndFormatContact(source),
      };
    },
    getPropsForIdentityKeyResetNotification() {
      const { operator } = this.get('identityKeyReset');

      return {
        operator: this.findAndFormatContact(operator),
      };
    },
    findContact(phoneNumber) {
      return ConversationController.get(phoneNumber);
    },
    findAndFormatContact(phoneNumber) {
      // const { format } = PhoneNumber;
      // const regionCode = storage.get('regionCode');

      let contactModel;

      const conversation = this.getConversation();
      if (conversation && !conversation.isPrivate()) {
        contactModel = conversation.getGroupContactModel(phoneNumber);
      } else {
        contactModel = this.findContact(phoneNumber);
      }

      let formated = {};
      if (contactModel) {
        formated = {
          color: contactModel.getColor(),
          avatarPath: contactModel.getAvatarPath(),
          name: contactModel.getName() || phoneNumber,
          profileName: contactModel.getProfileName(),
          accountName: contactModel.getAccountName(),
          title: contactModel.getTitle(),
          isMe: contactModel.isMe(),
        };
      } else {
        formated = {
          color: 'gray',
          avatarPath: null,
          name: phoneNumber,
          profileName: phoneNumber,
          accountName: phoneNumber,
          title: phoneNumber,
          isMe: false,
        };
      }

      return {
        // phoneNumber: format(phoneNumber, {
        //   ourRegionCode: regionCode,
        // }),
        phoneNumber,
        ...formated,
      };
    },
    getPropsForGroupNotification() {
      const groupUpdate = this.get('group_update');
      const changes = [];
      let isHaveHistory = false;
      let joinOperator = groupUpdate.joinOperator;

      if (
        !groupUpdate.name &&
        !groupUpdate.left &&
        !groupUpdate.joined &&
        !groupUpdate.removed &&
        !groupUpdate.disbanded &&
        !groupUpdate.changeOwner &&
        !groupUpdate.addAdmins &&
        !groupUpdate.removeAdmins &&
        !groupUpdate.normalString &&
        !groupUpdate.publishRule &&
        !groupUpdate.avatar &&
        !groupUpdate.agendaURL
      ) {
        changes.push({
          type: 'general',
        });
      }

      if (groupUpdate.disbanded) {
        changes.push({
          type: 'disband',
          isDisbandByOwner: groupUpdate.isDisbandByOwner,
        });
      }

      if (groupUpdate.name) {
        const change = {
          type: 'name',
          newName: groupUpdate.name,
        };

        if (groupUpdate.operator) {
          change.operatorName = this.getNameForNumber(groupUpdate.operator);
          change.isMe = groupUpdate.operator === this.OUR_NUMBER;
        }

        changes.push(change);
      }
      if (groupUpdate.avatar) {
        changes.push({
          type: 'avatar',
          avatar: groupUpdate.avatar,
        });
      }

      if (groupUpdate.normalString) {
        changes.push({
          type: 'normalString',
          normalString: groupUpdate.normalString,
        });
      }

      if (groupUpdate.agendaURL) {
        changes.push({
          type: 'groupAgendaTips',
          agendaURL: groupUpdate.agendaURL,
        });
      }

      if (groupUpdate.joined) {
        const currentConversation = this.getConversation();
        const sendHistory = () => {
          currentConversation.trigger(
            'sendHistory',
            this.get('serverTimestamp')
          );
        };
        let result = currentConversation.getGroupHistoryMessage(
          this.get('serverTimestamp')
        );
        if (result.length > 0) {
          isHaveHistory = true;
        }

        changes.push({
          type: 'add',
          contacts: _.map(
            Array.isArray(groupUpdate.joined)
              ? groupUpdate.joined
              : [groupUpdate.joined],
            phoneNumber => this.findAndFormatContact(phoneNumber)
          ),
          publishRule: this.getConversation().get('publishRule'),
          sendHistory,
        });
      }

      if (groupUpdate.publishRule) {
        if (groupUpdate.publishRule !== 2) {
          changes.push({
            type: 'onlyOwnerOrAdminPublishRule',
            publishRule: groupUpdate.publishRule,
          });
        } else {
          changes.push({
            type: 'everyonePublishRule',
            publishRule: groupUpdate.publishRule,
          });
        }
      }

      if (groupUpdate.left === 'You') {
        changes.push({
          type: 'leave',
          isMe: true,
        });
      } else if (groupUpdate.left) {
        changes.push({
          type: 'leave',
          contacts: _.map(
            Array.isArray(groupUpdate.left)
              ? groupUpdate.left
              : [groupUpdate.left],
            phoneNumber => this.findAndFormatContact(phoneNumber)
          ),
        });
      }

      if (groupUpdate.removed) {
        const removed = groupUpdate.removed || [];
        if (removed.length == 1 && removed.includes(this.OUR_NUMBER)) {
          changes.push({
            type: 'remove',
            isMe: true,
          });
        } else {
          changes.push({
            type: 'remove',
            contacts: _.map(removed, phoneNumber =>
              this.findAndFormatContact(phoneNumber)
            ),
          });
        }
      }

      if (groupUpdate.changeOwner) {
        if (groupUpdate.changeOwner === this.OUR_NUMBER) {
          changes.push({
            type: 'changeOwner',
            isMe: true,
          });
        } else {
          changes.push({
            type: 'changeOwner',
            contacts: _.map([groupUpdate.changeOwner], phoneNumber =>
              this.findAndFormatContact(phoneNumber)
            ),
          });
        }
      }

      if (groupUpdate.addAdmins) {
        const addAdmins = groupUpdate.addAdmins || [];
        if (addAdmins.length == 1 && addAdmins.includes(this.OUR_NUMBER)) {
          changes.push({
            type: 'addAdmin',
            isMe: true,
          });
        } else {
          changes.push({
            type: 'addAdmin',
            contacts: _.map(addAdmins, phoneNumber =>
              this.findAndFormatContact(phoneNumber)
            ),
          });
        }
      }

      if (groupUpdate.removeAdmins) {
        const removeAdmins = groupUpdate.removeAdmins || [];
        if (
          removeAdmins.length == 1 &&
          removeAdmins.includes(this.OUR_NUMBER)
        ) {
          changes.push({
            type: 'removeAdmin',
            isMe: true,
          });
        } else {
          changes.push({
            type: 'removeAdmin',
            contacts: _.map(removeAdmins, phoneNumber =>
              this.findAndFormatContact(phoneNumber)
            ),
          });
        }
      }

      return {
        changes,
        ourNumber: this.OUR_NUMBER,
        isHaveHistory: joinOperator ? isHaveHistory : false,
        joinOperator,
      };
    },
    getMessagePropStatus() {
      if (this.hasErrors()) {
        return 'error';
      }
      if (!this.isOutgoing()) {
        return null;
      }

      const hasBeenRecalled = this.get('hasBeenRecalled');
      if (hasBeenRecalled) {
        return 'sent';
      }

      const recalled = this.get('recalled');
      if (recalled) {
        const { byId } = recalled;

        const found = MessageController.getById(byId);
        if (!found) {
          log.error('Source message not found, treat as recalling.');
          // async load message
          this.findMessage(byId);
          return 'sending';
        }

        if (found.isIncoming()) {
          return null;
        }

        const intendedRecipients = found.get('recipients') || [];
        const successfulRecipients = found.get('sent_to') || [];
        const unreachableRecipients = found.getUnreachableRecipients();

        const recipients = _.without(
          intendedRecipients,
          ...successfulRecipients,
          ...unreachableRecipients
        );

        if (recipients.length > 0) {
          return 'sending';
        }

        return 'sent';
      }

      // old readBy flag
      // const readReceiptSetting = storage.get('read-receipt-setting');
      const readReceiptSetting = true;
      if (readReceiptSetting) {
        const readBy = this.get('read_by') || [];
        if (readBy.length > 0) {
          return 'read';
        }
      }

      const getDeliveredStatus = () => {
        const delivered = this.get('delivered');
        const deliveredTo = this.get('delivered_to') || [];
        if (delivered || deliveredTo.length > 0) {
          return 'delivered';
        }
      };

      const getSentStatus = () => {
        const sent = this.get('sent');
        const sentTo = this.get('sent_to') || [];
        if (sent || sentTo.length > 0) {
          return 'sent';
        }
      };

      let status;
      if ((status = getDeliveredStatus()) || (status = getSentStatus())) {
        if (readReceiptSetting) {
          const readByAt = this.getConversation()?.get('read_by_at') || {};
          if (
            Object.values(readByAt).some(
              ({ maxServerTimestamp }) =>
                maxServerTimestamp >= this.getServerTimestamp()
            )
          ) {
            status = 'read';
          }
        }

        return status;
      }

      return 'sending';
    },
    getPropsForSearchResult() {
      const fromNumber = this.getSource();
      const from = this.findAndFormatContact(fromNumber);
      if (fromNumber === this.OUR_NUMBER) {
        from.isMe = true;
      }

      const toNumber = this.get('conversationId');
      let to = this.findAndFormatContact(toNumber);
      if (toNumber === this.OUR_NUMBER) {
        to.isMe = true;
      } else if (fromNumber === toNumber) {
        to = {
          isMe: true,
        };
      }

      return {
        from,
        to,

        isSelected: this.isSelected,

        id: this.id,
        conversationId: this.get('conversationId'),
        sentAt: this.get('sent_at'),
        receivedAt: this.get('received_at'),
        serverTimestamp: this.get('serverTimestamp'),
        snippet: this.get('snippet'),
      };
    },
    getPropsForMessage(options = {}) {
      const phoneNumber = this.getSource();
      const contact = this.findAndFormatContact(phoneNumber);
      const expirationLength = this.getExpireTimer() * 1000;
      const expireTimerStart = this.getExpirationStartTimestamp();
      const expirationTimestamp =
        expirationLength && expireTimerStart
          ? expireTimerStart + expirationLength
          : null;

      const recallableTimerLen = this.get('recallableTimer') * 1000;
      const recallableStart = this.get('recallableStartTimestamp');
      const recallableExpiredAt =
        recallableTimerLen && recallableStart
          ? recallableStart + recallableTimerLen
          : null;

      const isGroup = this.isGroupMessage();

      const forwardContext = this.get('forwardContext') || {};
      const forwards = forwardContext.forwards || [];

      const singleForward = this.getIfSingleForward(forwards);

      const attachments = singleForward
        ? singleForward.attachments || []
        : this.get('attachments') || [];
      const firstAttachment = attachments[0];

      const body = singleForward
        ? singleForward.body || ''
        : forwards.length > 0
          ? ''
          : this.get('body');

      const displayText = this.createNonBreakingLastSeparator(body);

      const { noClick } = options;

      const conversation = this.getConversation();
      // can not get conversation
      // is NOT recallable
      const recallable = this.isOutgoing() && conversation && !this.get('task');

      const translateLang = this.get('translateLang');
      const translatedText = this.getTranslatedText(translateLang);

      const displayTranslatedText =
        this.get('conversationTranslate') && translatedText === body
          ? null
          : this.createNonBreakingLastSeparator(translatedText);

      this.isSelectDisabled = !this.isForwardable();

      const threadProps = this.getPropsForThread();

      const reactions = this.get('reactions') || {};
      const emojiReactions = [];
      let hasReactions = false;

      const emojiSupportList = this.getReactionEmojiSupportList();
      emojiSupportList.forEach(emoji => {
        const emojiReactionMap = reactions[emoji] || {};
        const reactionList = Object.values(emojiReactionMap) || [];
        const availableReactions = reactionList.filter(
          reaction => !reaction.remove
        );

        if (availableReactions.length) {
          hasReactions = true;

          emojiReactions.push({
            emoji,
            reactions: availableReactions.map(reaction => ({
              ...reaction,
              contact: {
                id: reaction.fromId,
                ...this.findAndFormatContact(reaction.fromId),
              },
            })),
          });
        } else {
          emojiReactions.push({ emoji, reactions: [] });
        }
      });
      const leftGroup = conversation?.get('left');
      return {
        leftGroup,
        text: displayText,
        atPersons: this.get('atPersons'),
        mentions: this.get('mentions'),
        textPending: singleForward
          ? singleForward.bodyPending
          : this.get('bodyPending'),
        id: this.id,
        direction: this.isIncoming() ? 'incoming' : 'outgoing',
        timestamp: this.getServerTimestamp(),
        status: this.getMessagePropStatus(),
        contact: this.getPropsForEmbeddedContact(),
        task: null,
        vote: null,
        card: null,
        authorColor: contact.color,
        authorId: phoneNumber,
        authorName: contact.name,
        authorAccountName: contact.accountName,
        authorProfileName: contact.profileName,
        authorPhoneNumber: contact.phoneNumber,
        authorAvatarPath: contact.avatarPath,
        conversationType: isGroup ? 'group' : 'direct',
        conversationId: this.get('conversationId'),
        attachments: attachments
          // .filter(attachment => !attachment.error)
          .map(this.getPropsForAttachment.bind(this)),
        quote: this.getPropsForQuote({ noClick }),
        reply: this.getPropsForReply({ noClick }),
        isExpired: this.hasExpired,
        expirationLength,
        expirationTimestamp,
        readMemberCount: this.getReadMemberCount(),
        onReply: () => this.trigger('reply', this),
        onReplyOldMessageWithoutTopic: () =>
          this.trigger('replyOldMessageWithoutTopic', this),
        onRetrySend: () => this.retrySend(),
        onShowDetail: () => {
          this.trigger('show-message-detail', this);
        },
        onDelete: () => this.trigger('delete', this),
        onClickAttachment: attachment => {
          const showOneMedia = () => {
            window.showImageGallery({
              mediaFiles: JSON.stringify([
                {
                  url: attachment.url,
                  fileName: attachment.fileName || '',
                  contentType: attachment.contentType,
                },
              ]),
              selectedIndex: 0,
            });
          };

          const fetchMedia = async () => {
            if (this.isForwardMessage()) {
              showOneMedia();
              return;
            }

            const rawMedia =
              await window.Signal.Data.getMessagesWithVisualMediaAttachments(
                this.get('conversationId'),
                {
                  limit: 100,
                  pin: !!this.get('pin'),
                }
              );

            const media = _.flatten(
              rawMedia.map(message => {
                const { attachments } = message;
                return (attachments || [])
                  .filter(
                    attachment =>
                      attachment.thumbnail &&
                      !attachment.pending &&
                      !attachment.error
                  )
                  .map((attachment, index) => {
                    const { thumbnail } = attachment;
                    return {
                      objectURL: getAbsoluteAttachmentPath(attachment.path),
                      thumbnailObjectUrl: thumbnail
                        ? getAbsoluteAttachmentPath(thumbnail.path)
                        : null,
                      contentType: attachment.contentType,
                      index,
                      attachment,
                      message,
                    };
                  });
              })
              // Reverse to get the files in sorted order
            )
              .map(fileData => {
                return {
                  url: fileData.objectURL,
                  // caption:fileData.message.body,
                  caption: '',
                  fileName: fileData.attachment.fileName,
                  contentType: fileData.contentType,
                };
              })
              .reverse();

            let selectedIndex = media.findIndex(
              media => media.url === attachment.url
            );
            if (selectedIndex === -1) {
              showOneMedia();
              return;
            }

            window.showImageGallery({
              mediaFiles: JSON.stringify(media),
              selectedIndex: selectedIndex,
            });
          };
          // this.trigger('show-lightbox', {
          //   attachment,
          //   message: this,
          //   attachments
          // }),
          fetchMedia();
        },

        onCopyImage: attachment => {
          this.trigger('copy-image', attachment);
        },

        onDownload: isDangerous => {
          this.trigger('download', {
            attachment: firstAttachment,
            message: this,
            isDangerous,
          });
        },
        onChangeSpeechToText: attachment => {
          this.onChangeSpeechToText(attachment);
        },
        onOpenFile: () => {
          window.openFileDefault(
            getAbsoluteAttachmentPath(firstAttachment.path),
            firstAttachment.fileName
          );
        },
        onDoubleClickAvatar: e => {
          e.stopPropagation();
          this.trigger('open-conversation', phoneNumber);
        },
        withMenu: isGroup,
        addAtPerson: number => this.trigger('add-at-person', number),

        onFetchAttachments: this.queueAttachmentDownloads.bind(this),
        ourNumber: this.OUR_NUMBER,
        i18n,

        onForwardTo: (conversationIds, isMerged) =>
          this.trigger('forward-to', {
            conversationIds,
            messages: [this],
            isMerged,
          }),

        isSelected: this.isSelected,
        isSelectingMode: this.isSelectingMode,
        isSelectDisabled: this.isSelectDisabled,

        onChangeMultiSelectingMode: isSelecting =>
          this.trigger('multi-seleting-mode-change', isSelecting, this),

        onSelectChange: (checked, shiftKey) => {
          this.trigger('message-selection-change', this, checked, shiftKey);
        },

        isSingleForward: !!singleForward,
        forwardedMessages: forwards.map(
          this.getPropsForForwardMessage.bind(this)
        ),

        showForwardedMessageList: (title, cid) => {
          this.showForwardedMessageList(forwards, title, cid);
        },

        onRecall: () => this.trigger('recall-message', this),

        isRecalled: this.isRecalledMessage(),

        recallable,
        recallableTimerLen,
        recallableExpiredAt,

        translating: this.translating,
        translateError: this.translateError,
        translatedText: displayTranslatedText,
        translateLang,
        translateOff: Whisper.Translate.getOffValue(),
        onChangeTranslation: targetLang =>
          this.setTranslateLang(targetLang, body),
        supportedLanguages: Whisper.Translate.getSupportedLanguageArray(),
        threadId: this.get('threadId'),
        threadReplied: this.get('threadReplied'),
        topicReplied: this.get('topicReplied'),
        isUseTopicCommand: this.get('isUseTopicCommand'),
        isAtBotTopic: this.get('isAtBotTopic'),
        firstMessageTopicFlag: this.get('firstMessageTopicFlag'),
        threadProps,
        onShowThread: () => {
          this.trigger('show-thread', this);
        },
        onThreadReply: () => {
          this.trigger('thread-reply', this);
        },
        hasReactions,
        emojiReactions,
        onClickReaction: this.doReaction.bind(this),

        isConfidentialMessage: this.isConfidentialMessage(),
        onMouseOverMessage: () => {
          if (this.isConfidentialMessage()) {
            this.seeConfidentialMessage();
            // const attachments = this.get('attachments') || [];
            // if (attachments.length) {
            //   this.seeConfidentialMessage();
            // }
          }
        },
        showInSeparateView: event => {
          event.stopPropagation();
          event.preventDefault();
          if (this.isConfidentialMessage()) {
            this.trigger('show-message-in-separate-view', {
              text: displayText,
              id: this.id,
              mentions: this.get('mentions'),
            });
          }
        },
        getAttachmentObjectUrl: async attachment => {
          try {
            const { data } =
              await window.Signal.Migrations.loadAttachmentData(attachment);

            const audioBlob = new Blob([data], {
              type: attachment.contentType,
            });
            return URL.createObjectURL(audioBlob);
          } catch (e) {
            console.log('getAttachmentObjectUrl error', e);
            return null;
          }
        },
        transcribing: this.transcribing,
        transcribingError: this.transcribingError,
        transcribedText: this.get('transcribedText'),
      };
    },
    getPropsForThread() {
      const threadContext = this.get('threadContext');
      const botContext = this.get('botContext');
      let replyTopicMessageHeader = threadContext?.sourceBrief;

      if (threadContext) {
        const {
          source,
          replyToUser,
          groupId,
          topicId,
          botId,
          supportType,
          groupName,
        } = threadContext;

        let firstBotName;
        if (botId) {
          const botContact = this.findAndFormatContact(botId);
          firstBotName = botContact?.name;
        }

        const contact = this.findAndFormatContact(
          source ? source.source : this.OUR_NUMBER
        );

        let authorName = '';
        if (groupId && !topicId) {
          authorName = i18n('threadQuotedUserNamePrefix');
        }

        if (contact.isMe) {
          authorName += i18n('you');
        } else {
          authorName += contact.name;
        }

        return {
          quotedUser: {
            isFromMe: false,
            authorPhoneNumber: source,
            authorProfileName: contact.profileName,
            authorName,
            authorColor: contact.color,
            groupId,
          },
          groupName,
          botId,
          topicId,
          replyTopicMessageHeader,
          replyToUser,
          supportType,
          botContext,
          firstBotName,
        };
      }
    },
    getPropsForUnsupportedMessage() {
      const phoneNumber = this.getSource();
      const contact = this.findAndFormatContact(phoneNumber);

      const expirationLength = this.getExpireTimer() * 1000;
      const expireTimerStart = this.getExpirationStartTimestamp();
      const expirationTimestamp =
        expirationLength && expireTimerStart
          ? expireTimerStart + expirationLength
          : null;

      const isGroup = this.isGroupMessage();

      this.isSelectDisabled = true;

      return {
        text: i18n('unsupportedMessageTip'),
        id: this.id,
        direction: this.isIncoming() ? 'incoming' : 'outgoing',
        timestamp: this.getServerTimestamp(),
        status: this.getMessagePropStatus(),
        authorColor: contact.color,
        authorId: phoneNumber,
        authorName: contact.name,
        authorAccountName: contact.accountName,
        authorProfileName: contact.profileName,
        authorPhoneNumber: contact.phoneNumber,
        conversationType: isGroup ? 'group' : 'direct',
        authorAvatarPath: contact.avatarPath,
        isExpired: this.hasExpired,
        expirationLength,
        expirationTimestamp,
        readMemberCount: this.getReadMemberCount(),
        onReply: () => this.trigger('reply', this),
        onShowDetail: () => {
          this.trigger('show-message-detail', this);
        },
        onDelete: () => this.trigger('delete', this),

        onDoubleClickAvatar: () => {
          this.trigger('open-conversation', phoneNumber);
        },
        withMenu: isGroup,
        addAtPerson: number => this.trigger('add-at-person', number),

        ourNumber: this.OUR_NUMBER,
        i18n,

        onForwardTo: (conversationIds, isMerged) =>
          this.trigger('forward-to', {
            conversationIds,
            messages: [this],
            isMerged,
          }),

        isSelected: this.isSelected,
        isSelectingMode: this.isSelectingMode,
        isSelectDisabled: this.isSelectDisabled,

        onChangeMultiSelectingMode: isSelecting =>
          this.trigger('multi-seleting-mode-change', isSelecting, this),
      };
    },
    getPropsForRecallMessageNotification() {
      // outgoing can edit in 24 hours
      //  1. this device, all sent
      //  2. other device, received
      // incoming only show notification

      const recall = this.get('recall');
      const { realSource, target } = recall;

      let editable = false;

      let { recallFinished } = recall;
      if (this.isOutgoing()) {
        if (recallFinished === undefined) {
          const intendedRecipients = this.get('recipients') || [];
          const successfulRecipients = this.get('sent_to') || [];
          const unreachableRecipients = this.getUnreachableRecipients();

          const recipients = _.without(
            intendedRecipients,
            ...successfulRecipients,
            ...unreachableRecipients
          );
          recallFinished = recipients.length === 0;
        }

        const { body } = target || {};
        editable = body && body.length > 0;
      } else {
        recallFinished = true;
      }

      const editableTimerLen = recall.editableTimer * 1000;
      const editableStart = recall.editableStartTimestamp;

      const editableExpiredAt =
        editableTimerLen && editableStart
          ? editableStart + editableTimerLen
          : null;

      return {
        i18n,
        onEdit: () => {
          this.trigger('edit-recalled-message', target);
        },
        contact: this.findAndFormatContact(realSource.source),
        recallFinished,
        editable,
        editableTimerLen,
        editableExpiredAt,
      };
    },
    getTranslationChangeTitle() {
      let translateChangeTitle;

      const targetLang = this.get('conversationTranslateChange')?.toLowerCase();

      if (targetLang === 'zh-cn') {
        translateChangeTitle = '你收到的新消息将增加中文翻译';
      } else if (targetLang === 'en') {
        translateChangeTitle =
          'English translations will be added to the new messages you receive';
      } else if (targetLang === 'off') {
        translateChangeTitle = i18n('translationIsOff');
      } else {
        translateChangeTitle = 'Translation changed.';
      }

      return translateChangeTitle;
    },
    getPropsForTranslateChangeNotification() {
      const translateChangeTitle = this.getTranslationChangeTitle();

      return {
        translateChangeTitle,
      };
    },
    createNonBreakingLastSeparator(text) {
      if (!text) {
        return null;
      }

      const nbsp = '\xa0';
      const regex = /(\S)( +)(\S+\s*)$/;
      return text.replace(regex, (match, start, spaces, end) => {
        const newSpaces =
          end.length < 12
            ? _.reduce(spaces, accumulator => accumulator + nbsp, '')
            : spaces;
        return `${start}${newSpaces}${end}`;
      });
    },
    getPropsForEmbeddedContact() {
      // const regionCode = storage.get('regionCode');
      // const { contactSelector } = Contact;

      const contacts = this.get('contacts');
      if (!contacts || !contacts.length) {
        return null;
      }

      const contact = contacts[0];
      // const firstNumber = contact.number ;
      // const onSendMessage = firstNumber
      //   ? () => {
      //       this.trigger('open-conversation', firstNumber);
      //     }
      //   : null;
      // const onClick = async () => {
      //   // First let's be sure that the signal account check is complete.
      //   await window.checkForSignalAccount(firstNumber);

      //   this.trigger('show-contact-detail', {
      //     contact,
      //     hasSignalAccount: window.hasSignalAccount(firstNumber),
      //   });
      // };

      // Would be nice to do this before render, on initial load of message
      // if (!window.isSignalAccountCheckComplete(firstNumber)) {
      //   window.checkForSignalAccount(firstNumber).then(() => {
      //     this.trigger('change', this);
      //   });
      // }

      let avatarPath;
      const model = ConversationController.get(contact.number);
      if (model) {
        avatarPath = model.cachedProps.avatarPath;
      }

      // const conversationsCollection = window.getConversations();
      // const conversations = conversationsCollection.map(
      //   (conversation) => conversation.cachedProps
      // );
      // const lookup = window.Signal.Util.makeLookup(conversations, 'id');
      // if (lookup.hasOwnProperty(contact.number)) {
      //   const item = lookup[contact.number];
      //   if (item && item.avatarPath) {
      //     avatarPath = item.avatarPath;
      //   }
      // }

      return { ...contact, avatarPath };

      // return contactSelector(contact, {
      //   regionCode,
      //   getAbsoluteAttachmentPath,
      //   onSendMessage,
      //   onClick,
      //   hasSignalAccount: window.hasSignalAccount(firstNumber),
      //   hasSignalAccount: false,
      // });
    },
    processQuoteAttachment(attachment) {
      const { thumbnail } = attachment;
      const path =
        thumbnail &&
        thumbnail.path &&
        getAbsoluteAttachmentPath(thumbnail.path);
      const objectUrl = thumbnail && thumbnail.objectUrl;

      const thumbnailWithObjectUrl =
        !path && !objectUrl
          ? null
          : Object.assign({}, attachment.thumbnail || {}, {
              objectUrl: path || objectUrl,
            });

      return Object.assign({}, attachment, {
        isVoiceMessage: Signal.Types.Attachment.isVoiceMessage(attachment),
        thumbnail: thumbnailWithObjectUrl,
      });
    },

    getPropsForReply(options = {}) {
      const { noClick } = options;
      const reply = this.get('reply');
      if (!reply) {
        return null;
      }

      const { author, id, referencedMessageNotFound } = reply;
      const contact = this.findAndFormatContact(author);

      const scrollToMessage = () => {
        this.trigger('scroll-to-message', {
          author,
          id,
          referencedMessageNotFound,
        });
      };
      const firstAttachment = reply.attachments && reply.attachments[0];

      return {
        text: this.createNonBreakingLastSeparator(reply.text),
        attachment: firstAttachment
          ? this.processQuoteAttachment(firstAttachment)
          : null,
        isFromMe: !!contact.isMe,
        authorPhoneNumber: contact.phoneNumber,
        authorProfileName: contact.profileName,
        authorName: contact.name,
        authorColor: contact.color || 'gray',
        onClick: noClick ? null : scrollToMessage,
        referencedMessageNotFound,
        isReply: true,
      };
    },

    getPropsForQuote(options = {}) {
      const { noClick } = options;
      const quote = this.get('quote');
      if (!quote) {
        return null;
      }

      const { author, id, referencedMessageNotFound, messageMode } = quote;
      const contact = this.findAndFormatContact(author);

      const scrollToMessage = () => {
        this.trigger('scroll-to-message', {
          author,
          id,
          referencedMessageNotFound,
        });
      };

      const firstAttachment = quote.attachments && quote.attachments[0];

      return {
        text: this.createNonBreakingLastSeparator(quote.text),
        attachment: firstAttachment
          ? this.processQuoteAttachment(firstAttachment)
          : null,
        isFromMe: !!contact.isMe,
        authorPhoneNumber: contact.phoneNumber,
        authorProfileName: contact.profileName,
        authorName: contact.name,
        authorColor: contact.color || 'gray',
        onClick: noClick ? null : scrollToMessage,
        referencedMessageNotFound,
        messageMode: messageMode,
      };
    },
    getPropsForAttachment(attachment) {
      if (!attachment) {
        return null;
      }

      const { path, pending, flags, size, screenshot, thumbnail } = attachment;

      return {
        ...attachment,
        fileSize: size ? filesize(size) : null,
        isVoiceMessage:
          flags &&
          // eslint-disable-next-line no-bitwise
          flags & textsecure.protobuf.AttachmentPointer.Flags.VOICE_MESSAGE,
        pending,
        url: path ? getAbsoluteAttachmentPath(path) : null,
        screenshot: screenshot
          ? {
              ...screenshot,
              url: getAbsoluteAttachmentPath(screenshot.path),
            }
          : null,
        thumbnail: thumbnail
          ? {
              ...thumbnail,
              url: getAbsoluteAttachmentPath(thumbnail.path),
            }
          : null,
      };
    },
    getPropsForMessageDetail() {
      const newIdentity = i18n('newIdentity');
      const OUTGOING_KEY_ERROR = 'OutgoingIdentityKeyError';

      // We include numbers we didn't successfully send to so we can display errors.
      // Older messages don't have the recipients included on the message, so we fall
      //   back to the conversation's current recipients
      const phoneNumbers = this.isIncoming()
        ? [this.get('source')]
        : _.union(
            this.get('sent_to') || [],
            this.get('recipients') || this.getConversation().getRecipients()
          );

      // This will make the error message for outgoing key errors a bit nicer
      const allErrors = (this.get('errors') || [])
        .map(error => {
          if (error.name === OUTGOING_KEY_ERROR) {
            // eslint-disable-next-line no-param-reassign
            error.message = newIdentity;
          }

          return error;
        })
        .concat(this.get('invisibleErrors') || []);

      // If an error has a specific number it's associated with, we'll show it next to
      //   that contact. Otherwise, it will be a standalone entry.
      const errors = _.reject(allErrors, error => Boolean(error.number));
      const errorsGroupedById = _.groupBy(allErrors, 'number');
      const finalContacts = (phoneNumbers || []).map(id => {
        const errorsForContact = errorsGroupedById[id];
        const isOutgoingKeyError = Boolean(
          _.find(errorsForContact, error => error.name === OUTGOING_KEY_ERROR)
        );

        return {
          id,
          ...this.findAndFormatContact(id),
          status: this.getStatus(id),
          errors: errorsForContact,
          isOutgoingKeyError,
          onSendAnyway: () =>
            this.trigger('force-send', {
              contact: this.findContact(id),
              message: this,
            }),
        };
      });

      // The prefix created here ensures that contacts with errors are listed
      //   first; otherwise it's alphabetical
      const sortedContacts = _.sortBy(
        finalContacts,
        contact => `${contact.errors ? '0' : '1'}${contact.title}`
      );

      return {
        noNeedReceipts: this.get('noNeedReceipts'),
        sentAt: this.get('sent_at'),
        receivedAt: this.get('received_at'),
        serverTimestamp: this.get('serverTimestamp'),
        message: {
          ...this.getPropsForMessage({ noClick: true }),
          disableMenu: true,
          // To ensure that group avatar doesn't show up
          conversationType: 'direct',
          noShowDetail: true,
          virtualIndex: 0,
        },
        errors,
        contacts: sortedContacts,
      };
    },

    showForwardedMessageList(forwards, title, cid) {
      this.trigger('show-forwarded-message-list', this, forwards, title, cid);
      (forwards || []).forEach(this.queueForwardAttachmentDownloads.bind(this));
    },

    getIfSingleForward(forwards) {
      if (forwards instanceof Array && forwards.length === 1) {
        const firstForward = forwards[0];
        const nextForwards = firstForward.forwards;
        if (!(nextForwards instanceof Array) || nextForwards.length === 0) {
          return firstForward;
        }
      }

      return null;
    },

    getPropsForForwardMessage(forward) {
      if (!forward) {
        return null;
      }

      const {
        id,
        type,
        author: authorId,
        body = '',
        card,
        attachments,
        forwards,
        isFromGroup,
        mentions,
      } = forward;

      const forwardForwards = forwards || [];
      const singleForward = this.getIfSingleForward(forwardForwards);

      const forwardAttachments = singleForward
        ? singleForward.attachments || []
        : attachments || [];
      const firstAttachment = forwardAttachments[0];

      const forwardText = singleForward
        ? singleForward.body || ''
        : forwardForwards.length > 0
          ? ''
          : body || '';

      const displayText = this.createNonBreakingLastSeparator(forwardText);

      const contact = this.findAndFormatContact(authorId);

      return {
        id,
        timestamp: id,
        isFromGroup,
        mentions,
        card,
        type,
        authorColor: contact.color,
        authorId,
        authorName: this.getNameForNumber(authorId),
        authorProfileName: contact.profileName,
        authorPhoneNumber: contact.phoneNumber,
        authorAvatarPath: contact.avatarPath,
        authorAccountName: contact.accountName,
        direction: 'incoming',
        conversationType: 'forward',
        text: displayText,
        textPending: singleForward
          ? singleForward.bodyPending
          : forward.bodyPending,
        attachments: forwardAttachments.map(
          this.getPropsForAttachment.bind(this)
        ),
        isSingleForward: !!singleForward,
        forwardedMessages: forwardForwards.map(
          this.getPropsForForwardMessage.bind(this)
        ),
        onClickAttachment: attachment =>
          window.showImageGallery({
            mediaFiles: JSON.stringify([
              {
                url: attachment.url,
                fileName: attachment.fileName || '',
                contentType: attachment.contentType,
              },
            ]),
            selectedIndex: 0,
          }),
        // this.trigger('show-lightbox', {
        //   attachment,
        //   message: this,
        //   attachments: forwardAttachments,
        // }),
        onCopyImage: attachment => {
          this.trigger('copy-image', attachment);
        },
        onOpenFile: () => {
          if (firstAttachment) {
            window.openFileDefault(
              getAbsoluteAttachmentPath(firstAttachment.path),
              firstAttachment.fileName
            );
          }
        },
        onDownload: isDangerous =>
          this.trigger('download', {
            attachment: forwardAttachments[0],
            message: this,
            isDangerous,
          }),
        onFetchAttachments: () => {
          this.queueForwardAttachmentDownloads(forward);
        },
        showForwardedMessageList: (title, cid) => {
          this.showForwardedMessageList(forwardForwards, title, cid);
        },
      };
    },

    findForwardByUuid(forwards, uuid) {
      if (!forwards || forwards.length <= 0) {
        return null;
      }

      for (let i = 0; i < forwards.length; i++) {
        const current = forwards[i];
        if (current.uuid === uuid) {
          return current;
        }

        const found = this.findForwardByUuid(current.forwards, uuid);
        if (found) {
          return found;
        }
      }

      return null;
    },

    findOurForwardByUuid(uuid) {
      const forwardContext = this.get('forwardContext') || {};
      const { forwards } = forwardContext;
      return this.findForwardByUuid(forwards, uuid);
    },

    // One caller today: event handler for the 'Retry Send' entry in triple-dot menu
    async retrySend() {
      if (!textsecure.messaging) {
        window.log.error('retrySend: Cannot retry since we are offline!');
        return null;
      }

      this.trigger('scroll-to-bottom');

      // reset forceResent
      this.forceResent = [];
      this.set({ errors: null });

      const recalled = this.get('recalled');
      if (recalled) {
        // load recall message and retry send.
        const found = await this.findMessage(recalled.byId);
        if (found) {
          return found.retrySend();
        } else {
          log.error('recall message not found.');
        }

        return null;
      }

      const conversation = this.getConversation();
      const currentRecipients = conversation.getRecipients();

      // reset recipients when retry sending
      // this will makesure attachments authorities correctly
      if (!_.isEqual(this.get('recipients'), currentRecipients)) {
        this.set({ recipients: currentRecipients });
      }

      const intendedRecipients = this.get('recipients') || [];
      const successfulRecipients = this.get('sent_to') || [];

      const profileKey = conversation.get('profileSharing')
        ? storage.get('profileKey')
        : null;

      let recipients = _.intersection(intendedRecipients, currentRecipients);
      recipients = _.without(recipients, ...successfulRecipients);

      if (!recipients.length) {
        window.log.warn('retrySend: Nobody to send to!');

        return window.Signal.Data.saveMessage(this.attributes, {
          Message: Whisper.Message,
        });
      }

      const attachmentsWithData = await Promise.all(
        (this.get('attachments') || []).map(loadAttachmentData)
      );
      const { body, attachments } = Whisper.Message.getLongMessageAttachment({
        body: this.get('body'),
        attachments: attachmentsWithData,
        now: this.get('sent_at'),
      });

      const quoteWithData = await loadQuoteData(this.get('quote'));
      const forwardContext = await loadForwardContextData(
        this.get('forwardContext')
      );
      const contacts = this.get('contacts') || [];
      const recall = this.get('recall');
      const task = null;
      const vote = null;
      const card = null;
      const threadContext = this.get('threadContext');
      const messageMode = this.get('messageMode');

      // Special-case the self-send case - we send only a sync message
      if (recipients.length === 1 && recipients[0] === this.OUR_NUMBER) {
        const [number] = recipients;
        const dataMessage = await textsecure.messaging.getMessageProto(
          number,
          body,
          this.get('mentions'),
          attachments,
          quoteWithData,
          this.get('sent_at'),
          this.get('expireTimer'),
          profileKey,
          null,
          forwardContext,
          contacts,
          recall,
          task,
          vote,
          card,
          threadContext,
          messageMode
        );
        return this.sendSyncMessageOnly(dataMessage);
      }

      let promise;

      if (conversation.isPrivate()) {
        const [number] = recipients;
        promise = textsecure.messaging.sendMessageToNumber(
          number,
          body,
          this.get('mentions'),
          attachments,
          quoteWithData,
          this.get('sent_at'),
          this.get('expireTimer'),
          profileKey,
          this.get('extension'),
          forwardContext,
          contacts,
          recall,
          task,
          vote,
          card,
          threadContext,
          messageMode
        );
      } else {
        // Because this is a partial group send, we manually construct the request like
        //   sendMessageToGroup does.
        promise = textsecure.messaging.sendMessage(
          {
            recipients,
            body,
            mentions: this.get('mentions'),
            atPersons: this.get('atPersons'),
            timestamp: this.get('sent_at'),
            attachments,
            quote: quoteWithData,
            needsSync: !this.get('synced'),
            expireTimer: this.get('expireTimer'),
            profileKey,
            group: {
              id: this.get('conversationId'),
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
          },
          this.get('extension')
        );
      }

      return this.send(promise);
    },
    isReplayableError(e) {
      return (
        e.name === 'MessageError' ||
        e.name === 'OutgoingMessageError' ||
        e.name === 'SendMessageNetworkError' ||
        // e.name === 'SignedPreKeyRotationError' ||
        e.name === 'OutgoingIdentityKeyError'
      );
    },

    // Called when the user ran into an error with a specific user, wants to send to them
    //   One caller today: ConversationView.forceSend()
    async resend(number) {
      const error = this.removeOutgoingErrors(number);
      if (!error) {
        window.log.warn('resend: requested number was not present in errors');
        return null;
      }

      const profileKey = null;
      const attachmentsWithData = await Promise.all(
        (this.get('attachments') || []).map(loadAttachmentData)
      );
      const { body, attachments } = Whisper.Message.getLongMessageAttachment({
        body: this.get('body'),
        attachments: attachmentsWithData,
        now: this.get('sent_at'),
      });

      const quoteWithData = await loadQuoteData(this.get('quote'));
      const forwardContext = await loadForwardContextData(
        this.get('forwardContext')
      );
      const contacts = this.get('contacts') || [];
      const recall = this.get('recall');
      const task = null;
      const vote = null;
      const card = null;
      const threadContext = this.get('threadContext');
      const messageMode = this.get('messageMode');

      // Special-case the self-send case - we send only a sync message
      if (number === this.OUR_NUMBER) {
        const dataMessage = await textsecure.messaging.getMessageProto(
          number,
          body,
          attachments,
          quoteWithData,
          this.get('sent_at'),
          this.get('expireTimer'),
          profileKey,
          null,
          forwardContext,
          contacts,
          recall,
          task,
          vote,
          card,
          threadContext,
          messageMode
        );
        return this.sendSyncMessageOnly(dataMessage);
      }

      let promise;
      const conversation = this.getConversation();
      if (conversation.isPrivate()) {
        promise = textsecure.messaging.sendMessageToNumber(
          number,
          body,
          attachments,
          quoteWithData,
          this.get('sent_at'),
          this.get('expireTimer'),
          profileKey,
          this.get('extension'),
          forwardContext,
          contacts,
          recall,
          task,
          vote,
          card,
          threadContext,
          messageMode
        );
      } else {
        // Because this is a partial group send, we manually construct the request like
        //   sendMessageToGroup does.
        promise = textsecure.messaging.sendMessage(
          {
            recipients: [number],
            body,
            mentions: this.get('mentions'),
            atPersons: this.get('atPersons'),
            timestamp: this.get('sent_at'),
            attachments,
            quote: quoteWithData,
            needsSync: !this.get('synced'),
            expireTimer: this.get('expireTimer'),
            profileKey,
            group: {
              id: this.get('conversationId'),
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
          },
          this.get('extension')
        );
      }

      return this.send(promise);
    },

    async forceResendAuto(number) {
      try {
        log.info(`trying to force resend for ${number}`);
        // if already forceResendAuto, do not try to do again
        if (this.forceResent instanceof Array) {
          if (this.forceResent.includes(number)) {
            log.error(
              `already resend for number ${number}, ${this.idForLogging()}`
            );
            return;
          }

          this.forceResent.push(number);
        } else {
          this.forceResent = [number];
        }

        const conversation = ConversationController.get(number);

        await conversation.getProfile(number);

        return this.resend(number);
      } catch (error) {
        log.error('force resend auto failed, ', error);
      }
    },

    async removeOutgoingErrors(number) {
      const recall = this.get('recall');
      if (recall) {
        const { target } = recall;
        if (target && target.id) {
          const found = await this.findMessage(target.id);
          if (found) {
            await found.removeOutgoingErrors(number);
          } else {
            log.error('not found original message:', target.id);
          }
        } else {
          log.error('recall target was not found:', recall.realSource);
        }
      }

      const errors = _.partition(
        this.get('errors'),
        e =>
          e.number === number &&
          [
            'MessageError',
            'OutgoingMessageError',
            'SendMessageNetworkError',
            'SignedPreKeyRotationError',
            'OutgoingIdentityKeyError',
          ].includes(e.name)
      );
      this.set({ errors: errors[1] });
      return errors[0][0];
    },

    getConversation() {
      // This needs to be an unsafe call, because this method is called during
      //   initial module setup. We may be in the middle of the initial fetch to
      //   the database.
      return ConversationController.getUnsafe(this.get('conversationId'));
    },
    getIncomingContact() {
      if (!this.isIncoming()) {
        return null;
      }
      const source = this.get('source');
      if (!source) {
        return null;
      }

      return ConversationController.getOrCreate(source, 'private');
    },
    getQuoteContact() {
      const quote = this.get('quote');
      if (!quote) {
        return null;
      }
      const { author } = quote;
      if (!author) {
        return null;
      }

      return ConversationController.get(author);
    },
    getIncludeContact() {
      const contacts = this.get('contacts');
      if (contacts && contacts.length) {
        return ConversationController.get(contacts[0].number);
      }
    },

    getSource() {
      if (this.isIncoming()) {
        return this.get('source');
      }

      return this.OUR_NUMBER;
    },

    getSourceDevice() {
      let sourceDevice = this.get('sourceDevice');
      if (!sourceDevice) {
        sourceDevice = textsecure.storage.user.getDeviceId();
      }
      return parseInt(sourceDevice);
    },

    getContact() {
      const source = this.getSource();

      if (!source) {
        return null;
      }

      return ConversationController.getOrCreate(source, 'private');
    },
    isOutgoing() {
      return this.get('type') === 'outgoing';
    },
    hasErrors() {
      return _.size(this.get('errors')) > 0;
    },

    getStatus(number) {
      if (this.isIncoming()) {
        return null;
      }

      const readBy = this.get('read_by') || [];
      if (readBy.indexOf(number) >= 0) {
        return 'read';
      }

      const getDeliveredStatus = () => {
        const deliveredTo = this.get('delivered_to') || [];
        if (deliveredTo.indexOf(number) >= 0) {
          return 'delivered';
        }
      };

      const getSentStatus = () => {
        const sent = this.get('sent');
        const sentTo = this.get('sent_to') || [];
        if (sent || sentTo.indexOf(number) >= 0) {
          return 'sent';
        }
      };

      let status;
      if ((status = getDeliveredStatus()) || (status = getSentStatus())) {
        const readByAt = this.getConversation()?.get('read_by_at') || {};
        if (readByAt[number]?.maxServerTimestamp >= this.getServerTimestamp()) {
          status = 'read';
        }

        return status;
      }

      if (this.isOutgoing()) {
        return 'sending';
      }

      return null;
    },

    valueFromResult(result, fieldName) {
      if (result[fieldName]) {
        return result[fieldName];
      }

      const values = Object.values(result[`${fieldName}Map`] || {});
      if (values?.length) {
        return values[0];
      }

      return null;
    },

    send(promise) {
      return promise
        .then(async result => {
          const newAttributes = {};
          const assginAttributes = props => Object.assign(newAttributes, props);

          // This is used by sendSyncMessage, then set to null
          if (!this.get('synced')) {
            const { dataMessage } = result;
            if (dataMessage) {
              assginAttributes({ dataMessage });
            }
          }

          // save rapid files in message
          const { rapidFiles } = result;
          if (rapidFiles instanceof Array && rapidFiles.length > 0) {
            assginAttributes({
              rapidFiles: rapidFiles.concat(this.get('rapidFiles') || []),
            });
          }

          const now = Date.now();
          const sentTo = this.get('sent_to') || [];
          assginAttributes({
            sent_to: _.union(sentTo, result.successfulNumbers),
            sent: true,
            expirationStartTimestamp: now,
            recallableStartTimestamp: this.get('sent_at'),
          });

          const conversation = this.getConversation();
          if (conversation) {
            //发送好友请求
            if (conversation.isPrivate()) {
              conversation.sendFriendRequest().catch(error => {
                log.warn(
                  'failed to send friend request after sending message',
                  error
                );
              });
            }

            if (conversation.isChatWithoutReceipt()) {
              assginAttributes({
                read_by: _.union(sentTo, result.successfulNumbers),
                noNeedReceipts: true,
              });
            }

            // make message shown in main message list
            if (
              conversation.messageCollection.bottomLoaded &&
              this.threadOnly
            ) {
              delete this.threadOnly;
            }
          }

          const serverTimestamp = this.valueFromResult(
            result,
            'serverTimestamp'
          );
          if (serverTimestamp) {
            assginAttributes({ serverTimestamp });
          } else {
            // old signal message or error occur, use sent_at as serverTimestamp
            assginAttributes({ serverTimestamp: this.get('sent_at') });
          }

          const sequenceId = this.valueFromResult(result, 'sequenceId');
          if (sequenceId) {
            assginAttributes({ sequenceId });
          }

          const notifySequenceId = this.valueFromResult(
            result,
            'notifySequenceId'
          );
          if (notifySequenceId) {
            assginAttributes({ notifySequenceId });
          }

          const recall = this.get('recall');
          if (recall) {
            const { target } = recall;
            if (target && target.id) {
              const found = await this.findMessage(target.id);

              if (found) {
                found.set({
                  hasBeenRecalled: true,
                });

                await window.Signal.Data.saveMessage(found.attributes, {
                  Message: Whisper.Message,
                });

                const conversation = found.getConversation();
                if (conversation) {
                  conversation.trigger('recalled', found);
                }
              } else {
                log.error('original message was not found:', target.id);
              }
            } else {
              log.error('recall target was not found:', recall.realSource);
            }

            assginAttributes({
              recall: {
                ...recall,
                editableStartTimestamp: now,
              },
            });
          }

          this.set(newAttributes);
          await window.Signal.Data.saveMessage(this.attributes, {
            Message: Whisper.Message,
          });
          this.trigger('sent', this);

          log.info(
            'Sent message',
            this.idForLogging(),
            conversation?.idForLogging()
          );

          this.sendSyncMessage();
        })
        .catch(async result => {
          if (result.dataMessage) {
            this.set({ dataMessage: result.dataMessage });
          }

          // save rapid files in message
          const rapidFiles = result.rapidFiles;
          if (rapidFiles instanceof Array && rapidFiles.length > 0) {
            this.set({
              rapidFiles: rapidFiles.concat(this.get('rapidFiles') || []),
            });
          }

          let promises = [];

          if (result instanceof Error) {
            this.saveErrors(result);

            if (result.name === 'OutgoingIdentityKeyError') {
              promises.push(this.forceResendAuto(result.number));
            }
          } else {
            if (result.successfulNumbers.length > 0) {
              const sentTo = this.get('sent_to') || [];

              // In groups, we don't treat unregistered users as a user-visible
              //   error. The message will look successful, but the details
              //   screen will show that we didn't send to these unregistered users.
              const [invisibleErrors, filteredErrors] = _.partition(
                result.errors,
                error =>
                  [
                    'UnregisteredUserError',
                    'ForbiddenUserError',
                    'UnavailableUserError',
                  ].includes(error.name)
              );

              const now = Date.now();

              // We don't start the expiration timer if there are real errors
              //   left after filtering out all of the unregistered user errors.
              const expirationStartTimestamp = filteredErrors.length
                ? null
                : now;

              if (filteredErrors.length === 0) {
                const recall = this.get('recall');
                if (recall) {
                  const { target } = recall;
                  if (target && target.id) {
                    const found = await this.findMessage(target.id);

                    if (found) {
                      found.set({
                        hasBeenRecalled: true,
                      });

                      await window.Signal.Data.saveMessage(found.attributes, {
                        Message: Whisper.Message,
                      });

                      const conversation = found.getConversation();
                      if (conversation) {
                        conversation.trigger('recalled', found);
                      }
                    } else {
                      log.error('original message was not found:', target.id);
                    }
                  } else {
                    log.error(
                      'recall target was not found:',
                      recall.realSource
                    );
                  }

                  this.set({
                    recall: {
                      ...recall,
                      editableStartTimestamp: now,
                    },
                  });
                }
              }

              // only signal message can go here,
              // so serverTimestamp just set with sent_at
              const attributes = {
                sent_to: _.union(sentTo, result.successfulNumbers),
                sent: true,
                expirationStartTimestamp,
                recallableStartTimestamp: this.get('sent_at'),
                serverTimestamp: this.get('sent_at'),
              };

              const mergeField = fieldName => {
                const merged = {
                  ...(this.get(fieldName) || {}),
                  ...(result[fieldName] || {}),
                };

                if (Object.keys(merged).length) {
                  attributes[fieldName] = merged;
                }
              };

              mergeField('sequenceIdMap');
              mergeField('serverTimestampMap');
              mergeField('notifySequenceIdMap');

              this.set(attributes);
              this.saveErrors(filteredErrors, invisibleErrors);

              promises.push(this.sendSyncMessage());
            } else {
              this.saveErrors(result.errors);
            }
            promises = promises.concat(
              _.map(result.errors, error => {
                if (error.name === 'OutgoingIdentityKeyError') {
                  promises.push(this.forceResendAuto(error.number));
                }
              })
            );
          }

          this.trigger('send-error', this.get('errors'));

          return Promise.all(promises);
        });
    },

    async sendSyncMessageOnly(syncMessage) {
      // save rapid files in message
      const rapidFiles = syncMessage.rapidFiles;
      if (rapidFiles instanceof Array && rapidFiles.length > 0) {
        this.set({
          rapidFiles: rapidFiles.concat(this.get('rapidFiles') || []),
        });
      }

      const now = Date.now();
      this.set({
        dataMessage: syncMessage.dataMessage.toArrayBuffer(),
        // These are the same as a normal send()
        sent_to: [this.OUR_NUMBER],
        sent: true,
        expirationStartTimestamp: now,
        recallableStartTimestamp: this.get('sent_at'),
      });

      const recall = this.get('recall');
      if (recall) {
        const { target } = recall;
        if (target && target.id) {
          const found = await this.findMessage(target.id);

          if (found) {
            found.set({
              hasBeenRecalled: true,
            });

            await window.Signal.Data.saveMessage(found.attributes, {
              Message: Whisper.Message,
            });

            const conversation = found.getConversation();
            if (conversation) {
              conversation.trigger('recalled', found);
            }
          } else {
            log.error('original message was not found:', target.id);
          }
        } else {
          log.error('recall target was not found:', recall.realSource);
        }

        this.set({
          recall: {
            ...recall,
            editableStartTimestamp: now,
          },
        });
      }

      try {
        await this.sendSyncMessage();
        this.set({
          // These are unique to a Note to Self message - immediately read
          read_by: [this.OUR_NUMBER],
        });
      } catch (result) {
        const errors = (result && result.errors) || [
          new Error('Unknown error'),
        ];
        this.set({ errors });
      } finally {
        await window.Signal.Data.saveMessage(this.attributes, {
          Message: Whisper.Message,
        });

        const errors = this.get('errors');
        if (errors) {
          this.trigger('send-error', errors);
        } else {
          this.trigger('sent');
        }
      }
    },

    sendSyncMessage() {
      this.syncPromise = this.syncPromise || Promise.resolve();
      this.syncPromise = this.syncPromise.then(() => {
        const dataMessage = this.get('dataMessage');
        if (this.get('synced') || !dataMessage) {
          return Promise.resolve();
        }
        return textsecure.messaging
          .sendSyncMessage(
            dataMessage,
            this.get('sent_at'),
            this.get('destination'),
            this.get('expirationStartTimestamp'),
            this.get('rapidFiles'),
            this.get('extension'),
            this.getServerTimestamp(),
            this.get('sequenceId'),
            this.get('notifySequenceId')
          )
          .then(() => {
            this.set({
              synced: true,
              dataMessage: null,
            });
            return window.Signal.Data.saveMessage(this.attributes, {
              Message: Whisper.Message,
            });
          })
          .catch(e => {
            window.log.error('sendSyncMessage failed, ', e);
          });
      });
    },

    async saveErrors(providedErrors, invisibleErrors) {
      let errors = providedErrors;

      if (!(errors instanceof Array)) {
        errors = [errors];
      }
      errors.forEach(e => {
        window.log.error(
          'Message.saveErrors:',
          e && e.reason ? e.reason : null,
          e && e.stack ? e.stack : e
        );
      });
      errors = errors.map(e => {
        if (
          e.constructor === Error ||
          e.constructor === TypeError ||
          e.constructor === ReferenceError
        ) {
          return _.pick(e, 'name', 'message', 'code', 'number', 'reason');
        }
        return e;
      });
      errors = errors.concat(this.get('errors') || []);

      const recall = this.get('recall');
      if (recall) {
        const { target } = recall;
        if (target && target.id) {
          const found = await this.findMessage(target.id);
          if (found) {
            found.saveErrors(providedErrors, invisibleErrors);
            // recall message also should save errors, so, do not return here
            // otherwise, error recall message may be cleaned up at startup
          } else {
            log.error('original message was not found:', target.id);
          }
        } else {
          log.error('recall target was invalid:', recall);
        }
      }

      this.set({ errors });

      if (invisibleErrors) {
        const sentTo = this.get('sent_to') || [];
        const existErrors = this.get('invisibleErrors') || [];
        const filtered = existErrors.filter(e => !sentTo.includes(e.number));
        this.set({ invisibleErrors: invisibleErrors.concat(filtered) });
      }

      await window.Signal.Data.saveMessage(this.attributes, {
        Message: Whisper.Message,
      });
    },
    hasNetworkError() {
      const error = _.find(
        this.get('errors'),
        e =>
          e.name === 'MessageError' ||
          e.name === 'OutgoingMessageError' ||
          e.name === 'SendMessageNetworkError' ||
          e.name === 'SignedPreKeyRotationError'
      );
      return !!error;
    },
    async queueForwardAttachmentDownloads(forward) {
      const messageId = this.id;
      let count = 0;
      const forwardUuid = forward.uuid;

      if (!forwardUuid) {
        log.info('forward has no uuid');
        return;
      }

      const foundForward = this.findOurForwardByUuid(forwardUuid);
      if (!foundForward) {
        log.info('forward was not found:', forwardUuid);
        return;
      }
      const singleForward = this.getIfSingleForward(foundForward.forwards);
      const targetForward = singleForward || foundForward;

      const targetUuid = forwardUuid;

      const { attachments = [] } = targetForward || {};
      if (attachments.length < 1) {
        return;
      }

      const [longMessageAttachments, normalAttachments] = _.partition(
        attachments,
        attachment =>
          attachment.contentType === Whisper.Message.LONG_MESSAGE_CONTENT_TYPE
      );

      if (longMessageAttachments.length > 1) {
        window.log.error(
          `Received more than one long message attachment in message ${this.idForLogging()}`
        );
      }

      if (longMessageAttachments.length > 0) {
        count += 1;
        targetForward.bodyPending = true;
        await window.Signal.AttachmentDownloads.addJob(
          longMessageAttachments[0],
          {
            messageId,
            type: 'long-message',
            index: 0,
            forwardUuid: targetUuid,
          }
        );
      }

      targetForward.attachments = await Promise.all(
        normalAttachments.map((attachment, index) => {
          if (attachment.path) {
            // has been downloaded
            // delete status if exists
            const omitField = ['pending', 'error', 'fetchError'];
            const picked = _.pick(attachment, omitField);
            if (Object.keys(picked).length > 0) {
              count += 1;
              return _.omit(attachment, omitField);
            }

            return attachment;
          } else {
            count += 1;
            return window.Signal.AttachmentDownloads.addJob(attachment, {
              messageId,
              type: 'attachment',
              index,
              forwardUuid: targetUuid,
            });
          }
        })
      );

      if (count > 0) {
        await window.Signal.Data.saveMessage(this.attributes, {
          Message: Whisper.Message,
        });
      }

      this.trigger(`update_forward:${targetUuid}`);
    },
    async queueAttachmentDownloads() {
      const messageId = this.id;
      let count = 0;
      let bodyPending;

      const [longMessageAttachments, normalAttachments] = _.partition(
        this.get('attachments') || [],
        attachment =>
          attachment.contentType === Whisper.Message.LONG_MESSAGE_CONTENT_TYPE
      );

      if (longMessageAttachments.length > 1) {
        window.log.error(
          `Received more than one long message attachment in message ${this.idForLogging()}`
        );
      }
      if (longMessageAttachments.length > 0) {
        count += 1;
        bodyPending = true;
        await window.Signal.AttachmentDownloads.addJob(
          longMessageAttachments[0],
          {
            messageId,
            type: 'long-message',
            index: 0,
          }
        );
      }

      const attachments = await Promise.all(
        normalAttachments.map((attachment, index) => {
          count += 1;
          return window.Signal.AttachmentDownloads.addJob(attachment, {
            messageId,
            type: 'attachment',
            index,
          });
        })
      );

      const contacts = await Promise.all(
        (this.get('contacts') || []).map(async (item, index) => {
          if (!item.avatar || !item.avatar.avatar) {
            return item;
          }

          count += 1;
          return {
            ...item,
            avatar: {
              ...item.avatar,
              avatar: await window.Signal.AttachmentDownloads.addJob(
                item.avatar.avatar,
                {
                  messageId,
                  type: 'contact',
                  index,
                }
              ),
            },
          };
        })
      );

      let quote = this.get('quote');
      if (quote && quote.attachments && quote.attachments.length) {
        quote = {
          ...quote,
          attachments: await Promise.all(
            (quote.attachments || []).map(async (item, index) => {
              // If we already have a path, then we copied this image from the quoted
              //    message and we don't need to download the attachment.
              if (!item.thumbnail || item.thumbnail.path) {
                return item;
              }

              count += 1;
              return {
                ...item,
                thumbnail: await window.Signal.AttachmentDownloads.addJob(
                  item.thumbnail,
                  {
                    messageId,
                    type: 'quote',
                    index,
                  }
                ),
              };
            })
          ),
        };
      }

      let group = this.get('group');
      if (group && group.avatar) {
        group = {
          ...group,
          avatar: await window.Signal.AttachmentDownloads.addJob(group.avatar, {
            messageId,
            type: 'group-avatar',
            index: 0,
          }),
        };
      }

      if (count > 0) {
        this.set({ bodyPending, attachments, contacts, quote, group });

        await window.Signal.Data.saveMessage(this.attributes, {
          Message: Whisper.Message,
        });
      }

      const forwardContext = this.get('forwardContext') || {};
      const forwards = forwardContext.forwards || [];
      forwards.forEach(this.queueForwardAttachmentDownloads.bind(this));
    },

    async copyFromQuotedMessage(message) {
      const { quote } = message;
      if (!quote) {
        return message;
      }

      const { attachments, id, author } = quote;
      const collection = await window.Signal.Data.getMessagesBySentAt(id, {
        MessageCollection: Whisper.MessageCollection,
      });
      const found = collection.find(item => {
        const messageAuthor = item.getContact();
        return messageAuthor && author === messageAuthor.id;
      });

      if (!found) {
        quote.referencedMessageNotFound = true;
        return message;
      }

      const queryMessage = MessageController.register(found.id, found);
      const { text, attachments: queryAttachments } =
        queryMessage.prepareForQuoted();

      // using re-generated text
      if (text) {
        quote.text = text;
      }

      const firstAttachment = attachments[0];
      if (!firstAttachment) {
        return message;
      }

      firstAttachment.thumbnail = null;
      const { contentType } = firstAttachment;
      if (
        !window.Signal.Util.GoogleChrome.isImageTypeSupported(contentType) &&
        !window.Signal.Util.GoogleChrome.isVideoTypeSupported(contentType)
      ) {
        return message;
      }

      try {
        if (
          queryMessage.get('schemaVersion') <
          TypedMessage.CURRENT_SCHEMA_VERSION
        ) {
          const upgradedMessage = await upgradeMessageSchema(
            queryMessage.attributes
          );
          queryMessage.set(upgradedMessage);
          await window.Signal.Data.saveMessage(upgradedMessage, {
            Message: Whisper.Message,
          });
        }
      } catch (error) {
        window.log.error(
          'Problem upgrading message quoted message from database',
          Errors.toLogFormat(error)
        );
        return message;
      }

      if (queryAttachments.length > 0) {
        const queryFirst = queryAttachments[0];
        const { thumbnail } = queryFirst;

        if (thumbnail && thumbnail.path) {
          firstAttachment.thumbnail = {
            ...thumbnail,
            copied: true,
          };
        }
      }

      return message;
    },

    handleDataMessage(
      initialMessage,
      confirm,
      filterDuplicate,
      conversationPushedAt
    ) {
      // This function is called from the background script in a few scenarios:
      //   1. on an incoming message
      //   2. on a sent message sync'd from another device
      //   3. in rare cases, an incoming message can be retried, though it will
      //      still go through one of the previous two codepaths
      const message = this;
      const source = message.get('source');
      const type = message.get('type');
      let conversationId = message.get('conversationId');
      if (initialMessage.group) {
        conversationId = initialMessage.group.id;
      }
      const GROUP_TYPES = textsecure.protobuf.GroupContext.Type;
      // 获取聊天列表
      const conversation = ConversationController.get(conversationId);
      return conversation.queueJob(async () => {
        window.log.info(
          'Starting handleDataMessage for message',
          message.idForLogging(),
          'in conversation',
          conversation.idForLogging()
        );

        if (filterDuplicate) {
          const msg = await filterDuplicate();
          if (!msg) {
            // has duplicated message, just return
            return confirm();
          }

          if (msg.id) {
            // rehandle unsupported message
            // use previous message id
            message.set({ id: msg.id });
          }
        }

        // 获取引用信息
        const withQuoteReference =
          await this.copyFromQuotedMessage(initialMessage);
        const dataMessage = await upgradeMessageSchema(withQuoteReference);

        try {
          const now = new Date().getTime();
          let rejoined = false;
          let attributes = {
            ...conversation.attributes,
          };
          if (dataMessage.group) {
            let groupUpdate = null;
            attributes = {
              ...attributes,
              type: 'group',
              groupId: dataMessage.group.id,
            };
            if (dataMessage.group.type === GROUP_TYPES.UPDATE) {
              attributes = {
                ...attributes,
                name: dataMessage.group.name,
                members: dataMessage.group.members,
              };

              groupUpdate =
                conversation.changedAttributes(
                  _.pick(dataMessage.group, 'name', 'avatar')
                ) || {};

              const joined = _.difference(
                attributes.members,
                conversation.get('members')
              );
              if (joined.length > 0) {
                groupUpdate.joined = joined;
              }

              // removed
              const removed = _.difference(
                conversation.get('members'),
                attributes.members
              );
              if (removed.length > 0) {
                if (removed.includes(this.OUR_NUMBER)) {
                  // myself was removed
                  attributes.left = true;
                }
                groupUpdate.removed = removed;
              }

              if (conversation.isMeLeftGroup()) {
                window.log.warn('re-added to a left group');
                rejoined = true;
                attributes.left = false;
              }
            } else if (dataMessage.group.type === GROUP_TYPES.QUIT) {
              if (source === textsecure.storage.user.getNumber()) {
                attributes.left = true;
                groupUpdate = { left: 'You' };
              } else {
                groupUpdate = { left: source };
              }
              attributes.members = _.without(
                conversation.get('members'),
                source
              );
            }

            if (groupUpdate !== null) {
              message.set({ group_update: groupUpdate });
            }
          }

          const offValue = Whisper.Translate.getOffValue();

          const translateLang =
            type === 'outgoing' ? offValue : conversation.getTranslateLang();

          const conversationTranslate = translateLang != offValue;

          message.set({
            attachments: dataMessage.attachments,
            body: dataMessage.body,
            mentions: dataMessage.mentions,
            atPersons: dataMessage.atPersons,
            contacts: dataMessage.contacts,
            conversationId: conversation.id,
            decrypted_at: now,
            errors: [],
            flags: dataMessage.flags,
            hasAttachments: dataMessage.hasAttachments,
            hasFileAttachments: dataMessage.hasFileAttachments,
            hasVisualMediaAttachments: dataMessage.hasVisualMediaAttachments,
            quote: dataMessage.quote,
            schemaVersion: dataMessage.schemaVersion,
            forwardContext: dataMessage.forwardContext,
            requiredProtocolVersion:
              dataMessage.requiredProtocolVersion ||
              textsecure.protobuf.DataMessage.ProtocolVersion.INITIAL,
            supportedVersionAtReceive:
              textsecure.protobuf.DataMessage.ProtocolVersion.CURRENT,
            recall: dataMessage.recall,
            translateLang,
            conversationTranslate,
            // task: dataMessage.task,
            // vote: dataMessage.vote,
            // card: dataMessage.card,
            mentionsAtFlags: dataMessage.mentionsAtFlags,
            mentionsQuoteFlags: dataMessage.mentionsQuoteFlags,
          });

          if (dataMessage.screenshot) {
            message.set({ screenshot: dataMessage.screenshot });
          }

          if (dataMessage.messageMode) {
            message.set({ messageMode: dataMessage.messageMode });
          }

          if (conversationPushedAt) {
            // latest conversation message, just update conversation latestMessage
            let lastMessageJSON = null;
            let lastMessageStatusModel = null;
            let lastMessageNotificationTextModel = null;

            if (!message.isExpired()) {
              lastMessageJSON = message.toJSON();
              lastMessageStatusModel = message.getMessagePropStatus();
              lastMessageNotificationTextModel = message.getNotificationText();
            }

            const lastMessageUpdate =
              window.Signal.Types.Conversation.createLastMessageUpdate({
                currentTimestamp: conversation.get('timestamp') || null,
                lastMessage: lastMessageJSON,
                lastMessageStatus: lastMessageStatusModel,
                lastMessageNotificationText: lastMessageNotificationTextModel,
                lastMessageVersion: 1,
              });

            const timestampUpdate = lastMessageUpdate.timestamp;

            // already has same or newer latestMessage
            const existLatestTimestamp = conversation.get(
              'latestMessageTimestamp'
            );
            if (existLatestTimestamp >= timestampUpdate) {
              window.log.info(
                'skip older latest message',
                message.idForLogging(),
                existLatestTimestamp,
                'exist newer than',
                timestampUpdate,
                'in',
                conversation.idForLogging()
              );
              return;
            }

            // maybe update timestamp
            window.log.info(
              'update conversation preview by latest message',
              timestampUpdate,
              message.idForLogging(),
              conversation.idForLogging()
            );

            conversation.changed = {};

            conversation.set({
              ...attributes,
              ...lastMessageUpdate,
              active_at: timestampUpdate,
              isArchived: false,
              latestMessageTimestamp: timestampUpdate,
            });

            if (conversation.hasChanged()) {
              await window.Signal.Data.updateConversation(
                conversation.attributes
              );
            }

            return;
          }

          if (dataMessage.topicContext) {
            // receive topic message from other devices
            const { topicContext, botContext } = dataMessage;
            // 回复在支持群回复@bot topic
            const { source, sourceDevice, timestamp } = topicContext.source;

            topicContext.topicCompatible = true;

            if (
              this.get('source') === source &&
              this.getSourceDevice() == sourceDevice &&
              this.get('sent_at') === timestamp
            ) {
              // 因为匹配到的原始消息是自己，说明是这是一条别人 /topic 发起的消息，
              // 这里需要设置 isUseTopicCommand 为 true
              message.set({
                threadId: topicContext.topicId,
                threadContext: topicContext,
                isUseTopicCommand: true,
                threadReplied: true,
                isAtBotTopic: true,
              });
            } else {
              message.set({
                threadId: topicContext.topicId,
                threadContext: topicContext,
                botContext: botContext,
                threadReplied: false,
              });
            }

            // just save topicContext as threadContext
          } else {
            // receive thread message from old devices
            if (dataMessage.threadContext) {
              const { threadContext } = dataMessage;

              threadContext.threadCompatible = true;

              const threadId = message.makeThreadId(threadContext);
              message.set({
                threadId,
                threadContext,
                threadReplied: false,
              });
            }

            // update bot context and thread context
            if (dataMessage.botContext) {
              const { botContext } = dataMessage;

              const threadContext = {
                ..._.pick(botContext, ['source', 'groupId', 'type']),
                botId: source,
                threadCompatible: true,
                topicCompatible: true,
              };

              message.set({
                botContext,
                threadContext,
                threadId: message.makeThreadId(threadContext),
                threadReplied: false,
              });
            }
          }

          const latestMessageTimestamp = conversation.get(
            'latestMessageTimestamp'
          );
          if (
            !latestMessageTimestamp ||
            latestMessageTimestamp <= message.getServerTimestamp()
          ) {
            if (dataMessage.recall) {
              //
            } else {
              if (
                latestMessageTimestamp !== message.getServerTimestamp() &&
                (message.isOutgoing() ||
                  (message.isIncoming() &&
                    !(await message.isIncomingMessageRead())))
              ) {
                attributes.active_at = now;
              }
            }
            attributes.latestMessageTimestamp = null;
          }

          // update message expireTimer
          if (dataMessage.expireTimer) {
            message.set({ expireTimer: dataMessage.expireTimer });
          } else {
            // correct message expiry for conversation except ME
            if (!conversation.isMe()) {
              message.set({
                expireTimer: conversation.getConversationMessageExpiry(),
              });
            }
          }

          if (type === 'incoming') {
            // const readSync = Whisper.ReadSyncs.forMessage(message);
            // if (readSync) {
            //   if (
            //     message.get('expireTimer') &&
            //     !message.get('expirationStartTimestamp')
            //   ) {
            //     message.set(
            //       'expirationStartTimestamp',
            //       Math.min(readSync.get('read_at'), Date.now())
            //     );
            //   }
            // }

            // mark sender has read at here
            if (!conversation.isChatWithoutReceipt()) {
              Whisper.ReadReceipts.forMessage(message);
            }

            if (message.isExpirationTimerUpdate()) {
              message.unset('unread');
              // This is primarily to allow the conversation to mark all older
              // messages as read, as is done when we receive a read sync for
              // a message we already know about.
              const c = message.getConversation();
              if (c) {
                c.onReadMessage(message);
              }
            } else {
              let newUnreadCount = conversation.get('unreadCount');

              if (dataMessage.recall && dataMessage.recall.realSource) {
                // do not set unread
                // and recall message do not contribute for unreadCount
                message.unset('unread');
              } else {
                // message was not read, then unreadCount+1
                if (
                  message.isIncoming() &&
                  !(await message.isIncomingMessageRead())
                ) {
                  newUnreadCount += 1;
                } else {
                  // has been read, unreadCount unchanged ?
                }
              }

              attributes = {
                ...attributes,
                unreadCount: newUnreadCount,
                isArchived: false,
              };
            }
          }

          if (type === 'outgoing') {
            const conversationRecipients = conversation.getRecipients();

            // unarchived this conversation
            // and set recipients
            attributes = {
              ...attributes,
              isArchived: false,
              unreadCount: 0,
            };

            const markAsAt = conversation.get('markAsAt');
            if (message.getServerTimestamp() > markAsAt) {
              attributes = {
                ...attributes,
                markAsAt: message.getServerTimestamp(),
              };

              conversation.unset('markAsFlag');
            }

            message.set({
              recipients: conversationRecipients,
            });

            // A sync'd message to ourself is automatically considered read
            if (conversation.isMe()) {
              message.set({
                read_by: conversationRecipients,
              });
            } else if (conversation.isChatWithoutReceipt()) {
              message.set({
                noNeedReceipts: true,
                read_by: conversationRecipients,
              });
            } else {
              Whisper.ReadReceipts.forMessage(message);
            }
          }

          const conversationTimestamp = conversation.get('timestamp');
          if (
            !conversationTimestamp ||
            message.getServerTimestamp() > conversationTimestamp
          ) {
            conversation.lastMessage = message.getNotificationText();

            attributes = {
              ...attributes,
              timestamp: message.getServerTimestamp(),
            };
          }

          if (dataMessage.profileKey) {
            const profileKey = dataMessage.profileKey.toString('base64');
            if (source === textsecure.storage.user.getNumber()) {
              attributes = {
                ...attributes,
                profileSharing: true,
              };
            } else if (conversation.isPrivate()) {
              conversation.setProfileKey(profileKey);
            } else {
              ConversationController.getOrCreateAndWait(source, 'private').then(
                sender => {
                  sender.setProfileKey(profileKey);
                }
              );
            }
          }

          const globalConfig = window.getGlobalConfig();
          const recallConfig = globalConfig.recall;

          if (type === 'outgoing') {
            message.set({
              recallableTimer: recallConfig.timeoutInterval,
              recallableStartTimestamp: message.get('sent_at'),
            });
          }

          // handle recall message.
          let recalledMessage;
          if (dataMessage.recall && dataMessage.recall.realSource) {
            const recall = {
              ...dataMessage.recall,
              recallFinished: true,
              editableTimer: recallConfig.editableInterval,
              editableStartTimestamp: message.get('sent_at'),
            };

            recalledMessage = await this.loadMessageByRealSource(
              recall.realSource
            );
            if (recalledMessage) {
              message.set({
                recall: {
                  ...recall,
                  target: {
                    id: recalledMessage.get('id'),
                    body: recalledMessage.get('body'),
                    sent_at: recalledMessage.get('sent_at'),
                    rapidFiles: recalledMessage.get('rapidFiles'),
                    received_at: recalledMessage.get('received_at'),
                    serverTimestamp: recalledMessage.getServerTimestamp(),
                    sequenceId: recalledMessage.get('sequenceId'),
                    notifySequenceId: recalledMessage.get('notifySequenceId'),
                  },
                },
              });

              if (
                type === 'incoming' &&
                recalledMessage.isIncoming() &&
                !(await recalledMessage.isIncomingMessageRead())
              ) {
                // if recalledMessage is unread, unreadCount minus 1
                const newUnreadCount = conversation.get('unreadCount') - 1;
                attributes = {
                  ...attributes,
                  unreadCount: newUnreadCount > 0 ? newUnreadCount : 0,
                };
              }
            } else {
              message.set({ recall });
              // add unhandled recall message
              Whisper.Recalls.addRecall(message);
            }
          } else {
            // search if message was recalled
            try {
              // get recall message for message
              const recallMessage = Whisper.Recalls.forMessage(message);
              if (recallMessage) {
                // current message was recalled
                message.set({
                  recalled: {
                    byId: recallMessage.id,
                  },
                  hasBeenRecalled: true,
                });

                const recall = recallMessage.get('recall');
                recallMessage.set({
                  recall: {
                    ...recall,
                    target: {
                      id: message.get('id'),
                      body: message.get('body'),
                      sent_at: message.get('sent_at'),
                      rapidFiles: message.get('rapidFiles'),
                      received_at: message.get('received_at'),
                      serverTimestamp: message.getServerTimestamp(),
                      sequenceId: message.get('sequenceId'),
                      notifySequenceId: message.get('notifySequenceId'),
                    },
                  },
                });

                await window.Signal.Data.saveMessage(recallMessage.attributes, {
                  Message: Whisper.Message,
                });

                if (
                  type === 'incoming' &&
                  !(await message.isIncomingMessageRead())
                ) {
                  const newUnreadCount = conversation.get('unreadCount') - 1;
                  attributes.unreadCount =
                    newUnreadCount > 0 ? newUnreadCount : 0;
                }
              }
            } catch (error) {
              log.error(
                'error occur when find recall for message',
                message.idForLogging(),
                error
              );
            }
          }

          try {
            const reaction = Whisper.EmojiReactions.forMessage(message);
            if (reaction) {
              await message.onReactionWithoutSave(reaction);
            }
          } catch (error) {
            log.error(
              'error occur when find reaction for message',
              message.idForLogging(),
              error
            );
          }

          // do not save/update message to database before this,
          // because message id does not exist yet.
          const id = await window.Signal.Data.saveMessage(message.attributes, {
            Message: Whisper.Message,
          });
          message.set({ id });
          MessageController.register(message.id, message);

          if (recalledMessage) {
            recalledMessage.set({
              recalled: {
                byId: id,
              },
              hasBeenRecalled: true,
            });

            await window.Signal.Data.saveMessage(recalledMessage.attributes, {
              Message: Whisper.Message,
            });

            const foundConversation = recalledMessage.getConversation();
            if (foundConversation) {
              foundConversation.trigger('recalled', recalledMessage);
            }
          }

          // Note that this can save the message again, if jobs were queued. We need to
          //   call it after we have an id for this message, because the jobs refer back
          //   to their source message.
          if (!message.isRecalledMessage()) {
            await message.queueAttachmentDownloads();
          }

          // 1 incoming Private: skipping
          // 2 incoming GroupV1: conversation upgrade to V2 (local+server)
          // 3 incoming GroupV2: conversation upgrade to V2 (local)
          if (!conversation.isPrivate()) {
            if (conversation.isGroupV2()) {
              // inform server
              const groupUpdate = message.get('group_update');
              if (groupUpdate) {
                const addedMembers = groupUpdate.joined || [];
                if (
                  addedMembers.length > 0 &&
                  conversation.isMeGroupV2Owner()
                ) {
                  try {
                    await conversation.apiAddGroupV2Members(addedMembers);
                  } catch (error) {
                    log.error(
                      'handleDataMessage: add members to group failed,',
                      error
                    );
                  }
                }

                // old signal do not support remove members
                // so, if removed presented, it's must be new groupV2 operation
                const removedMembers = groupUpdate.removed || [];
                if (removedMembers.length > 0) {
                  const membersV2 = conversation.get('membersV2');

                  attributes = {
                    ...attributes,
                    membersV2: membersV2.filter(
                      m => !removedMembers.includes(m.id)
                    ),
                  };
                }

                const changedName = groupUpdate.name;
                if (changedName && changedName.length > 0) {
                  try {
                    await conversation.apiEditGroupV2Meta(changedName);
                  } catch (error) {
                    log.error(
                      'handleDataMessage: edit group info failed,',
                      error
                    );
                  }
                }

                if (groupUpdate.left) {
                  try {
                    await conversation.apiRemoveGroupV2Members([source]);
                  } catch (error) {
                    log.error(
                      'handleDataMessage: remove member from group failed,',
                      error
                    );
                    // if api remove failed, we should manually remove ourself from membersV2
                    const membersV2 = conversation.get('membersV2');
                    conversation.set({
                      membersV2: membersV2.filter(m => m.id != source),
                    });

                    attributes = {
                      ...attributes,
                      membersV2: membersV2.filter(m => m.id != source),
                    };
                  }
                }
              }
              if (rejoined) {
                log.info('rejoined, load members from server.');
                try {
                  await conversation.apiLoadGroupV2();
                } catch (error) {
                  log.error('reload group info from server failed.');
                }
              }
            } else {
              // groupV1
            }

            // update lastActive
            if (type === 'incoming') {
              conversation.updateMemberLastActive(
                source,
                message.get('serverTimestamp')
              );
            }
          }

          conversation.set(attributes);
          await window.Signal.Data.updateConversation(conversation.attributes);

          if (!message.isRecalledMessage()) {
            conversation.trigger('newmessage', message);

            try {
              message.handleIfQuotedReferenceNotFound();
            } catch (error) {
              log.error(
                'handleIfQuotedReferenceNotFound error when receiving',
                error
              );
            }

            if (message.get('unread')) {
              await conversation.notify(message);
            }
          }

          confirm();
        } catch (error) {
          const errorForLog = error && error.stack ? error.stack : error;
          window.log.error(
            'handleDataMessage',
            message.idForLogging(),
            'error:',
            errorForLog
          );
          throw error;
        }

        window.log.info(
          'Done handleDataMessage for message',
          message.idForLogging(),
          'in conversation',
          conversation.idForLogging()
        );
      });
    },

    async loadMessageByRealSource(realSource, ignoreDevice = false) {
      const { source, sourceDevice, timestamp } = realSource;

      const matchFilter = m =>
        m.getSource() === source &&
        !m.isExpired() &&
        (ignoreDevice || m.getSourceDevice() == sourceDevice);

      try {
        const conversation = this.getConversation();
        if (conversation) {
          const founds = conversation.messageCollection.where({
            sent_at: timestamp,
          });
          if (founds.length) {
            const exactMatch = founds.filter(matchFilter);
            if (exactMatch.length) {
              return exactMatch[0];
            }
          }
        }

        const messages = await window.Signal.Data.getMessagesBySentAt(
          timestamp,
          { MessageCollection: Whisper.MessageCollection }
        );

        const foundFromDB = messages.find(matchFilter);
        if (!foundFromDB) {
          log.error('message was not found from DB:', realSource);
          return null;
        }

        return MessageController.register(foundFromDB.id, foundFromDB);
      } catch (error) {
        log.error('load message failed, ', error, realSource);
        return null;
      }
    },

    async markRead(readAt) {
      this.markReadWithoutSaving(readAt);
      await window.Signal.Data.saveMessage(this.attributes, {
        Message: Whisper.Message,
      });
    },

    markReadWithoutSaving(readAt) {
      this.unset('unread');

      if (this.getExpireTimer() && !this.get('expirationStartTimestamp')) {
        const expirationStartTimestamp = Math.min(
          Date.now(),
          readAt || Date.now()
        );
        this.attributes.expirationStartTimestamp = expirationStartTimestamp;
        this.setToExpireWithoutSaving();
      }

      Whisper.Notifications.remove(
        Whisper.Notifications.where({
          messageId: this.id,
        })
      );
    },
    isExpiring() {
      return this.getExpireTimer() && this.get('expirationStartTimestamp');
    },
    isExpired() {
      return (
        this.messageClearAnchorExpire() ||
        this.msTilExpire() <= 0 ||
        this.identityKeyResetExpire()
      );
    },
    messageClearAnchorExpire() {
      const conversation = this.getConversation();

      if (!conversation || conversation.isMe()) {
        return false;
      }

      const messageClearAnchor = conversation.getMessageClearAnchor();
      if (!messageClearAnchor) {
        return false;
      }

      const start = this.getExpirationStartTimestamp();
      return start <= messageClearAnchor;
    },
    identityKeyResetExpire() {
      const conversation = this.getConversation();
      if (conversation.isMe()) {
        return false;
      }

      const sourceConv = ConversationController.get(this.getSource());

      if (!sourceConv) {
        return false;
      }

      const identityKeyResetAt = sourceConv.getIdentityKeyResetAt();
      if (!identityKeyResetAt) {
        return false;
      }

      return this.getServerTimestamp() < identityKeyResetAt;
    },
    getExpireTimer() {
      return (
        this.getConversation()?.getConversationMessageExpiry() ||
        this.get('expireTimer')
      );
    },
    msTilExpire() {
      if (!this.isExpiringNew()) {
        return Infinity;
      }
      const now = Date.now();
      const start = this.getExpirationStartTimestamp();
      const delta = this.getExpireTimer() * 1000;

      let msFromNow = start + delta - now;
      if (msFromNow < 0) {
        msFromNow = 0;
      }
      return msFromNow;
    },
    isExpiringNew() {
      return this.getExpireTimer() && this.getExpirationStartTimestamp();
    },
    getExpirationStartTimestamp() {
      return (
        this.get('expirationStartTimestamp') || this.expirationStartTimestamp
      );
    },
    updateExpiresAtMs() {
      const start = this.getExpirationStartTimestamp();
      const delta = this.getExpireTimer() * 1000;
      this.expirationTimestamp = start && delta ? start + delta : Infinity;
    },
    setToExpireWithoutSaving(force = false) {
      if (this.isExpiring() && (force || !this.get('expires_at'))) {
        const start = this.get('expirationStartTimestamp');
        const delta = this.getExpireTimer() * 1000;
        const expiresAt = start + delta;

        this.set({ expires_at: expiresAt });

        window.log.info('Set message expiration', {
          expiresAt,
          sentAt: this.get('sent_at'),
        });

        return true;
      }

      return false;
    },
    async setToExpire(force = false) {
      if (this.setToExpireWithoutSaving(force)) {
        const id = this.get('id');
        if (id) {
          await window.Signal.Data.saveMessage(this.attributes, {
            Message: Whisper.Message,
          });
        }
      }
    },
    getReadMemberCount() {
      const conversation = this.getConversation();
      if (!conversation) {
        return 0;
      }

      if (conversation.isChatWithoutReceipt()) {
        return Number.MAX_VALUE;
      }

      const readBy = this.get('read_by') || [];
      const recipients = this.get('recipients') || [];
      const readByAt = conversation.get('read_by_at') || {};

      recipients.forEach(recipient => {
        const maxServerTimestamp = readByAt[recipient]?.maxServerTimestamp;
        if (
          maxServerTimestamp &&
          maxServerTimestamp >= this.getServerTimestamp()
        ) {
          readBy.push(recipient);
        }
      });

      const readByLen = _.uniq(readBy).length;
      return readByLen >= recipients.length ? Number.MAX_VALUE : readByLen;
    },
    hasUnreadMembers() {
      const props = this.propsForMessage;
      if (props && props.readMemberCount !== Number.MAX_VALUE) {
        return true;
      }

      return false;
    },
    isGroupMessage() {
      const conversation = this.getConversation();
      return conversation && !conversation.isPrivate();
    },
    isUnsupportedMessage() {
      const versionAtReceive = this.get('supportedVersionAtReceive');
      const requiredVersion = this.get('requiredProtocolVersion');

      return (
        _.isNumber(versionAtReceive) &&
        _.isNumber(requiredVersion) &&
        versionAtReceive < requiredVersion
      );
    },
    isReactionUnsupportedMessage() {
      const currentVersion =
        textsecure.protobuf.DataMessage.ProtocolVersion.CURRENT;

      const reactionVersion =
        textsecure.protobuf.DataMessage.ProtocolVersion.REACTION;

      const requiredVersion = this.get('requiredProtocolVersion');

      // delete reactions' unsupported message
      if (
        currentVersion >= reactionVersion &&
        requiredVersion === reactionVersion
      ) {
        return true;
      }

      return false;
    },
    getServerTimestampForSort() {
      const recall = this.get('recall');
      if (recall) {
        const { target, realSource } = recall;
        if (target) {
          if (target.serverTimestamp) {
            return target.serverTimestamp;
          }

          if (target.sent_at) {
            return target.sent_at;
          }
        } else {
          if (realSource?.serverTimestamp) {
            return realSource.serverTimestamp;
          }

          if (realSource?.timestamp) {
            return realSource?.timestamp;
          }
        }
      }

      return this.getServerTimestamp() || 0;
    },
    async findMessage(messageId) {
      let found = MessageController.getById(messageId);
      if (!found) {
        const fetched = await window.Signal.Data.getMessageById(messageId, {
          Message: Whisper.Message,
        });

        if (fetched) {
          found = MessageController.register(fetched.id, fetched);
          this.trigger('change');
        } else {
          log.error('message not found in database for ', messageId);
        }
      }

      return found;
    },
    async onChangeSpeechToText(attachment) {
      const transcribedText = this.get('transcribedText');
      if (transcribedText) {
        await this.cancelSpeechToText();
      } else {
        await this.doSpeechToText(attachment);
      }
    },
    async doSpeechToText(attachment) {
      if (this.transcribing) {
        return;
      }
      try {
        this.transcribing = true;
        this.transcribingError = null;
        this.trigger('change');

        const attachmentWithData = await loadAttachmentData(attachment);

        const attachmentPointer =
          await textsecure.messaging.makeAttachmentPointer(attachmentWithData, [
            'speech2Text',
          ]);

        const data = {
          authorizeId: attachmentPointer.id,
          key: dcodeIO.ByteBuffer.wrap(attachmentPointer.key).toString(
            'base64'
          ),
        };

        const { segments } = await textsecure.messaging.speechToText(data);

        const transcribedText = segments.map(segment => segment.text).join('');
        if (transcribedText) {
          this.attributes.transcribedText = transcribedText;
        } else {
          this.transcribingError = 'noTextDetected';
        }

        await window.Signal.Data.saveMessage(this.attributes, {
          Message: Whisper.Message,
        });
      } catch (error) {
        this.transcribingError = 'serverError';
        console.error('speech to text error', error);
      } finally {
        this.transcribing = false;
        this.trigger('change');
      }
    },

    async cancelSpeechToText() {
      this.attributes.transcribedText = null;
      await window.Signal.Data.saveMessage(this.attributes, {
        Message: Whisper.Message,
      });
      this.trigger('change');
    },

    async setTranslateLang(targetLang, body) {
      this.translating = false;

      if (
        Whisper.Translate.shouldTranslate(targetLang) &&
        body &&
        body.length > Whisper.Translate.getMaxSupportedTextLength()
      ) {
        this.translateError = Whisper.Translate.exceedingMaxTextLengthError();
      } else {
        this.translateError = false;
      }

      this.attributes.translateLang = targetLang;
      this.attributes.conversationTranslate = false;

      await window.Signal.Data.saveMessage(this.attributes, {
        Message: Whisper.Message,
      });

      // force trigger change:translateLang for updateTranslateCache.
      this.trigger('change change:translateLang translate-message');
    },

    getTranslatedText(targetLang) {
      const translatedCaches = this.get('translatedCaches') || [];
      return translatedCaches[targetLang];
    },

    async getFileHash(attachmentData) {
      let fileHash;

      const hash = await crypto.subtle.digest(
        { name: 'SHA-256' },
        attachmentData
      );
      fileHash = dcodeIO.ByteBuffer.wrap(hash).toString('hex');
      return fileHash;
    },

    getForwardBody(forwards) {
      let data = [];
      function recursivelyBody(forwards, depth) {
        depth = depth || 1;

        //因为pin和转发的view可以自己去检查，所以在主会话只需遍历第一层即可
        if (!forwards || depth > 1) {
          return;
        }

        for (let i = 0; i < forwards.length; i++) {
          const { body, forwards: newForwards } = forwards[i];
          if (body) {
            data.push(body);
          }
          recursivelyBody(newForwards, depth + 1);
        }
        return data;
      }

      let bodyData = recursivelyBody(forwards);
      let filterData = Array.from(new Set(Array.from(bodyData))); // 一次去重
      let filterDataSecond = [];
      for (let i = 0; i < filterData.length; i++) {
        if (
          filterData[i] &&
          filterData[i] !== '[Unsupported message type]' &&
          filterData[i] !== '[This message type cannot be displayed]'
        ) {
          filterDataSecond.push(filterData[i]);
        }
      }
      return filterDataSecond;
    },

    getForwardAttachments(forwards) {
      const allAttachments = new Set();

      function recursivelyAttachments(forwards, depth) {
        depth = depth || 1;

        if (!forwards || depth > 1) {
          return;
        }

        for (let i = 0; i < forwards.length; i++) {
          const { attachments, forwards: newForwards } = forwards[i];
          if (attachments?.length) {
            attachments.forEach(attachment => {
              if (!_.isEmpty(attachment)) {
                allAttachments.add(attachment);
              }
            });
          }
          recursivelyAttachments(newForwards, depth + 1);
        }
      }

      recursivelyAttachments(forwards);

      return Array.from(allAttachments);
    },
    updateTranslateCache() {
      const targetLang = this.get('translateLang');
      if (!Whisper.Translate.shouldTranslate(targetLang)) {
        return;
      }

      const translated = this.getTranslatedText(targetLang);
      if (translated) {
        if (!this.alreadyTranslated) {
          this.trigger('translate-message');
          this.alreadyTranslated = true;
        }

        return;
      }

      const forwardContext = this.get('forwardContext') || {};
      const forwards = forwardContext.forwards || [];

      const singleForward = this.getIfSingleForward(forwards);

      const body = singleForward
        ? singleForward.body || ''
        : forwards.length > 0
          ? ''
          : this.get('body');

      const bodyPending = singleForward
        ? singleForward.bodyPending
        : this.get('bodyPending');

      const exceedingMaxLengthError =
        Whisper.Translate.exceedingMaxTextLengthError();
      if (
        !body ||
        bodyPending ||
        this.translateError === exceedingMaxLengthError
      ) {
        return;
      }

      if (body.length > Whisper.Translate.getMaxSupportedTextLength()) {
        this.translateError = exceedingMaxLengthError;
        this.trigger('change translate-message');
        return;
      }

      if (this.translating) {
        return;
      }

      return async () => {
        this.translating = true;
        this.translateError = false;
        this.trigger('change translate-message');

        try {
          const result = await textsecure.messaging.translateContent(
            [body],
            targetLang
          );
          if (result instanceof Array && result.length > 0) {
            const { translatedText } = result[0];
            if (translatedText && translatedText.length > 0) {
              const translatedCaches = this.get('translatedCaches') || [];

              this.translating = false;

              this.set({
                translatedCaches: {
                  ...translatedCaches,
                  [targetLang]: translatedText,
                },
              });
            } else {
              throw new Error('Empty translated text responsed');
            }
          } else {
            throw new Error('Server response result is invalid.');
          }
        } catch (error) {
          log.error('translate error:', error);
          this.translateError = true;
          this.translating = false;
        } finally {
          this.trigger('change translate-message');
        }

        await window.Signal.Data.saveMessage(this.attributes, {
          Message: Whisper.Message,
        });
      };
    },

    prepareForQuoted() {
      // task
      if (this.get('task')) {
        return {
          text: i18n('shortForTaskMessage'),
        };
      }

      if (this.get('vote')) {
        return {
          text: i18n('shortForPollMessage'),
        };
      }

      // if (this.get('card')) {
      //   return {
      //     // text: i18n('shortForCardMessage'),
      //     text: this.get('card').content,
      //     attachments: this.get('attachments'),
      //   };
      // }

      // contact card
      const embeddedContacts = this.get('contacts');
      if (embeddedContacts && embeddedContacts.length > 0) {
        return {
          text: i18n('shortForContactMessage'),
        };
      }

      // forwarded message
      const forwardContext = this.get('forwardContext') || {};
      const forwards = forwardContext.forwards || [];
      if (forwards.length > 0) {
        const singleForward = this.getIfSingleForward(forwards);
        if (singleForward) {
          // const { card } = singleForward;
          // if (card?.content) {
          //   return {
          //     text: card.content,
          //     attachments: singleForward.attachments,
          //   };
          // }
          return {
            text: singleForward.body,
            attachments: singleForward.attachments,
          };
        } else {
          // if support reply combined multiple messages
          return {
            text: i18n('placeholderWrapperForChatHistory'),
          };
        }
      }

      return {
        text: this.get('body'),
        attachments: this.get('attachments'),
      };
    },

    makeThreadId(threadContext) {
      const { source, groupId, botId } = threadContext || {};
      if (!source) {
        log.error('invalid thread context for source is null.');
        return;
      }

      let combined = botId + source.source;
      if (groupId) {
        combined += window.Signal.ID.convertIdToV2(groupId);
      }

      const data = new TextEncoder().encode(combined);
      const md5Buffer = window.digestMD5(data);
      const threadId = md5Buffer.toString('hex');

      return threadId;
    },

    makeThreadIdByRealSource(realSource) {
      const { source, sourceDevice, timestamp } = realSource;
      return source + '_' + sourceDevice + '_' + timestamp;
    },
    async doReaction(emoji, mineReaction) {
      let sentAt = Date.now();

      const messageMode = this.get('messageMode');
      const remove = !!mineReaction;
      if (remove) {
        const prevTime = mineReaction.timestamp;
        if (prevTime > sentAt) {
          sentAt = prevTime + 1;
        }
      }

      const reaction = {
        emoji,
        remove,
        source: {
          source: this.getSource(),
          sourceDevice: this.getSourceDevice(),
          timestamp: this.get('sent_at'),
        },
        timestamp: sentAt,
        fromId: this.OUR_NUMBER,
      };

      const conversation = this.getConversation();
      if (!conversation) {
        log.error('message has no conversation.');
        return;
      }

      const destination = conversation.id;

      try {
        let promise;

        const extension = {
          deliveryScope: 'all', // to all recipients of the conversation
          isPrivate: conversation.isPrivate(),
          conversationId: conversation.isPrivate()
            ? conversation.id
            : conversation.getGroupV2Id(),
        };

        if (conversation.isMe()) {
          promise = textsecure.messaging
            .getMessageProto(
              destination,
              null,
              null,
              null,
              null,
              sentAt,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              messageMode,
              reaction
            )
            .then(message => ({ dataMessage: message.toArrayBuffer() }));
        } else if (conversation.isPrivate()) {
          promise = textsecure.messaging.sendReactionToNumber(
            destination,
            sentAt,
            reaction,
            extension
          );
        } else {
          const groupNumbers = conversation.getRecipients();
          promise = textsecure.messaging.sendReactionToGroup(
            destination,
            groupNumbers,
            sentAt,
            reaction,
            extension
          );
        }

        let dataMessage;

        try {
          // send message to others if needed.
          ({ dataMessage } = await promise);
        } catch (result) {
          if (result?.successfulNumbers?.length > 0) {
            const [, filteredErrors] = _.partition(result.errors, error =>
              [
                'UnregisteredUserError',
                'ForbiddenUserError',
                'UnavailableUserError',
              ].includes(error.name)
            );

            if (filteredErrors?.length) {
              throw result;
            }

            ({ dataMessage } = result);
          } else {
            throw result;
          }
        }

        // send sync message
        await textsecure.messaging.sendSyncMessage(
          dataMessage,
          sentAt,
          destination,
          0,
          null,
          extension
        );

        await this.onReactionWithoutSave(reaction);

        await window.Signal.Data.saveMessage(this.attributes, {
          Message: Whisper.Message,
        });
      } catch (error) {
        log.error('send reaction message failed,', error);
      }
    },
    async onReactionWithoutSave(reaction, byCurrentDevice) {
      const reactions = this.get('reactions') || {};

      const { emoji, timestamp, fromId } = reaction;

      // reactions: { emoji: { id: reaction } }
      const emojiReactionMap = reactions[emoji] || {};

      // try to find someone's exists reaction
      const someoneReaction = emojiReactionMap[fromId];
      if (someoneReaction?.timestamp >= timestamp) {
        log.warn('old reaction message received, drop it.');
        return;
      }

      // update someone's reaction
      if (byCurrentDevice && reaction.remove) {
        delete emojiReactionMap[fromId];
      } else {
        emojiReactionMap[fromId] = reaction;
      }

      reactions[emoji] = emojiReactionMap;

      this.set({ reactions });
      if (!this.hasChanged()) {
        // force trigger change for reactions
        this.trigger('change change:reactions');
      }
    },
    getServerTimestamp() {
      return this.get('serverTimestamp') || this.get('sent_at');
    },
    async isIncomingMessageRead() {
      if (!this.isIncoming()) {
        log.error('call on non-incoming message');
        throw Error('can not call this on non-incoming message');
      }

      const conversation = this.getConversation();
      if (!conversation) {
        log.error(
          'can not get conversation for isIncomingMessageRead',
          this.idForLogging()
        );
        return;
      }

      const markAsAt = conversation.get('markAsAt');
      const markAsFlag = conversation.get('markAsFlag');

      // if markAsRead/markAsUnread timestamp > message's timestamp
      // treat message as read.
      if (
        markAsAt >= this.getServerTimestamp() &&
        (markAsFlag ===
          textsecure.protobuf.SyncMessage.MarkAsUnread.Flag.UNREAD ||
          markAsFlag === textsecure.protobuf.SyncMessage.MarkAsUnread.Flag.READ)
      ) {
        return true;
      }

      const lastReadPosition = await conversation.getLastReadPosition();
      if (lastReadPosition) {
        if (this.getServerTimestamp() <= lastReadPosition.maxServerTimestamp) {
          return true;
        }
      } else {
        const lastRead = await window.Signal.Data.findLastReadMessage(
          conversation.id,
          { Message: Whisper.Message }
        );

        if (lastRead) {
          const lastReadModel = MessageController.register(
            lastRead.id,
            lastRead
          );
          if (this.getServerTimestamp() <= lastReadModel.getServerTimestamp()) {
            return true;
          }
        }
      }

      return false;
    },
    isMentionsYouOrAll() {
      return Mentions.hasMentionsYouOrAll(
        this.get('mentionsAtFlags'),
        this.get('mentionsQuoteFlags')
      );
    },
    updateExpirationStartTimestamp(newPositions) {
      const conversation = this.getConversation();
      if (!conversation) {
        return false;
      }

      // already have
      if (this.get('expirationStartTimestamp')) {
        return false;
      }

      const serverTimestamp = this.getServerTimestamp();
      if (!serverTimestamp) {
        return false;
      }

      if (!this.nearestPosition) {
        const positionCollection = conversation.readPositionCollection;
        if (!positionCollection.length) {
          return false;
        }

        const index = _lodash.sortedIndexBy(
          positionCollection.models,
          new Backbone.Model({ maxServerTimestamp: serverTimestamp }),
          model => model.get('maxServerTimestamp')
        );

        const found = positionCollection.at(index);
        if (found?.get('maxServerTimestamp') >= serverTimestamp) {
          this.expirationStartTimestamp = found.get('readAt');
          this.nearestPosition = found;
          return true;
        }

        return false;
      }

      if (newPositions instanceof Backbone.Collection && newPositions.length) {
        const positionCompare = newPositions.comparator;

        const last = newPositions.last();
        // all before current message
        if (last.get('maxServerTimestamp') < serverTimestamp) {
          return false;
        }

        const nearest = this.nearestPosition;
        const first = newPositions.first();
        // all after exists nearest position
        if (positionCompare(first, nearest) > 0) {
          return false;
        }

        // has intersection with [msg, nearest]
        const index = _lodash.sortedIndexBy(
          newPositions.models,
          { maxServerTimestamp: serverTimestamp },
          model => model.maxServerTimestamp || model.get('maxServerTimestamp')
        );
        const found = newPositions.at(index);
        if (found) {
          if (positionCompare(found, nearest) <= 0) {
            const readAt = found.get('readAt');
            if (this.expirationStartTimestamp > readAt) {
              this.expirationStartTimestamp = readAt;
              this.nearestPosition = found;
              return true;
            }
          }
        } else {
          // should not happen
        }
      } else {
        // invalid parameter
        log.error('changed positions is not valid collection:', newPositions);
      }

      return false;
    },
    async tryToLoadIfNotFoundQuoteReference() {
      const quote = this.get('quote');
      if (!quote) {
        return;
      }

      if (!quote.referencedMessageNotFound) {
        return;
      }

      const { id: timestamp, author: source } = quote;
      const quoted = await this.loadMessageByRealSource(
        { source, timestamp },
        true
      );
      if (!quoted) {
        return;
      }

      const { text } = quoted.prepareForQuoted();

      // using re-generated text
      if (text) {
        quote.text = text;
      }

      delete quote.referencedMessageNotFound;

      await window.Signal.Data.saveMessage(this.attributes, {
        Message: Whisper.Message,
      });

      this.trigger('change', this);
    },
    handleIfQuotedReferenceNotFound(tryImmidiately) {
      const quote = this.get('quote');
      if (!quote?.referencedMessageNotFound) {
        return;
      }

      const conversation = this.getConversation();
      if (!conversation) {
        return;
      }

      const { id, author } = quote;
      const findReferenced = model => {
        let shouldStop = false;
        if (model.get('sent_at') === id && model.getSource() === author) {
          shouldStop = true;
          this.tryToLoadIfNotFoundQuoteReference();
        } else if (!quote?.referencedMessageNotFound) {
          // already found
          shouldStop = true;
        }

        if (shouldStop) {
          this.stopListening(conversation, 'newmessage', findReferenced);
        }
      };

      this.stopListening(conversation, 'newmessage', findReferenced);
      this.listenTo(conversation, 'newmessage', findReferenced);

      if (tryImmidiately) {
        // try to load immidiately
        this.tryToLoadIfNotFoundQuoteReference().finally(() => {
          if (!quote?.referencedMessageNotFound) {
            this.stopListening(conversation, 'newmessage', findReferenced);
          }
        });
      }
    },
    getReactionEmojiSupportList() {
      if (typeof window.getGlobalConfig === 'function') {
        const supportedEmojis = window.getGlobalConfig()?.emojiReaction;
        if (Array.isArray(supportedEmojis) && supportedEmojis.length) {
          return supportedEmojis;
        }
      }

      return REACTION_EMOJIS;
    },

    maybeFromCurrentDevice() {
      return (
        this.getSource() === this.OUR_NUMBER &&
        this.getSourceDevice() == textsecure.storage.user.getDeviceId()
      );
    },

    isConfidentialMessage() {
      return this.get('messageMode') === textsecure.protobuf.Mode.CONFIDENTIAL;
    },

    async updateCondidentialStatus(number) {
      const readers = this.get('confidential_read_by') || [];
      if (readers.includes(number)) {
        return;
      } else {
        readers.push(number);
      }

      const recipients = this.get('recipients') || [];

      if (readers.length === recipients.length) {
        window.Signal.Data._removeMessages([this.id]);
        this.getConversation()?.trigger('expired', this);
      } else {
        this.set({ confidential_read_by: readers });
        await window.Signal.Data.saveMessage(this.attributes, {
          Message: Whisper.Message,
        });
      }
    },

    async seeConfidentialMessage() {
      if (this.isOutgoing() || !this.isConfidentialMessage()) {
        return;
      }

      const conversation = this.getConversation();
      if (!conversation || conversation.hasConfidentialMessageRead(this)) {
        return;
      }

      // delete message
      await window.Signal.Data.removeMessage(this.id, {
        Message: Whisper.Message,
      });

      await conversation.markReadConfidentialMessage(this);
    },

    correctExpireTimer() {
      // some non-normal message maybe has 0 expireTimer
      // should correct to 7days
      if (this.propsForMessage) {
        return false;
      }

      const expireTimer = this.get('expireTimer');
      if (!expireTimer) {
        // expireTimer default to 7days (seconds)
        this.attributes.expireTimer = 7 * 24 * 60 * 60;
      }

      this.attributes.expirationStartTimestamp =
        this.getExpirationStartTimestamp() ||
        this.get('received_at') ||
        this.get('sent_at') ||
        Date.now();

      this.setToExpireWithoutSaving(true);

      return true;
    },

    getUnreachableRecipients() {
      // users with invisible errors should be unreachable
      return (this.get('invisibleErrors') || []).map(error => error.number);
    },
  });

  // Receive will be enabled before we enable send
  Whisper.Message.LONG_MESSAGE_CONTENT_TYPE = 'text/x-signal-plain';

  Whisper.Message.getLongMessageAttachment = ({ body, attachments, now }) => {
    if (!body || body.length <= 4096) {
      return {
        body,
        attachments,
      };
    }

    const data = bytesFromString(body);
    const attachment = {
      contentType: Whisper.Message.LONG_MESSAGE_CONTENT_TYPE,
      fileName: `long-message-${now}.txt`,
      data,
      size: data.byteLength,
    };

    // body slice set to 2048, do not change this number too big
    // because APN has payload length limitation of 4K
    return {
      body: body.slice(0, 2048),
      attachments: [attachment, ...attachments],
    };
  };

  Whisper.Message.refreshExpirationTimer = () =>
    Whisper.ExpiringMessagesListener.update();

  Whisper.MessageCollection = Backbone.Collection.extend({
    model: Whisper.Message,
    comparator(left, right) {
      const left_server_timestamp = left.getServerTimestampForSort();
      const right_server_timestamp = right.getServerTimestampForSort();

      if (left_server_timestamp === right_server_timestamp) {
        return (
          (left.get('sent_at') || 0) - (right.get('sent_at') || 0) ||
          (left.get('received_at') || 0) - (right.get('received_at') || 0)
        );
      } else {
        return left_server_timestamp - right_server_timestamp;
      }
    },
    initialize(models, options) {
      if (options) {
        this.conversation = options.conversation;
      }

      this.bottomLoaded = false;
      this.threadBottomLoaded = [];

      this.on('reset', (_, options) => {
        const { setBottomLoaded } = options || {};

        if (setBottomLoaded) {
          this.bottomLoaded = true;
        } else {
          this.bottomLoaded = false;
        }

        this.threadBottomLoaded = [];
      });

      this.on('resort', message => {
        // resort may break collection message continuity,
        // to not break the continously fetch process,
        // we should remove the message from collection if it was out of range
        if (this.conversation && message instanceof Whisper.Message) {
          if (this.hasBottomLoaded(false) || !this.length) {
            // main list has bottomLoaded
            // keep unchanged
          } else {
            // main list NOT bottomLoaded
            const msgThreadId = message.get('threadId');
            const { threadOnly } = message;

            if (msgThreadId) {
              if (this.hasBottomLoaded(msgThreadId)) {
                // message thread has bottom loaded
                if (threadOnly) {
                  // keep unchanged
                } else {
                  // check main, change threadOnly if needed
                  if (this.isOutOfRange(message, true)) {
                    message.threadOnly = msgThreadId;
                    message.trigger('threadOnlyChanged');

                    log.info('threadOnlyChanged 1', message.idForLogging());
                  } else {
                    // keep unchanged
                  }
                }
              } else {
                // message thread NOT bottom loaded
                if (threadOnly) {
                  // check thread, unload if needed
                  if (this.isOutOfRange(message, true, msgThreadId)) {
                    this.remove(message);

                    log.info('unload message 1', message.idForLogging());
                  } else {
                    // keep unchanged
                  }
                } else {
                  // check main and thread, unload or change threadOnly if needed
                  const mainOut = this.isOutOfRange(message, true);
                  const threadOut = this.isOutOfRange(
                    message,
                    true,
                    msgThreadId
                  );
                  if (mainOut && threadOut) {
                    this.remove(message);

                    log.info('unload message 2', message.idForLogging());
                  } else if (mainOut) {
                    message.threadOnly = msgThreadId;
                    message.trigger('threadOnlyChanged');

                    log.info('threadOnlyChanged 2', message.idForLogging());
                  } else if (threadOut) {
                    // nerver come here
                    log.error('nerver come here', message.idForLogging());
                  }
                }
              }
            } else {
              // message is not in thread
              // check main, unload if needed
              if (this.isOutOfRange(message, true)) {
                this.remove(message);

                log.info('unload message 3', message.idForLogging());
              } else {
                // keep unchanged
              }
            }
          }
        }

        this.sort();
      });
    },
    isOutOfRange(message, comparePrevious, threadId) {
      const first = threadId
        ? this.find(m => threadId === m.get('threadId'))
        : this.find(m => !m.threadOnly);

      const last = threadId
        ? _lodash.findLast(this.models, m => threadId === m.get('threadId'))
        : _lodash.findLast(this.models, m => !m.threadOnly);

      if (first && last) {
        const serverTimestamp = message.get('serverTimestamp');

        // older than all
        if (first.getServerTimestamp() > serverTimestamp) {
          return -1;
        }

        // newer than all
        if (last.getServerTimestamp() < serverTimestamp) {
          return 1;
        }

        if (comparePrevious) {
          const prevTimestamp = message.previous('serverTimestamp');
          // changed serverTimestamp < prevTimestamp
          if (first === message && first.getServerTimestamp() < prevTimestamp) {
            return -1;
          }

          // changed serverTimestamp > prevTimestamp
          if (last === message && last.getServerTimestamp() > prevTimestamp) {
            return 1;
          }
        }
      } else {
        // empty list, treated as bigger than all
        return 1;
      }

      return 0;
    },
    async destroyAll() {
      await Promise.all(
        this.models.map(message =>
          window.Signal.Data.removeMessage(message.id, {
            Message: Whisper.Message,
          })
        )
      );
      this.reset([]);
    },

    logTag() {
      let tag = `total: ${this.length} `;

      if (this.threadId) {
        tag += `thread: ${this.threadId} `;
      }

      tag += `hasBottomLoaded: ${this.hasBottomLoaded()} `;

      if (this.conversation) {
        tag += this.conversation.idForLogging();
      }

      return tag;
    },

    getLoadedUnreadCount() {
      return this.reduce((total, model) => {
        const unread = model.get('unread') && model.isIncoming();
        return total + (unread ? 1 : 0);
      }, 0);
    },

    getServerTimestampForLoad(upward = false, enableThread = true) {
      // iteratee function for _.min or _.max
      // return the value for compare
      let iteratee;
      if (enableThread && this.threadId) {
        iteratee = (m, defaultServerTimestamp) => {
          let serverTimestamp;
          if (this.threadId === m.get('threadId')) {
            serverTimestamp = m.getServerTimestamp();
          }
          return serverTimestamp || defaultServerTimestamp;
        };
      } else {
        iteratee = (m, defaultServerTimestamp) => {
          let serverTimestamp;
          if (!m.threadOnly) {
            serverTimestamp = m.getServerTimestamp();
          }
          return serverTimestamp || defaultServerTimestamp;
        };
      }

      // if loading upward true, should get min value from collection
      // and then load messages older(smaller) than this value
      const getServerTimestamp = () => {
        const defaultValue = upward ? Number.MAX_VALUE : 0;
        const findExtremum = (upward ? this.min : this.max).bind(this);

        let serverTimestamp = defaultValue;
        if (this.length) {
          // find extremum element in this collection
          const extremum = findExtremum(m => iteratee(m, defaultValue));
          // get extremum value from the extremum element.
          serverTimestamp = iteratee(extremum, defaultValue);
        }

        return serverTimestamp;
      };

      const serverTimestamp = getServerTimestamp();

      log.info(
        `getServerTimestampForLoad: upward: ${upward}` +
          ` serverTimestamp: ${serverTimestamp}` +
          ` ${this.logTag()}`
      );

      return serverTimestamp;
    },
    async fetchContinuousMessages(
      conversationId,
      limit = 50,
      unreadCount = 0,
      upward = true
    ) {
      const serverTimestampForLoad = this.getServerTimestampForLoad(upward);

      // 获取最新已读位置，以这个位置为条件，加载新消息
      const lastReadPosition = await this.conversation?.getLastReadPosition();

      let loadOptions = {};
      const hasLoaded = this.find(model => !model.threadOnly);
      if (hasLoaded) {
        // 1 已有消息加载, 每次30条
        loadOptions = {
          limit: 30,
          serverTimestamp: serverTimestampForLoad,
          upward,
        };
      } else {
        if (unreadCount <= limit) {
          // 2 还未加载消息，但是 (unreadCount <= limit)
          loadOptions = {
            limit,
            serverTimestamp: serverTimestampForLoad,
            upward,
          };
        } else {
          // 未加载消息，并且 (unreadCount > limit)
          // 从最老的未读加载50条
          loadOptions = {
            limit,
            upward: false,
            serverTimestamp: lastReadPosition?.maxServerTimestamp || 0,
          };
        }
      }

      return this.loadMessageFromDatabase(conversationId, loadOptions, false);
    },
    async fetchAndResetMessages(
      conversationId,
      serverTimestamp = Number.MAX_VALUE,
      limit = 50
    ) {
      // if serverTimestamp === Number.MAX_VALUE, load newest messages with limit
      // else load newer message include and begin with serverTimestamp
      const loadOptions = {
        limit,
        serverTimestamp,
        upward: serverTimestamp === Number.MAX_VALUE ? true : false,
        equal: true,
      };

      return this.loadMessageFromDatabase(conversationId, loadOptions, true);
    },
    async loadMessageFromDatabase(
      conversationId,
      options,
      shouldReset = false
    ) {
      let messages;

      // try to load last read position before load from db
      // should not await after getMessagesByConversation for sync issues
      await this.conversation.getLastReadPosition();

      try {
        messages = await window.Signal.Data.getMessagesByConversation(
          conversationId,
          {
            ...options,
            threadId: this.threadId,
            MessageCollection: Whisper.MessageCollection,
          }
        );
      } catch (error) {
        window.log.error(
          `loadMessageFromDatabase db read failed with options:`,
          options,
          this.logTag(),
          Errors.toLogFormat(error)
        );

        // maybe we should throw an error ?
        return { count: 0, renderPromise: Promise.resolve() };
      }

      const models = [];
      const unsupportedReactions = [];

      messages.forEach(message => {
        if (!message.id) {
          log.error(
            'loaded message has no id:',
            message.idForLogging(),
            this.logTag()
          );
          return;
        }

        const model = MessageController.register(message.id, message);
        if (model.isReactionUnsupportedMessage()) {
          model.trigger('destroy');
          model.unset('unread');
          model.set({
            hasBeenRecalled: true,
            recalledReason: 'unsupported-reaction',
          });

          unsupportedReactions.push(model);
        } else {
          models.push(model);

          // try to load from quoted if reference not found
          try {
            model.handleIfQuotedReferenceNotFound(true);
          } catch (error) {
            log.error(
              'handleIfQuotedReferenceNotFound error when loading',
              this.logTag(),
              Errors.toLogFormat(error)
            );
          }
        }
      });

      const eliminated = messages.length - models.length;
      if (eliminated > 0) {
        window.log.warn(
          `loadMessageFromDatabase: Eliminated ${eliminated} messages without an id`,
          this.logTag()
        );
      }

      window.log.info(
        `loaded message total(${models.length}) from database with options:`,
        options,
        this.logTag()
      );

      if (unsupportedReactions.length) {
        window.log.info(
          'mark reaction unsupported messages:',
          unsupportedReactions.length
        );
        window.Signal.Data.saveMessagesWithBatcher(
          unsupportedReactions.map(m => m.attributes)
        );
      }

      // async load should before set bottom loaded
      if (this.conversation && models.length) {
        // load read positions
        const beginTimestamp = models[0].getServerTimestamp();
        const endTimestamp = models[models.length - 1].getServerTimestamp();

        try {
          await this.conversation.loadReadPositions(
            beginTimestamp,
            endTimestamp
          );
        } catch (error) {
          window.log.error(
            'load read positions failed',
            beginTimestamp,
            endTimestamp,
            this.logTag(),
            Errors.toLogFormat(error)
          );
        }
      }

      // update bottom loaded flags
      // when loading newer messages
      // or loading limit newest messages
      const usedLimit = options.limit || 50;
      const usedServerTimestamp = options.serverTimestamp || Number.MAX_VALUE;

      let setBottomLoaded = false;
      if (
        (options.upward && usedServerTimestamp === Number.MAX_VALUE) ||
        (!options.upward && messages.length < usedLimit)
      ) {
        if (!this.conversation.hasNewerUnloadedRemoteMessages()) {
          if (this.threadId) {
            this.threadBottomLoaded[this.threadId] = true;
          } else {
            this.bottomLoaded = true;
            this.threadBottomLoaded = [];
            setBottomLoaded = true;
          }

          window.log.info('mark as bottom loaded true', this.logTag());
        }
      }

      if (this.bottomLoaded) {
        // all message has bottomLoaded, so thread also bottomLoaded
        if (this.threadId && !this.threadBottomLoaded[this.threadId]) {
          this.threadBottomLoaded[this.threadId] = true;

          window.log.info(
            'thread auto mark as bottom loaded true: ',
            this.logTag()
          );
        }
      } else {
        // do nothing
      }

      if (models.length === 0) {
        return { count: 0, renderPromise: Promise.resolve() };
      }

      // retry download pending task
      models.forEach(m => {
        const forwardContext = m.get('forwardContext') || {};
        const singleForward = m.getIfSingleForward(forwardContext.forwards);

        const attachments = singleForward
          ? singleForward.attachments
          : m.get('attachments');

        let updated = false;
        let longMessage = false;

        if (
          attachments instanceof Array &&
          attachments.filter(a => a.pending || a.error).length > 0
        ) {
          attachments.forEach(a => {
            // if attachment already downloaded, remove error flags, just show it.
            if (a.path) {
              updated = true;

              delete a.error;
              delete a.pending;
              delete a.fetchError;
            } else if (a.pending) {
              delete a.error;
              delete a.pending;

              a.fetchError = true;
              updated = true;

              if (a.contentType === Whisper.Message.LONG_MESSAGE_CONTENT_TYPE) {
                longMessage = true;
              }
            }
          });
        }

        if (longMessage) {
          m.queueAttachmentDownloads();
        }

        if (updated) {
          m.trigger('change');
        }
      });

      if (this.threadId) {
        const threadOnlyMessages = _.difference(models, this.models);
        threadOnlyMessages.forEach(m => (m.threadOnly = this.threadId));
      } else {
        models
          .filter(m => m.threadOnly)
          .forEach(m => {
            delete m.threadOnly;
            m.trigger('change');
          });
      }

      if (this.conversation) {
        // do not wait here
        this.conversation.onThreadChange(models);
      }

      const renderPromises = [];
      const collectionOptions = {
        reverse: options.upward,
        onCollectionChanged: promise => renderPromises.push(promise),
      };

      // find last unread message, need to scroll to
      let oldestUnread = null;
      let incomingUnread = null;

      // use sync get instead
      const lastReadPosition = this.conversation.get('lastReadPosition');
      const maxTimestamp = lastReadPosition?.maxServerTimestamp || 0;

      const updateAttrs = [];

      // We need to iterate here because unseen non-messages do not contribute to
      //   the badge number, but should be reflected in the indicator's count.
      models.forEach(model => {
        if (model.correctExpireTimer()) {
          updateAttrs.push(model.attributes);
        }

        if (maxTimestamp) {
          if (model.getServerTimestamp() <= maxTimestamp) {
            oldestUnread = null;
            return;
          }
        } else {
          if (!model.get('unread')) {
            return;
          }
        }

        if (!oldestUnread && !model.isOutgoing() && !model.isRecallMessage()) {
          oldestUnread = model;
        }

        if (!incomingUnread && model.isIncoming() && !model.isRecallMessage()) {
          incomingUnread = model;
        }
      });

      if (updateAttrs.length) {
        window.log.info('correct expireTimer messages:', updateAttrs.length);
        window.Signal.Data.saveMessagesWithBatcher(updateAttrs);

        Whisper.Message?.refreshExpirationTimer();
      }

      if (incomingUnread && oldestUnread) {
        Object.assign(collectionOptions, { oldestUnread });

        if (shouldReset || !this.length) {
          Object.assign(collectionOptions, { messageScrollTo: oldestUnread });
        }
      }

      if (this.trimPromise) {
        try {
          await this.trimPromise;
        } catch (error) {
          log.error('await trim promise failed.');
        }
      }

      if (shouldReset) {
        Object.assign(collectionOptions, { setBottomLoaded });

        if (this.threadId) {
          this.trigger('reset-thread', models, collectionOptions);
        } else {
          this.reset(models, collectionOptions);
        }
      } else {
        this.add(models, collectionOptions);
      }

      return {
        count: models.length,
        renderPromise: Promise.all(renderPromises),
      };
    },
    hasBottomLoaded(testThread = true) {
      if (this.conversation.hasNewerUnloadedRemoteMessages()) {
        return false;
      }

      if (typeof testThread === 'string') {
        return !!this.threadBottomLoaded[testThread];
      } else if (testThread === true && this.threadId) {
        return !!this.threadBottomLoaded[this.threadId];
      } else {
        return this.bottomLoaded;
      }
    },
    resetBottomLoaded(testThread) {
      // always reset bottomLoaded flag
      this.bottomLoaded = false;

      if (typeof testThread === 'string') {
        delete this.threadBottomLoaded[testThread];
      } else if (testThread === true && this.threadId) {
        delete this.threadBottomLoaded[this.threadId];
      } else {
        // not specific thread, do nothing
      }
    },
    setThread(threadId) {
      this.threadId = threadId;
    },
    clearThread() {
      delete this.threadId;
    },
    trim(trimBegin = true) {
      if (this.threadId) {
        return;
      }

      const MAX = 100;
      if (this.length < MAX) {
        return;
      }

      const firstNonThread = this.findIndex(m => !m.threadOnly);
      const lastNonThread = this.findLastIndex(m => !m.threadOnly);

      const models = [];
      if (firstNonThread === -1 || lastNonThread === -1) {
        // there are no nonThread messages, all cleared
        models.push(...this.models);
      } else if (lastNonThread - firstNonThread < MAX) {
        // count of non thread messages less then MAX, just kept.
        models.push(...this.slice(0, firstNonThread));
        models.push(...this.slice(lastNonThread + 1, this.length));
      } else {
        // count of non thread messages equal or more than MAX, should slice
        if (trimBegin) {
          models.push(...this.slice(0, lastNonThread - MAX + 1));
          models.push(...this.slice(lastNonThread + 1, this.length));
        } else {
          models.push(...this.slice(0, firstNonThread));
          models.push(...this.slice(firstNonThread + MAX, this.length));
        }
      }

      if (!models.length) {
        return;
      }

      window.log.info(
        `trimming ${top ? 'top' : 'end'} conversation`,
        this.logTag(),
        'of',
        models.length,
        'old messages'
      );

      this.remove(models);

      this.trimPromise = Promise.all(
        models.map(
          model =>
            new Promise(resove => {
              setTimeout(() => {
                // trim only happens on main list view
                model.trigger('unload', { listMode: 'main' });
                resove();
              }, 0);
            })
        )
      );
    },
    shouldLazyLoad(model, loadOptions) {
      const { atViewBottom } = loadOptions || {};

      let lazyLoad = false;
      const mainOut = this.isOutOfRange(model);

      const modelThreadId = model.get('threadId');
      if (modelThreadId) {
        const threadOut = this.isOutOfRange(model, false, modelThreadId);
        if (mainOut === 0) {
          // add to both main and thread view
          // no need to reset bottom flag
          log.info('add to both view 1', model.idForLogging(), this.logTag());
        } else if (threadOut === 0) {
          // add to only thread view
          model.threadOnly = modelThreadId;
          log.info('add to thread view 1', model.idForLogging(), this.logTag());
        } else if (mainOut < 0 || threadOut < 0) {
          // older messages, no need to reset bottom flag
          log.info('lazy load 1', model.idForLogging(), this.logTag());
          lazyLoad = true;
        } else {
          if (this.hasBottomLoaded(false)) {
            // main has bottom loaded, thread must have bottom loaded
            if (atViewBottom) {
              // add to both main and thread view
              log.info(
                'add to both view 2',
                model.idForLogging(),
                this.logTag()
              );
            } else {
              // not at view bottom, could lazy load
              log.info('lazy load 2', model.idForLogging(), this.logTag());
              lazyLoad = true;
              this.resetBottomLoaded(modelThreadId);
            }
          } else if (this.hasBottomLoaded(modelThreadId)) {
            // thread bottom loaded
            if (atViewBottom) {
              // add to only thread view
              model.threadOnly = modelThreadId;
              this.resetBottomLoaded();
              log.info(
                'add to thread view 2',
                model.idForLogging(),
                this.logTag()
              );
            } else {
              log.info('lazy load 3', model.idForLogging(), this.logTag());
              lazyLoad = true;
              this.resetBottomLoaded(modelThreadId);
            }
          } else {
            log.info('lazy load 4', model.idForLogging(), this.logTag());
            lazyLoad = true;
          }
        }
      } else {
        if (mainOut === 0) {
          // add to collection
          log.info('add to main view 1', model.idForLogging(), this.logTag());
        } else if (mainOut < 0) {
          // older than all in collection, lazy load
          log.info('lazy load 5', model.idForLogging(), this.logTag());
          lazyLoad = true;
        } else {
          // newer than all in collection
          if (this.hasBottomLoaded(false)) {
            if (atViewBottom) {
              // add to collection
              log.info(
                'add to main view 2',
                model.idForLogging(),
                this.logTag()
              );
            } else {
              log.info('lazy load 6', model.idForLogging(), this.logTag());
              lazyLoad = true;
              this.resetBottomLoaded();
            }
          } else {
            log.info('lazy load 7', model.idForLogging(), this.logTag());
            lazyLoad = true;
          }
        }
      }

      return lazyLoad;
    },
    // used for add new messages into collection.
    // called by Conversation.addSingleMessage
    addNewMessage(model, loadOptions) {
      // message is sending will change serverTimestamp when it is finished.
      // we handle this on change:serverTimestamp
      log.info('addNewMessage', model.idForLogging(), loadOptions);

      if (this.shouldLazyLoad(model, loadOptions)) {
        log.info('do lazy load', model.idForLogging());
        return { model, renderPromise: Promise.resolve(), lazyLoaded: true };
      }

      if (this.conversation) {
        this.conversation.onThreadChange(model);
      }

      let renderPromise;
      const options = {
        onCollectionChanged: promise => {
          if (this.trimPromise) {
            renderPromise = this.trimPromise.then(promise);
          } else {
            renderPromise = promise;
          }
        },
        newMessage: true,
      };

      log.info(
        'collection addNewMessage:',
        model.idForLogging(),
        `threadOnly(${model.threadOnly})`,
        this.logTag()
      );

      this.add(model, options);

      return { model, renderPromise, lazyLoaded: false };
    },
    findLastMessageForMarkRead() {
      let lastNonOutgoing;
      let lastIncoming;

      _lodash.forEachRight(this.models, model => {
        if (!lastNonOutgoing && !model.isOutgoing()) {
          lastNonOutgoing = model;
          if (model.isIncoming() && !model.isRecallMessage()) {
            lastIncoming = model;
            return false;
          }
        }

        if (lastNonOutgoing && model.isIncoming() && !model.isRecallMessage()) {
          lastIncoming = model;
          return false;
        }
      });

      return { lastIncoming, lastNonOutgoing };
    },
  });
})();
