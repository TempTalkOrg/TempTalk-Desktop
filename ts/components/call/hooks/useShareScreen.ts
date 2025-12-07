import { useMemoizedFn } from 'ahooks';
import { message } from 'antd';
import {
  Participant,
  Room,
  RoomEvent,
  Track,
  TrackPublication,
} from '@cc-livekit/livekit-client';
import { useEffect, useState } from 'react';
import * as OS from '../../../OS';
import type { Stream } from '@indutny/mac-screen-share';

type ShareScreenSource = {
  id: string;
  name: string;
  appIconDataURI: string | null;
  thumbnailDataURI: string | null;
};

// Chrome-only API for now, thus a declaration:
declare class MediaStreamTrackGenerator extends MediaStreamTrack {
  constructor(options: { kind: 'video' });

  public writable: WritableStream;
}

const SECOND = 1000;

export function isOlderThan(timestamp: number, delta: number): boolean {
  return timestamp <= Date.now() - delta;
}

const startMacNativeShareScreen = ({
  onPublishTrack,
}: {
  onPublishTrack: (track: MediaStreamTrack) => void;
}) => {
  try {
    const track = new MediaStreamTrackGenerator({ kind: 'video' });
    const writer = track.writable.getWriter();

    const mediaStream = new MediaStream();
    mediaStream.addTrack(track);

    let isRunning = false;
    let lastFrame: VideoFrame | undefined;
    let lastFrameSentAt = 0;

    let frameRepeater: NodeJS.Timeout | undefined;

    const cleanup = () => {
      lastFrame?.close();
      if (frameRepeater !== null) {
        clearInterval(frameRepeater);
      }
      frameRepeater = undefined;
      lastFrame = undefined;
    };

    const macScreenShare = (window as any).getMacScreenShare();

    const stream: Stream = new macScreenShare.Stream({
      width: 1920,
      height: 1080,
      frameRate: 5,
      onStart: async () => {
        isRunning = true;

        // Repeat last frame every second to match "min" constraint above.
        frameRepeater = setInterval(() => {
          if (isRunning && track.readyState !== 'ended' && lastFrame != null) {
            if (isOlderThan(lastFrameSentAt, SECOND)) {
              writer.write(lastFrame.clone());
            }
          } else {
            cleanup();
          }
        }, SECOND);

        onPublishTrack(track);
      },
      onStop: () => {
        if (!isRunning) {
          return;
        }
        isRunning = false;

        if (track.readyState === 'ended') {
          stream.stop();
          return;
        }
        writer.close();
      },
      onFrame: (frame: Buffer, width: number, height: number) => {
        if (!isRunning) {
          return;
        }
        if (track.readyState === 'ended') {
          stream.stop();
          return;
        }

        lastFrame?.close();
        lastFrameSentAt = Date.now();
        lastFrame = new VideoFrame(frame, {
          format: 'NV12',
          codedWidth: width,
          codedHeight: height,
          timestamp: 0,
        });
        writer.write(lastFrame.clone());
      },
    });
  } catch (e) {
    console.error('Failed to start mac native share screen:', e);
  }
};

const isSupportSystemMode = (window as any).isSupportMacShareScreenKit();

type ScreenShareMode = 'default' | 'system';

