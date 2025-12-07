import { createSelector } from 'reselect';
import { format } from '../../types/PhoneNumber';

import { LocalizerType } from '../../types/Util';
import { StateType } from '../reducer';
import {
  CallsStateType,
  ConversationCallStateType,
  ConversationLookupType,
  ConversationsStateType,
  ConversationType,
  MemberGroupLookupType,
} from '../ducks/conversations';
import { getIntl, getRegionCode, getUserNumber } from './user';
import { uniq } from 'lodash';
import { DockItemType } from '../ducks/dock';

export const getConversations = (state: StateType): ConversationsStateType =>
  state.conversations;
const getContactSearch = (state: StateType): string =>
  state.contactSearch.query;

const currentDockItem = (state: StateType): DockItemType => state.dock.current;

export const getConversationLookup = createSelector(
  getConversations,
  (state: ConversationsStateType): ConversationLookupType => {
    return state.conversationLookup;
  }
);

export const getMemberGroupLookup = createSelector(
  getConversations,
  (state: ConversationsStateType): MemberGroupLookupType => {
    return state.memberGroupLookup;
  }
);

export const getSortedContacts = createSelector(
  [currentDockItem, getIntl, getConversationLookup, getContactSearch],
  (
    dockItem: DockItemType,
    i18n: LocalizerType,
    state: ConversationLookupType,
    searchTerm: string
  ): Array<ConversationType> => {
    if (dockItem !== 'contact') {
      return [];
    }

    const results: Array<ConversationType> = [];
    const search = searchTerm.toLowerCase();

    const SEARCHED_FIELDS = [
      'accountName',
      'name',
      'email',
      'signature',
      'id',
      'title',
      'profileName',
      'protectedConfigs',
    ];

    const searchField = (conversation: { [x: string]: any }, field: string) => {
      const value = conversation[field];

      if (field === 'protectedConfigs') {
        // skip this
      } else {
        if (value && value.toLowerCase().includes(search)) {
          return {
            field,
            value,
            position: value.toLowerCase().indexOf(search),
            searchWord: search,
          };
        }
      }

      return null;
    };

    Object.keys(state).forEach((k: string) => {
      const c = state[k];
      if (c.type !== 'direct' || !c.directoryUser) {
        return;
      }

      if (!search) {
        //reset firstMatch
        c.firstMatch = undefined;
        results.push(c);
        return;
      }

      for (const field of SEARCHED_FIELDS) {
        const firstMatch = searchField(c, field);
        if (firstMatch) {
          results.push({ ...c, firstMatch });
          return;
        }
      }

      // for self
      if (c.isMe) {
        const name = i18n('me');
        if (name.toLowerCase().includes(search)) {
          results.push(c);
          return;
        }
      }
    });

    results.sort((left: ConversationType, right: ConversationType) => {
      const getTitle = (item: ConversationType) => {
        return (
          item.name ||
          (item as any).title ||
          (item as any).profileName ||
          item.id
        ).trim();
      };

      if (left.isMe) {
        return -1;
      }

      if (right.isMe) {
        return 1;
      }

      if (left.firstMatch && right.firstMatch) {
        const diffField =
          SEARCHED_FIELDS.indexOf(left.firstMatch.field) -
          SEARCHED_FIELDS.indexOf(right.firstMatch.field);

        if (diffField !== 0) {
          return diffField;
        }

        const diffPosition =
          left.firstMatch.position - right.firstMatch.position;
        if (diffPosition !== 0) {
          return diffPosition;
        }

        if (left.firstMatch.value < right.firstMatch.value) {
          return -1;
        } else if (left.firstMatch.value > right.firstMatch.value) {
          return 1;
        } else {
          return 0;
        }
      }

      const leftLower = getTitle(left).toLowerCase();
      const rightLower = getTitle(right).toLowerCase();

      return collator.compare(leftLower, rightLower);
    });

    return results;
  }
);

export const getSelectedConversation = createSelector(
  getConversations,
  (state: ConversationsStateType): string | undefined => {
    return state.selectedConversation;
  }
);

