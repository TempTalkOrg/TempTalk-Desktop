import React from 'react';
import { useMemoizedFn } from 'ahooks';
import {
  Participant,
  Room,
  RoomEvent,
  Track,
  TrackPublication,
} from '@cc-livekit/livekit-client';
import { useEffect, useRef, useState } from 'react';
import * as OS from '../../../OS';
import type { Stream } from '@indutny/mac-screen-share';
import { useTracks } from '../modules/react';
import { screenShareAtom, ScreenShareStatus } from '../atoms/screenShareAtom';
import { useAtom } from 'jotai';
import { message, Spin } from 'antd';
import { ExclamationCircleOutlined, LoadingOutlined } from '@ant-design/icons';
import { UpdateRequireScreenMessageType } from './useRTMMessage';
import { LocalizerType } from '../../../types/Util';
import { useImmersiveMode } from './useImmersiveMode';

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

async function publishScreenShareTrack(room: Room, track: MediaStreamTrack) {
  const isIntelMacLowPerf = OS.isMacOS() && !OS.isArm64();

  return await room.localParticipant.publishTrack(track, {
    source: Track.Source.ScreenShare,
    simulcast: !isIntelMacLowPerf,
    videoCodec: 'h264',
    scalabilityMode: isIntelMacLowPerf ? undefined : 'L2T1_KEY',
  });
}

const isSupportSystemMode = (window as any).isSupportMacShareScreenKit();

type ScreenShareMode = 'default' | 'system';

interface IScreenShareGenerator {
  startSelectSource: () => Promise<void>;
  selectSource: (sourceId: string) => Promise<void>;
  cancelSelectSource: () => void;
  setReady: () => Promise<void>;
  readyForPublish: () => Promise<unknown>;
  publishSource: () => Promise<void>;
}

interface IDefaultShareScreenGeneratorOptions {
  onStartSelectSource: () => Promise<void>;
  onPublishSource: (sourceId: string) => Promise<void>;
}

class DefaultShareScreenGenerator implements IScreenShareGenerator {
  options: IDefaultShareScreenGeneratorOptions;
  promise: Promise<unknown>;
  resolve: (value: void) => void;
  reject: (reason?: any) => void;
  sourceId: string | null;

  constructor(options: IDefaultShareScreenGeneratorOptions) {
    this.options = options;
    const { promise, resolve, reject } = Promise.withResolvers();
    this.promise = promise;
    this.resolve = resolve;
    this.reject = reject;
    this.sourceId = null;
  }

  public async startSelectSource() {
    await this.options.onStartSelectSource();
  }

  public async selectSource(sourceId: string) {
    this.sourceId = sourceId;
  }

  public async setReady() {
    this.resolve();
  }

  public async readyForPublish() {
    return this.promise;
  }

  public async publishSource() {
    if (!this.sourceId) {
      this.reject(new Error('sourceId is not set'));
      return;
    }
    await this.options.onPublishSource(this.sourceId);
  }

  public cancelSelectSource() {
    this.reject(new Error('user cancelled'));
  }
}

interface ISystemShareScreenGeneratorOptions {
  onPublishTrack: (track: MediaStreamTrack) => Promise<void>;
  onBeforeStart: () => void;
}

class SystemShareScreenGenerator implements IScreenShareGenerator {
  options: ISystemShareScreenGeneratorOptions;
  promise: Promise<void>;
  resolve: (value: void) => void;
  reject: (reason?: any) => void;
  stream: Stream | null;

  constructor(options: ISystemShareScreenGeneratorOptions) {
    this.options = options;
    const { promise, resolve, reject } = Promise.withResolvers();
    this.promise = promise as Promise<void>;
    this.resolve = resolve;
    this.reject = reject;
    this.stream = null;
  }

