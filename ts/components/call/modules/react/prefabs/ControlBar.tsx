import { ConnectionState, Track } from '@cc-livekit/livekit-client';
import React, {
  useCallback,
  useMemo,
  useState,
  type HTMLAttributes,
  type MouseEvent as ReactMouseEvent,
} from 'react';
import { MediaDeviceMenu } from './MediaDeviceMenu';
import { DisconnectButton } from '../components/controls/DisconnectButton';
import { TrackToggle } from '../components/controls/TrackToggle';
import {
  useLocalParticipant,
  useLocalParticipantPermissions,
  useParticipants,
  usePersistentUserChoices,
} from '../hooks';
import { useFeatureContext } from '../context';
import { supportsScreenSharing } from '../../core';
import { mergeProps } from '../utils';
import { AddMemberButton } from '../components/controls/AddMemberButton';
import { MemberListButton } from '../components/controls/MemberListButton';
import { MenuProps, Tooltip } from 'antd';
import { BackToMainButton } from '../components/controls/BackToMainButton';
import { RaiseHandButton } from '../components/controls/RaiseHandButton';
import { ContextMenu } from '../../../../shared/ContextMenu';
import { useConnectionState } from '../hooks/useConnectionStatus';
import {
  IconAddMember,
  IconArrowUp,
  IconBackToMain,
  IconEndCall,
  IconLeaveCall,
  IconMemberList,
  IconMoreAction,
  IconRaiseHand,
} from '../../../../shared/icons';
import { useControlBarTooltip } from '../hooks/useControlBarTooltip';
import { ScreenShareModeMenu } from './ScreenShareModeMenu';
import { screenShareAtom } from '../../../atoms/screenShareAtom';
import { useAtom, useAtomValue } from 'jotai';
import { SpeedHint } from '../../../../SpeedHint';
import classNames from 'classnames';
import { pinnedControlsAtom } from '../../../atoms/roomAtom';
import { PushpinOutlined } from '@ant-design/icons';

export type ControlBarControls = {
  microphone?: boolean;
  camera?: boolean;
  chat?: boolean;
  screenShare?: boolean;
  leave?: boolean;
  settings?: boolean;
  addMember?: boolean;
  memberList?: boolean;
  backToMain?: boolean;
  raiseHand?: boolean;
};

export interface ControlBarProps extends HTMLAttributes<HTMLDivElement> {
  onDeviceError?: (error: { source: Track.Source; error: Error }) => void;
  variation?: 'minimal' | 'verbose' | 'textOnly';
  controls?: ControlBarControls;
  saveUserChoices?: boolean;
  onScreenShareClick?: (
    evt: ReactMouseEvent<HTMLButtonElement, MouseEvent>
  ) => void;
  onAddMember?: () => void;
  onMemberList?: () => void;
}

