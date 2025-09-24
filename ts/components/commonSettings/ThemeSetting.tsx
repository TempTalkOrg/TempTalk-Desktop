import React, { Component } from 'react';
import { LocalizerType } from '../../types/Util';
import { ThemeSettingItem, ThemeSettingType } from './CommonSettingComponents';

interface ThemeProps {
  i18n: LocalizerType;
  title: string;
  closeSetting: () => void;
}

interface ThemeState {
  theme: ThemeSettingType;
}

const mainWindow = window as any;

const getInitialData = async () => ({
  themeSetting: await mainWindow.Events.getThemeSetting(),
});

export class ThemeSetting extends Component<ThemeProps, ThemeState> {
  constructor(props: Readonly<ThemeProps>) {
    super(props);

    this.state = {
      theme: ThemeSettingType.system,
    };

    getInitialData().then(data => {
      this.setState({
        theme: data.themeSetting,
      });
    });
  }

  private setTheme(theme: string) {
    (window as any).setThemeSetting(theme);
    // mainWindow.Events.setThemeSetting(theme);
    this.setState({ theme: theme as ThemeSettingType });
  }

  renderSettingItems() {
    const { i18n } = this.props;
    const { theme } = this.state;

    return (
      <div>
        <ThemeSettingItem
          title={i18n('themeSystem')}
          type={ThemeSettingType.system}
          checked={theme === ThemeSettingType.system}
          onChange={() => {
            this.setTheme(ThemeSettingType.system);
          }}
        />

        <ThemeSettingItem
          title={i18n('themeLight')}
          type={ThemeSettingType.light}
          checked={theme === ThemeSettingType.light}
          onChange={() => {
            this.setTheme(ThemeSettingType.light);
          }}
        />
        <ThemeSettingItem
          title={i18n('themeDark')}
          type={ThemeSettingType.dark}
          checked={theme === ThemeSettingType.dark}
          onChange={() => {
            this.setTheme(ThemeSettingType.dark);
          }}
        />
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
