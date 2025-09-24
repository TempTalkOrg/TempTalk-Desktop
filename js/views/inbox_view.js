// /* global
//   $,
//   ConversationController,
//   extension,
//   getConversations,
//   getInboxCollection,
//   i18n,
//   Whisper,
//   textsecure,
//   Signal
//
// */

// eslint-disable-next-line func-names
(function () {
  'use strict';

  const { APIStatus } = window.Signal.Types;

  window.Whisper = window.Whisper || {};

  Whisper.ConversationStack = Whisper.View.extend({
    className: 'conversation-stack',
    open(conversation, messageId) {
      const id = `conversation-${conversation.cid}`;
      if (id !== this.el.firstChild.id) {
        this.$el
          .first()
          .find('video, audio')
          .each(function pauseMedia() {
            this.pause();
          });
        let $el = this.$(`#${id}`);
        if ($el === null || $el.length === 0) {
          const view = new Whisper.ConversationView({
            model: conversation,
            window: this.model.window,
          });
          // eslint-disable-next-line prefer-destructuring
          $el = view.$el;
        }
        $el.prependTo(this.el);
      }
      conversation.trigger('opened', messageId);
    },
  });

  Whisper.AllBotsView = Whisper.View.extend({
    className: 'contact-column-detail',
    initialize() {
      this.titleView = new Whisper.ReactWrapperView({
        className: 'title-wrapper',
        Component: window.Signal.Components.CommonHeader,
        props: {
          name: i18n('allBotsTitle'),
          i18n: i18n,
        },
      });
      this.$el.append(this.titleView.el);

      this.botCollect = new Whisper.ReactWrapperView({
        className: 'react-contact-list',
        Component: window.Signal.Components.BotContactCollect,
        props: {
          isCommon: true,
          i18n,
          contacts: this.getAllBot().map(c => c.cachedProps),
        },
      });
      this.$el.append(this.botCollect.el);

      this.titleView.$el.hide();
      this.botCollect.$el.hide();
      this.$('.container').show();
    },
    open() {
      this.titleView.$el.show();
      this.botCollect.$el.show();
      this.$('.container').hide();
    },
    close() {
      this.titleView.$el.hide();
      this.botCollect.$el.hide();
      this.$('.container').show();
    },
    getAllBot() {
      this.convoBotCollection = getAllBot();
      const botContacts = this.convoBotCollection.sort((a, b) => {
        return a.cachedProps.name
          .trim()
          .localeCompare(b.cachedProps.name.trim());
      });
      return botContacts;
    },
  });

  Whisper.GroupChatsView = Whisper.View.extend({
    className: 'contact-column-detail',
    initialize() {
      this.titleView = new Whisper.ReactWrapperView({
        className: 'title-wrapper',
        Component: window.Signal.Components.CommonHeader,
        props: {
          name: i18n('groupChatsTitle'),
          i18n: i18n,
        },
      });
      this.$el.append(this.titleView.el);

      const collator = new Intl.Collator();
      const comparator = (left, right) => {
        const leftLower = left.getName().toLowerCase();
        const rightLower = right.getName().toLowerCase();
        return collator.compare(leftLower, rightLower);
      };

      this.groupCollect = new Whisper.ReactWrapperView({
        className: 'react-contact-list',
        Component: window.Signal.Components.GroupContactCollect,
        props: {
          isCommon: true,
          i18n,
          contacts: [],
          setSearchText: this.setSearchText.bind(this),
        },
      });
      this.$el.append(this.groupCollect.el);

      this.showingCollection = new Backbone.Collection();
      this.showingCollection.comparator = comparator;

      this.convoCollection = getConversations();

      this.listenTo(this.convoCollection, 'change reset update', () => {
        this.setSearchText(this.searchText);
      });

      this.listenTo(this.showingCollection, 'change reset update', () => {
        this.groupCollect.update({
          isCommon: true,
          i18n,
          contacts: this.showingCollection.map(c => c.cachedProps),
          // clickItem: () => console.log('clicked.....'),
          setSearchText: this.setSearchText.bind(this),
        });
      });

      this.titleView.$el.hide();
      this.groupCollect.$el.hide();
      this.$('.container').show();
    },
    open() {
      this.setSearchText();
      this.titleView.$el.show();
      this.groupCollect.$el.show();
      this.$('.container').hide();
    },
    close() {
      this.titleView.$el.hide();
      this.groupCollect.$el.hide();
      this.$('.container').show();
    },
    setSearchText(searchText) {
      const groupContacts = this.convoCollection.filter(c => c.isAliveGroup());

      this.searchText = searchText;
      if (!searchText) {
        this.showingCollection.set(groupContacts);
        return;
      }

      const searchTerm = searchText.toLowerCase();

      const searchResult = groupContacts.filter(m => {
        let name = m.getName().toLowerCase();
        return name.includes(searchTerm);
      });

      this.showingCollection.set(searchResult);
    },
  });

  Whisper.AppLoadingScreen = Whisper.View.extend({
    templateName: 'app-loading-screen',
    className: 'app-loading-screen',
    updateProgress(count) {
      if (count > 0) {
        const message = i18n('loadingMessages', count.toString());
        this.$('.message').text(message);
      }
    },
    render_attributes: {
      message: i18n('loading'),
    },
  });

  Whisper.InboxView = Whisper.View.extend({
    templateName: 'three-column',
    className: 'inbox index',
    initialize(options = {}) {
      this.ready = false;
      this.render();
      this.$el.attr('tabindex', '1');

      this.conversation_stack = new Whisper.ConversationStack({
        el: this.$('.conversation-stack'),
        model: { window: options.window },
      });

      if (!options.initialLoadComplete) {
        this.appLoadingScreen = new Whisper.AppLoadingScreen();
        this.appLoadingScreen.render();
        this.appLoadingScreen.$el.prependTo(this.el);
        this.startConnectionListener();
      }

      const inboxCollection = getInboxCollection();

      this.listenTo(inboxCollection, 'messageError', () => {
        if (this.networkStatusView) {
          this.networkStatusView.render();
        }
      });

      this.networkStatusView = new Whisper.NetworkStatusView();
      this.$el
        .find('.network-status-container')
        .append(this.networkStatusView.render().el);

      if (extension.expired()) {
        const banner = new Whisper.ExpiredAlertBanner().render();
        banner.$el.prependTo(this.$el);
        this.$el.addClass('expired');
      }

      this.setupLeftPane();
      this.setupFirstPane();
      this.setupContact();
    },
    render_attributes: {
      welcomeToDesktop: i18n('welcomeToDesktop'),
      selectAContact: i18n('selectAContact'),
    },
    events: {
      click: 'onClick',
    },
    setupFirstPane() {
      this.leftPaneView2 = new Whisper.ReactWrapperView({
        JSX: Signal.State.Roots.createFirstPane(window.inboxStore),
        className: 'first-pane-wrapper',
      });
      this.$('.main-menu').append(this.leftPaneView2.el);
    },
    setupLeftPane() {
      // Here we set up a full redux store with initial state for our LeftPane Root
      const convoCollection = getConversations();
      const conversations = convoCollection.map(
        conversation => conversation.cachedProps
      );

      const storageLeftPaneWidth = localStorage.getItem(
        'preferences.leftPaneWidth'
      );
      const leftPaneWidth = storageLeftPaneWidth
        ? Number(storageLeftPaneWidth)
        : 300;

      const initialState = {
        conversations: {
          conversationLookup: Signal.Util.makeLookup(conversations, 'id'),
          memberGroupLookup: Signal.Util.makeMemberGroupLookup(conversations),
        },
        user: {
          regionCode: window.storage.get('regionCode'),
          ourNumber: textsecure.storage.user.getNumber(),
          i18n: window.i18n,
        },
        preferences: {
          leftPaneWidth,
        },
      };

      this.store = Signal.State.createStore(initialState);
      window.inboxStore = this.store;
      this.leftPaneView = new Whisper.ReactWrapperView({
        JSX: Signal.State.Roots.createLeftPane(this.store),
        className: 'left-pane-wrapper',
      });

      // Enables our redux store to be updated by backbone events in the outside world
      const {
        conversationAdded,
        conversationChanged,
        conversationRemoved,
        removeAllConversations,
        conversationsBulkUpdate,
        messageExpired,
        openConversationExternal,
      } = Signal.State.bindActionCreators(
        Signal.State.Ducks.conversations.actions,
        this.store.dispatch
      );
      const { userChanged } = Signal.State.bindActionCreators(
        Signal.State.Ducks.user.actions,
        this.store.dispatch
      );

      const { callAdded, callRemoved, callReset } =
        Signal.State.bindActionCreators(
          Signal.State.Ducks.conversations.actions,
          this.store.dispatch
        );

      this.openConversationAction = openConversationExternal;

      // In the future this listener will be added by the conversation view itself. But
      //   because we currently have multiple converations open at once, we install just
      //   one global handler.
      // $(document).on('keydown', event => {
      //   const { ctrlKey, key } = event;

      // We can add Command-E as the Mac shortcut when we add it to our Electron menus:
      //   https://stackoverflow.com/questions/27380018/when-cmd-key-is-kept-pressed-keyup-is-not-triggered-for-any-other-key
      // For now, it will stay as CTRL-E only
      //   if (key === 'e' && ctrlKey) {
      //     const state = this.store.getState();
      //     const selectedId = state.conversations.selectedConversation;
      //     const conversation = ConversationController.get(selectedId);

      //     if (conversation && !conversation.get('isArchived')) {
      //       conversation.setArchived(true);
      //       conversation.trigger('unload');
      //     }
      //   }
      // });

      this.listenTo(convoCollection, 'remove', conversation => {
        const { id } = conversation || {};
        conversationRemoved(id);
      });
      this.listenTo(convoCollection, 'add', conversation => {
        const { id, cachedProps } = conversation || {};
        conversationAdded(id, cachedProps);
      });

      const convoChangeBather = Signal.Util.createBatcher({
        name: 'convoChangeBather',
        wait: 150,
        maxSize: Infinity,
        processBatch: items => {
          const deduped = Array.from(new Set(items));
          log.info(
            'convoChangeBather: deduped ',
            `${items.length} into ${deduped.length}`
          );

          conversationsBulkUpdate(deduped.map(c => c.format()));
        },
      });

      // defer do change
      this.listenTo(convoCollection, 'change', conversation => {
        if (!conversation) {
          return;
        }

        const { id } = conversation;
        if (!id) {
          return;
        }

        // do not update conversation
        // when only unreadCount changed and changed value > 99
        // as unread count bigger than 99 always was show as 99+
        const changed = conversation.changedAttributes();
        if (changed.unreadCount > 99 && Object.keys(changed).length === 1) {
          return;
        }

        convoChangeBather.add(conversation);
      });

      this.listenTo(convoCollection, 'reset', removeAllConversations);
      this.listenTo(convoCollection, 'bulkUpdate', () => {
        conversationsBulkUpdate(convoCollection.map(c => c.format()));
      });

      Whisper.events.on('messageExpired', messageExpired);
      Whisper.events.on('userChanged', userChanged);

      Whisper.events.on('callAdd', callAdded);
      // local remove, maybe display after refresh
      Whisper.events.on('callRemove', callRemoved);
      Whisper.events.on('callReset', callReset);

      // Finally, add it to the DOM
      this.$('.left-pane-placeholder').append(this.leftPaneView.el);
    },
    setupContact() {
      this.contactView = new Whisper.ReactWrapperView({
        JSX: Signal.State.Roots.createContactPane(window.inboxStore),
        className: 'contact-column-list-wrapper',
      });
      this.$('.contact-column-list').append(this.contactView.el);
    },
    startConnectionListener() {
      this.interval = setInterval(() => {
        const status = window.getSocketStatus();
        switch (status) {
          case WebSocket.CONNECTING:
            break;
          case WebSocket.OPEN:
            clearInterval(this.interval);
            // if we've connected, we can wait for real empty event
            this.interval = null;
            break;
          case WebSocket.CLOSING:
          case WebSocket.CLOSED:
            clearInterval(this.interval);
            this.interval = null;
            // if we failed to connect, we pretend we got an empty event
            this.onEmpty();
            break;
          default:
            // We also replicate empty here
            this.onEmpty();
            break;
        }
      }, 1000);
    },
    onEmpty() {
      const view = this.appLoadingScreen;
      if (view) {
        this.appLoadingScreen = null;
        view.remove();
      }
    },
    onProgress(count) {
      const view = this.appLoadingScreen;
      if (view) {
        view.updateProgress(count);
      }
    },
    focusConversation(e) {
      if (e && this.$(e.target).closest('.placeholder').length) {
        return;
      }

      this.$('#header, .gutter').addClass('inactive');
      this.$('.conversation-stack').removeClass('inactive');
    },
    focusHeader() {
      this.$('.conversation-stack').addClass('inactive');
      this.$('#header, .gutter').removeClass('inactive');
      this.$('.conversation:first .menu').trigger('close');
    },
    reloadBackgroundPage() {
      window.location.reload();
    },
    async openConversation(id, messageId, recentConversationSwitch, type) {
      window.log.info(
        'inbox_view openConversation:',
        window.Signal.ID.convertIdToV2(id)
      );

      // show chat pane
      window.dispatchEvent(new Event('event-toggle-switch-chat'));

      // Main Menu 操作菜单关闭
      window.dispatchEvent(new CustomEvent('open-conversation'));

      const _type = type ? type : 'private';
      const conversation = await ConversationController.getOrCreateAndWait(
        id,
        _type
      );

      if (this.openConversationAction) {
        await new Promise(r => setTimeout(r, 0));
        this.openConversationAction(id, messageId);
      }

      const currentOpenedId = window.getCurrentOpenConversation();
      if (currentOpenedId) {
        ConversationController.get(currentOpenedId)?.trigger(
          'will-be-switched'
        );
      }

      await new Promise(r => setTimeout(r, 0));

      this.conversation_stack.open(conversation, messageId);

      this.focusConversation();

      // 如果不是手动切换的会话，则把会话添加到队列
      if (!recentConversationSwitch) {
        window.conversationJoinQueue(id);
      }
    },
    async openGroupChats() {
      if (this.all_bots_view) {
        this.all_bots_view.close();
      }

      if (!this.group_chats_view) {
        this.group_chats_view = new Whisper.GroupChatsView({
          el: this.$('.contact-column-detail'),
        });
      }

      this.group_chats_view.open();
    },
    async openAllBots() {
      if (this.group_chats_view) {
        this.group_chats_view.close();
      }

      if (!this.all_bots_view) {
        //AllBotsView
        this.all_bots_view = new Whisper.AllBotsView({
          el: this.$('.contact-column-detail'),
        });
      }

      this.all_bots_view.open();
    },
    async deleteMessages(id, type) {
      const conversation = await ConversationController.getOrCreateAndWait(
        id,
        type
      );
      if (conversation) {
        try {
          await this.confirm(
            i18n('deleteConversationConfirmation'),
            i18n('confirm')
          );
          try {
            //删除会话的消息
            conversation.destroyMessages(true);
            // we do set archived here for delete conversation
            //conversation.setArchived(true);
            conversation.trigger('unload', 'delete');
          } catch (error) {
            window.log.error(
              'destroyMessages: Failed to successfully delete conversation',
              error && error.stack ? error.stack : error
            );
          }
        } catch (error) {
          // nothing to see here, user canceled out of dialog
        }
      }
    },
    async conversationStick(id, stick) {
      const conversation = await ConversationController.get(id);
      if (conversation) {
        conversation.stickConversation(stick);
      }
    },
    async conversationMute(id, mute) {
      const conversation = await ConversationController.get(id);
      if (conversation) {
        conversation.muteConversation(mute);
      }
    },
    async conversationLeaveGroup(id) {
      // await this.confirm(i18n('leaveGroupConfirmation'), i18n('leave'));
      const conversation = await ConversationController.get(id);
      if (conversation) {
        await conversation.leaveGroupV2();
        conversation.setArchived(true);
      }
    },
    async conversationDisbandGroup(id) {
      await this.confirm(i18n('disbandGroupConfirmation'), i18n('disband'));
      const conversation = await ConversationController.get(id);
      if (conversation) {
        await conversation.disbandGroupV2();
        conversation.setArchived(true);
      }
    },

    async conversationArchived(id) {
      const conversation = await ConversationController.get(id);
      if (conversation) {
        conversation.setArchived(true);
      }
    },

    closeRecording(e) {
      if (e && this.$(e.target).closest('.capture-audio').length > 0) {
        return;
      }
      this.$('.conversation:first .recorder').trigger('close');
    },
    onClick(e) {
      this.closeRecording(e);
    },
    async fastJoinGroup(joinUrl, rejoin) {
      if (rejoin) {
        // 通过点击rejoin 进入的， 不显示 joinGroupView
        const parsedUrl = new URL(joinUrl);
        const inviteCode = parsedUrl.searchParams.get('inviteCode');
        if (inviteCode) {
          try {
            const info =
              await window.textsecure.messaging.joinGroupV2ByInviteCode(
                inviteCode
              );
            const groupInfo = info.data;

            const { gid, name, version } = groupInfo;

            if (typeof gid !== 'string') {
              throw new Error(`Server response invalid gid: ${gid}`);
            }

            if (typeof name !== 'string') {
              throw new Error(`Server response invalid group name: ${name}`);
            }

            if (typeof version !== 'number') {
              throw new Error(
                `Server response invalid group version: ${version}.`
              );
            }

            // join group success
            const idV1 = window.Signal.ID.convertIdToV1(gid);
            const ConversationController = window.ConversationController;
            const conversation =
              await ConversationController.getOrCreateAndWait(idV1, 'group');
            if (!conversation) {
              throw new Error(`Can not get group conversation for gid:${gid}`);
            }

            conversation.queueJob(async () => {
              const changeVersion = conversation.get('changeVersion') || 0;
              const existMembers = conversation.get('members') || [];
              const ourNumber = window.textsecure.storage.user.getNumber();

              // do not compare version vs changeVersion
              // as notification maybe arrived before this check,
              // maybe update to date
              // so, just compare ourNumber not in group members
              if (
                version > changeVersion ||
                !existMembers.includes(ourNumber)
              ) {
                // update group info
                const { avatar, members } = groupInfo;
                groupInfo.commonAvatar = conversation.parseGroupAvatar(avatar);
                conversation.updateAttributesGroup(groupInfo);

                const now = Date.now();

                // set conversation active
                conversation.set({
                  active_at: now,
                  isArchived: false,
                  group_version: 2,
                  changeVersion: version,
                  left: false,
                });

                // only version >= changeVersion, members is the latest
                // others, should full load from server.
                // when version === changeVersion, notification arrived earlier.
                if (version >= changeVersion && members instanceof Array) {
                  const membersV2 = members.map(m => ({
                    id: m.uid,
                    role: m.role,
                    displayName: m.displayName,
                  }));

                  const membersV1 = membersV2.map(m => m.id);

                  conversation.set({
                    members: membersV1,
                    membersV2,
                  });

                  await conversation.updateGroupContact();
                } else {
                  await conversation.apiLoadGroupV2();
                }
                // save conversation changes
                await window.Signal.Data.updateConversation(
                  conversation.attributes
                );

                let groupUpdate = {
                  joined: conversation.get('members') || [],
                  name,
                };
                const publishRule = conversation.get('publishRule');
                if (publishRule === 1) {
                  groupUpdate = {
                    ...groupUpdate,
                    publishRule: publishRule,
                  };
                }

                const expireTimer = conversation.getConversationMessageExpiry();
                // message with no sender
                const message = new window.Whisper.Message({
                  sent_at: now,
                  received_at: now,
                  conversationId: idV1,
                  // type: 'incoming',
                  // unread: 1,
                  group_update: groupUpdate,
                  expireTimer,
                  serverTimestamp: now,
                });

                const id = await window.Signal.Data.saveMessage(
                  message.attributes,
                  {
                    Message: window.Whisper.Message,
                  }
                );
                message.set({ id });
                window.MessageController.register(message.id, message);

                conversation.trigger('newmessage', message);
              } else {
                // local group version bigger, do nothing
              }
            });

            Whisper.events.trigger('showConversation', idV1);
          } catch (error) {
            // 服务端status返回码：
            // 0  成功
            // 1  参数无效
            // 2  无权限 （邀请人不再群中，或群组以更改邀请规则邀请人不再有权限加人）
            // 3  群无效（不存在或状态非活跃）
            // 5  token无效（token验证失败、token超时失效、token解析成功但无gid或inviter）
            // 10 群已满员
            // 11 邀请人无效（邀请人账号不可用）
            window.log.error('join group failed, ', error);

            const defaultKey = 'cannotGetGroupInfoByInviteCode';
            let i18nKey = defaultKey;

            const { API_STATUS } = APIStatus;
            const { status } = error.response;
            switch (status) {
              case API_STATUS.InvalidParameter:
                i18nKey = 'invalidArgument';
                break;
              case API_STATUS.NoPermission:
                i18nKey = 'inviterPermissionException';
                break;
              case API_STATUS.NoSuchGroup:
                i18nKey = 'invalidGroup';
                break;
              case API_STATUS.InvalidToken:
                i18nKey = 'invitationLinkExpired';
                break;
              case API_STATUS.GroupMemberCountExceeded:
                i18nKey = 'groupMemberCountExceeded';
                break;
              case API_STATUS.InvalidGroupInviteLink:
                i18nKey = 'invalidGroupInviteLink';
                break;
              case API_STATUS.GroupDisabledInviteLink:
                i18nKey = 'groupDisabledInviteLink';
                break;
              case API_STATUS.GroupOnlyAllowsModeratorsInvite:
                i18nKey = 'groupOnlyAllowsModeratorsInvite';
                break;
              case API_STATUS.GroupHasAlreadyBeenDisbanded:
                i18nKey = 'groupHasAlreadyBeenDisbanded';
                break;
              case API_STATUS.GroupIsInvalid:
                i18nKey = 'groupIsInvalid';
                break;
              case API_STATUS.NoSuchUser:
                i18nKey = 'inviterNotExist';
                break;
            }

            alert(i18n(i18nKey) || i18n(defaultKey));
          }
        }
      } else {
        if (this.joinGroupView) {
          this.joinGroupView.remove();
        }

        this.joinGroupView = new Whisper.ReactWrapperView({
          className: 'join-group-wrapper',
          Component: window.Signal.Components.JoinGroup,
          props: {
            i18n,
            joinUrl,
            onClose: () => {
              if (this.joinGroupView) {
                this.joinGroupView.remove();
              }
            },
          },
        });
      }
    },
  });

  Whisper.ExpiredAlertBanner = Whisper.View.extend({
    templateName: 'expired_alert',
    className: 'expiredAlert clearfix',
    render_attributes() {
      return {
        expiredWarning: i18n('expiredWarning'),
        upgrade: i18n('upgrade'),
      };
    },
  });
})();