export function ControlBar({
  variation,
  controls,
  saveUserChoices = true,
  onDeviceError,
  onScreenShareClick,
  onAddMember,
  onMemberList,
  ...props
}: ControlBarProps) {
  const visibleControls = { leave: true, ...controls };

  const localPermissions = useLocalParticipantPermissions();
  const participants = useParticipants();
  const { isRequesting: requestingScreenShare } = useAtomValue(screenShareAtom);

  const connectionState = useConnectionState();
  const { localParticipant } = useLocalParticipant();

  const connected = useMemo(
    () => connectionState === ConnectionState.Connected,
    [connectionState]
  );

  if (!localPermissions) {
    visibleControls.camera = false;
    visibleControls.chat = false;
    visibleControls.microphone = false;
    visibleControls.screenShare = false;
  } else {
    visibleControls.camera ??= localPermissions.canPublish;
    visibleControls.microphone ??= localPermissions.canPublish;
    visibleControls.screenShare ??= localPermissions.canPublish;
    visibleControls.chat ??= localPermissions.canPublishData && controls?.chat;
  }

  const showIcon = useMemo(
    () => variation === 'minimal' || variation === 'verbose',
    [variation]
  );
  const showText = useMemo(
    () => variation === 'textOnly' || variation === 'verbose',
    [variation]
  );

  const browserSupportsScreenSharing = supportsScreenSharing();

  const [isScreenShareEnabled, setIsScreenShareEnabled] = useState(false);

  const onScreenShareChange = useCallback(
    (enabled: boolean) => {
      setIsScreenShareEnabled(enabled);
    },
    [setIsScreenShareEnabled]
  );

  const htmlProps = mergeProps({ className: 'control-bar-container' }, props);

  const {
    saveAudioInputEnabled,
    saveVideoInputEnabled,
    saveAudioInputDeviceId,
    saveVideoInputDeviceId,
  } = usePersistentUserChoices({ preventSave: !saveUserChoices });

  const microphoneOnChange = useCallback(
    (enabled: boolean, isUserInitiated: boolean) =>
      isUserInitiated ? saveAudioInputEnabled(enabled) : null,
    [saveAudioInputEnabled]
  );

  const cameraOnChange = useCallback(
    (enabled: boolean, isUserInitiated: boolean) =>
      isUserInitiated ? saveVideoInputEnabled(enabled) : null,
    [saveVideoInputEnabled]
  );

  const featureFlags = useFeatureContext(true);
  const { i18n } = featureFlags;

  const onEndCall = () => {
    featureFlags?.onEndCall?.();
  };

  const onBackToMain = () => {
    featureFlags?.onBackToMain?.();
  };

  const criticalAlert = featureFlags?.criticalAlert;

  const { tooltipText, tooltipProps } = useControlBarTooltip();

  const isSupportSystemMode = featureFlags?.isSupportSystemMode;

  const [pinnedControls, setPinnedControls] = useAtom(pinnedControlsAtom);

  const defaultMenuItems = [
    {
      key: 'pin',
      label: (
        <div className="more-action-menu-item">
          <PushpinOutlined />
          {pinnedControls ? i18n('unpin') : i18n('pin')}
        </div>
      ),
      onClick: () => {
        setPinnedControls(!pinnedControls);
      },
    },
  ];

  const menuItems: MenuProps['items'] = [
    ...defaultMenuItems,
    ...(criticalAlert?.visible ? (criticalAlert?.menuItems ?? []) : []),
  ];

  return (
    <div {...htmlProps}>
      {featureFlags.type !== '1on1' ? (
        <div className="controlbar-left-content">
          {visibleControls.backToMain && (
            <BackToMainButton onClick={onBackToMain}>
              <IconBackToMain />
            </BackToMainButton>
          )}
          <SpeedHint
            i18n={featureFlags.i18n}
            onSendSpeedHint={featureFlags.onSendSpeedHint}
          />
        </div>
      ) : null}
      <div className="control-area">
        {visibleControls.raiseHand && connected && (
          <Tooltip {...tooltipProps} title={tooltipText.raiseHand}>
            <RaiseHandButton>
              <IconRaiseHand className="call-icon control-bar-icon raise-hand-icon" />
            </RaiseHandButton>
          </Tooltip>
        )}
        {visibleControls.microphone && (
          <div className="button-group">
            <Tooltip {...tooltipProps} title={tooltipText.microphone}>
              <TrackToggle
                source={Track.Source.Microphone}
                showIcon={showIcon}
                onChange={microphoneOnChange}
                onDeviceError={error =>
                  onDeviceError?.({ source: Track.Source.Microphone, error })
                }
              >
                {showText && 'Microphone'}
              </TrackToggle>
            </Tooltip>

            <div className="button-group-menu">
              <MediaDeviceMenu
                kind="audioinput"
                onActiveDeviceChange={(_kind, deviceId) =>
                  saveAudioInputDeviceId(deviceId ?? '')
                }
              />
            </div>
          </div>
        )}
        {visibleControls.camera && (
          <div className="button-group">
            <Tooltip {...tooltipProps} title={tooltipText.video}>
              <TrackToggle
                source={Track.Source.Camera}
                showIcon={showIcon}
                onChange={cameraOnChange}
                onDeviceError={error =>
                  onDeviceError?.({ source: Track.Source.Camera, error })
                }
              >
                {showText && 'Camera'}
              </TrackToggle>
            </Tooltip>

            <div className="button-group-menu">
              <MediaDeviceMenu
                kind="videoinput"
                onActiveDeviceChange={(_kind, deviceId) =>
                  saveVideoInputDeviceId(deviceId ?? '')
                }
              />
            </div>
          </div>
        )}
        {visibleControls.screenShare && browserSupportsScreenSharing && (
          <Tooltip {...tooltipProps} title={tooltipText.screenShare}>
            {isSupportSystemMode ? (
              localParticipant.isScreenShareEnabled ? (
                <TrackToggle
                  disabled={requestingScreenShare}
                  source={Track.Source.ScreenShare}
                  captureOptions={{
                    audio: true,
                    selfBrowserSurface: 'include',
                  }}
                  showIcon={showIcon}
                  onChange={onScreenShareChange}
                  onClick={onScreenShareClick}
                  onDeviceError={error =>
                    onDeviceError?.({ source: Track.Source.ScreenShare, error })
                  }
                  className={isScreenShareEnabled ? 'stop-sharing-button' : ''}
                >
                  {showText &&
                    (isScreenShareEnabled
                      ? 'Stop screen share'
                      : 'Share screen')}
                </TrackToggle>
              ) : (
                <div className="button-group">
                  <TrackToggle
                    disabled={requestingScreenShare}
                    source={Track.Source.ScreenShare}
                    captureOptions={{
                      audio: true,
                      selfBrowserSurface: 'include',
                    }}
                    showIcon={showIcon}
                    onChange={onScreenShareChange}
                    onClick={onScreenShareClick}
                    onDeviceError={error =>
                      onDeviceError?.({
                        source: Track.Source.ScreenShare,
                        error,
                      })
                    }
                  >
                    {showText &&
                      (isScreenShareEnabled
                        ? 'Stop screen share'
                        : 'Share screen')}
                  </TrackToggle>
                  <div className="button-group-menu">
                    <ScreenShareModeMenu />
                  </div>
                </div>
              )
            ) : (
              <TrackToggle
                disabled={requestingScreenShare}
                source={Track.Source.ScreenShare}
                captureOptions={{
                  audio: true,
                  selfBrowserSurface: 'include',
                }}
                showIcon={showIcon}
                onChange={onScreenShareChange}
                onClick={onScreenShareClick}
                onDeviceError={error =>
                  onDeviceError?.({ source: Track.Source.ScreenShare, error })
                }
              >
                {showText &&
                  (isScreenShareEnabled ? 'Stop screen share' : 'Share screen')}
              </TrackToggle>
            )}
          </Tooltip>
        )}
        {visibleControls.addMember && (
          <Tooltip {...tooltipProps} title={tooltipText.addMember}>
            <AddMemberButton onClick={onAddMember}>
              {showIcon && (
                <IconAddMember className="call-icon control-bar-icon add-member-outer-icon" />
              )}
              {showText && 'Add member'}
            </AddMemberButton>
          </Tooltip>
        )}
        {visibleControls.memberList && (
          <div className="button-group member-list-button-group">
            <Tooltip {...tooltipProps} title={tooltipText.memberList}>
              <MemberListButton onClick={onMemberList}>
                {showIcon && (
                  <IconMemberList className="call-icon control-bar-icon member-list-icon" />
                )}
                {showText && 'Member list'}
                <span style={{ fontSize: 14, fontWeight: 510 }}>
                  {participants.length}
                </span>
              </MemberListButton>
            </Tooltip>
            <div className="button-group-menu">
              <ContextMenu
                trigger={['click']}
                placement="top"
                align={{
                  offset: [0, -2],
                }}
                menu={{
                  items: [
                    {
                      key: 'invite',
                      label: (
                        <div
                          className="invite-member-item"
                          onClick={() => {
                            onAddMember?.();
                          }}
                        >
                          <IconAddMember className="call-icon control-bar-icon add-member-icon" />
                          Invite
                        </div>
                      ),
                      onClick: () => {
                        onAddMember?.();
                      },
                    },
                  ],
                }}
              >
                <button className="button button-menu">
                  <IconArrowUp />
                </button>
              </ContextMenu>
            </div>
          </div>
        )}
        {visibleControls.leave && featureFlags?.type === '1on1' && (
          <DisconnectButton title={tooltipText.endCall}>
            {showIcon && (
              <IconEndCall className="call-icon control-bar-icon end-call-icon" />
            )}
            {showText && 'Leave'}
          </DisconnectButton>
        )}
        {visibleControls.leave && featureFlags?.type !== '1on1' && (
          <div className="leave-button-group">
            <DisconnectButton title={tooltipText.leaveCall}>
              {showIcon && (
                <IconLeaveCall className="call-icon control-bar-icon leave-call-icon" />
              )}
            </DisconnectButton>
            <button
              className="button button-menu end-call-menu-button"
              onClick={onEndCall}
            >
              <IconArrowUp />
            </button>
          </div>
        )}
      </div>
      <Tooltip
        {...tooltipProps}
        title={tooltipText.moreAction}
        placement="topRight"
      >
        <ContextMenu
          menu={{ items: menuItems }}
          placement="topRight"
          trigger={['click']}
        >
          <div
            className={classNames([
              'more-action-button',
              {
                'is-visible': menuItems.length > 0,
              },
            ])}
          >
            <IconMoreAction className="call-icon control-bar-icon more-action-icon" />
          </div>
        </ContextMenu>
      </Tooltip>
    </div>
  );
}
