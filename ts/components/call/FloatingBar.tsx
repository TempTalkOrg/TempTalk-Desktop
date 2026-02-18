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
import { Button, Flex, Radio } from 'antd';
import { ExclamationCircleOutlined } from '@ant-design/icons';
import { ConfigProvider } from '../shared/ConfigProvider';

type SpeakerUserInfoType = {
  name: string;
  accountName: string;
  avatarPath: string;
  id: string;
  isSpeaking?: boolean;
  isLocal?: boolean;
  isMuted?: boolean;
};

type ScreenShareUserInfoType = {
  name: string;
  accountName: string;
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

  const radioGroupRef = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState<string>();
  const [requireScreenShare, setRequireScreenShare] = useState<{
    countdown: number;
    radioOptions: { label: string; value: string }[];
  } | null>(null);

  const onRequireScreenShareChange = useMemoizedFn(
    (requireScreenShare: {
      countdown: number;
      radioOptions: { label: string; value: string }[];
    }) => {
      setRequireScreenShare(requireScreenShare);
      if (!selected) {
        setSelected(requireScreenShare.radioOptions[0].value);
      }
    }
  );

  const cleanupRequireScreenShare = useMemoizedFn(() => {
    setRequireScreenShare(null);
    setSelected(undefined);
  });

  useEffect(() => {
    if (!selected) {
      return;
    }
    (window as any).sendRequireScreenShareAction({
      action: 'select',
      value: selected,
    });
  }, [selected]);

  const onApproveScreenShare = useMemoizedFn(() => {
    (window as any).sendRequireScreenShareAction({
      action: 'approve',
    });
  });

  const onRejectScreenShare = useMemoizedFn(() => {
    (window as any).sendRequireScreenShareAction({
      action: 'reject',
    });
  });

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
        requireScreenShare?: {
          countdown: number;
          radioOptions: { label: string; value: string }[];
        };
      }
    ) => {
      const { muted, speaker, screenShare, countdown, requireScreenShare } =
        props ?? {};
      console.log(
        '[floating bar] receive update event:',
        'muted',
        muted,
        'speaker',
        speaker?.id,
        'screenShare',
        screenShare?.id,
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
      if (requireScreenShare !== undefined) {
        if (requireScreenShare) {
          onRequireScreenShareChange(requireScreenShare);
        } else {
          cleanupRequireScreenShare();
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
    if (!speaker) return undefined;
    if (!screenShare || !speaker.isLocal) {
      return { ...speaker, type: 'audio' };
    } else {
      return { ...screenShare, type: 'screen-share' };
    }
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

  const title = i18n(
    `screenShare.approvalModal.title.${
      (requireScreenShare?.radioOptions?.length || 0) > 1
        ? 'miltiRequest'
        : 'singleRequest'
    }`
  );

  return (
    <ConfigProvider>
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
            accountName={activeInfo?.accountName}
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
        {requireScreenShare && (
          <div className="floating-bar-require-screen-share">
            <span className="floating-bar-require-screen-share-title">
              <ExclamationCircleOutlined className="content-icon" />
              <span className="content-title-info-text">
                {requireScreenShare.radioOptions.length === 1 ? (
                  <span className="content-title-info-name">
                    {requireScreenShare.radioOptions?.[0]?.label}
                  </span>
                ) : null}
                {title}
                <span className="content-title-countdown">
                  ({requireScreenShare.countdown}s)
                </span>
              </span>
            </span>
            {requireScreenShare.radioOptions.length > 1 && (
              <Radio.Group
                size="small"
                ref={radioGroupRef}
                options={requireScreenShare.radioOptions}
                value={selected}
                className="floating-bar-require-screen-share-radio-group universal-radio-group"
                onChange={e => setSelected(e.target.value)}
              ></Radio.Group>
            )}
            <Flex
              className="floating-bar-require-screen-share-button-group"
              gap={8}
            >
              <Button
                size="small"
                className="floating-bar-require-screen-share-button"
                type="default"
                onClick={onApproveScreenShare}
              >
                {i18n('approveNow')}
              </Button>
              <Button
                size="small"
                className="floating-bar-require-screen-share-button"
                type="default"
                onClick={onRejectScreenShare}
              >
                {i18n('reject')}
              </Button>
            </Flex>
          </div>
        )}
      </div>
    </ConfigProvider>
  );
};
