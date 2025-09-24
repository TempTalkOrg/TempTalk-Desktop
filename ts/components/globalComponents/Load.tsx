import React, { useEffect, useState } from 'react';
import { LocalizerType } from '../../types/Util';
import MembersChange from './MembersChange';
import { Notice } from '../Notice';
import CreateGroup from './CreateGroup';

import { ICreateGroupProps } from './CreateGroup';
import { IMembersChangeProps } from './MembersChange';

type PropsType = {
  i18n: LocalizerType;
  ourNumber: string;
};

export default function Load(props: PropsType) {
  const { i18n, ourNumber } = props;
  const collator = new Intl.Collator();

  const [showCreateGroupDialog, setShowCreateGroupDialog] = useState(false);

  const [showMembersChangeDialog, setShowMembersChangeDialog] = useState(false);
  const [membersChangeType, setMembersChangeType] = useState<
    ICreateGroupProps['type'] | IMembersChangeProps['type']
  >();
  const [membersChangeItems, setMembersChangeItems] = useState<Array<any>>([]);
  const [membersChangeDisabledItems, setMembersChangeDisabledItems] = useState<
    Array<string>
  >([]);
  const [presetGroupMember, setPresetGroupMember] = useState(null);
  const [membersChangeGroupId, setMembersChangeGroupId] = useState(null);
  const [membersChangeGroupName, setMembersChangeGroupName] = useState('');
  const [membersChangeFromGroup, setMembersChangeFromGroup] = useState(null);

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (window as any).addEventListener(
      'global-components-members-change',
      membersChange
    );

    (window as any).addEventListener('close-all-load-dialog', closeAllDialog);

    return () => {
      (window as any).removeEventListener(
        'global-components-members-change',
        membersChange
      );
      (window as any).removeEventListener(
        'close-all-load-dialog',
        closeAllDialog
      );
    };
  }, []);

  const closeAllDialog = () => {
    setShowCreateGroupDialog(false);
    setShowMembersChangeDialog(false);
  };

  const onConfirm = (members: Array<string>, options: any) => {
    if (
      membersChangeType === 'new-group' ||
      membersChangeType === 'quick-group' ||
      membersChangeType === 'group-quick-group'
    ) {
      // setShowCreateGroupDialog(false);
      setLoading(true);

      const fromGroup =
        membersChangeType === 'group-quick-group'
          ? membersChangeFromGroup
          : undefined;

      // 群名字限制64字节长度
      let name = options.groupName || 'New group';
      if (name > 64) {
        name = name.substring(0, 64);
      }
      const editInfo = {
        mode: 'new-group',
        groupInfo: {
          name,
          members:
            membersChangeType === 'new-group' ||
            membersChangeType === 'group-quick-group'
              ? members
              : [...members, presetGroupMember],
        },
        fromGroup,
      };

      (window as any).Whisper.events.once(
        'result-of-create-or-edit',
        (result: boolean) => {
          setLoading(false);
          if (result) {
            setShowCreateGroupDialog(false);
          }
        }
      );

      (window as any).Whisper.events.trigger(
        'create-or-edit-group',
        undefined,
        editInfo
      );
    }

    if (
      membersChangeType === 'add-group-members' ||
      membersChangeType === 'remove-group-members'
    ) {
      // setShowMembersChangeDialog(false);
      setLoading(true);

      const editInfo = {
        mode: membersChangeType,
        groupInfo: {
          id: membersChangeGroupId,
          members,
          operator: ourNumber,
        },
      };

      (window as any).Whisper.events.once(
        'result-of-create-or-edit',
        (result: boolean) => {
          setLoading(false);
          if (result) {
            setShowMembersChangeDialog(false);
          }
        }
      );

      (window as any).Whisper.events.trigger(
        'create-or-edit-group',
        undefined,
        editInfo
      );
    }
    if (
      membersChangeType === 'add-group-admins' ||
      membersChangeType === 'remove-group-admins'
    ) {
      // setShowMembersChangeDialog(false);
      setLoading(true);

      const editInfo = {
        mode: membersChangeType,
        groupInfo: {
          id: membersChangeGroupId,
          members,
        },
      };

      (window as any).Whisper.events.once(
        'result-of-create-or-edit',
        (result: boolean) => {
          setLoading(false);
          if (result) {
            setShowMembersChangeDialog(false);
          }
        }
      );

      (window as any).Whisper.events.trigger(
        'create-or-edit-group',
        undefined,
        editInfo
      );
    }

    if (membersChangeType === 'call-add') {
      setShowMembersChangeDialog(false);
      (window as any).addCallMembers(members);
    }
  };

  const sortByName = (left: any, right: any) => {
    const leftLower = (left.getName() || left.id).toLowerCase().trim();
    const rightLower = (right.getName() || right.id).toLowerCase().trim();
    return collator.compare(leftLower, rightLower);
  };

  const getContactsUsers = async () => {
    const items = (window as any).getPrivateConversations();

    items.sort((left: any, right: any) => {
      if (left.isMe()) {
        return -1;
      }
      if (right.isMe()) {
        return 1;
      }

      const leftActive = left.get('active_at');
      const rightActive = right.get('active_at');

      if (leftActive === undefined && rightActive === undefined) {
        return sortByName(left, right);
      }

      if (leftActive === undefined) {
        return 1;
      }
      if (rightActive === undefined) {
        return -1;
      }
      if (leftActive !== rightActive) {
        return leftActive > rightActive ? -1 : 1;
      } else {
        return sortByName(left, right);
      }
    });

    const itemsSort = items.map((v: any) => {
      return { ...v.cachedProps, isMe: false };
    });

    // 外部用户不可以添加
    const filterItemSort = itemsSort.filter((m: any) => m.directoryUser);
    setMembersChangeItems(filterItemSort);
    return filterItemSort;
  };

  const membersChange = async (ev: any) => {
    if (!ev || !ev.detail) {
      return;
    }
    const conversations = (window as any).getPrivateConversations();
    const allItems = conversations.map((v: any) => {
      return { ...v.cachedProps, isMe: false };
    });

    if (ev.detail.type === 'new-group' || ev.detail.type === 'quick-group') {
      setMembersChangeType(ev.detail.type);
      const items = await getContactsUsers();
      if (ev.detail.type === 'new-group') {
        setMembersChangeDisabledItems([ourNumber]);
      }
      if (ev.detail.type === 'quick-group') {
        if (!ev.detail.id) {
          throw Error('quick group bad param id.');
        }
        let existContact;
        for (let i = 0; i < items.length; i += 1) {
          if (items[i].id === ev.detail.id) {
            existContact = true;
            break;
          }
        }
        if (!existContact) {
          alert('The user is not in your contact list!');
          return;
        }
        setMembersChangeDisabledItems([ourNumber, ev.detail.id]);
        setPresetGroupMember(ev.detail.id);
      }
      setShowCreateGroupDialog(true);
    }
    if (ev.detail.type === 'group-quick-group') {
      await getContactsUsers();
      setMembersChangeType(ev.detail.type);

      if (!ev.detail.name || !ev.detail.groupId) {
        alert('group name|id can not be null!');
        return;
      }

      setMembersChangeFromGroup(ev.detail.groupId);
      setMembersChangeGroupName(ev.detail.name);
      setMembersChangeDisabledItems([ourNumber]);
      setShowCreateGroupDialog(true);
    }

    if (ev.detail.type === 'add-group-members' && ev.detail.groupId) {
      setMembersChangeType(ev.detail.type);
      setMembersChangeGroupId(ev.detail.groupId);
      await getContactsUsers();
      const conversation = await (
        window as any
      ).Signal.Data.getConversationById(ev.detail.groupId, {
        Conversation: (window as any).Whisper.Conversation,
      });

      const disabledItems = [ourNumber];
      const members = conversation.get('members') || [];
      for (let i = 0; i < members.length; i++) {
        if (!disabledItems.includes(members[i])) {
          disabledItems.push(members[i]);
        }
      }
      setMembersChangeDisabledItems(disabledItems);
      setMembersChangeGroupName(conversation.get('name'));
      setShowMembersChangeDialog(true);
    }
    if (ev.detail.type === 'remove-group-members' && ev.detail.groupId) {
      setMembersChangeType(ev.detail.type);
      setMembersChangeGroupId(ev.detail.groupId);

      const conversation = await (
        window as any
      ).Signal.Data.getConversationById(ev.detail.groupId, {
        Conversation: (window as any).Whisper.Conversation,
      });
      let meOwner = false;
      const leftItems = [];
      const disabledItems: any = [];
      const members = conversation.get('membersV2') || [];

      const memoryConversation = (window as any).ConversationController.get(
        ev.detail.groupId
      );
      let cacheMemberLastActive =
        memoryConversation?.getCacheMemberLastActive();
      // 这边做一个标记位。而不是看 cacheMemberLastActive 是否为空，因为在没有移除成员前，新消息来，也存到了 cacheMemberLastActive 中。
      if (!cacheMemberLastActive?.flag) {
        const memberLastActive =
          (await (window as any).Signal.Data.getGroupMemberLastActiveList(
            ev.detail.groupId
          )) || [];
        for (let i = 0; i < memberLastActive.length; i++) {
          cacheMemberLastActive[memberLastActive[i]?.number] =
            memberLastActive[i]?.lastActive || 0;
        }
        cacheMemberLastActive.flag = true;

        // 拉取完后更新
        memoryConversation.setCacheMemberLastActive(cacheMemberLastActive);
      }
      for (let i = 0; i < members.length; i++) {
        if (members[i].id === ourNumber) {
          meOwner = members[i].role === 0;
          break;
        }
      }
      for (let i = 0; i < members.length; i++) {
        let pushItem = { id: members[i].id };
        for (let index = 0; index < allItems.length; index += 1) {
          if (members[i].id === allItems[index].id) {
            const item = { ...allItems[index] };
            pushItem = item;
            break;
          }
        }
        leftItems.push(pushItem);
        // 自己不可以编辑
        if (members[i].id === ourNumber) {
          disabledItems.push(members[i].id);
          continue;
        }

        if (!meOwner) {
          // 创建者，管理员，不可以编辑
          if (members[i].role !== 2) {
            disabledItems.push(members[i].id);
          }
        }
      }
      leftItems.sort((left: any, right: any) => {
        if (left.id === ourNumber) {
          return 1;
        }
        if (right.id === ourNumber) {
          return -1;
        }
        const leftLastActive = cacheMemberLastActive?.[left.id] || 0;
        const rightLastActive = cacheMemberLastActive?.[right.id] || 0;
        if (leftLastActive === rightLastActive) {
          const leftLower = (left.name || left.id).toLowerCase().trim();
          const rightLower = (right.name || right.id).toLowerCase().trim();
          return collator.compare(leftLower, rightLower);
        } else {
          return leftLastActive - rightLastActive;
        }
      });
      setMembersChangeItems(leftItems);
      setMembersChangeDisabledItems(disabledItems);
      setMembersChangeGroupName(conversation.get('name'));
      setShowMembersChangeDialog(true);
    }
    if (ev.detail.type === 'add-group-admins' && ev.detail.groupId) {
      setMembersChangeType(ev.detail.type);
      setMembersChangeGroupId(ev.detail.groupId);

      const conversation = await (
        window as any
      ).Signal.Data.getConversationById(ev.detail.groupId, {
        Conversation: (window as any).Whisper.Conversation,
      });

      const leftItems = [];
      const disabledItems: any = [];
      const members = conversation.get('membersV2') || [];
      for (let i = 0; i < members.length; i++) {
        let pushItem = { id: members[i].id };
        for (let index = 0; index < allItems.length; index += 1) {
          if (members[i].id === allItems[index].id) {
            pushItem = allItems[index];
          }
        }
        leftItems.push(pushItem);
        if (members[i].role !== 2) {
          disabledItems.push(members[i].id);
        }
      }
      leftItems.sort((left: any, right: any) => {
        if (left.id === ourNumber) {
          return -1;
        }
        if (right.id === ourNumber) {
          return 1;
        }
        const leftLower = (left.name || left.id).toLowerCase().trim();
        const rightLower = (right.name || right.id).toLowerCase().trim();
        return collator.compare(leftLower, rightLower);
      });
      setMembersChangeItems(leftItems);
      setMembersChangeDisabledItems(disabledItems);
      setMembersChangeGroupName(conversation.get('name'));
      setShowMembersChangeDialog(true);
    }
    if (ev.detail.type === 'remove-group-admins' && ev.detail.groupId) {
      setMembersChangeType(ev.detail.type);
      setMembersChangeGroupId(ev.detail.groupId);

      const conversation = await (
        window as any
      ).Signal.Data.getConversationById(ev.detail.groupId, {
        Conversation: (window as any).Whisper.Conversation,
      });

      const leftItems = [];
      const members = conversation.get('membersV2') || [];
      for (let i = 0; i < members.length; i++) {
        let pushItem = { id: members[i].id };
        for (let index = 0; index < allItems.length; index += 1) {
          if (members[i].id === allItems[index].id) {
            pushItem = allItems[index];
          }
        }
        if (members[i].role !== 2) {
          leftItems.push(pushItem);
        }
      }
      leftItems.sort((left: any, right: any) => {
        if (left.id === ourNumber) {
          return -1;
        }
        if (right.id === ourNumber) {
          return 1;
        }
        const leftLower = (left.name || left.id).toLowerCase().trim();
        const rightLower = (right.name || right.id).toLowerCase().trim();
        return collator.compare(leftLower, rightLower);
      });
      setMembersChangeItems(leftItems);
      setMembersChangeDisabledItems([ourNumber]);
      setMembersChangeGroupName(conversation.get('name'));
      setShowMembersChangeDialog(true);
    }

    if (ev.detail.type === 'call-add') {
      setShowCreateGroupDialog(false);
      setMembersChangeGroupName(ev.detail.callName || 'TempTalk Call');
      setMembersChangeType(ev.detail.type);
      await getContactsUsers();
      setMembersChangeDisabledItems(ev.detail.currentMembers ?? []);
      setShowMembersChangeDialog(true);
    }
  };

  return (
    <>
      <Notice />
      {showMembersChangeDialog ? (
        <MembersChange
          i18n={i18n}
          type={membersChangeType as IMembersChangeProps['type']}
          onClose={() => {
            if (
              ['call-add'].includes(
                membersChangeType as IMembersChangeProps['type']
              )
            ) {
              (window as any).showCallWindow();
            }
            setShowMembersChangeDialog(false);
          }}
          onConfirm={onConfirm}
          groupName={membersChangeGroupName}
          items={membersChangeItems}
          disabledItems={membersChangeDisabledItems}
          loading={loading}
        ></MembersChange>
      ) : null}
      {showCreateGroupDialog && (
        <CreateGroup
          i18n={i18n}
          type={membersChangeType as ICreateGroupProps['type']}
          onClose={() => {
            setShowCreateGroupDialog(false);
          }}
          onConfirm={onConfirm}
          groupName={membersChangeGroupName}
          items={membersChangeItems}
          disabledItems={membersChangeDisabledItems}
          loading={loading}
        ></CreateGroup>
      )}
    </>
  );
}
