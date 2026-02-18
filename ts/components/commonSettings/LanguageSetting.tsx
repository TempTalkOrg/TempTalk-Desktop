import React, { useEffect, useState } from 'react';
import { LocalizerType } from '../../types/Util';
import { Radio, Space, Modal } from 'antd';
import { ExclamationCircleOutlined } from '@ant-design/icons';
import { useMemoizedFn } from 'ahooks';

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

export const LanguageSetting = (props: LanguageProps) => {
  const { i18n } = props;
  const [settings, setSettings] = useState<LanguageState>({
    language: 'en',
    originalLanguage: 'en',
  });

  const initData = useMemoizedFn(async () => {
    try {
      const data = await getInitialData();
      setSettings(data);
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

  const onLanguageChange = useMemoizedFn(async (event: any) => {
    const language = event?.target?.value;
    setSettings(prev => ({
      ...prev,
      language,
    }));
    await mainWindow.setLanguage(language);
    if (settings.originalLanguage === language) {
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
  });

  const { closeSetting, title } = props;

  return (
    <div id="common-setting" className="common-setting">
      <div className="common-setting header-bg"></div>
      <div className="common-setting bottom-bg"></div>
      <div className="common-setting page-title"> {title} </div>
      <div className="common-setting close-button" onClick={closeSetting}>
        <div className="close-button-inner"></div>
      </div>
      <div className="setting-list-content sub-setting-content">
        <div className={'language-setting-content'}>
          <Radio.Group onChange={onLanguageChange} value={settings.language}>
            <Space direction="vertical">
              <Radio value={'en'}>English</Radio>
              <Radio value={'zh-CN'}>简体中文</Radio>
            </Space>
          </Radio.Group>
        </div>
      </div>
    </div>
  );
};
