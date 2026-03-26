import { StateType } from '../reducer';

export const getCommonSettingOpen = (state: StateType): boolean => {
  return state.layout.commonSettingOpen;
};
