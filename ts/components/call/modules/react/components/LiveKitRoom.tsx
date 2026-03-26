import type {
  DisconnectReason,
  RoomConnectOptions,
  RoomOptions,
} from '@cc-livekit/livekit-client';
import type { MediaDeviceFailure, Room } from '@cc-livekit/livekit-client';
import { type FeatureFlags, LKFeatureContext, RoomContext } from '../context';
import { useLiveKitRoom } from '../hooks';
import React, { forwardRef, PropsWithChildren } from 'react';

/** @public */
export interface LiveKitRoomProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onError'> {
  serverUrl: string | undefined;
  token: string | undefined;
  connect?: boolean;
  options?: RoomOptions;
  connectOptions?: RoomConnectOptions;
  onConnected?: () => void;
  onDisconnected?: (reason?: DisconnectReason) => void;
  onError?: (error: Error) => void;
  onMediaDeviceFailure?: (failure?: MediaDeviceFailure) => void;
  onEncryptionError?: (error: Error) => void;
  room?: Room;
  simulateParticipants?: number | undefined;
  prepareConnection?: boolean;
  featureFlags?: FeatureFlags;
}

export const LiveKitRoom = forwardRef<
  HTMLDivElement,
  React.PropsWithChildren<LiveKitRoomProps>
>(function LiveKitRoom(props: PropsWithChildren<LiveKitRoomProps>, ref) {
  const { room, htmlProps } = useLiveKitRoom(props);
  return (
    <div ref={ref} {...htmlProps}>
      {room && (
        <RoomContext.Provider value={room}>
          <LKFeatureContext.Provider value={props.featureFlags}>
            {props.children}
          </LKFeatureContext.Provider>
        </RoomContext.Provider>
      )}
    </div>
  );
});
