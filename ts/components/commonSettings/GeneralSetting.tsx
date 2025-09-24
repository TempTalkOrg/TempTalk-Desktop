import React, { Component } from 'react';
import { LocalizerType } from '../../types/Util';
import { SettingChooseItem } from './CommonSettingComponents';
import { Modal } from 'antd';
import { ExclamationCircleOutlined } from '@ant-design/icons';

interface GeneralProps {
  i18n: LocalizerType;
  title: string;
  closeSetting: () => void;
}

interface GeneralState {
  disableHardWareAcceleration: boolean;
  originalDisableHardWareAcceleration: boolean;
  spellCheck: boolean;
  mediaPermissions: boolean;
  quitTopicSetting: boolean;
}

const mainWindow = window as any;

const getInitialData = async () => ({
  spellCheck: await mainWindow.getSpellCheck(),
  mediaPermissions: await mainWindow.getMediaPermissions(),
  disableHardwareAcceleration:
    await mainWindow.getDisableHardwareAcceleration(),
  originalDisableHardWareAcceleration:
    await mainWindow.getOriginalDisableHardwareAcceleration(),
  quitTopicSetting: await mainWindow.getQuitTopicSetting(),
});

export class GeneralSetting extends Component<GeneralProps, GeneralState> {
  constructor(props: Readonly<GeneralProps>) {
    super(props);

    this.state = {
      disableHardWareAcceleration: false,
      originalDisableHardWareAcceleration: false,
      spellCheck: false,
      mediaPermissions: false,
      quitTopicSetting: true,
    };

    getInitialData().then(
      data => {
        'use strict';

        this.setState({
          disableHardWareAcceleration: data.disableHardwareAcceleration,
          originalDisableHardWareAcceleration:
            data.originalDisableHardWareAcceleration,
          spellCheck: data.spellCheck,
          mediaPermissions: data.mediaPermissions,
          quitTopicSetting: data.quitTopicSetting,
        });
      },
      error => {
        'use strict';

        mainWindow.log.error(
          'settings.initialRequest error:',
          error && error.stack ? error.stack : error
        );
      }
    );
  }

  renderGeneralItems() {
    const { i18n } = this.props;
    const {
      disableHardWareAcceleration,
      originalDisableHardWareAcceleration,
      spellCheck,
      mediaPermissions,
      // quitTopicSetting,
    } = this.state;

    return (
      <div>
        <SettingChooseItem
          title={i18n('hardwareAccelerationDescription')}
          checked={disableHardWareAcceleration}
          mutliCheck={true}
          onChange={async value => {
            this.setState({ disableHardWareAcceleration: value });
            await mainWindow.setDisableHardwareAcceleration(value);
            if (originalDisableHardWareAcceleration === value) {
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
              onCancel: () => {
                // this.setState({ disableHardWareAcceleration: !value });
              },
            });
          }}
        />

        <SettingChooseItem
          title={i18n('spellCheckDescription')}
          checked={spellCheck}
          mutliCheck={true}
          onChange={value => {
            mainWindow.Events.setSpellCheck(value);
            this.setState({ spellCheck: value });
          }}
        />

        <SettingChooseItem
          title={i18n('mediaPermissionsDescription')}
          checked={mediaPermissions}
          mutliCheck={true}
          onChange={value => {
            mainWindow.setMediaPermissions(value);
            this.setState({ mediaPermissions: value });
          }}
        />

        {/* <SettingChooseItem
          title={i18n('quitTopicDescription')}
          checked={quitTopicSetting}
          mutliCheck={true}
          onChange={value => {
            mainWindow.setQuitTopicSetting(value);
            this.setState({ quitTopicSetting: value });
          }}
        /> */}
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
          {this.renderGeneralItems()}
        </div>
      </div>
    );
  }
}
