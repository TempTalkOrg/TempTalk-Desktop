import { sortParticipants } from '../../core';
import type { Participant } from '@cc-livekit/livekit-client';
import * as React from 'react';

export function useSortedParticipants(participants: Array<Participant>) {
  const [sortedParticipants, setSortedParticipants] = React.useState(
    sortParticipants(participants)
  );

  React.useEffect(() => {
    setSortedParticipants(sortParticipants(participants));
  }, [participants]);
  return sortedParticipants;
}