export const getCalls = createSelector(
  getConversations,
  (state: ConversationsStateType): CallsStateType | undefined => {
    return state.calls;
  }
);

export const getConversationCalls = createSelector(
  [getConversations, getUserNumber],
  (
    state: ConversationsStateType
    // ourNumber: string
  ): ConversationCallStateType | undefined => {
    const { calls } = state;
    if (!calls) {
      return undefined;
    }

    const conversationCalls: ConversationCallStateType = {};

    for (const call of Object.values(calls)) {
      if (!call) {
        continue;
      }
      const { conversation, roomId, type } = call!;

      if (type !== 'instant') {
        conversationCalls[conversation] = call;
      } else {
        conversationCalls[roomId] = call;
      }
    }

    return conversationCalls;
  }
);

export const getShowArchived = createSelector(
  getConversations,
  (state: ConversationsStateType): boolean => {
    return Boolean(state.showArchived);
  }
);

function getConversationTitle(
  conversation: ConversationType,
  options: { i18n: LocalizerType; ourRegionCode: string }
): string {
  if (conversation.name) {
    return conversation.name;
  }

  if (conversation.type === 'group') {
    const { i18n } = options;

    return i18n('unknownGroup');
  }

  return format(conversation.phoneNumber, options);
}

const collator = new Intl.Collator();

const _positiveComparator = (
  left?: number | boolean,
  right?: number | boolean
) => {
  return (Number(right) || 0) - (Number(left) || 0);
};

export const _getConversationComparator = (
  i18n: LocalizerType,
  ourRegionCode: string
) => {
  return (left: ConversationType, right: ConversationType): number => {
    let result = _positiveComparator(left.activeAt, right.activeAt);
    if (result) {
      return result;
    }

    result = _positiveComparator(left.timestamp, right.timestamp);
    if (result) {
      return result;
    }

    const options = { i18n, ourRegionCode };
    const leftTitle = getConversationTitle(left, options).toLowerCase();
    const rightTitle = getConversationTitle(right, options).toLowerCase();

    return collator.compare(leftTitle, rightTitle);
  };
};

export const getConversationComparator = createSelector(
  getIntl,
  getRegionCode,
  _getConversationComparator
);

export const _getLeftPaneLists = (
  lookup: ConversationLookupType,
  comparator: (left: ConversationType, right: ConversationType) => number,
  selectedConversation?: string,
  calls?: CallsStateType,
  conversationCalls?: ConversationCallStateType
): {
  conversations: Array<ConversationType>;
  archivedConversations: Array<ConversationType>;
  calls: CallsStateType | undefined;
} => {
  const activeConversations: ConversationType[] = [];
  const stickedConversations: ConversationType[] = [];
  const archivedConversations: ConversationType[] = [];
  const callConversations: ConversationType[] = [];

  for (const [key, value] of Object.entries(lookup)) {
    let conversation = value;

    if (key === selectedConversation) {
      conversation = {
        ...conversation,
        isSelected: true,
      };
    }

    const { activeAt, isStick, isArchived } = conversation;

    if (isStick) {
      stickedConversations.push(conversation);
    }

    if (conversationCalls?.[key]) {
      callConversations.push(conversation);
    }

    if (isArchived) {
      archivedConversations.push(conversation);
    } else if (activeAt) {
      activeConversations.push(conversation);
    }
  }

  activeConversations.sort(comparator);
  stickedConversations.sort(comparator);
  archivedConversations.sort(comparator);

  return {
    // _.uniq : only the first occurrence of each element is kept
    conversations: uniq([
      ...callConversations,
      ...stickedConversations,
      ...activeConversations,
    ]),
    archivedConversations,
    calls,
  };
};

export const getLeftPaneLists = createSelector(
  getConversationLookup,
  getConversationComparator,
  getSelectedConversation,
  getCalls,
  getConversationCalls,
  _getLeftPaneLists
);

export const getMe = createSelector(
  [getConversationLookup, getUserNumber],
  (lookup: ConversationLookupType, ourNumber: string): ConversationType => {
    return lookup[ourNumber];
  }
);
