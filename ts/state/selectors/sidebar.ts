import { SidebarItemType } from '../ducks/sidebar';
import { StateType } from '../reducer';

export const getSidebarItemList = (state: StateType): SidebarItemType[] => {
  return state.sidebar.itemList;
};
