import React, { useMemo, useRef } from 'react';

import { message, Spin } from 'antd';
// import { BackgroundBlur, VirtualBackground } from "@livekit/track-processors";
// import { useTimer } from './hooks/useTimer';
import { useRoom } from './hooks/useRoom';
import { useNameFormatter } from './hooks/useNameFormatter';
import { RemoteParticipantMask } from './RemoteParticipantMask';
// import { formatTime } from './utils';
import { useInitials } from './hooks/useInitials';
import { usePageEvent } from './hooks/usePageEvent';
import { useRemoteParticipantMask } from './hooks/useRemoteParticipantMask';
import { useParticipantRenderer } from './hooks/useParticipateRenderer';
import { usePrivateCall } from './hooks/usePrivateCall';
import { useCommonCall } from './hooks/useCommonCall';
import { useReconnect } from './hooks/useReconnect';
import { useLocalAction } from './hooks/useLocalAction';
import { LocalizerType } from '../../types/Util';
import { useRemoteAction } from './hooks/useRemoteAction';
import { useWaitCaller } from './hooks/useWaitCaller';
import { roomAtom } from './atoms/roomAtom';
import { useAtomValue } from 'jotai';
import { currentCall } from './initCall';
import { useGroupCall } from './hooks/useGroupCall';
import { useAddMember } from './hooks/useAddMember';
import { ShareScreenModal } from './ShareScreenModal';
import { useShareScreen } from './hooks/useShareScreen';
import { MediaPermissionModal } from '../MediaPermissionModal';
import { useDenoisePluginFilter } from './hooks/useDenoisePluginFilter';
import { useMemoizedFn } from 'ahooks';
import { FloatingMessageList } from './FloatingMessageList';
import { useFloatingMessage } from './hooks/useFloatingMessage';
import { useAutoLeaveCall } from './hooks/useAutoLeaveCall';
import { usePrePublishAudio } from './hooks/usePrePublishAudio';
import { useRTMMessage } from './hooks/useRTMMessage';
import { CallRoomCipher } from './types';
import { useParticipantContextmenu } from './hooks/useParticipantContextmenu';
import { useGlobalConfig } from './hooks/useGlobalConfig';
import { useKeyBinding } from './hooks/useKeyBinding';
import { useWaitCalleeReconnect } from './hooks/useWaitCalleeReconnect';
import { useFloatingBar } from './hooks/useFloatingBar';
import { RoomTitle } from './RoomTitle';
import { CountdownTimer } from './CountdownTimer';
import { useCountdownTimer } from './hooks/useCountdownTimer';
import { useRaiseHand } from './hooks/useRaiseHand';
import { VideoConference, LiveKitRoom, useParticipants } from './modules/react';
import { LottieAnimation } from '../LottieAnimation';
import { useDeferredSpeakingParticipant } from './hooks/useDeferredSpeakingParticipant';
import { useSyncVideoFrame } from './hooks/useSyncVideoFrame';
import { useOverrideCallRequest } from './hooks/useOverrideCallRequest';

export interface ICallError {
  response: {
    status: number;
    reason?: string;
  };
  reason?: string;
}

interface IProps {
  i18n: LocalizerType & { getLocale: () => string };
}

