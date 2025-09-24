import { difference, omit } from 'lodash';

import { trigger } from '../../shims/events';
import { NoopActionType } from './noop';
import { makeLookup } from '../../util/makeLookup';

export type MessageType = {
  id: string;
  conversationId: string;
  sentAt: number;
  receivedAt: number;
  serverTimestamp: number;

  snippet: string;

  from: {
    phoneNumber: string;
    isMe?: boolean;
    name?: string;
    color?: string;
    profileName?: string;
    avatarPath?: string;
  };

  to: {
    groupName?: string;
    phoneNumber: string;
    isMe?: boolean;
    name?: string;
    profileName?: string;
  };

  isSelected?: boolean;
};

export type DBConversationType = {
  id: string;
  lastMessage: string;
  type: string;
  left?: boolean;
  active_at?: number;
  directoryUser?: boolean;
  disbanded?: boolean;
};

export type ProtectedConfigs = {};

export type SearchMacthInfoType = {
  field: string;
  value: string;
  position: number;
  searchWord: string;
};

export type ConversationType = {
  keyPosition?: number;
  id: string;
  name?: string;
  isArchived: boolean;
  activeAt?: number;
  timestamp: number;
  lastMessage?: {
    status: 'error' | 'sending' | 'sent' | 'delivered' | 'read';
    text: string;
  };
  atPersons?: string;
  phoneNumber: string;
  type: 'direct' | 'group';
  isMe: boolean;
  lastUpdated: number;
  unreadCount: number;
  isSelected: boolean;
  isTyping: boolean;
  signature?: string;
  timeZone?: string;
  email?: string;
  directoryUser?: boolean;
  isStick?: boolean;
  members?: Array<string>;
  notificationSetting?: number;
  firstMatch?: SearchMacthInfoType;
  searchResultMembers?: Array<ConversationType>;
  protectedConfigs?: ProtectedConfigs;
  isAliveGroup?: boolean;
};
export type ConversationLookupType = {
  [key: string]: ConversationType;
};

export type MemberGroupLookupType = {
  [key: string]: Array<string>;
};

export type ConversationsStateType = {
  conversationLookup: ConversationLookupType;
  memberGroupLookup: MemberGroupLookupType;
  selectedConversation?: string;
  showArchived: boolean;
  calls: CallsStateType;
};

export type CallType = {
  conversation: string;
  roomId: string;
  type: '1on1' | 'instant' | 'group';
  caller: {
    uid: string;
    did?: number;
  };
  createdAt?: number;
  encMeta?: any;
  version: number;
  name?: string;
};

export type CallsStateType = {
  [key: string]: CallType | undefined;
};

export type ConversationCallStateType = {
  [conversationId: string]: CallType | undefined;
};

// Actions

type ConversationAddedActionType = {
  type: 'CONVERSATION_ADDED';
  payload: {
    id: string;
    data: ConversationType;
  };
};
type ConversationChangedActionType = {
  type: 'CONVERSATION_CHANGED';
  payload: {
    id: string;
    data: ConversationType;
  };
};
type ConversationRemovedActionType = {
  type: 'CONVERSATION_REMOVED';
  payload: {
    id: string;
  };
};

type ConversationBulkUpdateActionType = {
  type: 'CONVERSATION_BULK_UPDATE';
  payload: {
    data: Array<ConversationType>;
  };
};

export type RemoveAllConversationsActionType = {
  type: 'CONVERSATIONS_REMOVE_ALL';
  payload: null;
};
export type MessageExpiredActionType = {
  type: 'MESSAGE_EXPIRED';
  payload: {
    id: string;
    conversationId: string;
  };
};
export type SelectedConversationChangedActionType = {
  type: 'SELECTED_CONVERSATION_CHANGED';
  payload: {
    id: string;
    messageId?: string;
  };
};
type ShowInboxActionType = {
  type: 'SHOW_INBOX';
  payload: null;
};
type ShowArchivedConversationsActionType = {
  type: 'SHOW_ARCHIVED_CONVERSATIONS';
  payload: null;
};

// Actions
type CallAddedActionType = {
  type: 'CALL_ADDED';
  payload: CallType;
};

type CallRemovedActionType = {
  type: 'CALL_REMOVED';
  payload: {
    conversation?: string;
    roomId?: string;
  };
};

type CallResetActionType = {
  type: 'CALL_RESET';
};

function callAdded(callInfo: CallType) {
  return {
    type: 'CALL_ADDED',
    payload: {
      ...callInfo,
    },
  };
}

function callRemoved({
  roomId,
  conversation,
}: {
  roomId: string;
  conversation: string;
}) {
  return {
    type: 'CALL_REMOVED',
    payload: {
      roomId,
      conversation,
    },
  };
}

function callReset() {
  return {
    type: 'CALL_RESET',
  };
}

