import { SidebarItemType } from '../ducks/sidebar';
import { StateType } from '../reducer';

export const getSidebarItemList = (state: StateType): SidebarItemType[] => {
  return state.sidebar.itemList;
};

export const getSidebarStatus = (
  state: StateType
): 'expanded' | 'collapsed' => {
  return state.sidebar.status;
};
