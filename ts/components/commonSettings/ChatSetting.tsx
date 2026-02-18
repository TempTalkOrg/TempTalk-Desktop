import React, { useEffect, useState } from 'react';
import { LocalizerType } from '../../types/Util';
import { SettingChooseItem } from './CommonSettingComponents';
import { Radio } from 'antd';
import { ConfigProvider } from '../shared/ConfigProvider';
import { useMemoizedFn } from 'ahooks';
import { VOICE_PLAYBACK_SPEED_OPTIONS } from '../shared/constant';

interface IChatSettingProps {
  i18n: LocalizerType;
  closeSetting: () => void;
}

const mainWindow = window as any;

const voicePlaybackSpeedOptions = VOICE_PLAYBACK_SPEED_OPTIONS.map(speed => ({
  label: `${speed}x`,
  value: speed,
}));

export const ChatSetting = (props: IChatSettingProps) => {
  const { closeSetting, i18n } = props;

  const [chatConfigs, setChatConfigs] = useState({
    spellCheck: false,
    voicePlaybackSpeed: 1,
  });

  const initData = useMemoizedFn(async () => {
    const spellCheck = mainWindow.Events.getSpellCheck();
    const voicePlaybackSpeed = mainWindow.Events.getVoicePlaybackSpeed();

    setChatConfigs({
      spellCheck,
      voicePlaybackSpeed,
    });
  });

  useEffect(() => {
    initData();
  }, []);

  return (
    <ConfigProvider>
      <div className="common-setting">
        <div className="common-setting header-bg"></div>
        <div className="common-setting bottom-bg"></div>
        <div className="common-setting close-button" onClick={closeSetting}>
          <div className="close-button-inner"></div>
        </div>
        <div className="common-setting page-title">{i18n('chat')}</div>
        <div className="setting-list-content sub-setting-content chat-setting-content">
          <div className="setting-theme-category-title typing-config">
            {i18n('chatSetting.typing')}
          </div>
          <SettingChooseItem
            title={i18n('spellCheckDescription')}
            checked={chatConfigs.spellCheck}
            mutliCheck={true}
            onChange={value => {
              mainWindow.Events.setSpellCheck(value);
              setChatConfigs(prev => ({ ...prev, spellCheck: value }));
            }}
          />
          <div className="common-setting-divider chat-config-divider"></div>
          <div className="setting-theme-category-title playback-speed-config">
            {i18n('chatSetting.playbackSpeed')}
          </div>
          <div className="setting-theme-category-description playback-speed-description">
            {i18n('chatSetting.playbackSpeedDescription')}
          </div>
          <Radio.Group
            options={voicePlaybackSpeedOptions}
            value={chatConfigs.voicePlaybackSpeed}
            onChange={value => {
              mainWindow.Events.setVoicePlaybackSpeed(value.target.value);
              setChatConfigs(prev => ({
                ...prev,
                voicePlaybackSpeed: value.target.value,
              }));
            }}
          ></Radio.Group>
        </div>
      </div>
    </ConfigProvider>
  );
};
