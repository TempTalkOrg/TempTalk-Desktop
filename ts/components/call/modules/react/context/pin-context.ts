import type { PinState, TrackReferenceOrPlaceholder } from '../../core';
import React from 'react';

export type PinAction =
  | {
      msg: 'set_pin';
      trackReference: TrackReferenceOrPlaceholder;
    }
  | { msg: 'clear_pin' };

export type PinContextType = {
  dispatch?: React.Dispatch<PinAction>;
  state?: PinState;
};

export function pinReducer(state: PinState, action: PinAction): PinState {
  if (action.msg === 'set_pin') {
    return [action.trackReference];
  } else if (action.msg === 'clear_pin') {
    return [];
  } else {
    return { ...state };
  }
}
