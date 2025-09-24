// import type { Room } from '@cc-livekit/livekit-client';
import { prefixClass } from '../styles-interface';

export function setupBackToMainButton() {
  const backToMain = () => {
    // room.emit('back-to-main');
  };
  const className: string = prefixClass('back-to-main-button');
  return { className, backToMain };
}
