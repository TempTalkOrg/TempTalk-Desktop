import { setupDisconnectButton } from '../../core';
import * as React from 'react';
import type { DisconnectButtonProps } from '../components';
import { useFeatureContext, useRoomContext } from '../context';
import { mergeProps } from '../mergeProps';
import { useConnectionState } from './useConnectionStatus';

export function useDisconnectButton(props: DisconnectButtonProps) {
  const room = useRoomContext();
  const connectionState = useConnectionState(room);
  const featureCtx = useFeatureContext();

  const buttonProps = React.useMemo(() => {
    const { className } = setupDisconnectButton(room);
    const mergedProps = mergeProps(props, {
      className,
      onClick: async () => {
        await featureCtx?.onHangup?.();
      },
    });
    return mergedProps;
  }, [room, props, connectionState]);

  return { buttonProps };
}
