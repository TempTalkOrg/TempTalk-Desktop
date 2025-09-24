// import type { Room } from '@cc-livekit/livekit-client';
import { prefixClass } from '../styles-interface';

export function setupRaiseHandButton() {
  const raiseHand = () => {
    // room.emit('raise-hand');
  };
  const className: string = prefixClass('raise-hand-button');
  return { className, raiseHand };
}
