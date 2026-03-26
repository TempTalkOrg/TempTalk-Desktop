import type { Room } from '@cc-livekit/livekit-client';
import { ConnectionState } from '@cc-livekit/livekit-client';
import { InfoCircleOutlined } from '@ant-design/icons';
import { useConnectionState, usePrevValue } from '../hooks';
import React, {
  HTMLAttributes,
  ReactElement,
  useEffect,
  useState,
} from 'react';

export interface ConnectionStateToastProps
  extends HTMLAttributes<HTMLDivElement> {
  room?: Room;
}

export function ConnectionStateToast(props: ConnectionStateToastProps) {
  const [notification, setNotification] = useState<ReactElement | undefined>(
    undefined
  );
  const state = useConnectionState(props.room);
  const prevState = usePrevValue(state);

  useEffect(() => {
    if (state === prevState) {
      return;
    }
    switch (state) {
      case ConnectionState.SignalReconnecting:
      case ConnectionState.Reconnecting:
        setNotification(
          <>
            <div className="connection-state-spinner call-icon spinner-icon"></div>{' '}
            Reconnecting
          </>
        );
        break;
      case ConnectionState.Connecting:
        setNotification(
          <>
            <div className="connection-state-spinner call-icon spinner-icon"></div>{' '}
            Connecting
          </>
        );
        break;
      case ConnectionState.Disconnected:
        if (prevState === undefined) {
          setNotification(
            <>
              <div className="connection-state-spinner call-icon spinner-icon"></div>{' '}
              Connecting
            </>
          );
          break;
        }
        setNotification(
          <>
            <InfoCircleOutlined /> Disconnected
          </>
        );
        break;
      default:
        setNotification(undefined);
        break;
    }
  }, [state, prevState]);
  return notification ? (
    <div className="connection-state-container">{notification}</div>
  ) : (
    <></>
  );
}
