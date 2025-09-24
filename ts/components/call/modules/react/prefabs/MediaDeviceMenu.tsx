import * as React from 'react';
import { MediaDeviceSelect } from '../components/controls/MediaDeviceSelect';
import { log } from '../../core';
import { Switch } from 'antd';
import { useFeatureContext } from '../context';
import { useLocaleText } from '../hooks/useLocaleText';
import { ContextMenu } from '../../../../shared/ContextMenu';
import { useMemoizedFn } from 'ahooks';

export interface MediaDeviceMenuProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  kind?: MediaDeviceKind;
  onActiveDeviceChange?: (kind: MediaDeviceKind, deviceId: string) => void;
}

export function MediaDeviceMenu({
  kind,
  onActiveDeviceChange,
  ...props
}: MediaDeviceMenuProps) {
  const { denoiseEnable, onDenoiseEnableChange } = useFeatureContext() ?? {};
  const getLocaleText = useLocaleText();

  const handleActiveDeviceChange = (
    kind: MediaDeviceKind,
    deviceId: string
  ) => {
    log.debug('handle device change');
    onActiveDeviceChange?.(kind, deviceId);
  };

  const button = React.useRef<HTMLButtonElement>(null);

  const renderDropdown = useMemoizedFn(() => {
    if (kind === 'audioinput') {
      return (
        <div className="media-device-menu-container">
          <p
            className="media-device-menu-title"
            style={{
              marginBottom: 6,
            }}
          >
            Microphone
          </p>
          <MediaDeviceSelect
            onActiveDeviceChange={deviceId =>
              handleActiveDeviceChange('audioinput', deviceId)
            }
            kind={'audioinput'}
          />
          <p
            className="media-device-menu-title"
            style={{
              marginTop: 4,
            }}
          >
            Speakers
          </p>
          <MediaDeviceSelect
            onActiveDeviceChange={deviceId =>
              handleActiveDeviceChange('audiooutput', deviceId)
            }
            kind={'audiooutput'}
          />
          <div className="device-menu-noise-suppression">
            {getLocaleText('micNoiseSuppression')}
            <Switch
              size="small"
              checked={denoiseEnable}
              onChange={checked => onDenoiseEnableChange?.(checked)}
            />
          </div>
        </div>
      );
    } else if (kind === 'videoinput') {
      return (
        <div className="media-device-menu-container">
          <MediaDeviceSelect
            onActiveDeviceChange={deviceId =>
              handleActiveDeviceChange(kind, deviceId)
            }
            kind={kind}
          />
        </div>
      );
    } else {
      return null;
    }
  });

  return (
    <ContextMenu
      overlayClassName="media-device-select"
      dropdownRender={renderDropdown}
      trigger={['click']}
      placement="top"
    >
      <button className="lk-button lk-button-menu" {...props} ref={button}>
        {props.children}
      </button>
    </ContextMenu>
  );
}
