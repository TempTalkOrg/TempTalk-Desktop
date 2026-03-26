import * as React from 'react';
import { MediaDeviceSelect } from '../components/controls/MediaDeviceSelect';
import { log } from '../../core';
import { Select, Switch } from 'antd';
import { useFeatureContext } from '../context';
import { ContextMenu } from '../../../../shared/ContextMenu';
import { useMemoizedFn } from 'ahooks';
import { IconArrowUp } from '../../../../shared/icons';

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
  const {
    denoiseEnable,
    onDenoiseEnableChange,
    denoiseMode,
    onDenoiseModeChange,
    i18n,
  } = useFeatureContext(true);

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
            {i18n('micNoiseSuppression')}
            <Switch
              size="small"
              checked={denoiseEnable}
              onChange={checked => onDenoiseEnableChange?.(checked)}
            />
          </div>
          <div className="device-menu-denoise-engine">
            {i18n('micDenoiseEngine')}
            <Select
              size="small"
              className="device-menu-denoise-engine-select"
              popupClassName="device-menu-denoise-engine-dropdown"
              value={denoiseMode ?? 'enhanced'}
              options={[
                {
                  label: i18n('denoiseMode.standard'),
                  value: 'standard',
                },
                {
                  label: i18n('denoiseMode.enhanced'),
                  value: 'enhanced',
                },
              ]}
              onChange={value => onDenoiseModeChange?.(value)}
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
      <button className="button button-menu" {...props} ref={button}>
        <IconArrowUp />
        {props.children}
      </button>
    </ContextMenu>
  );
}
