// Actions
export type SidebarItemType = {
  category: 'call' | 'local-search' | 'image-gallery' | 'forward' | 'enlarge';
  name: string;
};

export type AddSidebarItemActionType = {
  type: 'ADD_SIDEBAR_ITEM';
  payload: SidebarItemType;
};

export type RemoveSidebarItemActionType = {
  type: 'REMOVE_SIDEBAR_ITEM';
  payload: SidebarItemType;
};

export type UpdateSidebarStatusActionType = {
  type: 'UPDATE_SIDEBAR_STATUS';
};

export type SIDEBAR_TYPES =
  | AddSidebarItemActionType
  | RemoveSidebarItemActionType
  | UpdateSidebarStatusActionType;

// Action Creators
export const actions = {
  addSidebarItem,
  removeSidebarItem,
  updateSidebarStatus,
};

function addSidebarItem(item: SidebarItemType): AddSidebarItemActionType {
  return {
    type: 'ADD_SIDEBAR_ITEM',
    payload: item,
  };
}

function removeSidebarItem(item: SidebarItemType): RemoveSidebarItemActionType {
  return {
    type: 'REMOVE_SIDEBAR_ITEM',
    payload: item,
  };
}

function updateSidebarStatus(): UpdateSidebarStatusActionType {
  return {
    type: 'UPDATE_SIDEBAR_STATUS',
  };
}

export type SidebarStatusType = 'expanded' | 'collapsed';

// State
export type SidebarStateType = {
  itemList: SidebarItemType[];
  status: SidebarStatusType;
};

// Reducer
function getEmptyState(): SidebarStateType {
  return {
    itemList: [],
    status: 'expanded',
  };
}

export function reducer(
  state: SidebarStateType | undefined,
  action: SIDEBAR_TYPES
): SidebarStateType {
  if (!state) {
    return getEmptyState();
  }

  if (action.type === 'ADD_SIDEBAR_ITEM') {
    const { payload } = action;
    const nextList = state.itemList.filter(
      item => item.category !== payload.category
    );

    return {
      ...state,
      itemList: [
        ...nextList,
        {
          category: payload.category,
          name: payload.name,
        },
      ],
    };
  }

  if (action.type === 'REMOVE_SIDEBAR_ITEM') {
    const { payload } = action;

    return {
      ...state,
      itemList: state.itemList.filter(
        item => item.category !== payload.category
      ),
    };
  }

  if (action.type === 'UPDATE_SIDEBAR_STATUS') {
    const nextStatus = state.status === 'expanded' ? 'collapsed' : 'expanded';

    return {
      ...state,
      status: nextStatus,
    };
  }

  return state;
}