  public async startSelectSource() {
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

      this.stream = new macScreenShare.Stream({
        width: 1920,
        height: 1080,
        frameRate: 5,
        onStart: async () => {
          this.options.onBeforeStart();
          try {
            await this.promise;
          } catch (e: any) {
            console.log('system picker on before start rejection:', e?.message);
            return;
          }
          isRunning = true;

          // Repeat last frame every second to match "min" constraint above.
          frameRepeater = setInterval(() => {
            if (
              isRunning &&
              track.readyState !== 'ended' &&
              lastFrame != null
            ) {
              if (isOlderThan(lastFrameSentAt, SECOND)) {
                writer.write(lastFrame.clone());
              }
            } else {
              cleanup();
            }
          }, SECOND);

          this.options.onPublishTrack(track);
        },
        onStop: () => {
          if (!isRunning) {
            this.cancelSelectSource();
            return;
          }
          isRunning = false;

          if (track.readyState === 'ended') {
            this.stream?.stop();
            return;
          }
          writer.close();
        },
        onFrame: (frame: Buffer, width: number, height: number) => {
          if (!isRunning) {
            return;
          }
          if (track.readyState === 'ended') {
            this.stream?.stop();
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
  }

  public async selectSource() {
    return;
  }

  public async setReady() {
    this.resolve();
  }

  public async readyForPublish() {
    return this.promise;
  }

  public async publishSource() {
    return;
  }

  public cancelSelectSource() {
    if (this.stream) {
      this.stream.stop();
    }
    this.reject(new Error('user cancelled'));
  }
}

export const useShareScreen = ({
  room,
  onStartShare,
  // onLimit,
  onPermissionError,
  handleRequestScreenShare,
  handleApproveScreenShareRequest,
  handleRejectScreenShareRequest,
  i18n,
}: {
  room: Room;
  onStartShare?: () => void;
  onLimit?: () => void;
  onPermissionError?: () => void;
  handleRequestScreenShare: () => Promise<void>;
  handleApproveScreenShareRequest: (identity: string) => Promise<void>;
  handleRejectScreenShareRequest: () => Promise<void>;
  i18n: LocalizerType;
}) => {
  const [open, setOpen] = useState(false);
  const [sources, setSources] = useState<ShareScreenSource[]>([]);
  const [permissionModalOpen, setPermissionModalOpen] = useState(false);
  const [screenShareStatus, setScreenShareStatus] = useAtom(screenShareAtom);
  const [screenShareMode, setScreenShareMode] = useState<ScreenShareMode>(
    isSupportSystemMode
      ? ((localStorage.getItem('screenShareMode') as ScreenShareMode) ??
          'default')
      : 'default'
  );

  const { exitImmersiveMode, enterImmersiveMode } = useImmersiveMode();

  const onScreenShareModeChange = useMemoizedFn((mode: ScreenShareMode) => {
    setScreenShareMode(mode);
    localStorage.setItem('screenShareMode', mode);
  });

  const doPublishSource = useMemoizedFn(async (sourceId: string) => {
    try {
      const isIntelMacLowPerf = OS.isMacOS() && !OS.isArm64();

      const mandatory: any = {
        chromeMediaSource: 'desktop',
        chromeMediaSourceId: sourceId,

        // minWidth: 1920,
        // minHeight: 1080,
        // On lower-performance devices, cap screen sharing at 1080p; otherwise, allow up to 4K.
        maxWidth: isIntelMacLowPerf ? 1920 : 3840,
        maxHeight: isIntelMacLowPerf ? 1080 : 2400,

        minFrameRate: 1,
        maxFrameRate: 5,
      };

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { mandatory },
      } as MediaStreamConstraints);
      // 屏幕分享只捕获视频流， stream.getTracks() 只会有一个 track
      const [track] = stream.getTracks();
      await publishScreenShareTrack(room, track);
      console.log('share screen success');

      track.addEventListener('ended', () => {
        console.log('found share screen stream ended, try to republish source');
        doPublishSource(sourceId);
      });
    } catch (e) {
      console.log('publish source error:', e);
    }
  });

  const [screenShareTrack] = useTracks([Track.Source.ScreenShare], { room });

  useEffect(() => {
    setScreenShareStatus((prev: ScreenShareStatus) => ({
      ...prev,
      isSharing: !!screenShareTrack,
      isLocalSharing: screenShareTrack?.participant.isLocal,
    }));
  }, [screenShareTrack]);

  const handleRequestTimeout = useMemoizedFn(async () => {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error('request timeout'));
      }, 10 * 1000);
    });
  });

  const requestScreenShare = useMemoizedFn(async () => {
    try {
      await handleRequestScreenShare();
      setScreenShareStatus((prev: ScreenShareStatus) => ({
        ...prev,
        isRequesting: true,
      }));
      await Promise.race([
        screenshareInstanceRef.current?.readyForPublish(),
        handleRequestTimeout(),
      ]);
    } catch (e: any) {
      if (screenshareInstanceRef.current) {
        screenshareInstanceRef.current.cancelSelectSource();
        setScreenShareStatus((prev: ScreenShareStatus) => ({
          ...prev,
          isRequesting: false,
        }));
      }
      if (e?.message === 'request timeout') {
        showRejectedMessage('Request timeout');
      }
      console.log('request screen share error', e?.message);
    }
  });

  const screenshareInstanceRef = useRef<IScreenShareGenerator>();

  const handleSelectSource = useMemoizedFn(async (sourceId: string) => {
    if (screenshareInstanceRef.current) {
      await screenshareInstanceRef.current.selectSource(sourceId);
      setOpen(false);
      if (screenShareStatus.isSharing) {
        await requestScreenShare();
      } else {
        await screenshareInstanceRef.current.setReady();
      }
    }
  });

  const handleToggleScreenShare = useMemoizedFn(async () => {
    if (room.localParticipant.isScreenShareEnabled) {
      console.log('manual stop share screen');
      await room.localParticipant.setScreenShareEnabled(false);
      setSources([]);
      return;
    }

    if (isSupportSystemMode && screenShareMode === 'system') {
      onStartShare?.();
      screenshareInstanceRef.current = new SystemShareScreenGenerator({
        onPublishTrack: async track => {
          await publishScreenShareTrack(room, track);
        },
        async onBeforeStart() {
          if (screenshareInstanceRef.current) {
            if (screenShareStatus.isSharing) {
              await requestScreenShare();
            } else {
              await screenshareInstanceRef.current.setReady();
            }
          }
        },
      });
    } else {
      screenshareInstanceRef.current = new DefaultShareScreenGenerator({
        async onStartSelectSource() {
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
        },
        async onPublishSource(sourceId: string) {
          try {
            await doPublishSource(sourceId);
          } catch (e: any) {
            console.error('Failed to get media stream:', e);
          }
        },
      });
    }

    try {
      await screenshareInstanceRef.current.startSelectSource();
      await screenshareInstanceRef.current.readyForPublish();
      await screenshareInstanceRef.current.publishSource();
    } catch (e: any) {
      console.log('Share screen error:', e?.message);
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
    if (screenshareInstanceRef.current) {
      screenshareInstanceRef.current.cancelSelectSource();
    }
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
        exitImmersiveMode();
      }
    }
  );

  const onTrackPublished = useMemoizedFn(
    (trackPublication: TrackPublication, participant: Participant) => {
      if (trackPublication.source === Track.Source.ScreenShare) {
        console.log(
          'share screen published',
          'isLocal:',
          participant.isLocal,
          trackPublication
        );
        enterImmersiveMode();
      }
    }
  );

  useEffect(() => {
    room.on(RoomEvent.LocalTrackUnpublished, onTrackUnpublished);
    room.on(RoomEvent.TrackUnpublished, onTrackUnpublished);

    room.on(RoomEvent.LocalTrackPublished, onTrackPublished);
    room.on(RoomEvent.TrackPublished, onTrackPublished);

    return () => {
      room.off(RoomEvent.LocalTrackUnpublished, onTrackUnpublished);
      room.off(RoomEvent.TrackUnpublished, onTrackUnpublished);
      room.off(RoomEvent.LocalTrackPublished, onTrackPublished);
      room.off(RoomEvent.TrackPublished, onTrackPublished);
    };
  }, []);

  const [requestingMessageApi, requestingMessageContextHolder] =
    message.useMessage();

  useEffect(() => {
    if (screenShareStatus.isRequesting) {
      requestingMessageApi.open({
        className: 'requesting-screen-share-message',
        key: 'requesting-screen-share',
        icon: (
          <Spin
            className="requesting-screen-share-message-icon"
            spinning
            size="small"
            indicator={<LoadingOutlined />}
          ></Spin>
        ),
        content: (
          <span className="requesting-screen-share-message-content">
            {i18n('screenShare.waitingForApproval')}
          </span>
        ),
        duration: 0,
      });
    } else {
      requestingMessageApi.destroy('requesting-screen-share');
    }
  }, [screenShareStatus.isRequesting]);

  const showRejectedMessage = useMemoizedFn((reason?: string) => {
    if (!reason) {
      return;
    }
    requestingMessageApi.open({
      className: 'requesting-screen-share-message',
      key: 'rejected-screen-share',
      icon: <ExclamationCircleOutlined />,
      content: (
        <span className="requesting-screen-share-message-content">
          {reason}
        </span>
      ),
      duration: 2,
    });
  });

  const handleRemoteScreenShareRequest = useMemoizedFn(
    async (requireUsers: { identity: string; ts: string }[]) => {
      setScreenShareStatus((prev: ScreenShareStatus) => ({
        ...prev,
        requireUsers,
        approvalModalOpen: true,
      }));
    }
  );

  const onRequestRejected = useMemoizedFn(() => {
    setScreenShareStatus((prev: ScreenShareStatus) => ({
      ...prev,
      isRequesting: false,
    }));
    requestingMessageApi.destroy('requesting-screen-share');
    if (screenshareInstanceRef.current) {
      screenshareInstanceRef.current.cancelSelectSource();
    }
    showRejectedMessage(i18n('screenShare.requestDeclined'));
  });

  const handleRemoteApprovalFlow = useMemoizedFn(
    async (message: UpdateRequireScreenMessageType) => {
      const { type, rejectUsers = [], ownerIdentity = '' } = message;
      if (type === 'reject') {
        const isRejected = rejectUsers.some(
          user => user.identity === room.localParticipant.identity
        );
        if (isRejected) {
          onRequestRejected();
        }
      } else if (type === 'accept') {
        if (ownerIdentity === room.localParticipant.identity) {
          // approved by owner
          setScreenShareStatus((prev: ScreenShareStatus) => ({
            ...prev,
            isRequesting: false,
          }));
          if (screenshareInstanceRef.current) {
            screenshareInstanceRef.current.setReady();
          }
        } else {
          // treat as rejected
          onRequestRejected();
        }
      }
    }
  );

  const handleRemoteRequestFLow = useMemoizedFn(
    async (message: UpdateRequireScreenMessageType) => {
      const { type } = message;
      if (type === 'require') {
        const requireUsers = message.requireUsers || [];
        if (requireUsers.length) {
          handleRemoteScreenShareRequest(requireUsers);
        }
      }
    }
  );

  const onUpdateRequireScreen = useMemoizedFn(
    (message: UpdateRequireScreenMessageType) => {
      if (screenShareStatus.isRequesting) {
        console.log('handle remote approval flow');
        handleRemoteApprovalFlow(message);
      } else if (screenShareStatus.isLocalSharing) {
        console.log('handle remote request flow');
        handleRemoteRequestFLow(message);
      }
    }
  );

  const onApproveScreenShareRequest = useMemoizedFn(
    async (identity: string) => {
      await room.localParticipant.setScreenShareEnabled(false);
      await handleApproveScreenShareRequest(identity);
    }
  );

  const onRejectScreenShareRequest = useMemoizedFn(async () => {
    await handleRejectScreenShareRequest();
  });

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
    requestingMessageContextHolder,
    onUpdateRequireScreen,
    onApproveScreenShareRequest,
    onRejectScreenShareRequest,
    screenShareStatus,
  };
};
