// Actions
export type SetPreferenceActionType = {
  type: 'SET_PREFERENCE';
  payload: {
    key: keyof PreferencesStateType;
    value: PreferencesStateType[keyof PreferencesStateType];
  };
};

export type PREFERENCES_TYPES = SetPreferenceActionType;

// Action Creators
export const actions = {
  setLeftPaneWidth,
};

function setPreference(
  key: keyof PreferencesStateType,
  value: PreferencesStateType[keyof PreferencesStateType]
): SetPreferenceActionType {
  return {
    type: 'SET_PREFERENCE',
    payload: { key, value },
  };
}

function setLeftPaneWidth(value: number): SetPreferenceActionType {
  return setPreference('leftPaneWidth', value);
}

// State
export type PreferencesStateType = {
  leftPaneWidth: number;
};

// Reducer
function getEmptyState(): PreferencesStateType {
  return {
    leftPaneWidth: 300,
  };
}

export function reducer(
  state: PreferencesStateType | undefined,
  action: PREFERENCES_TYPES
): PreferencesStateType {
  if (!state) {
    return getEmptyState();
  }

  if (action.type === 'SET_PREFERENCE') {
    const { payload } = action;
    const { key, value } = payload;

    return {
      ...state,
      [key]: value,
    };
  }

  return state;
}
