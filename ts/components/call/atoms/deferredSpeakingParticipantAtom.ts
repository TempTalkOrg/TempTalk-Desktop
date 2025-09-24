import { atom } from 'jotai';
import { Participant } from '@cc-livekit/livekit-client';

export const deferredSpeakingParticipantAtom = atom<Participant>();