export const CallRoom = ({ i18n }: IProps) => {
  const roomCipherRef = useRef<CallRoomCipher>({} as CallRoomCipher);
  // const [roomInfo, setRoomInfo] = useState<IRoomInfo>({} as IRoomInfo);
  const roomInfo = useAtomValue(roomAtom);

  const { e2eeSetupComplete, room } = useRoom({ key: roomInfo.key! });

  const {
    finishStartCall,
    handleCallError,
    onError,
    delayCloseWindow,
    doDisConnect,
    doClose,
    onBackToMain,
    handleDestroyCall,
  } = useCommonCall({
    i18n,
    room,
  });

  const { initials, contactMap } = useInitials(room);

  const { nameFormatter } = useNameFormatter(contactMap);

  const renderParticipantPlaceholder = useParticipantRenderer(contactMap, i18n);

  // @ts-ignore
  const participants = useParticipants({ room });
  // const { count } = useTimer(room);
  // @ts-ignore
  window.room = room;

  const overrideRequest = useOverrideCallRequest({
    room,
    onTimeout: () => delayCloseWindow(i18n('call.timeout')),
  });

  usePrivateCall({
    initials,
    roomCipherRef,
    finishStartCall,
    handleCallError,
    overrideRequest,
  });

  useGroupCall({
    initials,
    roomCipherRef,
    finishStartCall,
    handleCallError,
    overrideRequest,
  });

  const resizeCallWindow = () => {
    const height = Math.max(window.innerHeight, 576);
    const width = Math.max(window.innerWidth, 768);
    (window as any).resizeCallWindow({ height, width });
  };

  const { onAddMember, convertToInstantCall } = useAddMember({
    room,
    roomCipher: roomCipherRef.current,
    contactMap,
    onFinishAddMember: () => resizeCallWindow(),
  });

  useWaitCaller({
    room,
    onTimeout: () => delayCloseWindow(i18n('call.noResponse')),
    convertToInstantCall,
  });

  const manualHangupRef = useRef(false);

  useReconnect({
    room,
    manualHangupRef,
    onTimeout: () => delayCloseWindow(i18n('call.timeout')),
    onFail: () => doClose(),
  });

  const { onHangup, onEndCall } = useLocalAction({
    i18n,
    room,
    manualHangupRef,
    roomCipher: roomCipherRef.current,
    onFinishHangup: doDisConnect,
    onFinishEndCall: doDisConnect,
    onLeaveCall: doDisConnect,
    onEndingCall: async () => {
      await sendEndCallMessage();
    },
  });

  useRemoteAction({
    onRemoteReject: () => delayCloseWindow?.(i18n('call.refused')),
    i18n,
  });

  const { visible: show1on1Mask, userInfo: theUser } = useRemoteParticipantMask(
    room,
    contactMap
  );

  usePageEvent({
    onBeforeUnload: onHangup,
  });

  const controlEnable = useMemo(() => {
    if (roomInfo?.type !== '1on1') {
      return true;
    }
    return room.remoteParticipants.size > 0;
  }, [room.remoteParticipants.size, roomInfo?.type]);

  const {
    handleSelectSource,
    sources,
    onScreenShareClick,
    open,
    closeModal,
    permissionModalOpen,
    setPermissionModalOpen,
  } = useShareScreen({
    room,
    onStartShare: resizeCallWindow,
    onLimit: () => message.warning(i18n('callError.screenShareExist')),
  });

  const onDeviceError = useMemoizedFn(({ error }) => {
    if (error.message === 'RATE_LIMIT') {
      message.warning(i18n('callError.rateLimitReached'));
    } else {
      console.log('unknown device error', error);
    }
  });

  const { messages, addMessage, chatPresets } = useFloatingMessage({
    room,
    contactMap,
    i18n,
  });

  const { denoiseEnable, onDenoiseEnableChange } = useDenoisePluginFilter({
    room,
    // filterOptions: { debugLogs: true, vadLogs: true },
    defaultEnabled: true,
  });

  const { continueCall } = useAutoLeaveCall({
    room,
    i18n,
    onExit: onHangup,
    onContinue: () => {
      if (currentCall.type === '1on1') {
        sendContinueMessage();
      }
    },
  });

  const {
    countdownTimerRef,
    onSetCountdownMessage,
    onExtendCountdownMessage,
    onRestartCountdownMessage,
    onClearCountdownMessage,
    ...countdownTimerProps
  } = useCountdownTimer({
    handleSetCountdown: async (minutes: number) => {
      await sendSetCountdownMessage(minutes * 60);
    },
    handleExtendCountdown: async (minutes: number) => {
      await sendExtendCountdownMessage(minutes * 60);
    },
    handleClearCountdown: async () => {
      await sendClearCountdownMessage();
    },
    handleRestartCountdown: async () => {
      await sendRestartCountdownMessage();
    },
  });

  const {
    raiseHandList,
    raiseHand,
    cancelHand,
    onRaiseHandMessage,
    onCancelHandMessage,
  } = useRaiseHand({
    contactMap,
    handleRaiseHand: async () => {
      await sendRaiseHandMessage();
    },
    handleCancelHand: async (identities: string[]) => {
      await sendCancelHandMessage(identities);
    },
  });

  const {
    sendChatText,
    sendMuteMessage,
    sendContinueMessage,
    sendSetCountdownMessage,
    sendExtendCountdownMessage,
    sendClearCountdownMessage,
    sendRestartCountdownMessage,
    sendRaiseHandMessage,
    sendCancelHandMessage,
    sendEndCallMessage,
  } = useRTMMessage({
    room,
    roomCipher: roomCipherRef.current,
    onChatMessage: addMessage,
    contactMap,
    onContinueCall: continueCall,
    // countdown timer
    onSetCountdown: onSetCountdownMessage,
    onExtendCountdown: onExtendCountdownMessage,
    onClearCountdown: onClearCountdownMessage,
    onRestartCountdown: onRestartCountdownMessage,
    onRaiseHand: onRaiseHandMessage,
    onCancelHand: onCancelHandMessage,
    onEndCall: () => {
      handleDestroyCall(undefined, currentCall.roomId, 'hangup');
    },
  });

  usePrePublishAudio({ room });

  const { onContextMenu } = useParticipantContextmenu({
    onMute: sendMuteMessage,
  });

  const { muteOtherEnabled, countdownTimerEnabled } = useGlobalConfig();

  useKeyBinding({ room });

  useWaitCalleeReconnect({
    room,
    onWaittingTimeout: () => delayCloseWindow(i18n('call.calleeTimeout')),
  });

  useDeferredSpeakingParticipant(room);

  useFloatingBar({
    room,
    onHangup,
    contactMap,
  });

  useSyncVideoFrame(room);

  const locale = useMemo(() => {
    return i18n.getLocale();
  }, [i18n]);

  if (!room) {
    return null;
  }

  return (
    <>
      <Spin
        spinning={!roomInfo.token}
        fullscreen
        indicator={
          <LottieAnimation
            src="../lotties/conversation-loading-dark.lottie"
            style={{ height: 120 }}
          />
        }
        rootClassName="call-spin"
      ></Spin>
      <RemoteParticipantMask
        visible={show1on1Mask}
        userInfo={theUser}
        i18n={i18n}
        isPassive={currentCall.isPassive}
      />
      <div
        data-lk-theme="default"
        style={{ height: '100vh' }}
        className={`call-type-${currentCall.type}`}
      >
        <RoomTitle
          room={room}
          extra={
            countdownTimerEnabled ? (
              <CountdownTimer
                {...countdownTimerProps}
                ref={countdownTimerRef}
              />
            ) : null
          }
        />
        {roomInfo.token && e2eeSetupComplete ? (
          <LiveKitRoom
            prepareConnection={false}
            featureFlags={{
              nameFormatter,
              renderParticipantPlaceholder,
              type: roomInfo.type,
              onHangup,
              onSendMessage: sendChatText,
              chatPresets,
              onContextMenu,
              onEndCall,
              onBackToMain,
              muteOtherEnabled,
              raiseHand,
              cancelHand,
              raiseHandList,
              denoiseEnable,
              onDenoiseEnableChange,
              locale,
            }}
            style={{ height: 'calc(100vh - 32px)' }}
            connect={e2eeSetupComplete}
            serverUrl={roomInfo.serviceUrl}
            token={roomInfo.token}
            room={room}
            onError={onError}
          >
            <VideoConference
              onScreenShareClick={onScreenShareClick}
              controls={{
                addMember: roomInfo?.type === '1on1',
                memberList: roomInfo?.type !== '1on1',
                raiseHand: roomInfo?.type !== '1on1',
                chat: true,
                screenShare: controlEnable,
                backToMain: true,
              }}
              onAddMember={onAddMember}
              onDeviceError={onDeviceError}
            />
            <ShareScreenModal
              open={open}
              closeModal={closeModal}
              sources={sources}
              handleSelectSource={handleSelectSource}
            />
            <MediaPermissionModal
              open={permissionModalOpen}
              mediaType="screen"
              i18n={i18n}
              dismiss={() => setPermissionModalOpen(false)}
            />
            <FloatingMessageList messages={messages} />
          </LiveKitRoom>
        ) : null}
      </div>
    </>
  );
};
