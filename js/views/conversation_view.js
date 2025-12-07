/* global
  $,
  _,
  ConversationController
  emojiData,
  EmojiPanel,
  extension,
  i18n,
  Signal,
  storage,
  Whisper,
*/

// eslint-disable-next-line func-names
(function () {
  'use strict';

  const MENTIONS_ALL_ID = 'MENTIONS_ALL';
  const CMD_TOPIC_HEADR = '/TOPIC';

  window.Whisper = window.Whisper || {};
  const { Message, Errors } = window.Signal.Types;
  const {
    loadAttachmentData,
    upgradeMessageSchema,
    getAbsoluteAttachmentPath,
  } = window.Signal.Migrations;

  Whisper.ExpiredToast = Whisper.ToastView.extend({
    render_attributes() {
      return { toastMessage: i18n('expiredWarning') };
    },
  });
  Whisper.unSpeak = Whisper.CenterToastView.extend({
    render_attributes() {
      return { toastMessage: i18n('unSpeak') };
    },
  });
  Whisper.noChatHistory = Whisper.CenterToastView.extend({
    render_attributes() {
      return { toastMessage: i18n('noChatHistory') };
    },
  });

  Whisper.Blocked = Whisper.CenterToastView.extend({
    render_attributes() {
      return { toastMessage: i18n('blocked') };
    },
  });
  Whisper.UnBlocked = Whisper.CenterToastView.extend({
    render_attributes() {
      return { toastMessage: i18n('unblocked') };
    },
  });
  Whisper.LeftGroupToast = Whisper.ToastView.extend({
    render_attributes() {
      return { toastMessage: i18n('youLeftTheGroup') };
    },
  });
  Whisper.OriginalNotFoundToast = Whisper.ToastView.extend({
    render_attributes() {
      return { toastMessage: i18n('originalMessageNotFound') };
    },
  });
  Whisper.OriginalNoLongerAvailableToast = Whisper.ToastView.extend({
    render_attributes() {
      return { toastMessage: i18n('originalMessageNotAvailable') };
    },
  });
  Whisper.FoundButNotLoadedToast = Whisper.ToastView.extend({
    render_attributes() {
      return { toastMessage: i18n('messageFoundButNotLoaded') };
    },
  });
  Whisper.VoiceNoteMustBeOnlyAttachmentToast = Whisper.ToastView.extend({
    render_attributes() {
      return { toastMessage: i18n('voiceNoteMustBeOnlyAttachment') };
    },
  });

  const MAX_MESSAGE_BODY_SIZE = 4 * 1024; // 4k
  Whisper.MessageBodyTooLongToast = Whisper.ToastView.extend({
    render_attributes() {
      return { toastMessage: i18n('messageBodyTooLong') };
    },
  });

  const MAX_SELECTION_COUNT = 50;
  Whisper.ExceedingMaxNumberOfSelectionToast = Whisper.ToastView.extend({
    render_attributes() {
      return {
        toastMessage: i18n(
          'exceedingMaxNumberOfSelection',
          MAX_SELECTION_COUNT
        ),
      };
    },
  });

  Whisper.MessageCannotBeEmptyWhenQuote = Whisper.ToastView.extend({
    render_attributes() {
      return {
        toastMessage: i18n('messageCannotBeEmptyWhenQuote'),
      };
    },
  });

  Whisper.PullingAttachmentErrorToast = Whisper.ToastView.extend({
    render_attributes() {
      return {
        toastMessage: i18n('pullingAttachmentError'),
      };
    },
  });

  Whisper.ConversationView = Whisper.View.extend({
    className() {
      return ['conversation', this.model.get('type')].join(' ');
    },
    id() {
      return `conversation-${this.model.cid}`;
    },
    template: $('#conversation').html(),
    render_attributes() {
      return {
        'send-message': i18n('sendMessage', [
          this.getPlaceholderForMessageField(),
        ]),
      };
    },
    initialize(options) {
      this.selectedMessages = new Whisper.MessageCollection();

      this.listenTo(this.model, 'destroy', this.stopListening);
      this.listenTo(this.model, 'newmessage', this.addMessage);

      this.listenTo(
        this.model,
        'change:blockStatus change:directoryUser change:friendRequesting',
        () => {
          this.updateMessageToolBar();
          this.updateHeader();
        }
      );

      this.listenTo(this.model, 'blockedToSend', this.showUnblockedToast);
      this.listenTo(this.model, 'sendHistory', this.quickSendHistory);
      this.listenTo(this.model, 'showCommonGroups', this.onOpenSetting);

      this.listenTo(
        this.model,
        'sendPublishRuleMessage',
        this.sendPublishRuleMessage
      );

      this.listenTo(this.model, 'opened', this.onOpened);
      this.listenTo(this.model, 'prune', this.onPrune);
      this.listenTo(this.model, 'unload', reason =>
        this.unload('model trigger ' + reason || '')
      );

      this.throttledUpdateUnreadMentions = _lodash.throttle(
        this.updateUnreadMentions.bind(this),
        2000
      );

      this.listenTo(
        this.model,
        'new-read-position',
        this.throttledUpdateUnreadMentions
      );

      // this.listenTo(this.model, 'change:messageExpiry', () => {
      //   if (this.view) {
      //     const messageExpiry = this.model.getConversationMessageExpiry();
      //     this.view.updateArchiveIndicator(messageExpiry);
      //   }
      // });

      this.listenTo(this.model, 'change:unreadCount', () => {
        const unreadCount = this.model.get('unreadCount');
        if (!unreadCount) {
          if (this.scrollDownButton) {
            this.scrollDownButton.count = 0;
            this.scrollDownButton.update(this.getScrollDownButtonProps());
          }
        }
      });

      this.listenTo(
        this.model,
        'change:name change:remarkName update_view threadModeChange',
        () => {
          this.$messageField.prop(
            'placeholder',
            i18n('sendMessage', [this.getPlaceholderForMessageField()])
          );

          window.autosize.update(this.$messageField);
          this.updateMessageFieldSize({});
        }
      );

      this.listenTo(this.model.messageCollection, 'force-send', this.forceSend);
      this.listenTo(this.model.messageCollection, 'delete', this.deleteMessage);
      this.listenTo(
        this.model.messageCollection,
        'show-message-in-separate-view',
        this.showMessageInSeparateView
      );

      this.listenTo(
        this.model.messageCollection,
        'scroll-to-message',
        this.scrollToMessage
      );

      this.listenTo(
        this.model.messageCollection,
        'scroll-to-bottom',
        this.scrollToBottom
      );

      this.listenTo(
        this.model.messageCollection,
        'reply',
        this.setQuoteMessage
      );
      this.listenTo(
        this.model.messageCollection,
        'replyOldMessageWithoutTopic',
        this.setReplyMessage
      );
      this.listenTo(
        this.model.messageCollection,
        'show-contact-detail',
        this.showContactDetail
      );
      this.listenTo(
        this.model.messageCollection,
        'show-lightbox',
        this.showLightbox
      );
      this.listenTo(
        this.model.messageCollection,
        'download',
        this.downloadAttachment
      );
      this.listenTo(
        this.model.messageCollection,
        'open-conversation',
        this.openConversation
      );
      this.listenTo(
        this.model.messageCollection,
        'show-message-detail',
        this.showMessageDetail
      );
      this.listenTo(
        this.model.messageCollection,
        'add-at-person',
        this.addAtPersonMessage
      );
      this.listenTo(this.model.messageCollection, 'forward-to', this.forwardTo);
      this.listenTo(
        this.model.messageCollection,
        'multi-seleting-mode-change',
        this.multiSelectingModeChange
      );
      this.listenTo(
        this.model.messageCollection,
        'message-selection-change',
        this.messageSelectionChanged
      );

      this.listenTo(
        this.model.messageCollection,
        'show-forwarded-message-list',
        this.showForwardedMessageList
      );

      this.listenTo(
        this.model.messageCollection,
        'recall-message',
        this.onRecallMessage
      );

      this.listenTo(
        this.model.messageCollection,
        'edit-recalled-message',
        this.onEditRecalledMessage
      );

      this.listenTo(
        this.model.messageCollection,
        'translate-message',
        () => {}
        // this.view?.scrollToBottomIfNeeded()
      );

      this.listenTo(
        this.model.messageCollection,
        'update-translate-cache',
        async message => {
          // const doTranslate = message.updateTranslateCache();
          // if (doTranslate) {
          //   if (!this.translateTaskJobs) {
          //     this.translateTaskJobs = [];
          //
          //     // max parallel count 3
          //     for (let i = 0; i < 3; i++) {
          //       this.translateTaskJobs.push(Promise.resolve(i));
          //     }
          //   }
          //
          //   const p = Promise.race(this.translateTaskJobs);
          //
          //   const createTask = index => {
          //     log.info(
          //       `Translating using index: ${index}` +
          //         ` for message ${message.idForLogging()}`
          //     );
          //
          //     const taskJob = async () => {
          //       try {
          //         const taskWithTimeout = textsecure.createTaskWithTimeout(
          //           async () => {
          //             await doTranslate();
          //             log.info(
          //               `Translating done index: ${index}` +
          //                 ` for message ${message.idForLogging()}`
          //             );
          //             await new Promise(r => setTimeout(r, 50));
          //             return index;
          //           },
          //           `translation ${message.idForLogging()}`
          //         );
          //
          //         return taskWithTimeout();
          //       } catch (error) {
          //         log.info(
          //           `Translating error index: ${index}` +
          //             `for message ${message.idForLogging()} ${error}`
          //         );
          //       }
          //
          //       return index;
          //     };
          //
          //     this.translateTaskJobs[index] = taskJob();
          //   };
          //
          //   p.then(createTask, createTask);
          // }
        }
      );

      this.listenTo(
        this.model.messageCollection,
        'copy-image',
        this.onCopyImage
      );

      this.listenTo(
        this.model.messageCollection,
        'show-thread',
        this.onShowThread
      );

      this.listenTo(
        this.model.messageCollection,
        'thread-reply',
        this.onThreadReply
      );

      this.tagVirtualIndex = models => {
        let prevModel = null;
        let prevDateTime = null;

        for (const model of models) {
          if (
            model.isRecallMessage() ||
            model.isRecalledMessage() ||
            model.isExpired()
          ) {
            continue;
          }

          const timestamp = model.getServerTimestamp();
          const dateTime = moment(timestamp).format('YYYYMMDD');

          if (!prevDateTime) {
            // 第一个 message dateSeparator 的空间留给 stickyDateView
            model.dateSeparator = false;
            prevDateTime = dateTime;
            model.trigger('change');
          } else {
            if (model.dateSeparator) {
              if (dateTime === prevDateTime) {
                model.dateSeparator = false;
                model.trigger('change');
              } else {
                prevDateTime = dateTime;
              }
            } else {
              if (dateTime !== prevDateTime) {
                model.dateSeparator = true;
                prevDateTime = dateTime;
                model.trigger('change');
              }
            }
          }

          if (model.isSystemNotification()) {
            prevModel = null;
            continue;
          }

          let virtualIndex;
          if (
            model.getSource() === prevModel?.getSource() &&
            !model.oldestUnread &&
            !model.dateSeparator
          ) {
            virtualIndex = prevModel.virtualIndex + 1;
          } else {
            virtualIndex = 0;
          }

          const oldVirtualIndex = model.virtualIndex;
          model.virtualIndex = virtualIndex;
          if (
            (oldVirtualIndex === 0 || virtualIndex === 0) &&
            oldVirtualIndex !== virtualIndex
          ) {
            model.trigger('change');
          }
          prevModel = model;
        }
      };

      this.debounceTagVirtualIndex = _.debounce(() => {
        const models = this.model.messageCollection.models;
        this.tagVirtualIndex(models);
      }, 100);

      this.listenTo(
        this.model.messageCollection,
        'add remove reset resort',
        this.debounceTagVirtualIndex
      );

      this.throttledGetProfiles = _.throttle(
        this.model.getProfiles.bind(this.model),
        1000 * 60 * 5 // five minutes
      );

      this.throttleForceSyncLastReadPosition = _.throttle(
        this.model.forceSyncLastReadPosition.bind(this.model),
        1000 * 10 // 10 seconds
      );

      this.throttleMarkRead = _lodash.throttle(
        () => this.markRead(),
        1000 * 5 // 5 seconds
      );

      this.listenTo(this.model, 'will-be-switched', () => {
        this.throttleMarkRead.flush();
        if (this.settingsDialog) {
          this.settingsDialog.remove();
          this.settingsDialog = null;
        }
      });

      // saved at first call immdiately and 500ms after last call
      // and if having multiple calls whoes interval less than 500s
      // save draft every 1 second
      this.debouncedSaveDraft = _lodash.debounce(
        this.saveDraft.bind(this),
        500,
        {
          leading: true,
          maxWait: 1000,
          trailing: true,
        }
      );

      this.render();
      this.showLoadingScreen();

      this.window = options.window;
      this.fileInput = new Whisper.FileInputView({
        el: this.$('.attachment-list'),
      });
      this.listenTo(
        this.fileInput,
        'choose-attachment',
        this.onChooseAttachment
      );
      this.listenTo(this.fileInput, 'staged-attachments-changed', () => {
        this.view.resetScrollPosition();
        this.toggleMicrophone();
      });

      this.defaultOnGoBack = () => {
        this.resetPanel();
        this.updateHeader();
        this.model.messageCollection.clearThread();
      };
      this.defaultOnGoBackFromTopicList = () => {
        this.resetPanel();
        this.threadCollection = null;
        this.setQuoteMessage(null);
        this.headerTitle = '';
        if (this.threadView) {
          this.threadView.remove();
          this.threadView = null;
        }
        if (this.topicListDialog) {
          this.topicListDialog.remove();
          this.topicListDialog = null;
        }
        this.updateHeader();
        this.model.messageCollection.clearThread();
      };

      this.resetLastPanel = () => {
        this.resetPanel();
        this.updateHeader({
          showGroupEditButton: this.lastShowGroupEditButton,
          showGroupSaveButton: this.lastShowGroupSaveButton,
          onGoBack: this.lastOnGoBack,
        });
      };

      this.onGoBack = this.defaultOnGoBack;
      this.showGroupEditButton = false;
      this.showGroupSaveButton = false;

      this.lastOnGoBack = this.defaultOnGoBack;
      this.lastShowGroupEditButton = false;
      this.lastShowGroupSaveButton = false;

      this.unsavedGroupChanges = false;

      this.headerTitle = '';
      this.headerTitleStack = [];
      this.onGoBackStack = [];

      const getHeaderProps = extProps => {
        const {
          onGoBack = this.onGoBack,
          showGroupEditButton,
          showGroupSaveButton,
          headerTitle = this.headerTitle,
        } = extProps || {};

        if (onGoBack) {
          this.lastOnGoBack = this.onGoBack;
          this.onGoBack = onGoBack;
        }

        if (typeof showGroupEditButton === 'boolean') {
          this.lastShowGroupEditButton = this.showGroupEditButton;
          this.showGroupEditButton = showGroupEditButton;
        }

        if (typeof showGroupSaveButton === 'boolean') {
          this.lastShowGroupSaveButton = this.showGroupSaveButton;
          this.showGroupSaveButton = showGroupSaveButton;
        }

        let showPanels =
          Boolean(this.panels && this.panels.length) || this.threadCollection;
        let selfLeft = this.model.isMeLeftGroup();

        // already left group does not show members count
        let groupMembersCount;
        if (!this.model.isPrivate() && !selfLeft) {
          groupMembersCount = this.model.contactCollection.length;
        }

        return {
          id: this.model.id,
          name: this.model.getName(),
          phoneNumber: this.model.getNumber(),
          profileName: this.model.getProfileName(),
          color: this.model.getColor(),
          avatarPath: this.model.getAvatarPath(),
          email: this.model.get('email'),
          signature: this.model.get('signature'),
          isStick: this.model.get('isStick'),
          isDirectoryUser: this.model.isDirectoryUser(),

          isVerified: false,
          isMe: this.model.isMe(),
          isMeLeftGroup: this.model.isMeLeftGroup(),
          isGroup: !this.model.isPrivate(),
          isGroupV2: this.model.isGroupV2(),
          isGroupV2Owner: this.model.isMeGroupV2Owner(),
          isGroupV2Admin: this.model.isMeGroupV2Admin(),
          isArchived: this.model.get('isArchived'),
          groupMembersCount,

          expireTimer: this.model.getConversationMessageExpiry(),
          showBackButton: showPanels,

          showGroupSaveButton: Boolean(
            showPanels && this.showGroupSaveButton && !selfLeft
          ),

          showGroupEditButton: Boolean(
            showPanels && this.showGroupEditButton && !selfLeft
          ),

          onDeleteMessages: () => this.destroyMessages(),
          onStick: stick => this.onStick(stick),

          onLeaveGroup: () => this.leaveGroup(),
          onDisbandGroup: () => this.disbandGroup(),

          onShowAllMedia: async () => {
            await this.showAllMedia();
            this.updateHeader({
              showGroupEditButton: false,
              showGroupSaveButton: false,
              onGoBack: this.defaultOnGoBack,
            });
          },
          onGroupSave: async () => {
            if (this.unsavedGroupChanges === false) {
              console.log(
                'should never be there. Noooo unsaved group changes.'
              );
              return;
            }

            let newContacts = this.tempContactsCollection.difference(
              this.model.contactCollection.models
            );
            let newNumbers = newContacts.map(c => c.id);
            let allNumbers = this.tempContactsCollection.map(c => c.id);

            if (newNumbers && newNumbers.length > 0) {
              const groupUpdate = {
                joined: newNumbers,
              };

              this.model.contactCollection.add(newContacts);
              this.model.attributes.members = allNumbers;

              await this.model.updateGroup(groupUpdate);
            }

            this.unsavedGroupChanges = false;

            // back to conversation view.
            this.defaultOnGoBack();
          },
          onGoBack: this.onGoBack,
          onArchive: () => {
            this.unload('archive');
            this.model.setArchived(true);
          },
          onMoveToInbox: () => {
            this.model.setArchived(false);
          },
          onGroupV2AddMembers: () => {
            window.showAddGroupMembersWindow(this.model.get('id'));
          },
          onGroupV2RemoveMembers: () => {
            window.showRemoveGroupMembersWindow(this.model.get('id'));
          },
          headerTitle,
          onOpenSetting: () => this.onOpenSetting(),
          invitationRule: this.model.get('invitationRule'),
          onRequestFriend: () => this.onRequestFriend(),
        };
      };

      this.titleView = new Whisper.ReactWrapperView({
        className: 'title-wrapper',
        Component: window.Signal.Components.ConversationHeader,
        props: getHeaderProps(),
      });

      this.updateHeader = extProps =>
        this.titleView?.update(getHeaderProps(extProps));

      this.debouncedUpdateHeader = _lodash.debounce(
        () => {
          this.updateHeader({
            headerTitle: this.headerTitle,
            onGoBack: this.onGoBack,
          });
        },
        500,
        { leading: true, trailing: true }
      );

      this.listenTo(this.model, 'change', this.debouncedUpdateHeader);

      this.debouncedTriggerChange = _lodash.debounce(
        () => setTimeout(() => this.model?.trigger('change'), 0),
        1000,
        { leading: true, trailing: true }
      );
      // update loaded view for conversation
      this.listenTo(this.model, 'update_view', this.debouncedTriggerChange);

      this.listenTo(
        this.model.contactCollection,
        'add remove reset',
        this.debouncedUpdateHeader
      );

      this.$('.conversation-header').append(this.titleView.el);

      this.initMainView();

      this.$messageField = this.$('.send-message');
      this.$messageField.prop('spellcheck', !!window.Events.getSpellCheck());

      this.onResize = this.forceUpdateMessageFieldSize.bind(this);
      this.window.addEventListener('resize', this.onResize);

      this.onFocus = () => {
        if (this.$el.css('display') !== 'none') {
          this.throttleMarkRead();
          this.throttleMarkRead.flush();
        }
      };
      this.window.addEventListener('focus', this.onFocus);

      this.removeOnClosed = extension.windows.onClosed(() => {
        this.unload('windows closed');
      });

      // setup load message progress
      this.loadMoreMessages();

      this.composeToolbarProps = this.initComposeToolbarProps();
      setTimeout(() => {
        this.initComposeToolbar();
        this.updateMessageToolBar();
      }, 0);

      this.atPersons = '';
      this.atMentions = [];

      this.updateSettingDialog = () =>
        this.settingsDialog?.update(this.getSettingProps());

      // this.updateAtViewProps = () =>
      //   this.atView?.update(this.getNewAtPersonProps());
      this.listenTo(this.model, 'change change:external', () => {
        this.updateSettingDialog();
        // this.updateAtViewProps();
        this.updateHeader();
      });
    },
    getMessageMode() {
      return this.model.get('confidentialMode') ? 'confidential' : 'normal';
    },
    initComposeToolbarProps() {
      const toolbarProps = {
        i18n,
        toolbar: {
          active: false,
          visible: true,
        },
        messageMode: {
          visible: undefined,
          mode: this.getMessageMode(),
          onChangeMessageMode: mode => {
            this.model.setConfidentialMode(mode === 'confidential' ? 1 : 0);
          },
        },
        emojiPanel: {
          onClick: () => {
            this.newEmojiChoose();
          },
        },
        attachmentSelector: {
          visible: true,
          onClick: e => this.onChooseAttachment(e),
        },
        atPerson: {
          visible: true,
          onClick: e => this.onChooseAtPersons(e),
        },
        shareContact: {
          visible: true,
          onClick: () => this.onShareContact(),
        },
        localSearch: {
          visible: true,
          onClick: () => this.onSearchMessage(),
        },
        call: {
          visible: !this.model.isMe(),
          onClick: () => this.startCall(),
        },
        captureAudio: {
          visible: true,
          resetKey: 0,
          onRecordStart: e => this.startCaptureAudio(e),
          onRecordComplete: blob => {
            this.handleAudioCapture(blob);
          },
          onClose: () => {
            this.endCaptureAudio();
          },
        },
      };
      return toolbarProps;
    },
    initComposeToolbar() {
      this.composeToolbarView = new Whisper.ReactWrapperView({
        Component: window.Signal.Components.ComposeToolbar,
        props: this.composeToolbarProps,
      });

      this.$('.compose-toolbar-anchor').append(this.composeToolbarView.el);
    },
    toolbarItemVisibleChanged(newProps, itemKey) {
      if (newProps[itemKey]?.visible !== undefined) {
        return (
          this.composeToolbarProps[itemKey].visible !==
          newProps[itemKey].visible
        );
      } else {
        return false;
      }
    },
    updateComposeToolbar(newProps) {
      const messageModeVisibleChanged = this.toolbarItemVisibleChanged(
        newProps,
        'messageMode'
      );

      Object.entries(newProps).forEach(([key, value]) => {
        _lodash.update(this.composeToolbarProps, key, old => {
          if (old) {
            return { ...old, ...value };
          } else {
            return value;
          }
        });
      });

      if (this.composeToolbarView) {
        this.composeToolbarView.update(this.composeToolbarProps);
      }

      if (messageModeVisibleChanged) {
        if (this.composeToolbarProps.messageMode.visible) {
          this.listenTo(this.model, 'change:confidentialMode', () => {
            this.updateComposeToolbar({
              messageMode: { mode: this.getMessageMode() },
            });
          });
        } else {
          this.stopListening(this.model, 'change:confidentialMode');
        }
      }
    },
    updateMessageToolBar() {
      if (!this.view) {
        return;
      }

      // added: private conversations hide @ funcion.
      if (this.model.isPrivate()) {
        this.updateFriendRequestBar();
        //this.$('.create-topic-list').hide();

        if (!this.model.isDirectoryUser()) {
          this.updateComposeToolbar({
            messageMode: { visible: false },
            attachmentSelector: { visible: false },
            shareContact: { visible: false },
            localSearch: { visible: false },
            captureAudio: { visible: false },
          });
        } else {
          this.updateComposeToolbar({
            messageMode: { visible: true },
            attachmentSelector: { visible: true },
            shareContact: { visible: true },
            localSearch: { visible: true },
            call: { visible: true },
            captureAudio: { visible: true },
          });
        }
        this.updateComposeToolbar({ atPerson: { visible: false } });
      } else {
        this.updateComposeToolbar({ messageMode: { visible: true } });
      }

      // non-directory user or leaved group
      if (!this.model.isAliveConversation()) {
        this.updateComposeToolbar({ call: { visible: false } });
      }

      // 机器人要隐藏语音通话按钮
      if (window.Signal.ID.isBotId(this.model.id)) {
        this.updateComposeToolbar({ call: { visible: false } });
      }

      // create a conversation to select @all conveniently
      if (!this.mentionsAll) {
        this.mentionsAll = new Whisper.Conversation({
          name: i18n('mentionsAllTitle'),
          id: MENTIONS_ALL_ID,
        });
      }

      if (!this.translateButton) {
        const onChangeTranslation = targetLang => {
          this.model.setTranslateLang(targetLang);
        };

        this.translateButton = new Whisper.ReactWrapperView({
          className: 'change-translation',
          Component: window.Signal.Components.TranslateMenu,
          elCallback: el => this.$('.change-translation').replaceWith(el),
          props: {
            targetLang: this.model.getTranslateLang(),
            onChangeTranslation,
            supportedLanguages: Whisper.Translate.getSupportedLanguageArray(),
          },
        });

        this.listenTo(this.model, 'change:translateLang', () => {
          this.translateButton.update({
            targetLang: this.model.getTranslateLang(),
            onChangeTranslation,
            supportedLanguages: Whisper.Translate.getSupportedLanguageArray(),
          });
        });
      }

      if (this.model.isMe()) {
        this.$('.change-translation').hide();
      }

      if (this.model.isMe()) {
        this.updateComposeToolbar({ call: { visible: false } });
      }

      this.restoreDraft();
    },
    getPropsForFriendRequestBar() {
      return {
        i18n,
        findyouDescribe: this.model.get('findyouDescribe'),
        isBlocked: this.model.isBlocked(),
        setBlockStatus: blocked => this.setBlockStatus(blocked),
        acceptFriendRequest: async () => this.model.acceptFriendRequest(),
        reportAbnormalUser: async (type, reason, block) =>
          this.model.reportAbnormalUser(type, reason, block),
      };
    },
    updateFriendRequestBar() {
      if (this.model.isFriendRequesting() || this.model.isBlocked()) {
        if (this.friendRequestBar) {
          this.friendRequestBar.update(this.getPropsForFriendRequestBar());
        } else {
          this.friendRequestBar = new Whisper.ReactWrapperView({
            className: 'friend-request-option',
            Component: window.Signal.Components.FriendRequestOption,
            elCallback: el => this.$('.friend-request-option').append(el),
            props: this.getPropsForFriendRequestBar(),
          });
        }

        this.$('.send-message').hide();
        this.$('.friend-request-option').show();
        this.updateComposeToolbar({ toolbar: { visible: false } });
      } else {
        this.friendRequestBar?.remove();
        this.friendRequestBar = null;

        this.$('.send-message').show();
        this.$('.friend-request-option').hide();

        this.updateComposeToolbar({ toolbar: { visible: true } });
      }
    },
    events: {
      keydown: 'onKeyDown',
      mousemove: 'onMouseMove',
      'submit .send': 'sendMessage',
      'input .send-message': 'onInputChange',
      'keydown .send-message': 'updateMessageFieldSize',
      'keyup .send-message': 'maybeBumpTyping',
      'keydown .discussion-container .conversation-header': 'quitTopicByEsc',
      click: 'onClick',
      'click .bottom-bar': 'focusMessageField',
      'click .module-mentions-jump': 'scrollToNextMentionsYou',
      'focus .send-message': 'focusBottomBar',
      'change .file-input': 'toggleMicrophone',
      'blur .send-message': 'unfocusBottomBar',
      'loadMore .message-list': 'loadMoreMessages',
      'newOffscreenMessage .message-list': 'onNewOffScreenMessage',
      'atBottom .message-list': 'onAtBottom',
      'farFromBottom .message-list': 'onFarFromBottom',
      'lazyScroll .message-list': 'onLazyScroll',
      'force-resize': 'forceUpdateMessageFieldSize',

      'change input.file-input': 'onChoseAttachment',

      //'click .create-topic-list': 'onCreateTopicList',
      'click .switch-reply-mode': 'onSwitchReplyMode',
      // 'click .create-quick-group': 'onQuickGroup',

      'resetLastSeenIndicator .message-list': 'resetLastSeenIndicatorWrapper',

      dragover: 'onDragOver',
      dragleave: 'onDragLeave',
      drop: 'onDrop',
      paste: 'onPaste',
      copy: 'onCopy',
      closeRecording: 'endCaptureAudio',
    },

    initMainView() {
      this.mainView = new Whisper.MessageListView({
        className: 'message-list main-list',
        collection: this.model.messageCollection,
        window: this.window,
        listMode: 'main',
      });

      this.mainView.renderList();

      this.view = this.mainView;
      this.$('.discussion-container').append(this.view.el);
    },

    showLoadingScreen() {
      if (!this.loadingScreen) {
        this.loadingScreen = new Whisper.ReactWrapperView({
          Component: window.Signal.Components.LottieAnimation,
          className: 'conversation-loading-screen',
          props: {
            src: `lotties/conversation-loading-${window.getCurrentTheme()}.lottie`,
            style: {
              height: 120,
            },
          },
        });
        this.loadingScreen.$el.prependTo(this.$('.discussion-container'));
      }
    },

    removeLoadingScreen(delay) {
      const _removeLoadingScreen = () => {
        const view = this.loadingScreen;
        if (!view) {
          return;
        }

        this.loadingScreen = null;
        view.remove();
      };

      const timeout = typeof delay === 'number' ? delay : 0;
      setTimeout(() => _removeLoadingScreen(), timeout);
    },

    showNoChatHistoryToast() {
      if (this.noChatHistoryToast) {
        this.noChatHistoryToast?.close();
        this.noChatHistoryToast = null;
      }
      this.noChatHistoryToast = new Whisper.noChatHistory();
      this.noChatHistoryToast.$el.appendTo(this.$el);
      this.noChatHistoryToast.render();
    },
    showUnspeakToast() {
      if (this.unspeakToast) {
        this.unspeakToast?.close();
        this.unspeakToast = null;
      }

      this.unspeakToast = new Whisper.unSpeak();
      this.unspeakToast.$el.appendTo(this.$el);
      this.unspeakToast.render();
    },
    onChooseAttachment(e) {
      if (!this.model.isMeCanSpeak()) {
        this.showUnspeakToast();
        this.focusMessageFieldAndClearDisabled();
        return;
      }

      if (e) {
        e.stopPropagation();
        e.preventDefault();
      }

      this.$('input.file-input').trigger('click');
    },

    onChooseAtPersons(e) {
      if (e) {
        e.stopPropagation();
        e.preventDefault();
      }

      this.inputEscMode = false;
      this.newAtPersonChoose();
      this.insertMessage('@');
    },
    async onChoseAttachment() {
      const fileField = this.$('input.file-input');
      const files = fileField.prop('files');

      for (let i = 0, max = files.length; i < max; i += 1) {
        const file = files[i];
        // eslint-disable-next-line no-await-in-loop
        await this.fileInput.maybeAddAttachment(file);
        this.toggleMicrophone();
      }

      fileField.val(null);
    },

    async onCreateTopicList() {
      // 若已离开群
      if (!this.model.isPrivate() && this.model.isMeLeftGroup()) {
        let toast = new Whisper.LeftGroupToast();
        toast.$el.appendTo(this.$el);
        toast.render();
        this.focusMessageFieldAndClearDisabled();
        return;
      }
      if (this.settingsDialog) {
        this.settingsDialog.remove();
        this.settingsDialog = null;
      }

      if (this.topicListDialog) {
        this.topicListDialog.remove();
        this.topicListDialog = null;
        return;
      }

      // this.topicListDialog = new Whisper.ReactWrapperView({
      //   className: 'topic-list-dialog',
      //   Component: window.Signal.Components.TopicListDialog,
      //   props: {
      //     i18n,
      //     conversationId: this.model.getGroupV2Id(),
      //     conversationIdV1: this.model.get('id'),
      //     getListThreads: () => this.model.getListThreadsWithMessage(),
      //     model: this,
      //     onCancel: () => {
      //       if (this.topicListDialog) {
      //         this.topicListDialog.remove();
      //         this.topicListDialog = null;
      //       }
      //     },
      //     ourNumber: this.model.ourNumber,
      //   },
      // });
    },

    onSearchMessage() {
      window.showLocalSearch('', this.model.id);
    },

    onQuickGroup() {
      if (!this.model.isMeCanSpeak()) {
        this.showUnspeakToast();
        this.focusMessageFieldAndClearDisabled();
        return;
      }

      window.quickCreateGroupFromGroup(this.model.getName(), this.model.id);
    },

    onShareContact() {
      const number = this.model.get('id');
      const name = this.model.getName();

      if (number) {
        const myEvent = new CustomEvent('event-share-user-contact', {
          detail: { number, name, reverseShareDirection: true },
        });
        window.dispatchEvent(myEvent);
        this.props?.onClose();
      }
    },

    quickSendHistory(serverTimestamp) {
      let result = this.model.getGroupHistoryMessage(serverTimestamp);

      if (result.length === 0) {
        this.showNoChatHistoryToast();
        return;
      }

      this.forwardTo({
        conversationIds: [this.model.id],
        messages: result,
        isMerged: true,
      });
    },

    getSettingProps() {
      let groupMembersCount;
      if (
        !this.model.isPrivate() &&
        this.model.contactCollection &&
        this.model.contactCollection.models
      ) {
        groupMembersCount = this.model.contactCollection.models.length;
      }

      const members = [];
      if (
        !this.model.isPrivate() &&
        this.model.contactCollection &&
        this.model.contactCollection.models
      ) {
        for (
          let i = 0;
          i < this.model.contactCollection.models.length;
          i += 1
        ) {
          const item = this.model.contactCollection.models[i];
          members.push({
            id: item.id,
            role: item.role,
            color: item.getColor(),
            avatarPath: item.getAvatarPath(),
            phoneNumber: item.getNumber(),
            name: item.getName(),
            profileName: item.getProfileName(),
            verified: false,
            email: item.getEmail(),
            isMe: item.id === this.model.ourNumber,
          });
        }
      }

      // 创建者放第一个，其次是管理员，后面是成员
      const collator = new Intl.Collator();
      members.sort((left, right) => {
        // 创建者
        if (left.role === 0) {
          return -1;
        }

        if (right.role === 0) {
          return 1;
        }

        // 管理员
        if (left.role === 1) {
          return -1;
        }

        if (right.role === 1) {
          return 1;
        }

        const leftLower = (
          left.name ||
          left.profileName ||
          left.id
        ).toLowerCase();
        const rightLower = (
          right.name ||
          right.profileName ||
          right.id
        ).toLowerCase();
        return collator.compare(leftLower, rightLower);
      });

      const globalConfig = window.getGlobalConfig();

      const messageTimer = globalConfig.disappearanceTimeInterval.message;
      const defaultMessageExpiry = this.model.isMe()
        ? messageTimer.me
        : messageTimer.default;

      const messageExpiry = this.model.getConversationMessageExpiry();

      const optionValues =
        globalConfig.disappearanceTimeInterval
          .messageArchivingTimeOptionValues ||
        globalConfig.group.messageArchivingTimeOptionValues ||
        [];

      const reminderValue = this.model.get('remindCycle');
      const reminderOptionValues =
        globalConfig?.group?.groupRemind?.remindCycle || [];

      const tempShowInfo = this.tempShowId
        ? {
            id: this.tempShowId,
            timestamp: Date.now(),
          }
        : undefined;

      return {
        id: this.model.id,
        name: this.model.getName(),
        profileName: this.model.getProfileName(),
        color: this.model.getColor(),
        avatarPath: this.model.getAvatarPath(),
        i18n,
        ourNumber: this.model.ourNumber,
        isPrivate: this.model.isPrivate(),
        stick: this.model.get('isStick'),
        isDirectoryUser: this.model.isDirectoryUser(),
        onStick: stick => this.onStick(stick),
        onShowAllMedia: async () => {
          await this.showAllMedia();
          this.updateHeader({
            showGroupEditButton: false,
            showGroupSaveButton: false,
            onGoBack: this.defaultOnGoBack,
          });
        },
        onLeaveGroup: () => this.leaveGroup(),
        onDisbandGroup: () => this.disbandGroup(),
        onGroupV2AddMembers: () => {
          window.showAddGroupMembersWindow(this.model.get('id'));
        },
        onGroupV2RemoveMembers: () => {
          window.showRemoveGroupMembersWindow(this.model.get('id'));
        },
        onRenameGroupName: async newGroupName => {
          let conversation = this.model;
          if (conversation.getName() === newGroupName) {
            return true;
          }

          try {
            await conversation.apiEditGroupV2Meta(newGroupName);
            conversation.set({
              name: newGroupName,
              active_at: Date.now(),
              isArchived: false,
            });
            await window.Signal.Data.updateConversation(
              conversation.attributes
            );

            const groupUpdate = {
              name: newGroupName,
              operator: this.model.ourNumber,
              operatorDeviceId: this.model.getCurrentDeviceId(),
            };
            await conversation.updateGroup(groupUpdate);
            return true;
          } catch (error) {}
          return false;
        },
        onForwardTo: (conversationIds, inviteMessage) => {
          this.forwardTo({
            conversationIds,
            messages: [inviteMessage],
          });
        },
        onTransferGroupOwner: async id => {
          let conversation = this.model;
          try {
            await conversation.apiTransferOwner(id);

            // update groups
            const updates = {
              type: 'group',
              left: false,
              // active_at: Date.now(),
              isArchived: false,
              group_version: 2,
            };

            conversation.set(updates);
            await window.Signal.Data.updateConversation(
              conversation.attributes
            );

            // send signal add members message
            const groupUpdate = {
              changeOwner: id,
            };
            await conversation.updateGroup(groupUpdate);
            return true;
          } catch (error) {}
          alert('Transfer group ownership failed, try again later.');
          return false;
        },
        groupMembersCount,
        members,
        notifyIndex: this.model.transformNotificationSetting(
          this.model.getNotificationSettingText()
        ),
        setNotifyIndex: async notification => {
          await this.model.apiEditGroupV2Member(this.model.ourNumber, {
            notification,
          });

          //更新完群信息后，接着更新 MainMenus 的未读消息数量
          window.getInboxCollection().updateUnreadCount();
        },
        mute: this.model.get('isMute'),
        setMuteSetting: async mute => {
          await this.setMuteSetting(mute);
          window.getInboxCollection().updateUnreadCount();
        },
        isMeLeftGroup: this.model.isMeLeftGroup(),
        isGroupV2Owner: this.model.isMeGroupV2Owner(),
        isGroupV2Admin: this.model.isMeGroupV2Admin(),

        onCancel: () => {
          this.settingsDialog.remove();
          this.settingsDialog = null;
          this.tempShowId = undefined;
        },

        invitationRule: this.model.get('invitationRule'),
        setInvitationRule: async ruleIndex => {
          await this.model.apiEditGroupV2OnlyOwner('invitationRule', {
            invitationRule: ruleIndex,
          });
        },

        // anyoneRemove: this.model.get('anyoneRemove'),
        // setAnyoneRemove: async b => {
        //   await this.model.apiEditGroupV2OnlyOwner('anyoneRemove', {
        //     anyoneRemove: b,
        //   });
        // },

        // rejoin: this.model.get('rejoin'),
        // setRejoin: async b => {
        //   await this.model.apiEditGroupV2OnlyOwner('rejoin', { rejoin: b });
        // },
        publishRule: this.model.get('publishRule'),
        setPublishRule: async ruleIndex => {
          await this.model.apiEditGroupV2OnlyOwner('publishRule', {
            publishRule: ruleIndex,
          });
          await this.model.sendPublishRuleMessage(ruleIndex);
        },

        defaultMessageExpiry,
        currentMessageExpiry: messageExpiry,
        messageExpiryOptions: optionValues,
        onChangeMessageExpiry: this.model.updateMessageExpiry.bind(this.model),
        reminderValue,
        reminderOptionValues,
        onChangeReminder: this.model.updateGroupReminder.bind(this.model),

        anyoneChangeName: this.model.get('anyoneChangeName'),
        setAnyoneChangeName: async anyoneChangeName => {
          await this.model.apiEditGroupV2OnlyOwner('anyoneChangeName', {
            anyoneChangeName: !!anyoneChangeName,
          });
        },

        linkInviteSwitch: this.model.get('linkInviteSwitch'),
        setLinkInviteSwitch: async linkInviteSwitch => {
          await this.model.apiEditGroupV2OnlyOwner('linkInviteSwitch', {
            linkInviteSwitch: linkInviteSwitch,
          });
        },
        tempShowInfo,
        onClearTempShow: () => {
          this.tempShowId = undefined;
          this.updateSettingDialog();
        },
        onDeleteMessages: () => this.destroyMessages(),
        onBlockUser: () => this.onBlockUser(),
      };
    },

    onOpenSetting(tempShowId) {
      // 若已离开群
      if (!this.model.isPrivate() && this.model.isMeLeftGroup()) {
        let toast = new Whisper.LeftGroupToast();
        toast.$el.appendTo(this.$el);
        toast.render();
        this.focusMessageFieldAndClearDisabled();
        return;
      }

      if (this.topicListDialog) {
        this.topicListDialog.remove();
        this.topicListDialog = null;
      }

      this.tempShowId = tempShowId;

      const props = this.getSettingProps();

      if (this.settingsDialog) {
        if (this.tempShowId) {
          this.settingsDialog.update(props);
        } else {
          this.settingsDialog.remove();
          this.settingsDialog = null;
        }
      } else {
        this.settingsDialog = new Whisper.ReactWrapperView({
          Component: window.Signal.Components.SettingDialog,
          props,
        });
      }
    },
    async onRequestFriend() {
      try {
        await this.model.sendFriendRequest();
        window.noticeSuccess(i18n('friendRequestSent'));

        this.model.forceSendMessageAuto(
          i18n('friendRequest'),
          null,
          [],
          null,
          null,
          null,
          null,
          null,
          null,
          null
        );
      } catch (e) {
        console.log('send apply friend message error', e);
        window.noticeError('network error');
      }
    },
    onDragOver(e) {
      this.fileInput.onDragOver(e);
    },
    onDragLeave(e) {
      this.fileInput.onDragLeave(e);
    },
    onDrop(e) {
      this.fileInput.onDrop(e);
    },
    async onPaste(e) {
      const text = await this.fileInput.onPaste(e);
      if (text) {
        this.insertMessage(text);
      }
    },
    onCopy(e) {
      window.handleOnCopy();
    },

    onPrune(doNext = true) {
      if (
        !this.view ||
        !this.model.messageCollection.length ||
        !this.lastActivity
      ) {
        return;
      }

      let doPrune;

      const oneHourAgo = Date.now() - 60 * 60 * 1000;
      if (this.isHidden() && this.lastActivity < oneHourAgo) {
        doPrune = () => this.unload('inactivity');
      } else if (this.view.atBottom()) {
        doPrune = () => this.trim();
      }

      if (doPrune) {
        if (doNext) {
          setTimeout(() => this.onPrune(false), 0);
        } else {
          doPrune();
        }
      }
    },

    unload(reason) {
      window.log.info(
        'unloading conversation',
        this.model.idForLogging(),
        'due to:',
        reason
      );

      // remove panels
      if (this.panels && this.panels.length) {
        for (let i = 0, max = this.panels.length; i < max; i += 1) {
          const panel = this.panels[i];
          panel.remove();
        }

        this.panels = null;
      }

      // clear onClosed listener
      if (this.removeOnClosed) {
        this.removeOnClosed();
        this.removeOnClosed = null;
      }

      this.window.removeEventListener('resize', this.onResize);
      this.window.removeEventListener('focus', this.onFocus);

      this.clearSaveDraftTimer();
      this.debouncedSaveDraft();
      this.debouncedSaveDraft.flush();

      window.autosize.destroy(this.$messageField);

      // unload all messages
      this.model.messageCollection.reset([]);
      this.model.messageCollection.clearThread();

      this.model.syncedGroup = false;
      this.model.syncedMute = false;
      this.model.syncedBlock = false;

      const objectCleanup = (objectName, cleanup) => {
        if (!this.hasOwnProperty(objectName)) {
          // log.warn('there is no ', objectName, this.model.idForLogging());
          return;
        }

        const instance = this[objectName];
        if (!instance) {
          // log.warn(`${objectName} is invalid`, this.model.idForLogging());
          return;
        }

        const func = instance[cleanup];
        if (typeof func === 'function') {
          func.call(instance);
        } else {
          log.warn(
            `there is no ${cleanup} in ${objectName}`,
            this.model.idForLogging()
          );
        }

        this[objectName] = null;
      };

      const debouncedList = [
        'throttledUpdateUnreadMentions',
        'throttleMarkRead',
        'debouncedSaveDraft',
        'debouncedUpdateHeader',
        'debouncedTriggerChange',
        'throttledGetProfiles',
        'throttleForceSyncLastReadPosition',
      ];

      for (const debounced of debouncedList) {
        objectCleanup(debounced, 'cancel');
      }

      const viewList = [
        // views on tool bar
        'replyButtonView',
        'translateButton',

        // views of dialog
        'settingsDialog',
        'topicListDialog',
        'loadingView',

        // views of components
        'titleView',
        'lastSeenIndicator',
        'scrollDownButton',
        'quoteView',
        'lightBoxView',
        'lightboxGalleryView',
        'fileInput',
        'mainView',
        'threadView',
      ];

      for (const viewName of viewList) {
        objectCleanup(viewName, 'remove');
      }

      const collections = ['selectedMessages'];
      for (const collection of collections) {
        objectCleanup(collection, 'reset');
      }

      this.mentionsAll = null;
      this.view = null;
      this.$messageField = null;

      this.remove();
    },

    trim() {
      this.model.messageCollection.trim();
    },

    toggleMicrophone() {
      if (
        this.$('.send-message').val().length > 0 ||
        this.fileInput.hasFiles()
      ) {
        this.updateComposeToolbar({
          captureAudio: { visible: false },
        });
      } else {
        if (this.model.isAliveConversation()) {
          this.updateComposeToolbar({
            captureAudio: { visible: true },
          });
        } else {
          this.updateComposeToolbar({
            captureAudio: { visible: false },
          });
        }
      }
    },
    startCaptureAudio(e) {
      e.preventDefault();
      e.stopPropagation();

      if (!this.model.isMeCanSpeak()) {
        this.showUnspeakToast();
        this.focusMessageFieldAndClearDisabled();
        return;
      }

      if (this.fileInput.hasFiles()) {
        const toast = new Whisper.VoiceNoteMustBeOnlyAttachmentToast();
        toast.$el.appendTo(this.$el);
        toast.render();
        return;
      }

      this.$('.send-message').prop('disabled', true);
    },
    checkCallOrMeetingAlreadyExist() {
      const store = inboxStore.getState();
      const { calls } = store.conversations;

      if (_.isEmpty(calls)) {
        return false;
      }

      const conversationId = this.model.id;

      if (calls && calls[conversationId]) {
        return {
          type: 'call',
          data: calls[conversationId],
        };
      }

      return false;
    },
    joinAlreadyExistCallOrMeeting(info) {
      const { type, data } = info;

      if (type === 'call') {
        const { type, roomId, conversation, roomName } = data;
        window.joinCall({
          type,
          roomId,
          conversation,
          roomName,
        });
      }
    },
    async startCall() {
      try {
        const username = textsecure.storage.get('number_id');
        const deviceId = textsecure.storage.user.getDeviceId();

        const roomName = this.model.cachedProps.name;
        const ourName = ConversationController.get(
          this.model.ourNumber
        ).getName();

        if (this.model.isPrivate()) {
          const theUser = ConversationController.get(this.model.id);
          if (!theUser) {
            alert(i18n('different_subteam_error'));
            return;
          }

          window.dispatchCallMessage('startCall', {
            isPrivate: true,
            roomName,
            ourName,
            number: this.model.id,
            username,
            type: '1on1',
            deviceId,
          });
        } else {
          // check 当前 conversation 是否存在 call 或 meeting
          const info = this.checkCallOrMeetingAlreadyExist();

          if (info) {
            return this.joinAlreadyExistCallOrMeeting(info);
          }

          window.dispatchCallMessage('startCall', {
            isPrivate: false,
            roomName,
            ourName,
            groupId: this.model.id,
            username,
            type: 'group',
            deviceId,
          });
        }
      } catch (e) {
        console.log('startCall error:', e);
      }
    },
    handleAudioCapture(blob) {
      this.fileInput.addAttachment({
        contentType: blob.type,
        file: blob,
        isVoiceNote: true,
      });
      this.$('.bottom-bar form').trigger('submit');
    },
    resetCaptureAudioStatus() {
      this.updateComposeToolbar({
        captureAudio: {
          resetKey: this.composeToolbarProps.captureAudio.resetKey + 1,
        },
      });
    },
    endCaptureAudio() {
      this.$('.send-message').prop('disabled', false);

      if (this.model.isPrivate()) {
        if (this.model.isDirectoryUser()) {
          this.resetCaptureAudioStatus();
        }
      } else {
        this.resetCaptureAudioStatus();
      }
    },

    clearSaveDraftTimer() {
      if (this.saveDraftTimeout) {
        clearTimeout(this.saveDraftTimeout);
        this.saveDraftTimeout = null;
      }
    },

    unfocusBottomBar() {
      if (this.composeToolbarView) {
        this.updateComposeToolbar({ toolbar: { active: false } });
      }

      this.clearSaveDraftTimer();

      this.saveDraftTimeout = setTimeout(
        this.debouncedSaveDraft.bind(this),
        200
      );
    },
    focusBottomBar() {
      this.updateComposeToolbar({ toolbar: { active: true } });

      this.clearSaveDraftTimer();

      // show @ dialog
      const sub = this.getAtPersonSubString();
      if (sub !== undefined) {
        const atPersonsProps = this.getNewAtPersonProps(sub);
        if (
          atPersonsProps.contacts.length === 0 &&
          atPersonsProps.allContacts.length === 0
        ) {
          this.atView?.remove();
          this.atView = null;
          return;
        }

        if (!this.atView) {
          this.newAtPersonChoose(atPersonsProps);
        } else {
          this.atView.update(atPersonsProps);
        }
      }
    },

    async onLazyScroll() {
      // The in-progress fetch check is important, because while that happens, lots
      //   of messages are added to the DOM, one by one, changing window size and
      //   generating scroll events.
      if (
        !this.isHidden() &&
        window.isFocused() &&
        !this.inProgressFetch &&
        window.isActivation()
      ) {
        this.lastActivity = Date.now();

        if (!this.isMessageViewHidden()) {
          this.throttleMarkRead();

          if (this.view?.atBottom()) {
            // mark read now
            this.throttleMarkRead.flush();
          }
        }
      }
    },
    updateUnread() {
      this.resetLastSeenIndicator();
      // Waiting for scrolling caused by resetLastSeenIndicator to settle down
      setTimeout(() => this.throttleMarkRead?.(), 0);
    },

    async onLoaded() {
      const view = this.loadingScreen;
      if (view) {
        const openDelta = Date.now() - this.openStart;
        window.log.info(
          'Conversation',
          this.model.idForLogging(),
          'took',
          openDelta,
          'milliseconds to load'
        );

        const delay = 500 - openDelta;
        this.removeLoadingScreen(delay > 0 ? delay : 0);
      }
      this.throttleForceSyncLastReadPosition?.();
      this.updateComposeToolbar({ toolbar: { active: true } });

      this.model.loadSessionV2();
    },

    async findMessage(messageId) {
      let found = this.model.messageCollection.get(messageId);
      if (found) {
        return found;
      }

      found = MessageController.getById(messageId);
      if (found) {
        return found;
      }

      const fetched = await window.Signal.Data.getMessageById(messageId, {
        Message: Whisper.Message,
      });

      if (fetched) {
        found = MessageController.register(fetched.id, fetched);
      } else {
        window.log.error('message not found in database for ', messageId);
      }

      return found;
    },
    createLoadingView() {
      if (this.loadingView) {
        return;
      }
      this.loadingView = new Whisper.ReactWrapperView({
        className: 'conversation-loading-view',
        Component: window.Signal.Components.ConversationLodingView,
        props: {
          onCancel: () => {
            this.removeLoadingView();
          },
        },
      });
      $('.conversation-loading-modal').append(this.loadingView.el);
    },

    removeLoadingView() {
      if (this.loadingView) {
        this.loadingView?.remove();
        this.loadingView = null;
      }
    },
    onOpened(messageId) {
      this.openStart = Date.now();
      this.lastActivity = Date.now();

      window.log.info(
        'Conversation onOpened:',
        this.model.idForLogging(),
        _.pick(this.model.getPreferredAvatar() || {}, ['path', 'hash']),
        _.pick(this.model.get('commonAvatar') || {}, ['id', 'attachmentId'])
      );

      this.view.resetScrollPosition();

      this.model.messageCollection.clearThread();

      let goBackTimes = 0;
      do {
        this.onGoBack();
        goBackTimes++;
      } while (this.onGoBack != this.defaultOnGoBack && goBackTimes < 3);

      setTimeout(() => this.model.broughtToFront(), 0);
      setTimeout(() => this.model.unmarkAsUnread(), 0);
      setTimeout(() => this.fetchConversationSettingsIfNeeded(), 0);
      setTimeout(() => this.model.debouncedUpdateLastMessage(), 0);
      setTimeout(async () => {
        if (this.model.syncedShared && this.model.isDirectoryUser()) {
          return;
        }

        try {
          await this.model.apiGetSharedConfig();
          this.model.syncedShared = true;
        } catch (error) {
          window.log.error('apiGetSharedConfig failed when open conversation');
        }
      }, 0);

      if (!this.model.isPrivate() && !this.model.syncedGroup) {
        setTimeout(async () => {
          try {
            await this.model.apiLoadGroupV2();

            window.log.info('group info load from server successfully.');
            this.model.syncedGroup = true;
            await window.Signal.Data.updateConversation(this.model.attributes);
          } catch (error) {
            window.log.info('failed to load group info from server.', error);
          }
        }, 0);
      }

      if (this.model.isPrivate()) {
        setTimeout(async () => {
          try {
            await this.throttledGetProfiles();
          } catch (error) {
            window.log.error('failed to fetch status.', error);
          }

          window.log.info('done with status fetch:', this.model.idForLogging());
        }, 0);
      } else {
        window.log.info('Large group opened: ', this.model.idForLogging());
      }

      this.$el.trigger('force-resize');
      this.focusMessageField();

      const inProgressFetch = this.inProgressFetch;

      setTimeout(async () => {
        if (inProgressFetch) {
          try {
            await inProgressFetch;
          } catch (error) {
            window.log.error(
              'failed to load messages.',
              Errors.toLogFormat(error),
              this.model.idForLogging()
            );
          }
        }

        this.onLoaded();
      }, 0);

      setTimeout(async () => {
        let renderPromise;
        if (inProgressFetch) {
          const result = await inProgressFetch;
          renderPromise = result?.renderPromise;
        }

        if (messageId) {
          const message = await this.findMessage(messageId);
          if (message) {
            if (renderPromise) {
              await renderPromise;
            }

            await this.scrollToMessage({
              author: message.getSource(),
              id: message.get('sent_at'),
            });
          }
        }

        if (renderPromise) {
          await renderPromise;
        }

        this.updateUnread();
      }, 0);
    },

    onNewOffScreenMessage(event, model) {
      if (model.isMentionsYouOrAll()) {
        this.throttledUpdateUnreadMentions();
      }

      this.updateScrollDownButton(1);
    },

    onFarFromBottom() {
      this.addScrollDownButton();
    },

    addScrollDownButton() {
      if (!this.scrollDownButton) {
        const unreadCount = this.model.get('unreadCount');
        this.updateScrollDownButton(unreadCount);
      }
    },

    getScrollDownButtonProps() {
      return {
        count: this.scrollDownButton?.count ?? this.model.get('unreadCount'),
        onClick: () => {
          this.scrollToBottom();
        },
      };
    },

    // count on scroll button just is a flag
    // indicating this conversation has any unread messages
    updateScrollDownButton(count) {
      if (this.scrollDownButton) {
        this.scrollDownButton.count += count;
        this.scrollDownButton.update(this.getScrollDownButtonProps());
      } else {
        this.scrollDownButton = new Whisper.ReactWrapperView({
          className: 'module-scroll-down',
          Component: window.Signal.Components.ScrollDownButton,
          props: this.getScrollDownButtonProps(),
        });
        this.scrollDownButton.count = this.model.get('unreadCount');

        const container = this.$('.discussion-container');
        container.append(this.scrollDownButton.el);
      }
    },

    removeScrollDownButton() {
      if (this.scrollDownButton) {
        const button = this.scrollDownButton;
        this.scrollDownButton = null;
        button.remove();
      }
    },

    updateMentionsJumpButton(count, reset = false) {
      if (this.model.isPrivate() || !this.view) {
        return;
      }

      if (this.mentionsJumpButton) {
        if (reset) {
          if (count === 0) {
            this.removeMentionsJumpButton();
          } else {
            this.mentionsJumpButton.update({ count });
            this.mentionsJumpButton.count = count;
          }
        } else {
          const result = this.mentionsJumpButton.count + count;
          this.mentionsJumpButton.update({ count: result });
          this.mentionsJumpButton.count = result;
        }
      } else {
        this.mentionsJumpButton = new Whisper.ReactWrapperView({
          className: 'module-mentions-jump',
          Component: window.Signal.Components.MentionsJumpButton,
          props: {
            count,
          },
        });

        this.mentionsJumpButton.count = count;

        const container = this.$('.discussion-container');
        container.append(this.mentionsJumpButton.el);
      }
    },

    removeMentionsJumpButton() {
      if (this.mentionsJumpButton) {
        const button = this.mentionsJumpButton;
        this.mentionsJumpButton = null;
        button.remove();
      }
    },

    async onAtBottom() {
      // only do mark when messages were already shown
      if (this.inProgressFetch) {
        if (this.isInRendering) {
          return;
        }

        this.isInRendering = true;

        try {
          const result = await this.inProgressFetch;
          const { renderPromise } = result;

          if (renderPromise) {
            await renderPromise;
          }
        } catch (error) {
          log.error(
            'failed to load message',
            Errors.toLogFormat(error),
            this.model.idForLogging()
          );
        }

        this.isInRendering = false;
      }

      if (!this.view) {
        return;
      }

      // remove buttons only when bottom messages has been loaded
      this.view.measureScrollPosition();

      if (
        this.model.hasBottomLoaded() &&
        this.view.atBottom() &&
        !this.isMessageViewHidden()
      ) {
        this.removeScrollDownButton();
        this.removeMentionsJumpButton();
        if (window.isActivation()) {
          this.throttleMarkRead();
          this.throttleMarkRead.flush();
        }
      }
    },

    removeLastSeenIndicator() {
      if (this.lastSeenIndicator) {
        const indicator = this.lastSeenIndicator;
        this.lastSeenIndicator = null;
        indicator.remove();

        const oldestUnreadModel = this.model.messageCollection.find(
          model => model.oldestUnread
        );
        if (oldestUnreadModel) {
          delete oldestUnreadModel.oldestUnread;
        }

        this.debounceTagVirtualIndex();
      }
    },

    async scrollToMessage(options = {}) {
      const { author, id, referencedMessageNotFound } = options;

      log.info('try to scroll to', options, this.model.idForLogging());

      if (!this.view) {
        log.warn(
          'scrollToMessage: view has destoryed 1',
          this.model.idForLogging()
        );
        return;
      }

      // For simplicity's sake, we show the 'not found' toast no matter what if we were
      //   not able to find the referenced message when the quote was received.
      if (referencedMessageNotFound) {
        const toast = new Whisper.OriginalNotFoundToast();
        toast.$el.appendTo(this.$el);
        toast.render();
        return;
      }

      // Look for message in memory first, which would tell us if we could scroll to it
      const targetMessage = this.model.messageCollection.find(item => {
        const messageAuthor = item.getContact();

        if (!messageAuthor || author !== messageAuthor.id) {
          return false;
        }

        if (id !== item.get('sent_at')) {
          return false;
        }

        // threadOnly message treated as NOT loaded in main-list
        if (!this.threadCollection && item.threadOnly) {
          return false;
        }

        return true;
      });

      // If there's no message already in memory, we won't be scrolling. So we'll gather
      //   some more information then show an informative toast to the user.
      if (!targetMessage) {
        const collection = await window.Signal.Data.getMessagesBySentAt(id, {
          MessageCollection: Whisper.MessageCollection,
        });

        if (!this.view) {
          log.warn(
            'scrollToMessage: view has destoryed 2',
            this.model.idForLogging()
          );
          return;
        }

        const found = collection.find(item => {
          const messageAuthor = item.getContact();
          return messageAuthor && author === messageAuthor.id;
        });

        if (found) {
          const serverTimestamp = found.getServerTimestamp();
          await this.model.loadReadPositions(serverTimestamp, serverTimestamp);

          if (!this.view) {
            log.warn(
              'scrollToMessage: view has destoryed 3',
              this.model.idForLogging()
            );
            return;
          }

          found.correctExpireTimer();
          if (!found.isExpired()) {
            this.showLoadingScreen();

            // try to load newer messages of serverTimestamp
            await this.fetchAndResetMessagesAndWaitRender(serverTimestamp);

            // if messages was not full of current view
            // try to load more older messages of current
            if (this.isOnlyOneScreen()) {
              window.log.info(
                'scrollToMessage: only one screen, try to load more older'
              );

              await this.loadMoreMessagesAndWaitRender(true);
            }

            await this.scrollToMessage(options);

            await this.updateUnreadMentions();

            this.removeLoadingScreen();
            return;
          }
        }
      }

      if (!targetMessage || targetMessage.isExpired()) {
        window.log.warn(
          'message jumped to is no longer available',
          this.model.idForLogging(),
          options,
          targetMessage?.idForLogging()
        );

        const toast = new Whisper.OriginalNoLongerAvailableToast();
        toast.$el.appendTo(this.$el);
        toast.render();
        return;
      }

      const databaseId = targetMessage.id;
      const listClass = this.threadCollection ? '.thread-list' : '.main-list';

      const el = this.$(`${listClass} #${databaseId}`);
      if (!el || el.length === 0) {
        const toast = new Whisper.OriginalNoLongerAvailableToast();
        toast.$el.appendTo(this.$el);
        toast.render();

        window.log.info(
          `Error: had target message ${id} in messageCollection, but it was not in DOM`
        );
        return;
      }

      el[0].scrollIntoView(options.scrollIntoViewOptions || { block: 'start' });
      this.view?.measureScrollPosition();
    },

    async showAllMedia() {
      // We fetch more documents than media as they don’t require to be loaded
      // into memory right away. Revisit this once we have infinite scrolling:
      const DEFAULT_MEDIA_FETCH_COUNT = 100;
      const DEFAULT_DOCUMENTS_FETCH_COUNT = 150;

      const conversationId = this.model.get('id');

      const getProps = async () => {
        const rawMedia =
          await Signal.Data.getMessagesWithVisualMediaAttachments(
            conversationId,
            {
              limit: DEFAULT_MEDIA_FETCH_COUNT,
            }
          );
        const rawDocuments = await Signal.Data.getMessagesWithFileAttachments(
          conversationId,
          {
            limit: DEFAULT_DOCUMENTS_FETCH_COUNT,
            MessageCollection: Whisper.MessageCollection,
          }
        );

        // First we upgrade these messages to ensure that they have thumbnails
        for (let max = rawMedia.length, i = 0; i < max; i += 1) {
          const message = rawMedia[i];
          const { schemaVersion } = message;

          if (schemaVersion < Message.CURRENT_SCHEMA_VERSION) {
            // Yep, we really do want to wait for each of these
            // eslint-disable-next-line no-await-in-loop
            rawMedia[i] = await upgradeMessageSchema(message);
            // eslint-disable-next-line no-await-in-loop
            await window.Signal.Data.saveMessage(rawMedia[i], {
              Message: Whisper.Message,
            });
          }
        }

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
        );

        const documents = rawDocuments
          .filter(message =>
            Boolean(message.attachments && message.attachments.length)
          )
          .map(message => {
            const attachments = message.attachments || [];
            const attachment = attachments[0];
            return {
              contentType: attachment.contentType,
              index: 0,
              attachment,
              message,
            };
          });

        const saveAttachment = async ({ attachment, message } = {}) => {
          const timestamp = message.received_at;
          Signal.Types.Attachment.save({
            attachment,
            document,
            getAbsolutePath: getAbsoluteAttachmentPath,
            timestamp,
          });
        };

        const onItemClick = async ({ message, attachment, type }) => {
          switch (type) {
            case 'documents': {
              saveAttachment({ message, attachment });
              break;
            }

            case 'media': {
              const selectedIndex = media.findIndex(
                mediaMessage => mediaMessage.attachment.path === attachment.path
              );

              let mediaFiles = media.map(fileData => {
                return {
                  url: fileData.objectURL,
                  // caption:fileData.message.body,
                  caption: '',
                  fileName: fileData.attachment.fileName,
                  contentType: fileData.contentType,
                };
              });

              // Close any existing window
              window.showImageGallery({
                mediaFiles: JSON.stringify(mediaFiles),
                selectedIndex: selectedIndex,
              });

              // this.lightboxGalleryView = new Whisper.ReactWrapperView({
              //   className: 'lightbox-wrapper',
              //   Component: Signal.Components.LightboxGallery,
              //   props: {
              //     media,
              //     onSave: saveAttachment,
              //     selectedIndex,
              //     onCopyImage: this.onCopyImage.bind(this),
              //   },
              //   onClose: () => Signal.Backbone.Views.Lightbox.hide(),
              // });
              // Signal.Backbone.Views.Lightbox.show(this.lightboxGalleryView.el);
              break;
            }

            default:
              throw new TypeError(`Unknown attachment type: '${type}'`);
          }
        };

        return {
          documents,
          media,
          onItemClick,
        };
      };

      const view = new Whisper.ReactWrapperView({
        className: 'panel-wrapper panel',
        Component: Signal.Components.MediaGallery,
        props: await getProps(),
        onClose: () => {
          this.stopListening(this.model.messageCollection, 'remove', update);
          this.resetPanel();
        },
      });

      const update = async () => {
        view.update(await getProps());
      };

      this.listenTo(this.model.messageCollection, 'remove', update);

      this.listenBack(view);
    },

    async scrollToBottom() {
      if (!this.model.hasBottomLoaded()) {
        this.showLoadingScreen();

        // fetch newest 50 messages and jump to bottom
        await this.fetchAndResetMessagesAndWaitRender();

        this.removeLoadingScreen();
        return;
      }
      // If we're above the last seen indicator, we should scroll there instead
      // Note: if we don't end up at the bottom of the conversation, button won't go away!
      if (this.lastSeenIndicator) {
        const location = this.lastSeenIndicator.$el.position().top;
        // maybe location = 0.125 after scrollIntoView
        if (location > 3) {
          this.lastSeenIndicator.el.scrollIntoView();
          return;
        }
        this.removeLastSeenIndicator();
      }

      this.view?.scrollToBottom();
    },

    resetLastSeenIndicatorWrapper(_, options) {
      this.resetLastSeenIndicator(options);
    },

    resetLastSeenIndicator(options = {}) {
      // if (this.isMessageViewHidden()) {
      //   return;
      // }

      if (!this.view) {
        return;
      }

      _.defaults(options, { scroll: true });

      const unreadCount = this.model.get('unreadCount');
      let oldestUnreadModel = null;
      let incomingUnread = null;

      const lastReadPosition = this.model.get('lastReadPosition');
      const maxTimestamp = lastReadPosition?.maxServerTimestamp || 0;

      // We need to iterate here because unseen non-messages do not contribute to
      //   the badge number, but should be reflected in the indicator's count.
      this.model.messageCollection.forEach(model => {
        if (maxTimestamp) {
          if (model.getServerTimestamp() <= maxTimestamp) {
            oldestUnreadModel = null;
            return;
          }
        } else {
          if (!model.get('unread')) {
            return;
          }
        }

        if (
          !oldestUnreadModel &&
          !model.isOutgoing() &&
          !model.isRecallMessage()
        ) {
          oldestUnreadModel = model;
        }

        if (!incomingUnread && model.isIncoming() && !model.isRecallMessage()) {
          incomingUnread = model;
        }
      });

      this.removeLastSeenIndicator();

      if (oldestUnreadModel && incomingUnread && unreadCount) {
        oldestUnreadModel.oldestUnread = true;
        this.debounceTagVirtualIndex();

        this.lastSeenIndicator = new Whisper.ReactWrapperView({
          Component: Signal.Components.LastSeenIndicator,
          className: 'module-last-seen-indicator',
          props: {
            unreadCount,
          },
        });
        this.lastSeenIndicator.unreadCount = unreadCount;

        const lastSeenEl = this.lastSeenIndicator.$el;

        lastSeenEl.insertBefore(this.$(`#${oldestUnreadModel.get('id')}`));

        if (this.view.atBottom() || options.scroll) {
          lastSeenEl[0].scrollIntoView();
        }

        // scrollIntoView is an async operation, but we have no way to listen for
        //   completion of the resultant scroll.
        setTimeout(() => {
          if (this.view && !this.view.atBottom()) {
            this.updateScrollDownButton(unreadCount);
          }
        }, 1);
      } else if (this.view.atBottom()) {
        // If we already thought we were at the bottom, then ensure that's the case.
        //   Attempting to account for unpredictable completion of message rendering.
        setTimeout(() => this.view?.scrollToBottom(), 1);
      }
    },

    focusMessageField() {
      if (this.panels && this.panels.length) {
        return;
      }

      this.$messageField?.trigger('focus');
    },

    focusMessageFieldAndClearDisabled() {
      this.$messageField?.prop('disabled', false);
      this.$messageField?.trigger('focus');
    },

    prependArchiveIndicatorIfNeeded(count) {
      // view has been destroyed
      // in thread view
      // has more older messages not loaded
      if (
        !this.view ||
        this.threadCollection ||
        this.model.hasOlderUnloadedRemoteMessages()
      ) {
        return;
      }

      if (this.model.isMe()) {
        return;
      }

      if (this.view) {
        const messageExpiry = this.model.getConversationMessageExpiry();
        this.view.prependArchiveIndicatorIfNeeded(count, messageExpiry);
      }
    },

    isOnlyOneScreen() {
      return this.view && this.view.atBottom() && this.view.atTop();
    },

    async fetchOppositeIfNeeded(renderPromise1st, direction, resolve) {
      try {
        await renderPromise1st;
      } catch (error) {
        log.error(
          'error when wait renderPromise1st',
          Errors.toLogFormat(error),
          this.model.idForLogging()
        );
      }

      // when there are only one screen messages,
      // load more messages to opposite direction
      if (this.isOnlyOneScreen()) {
        log.info(
          'only one screen, try to fetch more messages',
          !direction,
          this.model.idForLogging()
        );
        try {
          const fetchResult = await this.fetchMessages(!direction);
          const { renderPromise: renderPromise2nd } = fetchResult || {};
          await renderPromise2nd;
        } catch (error) {
          log.warn(
            'render promise 2nd failed',
            Errors.toLogFormat(error),
            this.model.idForLogging()
          );
        }
      }

      this.inProgressFetch = null;
      resolve();
    },

    loadMoreMessages(event, upward) {
      if (event && this.inProgressFetch) {
        this.inProgressFetch.then(() => {
          this.inProgressFetch = null;
        });

        log.warn(
          'already in fetch progress, skipping.',
          this.model.idForLogging()
        );
        return;
      }

      this.inProgressFetch = this.fetchMessages(upward).then(result => {
        const renderPromise = new Promise(resolve => {
          const { renderPromise: renderPromise1st } = result || {};

          if (!renderPromise1st) {
            this.inProgressFetch = null;
            log.warn('invalid first renderPromise', this.model.idForLogging());
            resolve();
            return;
          }

          const nextCall = this.fetchOppositeIfNeeded.bind(
            this,
            renderPromise1st,
            upward,
            resolve
          );

          setTimeout(nextCall, 0);
        });

        return { renderPromise };
      });

      return this.inProgressFetch;
    },
    async loadMoreMessagesAndWaitRender(upward) {
      const { renderPromise } =
        (await this.loadMoreMessages(null, upward)) || {};
      if (renderPromise) {
        await renderPromise;
      }
    },
    async fetchAndResetMessagesAndWaitRender(serverTimestamp, limit) {
      // try to load newer messages of serverTimestamp
      const { renderPromise } =
        (await this.model.fetchAndResetMessages(serverTimestamp, limit)) || {};

      if (renderPromise) {
        await renderPromise;
      }
    },
    async fetchMessages(upward = true) {
      // upward: true: load older messages, false: load newer messages
      window.log.info(
        `fetchMessages: upward(${upward})`,
        this.model.idForLogging()
      );

      if (!upward && this.model.hasBottomLoaded()) {
        log.info(
          'already hasBottomLoaded, do not need to load more newer',
          this.model.idForLogging()
        );
        return Promise.resolve({ count: 0, renderPromise: Promise.resolve() });
      }

      this.$('.bar-container').show();

      // break task
      await new Promise(r => setTimeout(r, 0));

      return this.model
        .fetchContacts()
        .then(() => this.model.fetchContinuousMessages(upward))
        .then(result => {
          window.log.info(
            `fetchMessages done: upward(${upward})`,
            this.model.idForLogging()
          );

          this.$('.bar-container').hide();

          const { count, renderPromise } = result || {};
          if (renderPromise && upward) {
            setTimeout(async () => {
              // wait for all message rendered
              await renderPromise;

              // // try to append archive indicator
              // if (
              //   upward &&
              //   !this.threadCollection &&
              //   !this.model.hasOlderUnloadedRemoteMessages()
              // ) {
              //   this.prependArchiveIndicatorIfNeeded(count);
              // }
            }, 0);
          }

          return result;
        })
        .catch(error => {
          window.log.error(
            'fetchContinuousMessages error:',
            Errors.toLogFormat(error),
            this.model.idForLogging()
          );
        });
    },

    async handleMoreAfterNewMessage(message, renderPromise, lazyLoaded) {
      await new Promise(r => setTimeout(r, 0));

      // wait for message rendered
      await renderPromise;

      if (!this.view) {
        return;
      }

      if (lazyLoaded && this.isOnlyOneScreen()) {
        this.loadMoreMessages();
      }

      if (message.isOutgoing()) {
        this.removeLastSeenIndicator();
      } else if (
        message.isIncoming() &&
        !(await message.isIncomingMessageRead())
      ) {
        if (this.lastSeenIndicator) {
          this.lastSeenIndicator.unreadCount += 1;
          this.lastSeenIndicator.update({
            unreadCount: this.lastSeenIndicator.unreadCount,
          });
        }

        if (lazyLoaded) {
          this.onNewOffScreenMessage(_, message);
        }
      }

      if (!this.isHidden() && !window.isFocused()) {
        // The conversation is visible, but window is not focused
        if (!this.lastSeenIndicator) {
          this.resetLastSeenIndicator({ scroll: false });
        } else if (
          this.view?.atBottom() &&
          this.model.get('unreadCount') === this.lastSeenIndicator.unreadCount
        ) {
          // The count check ensures that the last seen indicator is still in
          //   sync with the real number of unread, so we can scroll to it.
          //   We only do this if we're at the bottom, because that signals that
          //   the user is okay with us changing scroll around so they see the
          //   right unseen message first.
          this.resetLastSeenIndicator({ scroll: true });
        }
      } else if (!this.isHidden() && window.isFocused()) {
        if (!window.isActivation()) {
          if (!this.lastSeenIndicator) {
            this.resetLastSeenIndicator({ scroll: false });
          } else if (
            this.view?.atBottom() &&
            this.model.get('unreadCount') === this.lastSeenIndicator.unreadCount
          ) {
            // The count check ensures that the last seen indicator is still in
            //   sync with the real number of unread, so we can scroll to it.
            //   We only do this if we're at the bottom, because that signals that
            //   the user is okay with us changing scroll around so they see the
            //   right unseen message first.
            this.resetLastSeenIndicator({ scroll: true });
          }
        } else {
          // The conversation is visible and in focus
          this.throttleMarkRead();

          // When we're scrolled up and we don't already have a last seen indicator
          //   we add a new one.
          if (this.view && !this.view.atBottom() && !this.lastSeenIndicator) {
            this.resetLastSeenIndicator({ scroll: false });
          }
        }
      }
    },

    addMessage(message) {
      log.info('new message:', message.idForLogging());

      if (message.isExpirationTimerUpdate()) {
        window.log.info('expiration timer update message, skipping ...');
        return;
      }

      if (message.isMentionsYouOrAll()) {
        this.throttledUpdateUnreadMentions();
      }

      // We do this here because we don't want convo.messageCollection to have
      //   anything in it unless it has an associated view. This is so, when we
      //   fetch on open, it's clean.
      const { renderPromise, lazyLoaded } = this.model.addSingleMessage(
        message,
        {
          atViewBottom: this.view.atBottom(),
        }
      );

      this.handleMoreAfterNewMessage(message, renderPromise, lazyLoaded);
    },

    onClick(event) {
      // If there are sub-panels open, we don't want to respond to clicks
      if (!this.panels || !this.panels.length) {
        this.throttleMarkRead();
      }
    },

    findNewestVisibleUnread() {
      const collection = this.threadCollection || this.model.messageCollection;
      const { length } = collection;
      const viewportBottom = this.view.outerHeight;

      const lastReadPosition = this.model.get('lastReadPosition');
      const maxTimestamp = lastReadPosition?.maxServerTimestamp || 0;

      // Start with the most recent message, search backwards in time
      let foundUnread = 0;
      for (let i = length - 1; i >= 0; i -= 1) {
        const message = collection.at(i);
        if (message.getServerTimestamp() <= maxTimestamp) {
          // already has been read
          return null;
        }

        foundUnread += 1;

        const el = this.$(`#${message.id}`);
        const position = el.position() || {};
        const { top } = position;

        // We're fully below the viewport, continue searching up.
        if (top > viewportBottom) {
          // eslint-disable-next-line no-continue
          continue;
        }

        // If min message height of message fits on screen, we'll call it visible.
        // Even if the message is really tall.
        const minHeight = 81;
        const bottom = top + minHeight;
        if (bottom <= viewportBottom) {
          return message;
        }

        // Continue searching up.
      }

      return null;
    },

    markRead() {
      let unread;
      let incoming;

      if (!this.view) {
        return;
      }

      this.model.unmarkAsUnread();

      const collection = this.threadCollection || this.model.messageCollection;

      if (this.view.atBottom()) {
        // find last non-outgoing message
        // and nearest incoming before non-outgoing message
        const last = collection.findLastMessageForMarkRead();
        unread = last?.lastNonOutgoing;
        incoming = last?.lastIncoming;
      } else {
        // include all except outgoing
        unread = this.findNewestVisibleUnread();
        if (unread && (!unread.isIncoming() || unread.isRecallMessage())) {
          // find nearest incoming before unread
          incoming = _lodash.findLast(
            collection.models,
            model => model.isIncoming() && !model.isRecallMessage(),
            collection.indexOf(unread)
          );
        }
      }

      const markReadAtMessage = message => {
        if (this.$(`#${message.id}`)?.length) {
          this.model.markReadAtMessage(message);
        } else {
          log.info('not loaded, markRead later', message.idForLogging());

          // schedule mark read later
          setTimeout(() => this.throttleMarkRead?.(), 50);

          return;
        }
      };

      if (incoming) {
        markReadAtMessage(incoming);
        if (
          unread &&
          unread.getServerTimestamp() > incoming.getServerTimestamp()
        ) {
          markReadAtMessage(unread);
        }
      } else {
        const findAndMarkRead = async () => {
          const last = await this.model.findLastMessageForMarkRead(
            unread.getServerTimestamp()
          );

          incoming = last?.lastIncoming;
          if (incoming) {
            markReadAtMessage(incoming);
          }

          const foundNonOutgoing = last?.lastNonOutgoing;
          if (
            foundNonOutgoing &&
            foundNonOutgoing.getServerTimestamp() > unread.getServerTimestamp()
          ) {
            unread = foundNonOutgoing;
          }

          markReadAtMessage(unread);
        };

        if (unread) {
          findAndMarkRead();
        }
      }
    },

    forceSend({ contact, message }) {
      const dialog = new Whisper.ConfirmationDialogView({
        message: i18n('identityKeyErrorOnSend', [
          contact.getTitle(),
          contact.getTitle(),
        ]),
        okText: i18n('sendAnyway'),
        resolve: async () => {
          message.resend(contact.id);
        },
      });

      this.$el.prepend(dialog.el);
      dialog.focusCancel();
    },

    downloadAttachment({ attachment, message, isDangerous }) {
      if (isDangerous) {
        const toast = new Whisper.DangerousFileTypeToast();
        toast.$el.appendTo(this.$el);
        toast.render();
        return;
      }

      Signal.Types.Attachment.save({
        attachment,
        document,
        getAbsolutePath: getAbsoluteAttachmentPath,
        timestamp: message.get('sent_at'),
      });
    },

    deleteMessage(message) {
      const dialog = new Whisper.ConfirmationDialogView({
        message: i18n('deleteWarning'),
        okText: i18n('confirmDelete'),
        resolve: () => {
          window.log.info('manully remove message', message.idForLogging());

          window.Signal.Data.removeMessage(message.id, {
            Message: Whisper.Message,
          });

          // using 'destroy' will unload all related views
          message.trigger('destroy');
          this.model.messageCollection.remove(message.id);
          this.resetPanel();
          this.updateHeader({
            showGroupEditButton: false,
            showGroupSaveButton: false,
          });
        },
      });

      this.$el.prepend(dialog.el);
      dialog.focusOk();
    },

    async onRecallMessage(message) {
      // const dialog = new Whisper.ConfirmationDialogView({
      //   message: i18n('recallWarning'),
      //   okText: i18n('recallTitle'),
      //   resolve: async () => {
      //     try {
      //       await this.model.recallMessage(message);
      //     } catch (error) {
      //       log.error('recall message failed, ', error);
      //     }
      //   },
      //   reject: () => {
      //     this.focusMessageField();
      //   },
      // });

      // this.$el.prepend(dialog.el);
      // dialog.focusCancel();
      if (!this.model.isMeCanSpeak()) {
        this.showUnspeakToast();
        this.focusMessageFieldAndClearDisabled();
        return;
      }

      try {
        await this.model.recallMessage(message);
        //删除消息
        await window.Signal.Data.removeMessage(message.id, {
          Message: Whisper.Message,
        });
      } catch (error) {
        log.error('recall message failed, ', error);
      }
    },

    onEditRecalledMessage(target) {
      const { body, atPersons } = target;

      if (body) {
        this.appendMessage(body);
        if (atPersons) {
          if (!this.atPersons) {
            this.atPersons = atPersons;
          } else {
            this.atPersons += `;${atPersons}`;
          }
        }
      }
    },

    showLightbox({ attachment, message, attachments }) {
      const { contentType, path } = attachment;

      if (
        !Signal.Util.GoogleChrome.isImageTypeSupported(contentType) &&
        !Signal.Util.GoogleChrome.isVideoTypeSupported(contentType)
      ) {
        this.downloadAttachment({ attachment, message });
        return;
      }

      attachments = attachments || message.get('attachments') || [];

      const media = attachments
        .filter(item => item.thumbnail && !item.pending && !item.error)
        .map((item, index) => ({
          objectURL: getAbsoluteAttachmentPath(item.path),
          path: item.path,
          contentType: item.contentType,
          index,
          message,
          attachment: item,
        }));

      if (media.length === 1) {
        const props = {
          objectURL: getAbsoluteAttachmentPath(path),
          contentType,
          caption: attachment.caption,
          onSave: () => this.downloadAttachment({ attachment, message }),
          onCopyImage: () => this.onCopyImage(attachment),
        };
        this.lightboxView = new Whisper.ReactWrapperView({
          className: 'lightbox-wrapper',
          Component: Signal.Components.Lightbox,
          props,
          onClose: () => {
            Signal.Backbone.Views.Lightbox.hide();
            this.stopListening(message);
          },
        });
        this.listenTo(message, 'expired recalled', () =>
          this.lightboxView.remove()
        );
        Signal.Backbone.Views.Lightbox.show(this.lightboxView.el);
        return;
      }

      const selectedIndex = _.findIndex(
        media,
        item => attachment.path === item.path
      );

      const onSave = async (options = {}) => {
        Signal.Types.Attachment.save({
          attachment: options.attachment,
          document,
          index: options.index + 1,
          getAbsolutePath: getAbsoluteAttachmentPath,
          timestamp: options.message.get('sent_at'),
        });
      };

      const props = {
        media,
        selectedIndex: selectedIndex >= 0 ? selectedIndex : 0,
        onSave,
        onCopyImage: this.onCopyImage.bind(this),
      };
      this.lightboxGalleryView = new Whisper.ReactWrapperView({
        className: 'lightbox-wrapper',
        Component: Signal.Components.LightboxGallery,
        props,
        onClose: () => {
          Signal.Backbone.Views.Lightbox.hide();
          this.stopListening(message);
        },
      });
      this.listenTo(message, 'expired recalled', () =>
        this.lightboxGalleryView.remove()
      );
      Signal.Backbone.Views.Lightbox.show(this.lightboxGalleryView.el);
    },

    showMessageDetail(message) {
      const onClose = () => {
        this.stopListening(message, 'change', update);

        if (this.headerTitleStack.length) {
          this.headerTitle = this.headerTitleStack.pop();
        } else {
          this.headerTitle = null;
        }

        if (this.onGoBackStack.length) {
          this.onGoBack = this.onGoBackStack.pop();
        } else {
          this.onGoBack = this.defaultOnGoBack;
        }

        this.resetLastPanel();
      };

      const props = message.getPropsForMessageDetail();
      const view = new Whisper.ReactWrapperView({
        className: 'message-detail-wrapper panel',
        Component: Signal.Components.MessageDetail,
        props,
        onClose,
      });

      const update = () => view.update(message.getPropsForMessageDetail());
      this.listenTo(message, 'change', update);
      this.listenTo(message, 'expired recalled', onClose);
      // We could listen to all involved contacts, but we'll call that overkill

      this.listenBack(view);

      if (this.headerTitleStack.length) {
        this.headerTitleStack.push(this.headerTitle);
      }

      if (this.onGoBackStack.length) {
        this.onGoBackStack.push(this.onGoBack);
      }

      this.headerTitle = i18n('messageDetailTitle');
      this.updateHeader({
        showGroupEditButton: false,
        showGroupSaveButton: false,
        onGoBack: () => {
          if (this.headerTitleStack.length) {
            this.headerTitle = this.headerTitleStack.pop();
          } else {
            this.headerTitle = null;
          }
          if (this.onGoBackStack.length) {
            this.onGoBack = this.onGoBackStack.pop();
          } else {
            this.onGoBack = this.defaultOnGoBack;
          }
          this.resetLastPanel();
        },
      });
      view.render();
    },

    async addAtPersonMessage(number) {
      const model = ConversationController.get(number);
      if (model) {
        this.finishSelectAtPerson = true;
        await this.chooseListenBack(
          model.getNumber(),
          model.get('groupDisplayName')
        );
      } else {
        log.error('model not found for ', number);
      }
    },

    showContactDetail({ contact, hasSignalAccount }) {
      const regionCode = storage.get('regionCode');
      const { contactSelector } = Signal.Types.Contact;

      const view = new Whisper.ReactWrapperView({
        Component: Signal.Components.ContactDetail,
        className: 'contact-detail-pane panel',
        props: {
          contact: contactSelector(contact, {
            regionCode,
            getAbsoluteAttachmentPath,
          }),
          hasSignalAccount,
          onSendMessage: () => {
            const number =
              contact.number && contact.number[0] && contact.number[0].value;
            if (number) {
              this.openConversation(number);
            }
          },
        },
        onClose: () => {
          this.resetPanel();
          this.updateHeader();
        },
      });

      this.listenBack(view);
      this.updateHeader();
    },

    showForwardedMessageList(message, forwards, title, cid) {
      if (!forwards || forwards.length < 1) {
        return;
      }

      const collection = new Backbone.Collection(
        forwards.map(forward => {
          const model = new Backbone.Model(
            message.getPropsForForwardMessage(forward)
          );
          model.getSource = () => forward.author;
          model.isRecallMessage = () => false;
          model.isRecalledMessage = () => false;
          model.isSystemNotification = () => false;
          model.getServerTimestamp = () => forward.id;
          model.isExpired = () => false;

          model.listenTo(message, 'change', () => {
            model.set(message.getPropsForForwardMessage(forward));
          });

          const { uuid: forwardUuid } = forward;
          if (forwardUuid) {
            model.listenTo(message, `update_forward:${forwardUuid}`, () => {
              const found = message.findOurForwardByUuid(forwardUuid);
              if (found) {
                model.set(message.getPropsForForwardMessage(found));
              } else {
                log.warn('can not found forward for:', forwardUuid);
              }
            });
          }

          return model;
        })
      );

      this.tagVirtualIndex(collection.models);

      const view = new Whisper.ReactWrapperView({
        className: 'forwarded-list-container panel forward',
        Component: Signal.Components.ForwardedMessageList,
        props: {
          messages: collection.models.map(model => ({
            ...model.attributes,
            virtualIndex: model.virtualIndex,
            dateSeparator: model.dateSeparator,
            dateTimestamp: model.getServerTimestamp(),
          })),
          i18n,
          beforeRemove: () => {
            collection.forEach(model => model.stopListening());
          },
        },
      });

      this.listenBack(view);

      this.headerTitleStack.push(this.headerTitle);
      this.onGoBackStack.push(this.onGoBack);
      this.headerTitle = title;

      this.updateHeader({
        headerTitle: this.headerTitle,
        onGoBack: () => {
          view.remove();

          this.resetPanel();

          this.headerTitle = this.headerTitleStack.pop();
          this.onGoBack = this.onGoBackStack.pop();

          this.updateHeader({
            headerTitle: this.headerTitle,
            showGroupEditButton: false,
            showGroupSaveButton: false,
            // onGoBack: this.lastOnGoBack,
            onGoBack: this.onGoBack,
          });
        },
        showGroupEditButton: false,
        showGroupSaveButton: false,
      });
    },

    async openConversation(number) {
      window.Whisper.events.trigger('showConversation', number);
    },

    listenBack(view) {
      this.panels = this.panels || [];
      if (this.panels.length > 0) {
        this.panels[0].$el.hide();
      } else {
        this.$('.main').first().hide();
      }

      this.panels.unshift(view);

      view.$el.insertBefore(this.$('.main').first());
    },
    resetPanel() {
      if (!this.panels || !this.panels.length) {
        return;
      }

      const view = this.panels.shift();

      if (this.panels.length > 0) {
        this.panels[0].$el.show();
      } else {
        this.$('.main').first().show();
      }

      view.remove();

      if (this.panels.length === 0) {
        this.$el.trigger('force-resize');
      }
    },

    async destroyMessages() {
      try {
        await this.confirm(
          i18n('deleteConversationConfirmation'),
          i18n('clear'),
          'button-danger'
        );
        try {
          await this.model.destroyMessages();
          this.unload('delete messages');
        } catch (error) {
          window.log.error(
            'destroyMessages: Failed to successfully delete conversation',
            error && error.stack ? error.stack : error
          );
        }
      } catch (error) {
        // nothing to see here, user canceled out of dialog
      }
    },

    async onBlockUser() {
      try {
        await this.setBlockStatus(true);
      } catch (error) {
        console.log('block user error', error);
      }
    },

    async onStick(stick) {
      await this.model.stickConversation(stick);
    },

    async setMuteSetting(mute) {
      await this.model.muteConversation(mute);
    },

    async setBlockStatus(blocked) {
      try {
        await this.model.setBlockStatus(blocked);
      } catch (error) {
        window.log.error(
          'set block status error',
          blocked,
          Errors.toLogFormat(error)
        );
        return;
      }

      if (blocked === true) {
        const toast = new Whisper.Blocked();
        toast.$el.appendTo(this.$el);
        toast.render();
      } else {
        this.showUnblockedToast();
      }
    },

    showUnblockedToast() {
      const toast = new Whisper.UnBlocked();
      toast.$el.appendTo(this.$el);
      toast.render();
    },

    async leaveGroup() {
      try {
        await this.confirm(i18n('leaveGroupConfirmation'), i18n('leave'));
        try {
          await this.model.leaveGroupV2();
          const isStick = this.model.get('isStick');
          const id = this.model.get('id');
          if (isStick) {
            Whisper.events.trigger('conversationStick', id, !isStick);
          }
        } catch (error) {
          window.log.error(
            'leaveGroup: Failed to successfully quit group',
            error && error.stack ? error.stack : error
          );
        }
      } catch (error) {
        // nothing to see here, user canceled out of dialog
      }
    },

    async disbandGroup() {
      try {
        await this.confirm(i18n('disbandGroupConfirmation'), i18n('disband'));
        try {
          await this.model.disbandGroupV2();
          const isStick = this.model.get('isStick');
          const id = this.model.get('id');
          if (isStick) {
            Whisper.events.trigger('conversationStick', id, !isStick);
          }
        } catch (error) {
          window.log.error(
            'disbandGroup: Failed to successfully disband group',
            error && error.stack ? error.stack : error
          );
        }
      } catch (error) {
        // nothing to see here, user canceled out of dialog
      }
    },

    closeEmoji(e) {
      if (this.emojiView) {
        this.emojiView.remove();
        this.emojiView = null;
      }
    },
    newEmojiChoose() {
      if (this.emojiView) {
        this.emojiView.remove();
        this.emojiView = null;
        return;
      }
      this.emojiView = new Whisper.ReactWrapperView({
        className: 'emoji-choose-wrapper',
        Component: window.Signal.Components.EmojiSelect,
        props: {
          onPickEmoji: emoji => {
            this.insertMessage(emoji.native);
          },
          onClose: () => {
            this.closeEmoji();
          },
          i18n,
        },
      });
      this.$('.discussion-container').append(this.emojiView.el);
    },
    onMouseMove(event) {
      if (window.isShouldScrollToBottom) {
        //输入键盘按钮追加scrollToBottom 事件
        if (this.$el.css('display') !== 'none') {
          this.throttleMarkRead();
          this.throttleMarkRead.flush();
        }
        window.isShouldScrollToBottom = false;
      }
    },
    onKeyDown(event) {
      if (window.isShouldScrollToBottom) {
        //输入键盘按钮追加scrollToBottom 事件
        if (this.$el.css('display') !== 'none') {
          this.throttleMarkRead();
          this.throttleMarkRead.flush();
        }
        window.isShouldScrollToBottom = false;
      }

      if (event.key !== 'Escape') {
        return;
      } else {
        if (!this.atView && this.threadView) {
          this.quitTopic();
        }
      }
    },

    insertMessage(message) {
      const textarea = this.$messageField[0];
      if (textarea.selectionStart || textarea.selectionStart === 0) {
        const startPos = textarea.selectionStart;
        const endPos = textarea.selectionEnd;

        textarea.value =
          textarea.value.substring(0, startPos) +
          message +
          textarea.value.substring(endPos, textarea.value.length);

        textarea.selectionStart = startPos + message.length;
        textarea.selectionEnd = startPos + message.length;
      } else {
        textarea.value += message;
      }

      window.autosize.update(this.$messageField);
      this.updateMessageFieldSize({});
      this.focusMessageField();
    },

    appendMessage(message) {
      const textarea = this.$messageField[0];
      textarea.value += message;

      window.autosize.update(this.$messageField);
      this.updateMessageFieldSize({});
      this.focusMessageField();
    },

    async setReplyMessage(message) {
      if (!this.view) {
        return;
      }

      if (message) {
        if (this.quoteHolder?.quotedMessage) {
          this.setQuoteMessage(null);
        }

        const reply = await this.model.makeQuote(message);

        if (!this.view) {
          return;
        }

        this.replyHolder = new Whisper.Message({
          conversationId: this.model.id,
          reply,
        });

        this.replyHolder.replyMessage = message;
        this.replyHolder.on(
          'scroll-to-message',
          this.scrollToMessage.bind(this)
        );
        this.replyHolder.getPropsFroReference = () =>
          this.replyHolder.getPropsForReply();
        this.replyHolder.clearReference = () => this.setReplyMessage(null);

        this.focusMessageFieldAndClearDisabled();
      } else {
        if (this.replyHolder) {
          this.view.restoreBottomOffset();
          this.updateMessageFieldSize({});
          this.replyHolder = null;
        }
      }

      this.replyView = this.renderReferenceMessage(
        this.replyView,
        this.replyHolder
      );
    },

    async setQuoteMessage(message) {
      if (!this.view) {
        return;
      }

      if (message) {
        if (this.replyHolder?.replyMessage) {
          this.setReplyMessage(null);
        }

        const quote = await this.model.makeQuote(message);
        if (!this.view) {
          return;
        }

        this.quoteHolder = new Whisper.Message({
          conversationId: this.model.id,
          quote,
        });

        this.quoteHolder.quotedMessage = message;
        this.quoteHolder.on(
          'scroll-to-message',
          this.scrollToMessage.bind(this)
        );
        this.quoteHolder.getPropsFroReference = () =>
          this.quoteHolder.getPropsForQuote();
        this.quoteHolder.clearReference = () => this.setQuoteMessage(null);

        this.focusMessageFieldAndClearDisabled();
      } else {
        if (this.quoteHolder) {
          this.view.restoreBottomOffset();
          this.updateMessageFieldSize({});
          this.quoteHolder = null;
        }
      }

      this.quoteView = this.renderReferenceMessage(
        this.quoteView,
        this.quoteHolder
      );
    },

    renderReferenceMessage(viewOfReference, holderOfReference) {
      if (viewOfReference) {
        viewOfReference.remove();
        viewOfReference = null;
      }

      if (!holderOfReference) {
        return null;
      }

      const getProps = () => {
        if (!holderOfReference) {
          return {};
        }

        const props = holderOfReference.getPropsFroReference();
        return Object.assign(props, {
          withContentAbove: true,
          onClose: () => holderOfReference.clearReference(),
        });
      };

      try {
        viewOfReference = new Whisper.ReactWrapperView({
          className: 'quote-wrapper',
          Component: window.Signal.Components.Quote,
          elCallback: el => this.$('.send').prepend(el),
          props: getProps(),
          onInitialRender: () => {
            this.view.restoreBottomOffset();
            this.updateMessageFieldSize({});
          },
        });
      } catch (error) {
        log.error('new reference view failed,', error);
        return null;
      }

      const { quotedMessage } = holderOfReference;
      const contact = quotedMessage?.getContact();
      if (contact) {
        holderOfReference.listenTo(
          contact,
          'change:name change:remarkName',
          () => viewOfReference?.update(getProps())
        );
      }

      return viewOfReference;
    },

    isAtUserMoreStar(number) {
      if (number !== MENTIONS_ALL_ID) {
        if (this.model.isPrivate()) {
          if (number !== this.model.ourNumber && number !== this.model.id) {
            return true;
          }
        } else {
          if (!this.model.isUserInGroup(number)) {
            return true;
          }
        }
      }
      return false;
    },

    chooseListenBack(number, name) {
      this.resetPanel();
      this.updateHeader();
      let atPersonId;
      if (number === MENTIONS_ALL_ID) {
        atPersonId = MENTIONS_ALL_ID;
      } else if (number) {
        atPersonId = number;
      } else {
        throw new Error('choose at person bad model.');
      }

      const moreStar = this.isAtUserMoreStar(number) ? '*' : '';
      this.insertMessage(`@${name}${moreStar} `);
      if (!this.atPersons) {
        this.atPersons = `${atPersonId}`;
      } else if (!this.atPersons.includes(`${atPersonId}`)) {
        this.atPersons += `;${atPersonId}`;
      }

      if (!this.atMentions) {
        this.atMentions = [];
      }
      this.atMentions.push({ uid: atPersonId, moreStar });
    },

    // 寻找第一个被@, 且是群成员bot
    getFirstAtBot(finalAtPersons) {
      if (!finalAtPersons) {
        return null;
      }

      const persons = finalAtPersons.split(';');

      for (const person of persons) {
        if (
          window.Signal.ID.isBotId(person) &&
          this.model.contactCollection.get(person)
        ) {
          return person;
        }
      }

      return null;
    },
    getFinalAtPersons(inputValues) {
      if (!inputValues) {
        return ['', []];
      }

      const getMatchString = (thePerson, moreStar) => {
        let matchString;
        if (thePerson === MENTIONS_ALL_ID) {
          matchString = `@${this.mentionsAll.getName()}`;
        } else {
          let model;
          if (this.model.isPrivate()) {
            model = ConversationController.get(thePerson);
          } else {
            model = this.model.getGroupContactModel(thePerson);
          }

          if (model) {
            //matchString = `@${model.getName()}${moreStar}`;
            matchString = `@${model.get('groupDisplayName')}${moreStar}`;
          }
        }
        return matchString;
      };

      let theFinalPersons = '';
      const persons = this.atPersons.split(';');
      persons.forEach(thePerson => {
        if (thePerson) {
          const moreStar = this.isAtUserMoreStar(thePerson) ? '*' : '';
          const matchString = getMatchString(thePerson, moreStar);
          if (matchString && inputValues.includes(matchString)) {
            theFinalPersons += `${thePerson};`;
          }
        }
      });

      theFinalPersons = theFinalPersons
        ? theFinalPersons.substring(0, theFinalPersons.length - 1)
        : '';

      const mentions = [];
      const userPosition = new Map();
      this.atMentions.forEach(item => {
        const { uid, moreStar } = item;
        if (moreStar === (this.isAtUserMoreStar(uid) ? '*' : '')) {
          const matchString = getMatchString(uid, moreStar);
          let pos = 0;
          if (userPosition.has(uid)) {
            pos = userPosition.get(uid);
          }
          const findPos = inputValues.indexOf(matchString, pos);
          if (matchString && findPos !== -1) {
            mentions.push({
              uid,
              start: findPos,
              length: matchString.length,
              type: moreStar ? 1 : 0,
            });
            userPosition.set(uid, findPos + matchString.length);
          }
        }
      });

      return [theFinalPersons, mentions];
    },
    stringLength(str) {
      let len = 0;
      let code = 0;
      for (let i = 0; i < str?.length; i++) {
        code = str.charCodeAt(i);
        if (code >= 0 && code <= 128) {
          len += 1;
        } else {
          len += 2;
        }
      }
      return len;
    },
    truncateForTopic(str) {
      if (this.stringLength(str) <= 128) {
        return str;
      } else {
        let truncated = '';
        let len = 0;
        for (let i = 0; i < str.length; i++) {
          len += this.stringLength(str[i]);
          if (len <= 128) {
            truncated += str[i];
          } else {
            break;
          }
        }
        return truncated;
      }
    },
    isMessageWithTopicCmd(message, hasAttachments) {
      // non-topic
      if (!message.toUpperCase().startsWith(CMD_TOPIC_HEADR)) {
        return false;
      }

      const headerLen = CMD_TOPIC_HEADR.length;

      // message has topic cmd header "/TOPIC "
      if (message.length > headerLen && message[headerLen] === ' ') {
        return true;
      }

      // attachments has topic cmd header
      if (message.length === headerLen && hasAttachments) {
        return true;
      }

      return false;
    },
    trimHeadTopicCmd(message) {
      // trim "/topic "
      return message.substring(CMD_TOPIC_HEADR.length + 1);
    },
    trimHeadFirstAtBot(message, firstBotName, hasAttachments) {
      if (!firstBotName) {
        return message;
      }

      // trim '@bot' if needed
      const trimed = message.trim();
      const atFirstBotName = '@' + firstBotName;
      if (trimed.startsWith(atFirstBotName)) {
        if (hasAttachments || trimed.length !== atFirstBotName.length) {
          return trimed.substring(atFirstBotName.length);
        } else {
          return atFirstBotName;
        }
      }

      return message;
    },
    getSourceBrief(hasAttachments, text) {
      if (hasAttachments && !text) {
        return i18n('shortForAttachment');
      }

      return this.truncateForTopic(text || '');
    },
    async getSendingThreadOptions(attachments, message, finalAtPersons) {
      // 只有是群的才会发threadContext 或者是topicContext
      if (this.model.isPrivate()) {
        return { message };
      }

      const firstAtBot = this.getFirstAtBot(finalAtPersons);
      const hasAttachments = !!attachments?.length;
      const hasTopicCmd = this.isMessageWithTopicCmd(message, hasAttachments);
      const hasReply = !!this.replyHolder;

      const baseThreadContext = {
        replyToUser: false,
        type: 1,
        supportType: 0,
        sourceDisplayName: '',
        groupName: '',
        groupId: this.model.id, //idV1
        topicCompatible: true,
      };

      let threadContext;
      let isUseTopicCommand = false;
      let isAtBotTopic = false;

      // "/TOPIC": must at main view without reply
      if (hasTopicCmd && !this.threadCollection && !hasReply) {
        isUseTopicCommand = true;

        message = this.trimHeadTopicCmd(message);

        threadContext = {
          ...baseThreadContext,
          botId: '',
          topicId: window.getGuid(),
          sourceBrief: this.getSourceBrief(hasAttachments, message),
        };
      } else if (firstAtBot && !this.threadCollection) {
        //group@bot topic
        isAtBotTopic = true;

        const botModel = this.model.getGroupContactModel(firstAtBot);
        const firstBotName = botModel.getName();

        message = this.trimHeadFirstAtBot(
          message,
          firstBotName,
          hasAttachments
        );

        threadContext = {
          ...baseThreadContext,
          botId: firstAtBot,
          topicId: window.getGuid(),
          sourceBrief: this.getSourceBrief(hasAttachments, message),
        };
      } else {
        // normal message
        // replied message in main view
        if (hasReply && !this.threadCollection) {
          const reply = this.replyHolder.get('reply');
          const { replyMessage } = this.replyHolder;

          const replyThreadContext = replyMessage.get('threadContext');
          if (replyThreadContext) {
            // replied message already in thread
            threadContext = _lodash.cloneDeep(replyThreadContext);
          } else {
            // 给无topic的旧消息加topic
            if (hasTopicCmd && !this.threadCollection) {
              message = this.trimHeadTopicCmd(message);
            }

            const realSource = {
              timestamp: replyMessage.get('sent_at'),
              source: replyMessage.getSource(),
              sourceDevice: replyMessage.getSourceDevice(),
            };

            const threadId = replyMessage.makeThreadIdByRealSource(realSource);

            const replyHasAttachment = !!reply.attachments?.length;
            const replyText = reply.text;

            threadContext = {
              ...baseThreadContext,
              source: realSource,
              botId: '',
              topicId: threadId,
              sourceBrief: this.getSourceBrief(replyHasAttachment, replyText),
            };

            replyMessage.set({
              threadId,
              threadReplied: true,
              firstMessageTopicFlag: true,
              threadContext: _lodash.cloneDeep(threadContext),
            });

            await window.Signal.Data.saveMessage(replyMessage.attributes, {
              Message: Whisper.Message,
            });
          }
        } else if (this.threadCollection) {
          // send thread message in thread view
          const {
            threadId,
            threadContext: existThreadContext,
            botContext,
            replyToUser,
          } = this.threadCollection;

          this.model.markAllRelatedReplied(threadId);

          // 这里判断threadContext中是否有topicId来判断是从旧版本发起的topic还是新版本
          //    从而在新版本回复时是否需要设置compatible
          // 新版本DMTopic 和atbotTopic在支持群回复，
          //    只要有botConText和threadConText，ze回复时两者都要发
          threadContext = {
            ...existThreadContext,
            replyToUser: replyToUser,
            threadCompatible: this.model.getThreadCompatible(
              existThreadContext,
              botContext
            ),
            topicCompatible: this.model.getTopicCompatible(existThreadContext),
          };
        } else {
          // normal message
        }
      }

      return {
        message: message.trim(),
        threadContext: threadContext,
        isUseTopicCommand: isUseTopicCommand,
        isAtBotTopic: isAtBotTopic,
      };
    },
    async sendMessage(e) {
      e.preventDefault();
      this.sendStart = Date.now();
      this.$messageField.prop('disabled', true);

      const input = this.$messageField;
      const originalMessage = input.val().trim();

      this.removeLastSeenIndicator();
      this.closeEmoji();

      await this.scrollToBottom();

      let toast;
      if (extension.expired()) {
        toast = new Whisper.ExpiredToast();
      }

      if (!this.model.isPrivate() && this.model.isMeLeftGroup()) {
        toast = new Whisper.LeftGroupToast();
      }

      if (!toast && !this.model.isMeCanSpeak()) {
        this.showUnspeakToast();
        this.focusMessageFieldAndClearDisabled();
        return;
      }

      try {
        if (!toast) {
          if (!originalMessage.length && !this.fileInput.hasFiles()) {
            if (!this.quoteHolder) {
              return;
            }

            toast = new Whisper.MessageCannotBeEmptyWhenQuote();
          }
        }

        if (toast) {
          toast.$el.appendTo(this.$el);
          toast.render();
          this.focusMessageFieldAndClearDisabled();
          return;
        }

        const attachments = await this.fileInput.getFiles();
        const atPersons = this.getFinalAtPersons(originalMessage);

        const { message, threadContext, isUseTopicCommand, isAtBotTopic } =
          await this.getSendingThreadOptions(
            attachments,
            originalMessage,
            atPersons[0]
          );

        // 由于 at bot topic 会改变body内容，所以需要重新生成 mentions 字段
        if (isUseTopicCommand || isAtBotTopic) {
          const tempAtPersons = this.getFinalAtPersons(message);
          atPersons[1] = tempAtPersons[1];
        }

        const sendDelta = Date.now() - this.sendStart;
        window.log.info('Send pre-checks took', sendDelta, 'milliseconds');

        // wait for a little milliseconds
        // to make sure every message has different sent_at timestamp
        await new Promise(r => setTimeout(r, 5));

        const quote = this.quoteHolder?.get('quote');

        if (attachments instanceof Array && attachments.length > 0) {
          const promises = [];
          for (let i = 0; i < attachments.length; i++) {
            const attachment = attachments[i];
            promises.push(
              this.model.sendMessage(
                '',
                null,
                null,
                [attachment],
                quote,
                null,
                null,
                null,
                null,
                {
                  threadContext,
                  isUseTopicCommand: i === 0 && isUseTopicCommand,
                  isAtBotTopic: i === 0 && isAtBotTopic,
                }
              )
            );
            await new Promise(r => setTimeout(r, 100));
          }

          if (message) {
            this.model.sendMessage(
              message,
              atPersons[0],
              atPersons[1],
              [],
              quote,
              null,
              null,
              null,
              null,
              {
                threadContext,
                isUseTopicCommand: false,
                isAtBotTopic: false,
              }
            );
          }
        } else {
          this.model.sendMessage(
            message,
            atPersons[0],
            atPersons[1],
            attachments,
            quote,
            null,
            null,
            null,
            null,
            {
              threadContext,
              isUseTopicCommand,
              isAtBotTopic,
            }
          );
        }

        input.val('');
        this.atPersons = '';
        this.atMentions = [];

        this.setQuoteMessage(null);
        this.setReplyMessage(null);

        this.focusMessageFieldAndClearDisabled();
        this.forceUpdateMessageFieldSize(e);
        this.fileInput?.clearAttachments();
      } catch (error) {
        window.log.error(
          'Error pulling attached files before send',
          error && error.stack ? error.stack : error
        );

        const toast = new Whisper.PullingAttachmentErrorToast();
        toast.$el.appendTo(this.$el);
        toast.render();
      } finally {
        if (this.threadView && window.Events.getQuitTopicSetting()) {
          setTimeout(() => {
            this.quitTopic();
          }, 100);
        }
        this.focusMessageFieldAndClearDisabled();
      }
    },

    // Called whenever the user changes the message composition field. But only
    //   fires if there's content in the message field after the change.
    maybeBumpTyping() {
      if (this.finishSelectAtPerson) {
        this.finishSelectAtPerson = false;
        return;
      }
      const messageText = this.$messageField.val();
      if (messageText.length) {
        this.updateAtView();
      }
    },

    choosePersonFilter(c, searchTerm) {
      if (!searchTerm) {
        return true;
      }

      const search = searchTerm.toLowerCase();
      const cachedProps = c.format ? c.format() : c;
      let name = cachedProps.id;
      if (name && name.toLowerCase().includes(search)) {
        let idMatchSearch = search;
        if (!search.startsWith('+')) {
          idMatchSearch = '+' + search;
        }
        if (name.startsWith(idMatchSearch)) {
          return true;
        }
      }

      name = cachedProps.name;
      if (name && name.toLowerCase().includes(search)) {
        return true;
      }

      name = cachedProps.email;
      if (name && name.toLowerCase().includes(search)) {
        if (name.startsWith(search)) {
          return true;
        }
      }

      return false;
    },

    // 判断是否应该弹出@选择框
    getAtPersonSubString() {
      if (!this.$messageField) {
        return;
      }

      const messageText = this.$messageField.val();
      const startPos = this.$messageField[0].selectionStart;
      if (!messageText.includes('@')) {
        return;
      }

      let atPos = undefined;
      for (let i = startPos - 1; i >= 0; i -= 1) {
        if (messageText[i] === '@') {
          atPos = i;
          break;
        }
      }

      if (atPos === undefined) {
        return;
      }

      // @前面是英文时不触发弹窗
      if (atPos && messageText[atPos - 1].match(/[a-z]/i)) {
        return;
      }

      let sub = '';
      if (atPos + 1 < startPos) {
        sub = messageText.substring(atPos + 1, startPos);
      }

      if (sub.length > 12) {
        return;
      }

      // 解决@All后还匹配到人的问题，先硬编码忽略
      if (sub.startsWith('All ')) {
        return;
      }

      return sub;
    },

    updateAtView() {
      if (!this.$messageField) {
        return;
      }

      const sub = this.getAtPersonSubString();
      if (sub === undefined) {
        if (this.atView) {
          this.atView.remove();
          this.atView = null;
        }
        return;
      }

      const atPersonsProps = this.getNewAtPersonProps(sub);
      if (
        atPersonsProps.contacts.length === 0 &&
        atPersonsProps.allContacts.length === 0
      ) {
        if (this.atView) {
          this.atView.remove();
          this.atView = null;
        }
        return;
      }
      if (!this.atView) {
        this.newAtPersonChoose(atPersonsProps);
      } else {
        this.atView.update(atPersonsProps);
      }
    },

    getNewAtPersonProps(filter) {
      const contacts = [];
      const contactIds = new Set();
      const privateUsers = [];
      if (!this.model.isPrivate()) {
        if (!filter) {
          contacts.push({ id: MENTIONS_ALL_ID });
        } else {
          const allTitle = i18n('mentionsAllTitle').toLowerCase();
          const filterTitle = filter.toLowerCase();
          if (allTitle.includes(filterTitle)) {
            contacts.push({ id: MENTIONS_ALL_ID });
          }
        }

        const groupMembers = this.model.contactCollection.clone();
        if (groupMembers && groupMembers.models instanceof Array) {
          groupMembers.forEach(member => {
            // if (member.isMe()) {
            //   return;
            // }

            if (this.choosePersonFilter(member, filter)) {
              const cachedProps = member.format();
              contacts.push({ ...cachedProps });
              contactIds.add(cachedProps.id);
            }
          });
        }
      } else {
        privateUsers.push(this.model.ourNumber);
        privateUsers.push(this.model.id);
      }

      return {
        allContacts: [],
        privateUsers,
        i18n,
        contacts,
        doSelect: id => {
          // 选中之前的筛选条件
          const messageText = this.$messageField.val();
          const startPos = this.$messageField[0].selectionStart;
          if (!messageText.includes('@')) {
            this.atView.remove();
            this.atView = null;
            return;
          }

          let atPos = undefined;
          for (let i = startPos - 1; i >= 0; i -= 1) {
            if (messageText[i] === '@') {
              atPos = i;
              break;
            }
          }

          if (atPos === undefined) {
            return;
          }

          this.$messageField[0].setSelectionRange(
            atPos,
            this.$messageField[0].selectionStart
          );

          if (id === MENTIONS_ALL_ID) {
            this.chooseListenBack(id, i18n('mentionsAllTitle'));
          } else {
            let model;
            if (this.model.isPrivate()) {
              model = ConversationController.get(id);
            } else {
              model = this.model.getGroupContactModel(id);
            }
            if (model) {
              //this.chooseListenBack(id, model.getName() || id);
              this.chooseListenBack(id, model.get('groupDisplayName'));
            } else {
              log.error('model not found for ', id);
            }
          }

          this.finishSelectAtPerson = true;

          this.atView?.remove();
          this.atView = null;
        },
        onClose: esc => {
          this.atView?.remove();
          this.atView = null;
          if (esc) {
            this.inputEscMode = true;
          }
        },
        onCloseAndEnter: () => {
          this.atView?.remove();
          this.atView = null;
          this.insertMessage('\n');
        },
      };
    },

    newAtPersonChoose(atPersonsProps) {
      if (this.model.isPrivate()) {
        return;
      }
      if (this.inputEscMode) {
        return;
      }
      if (this.finishSelectAtPerson) {
        this.finishSelectAtPerson = false;
        return;
      }
      if (this.atView) {
        this.atView.remove();
      }

      this.atView = new Whisper.ReactWrapperView({
        className: 'at-person-choose-wrapper',
        Component: window.Signal.Components.AtPersonSelect,
        props: atPersonsProps || this.getNewAtPersonProps(),
      });
      this.$('.discussion-container').append(this.atView.el);
    },

    updateMessageFieldSize(event) {
      const keyCode = event.which || event.keyCode;

      if (this.atView && (keyCode === 13 || keyCode === 38 || keyCode === 40)) {
        event.preventDefault();
        return;
      }

      if (
        keyCode === 13 &&
        !event.altKey &&
        !event.shiftKey &&
        !event.ctrlKey
      ) {
        this.inputEscMode = false;
        // enter pressed - submit the form now
        event.preventDefault();
        this.$('.bottom-bar form').trigger('submit');
        return;
      }
      this.toggleMicrophone();

      //if (!this.model.isPrivate()) {
      if (event.key === '@') {
        // event.preventDefault();
        // event.stopPropagation();
        // const input = this.$messageField;
        // input.blur();

        this.inputEscMode = false;
        this.newAtPersonChoose();
      }

      this.view.measureScrollPosition();
      window.autosize(this.$messageField);

      const $attachmentPreviews = this.$('.attachment-previews');
      const $bottomBar = this.$('.bottom-bar');
      const includeMargin = true;
      const quoteHeight = this.quoteView
        ? this.quoteView.$el.outerHeight(includeMargin)
        : this.replyView
          ? this.replyView.$el.outerHeight(includeMargin)
          : 0;

      const height =
        this.$messageField.outerHeight() +
        $attachmentPreviews.outerHeight() +
        quoteHeight +
        parseInt($bottomBar.css('min-height'), 10);

      $bottomBar.outerHeight(height);

      this.view.scrollToBottomIfNeeded();
    },

    forceUpdateMessageFieldSize(event) {
      if (!this.view || this.isHidden()) {
        return;
      }

      this.view.scrollToBottomIfNeeded();
      window.autosize.update(this.$messageField);
      this.updateMessageFieldSize(event);
    },

    isHidden() {
      return (
        this.$el.css('display') === 'none' ||
        this.$('.panel').css('display') === 'none'
      );
    },

    isMessageViewHidden() {
      return (
        this.isHidden() ||
        Boolean(this.panels && this.panels.length) ||
        this.loadingView ||
        this.loadingScreen
      );
    },

    // ids [{id:id, type:type}]
    async forwardTo({ conversationIds, messages, isMerged }) {
      if (!(conversationIds instanceof Array) || !conversationIds.length) {
        log.error('destination conversationIds is invalid or empty.');
        return;
      }

      const sendToConversations = async (
        body,
        attachments,
        forwardContext,
        contacts
      ) => {
        for (let id of conversationIds) {
          const conversation = ConversationController.get(id);
          if (conversation) {
            await conversation.forceSendMessageAuto(
              body || '',
              null,
              [],
              attachments,
              null,
              null,
              forwardContext,
              contacts,
              null,
              null
            );
          } else {
            log.error('conversation not found for id:', id);
          }
        }
      };

      const makeForwardAndSend = async messages => {
        const forwardContext = await this.model.makeForwardContext(messages);
        const body = '[Unsupported message type]';
        await sendToConversations(body, null, forwardContext);
      };

      const forwardWhisperMessage = async message => {
        const forwardContext = message.get('forwardContext') || {};
        const forwards = forwardContext.forwards || [];
        const contacts = message.get('contacts') || [];

        if (forwards.length > 0 || contacts.length > 0) {
          // copy forward, should include message itself layer
          const maxLayer = textsecure.MAX_FORWARD_DEPTH + 1;
          const attachments = message.get('attachments') || [];

          await sendToConversations(
            message.get('body') || '',
            await Promise.all(attachments.map(loadAttachmentData)),
            forwards.length > 0
              ? {
                  ...forwardContext,
                  forwards: await this.model.getForwardedForwards(
                    forwards,
                    1,
                    maxLayer
                  ),
                }
              : null,
            contacts
          );
        } else {
          await makeForwardAndSend([message]);
        }
      };

      if (isMerged && messages.length > 1) {
        await makeForwardAndSend(messages);
      } else {
        for (let message of messages) {
          if (message instanceof Whisper.Message) {
            await forwardWhisperMessage(message);
          } else if (typeof message === 'string') {
            await sendToConversations(message);
          }
        }
      }
    },

    addSelected(message) {
      if (!message.isForwardable()) {
        // cannot be forward
        // return true to indicate can continue next one
        return true;
      }

      const threadId = this.threadCollection?.threadId;
      if (threadId && threadId !== message.get('threadId')) {
        // thread mode, but not current thread message, just skipping
        return true;
      }

      if (!message.isSelected) {
        if (this.selectedMessages.length >= MAX_SELECTION_COUNT) {
          const toast = new Whisper.ExceedingMaxNumberOfSelectionToast();
          toast.$el.appendTo(this.$el);
          toast.render();
          return false;
        }

        message.isSelected = true;
        message.trigger('change');
      }

      this.selectedMessages.add(message, { sort: false });
      return true;
    },

    removeUnselected(message) {
      if (message.isSelected) {
        message.isSelected = false;
        message.trigger('change');
      }

      this.selectedMessages.remove(message);
      return true;
    },

    messageSelectionChanged(message, selected, shiftKey) {
      const messageCollection = this.model.messageCollection;
      const currIndex = messageCollection.indexOf(message);
      if (currIndex === -1) {
        log.warn(
          'message was not found in message collection:',
          message.idForLogging()
        );
        return;
      }

      let prevIndex = currIndex;
      let nextStep = index => index + 1;
      let shouldStop = index => index > currIndex;

      if (this.prevClickedMessage && shiftKey) {
        const prevClickedIndex = messageCollection.indexOf(
          this.prevClickedMessage
        );
        if (prevClickedIndex != -1) {
          prevIndex = prevClickedIndex;
          if (currIndex < prevIndex) {
            nextStep = index => index - 1;
            shouldStop = index => index < currIndex;
          }
        }
      }

      const selectedChange = selected
        ? this.addSelected
        : this.removeUnselected;

      for (let index = prevIndex; !shouldStop(index); index = nextStep(index)) {
        if (!selectedChange.call(this, messageCollection.at(index))) {
          break;
        }
      }

      this.updateSelectionBar({
        isDisabled: this.selectedMessages.length < 1,
      });

      this.prevClickedMessage = message;
    },

    updateSelectionBar(options = {}) {
      const barProps = {
        onForwardTo: (conversationIds, isMerged) => {
          if (!this.selectedMessages) {
            return;
          }

          this.selectedMessages.sort();
          this.forwardTo({
            conversationIds,
            messages: this.selectedMessages.models,
            isMerged,
          });
        },
        onCancel: () => this.multiSelectingModeChange(false),
        open: this.isSelecting,
        ourNumber: this.model.ourNumber,
        isDisabled: options.isDisabled,
        selectedCount: this.selectedMessages.length,
        maxSelectionCount: MAX_SELECTION_COUNT,
      };

      if (!this.selectActionBar) {
        this.selectActionBar = new Whisper.ReactWrapperView({
          className: 'select-action-bar-wrapper',
          Component: window.Signal.Components.SelectActionBar,
          props: barProps,
        });

        this.$('.select-action-bar-container').append(this.selectActionBar.el);
      }

      this.selectActionBar.update(barProps);
    },

    async multiSelectingModeChange(isSelecting, message) {
      this.isSelecting = isSelecting;

      this.updateSelectionBar({ isDisabled: true });

      const initialSelection = model => {
        const initialModelSelection = m => {
          const threadId = this.threadCollection?.threadId;
          if (threadId && threadId !== m.get('threadId')) {
            // thread mode, not current thread message, just skipping
            return;
          }

          m.isSelected = false;
          m.isSelectingMode = this.isSelecting;
          m.trigger('change');
        };

        if (model instanceof Array) {
          model.forEach(initialModelSelection);
        } else {
          initialModelSelection(model);
        }
      };

      if (isSelecting) {
        this.$('.compose').hide();
        if (this.fileInput.hasFiles()) {
          this.$('.attachment-list').hide();
        }

        this.listenTo(this.model.messageCollection, 'add', initialSelection);
      } else {
        this.$('.compose').show();
        if (this.fileInput.hasFiles()) {
          this.$('.attachment-list').show();
        }

        this.stopListening(
          this.model.messageCollection,
          'add',
          initialSelection
        );
      }

      this.selectedMessages.reset();

      // clear selection state
      initialSelection(this.model.messageCollection.models);

      // set this message as selected default
      if (message) {
        this.messageSelectionChanged(message, true);
      }
    },

    async onCopyImage(attachment) {
      await window.copyImage(attachment, loadAttachmentData);
      this.focusMessageField();
    },

    onShowThread(message) {
      const threadId =
        message.get('threadId') || message.get('threadContext')?.topicId;

      if (!threadId) {
        log.error(
          'message has no threadId',
          this.model.idForLogging(),
          message.idForLogging()
        );
        return;
      }

      log.info(
        'onShowThread begin',
        this.model.idForLogging(),
        threadId,
        message.idForLogging()
      );

      this.showLoadingScreen();

      // clear loaded messages
      if (!this.model.messageCollection.includes(message)) {
        this.model.messageCollection.reset([]);
      }

      const messages = this.model.messageCollection.where({ threadId });
      const collection = new Whisper.MessageCollection(messages);
      collection.listenTo(
        this.model.messageCollection,
        'update',
        (_, options) => {
          if (options.add) {
            const { added } = options.changes;
            const filtered = added.filter(m => m.get('threadId') === threadId);
            if (filtered.length > 0) {
              collection.add(filtered, options);
            }
          }
        }
      );

      collection.listenTo(this.model, 'messageThreadIdChanged', model => {
        if (model.get('threadId') === threadId) {
          if (this.model.messageCollection.indexOf(model) === -1) {
            this.model.messageCollection.addNewMessage(
              MessageController.register(model.id, model)
            );
          } else {
            collection.add(model);
          }
        }
      });

      collection.listenTo(
        this.model.messageCollection,
        'reset-thread',
        (models, options) => collection.reset(models, options)
      );

      collection.threadContext = message.get('threadContext');
      collection.botContext = message.get('botContext');
      collection.replyTopicMessageHeader =
        message.get('threadContext')?.sourceBrief;
      collection.threadId = threadId;

      this.threadCollection = collection;

      this.model.messageCollection.setThread(threadId);

      if (this.view) {
        this.$('.main-list').hide();
      }

      this.setQuoteMessage(null);
      this.focusMessageField();
      this.threadView = new Whisper.MessageListView({
        className: 'message-list thread-list',
        collection,
        window: this.window,
        listMode: 'thread',
      });

      this.view = this.threadView;

      //this.$('.create-topic-list').hide();
      this.$('.change-translation').hide();

      this.$('.switch-reply-mode').show();

      this.$('.discussion-container').append(this.threadView.el);

      this.removeMentionsJumpButton();
      this.removeScrollDownButton();

      setTimeout(async () => {
        if (this.threadView) {
          this.model.trigger('threadModeChange');
          await this.threadView.renderList();
        }

        await this.scrollToMessage({
          author: message.getSource(),
          id: message.get('sent_at'),
          scrollIntoViewOptions: {
            block: 'center',
          },
        });

        this.removeLoadingScreen();

        // if messages was not full of current view
        if (this.isOnlyOneScreen()) {
          // try to fetch newer messages
          window.log.info(
            'showThread: only one screen, try to load more newer'
          );

          await this.loadMoreMessagesAndWaitRender(false);
        }

        log.info('onShowThread done', this.model.idForLogging(), threadId);
      }, 0);

      this.headerTitleStack.push(this.headerTitle);
      this.onGoBackStack.push(this.onGoBack);

      const genThreadTitle = () => {
        const threadProps = message.getPropsForThread();
        const title = i18n('topicFrom');
        if (threadProps.topicId) {
          if (
            threadProps.botId &&
            threadProps.quotedUser.groupId &&
            threadProps.supportType === 1
          ) {
            // @bot 支持群标题
            return (
              title +
              threadProps.groupName +
              '/' +
              threadProps.quotedUser.authorName +
              ' - ' +
              message.get('threadContext').sourceBrief
            );
          } else if (!threadProps.quotedUser.groupId) {
            return title + threadProps.quotedUser.authorName;
          } else {
            // group topic 标题 || @bot 问题群标题
            return (
              title +
              threadProps.quotedUser.authorName +
              ' - ' +
              message.get('threadContext').sourceBrief
            );
          }
        }
        return title + threadProps.quotedUser.authorName;
      };

      this.headerTitle = genThreadTitle();

      // this.quitTopic();
      this.updateHeader({
        headerTitle: this.headerTitle,
        onGoBack: () => {
          this.quitTopic(message);
        },
        showGroupEditButton: false,
        showGroupSaveButton: false,
      });
      if (this.replyButtonView) {
        this.replyButtonView.remove();
      }
      if (
        (this.threadCollection.threadContext.replyToUser &&
          this.threadCollection.threadContext.supportType === 1) ||
        (this.threadCollection.threadContext.botId &&
          this.threadCollection.threadContext.supportType === 1) ||
        (this.threadCollection.threadContext.botId &&
          this.threadCollection.threadContext.supportType === undefined)
      ) {
        this.onSwitchReplyMode();
      }
    },
    quitTopic(message) {
      if (!this.threadView) {
        return;
      }

      if (this.isSelecting) {
        this.multiSelectingModeChange(false);
      }
      this.threadCollection.stopListening();
      this.threadCollection = null;
      this.resetPanel();

      this.setQuoteMessage(null);

      this.updateUnreadMentions();

      this.model.messageCollection.clearThread();

      this.model.trigger('threadModeChange');

      //this.$('.create-topic-list').show();
      this.$('.change-translation').show();

      this.$('.switch-reply-mode').hide();
      this.$('.thread-list').hide();

      this.view = this.mainView;

      const view = this.threadView;
      this.threadView = null;
      setTimeout(() => view.remove(), 0);

      if (this.topicListDialog) {
        this.topicListDialog.remove();
        this.topicListDialog = null;
      }

      this.$('.main-list').show();

      if (message) {
        setTimeout(async () => {
          await this.scrollToMessage({
            author: message.getSource(),
            id: message.get('sent_at'),
            scrollIntoViewOptions: {
              block: 'nearest',
            },
          });

          // try to reset ScrollDownButton and others
          this.view?.onScroll();
        }, 0);
      }

      this.headerTitle = this.headerTitleStack.pop();
      this.onGoBack = this.onGoBackStack.pop();

      this.updateHeader({
        headerTitle: this.headerTitle,
        showGroupEditButton: false,
        showGroupSaveButton: false,
        // onGoBack: this.defaultOnGoBack,
        onGoBack: this.onGoBack,
      });
    },
    quitTopicByEsc(event) {
      if (event.key !== 'Escape') {
        return;
      } else {
        if (!this.atView && this.threadView) {
          this.quitTopic();
        }
      }
    },
    async onSwitchReplyMode() {
      if (this.threadCollection) {
        this.threadCollection.replyToUser = !this.threadCollection.replyToUser;
        // this.$('.switch-mode').toggleClass('mode-on', this.threadCollection.replyToUser);

        if (this.replyButtonView) {
          this.replyButtonView.remove();
        }
        if (this.threadCollection.replyToUser) {
          this.replyButtonView = new Whisper.ReactWrapperView({
            Component: window.Signal.Components.VisibleReplyButton,
            props: {
              i18n,
            },
          });
        } else {
          this.replyButtonView = new Whisper.ReactWrapperView({
            Component: window.Signal.Components.InVisibleReplyButton,
            props: {
              i18n,
            },
          });
        }
        this.$('.switch-reply-mode').append(this.replyButtonView.el);
      }
      this.model.trigger('threadModeChange');
    },
    async onThreadReply(message) {
      if (!message.get('threadContext').topicId) {
        message.threadId = await message.makeThreadId(
          message.get('threadContext')
        );
      }
      this.onShowThread(message);
      // this.setQuoteMessage(message);
    },

    getPlaceholderForMessageField() {
      const conversationName = this.model.getDisplayName();

      const threadProps = this.getThreadProps();
      if (!threadProps) {
        return conversationName;
      }

      const { quotedUser, topicId, replyTopicMessageHeader } = threadProps;
      const { authorName } = quotedUser || {};

      // old thread placeholder
      if (this.threadCollection?.replyToUser && !topicId) {
        return authorName + ' & ' + conversationName;
      }

      // new topic placeholder
      if (topicId) {
        return this.truncateForTopic(replyTopicMessageHeader || authorName);
      }

      return conversationName;
    },

    getThreadProps() {
      if (this.threadCollection?.length) {
        return this.threadCollection.at(0).getPropsForThread();
      }
    },

    async fetchConversationSettingsIfNeeded() {
      if (!this.model.syncedConfig) {
        try {
          await this.model.apiGetConfig();
          this.model.syncedConfig = true;
        } catch (error) {
          window.log.info('fetchConversationSettingsIfNeeded failed.', error);
        }
      }
    },

    messageBodySizeCheck(event) {
      const value = event?.target?.value;
      if (!value?.length) {
        return;
      }
      let byte = 0;
      let result = '';
      let toastFlag = false;
      for (let i = 0; i < value.length; i++) {
        if (value.charCodeAt(i) > 255) {
          byte += 2;
        } else {
          byte++;
        }
        if (byte <= MAX_MESSAGE_BODY_SIZE) {
          result += value[i];
        } else {
          toastFlag = true;
        }
      }
      event.target.value = result;
      if (toastFlag) {
        const toast = new Whisper.MessageBodyTooLongToast();
        toast.$el.appendTo(this.$el);
        toast.render();
        this.focusMessageFieldAndClearDisabled();
      }
    },

    onInputChange(event) {
      this.updateMessageFieldSize(event);
      this.updateAtView();
      this.messageBodySizeCheck(event);
    },

    async saveDraft() {
      if (!this.$messageField) {
        return;
      }

      const inputValue = this.$messageField.val();
      const trimmed = inputValue?.trim() || '';
      const drafted = this.model.get('draft') || '';
      const isArchived = this.model.get('isArchived');

      if (drafted !== trimmed) {
        if (!isArchived || (isArchived && trimmed !== '')) {
          const { quotedMessage } = this.quoteHolder || {};

          this.model.set({
            isArchived: false,
            draft: trimmed,
            draftAtPersons: this.atPersons,
            draftAtMentions: this.atMentions,
            draftQuotedMessageId: trimmed ? quotedMessage?.id : null,
            active_at: trimmed ? Date.now() : this.model.get('timestamp'),
          });
          await window.Signal.Data.updateConversation(this.model.attributes);

          this.model.debouncedUpdateLastMessage();
        }
      }
    },

    async restoreDraft() {
      const draft = this.model.get('draft');
      if (draft) {
        this.appendMessage(draft);
      }

      const draftQuotedMessageId = this.model.get('draftQuotedMessageId');
      if (draftQuotedMessageId) {
        const message = await this.findMessage(draftQuotedMessageId);
        if (message) {
          this.setQuoteMessage(message);
        }
      }

      const draftAtPersons = this.model.get('draftAtPersons');
      if (draftAtPersons) {
        this.atPersons = draftAtPersons;
      }

      const draftAtMentions = this.model.get('draftAtMentions');
      if (draftAtMentions) {
        this.atMentions = draftAtMentions;
      }
    },

    async updateUnreadMentions() {
      if (this.model.isPrivate()) {
        return;
      }

      const lastReadPosition = await this.model.getLastReadPosition();
      const maxServerTimestamp = lastReadPosition?.maxServerTimestamp;
      if (!maxServerTimestamp) {
        this.removeMentionsJumpButton();
        return;
      }

      // get unread Mentions count
      const unreadMentionsCount =
        await window.Signal.Data.getMentionsYouMessageCount(
          this.model.id,
          maxServerTimestamp
        );

      const lastNextMentionsYouMessage = this.nextMentionsYouMessage;

      if (!unreadMentionsCount) {
        this.removeMentionsJumpButton();
        this.nextMentionsYouMessage = null;
      } else {
        this.updateMentionsJumpButton(unreadMentionsCount, true);
        await this.updateNextMetionsYouMessage(maxServerTimestamp);
      }

      if (lastNextMentionsYouMessage != this.nextMentionsYouMessage) {
        this.model.debouncedUpdateLastMessage();
      }
    },

    async updateNextMetionsYouMessage(maxServerTimestamp) {
      if (this.inProgressFetch) {
        try {
          await this.inProgressFetch;
        } catch (error) {
          log.warn(
            'failed to load message',
            Errors.toLogFormat(error),
            this.model.idForLogging()
          );
        }
      }

      this.nextMentionsYouMessage = null;
      for (const message of this.model.messageCollection.models) {
        if (
          message.isMentionsYouOrAll() &&
          message.isIncoming() &&
          !(await message.isIncomingMessageRead())
        ) {
          this.nextMentionsYouMessage = message;
          break;
        }
      }

      if (!this.nextMentionsYouMessage) {
        const mentionsYouMessages =
          await window.Signal.Data.getMentionsYouMessage(this.model.id, {
            Message: Whisper.Message,
            serverTimestamp: maxServerTimestamp,
            limit: 1,
          });
        if (mentionsYouMessages?.length) {
          this.nextMentionsYouMessage = mentionsYouMessages[0];
        }
      }
    },

    async scrollToNextMentionsYou() {
      if (!this.nextMentionsYouMessage) {
        return;
      }

      const source = this.nextMentionsYouMessage.getSource();
      const timestamp = this.nextMentionsYouMessage.get('sent_at');

      await this.scrollToMessage({ author: source, id: timestamp });

      this.throttleMarkRead();
      this.throttleMarkRead.flush();
    },
    showMessageInSeparateView(data) {
      window.showMessageInSeparateView(data);
    },
  });
})();
