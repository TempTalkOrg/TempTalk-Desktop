import { createSelector } from 'reselect';
import { PreferencesStateType } from '../ducks/preferences';
import { StateType } from '../reducer';

const getPreferences = (state: StateType): PreferencesStateType =>
  state.preferences;

export const getLeftPaneWidth = createSelector(
  getPreferences,
  (state: PreferencesStateType): PreferencesStateType['leftPaneWidth'] => {
    return state.leftPaneWidth;
  }
);
