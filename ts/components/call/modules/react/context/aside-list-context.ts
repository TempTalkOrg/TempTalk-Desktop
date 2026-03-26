export type AsideListState = {
  open: boolean;
};

export type AsideListAction = {
  msg: 'toggle_aside_list';
};

export type AsideListContextType = {
  dispatch?: React.Dispatch<AsideListAction>;
  state?: AsideListState;
};

export function asideListReducer(
  state: AsideListState,
  action: AsideListAction
): AsideListState {
  if (action.msg === 'toggle_aside_list') {
    return { open: !state.open };
  } else {
    return state;
  }
}
