import type { Room } from '@cc-livekit/livekit-client';

export function setupDisconnectButton(room: Room) {
  const disconnect = (stopTracks?: boolean) => {
    room.disconnect(stopTracks);
  };
  const className: string = 'disconnect-button';
  return { className, disconnect };
}
