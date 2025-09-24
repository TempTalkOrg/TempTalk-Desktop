import React from 'react';
import classNames from 'classnames';

import { Avatar } from './Avatar';

import { LocalizerType } from '../types/Util';
import {
  SearchMacthInfoType,
  ProtectedConfigs,
} from '../state/ducks/conversations';

interface Props {
  phoneNumber: string;
  id?: string;
  isMe?: boolean;
  name?: string;
  color: string;
  profileName?: string;
  avatarPath?: string;
  i18n: LocalizerType;
  onClick?: (event?: any) => void;
  style?: object;
  groupChats?: boolean;
  allBots?: boolean;
  email?: string;
  signature?: string;
  archiveButton?: boolean;
  notShowStatus?: boolean;
  isSelected?: boolean;
  protectedConfigs?: ProtectedConfigs;
  withCheckbox?: boolean;
  checkboxChecked?: boolean;
  disableCheckbox?: boolean;
  noHover?: boolean;
  firstMatch?: SearchMacthInfoType;
  showExtraInfo?: boolean;
  timeZone?: string;
  isContactNewPane?: any;
  isShowTopicFlag?: boolean;
  isCreateGroup?: any;
  smallAvatar?: boolean;
  useDefaultAvatarClick?: boolean;
}

export class ContactListItem extends React.Component<Props> {
  public renderAvatar() {
    const {
      avatarPath,
      i18n,
      color,
      name,
      profileName,
      groupChats,
      allBots,
      id,
      isMe,
      archiveButton,
      notShowStatus,
      smallAvatar,
      useDefaultAvatarClick,
    } = this.props;

    return (
      <Avatar
        id={id}
        avatarPath={avatarPath}
        color={color}
        conversationType="direct"
        i18n={i18n}
        name={name}
        profileName={profileName}
        size={smallAvatar ? 28 : 36}
        noteToSelf={isMe}
        groupChats={groupChats}
        allBots={allBots}
        noClickEvent={!useDefaultAvatarClick}
        archiveButton={archiveButton}
        notShowStatus={notShowStatus}
      />
    );
  }

  public handleClick = (event: React.MouseEvent<HTMLElement, MouseEvent>) => {
    const { useDefaultAvatarClick } = this.props;
    if (event?.target) {
      const target = event.target as HTMLElement;
      const isIgnored =
        target.className === 'add-dot-comment' ||
        (useDefaultAvatarClick && target.className.includes('module-avatar'));
      if (isIgnored) {
        return;
      }
    }
    const { onClick } = this.props;
    if (onClick) {
      onClick(event);
    }
  };

  public renderCheckbox() {
    const { withCheckbox, checkboxChecked, disableCheckbox, isCreateGroup } =
      this.props;
    if (!withCheckbox) {
      return null;
    }

    return (
      <input
        className={classNames(
          'module-contact-list-item__input',
          isCreateGroup && 'check-box-border'
        )}
        type="checkbox"
        disabled={disableCheckbox}
        checked={checkboxChecked}
        onChange={() => {}}
      />
    );
  }

  public renderHighlightBody(
    normalClasName: string,
    highlightClassName: string,
    displayText: string,
    keyWord: string,
    position: number
  ) {
    const results: Array<JSX.Element> = [];

    if (position !== -1 && position < displayText.length && keyWord.length) {
      results.push(
        <span className={normalClasName} key={normalClasName + 'pre'}>
          {displayText.substring(0, position)}
        </span>
      );
      results.push(
        <span className={highlightClassName} key={highlightClassName}>
          {displayText.substring(position, position + keyWord.length)}
        </span>
      );
      results.push(
        <span className={normalClasName} key={normalClasName + 'suf'}>
          {displayText.substring(position + keyWord.length, displayText.length)}
        </span>
      );
    } else {
      results.push(
        <span className={normalClasName} key={normalClasName}>
          {displayText}
        </span>
      );
    }
    return results;
  }

  public getDisplayExtraInfo(items: Array<any>, limit: number) {
    let result = Array<JSX.Element>();
    items.forEach(element => {
      if (element && element.length > 0 && result.length < limit) {
        result.push(
          <div
            className="module-contact-list-item__text__additional-data"
            key={
              'module-contact-list-item__text__additional-data__extraInfo' +
              result.length
            }
          >
            {element}
          </div>
        );
      }
    });
    return result;
  }

  public transferTimeZone = (timeZoneStr: string) => {
    const { i18n } = this.props;
    // 整数格式化，前面补零
    const fn = (num: number, length: number) => {
      return ('' + num).length < length
        ? (new Array(length + 1).join('0') + num).slice(-length)
        : '' + num;
    };

    let timeZone: any = parseFloat(timeZoneStr);
    if (!timeZone && timeZone !== 0) {
      return undefined;
    }

    // 可能会有半时区，1/4时区，3/4时区的情况，需要转化为float处理
    timeZone = parseFloat(timeZone.toFixed(2));

    if (timeZone >= -12 && timeZone <= 14) {
      const date = new Date(Date.now() + timeZone * 60 * 60 * 1000);

      let hours = date.getUTCHours();
      const minutes = fn(date.getUTCMinutes(), 2);

      if (hours === 12) {
        return i18n('time_format_noon', ['12:' + minutes]);
      }
      if (hours === 0) {
        return i18n('time_format_midnight', ['12:' + minutes]);
      }
      if (hours < 12) {
        return i18n('time_format_am', [hours + ':' + minutes]);
      }
      if (hours > 12) {
        return i18n('time_format_pm', [(hours % 12) + ':' + minutes]);
      }
    }

    return undefined;
  };

