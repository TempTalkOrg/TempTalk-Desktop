import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { LocalizerType } from '../../types/Util';
import { useMemoizedFn } from 'ahooks';
import { Avatar } from '../Avatar';
import { CountdownTimer, ICountdownTimerRef } from './CountdownTimer';
import classNames from 'classnames';
import {
  IconBackCall,
  IconLeaveCall,
  IconMicrophoneDisable,
  IconMicrophoneEnable,
  IconScreenShare,
} from '../shared/icons';

type SpeakerUserInfoType = {
  name: string;
  avatarPath: string;
  id: string;
  isSpeaking?: boolean;
  isLocal?: boolean;
  isMuted?: boolean;
};

type ScreenShareUserInfoType = {
  name: string;
  avatarPath: string;
  id: string;
};

type UserInfoType = SpeakerUserInfoType | ScreenShareUserInfoType;

type ActiveInfoType = UserInfoType & {
  type?: 'audio' | 'screen-share';
};

const ActiveIndicator = ({
  info,
  localStatus,
}: {
  info: ActiveInfoType | undefined;
  localStatus: { micMute: boolean };
}) => {
  const renderIcon = () => {
    if (info?.type === 'audio') {
      if ((info as SpeakerUserInfoType).isLocal && localStatus.micMute) {
        return <div className="mic-muted-icon" />;
      } else {
        return (info as SpeakerUserInfoType).isMuted ? (
          <div className="mic-muted-icon" />
        ) : (info as SpeakerUserInfoType).isSpeaking ? (
          <div className="speaking-bars">
            <div className="bar-item"></div>
            <div className="bar-item"></div>
            <div className="bar-item"></div>
          </div>
        ) : (
          <div className="not-speaking-icon" />
        );
      }
    } else if (info?.type === 'screen-share') {
      return <IconScreenShare className="screen-share-icon" />;
    } else {
      return <></>;
    }
  };

  if (!info) {
    return null;
  }

  return (
    <div className="active-indicator-root">
      <div className="indicator-icon">{renderIcon()}</div>
      <div className="indicator-name">{info.name}</div>
    </div>
  );
};

type PropsType = {
  i18n: LocalizerType;
  backToCall: () => void;
  setMuted: (muted: boolean) => void;
  hangup: () => void;
  registerFloatingBarUpdateHandler: (
    handler: (
      _: Event,
      props: {
        muted: boolean;
        speaker?: SpeakerUserInfoType;
        screenShare?: ScreenShareUserInfoType;
      }
    ) => void
  ) => () => void;
};

