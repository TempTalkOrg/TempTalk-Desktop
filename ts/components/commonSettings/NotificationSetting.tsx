import React, { Component } from 'react';
import { LocalizerType } from '../../types/Util';
import { SettingChooseItem } from './CommonSettingComponents';
import { isAudioNotificationSupported } from '../../../ts/types/Settings';

interface NotificationProps {
  i18n: LocalizerType;
  title: string;
  closeSetting: () => void;
}

interface NotificationState {
  notificationSetting: string;
  audioSetting: boolean;
  supportAudio: boolean;
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

export class NotificationSetting extends Component<
  NotificationProps,
  NotificationState
> {
  constructor(props: Readonly<NotificationProps>) {
    super(props);

    this.state = {
      notificationSetting: SettingNames.MESSAGE,
      audioSetting: true,
      supportAudio: isAudioNotificationSupported(),
    };

    getInitialData().then(data => {
      this.setState({
        notificationSetting: data.notificationSetting,
        audioSetting: data.audioSetting,
      });
      console.log('xxxxxxxxxx data', JSON.stringify(data));
    });
  }

  private setNotificationType(value: string) {
    mainWindow.setNotificationSetting(value);
    this.setState({ notificationSetting: value });
  }

  private setAudioNotification(value: boolean) {
    mainWindow.Events.setAudioNotification(value);
    this.setState({ audioSetting: value });
  }

  renderNotificationItems() {
    const { i18n } = this.props;
    const { notificationSetting, audioSetting, supportAudio } = this.state;

    return (
      <div>
        <div className="setting-notification-title">
          {i18n('notificationSettingsDialog')}
        </div>

        <SettingChooseItem
          title={i18n('nameAndMessage')}
          checked={notificationSetting === SettingNames.MESSAGE}
          onChange={_ => {
            this.setNotificationType(SettingNames.MESSAGE);
          }}
        />

        <SettingChooseItem
          title={i18n('nameOnly')}
          checked={notificationSetting === SettingNames.NAME}
          onChange={_ => {
            this.setNotificationType(SettingNames.NAME);
          }}
        />
        <SettingChooseItem
          title={i18n('noNameOrMessage')}
          checked={notificationSetting === SettingNames.COUNT}
          onChange={_ => {
            this.setNotificationType(SettingNames.COUNT);
          }}
        />

        <SettingChooseItem
          title={i18n('disableNotifications')}
          checked={notificationSetting === SettingNames.OFF}
          onChange={_ => {
            console.log('disableNotifications');
            this.setNotificationType(SettingNames.OFF);
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
              onChange={value => {
                this.setAudioNotification(value);
              }}
            />
          </div>
        ) : null}
      </div>
    );
  }

  render() {
    const { closeSetting, title } = this.props;
    return (
      <div id="common-setting" className="common-setting">
        <div className="common-setting header-bg"></div>
        <div className="common-setting bottom-bg"></div>
        <div className="common-setting page-title"> {title} </div>
        <div className="common-setting close-button" onClick={closeSetting}>
          <div className="close-button-inner"></div>
        </div>
        <div className="setting-list-content sub-setting-content">
          {this.renderNotificationItems()}
        </div>
      </div>
    );
  }
}