  public render() {
    const {
      id,
      i18n,
      name,
      onClick,
      isMe,
      profileName,
      style,
      email,
      isSelected,
      noHover,
      firstMatch,
      signature,
      showExtraInfo,
      timeZone,
      isContactNewPane,
      isShowTopicFlag,
      isCreateGroup,
    } = this.props;

    const title = name ? name : id;
    const displayName = isMe ? i18n('noteToSelf') : title;

    let titleElements = [
      title ? (
        <div
          key={'module-contact-list-item__text__name'}
          className={classNames(
            'module-contact-list-item__text__name__standard',
            isCreateGroup &&
              'module-contact-list-item__text__name__standard-create-group'
          )}
        >
          {displayName}
        </div>
      ) : null,
    ];

    const profileElement =
      !isMe && profileName && !name ? (
        <div className="module-contact-list-item__text__profile-name">
          ~{profileName}
        </div>
      ) : null;

    const emailOrNumber = email ? email : id;
    let displayContent = [];
    const showMatch = firstMatch && firstMatch.field && firstMatch.value;
    const matchValue = firstMatch && firstMatch.value ? firstMatch.value : '';
    const searchTerm =
      firstMatch && firstMatch.searchWord ? firstMatch.searchWord : '';
    const keyWordPostion = firstMatch ? firstMatch.position : -1;

    if (showMatch) {
      if (displayName === matchValue) {
        titleElements = this.renderHighlightBody(
          'module-contact-list-item__text__name',
          'module-contact-list-item__text__name__highlight',
          displayName ?? '',
          searchTerm,
          keyWordPostion
        );

        const infoArray = [email, id];
        displayContent = this.getDisplayExtraInfo(infoArray, 2);
      } else {
        const highlight = this.renderHighlightBody(
          'module-contact-list-item__text__additional-data',
          'module-contact-list-item__text__additional-data__highlight',
          matchValue,
          searchTerm,
          keyWordPostion
        );

        if (id === matchValue) {
          if (signature) {
            displayContent.push(...this.getDisplayExtraInfo([signature], 1));
            displayContent.push(...highlight);
          } else {
            displayContent.push(...highlight);
            const infoArray = [email];
            displayContent.push(...this.getDisplayExtraInfo(infoArray, 1));
          }
        } else {
          const infoArray = [
            signature !== matchValue ? signature : undefined,
            email !== matchValue ? email : undefined,
            id !== matchValue ? id : undefined,
          ];
          displayContent.push(...this.getDisplayExtraInfo(infoArray, 1));
          displayContent.push(...highlight);
        }
      }
    } else {
      displayContent = [
        <span
          className="module-contact-list-item__text__additional-data"
          key={'module-contact-list-item__text__additional-data'}
        >
          {emailOrNumber}
        </span>,
      ];
    }

    return (
      <div
        style={style}
        role="button"
        onClick={this.handleClick}
        className={classNames(
          'module-contact-list-item',
          isCreateGroup && 'module-contact-list-item-create-group',
          noHover && !isSelected ? 'module-contact-list-item-no-hover' : '',
          isSelected ? 'module-conversation-list-item--is-selected' : '',
          onClick ? 'module-contact-list-item--with-click-handler' : null
        )}
      >
        {this.renderCheckbox()}
        {this.renderAvatar()}
        <div
          className={classNames(
            'module-contact-list-item__text',
            isCreateGroup && 'module-contact-list-item-create-group__text'
          )}
          // text item length = 100% - avatar width - margin width
          style={{ width: 'calc(100% - 48px - 8px)' }}
        >
          <div className="module-contact-list-item__text__header">
            <div className={classNames('module-contact-list-item__text__name')}>
              {titleElements}
              {profileElement}
            </div>
            {showExtraInfo ? (
              <div
                className="module-contact-list-item__header__date"
                style={
                  isContactNewPane ? { flexGrow: 1, textAlign: 'right' } : {}
                }
              >
                {this.transferTimeZone(timeZone ?? '')}
              </div>
            ) : null}
            {isShowTopicFlag && (window as any).Signal.ID.isBotId(id) ? (
              <div className="module-contact-list-item__topic-flag">
                <div
                  role="button"
                  className={classNames('module-message__buttons__forward')}
                  style={{
                    marginRight: '4px',
                    cursor: 'none',
                    height: '20px',
                    pointerEvents: 'none',
                  }}
                />
                <span style={{ color: '#8b8e91', float: 'right' }}>Topic</span>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    );
  }
}
