import { StateType } from '../reducer';
import { DockItemType } from '../ducks/dock';

export const getCurrentDockItem = (state: StateType): DockItemType =>
  state.dock.current;
