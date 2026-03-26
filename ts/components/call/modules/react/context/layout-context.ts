import { ASIDE_LIST_DEFAULT_STATE, PIN_DEFAULT_STATE } from '../../core';
import React, { useContext, useReducer } from 'react';
import type { PinContextType } from './pin-context';
import { pinReducer } from './pin-context';
import type { AsideListContextType } from './aside-list-context';
import { asideListReducer } from './aside-list-context';

export type LayoutContextType = {
  pin: PinContextType;
  asideList: AsideListContextType;
};

export const LayoutContext = React.createContext<LayoutContextType | undefined>(
  undefined
);

export function useLayoutContext(): LayoutContextType {
  const layoutContext = React.useContext(LayoutContext);
  if (!layoutContext) {
    throw Error(
      'Tried to access LayoutContext context outside a LayoutContextProvider provider.'
    );
  }
  return layoutContext;
}

export function useEnsureLayoutContext(layoutContext?: LayoutContextType) {
  const layout = useMaybeLayoutContext();
  layoutContext ??= layout;
  if (!layoutContext) {
    throw Error(
      'Tried to access LayoutContext context outside a LayoutContextProvider provider.'
    );
  }
  return layoutContext;
}

export function useCreateLayoutContext(): LayoutContextType {
  const [pinState, pinDispatch] = useReducer(pinReducer, PIN_DEFAULT_STATE);
  const [asideListState, asideListDispatch] = useReducer(
    asideListReducer,
    ASIDE_LIST_DEFAULT_STATE
  );
  return {
    pin: { dispatch: pinDispatch, state: pinState },
    asideList: { dispatch: asideListDispatch, state: asideListState },
  };
}

export function useEnsureCreateLayoutContext(
  layoutContext?: LayoutContextType
): LayoutContextType {
  const [pinState, pinDispatch] = useReducer(pinReducer, PIN_DEFAULT_STATE);
  const [asideListState, asideListDispatch] = useReducer(
    asideListReducer,
    ASIDE_LIST_DEFAULT_STATE
  );
  return (
    layoutContext ?? {
      pin: { dispatch: pinDispatch, state: pinState },
      asideList: { dispatch: asideListDispatch, state: asideListState },
    }
  );
}

export function useMaybeLayoutContext(): LayoutContextType | undefined {
  return useContext(LayoutContext);
}
