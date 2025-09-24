// State
export type ContactSearchType = {
  query: string;
};

// Actions
export type ContactSearchChangedActionType = {
  type: 'CONTACT_SEARCH_CHANGED';
  payload: {
    query: string;
  };
};

// Action Creators
export const actions = {
  contactSearchChanged,
};

function contactSearchChanged(query: string): ContactSearchChangedActionType {
  return {
    type: 'CONTACT_SEARCH_CHANGED',
    payload: { query },
  };
}

// Reducer
function getEmptyState(): ContactSearchType {
  return {
    query: '',
  };
}

export function reducer(
  state: ContactSearchType,
  action: ContactSearchChangedActionType
): ContactSearchType {
  if (!state) {
    return getEmptyState();
  }

  if (action.type === 'CONTACT_SEARCH_CHANGED') {
    const { payload } = action;

    return {
      ...payload,
    };
  }

  return state;
}
