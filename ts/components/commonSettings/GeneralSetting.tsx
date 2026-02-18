import React, { useEffect, useState } from 'react';
import { LocalizerType } from '../../types/Util';
import { SettingChooseItem } from './CommonSettingComponents';
import { Modal } from 'antd';
import { ExclamationCircleOutlined } from '@ant-design/icons';
import { useMemoizedFn } from 'ahooks';

interface GeneralProps {
  i18n: LocalizerType;
  title: string;
  closeSetting: () => void;
}

interface GeneralState {
  disableHardWareAcceleration: boolean;
  originalDisableHardWareAcceleration: boolean;
  mediaPermissions: boolean;
}

const mainWindow = window as any;

const getInitialData = async (): Promise<GeneralState> => ({
  mediaPermissions: await mainWindow.getMediaPermissions(),
  disableHardWareAcceleration:
    await mainWindow.getDisableHardwareAcceleration(),
  originalDisableHardWareAcceleration:
    await mainWindow.getOriginalDisableHardwareAcceleration(),
});

export const GeneralSetting = (props: GeneralProps) => {
  const { title, closeSetting, i18n } = props;

  const [setting, setSetting] = useState<GeneralState>({
    disableHardWareAcceleration: false,
    originalDisableHardWareAcceleration: false,
    mediaPermissions: false,
  });

  const initData = useMemoizedFn(async () => {
    try {
      const data = await getInitialData();
      setSetting(data);
    } catch (error: any) {
      mainWindow.log.error(
        'settings.initialRequest error:',
        error && error.stack ? error.stack : error
      );
    }
  });

  useEffect(() => {
    initData();
  }, []);

  const onDisableHardwareAccelerationChange = useMemoizedFn(
    async (value: boolean) => {
      setSetting(prev => ({
        ...prev,
        disableHardWareAcceleration: value,
      }));
      await mainWindow.setDisableHardwareAcceleration(value);
      if (setting.originalDisableHardWareAcceleration === value) {
        return;
      }
      Modal.confirm({
        title: i18n('restartRequired'),
        icon: <ExclamationCircleOutlined />,
        content: i18n('restartToApplyChange'),
        okText: i18n('restart'),
        cancelText: i18n('later'),
        onOk: () => {
          mainWindow.restart();
        },
        onCancel: () => {},
      });
    }
  );

  const onMediaPermissionsChange = useMemoizedFn(async (value: boolean) => {
    mainWindow.setMediaPermissions(value);
    setSetting(prev => ({
      ...prev,
      mediaPermissions: value,
    }));
  });

  return (
    <div id="common-setting" className="common-setting">
      <div className="common-setting header-bg"></div>
      <div className="common-setting bottom-bg"></div>
      <div className="common-setting page-title"> {title} </div>
      <div className="common-setting close-button" onClick={closeSetting}>
        <div className="close-button-inner"></div>
      </div>
      <div className="setting-list-content sub-setting-content">
        <div>
          <SettingChooseItem
            title={i18n('hardwareAccelerationDescription')}
            checked={setting.disableHardWareAcceleration}
            mutliCheck={true}
            onChange={onDisableHardwareAccelerationChange}
          />

          <SettingChooseItem
            title={i18n('mediaPermissionsDescription')}
            checked={setting.mediaPermissions}
            mutliCheck={true}
            onChange={onMediaPermissionsChange}
          />
        </div>
      </div>
    </div>
  );
};
