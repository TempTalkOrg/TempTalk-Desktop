import { intersection, compact } from 'lodash';
import { createSelector } from 'reselect';

import { StateType } from '../reducer';

import { SearchStateType } from '../ducks/search';
import {
  getConversationLookup,
  getMemberGroupLookup,
  getSelectedConversation,
} from './conversations';
import {
  ConversationLookupType,
  ConversationType,
  MemberGroupLookupType,
} from '../ducks/conversations';

import { getRegionCode } from './user';

export const getSearch = (state: StateType): SearchStateType => state.search;

export const getQuery = createSelector(
  getSearch,
  (state: SearchStateType): string => state.query
);

export const getSelectedMessage = createSelector(
  getSearch,
  (state: SearchStateType): string | undefined => state.selectedMessage
);

export const isSearching = createSelector(
  getSearch,
  (state: SearchStateType) => {
    const { query } = state;

    return query && query.trim().length >= 1;
  }
);

export const getSearchResults = createSelector(
  [
    getSearch,
    getRegionCode,
    getConversationLookup,
    getMemberGroupLookup,
    getSelectedConversation,
    getSelectedMessage,
  ],
  (
    state: SearchStateType,
    regionCode: string,
    lookup: ConversationLookupType,
    memberGroupLookup: MemberGroupLookupType,
    selectedConversation?: string,
    selectedMessage?: string
  ) => {
    const search = state.query.toLowerCase();
    const contactsMap: { [x: string]: ConversationType } = {};

    const SEARCHED_FIELDS = [
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
        if (value) {
          const position = value.toLowerCase().indexOf(search);
          if (position !== -1) {
            conversation.firstMatch = {
              field,
              value,
              position,
              searchWord: search,
            };
            return true;
          }
        }
      }
      return false;
    };

    Object.keys(lookup).forEach((id: string) => {
      const value = { ...lookup[id] };

      for (const field of SEARCHED_FIELDS) {
        if (searchField(value, field)) {
          if (value.type === 'group' && !value.isAliveGroup) {
            return;
          }
          contactsMap[id] = value;
          return;
        }
      }

      return;
    });

    const { ourNumber, noteToSelf } = state;
    if (search && ourNumber && noteToSelf) {
      const position = noteToSelf.toLowerCase().indexOf(search);
      if (position !== -1) {
        const me = lookup[ourNumber];
        contactsMap[ourNumber] = {
          ...me,
          firstMatch: {
            field: 'name',
            value: noteToSelf,
            position,
            searchWord: search,
          },
        };
      }
    }

    const contactCompare = (
      left: ConversationType,
      right: ConversationType
    ) => {
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

      if (left.firstMatch) {
        return -1;
      }

      if (right.firstMatch) {
        return 1;
      }

      if (left.activeAt || right.activeAt) {
        return (left.activeAt ?? 0) > (right.activeAt ?? 0) ? -1 : 1;
      }

      const leftName = left.name ? left.name : left.id;
      const rightName = right.name ? right.name : right.id;

      if (leftName < rightName) {
        return -1;
      } else if (leftName > rightName) {
        return 1;
      } else {
        return 0;
      }
    };

    const recentCompare = (
      left: ConversationType,
      right: ConversationType
    ): number => {
      if (!left.isAliveGroup != !right.isAliveGroup) {
        if (left.type === 'group' && !left.isAliveGroup) {
          return 1;
        } else if (right.type === 'group' && !right.isAliveGroup) {
          return -1;
        }
      }

      if (left.isArchived !== right.isArchived) {
        if (left.isArchived) {
          return 1;
        } else if (right.isArchived) {
          return -1;
        }
      }

      return contactCompare(left, right);
    };

    const privateContactIds: Array<string> = [];
    const privateContactMap: any = {};

    const mapIdToObject = (id: string) => {
      const value = { ...lookup[id] };

      for (const field of SEARCHED_FIELDS) {
        if (searchField(value, field)) {
          break;
        }
      }

      if (value.type === 'direct') {
        privateContactIds.push(id);
        privateContactMap[id] = value;
      }

      if (value && id === selectedConversation) {
        return {
          ...value,
          isSelected: true,
        };
      }

      return value;
    };

    const conversations = state.conversations
      .map(mapIdToObject)
      .filter(
        obj =>
          obj.activeAt && Date.now() - obj.activeAt < 60 * 60 * 24 * 30 * 1000
      );

    const groupContacts: Array<ConversationType> = [];
    const groupContactIds: Array<string> = [];

    const searchGroup = (id: string) => {
      const groupIds = memberGroupLookup[id];
      if (!groupIds?.length) {
        return;
      }

      groupIds.forEach(id => {
        if (!groupContactIds.includes(id)) {
          const group = lookup[id];
          const members = group.members || [];
          // filter signature matched contact
          const searchResultMembers = intersection(members, privateContactIds)
            .map(id => privateContactMap[id])
            .filter(contact => contact.firstMatch?.field !== 'signature');

          if (searchResultMembers.length) {
            const exists = contactsMap[id];
            if (exists) {
              exists.searchResultMembers = searchResultMembers;
            } else {
              if (group.isAliveGroup) {
                groupContacts.push({
                  ...group,
                  searchResultMembers,
                });
              }
            }

            groupContactIds.push(id);
          }
        }
      });
    };

    privateContactIds.forEach(searchGroup);

    return {
      contacts: compact(
        [...Object.values(contactsMap), ...groupContacts].sort(contactCompare)
      ),
      conversations: compact(conversations.sort(recentCompare)),
      hideMessagesHeader: false,
      messages: state.messages.map(message => {
        if (message.id === selectedMessage) {
          return {
            ...message,
            isSelected: true,
          };
        }

        return message;
      }),
      regionCode: regionCode,
      searchTerm: state.query,
      showStartNewConversation: Boolean(
        state.normalizedPhoneNumber && !lookup[state.normalizedPhoneNumber]
      ),
    };
  }
);
