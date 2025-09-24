/* global _, Whisper, Backbone, storage */

/* eslint-disable more/no-then */

// eslint-disable-next-line func-names
(function () {
  'use strict';

  window.Whisper = window.Whisper || {};

  const conversations = new Whisper.ConversationCollection();
  const inboxCollection = new (Backbone.Collection.extend({
    initialize() {
      this.listenTo(conversations, 'add change:active_at', this.addActive);
      this.listenTo(conversations, 'reset', () => this.reset([]));

      // only mainWindow should do these actions
      if (window.windowName === 'mainWindow') {
        // update at first call immdiately and 1s after last call
        // and if having multiple calls whoes interval less than 1s
        // update every 2 seconds

        this.on(
          'add remove change:unreadCount change:markAsFlag',
          _lodash.debounce(
            () => setTimeout(this.updateUnreadCount.bind(this), 0),
            1000,
            {
              leading: true,
              maxWait: 2000,
              trailing: true,
            }
          )
        );

        this.startPruning();
      }
    },
    addActive(model) {
      if (model.get('active_at')) {
        this.add(model);
      } else {
        this.remove(model);
      }
    },
    updateUnreadCount() {
      let redUnreadCount = 0;
      let greyUnreadCount = 0;

      this.forEach(model => {
        const unreadCount = model.getDisplayUnreadCount();
        if (model.get('isMute')) {
          greyUnreadCount += unreadCount;
        } else {
          redUnreadCount += unreadCount;
        }
      });

      // 未读总数 所有未读短信之合
      const totalUnreadCount = greyUnreadCount + redUnreadCount;
      storage.put('unreadCount', totalUnreadCount);

      if (window.setBadgeCount) {
        window.setBadgeCount(redUnreadCount, greyUnreadCount);
        window.document.title = totalUnreadCount
          ? `${window.getTitle()} (${totalUnreadCount})`
          : window.getTitle();
      }

      if (window.updateTrayIcon) {
        window.updateTrayIcon(totalUnreadCount);
      }
    },
    startPruning() {
      const halfHour = 30 * 60 * 1000;
      const doCheck = events => this.forEach(c => c.trigger(events));

      this.interval = setInterval(
        () => doCheck('prune check-archive'),
        halfHour
      );

      setTimeout(() => doCheck('check-archive'), 10 * 60 * 1000);
    },
  }))();

  window.getInboxCollection = () => inboxCollection;
  window.getConversations = () => conversations;
  window.getAliveConversationsProps = () => {
    const props = [];

    conversations.forEach(c => {
      if (c.isAliveConversation()) {
        props.push(c.cachedProps);
      }
    });

    return props;
  };

  window.getAlivePrivateConversationsProps = () => {
    const props = [];

    conversations.forEach(c => {
      if (c.isAliveUser()) {
        props.push({
          ...c.cachedProps,
        });
      }
    });

    return props;
  };

  window.getPrivateConversations = () => {
    // return conversations.filter(c => c.isPrivate() && c.isDirectoryUser());
    return conversations.filter(c => c.isPrivate());
  };

  window.getAllBot = () => {
    return conversations.filter(
      c => c.isPrivate() && c.isBot() && c.isDirectoryUser()
    );
  };

  let groupsInitialized = false;

  async function initialGroups() {
    if (groupsInitialized) {
      return;
    }

    groupsInitialized = true;

    const nonInititalized = conversation => {
      return (
        conversation.isAliveGroup() &&
        !conversation.get('changeVersion') &&
        !conversation.syncedGroupWithApiLoad
      );
    };

    // get groups & never initialized.
    const shouldInitialGroups = conversations.filter(nonInititalized);

    let initialized = true;
    for (const group of shouldInitialGroups) {
      if (nonInititalized(group)) {
        try {
          await group.apiLoadGroupV2();
          await window.Signal.Data.updateConversation(group.attributes);
        } catch (error) {
          log.error(
            'Initial groupV2 info failed,',
            group.idForLogging(),
            JSON.stringify(error)
          );
          initialized = false;
        }
        await new Promise(r => setTimeout(r, 100));
      }
    }
    groupsInitialized = initialized;
  }

  async function saveData(arrayToSave, arrayToUpdate) {
    arrayToSave = Array.from(new Set(arrayToSave));

    let bulkUpdate = false;

    if (arrayToSave.length > 0) {
      log.info('need to save contacts conversation count:', arrayToSave.length);

      conversations.add(arrayToSave, { silent: true });
      await window.Signal.Data.saveConversations(arrayToSave);

      bulkUpdate = true;
    }

    arrayToUpdate = Array.from(new Set(arrayToUpdate));

    const promises = [];

    if (arrayToUpdate.length > 0) {
      log.info(
        'need to update contact conversation count:',
        arrayToUpdate.length
      );

      await window.Signal.Data.updateConversations(arrayToUpdate);

      const asyncTrigger = async (conversation, events) => {
        await new Promise(r => setTimeout(r, 10));
        conversation.trigger(events, conversation);
      };

      arrayToUpdate.forEach(u => {
        const conversation = conversations.get(u.id);
        if (!conversation) {
          return;
        }

        let events;

        // todo:// events should come from really changes
        if (conversation.isPrivate()) {
          events = 'change:directoryUser';

          if (!conversation.isDirectoryUser()) {
            promises.push(conversation.destroyMessages(true, true));
            events += ' unload';
          }
        } else {
          events = 'update_view';
        }

        if (conversation.isMe()) {
          events = 'change change:commonAvatar ' + events;
        }

        promises.push(asyncTrigger(conversation, events));
      });

      bulkUpdate = true;
    }

    if (bulkUpdate) {
      // should wait for conversation generateProps done
      if (promises?.length) {
        await Promise.all(promises);
      }

      conversations.trigger('bulkUpdate');
    }

    // initial all groups
    if (!groupsInitialized) {
      setTimeout(initialGroups, 1000);
    }
  }

  // "avatar"
  // "flag"
  const CONTACT_FIXED_ATTRS = [
    'name',
    'email',
    'timeZone',
    'uid',
    'joinedAt',
    'sourceDescribe',
    'department',
    'superior',
    'address',
    'gender',
    'signature',
    'privateConfigs',
    'protectedConfigs',
    'publicConfigs',
    'remarkName',
  ];

  const GROUP_FIXED_ATTRS = [
    'name',
    'messageExpiry',
    'messageClearAnchor',
    'invitationRule',
    'rejoin',
    'anyoneRemove',
    'linkInviteSwitch',
    'anyoneChangeName',
  ];

  function validateId(id) {
    if (!id || typeof id !== 'string') {
      // log.error("'id' must be a string", id);
      return false;
    }

    if (id.startsWith('WEEK')) {
      log.error('invalid id format:', id);
      return false;
    }

    return true;
  }

  // | action | int | 0:add 1:update 2:delete 3: permanent delete |
  const DIRECTORY_ACTION = {
    ADD: 0,
    UPDATE: 1,
    DELETE: 2,
    PERMANENT_DELETE: 3,
  };

  window.ConversationController = {
    get(id) {
      if (!this._initialFetchComplete) {
        throw new Error(
          'ConversationController.get() needs complete initial fetch'
        );
      }

      if (!validateId(id)) {
        log.error('invalid id format when get', id);
        return null;
      }

      return conversations.get(id);
    },
    // Needed for some model setup which happens during the initial fetch() call below
    getUnsafe(id) {
      if (!validateId(id)) {
        log.error('invalid id format when getUnsafe', id);
        return null;
      }

      return conversations.get(id);
    },
    dangerouslyCreateAndAdd(attributes) {
      return conversations.add(attributes);
    },
    getOrCreate(id, type) {
      if (!validateId(id)) {
        throw new TypeError(`invalid id format when getOrCreate: ${id}`);
      }

      if (type !== 'private' && type !== 'group') {
        throw new TypeError(
          `'type' must be 'private' or 'group'; got: '${type}'`
        );
      }

      if (!this._initialFetchComplete) {
        throw new Error(
          'ConversationController.get() needs complete initial fetch'
        );
      }

      let conversation = conversations.get(id);
      if (conversation) {
        return conversation;
      }

      conversation = conversations.add({
        id,
        type,
        version: 2,
      });

      const create = async () => {
        if (!conversation.isValid()) {
          const validationError = conversation.validationError || {};
          window.log.error(
            'Contact is not valid. Not saving, but adding to collection:',
            conversation.idForLogging(),
            validationError.stack
          );

          return conversation;
        }
        try {
          await window.Signal.Data.saveConversation(conversation.attributes, {
            Conversation: Whisper.Conversation,
          });
        } catch (error) {
          window.log.error(
            'Conversation save failed! ',
            id,
            type,
            'Error:',
            error && error.stack ? error.stack : error
          );
          throw error;
        }

        return conversation;
      };

      conversation.initialPromise = create();

      return conversation;
    },
    getOrCreateAndWait(id, type) {
      return this._initialPromise.then(() => {
        const conversation = this.getOrCreate(id, type);

        if (conversation) {
          return conversation.initialPromise.then(() => conversation);
        }

        return Promise.reject(
          new Error('getOrCreateAndWait: did not get conversation')
        );
      });
    },
    async getAllGroupsInvolvingId(id) {
      const groups = await window.Signal.Data.getAllGroupsInvolvingId(id, {
        ConversationCollection: Whisper.ConversationCollection,
      });

      const result = [];

      for (const group of groups.models) {
        // filter group with invalid id format
        if (!validateId(group.id)) {
          log.error('invalid id format when getAllGroupsInvolvingId', id);
          continue;
        }

        result.push(conversations.add(group));
      }

      return result;
    },
    loadPromise() {
      return this._initialPromise;
    },
    reset() {
      this._initialPromise = Promise.resolve();
      this._initialFetchComplete = false;
      conversations.reset([]);
    },
    getAllPrivateConversations() {
      window.log.info('ConversationController: getAllPrivateConversations');

      if (!conversations.length) {
        throw new Error('ConversationController: NOT loaded!');
      }
      return conversations;
    },
    async load(loadOnly = false) {
      window.log.info('ConversationController: starting initial fetch');

      if (conversations.length) {
        throw new Error('ConversationController: Already loaded!');
      }
      const load = async () => {
        try {
          const collection = await window.Signal.Data.getAllConversations({
            ConversationCollection: Whisper.ConversationCollection,
          });

          // filter group with incorrect id
          conversations.add(
            collection.models.filter(m => {
              if (!m) {
                log.error('invalid model format when load', model);
                return false;
              }

              const id = m.id;
              if (!validateId(id)) {
                log.error('invalid id format when load', id);
                return false;
              }

              if (!m.isPrivate()) {
                if (id.length !== 16 && id.length !== 32) {
                  log.error('invalid group id format when load', id);
                  return false;
                }

                const id_v2 = m.get('id_v2');

                // force update id_v2 when incorrect
                if (!/^([0-9a-f]{32})|(WEEK[0-9A-F]{32})$/.test(id_v2)) {
                  m.attributes.id_v2 = window.Signal.ID.convertIdToV2(id);
                  log.warn('correcting group id_v2', id, id_v2, m.get('id_v2'));
                }
              }

              return true;
            })
          );

          this._initialFetchComplete = true;
          if (loadOnly) {
            window.log.info('ConversationController: done with loadOnly');
            return;
          }

          const updateLastMessage = async () => {
            for (const conversation of conversations) {
              if (!conversation.get('active_at')) {
                continue;
              }

              await conversation.debouncedUpdateLastMessage();
              await new Promise(r => setTimeout(r, 50));
            }
          };

          setTimeout(async () => {
            await updateLastMessage();
            setInterval(updateLastMessage, 60 * 60 * 1000);
          }, 0);

          // await Promise.all(
          //   conversations.map(conversation => {
          //     if (conversation.get('active_at') &&
          //       (!conversation.get('lastMessage') || conversation.get('lastMessageVersion') != 1)) {
          //       return conversation.updateLastMessage();
          //     }

          //     return null;
          //   })
          // );
          window.log.info('ConversationController: done with initial fetch');
        } catch (error) {
          window.log.error(
            'ConversationController: initial fetch failed',
            error && error.stack ? error.stack : error
          );
          throw error;
        }
      };

      this._initialPromise = load();

      return this._initialPromise;
    },
    async updateConversationConfigs(settings) {
      if (!(settings instanceof Array)) {
        log.info('there is no conversation setting from server');
        return;
      }

      log.info(
        'fetch conversation with config from server count:',
        settings.length
      );

      let shouldUpdateUnreadCount = false;
      const arrayToUpdate = [];

      for (const setting of settings) {
        const { conversation: conversationId } = setting;
        if (!window.Signal.ID.validateIdFromServer(conversationId)) {
          log.warn('Invalid conversation id in setting', conversationId);
          continue;
        }

        const uniformId = window.Signal.ID.getUniformId(conversationId);

        const conversation = this.get(uniformId.getSimplifyId());
        if (!conversation) {
          log.warn(
            'conversation not found for id',
            uniformId.getIdForLogging()
          );
          continue;
        }

        const update = await conversation.updateConfig(setting);
        if (update) {
          Object.assign(conversation.attributes, update);
          arrayToUpdate.push(conversation.attributes);

          if (!shouldUpdateUnreadCount && Object.hasOwn(update, 'muteStatus')) {
            shouldUpdateUnreadCount = true;
          }
        }
      }

      await saveData([], arrayToUpdate);

      if (shouldUpdateUnreadCount) {
        window.getInboxCollection().updateUnreadCount();
      }
    },
    bulkCreateContactConversations(contactArray, groupContactArray) {
      return this._initialPromise.then(async () => {
        if (!this._initialFetchComplete) {
          throw new Error(
            'ConversationController.bulkCreateContactConversations needs complete initial fetch'
          );
        }

        let arrayToSave = [];
        let arrayToUpdate = [];

        if (!this.helperConv) {
          this.helperConv = new Whisper.Conversation({
            id: 'helper-for-parse',
          });
        }
        if (contactArray instanceof Array) {
          log.info('fetch internal contacts count:', contactArray.length);
          const contactNumbers = contactArray.map(c => c.number);

          // set directory user flag to false is a conversation is not in contacts.
          conversations.forEach(c => {
            if (
              c.isPrivate() &&
              c.isDirectoryUser() &&
              !contactNumbers.includes(c.id)
            ) {
              c.attributes.directoryUser = false;
              arrayToUpdate.push(c.attributes);
            }
          });

          for (let i = 0; i < contactArray.length; i++) {
            const contact = contactArray[i];
            const { number, avatar } = contact;

            if (typeof number !== 'string') {
              window.log.error('invalid contact:', number);
              continue;
            }

            contact.commonAvatar = this.helperConv.parsePrivateAvatar(avatar);

            let conversation = conversations.get(number);
            if (conversation) {
              if (conversation.updateAttributesPrivate(contact)) {
                arrayToUpdate.push(conversation.attributes);
              }
            } else {
              const attributes = {
                id: number,
                type: 'private',
                version: 2,
                directoryUser: true,
                commonAvatar: contact.commonAvatar,
                ..._.pick(contact, CONTACT_FIXED_ATTRS),
              };
              arrayToSave.push(attributes);
            }
          }
        } else {
          log.warn('input contactArray is not an array.');
        }

        if (groupContactArray instanceof Array) {
          log.info(
            'fetch my groups from server count:',
            groupContactArray.length
          );

          for (let i = 0; i < groupContactArray.length; i++) {
            const group = groupContactArray[i];
            const { gid, name, avatar, status } = group;
            if (typeof gid != 'string' || typeof name != 'string') {
              window.log.error('invalid group:', gid, name);
              continue;
            }

            group.commonAvatar = this.helperConv.parseGroupAvatar(avatar);

            const id = window.Signal.ID.convertIdToV1(gid);
            let conversation = conversations.get(id);
            if (conversation) {
              if (conversation.updateAttributesGroup(group)) {
                arrayToUpdate.push(conversation.attributes);
              }
              continue;
            }

            // 本地没有，创建
            const attributes = {
              id: id,
              id_v2: gid,
              type: 'group',
              version: 2,
              group_version: 2,
              commonAvatar: group.commonAvatar,
              ..._.pick(group, GROUP_FIXED_ATTRS),
            };
            arrayToSave.push(attributes);
          }
        } else {
          log.warn('input groupContactArray is not an array.');
        }
        await saveData(arrayToSave, arrayToUpdate);
      });
    },
    bulkFreshContactConversation(changedContacts, directoryVersion) {
      return this._initialPromise.then(async () => {
        if (!this._initialFetchComplete) {
          throw new Error(
            'ConversationController.bulkFreshContactConversation needs complete initial fetch'
          );
        }

        if (!(changedContacts instanceof Array)) {
          log.error('contact changed members must be an array.');
          return;
        }

        let arrayToSave = [];
        let arrayToUpdate = [];

        if (!this.helperConv) {
          this.helperConv = new Whisper.Conversation({
            id: 'helper-for-parse',
          });
        }

        const newAskedVersion = directoryVersion - 1;

        changedContacts.forEach(contact => {
          const { action, number } = contact;

          const conversation = this.get(number);
          const latestAskedVersion = conversation?.get('latestAskedVersion');

          // | action | int | 0:add 1:update 2:delete 3: permanent delete |
          switch (action) {
            case DIRECTORY_ACTION.ADD:
              if (
                conversation &&
                (!latestAskedVersion || newAskedVersion >= latestAskedVersion)
              ) {
                conversation.attributes.latestAskedVersion = newAskedVersion;
                conversation.attributes.friendRequesting = false;
              }
            case DIRECTORY_ACTION.UPDATE:
              contact.commonAvatar = this.helperConv.parsePrivateAvatar(
                contact.avatar
              );
              if (conversation) {
                if (conversation.updateAttributesPrivate(contact)) {
                  arrayToUpdate.push(conversation.attributes);
                } else {
                  log.info('Contact has no changed:', number);
                }
              } else {
                const attributes = {
                  id: number,
                  type: 'private',
                  version: 2,
                  directoryUser: true,
                  commonAvatar: contact.commonAvatar,
                  ..._.pick(contact, CONTACT_FIXED_ATTRS),
                };
                arrayToSave.push(attributes);
              }
              break;
            case DIRECTORY_ACTION.DELETE:
            // deleted from directory
            case DIRECTORY_ACTION.PERMANENT_DELETE:
              // permanent deleted, account unregisterred
              if (conversation) {
                conversation.attributes.directoryUser = false;

                if (
                  !latestAskedVersion ||
                  newAskedVersion >= latestAskedVersion
                ) {
                  conversation.attributes.latestAskedVersion = newAskedVersion;
                  conversation.attributes.friendRequesting = false;
                }

                arrayToUpdate.push(conversation.attributes);
              } else {
                // local conversation not exists, skipping.
                log.info('no conversation found for deleted contact:', number);
              }
              // this.updateGroupExternalLabel(number, action);
              break;
          }
        });
        await saveData(arrayToSave, arrayToUpdate);
      });
    },
    bulkFreshGroupContact(membersV2) {
      return this._initialPromise.then(async () => {
        if (!this._initialFetchComplete) {
          throw new Error(
            'ConversationController.bulkFreshGroupContact needs complete initial fetch'
          );
        }
        if (!(membersV2 instanceof Array)) {
          log.error('Input membersV2 is not valid Array');
          return;
        }

        let arrayToSave = [];
        let arrayToUpdate = [];

        const members = membersV2.filter(m => m.id);
        members.forEach(member => {
          const { id, displayName } = member;

          if (!id) {
            log.error('Invalid member:', member);
            return;
          }

          const conversation = this.get(id);
          if (conversation) {
            const attributes = conversation.attributes;
            const { groupDisplayName } = attributes || {};
            let update;
            if (displayName !== groupDisplayName) {
              log.info(
                'Changing groupDisplayName from ' +
                  `${groupDisplayName} to ${displayName} for ${id}`
              );
              attributes.groupDisplayName = displayName;
              update = true;
            }

            if (update) {
              arrayToUpdate.push(attributes);
            }
          } else {
            log.info(`New groupContact ${displayName} of ${id}`);
            arrayToSave.push({
              id,
              type: 'private',
              version: 2,
              groupDisplayName: displayName,
            });
          }
        });
        await saveData(arrayToSave, arrayToUpdate);

        return members.map(member => {
          const model = { ...member };
          model.__proto__ = this.get(member.id);
          return model;
        });
      });
    },
    bulkUpdateIdentityKeyResetInfo(updates) {
      return this._initialPromise.then(async () => {
        if (!this._initialFetchComplete) {
          throw new Error(
            'ConversationController.bulkUpdateIdentityKeyResetInfo needs complete initial fetch'
          );
        }
        if (!Array.isArray(updates)) {
          log.error('Input updates is not valid Array');
          return;
        }

        const arrayToUpdate = [];

        for (const update of updates) {
          const { uid, resetIdentityKeyTime: identityKeyResetAt } = update;
          const conversation = this.get(uid);
          if (conversation) {
            const attributes = conversation.attributes;
            if (
              !attributes.identityKeyResetAt ||
              attributes.identityKeyResetAt < identityKeyResetAt
            ) {
              attributes.identityKeyResetAt = identityKeyResetAt;
              arrayToUpdate.push(attributes);
            }
          }
        }
        await saveData([], arrayToUpdate);
      });
    },
  };
})();
