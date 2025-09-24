import type { Room } from '@cc-livekit/livekit-client';
import { ConnectionState } from '@cc-livekit/livekit-client';
import * as React from 'react';
import { InfoCircleOutlined } from '@ant-design/icons';
import { useConnectionState, usePrevValue } from '../hooks';

/** @public */
export interface ConnectionStateToastProps
  extends React.HTMLAttributes<HTMLDivElement> {
  room?: Room;
}

/**
 * The `ConnectionStateToast` component displays a toast
 * notification indicating the current connection state of the room.
 * @public
 */
export function ConnectionStateToast(props: ConnectionStateToastProps) {
  const [notification, setNotification] = React.useState<
    React.ReactElement | undefined
  >(undefined);
  const state = useConnectionState(props.room);
  const prevState = usePrevValue(state);

  React.useEffect(() => {
    if (state === prevState) {
      return;
    }
    switch (state) {
      case ConnectionState.SignalReconnecting:
      case ConnectionState.Reconnecting:
        setNotification(
          <>
            <div className="lk-spinner call-icon spinner-icon"></div>{' '}
            Reconnecting
          </>
        );
        break;
      case ConnectionState.Connecting:
        setNotification(
          <>
            <div className="lk-spinner call-icon spinner-icon"></div> Connecting
          </>
        );
        break;
      case ConnectionState.Disconnected:
        if (prevState === undefined) {
          setNotification(
            <>
              <div className="lk-spinner call-icon spinner-icon"></div>{' '}
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
    <div className="lk-connection-state-container">{notification}</div>
  ) : (
    <></>
  );
}
