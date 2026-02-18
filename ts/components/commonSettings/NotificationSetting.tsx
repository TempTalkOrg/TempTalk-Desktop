import React, { useEffect, useState } from 'react';
import { useMemoizedFn } from 'ahooks';
import { LocalizerType } from '../../types/Util';
import { SettingChooseItem } from './CommonSettingComponents';
import { isAudioNotificationSupported } from '../../../ts/types/Settings';

interface NotificationProps {
  i18n: LocalizerType;
  title: string;
  closeSetting: () => void;
}

const SettingNames = {
  COUNT: 'count', //neither name or message
  NAME: 'name', //only name
  MESSAGE: 'message', //name & message
  OFF: 'off', //close
};

const mainWindow = window as any;

const getInitialData = async () => {
  let audioSetting = await mainWindow.getAudioNotification();
  if (typeof audioSetting == 'undefined') {
    audioSetting = true;
  }
  return {
    notificationSetting: await mainWindow.getNotificationSetting(),
    audioSetting: audioSetting,
  };
};

export function NotificationSetting(props: NotificationProps) {
  const { closeSetting, i18n, title } = props;
  const [notificationSetting, setNotificationSetting] = useState(
    SettingNames.MESSAGE
  );
  const [audioSetting, setAudioSetting] = useState(true);
  const [supportAudio] = useState(isAudioNotificationSupported());

  const initData = useMemoizedFn(async () => {
    try {
      const data = await getInitialData();
      setNotificationSetting(data.notificationSetting);
      setAudioSetting(data.audioSetting);
    } catch (e: any) {
      console.log('get notification setting error', e?.message);
    }
  });

  useEffect(() => {
    initData();
  }, []);

  const setNotificationType = useMemoizedFn((value: string) => {
    mainWindow.setNotificationSetting(value);
    setNotificationSetting(value);
  });

  const setAudioNotification = useMemoizedFn((value: boolean) => {
    mainWindow.Events.setAudioNotification(value);
    setAudioSetting(value);
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
          <div className="setting-notification-title">
            {i18n('notificationSettingsDialog')}
          </div>

          <SettingChooseItem
            title={i18n('nameAndMessage')}
            checked={notificationSetting === SettingNames.MESSAGE}
            onChange={() => {
              setNotificationType(SettingNames.MESSAGE);
            }}
          />

          <SettingChooseItem
            title={i18n('nameOnly')}
            checked={notificationSetting === SettingNames.NAME}
            onChange={() => {
              setNotificationType(SettingNames.NAME);
            }}
          />
          <SettingChooseItem
            title={i18n('noNameOrMessage')}
            checked={notificationSetting === SettingNames.COUNT}
            onChange={() => {
              setNotificationType(SettingNames.COUNT);
            }}
          />

          <SettingChooseItem
            title={i18n('disableNotifications')}
            checked={notificationSetting === SettingNames.OFF}
            onChange={() => {
              console.log('disableNotifications');
              setNotificationType(SettingNames.OFF);
            }}
          />

          {supportAudio ? (
            <div>
              <div className="setting-notification-title sound-title">
                {i18n('notificationSoundDialog')}
              </div>

              <SettingChooseItem
                title={i18n('audioNotificationDescription')}
                checked={audioSetting}
                mutliCheck={true}
                onChange={(value: boolean) => {
                  setAudioNotification(value);
                }}
              />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