export type ConversationActionType =
  | ConversationAddedActionType
  | ConversationChangedActionType
  | ConversationRemovedActionType
  | RemoveAllConversationsActionType
  | ConversationBulkUpdateActionType
  | MessageExpiredActionType
  | SelectedConversationChangedActionType
  | MessageExpiredActionType
  | SelectedConversationChangedActionType
  | ShowInboxActionType
  | ShowArchivedConversationsActionType
  | CallAddedActionType
  | CallRemovedActionType
  | CallResetActionType;
// Action Creators

export const actions = {
  conversationAdded,
  conversationChanged,
  conversationRemoved,
  conversationStick,
  conversationLeaveGroup,
  conversationDisbandGroup,
  conversationMute,
  conversationArchived,
  removeAllConversations,
  conversationsBulkUpdate,
  messageExpired,
  openConversationInternal,
  openConversationExternal,
  showInbox,
  showArchivedConversations,
  deleteMessages,
  callAdded,
  callRemoved,
  callReset,
};

function conversationAdded(
  id: string,
  data: ConversationType
): ConversationAddedActionType {
  return {
    type: 'CONVERSATION_ADDED',
    payload: {
      id,
      data,
    },
  };
}

function conversationChanged(
  id: string,
  data: ConversationType
): ConversationChangedActionType {
  return {
    type: 'CONVERSATION_CHANGED',
    payload: {
      id,
      data,
    },
  };
}

function conversationRemoved(id: string): ConversationRemovedActionType {
  return {
    type: 'CONVERSATION_REMOVED',
    payload: {
      id,
    },
  };
}

function conversationStick(id: string, stick: boolean): NoopActionType {
  trigger('conversationStick', id, stick);
  return {
    type: 'NOOP',
    payload: null,
  };
}
function conversationLeaveGroup(id: string): NoopActionType {
  trigger('conversationLeaveGroup', id);
  return {
    type: 'NOOP',
    payload: null,
  };
}
function conversationDisbandGroup(id: string): NoopActionType {
  trigger('conversationDisbandGroup', id);
  return {
    type: 'NOOP',
    payload: null,
  };
}

function conversationMute(id: string, mute: boolean): NoopActionType {
  trigger('conversationMute', id, mute);
  return {
    type: 'NOOP',
    payload: null,
  };
}

function conversationArchived(id: string): NoopActionType {
  trigger('conversationArchived', id);
  return {
    type: 'NOOP',
    payload: null,
  };
}

function removeAllConversations(): RemoveAllConversationsActionType {
  return {
    type: 'CONVERSATIONS_REMOVE_ALL',
    payload: null,
  };
}

function conversationsBulkUpdate(
  data: Array<ConversationType>
): ConversationBulkUpdateActionType {
  return {
    type: 'CONVERSATION_BULK_UPDATE',
    payload: {
      data,
    },
  };
}

function messageExpired(
  id: string,
  conversationId: string
): MessageExpiredActionType {
  return {
    type: 'MESSAGE_EXPIRED',
    payload: {
      id,
      conversationId,
    },
  };
}

// Note: we need two actions here to simplify. Operations outside of the left pane can
//   trigger an 'openConversation' so we go through Whisper.events for all conversation
//   selection.
function openConversationInternal(
  id: string,
  messageId?: string
): NoopActionType {
  trigger('showConversation', id, messageId);

  return {
    type: 'NOOP',
    payload: null,
  };
}

function openConversationExternal(
  id: string,
  messageId?: string
): SelectedConversationChangedActionType {
  return {
    type: 'SELECTED_CONVERSATION_CHANGED',
    payload: {
      id,
      messageId,
    },
  };
}

function showInbox() {
  return {
    type: 'SHOW_INBOX',
    payload: null,
  };
}

function showArchivedConversations() {
  return {
    type: 'SHOW_ARCHIVED_CONVERSATIONS',
    payload: null,
  };
}

function deleteMessages(id: string, type: string): NoopActionType {
  trigger('deleteMessages', id, type);

  return {
    type: 'NOOP',
    payload: null,
  };
}

// Reducer

function getEmptyState(): ConversationsStateType {
  return {
    conversationLookup: {},
    memberGroupLookup: {},
    showArchived: false,
    calls: {},
  };
}

