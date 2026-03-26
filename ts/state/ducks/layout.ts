export type LayoutStateType = {
  commonSettingOpen: boolean;
};

export type LayoutActionType = ToggleCommonSettingActionType;

export type ToggleCommonSettingActionType = {
  type: 'TOGGLE_COMMON_SETTING';
  payload?: boolean;
};

function toggleCommonSetting(open?: boolean): ToggleCommonSettingActionType {
  return {
    type: 'TOGGLE_COMMON_SETTING',
    payload: open,
  };
}

export const actions = {
  toggleCommonSetting,
};

export function reducer(
  state: LayoutStateType | undefined,
  action: LayoutActionType
): LayoutStateType {
  if (!state) {
    return {
      commonSettingOpen: false,
    };
  }

  if (action.type === 'TOGGLE_COMMON_SETTING') {
    const { payload } = action;

    const commonSettingOpen =
      payload !== undefined ? payload : !state.commonSettingOpen;

    return {
      ...state,
      commonSettingOpen,
    };
  }

  return state;
}
