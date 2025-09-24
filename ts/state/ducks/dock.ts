// State
export type DockItemType = 'chat' | 'contact' | 'others';

export type DockType = {
  current: DockItemType;
};

// Actions
export type CurrentDockItemChangedActionType = {
  type: 'CURRENT_ITEM_CHANGED';
  payload: {
    current: DockItemType;
  };
};

// Action Creators
export const actions = {
  currentDockItemChanged,
};

function currentDockItemChanged(
  current: DockItemType
): CurrentDockItemChangedActionType {
  return {
    type: 'CURRENT_ITEM_CHANGED',
    payload: { current },
  };
}

// Reducer
function getEmptyState(): DockType {
  return {
    current: 'chat',
  };
}

export function reducer(
  state: DockType,
  action: CurrentDockItemChangedActionType
): DockType {
  if (!state) {
    return getEmptyState();
  }

  if (action.type === 'CURRENT_ITEM_CHANGED') {
    const { payload } = action;

    return {
      ...payload,
    };
  }

  return state;
}