export const useShareScreen = ({
  room,
  onStartShare,
  onLimit,
  onPermissionError,
}: {
  room: Room;
  onStartShare?: () => void;
  onLimit?: () => void;
  onPermissionError?: () => void;
}) => {
  const [open, setOpen] = useState(false);
  const [sources, setSources] = useState<ShareScreenSource[]>([]);
  const [permissionModalOpen, setPermissionModalOpen] = useState(false);
  const [screenShareMode, setScreenShareMode] = useState<ScreenShareMode>(
    isSupportSystemMode
      ? ((localStorage.getItem('screenShareMode') as ScreenShareMode) ??
          'default')
      : 'default'
  );

  const onScreenShareModeChange = useMemoizedFn((mode: ScreenShareMode) => {
    setScreenShareMode(mode);
    localStorage.setItem('screenShareMode', mode);
  });

  const doPublishSource = useMemoizedFn(async (sourceId: string) => {
    try {
      let mandatory: any = {
        chromeMediaSource: 'desktop',
        chromeMediaSourceId: sourceId,
        // minWidth: 1920,
        // maxWidth: 1920,
        // minHeight: 1080,
        // maxHeight: 1080,
        minFrameRate: 1,
        maxFrameRate: 5,
      };

      // 性能差的机器控制最大分辨率
      if (OS.isMacOS() && !OS.isArm64()) {
        mandatory = {
          ...mandatory,
          maxWidth: 1920,
          maxHeight: 1080,
        };
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { mandatory },
      } as MediaStreamConstraints);
      // 屏幕分享只捕获视频流， stream.getTracks() 只会有一个 track
      const [track] = stream.getTracks();
      await room.localParticipant.publishTrack(track, {
        source: Track.Source.ScreenShare,
        simulcast: false,
        videoCodec: 'h264',
      });
      console.log('share screen success');

      track.addEventListener('ended', () => {
        console.log('found share screen stream ended, try to republish source');
        doPublishSource(sourceId);
      });
    } catch (e) {
      console.log('publish source error:', e);
    }
  });

  const handleSelectSource = useMemoizedFn(async (sourceId: string) => {
    try {
      doPublishSource(sourceId);
      setOpen(false); // Close the modal
    } catch (e: any) {
      message.error(`Share screen error: ${e.message}`);
      console.error('Failed to get media stream:', e);
    }
  });

  const handleToggleScreenShare = useMemoizedFn(async () => {
    if (room.localParticipant.isScreenShareEnabled) {
      console.log('manual stop share screen');
      await room.localParticipant.setScreenShareEnabled(false);
      setSources([]);
      return;
    }

    if (room.metadata) {
      try {
        const metadata = JSON.parse(room.metadata);
        if (metadata.canPublishScreen === false) {
          return onLimit?.();
        }
      } catch (e) {
        console.log('parse metadata json error:', e);
      }
    }

    if (isSupportSystemMode && screenShareMode === 'system') {
      onStartShare?.();
      startMacNativeShareScreen({
        onPublishTrack: async track => {
          await room.localParticipant.publishTrack(track, {
            source: Track.Source.ScreenShare,
            simulcast: false,
            videoCodec: 'h264',
          });
        },
      });
      return;
    }

    try {
      openModal();

      const startTime = Date.now();

      const sources = await (window as any).getSources();
      setSources(sources);

      onStartShare?.();
      console.log('getSources time:', Date.now() - startTime);
    } catch (e) {
      console.error('error', e);
    }
  });

  const onScreenShareClick = useMemoizedFn(async () => {
    try {
      const hasPermission = await (window as any).checkMediaPermission(
        'screen'
      );

      if (!hasPermission) {
        onPermissionError?.();
        return;
      }

      handleToggleScreenShare();
    } catch (e) {
      console.log(e);
    }
  });

  const openModal = () => {
    setOpen(true);
  };

  const closeModal = () => {
    setOpen(false);
    setSources([]);
  };

  const onTrackUnpublished = useMemoizedFn(
    (trackPublication: TrackPublication, participant: Participant) => {
      if (trackPublication.source === Track.Source.ScreenShare) {
        console.log(
          'share screen unpublished',
          'isLocal:',
          participant.isLocal,
          trackPublication
        );
      }
    }
  );

  useEffect(() => {
    room.on(RoomEvent.LocalTrackUnpublished, onTrackUnpublished);
    room.on(RoomEvent.TrackUnpublished, onTrackUnpublished);

    return () => {
      room.off(RoomEvent.LocalTrackUnpublished, onTrackUnpublished);
      room.off(RoomEvent.TrackUnpublished, onTrackUnpublished);
    };
  }, []);

  return {
    handleSelectSource,
    openModal,
    closeModal,
    open,
    handleToggleScreenShare,
    onScreenShareClick,
    sources,
    permissionModalOpen,
    setPermissionModalOpen,
    isSupportSystemMode,
    screenShareMode,
    onScreenShareModeChange,
  };
};