export const FloatingBar = (props: PropsType) => {
  const {
    i18n,
    backToCall,
    setMuted,
    hangup,
    registerFloatingBarUpdateHandler,
  } = props;
  const [micMute, setMicMute] = useState(false);
  const [speaker, setSpeaker] = useState<SpeakerUserInfoType | undefined>(
    undefined
  );
  const [screenShare, setScreenShare] = useState<
    ScreenShareUserInfoType | undefined
  >(undefined);
  const countdownTimerRef = useRef<ICountdownTimerRef>(null);

  const onFloatingBarUpdate = useMemoizedFn(
    (
      _,
      props: {
        muted: boolean;
        speaker?: SpeakerUserInfoType;
        screenShare?: ScreenShareUserInfoType;
        countdown?: {
          duration: number;
        };
      }
    ) => {
      const { muted, speaker, screenShare, countdown } = props ?? {};
      console.log(
        '[floating bar] receive update event:',
        'muted',
        muted,
        'speaker',
        speaker,
        'screenShare',
        screenShare,
        'countdown',
        countdown
      );

      if (muted !== undefined) {
        setMicMute(muted);
      }
      if (speaker !== undefined) {
        setSpeaker(speaker);
      }
      if (screenShare !== undefined) {
        setScreenShare(screenShare);
      }
      if (countdown !== undefined) {
        if (countdown === null) {
          countdownTimerRef.current?.clearCountdown();
        } else {
          countdownTimerRef.current?.setCountdown(countdown);
        }
      }
    }
  );

  useEffect(() => {
    const cleanup = registerFloatingBarUpdateHandler(onFloatingBarUpdate);

    return () => {
      cleanup();
    };
  }, []);

  const activeInfo: ActiveInfoType | undefined = useMemo(() => {
    if (speaker && speaker.isSpeaking) {
      return {
        ...speaker,
        type: 'audio',
      };
    } else if (screenShare) {
      return {
        ...screenShare,
        type: 'screen-share',
      };
    } else if (speaker) {
      return {
        ...speaker,
        type: 'audio',
      };
    }
    return undefined;
  }, [speaker, screenShare]);

  const preventDefault = useCallback(ev => {
    ev.stopPropagation();
    ev.preventDefault();
  }, []);

  const onCountdownTimerClick = useCallback(() => {
    (window as any).backToCall();
    (window as any).openCountdownTimerPopup();
  }, []);

  const [frameInfo, setFrameInfo] = useState<{
    imageB64: string;
    isLocalTrack: boolean;
  }>({ imageB64: '', isLocalTrack: false });

  const onFrame = useMemoizedFn(
    (
      _,
      { imageB64, isLocalTrack }: { imageB64: string; isLocalTrack: boolean }
    ) => {
      setFrameInfo({ imageB64, isLocalTrack });
    }
  );

  const buttonListRef = useRef<HTMLDivElement>(null);

  const updateButtonListVisibility = useMemoizedFn((visibility: string) => {
    if (buttonListRef.current) {
      buttonListRef.current.style.visibility = visibility;
    }
  });

  const onHideWindow = useMemoizedFn(() => {
    updateButtonListVisibility('hidden');
  });
  const onMouseOver = useMemoizedFn(() => {
    updateButtonListVisibility('visible');
  });
  const onMouseOut = useMemoizedFn(() => {
    updateButtonListVisibility('hidden');
  });

  useEffect(() => {
    const cleanup = (window as any).registerSendFrameHandler(onFrame);
    const cleanupHideWindowHandler = (window as any).registerHideWindowHandler(
      onHideWindow
    );
    document.addEventListener('mouseover', onMouseOver);
    document.addEventListener('mouseout', onMouseOut);

    return () => {
      cleanup();
      cleanupHideWindowHandler();
      document.removeEventListener('mouseover', onMouseOver);
      document.removeEventListener('mouseout', onMouseOut);
    };
  }, []);

  return (
    <div className="floating-bar-body">
      {frameInfo.imageB64 && (
        <div className="frame-container">
          <img
            src={frameInfo.imageB64}
            alt="frame"
            className={classNames('frame-content', {
              'is-local-frame': frameInfo.isLocalTrack,
            })}
          />
        </div>
      )}
      <div className="header"></div>
      <ActiveIndicator info={activeInfo} localStatus={{ micMute }} />
      <div
        className="floating-bar-countdown-timer"
        onClick={onCountdownTimerClick}
      >
        <CountdownTimer ref={countdownTimerRef} readonly={true} />
      </div>
      <div className="active-info">
        <Avatar
          i18n={i18n}
          size={80}
          conversationType="direct"
          id={activeInfo?.id}
          name={activeInfo?.name}
          avatarPath={activeInfo?.avatarPath}
          notShowStatus={true}
          noClickEvent={true}
        />
      </div>
      <div className="button-list" ref={buttonListRef}>
        <div className="button-item-wrapper">
          <IconBackCall
            className="back-call"
            onClick={backToCall}
            onDoubleClick={preventDefault}
          />
        </div>
        <div
          className="button-item-wrapper"
          onClick={() => {
            setMuted(!micMute);
          }}
          onDoubleClick={preventDefault}
        >
          {micMute ? (
            <IconMicrophoneEnable className="mic-muted" />
          ) : (
            <IconMicrophoneDisable className="mic-normal" />
          )}
        </div>
        <div className="button-item-wrapper is-danger">
          <IconLeaveCall
            className="window-close"
            onClick={() => {
              hangup();
            }}
            onDoubleClick={preventDefault}
          />
        </div>
      </div>
    </div>
  );
};
