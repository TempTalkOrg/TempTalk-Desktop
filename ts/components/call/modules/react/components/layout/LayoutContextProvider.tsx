import type { PinState, WidgetState } from '../../../core';
import { log } from '../../../core';
import * as React from 'react';
import type { LayoutContextType } from '../../context';
import { LayoutContext, useEnsureCreateLayoutContext } from '../../context';

/** @alpha */
export interface LayoutContextProviderProps {
  value?: LayoutContextType;
  onPinChange?: (state: PinState) => void;
  onWidgetChange?: (state: WidgetState) => void;
}

/** @alpha */
export function LayoutContextProvider({
  value,
  onPinChange,
  children,
}: React.PropsWithChildren<LayoutContextProviderProps>) {
  const layoutContextValue = useEnsureCreateLayoutContext(value);

  React.useEffect(() => {
    log.debug('PinState Updated', { state: layoutContextValue.pin.state });
    if (onPinChange && layoutContextValue.pin.state)
      onPinChange(layoutContextValue.pin.state);
  }, [layoutContextValue.pin.state, onPinChange]);

  return (
    <LayoutContext.Provider value={layoutContextValue}>
      {children}
    </LayoutContext.Provider>
  );
}
