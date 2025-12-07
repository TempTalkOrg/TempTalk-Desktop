import { Track } from '@cc-livekit/livekit-client';
import { useState } from 'react';

export const useMediaPermissionModal = () => {
  const [mediaType, setMediaType] = useState<Track.Source>(
    Track.Source.Microphone
  );
  const [mediaPermissionModalOpen, setMediaPermissionModalOpen] =
    useState(false);
  const showMediaPermissionError = (type: Track.Source) => {
    setMediaType(type);
    setMediaPermissionModalOpen(true);
  };

  const hideMediaPermissionModal = () => {
    setMediaPermissionModalOpen(false);
  };

  return {
    mediaType,
    mediaPermissionModalOpen,
    showMediaPermissionError,
    hideMediaPermissionModal,
  };
};