export function reducer(
  state: ConversationsStateType,
  action: ConversationActionType
): ConversationsStateType {
  if (!state) {
    return getEmptyState();
  }

  const memberAdded = (
    lookup: MemberGroupLookupType,
    member: string,
    id: string
  ) => {
    const groups = lookup[member];
    if (groups) {
      if (!groups.includes(id)) {
        groups.push(id);
      }
    } else {
      lookup[member] = [id];
    }
  };

  const memberRemoved = (
    lookup: MemberGroupLookupType,
    member: string,
    id: string
  ) => {
    const groups = lookup[member];
    if (groups) {
      groups.splice(groups.indexOf(id), 1);
    }
  };

  const { memberGroupLookup } = state;

  if (action.type === 'CONVERSATION_ADDED') {
    const { payload } = action;
    const { id, data } = payload;
    const { type, members } = data;
    const { conversationLookup } = state;

    if (type === 'group' && members?.length) {
      members.forEach(member => memberAdded(memberGroupLookup, member, id));
    }

    return {
      ...state,
      conversationLookup: {
        ...conversationLookup,
        [id]: data,
      },
      memberGroupLookup,
    };
  }
  if (action.type === 'CONVERSATION_CHANGED') {
    const { payload } = action;
    const { id, data } = payload;
    const { conversationLookup } = state;
    let showArchived = state.showArchived;
    let selectedConversation = state.selectedConversation;

    const existing = conversationLookup[id];
    // In the change case we only modify the lookup if we already had that conversation
    if (!existing) {
      return state;
    }

    if (selectedConversation === id) {
      // Archived -> Inbox: we go back to the normal inbox view
      if (existing.isArchived && !data.isArchived) {
        showArchived = false;
      }
      // Inbox -> Archived: no conversation is selected
      // Note: With today's stacked converastions architecture, this can result in weird
      //   behavior - no selected conversation in the left pane, but a conversation show
      //   in the right pane.
      if (!existing.isArchived && data.isArchived) {
        selectedConversation = undefined;
      }
    }

    if (data.type === 'group' && data.members?.length) {
      const addedMembers = difference(
        data.members || [],
        existing.members || []
      );
      const removedMembers = difference(
        existing.members || [],
        data.members || []
      );

      addedMembers.forEach(member =>
        memberAdded(memberGroupLookup, member, id)
      );
      removedMembers.forEach(member =>
        memberRemoved(memberGroupLookup, member, id)
      );
    }

    return {
      ...state,
      selectedConversation,
      showArchived,
      conversationLookup: {
        ...conversationLookup,
        [id]: data,
      },
      memberGroupLookup,
    };
  }

  if (action.type === 'CONVERSATION_REMOVED') {
    const { payload } = action;
    const { id } = payload;
    const { conversationLookup } = state;

    const existing = conversationLookup[id];
    const { type, members } = existing || {};
    if (type === 'group' && members?.length) {
      members.forEach(member => memberRemoved(memberGroupLookup, member, id));
    }

    return {
      ...state,
      conversationLookup: omit(conversationLookup, [id]),
      memberGroupLookup,
    };
  }

  if (action.type === 'CONVERSATIONS_REMOVE_ALL') {
    return getEmptyState();
  }

  if (action.type === 'CONVERSATION_BULK_UPDATE') {
    const { payload } = action;
    const { data } = payload;
    const { conversationLookup } = state;

    const newLookup = makeLookup(data, 'id');

    data.forEach(c => {
      const existing = conversationLookup[c.id];
      if (existing?.type === 'group') {
        const addedMembers = difference(
          c.members || [],
          existing.members || []
        );
        const removedMembers = difference(
          existing.members || [],
          c.members || []
        );

        addedMembers.forEach(member =>
          memberAdded(memberGroupLookup, member, c.id)
        );
        removedMembers.forEach(member =>
          memberRemoved(memberGroupLookup, member, c.id)
        );
      }
    });

    return {
      ...state,
      conversationLookup: {
        ...conversationLookup,
        ...newLookup,
      },
      memberGroupLookup,
    };
  }

  if (action.type === 'MESSAGE_EXPIRED') {
    // noop - for now this is only important for search
  }
  if (action.type === 'SELECTED_CONVERSATION_CHANGED') {
    const { payload } = action;
    const { id } = payload;

    return {
      ...state,
      selectedConversation: id,
    };
  }
  if (action.type === 'SHOW_INBOX') {
    return {
      ...state,
      showArchived: false,
    };
  }
  if (action.type === 'SHOW_ARCHIVED_CONVERSATIONS') {
    return {
      ...state,
      showArchived: true,
    };
  }

  if (action.type === 'CALL_ADDED') {
    const { payload } = action;
    const { conversation, type, roomId } = payload;
    const key = type === 'instant' ? roomId : conversation;

    const nextState = {
      ...state,
      calls: {
        ...state.calls,
        [key]: {
          ...state.calls?.[key],
          ...payload,
        },
      },
    };
    return nextState;
  }

  if (action.type === 'CALL_REMOVED') {
    const { payload } = action;
    const { conversation, roomId } = payload;

    if (conversation) {
      if (state.calls?.[conversation]) {
        return {
          ...state,
          calls: {
            ...state.calls,
            [conversation]: undefined,
          },
        };
      }
    } else if (roomId) {
      const calls = { ...state.calls };
      Object.keys(calls).forEach(key => {
        if (calls[key]?.roomId === roomId) {
          calls[key] = undefined;
        }
      });
      return {
        ...state,
        calls,
      };
    }
  }

  if (action.type === 'CALL_RESET') {
    return {
      ...state,
      calls: {},
    };
  }

  return state;
}
