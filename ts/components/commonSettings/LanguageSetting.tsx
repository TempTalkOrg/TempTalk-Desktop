import React, { Component } from 'react';
import { LocalizerType } from '../../types/Util';
import { Radio, Space, Modal } from 'antd';
import { ExclamationCircleOutlined } from '@ant-design/icons';

interface LanguageProps {
  i18n: LocalizerType;
  title: string;
  closeSetting: () => void;
}

interface LanguageState {
  language: string;
  originalLanguage: string;
}

const mainWindow = window as any;

const getInitialData = async () => ({
  language: await mainWindow.getLanguage(),
  originalLanguage: await mainWindow.getOriginalLanguage(),
});

export class LanguageSetting extends Component<LanguageProps, LanguageState> {
  constructor(props: Readonly<LanguageProps>) {
    super(props);
    this.state = {
      language: 'en',
      originalLanguage: 'en',
    };
    getInitialData().then(data => {
      this.setState({
        language: data.language,
        originalLanguage: data.originalLanguage,
      });
    });
  }

  public onLanguageChange = async (event: any) => {
    const { i18n } = this.props;
    const { originalLanguage } = this.state;
    const language = event?.target?.value;
    this.setState({
      language,
    });
    await mainWindow.setLanguage(language);
    if (originalLanguage === language) {
      return;
    }
    Modal.confirm({
      title: i18n('restartRequired'),
      icon: <ExclamationCircleOutlined />,
      content: i18n('languageRestartToApplyChange'),
      okText: i18n('restart'),
      cancelText: i18n('later'),
      onOk: () => {
        mainWindow.restart();
      },
      onCancel: () => {
        // this.setState({ language });
      },
    });
  };

  renderSettingItems() {
    const { language } = this.state;
    return (
      <div className={'language-setting-content'}>
        <Radio.Group onChange={this.onLanguageChange} value={language}>
          <Space direction="vertical">
            <Radio value={'en'}>English</Radio>
            <Radio value={'zh-CN'}>简体中文</Radio>
          </Space>
        </Radio.Group>
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
          {this.renderSettingItems()}
        </div>
      </div>
    );
  }
}
