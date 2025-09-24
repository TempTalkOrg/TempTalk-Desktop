// import type { Room } from '@cc-livekit/livekit-client';
import { prefixClass } from '../styles-interface';

export function setupAddMemberButton() {
  const addMember = () => {
    // room.emit('add-membe');
  };
  const className: string = prefixClass('add-member-button');
  return { className, addMember };
}
