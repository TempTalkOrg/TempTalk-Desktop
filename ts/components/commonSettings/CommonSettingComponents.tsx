import React from 'react';

interface CommonSettingItemProps {
  clickAction?: () => void;
  title: string;
  showArrow?: boolean;
}

export class CommonSettingItem extends React.Component<CommonSettingItemProps> {
  render() {
    const { title, showArrow, clickAction } = this.props;

    return (
      <div className="setting-item-content" onClick={clickAction}>
        <div className="setting-item-title">{title}</div>
        {showArrow ? <div className="setting-item-arrow-img" /> : null}
      </div>
    );
  }
}

export enum ThemeSettingType {
  dark = 'dark',
  light = 'light',
  system = 'system',
}

interface ThemeSettingItemProps {
  type: ThemeSettingType;
  title: string;
  onChange?: () => void;
  checked?: boolean;
}

export class ThemeSettingItem extends React.Component<ThemeSettingItemProps> {
  render() {
    const { title, type, onChange, checked } = this.props;

    const check_id = 'id-setting-theme-' + type;
    return (
      <div
        className="setting-theme-item-content"
        // onClick={onChange}
      >
        <input
          id={check_id}
          className={'setting-select-checkbox'}
          type="checkbox"
          onChange={onChange}
          checked={!!checked}
        />
        <label htmlFor={check_id} className={'setting-item-input-label'}>
          {title}
        </label>
        {/*<div className="setting-theme-item-title">{title}</div>*/}
        <div onClick={onChange} className={'setting-theme-item ' + type} />
      </div>
    );
  }
}

interface NotificationSettingProps {
  mutliCheck?: boolean;
  title: string;
  checked?: boolean;
  onChange?: (value: boolean) => void;
}

export class SettingChooseItem extends React.Component<NotificationSettingProps> {
  // private onCheckboxClicked = (e: any) => {
  //   const { onChange } = this.props;
  //   if (onChange && e.target.type === 'checkbox') {
  //     console.log('Choose Setting Click');
  //     onChange(e.target.checked);
  //   }
  // };

  render() {
    const { title, checked, mutliCheck, onChange } = this.props;
    const check_id = 'id-setting-notification-' + title;

    if (mutliCheck) {
      return (
        <div
          className="setting-theme-item-content sub-setting"
          // onClick={this.onCheckboxClicked}
        >
          <input
            id={check_id}
            className={'setting-select-squar-checkbox'}
            type="checkbox"
            onChange={({ target }) => {
              if (onChange) {
                onChange(target?.checked);
              }
            }}
            checked={!!checked}
          />
          {/* <div className="setting-theme-item-title sub-title">{title}</div> */}
          <label htmlFor={check_id} className={'setting-item-input-label'}>
            {title}
          </label>
        </div>
      );
    } else {
      return (
        <div
          className="setting-theme-item-content sub-setting"
          // onClick={this.onCheckboxClicked}
        >
          <input
            id={check_id}
            className={'setting-select-checkbox sub-circle'}
            type="checkbox"
            onChange={({ target }) => {
              if (onChange) {
                onChange(target?.checked);
              }
            }}
            checked={!!checked}
          />
          {/* <div className="setting-theme-item-title sub-title">{title}</div> */}
          <label htmlFor={check_id} className={'setting-item-input-label'}>
            {title}
          </label>
        </div>
      );
    }
  }
}
