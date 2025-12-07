import { ConnectionState, Track } from '@cc-livekit/livekit-client';
import * as React from 'react';
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
import { MessageSender } from '../components/MessageSender';
import { Tooltip } from 'antd';
import { BackToMainButton } from '../components/controls/BackToMainButton';
import { RaiseHandButton } from '../components/controls/RaiseHandButton';
import { ContextMenu } from '../../../../shared/ContextMenu';
import { useConnectionState } from '../hooks/useConnectionStatus';
import { useMemo } from 'react';
import {
  IconAddMember,
  IconBackToMain,
  IconEndCall,
  IconLeaveCall,
  IconMemberList,
  IconMoreAction,
  IconRaiseHand,
} from '../../../../shared/icons';
import { useControlBarTooltip } from '../hooks/useControlBarTooltip';
import { ScreenShareModeMenu } from './ScreenShareModeMenu';

/** @public */
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

/** @public */
export interface ControlBarProps extends React.HTMLAttributes<HTMLDivElement> {
  onDeviceError?: (error: { source: Track.Source; error: Error }) => void;
  variation?: 'minimal' | 'verbose' | 'textOnly';
  controls?: ControlBarControls;
  /**
   * If `true`, the user's device choices will be persisted.
   * This will enable the user to have the same device choices when they rejoin the room.
   * @defaultValue true
   * @alpha
   */
  saveUserChoices?: boolean;
  onScreenShareClick?: (
    evt: React.MouseEvent<HTMLButtonElement, MouseEvent>
  ) => void;
  onAddMember?: () => void;
  onMemberList?: () => void;
}

/**
 * The `ControlBar` prefab gives the user the basic user interface to control their
 * media devices (camera, microphone and screen share), open the `Chat` and leave the room.
 *
 * @remarks
 * This component is build with other LiveKit components like `TrackToggle`,
 * `DeviceSelectorButton`, `DisconnectButton` and `StartAudio`.
 *
 * @example
 * ```tsx
 * <LiveKitRoom>
 *   <ControlBar />
 * </LiveKitRoom>
 * ```
 * @public
 */
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

  const showIcon = React.useMemo(
    () => variation === 'minimal' || variation === 'verbose',
    [variation]
  );
  const showText = React.useMemo(
    () => variation === 'textOnly' || variation === 'verbose',
    [variation]
  );

  const browserSupportsScreenSharing = supportsScreenSharing();

  const [isScreenShareEnabled, setIsScreenShareEnabled] = React.useState(false);

  const onScreenShareChange = React.useCallback(
    (enabled: boolean) => {
      setIsScreenShareEnabled(enabled);
    },
    [setIsScreenShareEnabled]
  );

  const htmlProps = mergeProps({ className: 'lk-control-bar' }, props);

  const {
    saveAudioInputEnabled,
    saveVideoInputEnabled,
    saveAudioInputDeviceId,
    saveVideoInputDeviceId,
  } = usePersistentUserChoices({ preventSave: !saveUserChoices });

  const microphoneOnChange = React.useCallback(
    (enabled: boolean, isUserInitiated: boolean) =>
      isUserInitiated ? saveAudioInputEnabled(enabled) : null,
    [saveAudioInputEnabled]
  );

  const cameraOnChange = React.useCallback(
    (enabled: boolean, isUserInitiated: boolean) =>
      isUserInitiated ? saveVideoInputEnabled(enabled) : null,
    [saveVideoInputEnabled]
  );

  const featureFlags = useFeatureContext();
  const onSendMessage = featureFlags?.onSendMessage || undefined;

  const onEndCall = () => {
    featureFlags?.onEndCall?.();
  };

  const onBackToMain = () => {
    featureFlags?.onBackToMain?.();
  };

  const criticalAlert = featureFlags?.criticalAlert;

  const { tooltipText, tooltipProps } = useControlBarTooltip();

  const isSupportSystemMode = featureFlags?.isSupportSystemMode;

  return (
    <div {...htmlProps}>
      {visibleControls.backToMain && (
        <BackToMainButton onClick={onBackToMain}>
          <IconBackToMain />
        </BackToMainButton>
      )}
      <div className="lk-control-area">
        {visibleControls.raiseHand && connected && (
          <Tooltip {...tooltipProps} title={tooltipText.raiseHand}>
            <RaiseHandButton>
              <IconRaiseHand className="call-icon control-bar-icon raise-hand-icon" />
            </RaiseHandButton>
          </Tooltip>
        )}
        {visibleControls.microphone && (
          <div className="lk-button-group">
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

            <div className="lk-button-group-menu">
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
          <div className="lk-button-group">
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

            <div className="lk-button-group-menu">
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
                  className={
                    isScreenShareEnabled
                      ? 'system-mode-stop-sharing-button'
                      : ''
                  }
                >
                  {showText &&
                    (isScreenShareEnabled
                      ? 'Stop screen share'
                      : 'Share screen')}
                </TrackToggle>
              ) : (
                <div className="lk-button-group">
                  <TrackToggle
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
                  <div className="lk-button-group-menu">
                    <ScreenShareModeMenu />
                  </div>
                </div>
              )
            ) : (
              <TrackToggle
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
          <div className="lk-button-group lk-member-list-button-group">
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
            <div className="lk-button-group-menu">
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
                          className="lk-invite-member-item"
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
                <button className="lk-button lk-button-menu"></button>
              </ContextMenu>
            </div>
          </div>
        )}
        {criticalAlert?.visible && (
          <Tooltip {...tooltipProps} title={tooltipText.moreAction}>
            <ContextMenu
              menu={{ items: criticalAlert.menuItems }}
              placement="top"
              trigger={['click']}
            >
              <button className="more-action-button">
                <IconMoreAction className="call-icon control-bar-icon more-action-icon" />
              </button>
            </ContextMenu>
          </Tooltip>
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
          <div className="lk-leave-button-group">
            <DisconnectButton title={tooltipText.leaveCall}>
              {showIcon && (
                <IconLeaveCall className="call-icon control-bar-icon leave-call-icon" />
              )}
            </DisconnectButton>
            <button
              className="lk-button lk-button-menu lk-end-call-menu-button"
              onClick={onEndCall}
            ></button>
          </div>
        )}
      </div>
      {visibleControls.chat && (
        <MessageSender
          onSendMessage={onSendMessage}
          presetTexts={featureFlags?.chatPresets}
        />
      )}
    </div>
  );
}
