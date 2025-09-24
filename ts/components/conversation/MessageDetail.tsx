import React from 'react';
import classNames from 'classnames';
import moment from 'moment';
import humanizeDuration from 'humanize-duration';

import { Avatar } from '../Avatar';
import { ContactName } from './ContactName';
import { Message, Props as MessageProps } from './Message';
import { LocalizerType } from '../../types/Util';
import { AutoSizer, List } from 'react-virtualized';

// from https://github.com/bvaughn/react-virtualized/blob/fb3484ed5dcc41bffae8eab029126c0fb8f7abc0/source/List/types.js#L5
type RowRendererParamsType = {
  index: number;
  isScrolling: boolean;
  isVisible: boolean;
  key: string;
  parent: Object;
  style: Object;
};

interface Contact {
  status: string;
  id: string;
  name?: string;
  profileName?: string;
  avatarPath?: string;
  color: string;
  isOutgoingKeyError: boolean;

  errors?: Array<Error>;

  onSendAnyway: () => void;
}

interface Props {
  sentAt: number;
  receivedAt: number;
  serverTimestamp: number;

  message: MessageProps;
  errors: Array<Error>;
  contacts: Array<Contact>;

  i18n: LocalizerType;

  noNeedReceipts?: boolean;
}

export class MessageDetail extends React.Component<Props> {
  public renderAvatar(contact: Contact) {
    const { i18n } = this.props;
    const { avatarPath, color, id, name, profileName } = contact;

    return (
      <Avatar
        avatarPath={avatarPath}
        color={color}
        conversationType="direct"
        i18n={i18n}
        name={name}
        id={id}
        profileName={profileName}
        size={36}
      />
    );
  }

  // public renderDeleteButton() {
  //   const { i18n, message } = this.props;
  //
  //   return (
  //     <div className="module-message-detail__delete-button-container">
  //       <button
  //         onClick={message.onDelete}
  //         className="module-message-detail__delete-button"
  //       >
  //         {i18n('deleteThisMessage')}
  //       </button>
  //     </div>
  //   );
  // }

  public renderContact(contact: Contact) {
    const { i18n } = this.props;
    const errors = contact.errors || [];

    const errorComponent = contact.isOutgoingKeyError ? (
      <div className="module-message-detail__contact__error-buttons">
        <button
          className="module-message-detail__contact__send-anyway"
          onClick={contact.onSendAnyway}
        >
          {i18n('sendAnyway')}
        </button>
      </div>
    ) : null;

    const status = errors.length ? null : contact.status;
    const statusComponent = !contact.isOutgoingKeyError ? (
      <div
        className={classNames(
          'module-message-detail__contact__status-icon',
          `module-message-detail__contact__status-new-icon--${status}`
        )}
      />
    ) : null;

    return (
      <div key={contact.id} className="module-message-detail__contact">
        {this.renderAvatar(contact)}
        <div className="module-message-detail__contact__text">
          <div className="module-message-detail__contact__name">
            <ContactName
              phoneNumber={contact.id}
              name={contact.name}
              profileName={contact.profileName}
              i18n={i18n}
            />
          </div>
          {errors.map((error, index) => (
            <div key={index} className="module-message-detail__contact__error">
              {error.message}
            </div>
          ))}
        </div>
        {errorComponent}
        {statusComponent}
      </div>
    );
  }

  public renderContacts() {
    const { contacts } = this.props;

    if (!contacts || !contacts.length) {
      return null;
    }

    return (
      <div className="module-message-detail__contact-container">
        {contacts.map(contact => this.renderContact(contact))}
      </div>
    );
  }

  public renderRow = ({
    index,
    key,
    style,
  }: RowRendererParamsType): JSX.Element => {
    const { contacts } = this.props;

    if (!contacts) {
      throw new Error('renderRow: Tried to render without contacts');
    }

    const contact = contacts[index];
    return (
      <div style={style} key={key}>
        {this.renderContact(contact)}
      </div>
    );
  };

  public renderContactList() {
    const { contacts, noNeedReceipts } = this.props;

    if (!contacts || !contacts.length || noNeedReceipts) {
      return null;
    }

    return (
      <div className="module-message-detail__contact-container">
        <AutoSizer>
          {({ height, width }) => (
            <List
              className="module-left-pane__virtual-list"
              height={height}
              rowCount={contacts.length}
              rowHeight={64}
              rowRenderer={this.renderRow}
              width={width}
              contacts={contacts}
            />
          )}
        </AutoSizer>
      </div>
    );
  }

  public renderDirectionLabel() {
    const { i18n, message, noNeedReceipts } = this.props;
    if (noNeedReceipts) {
      return null;
    }

    return (
      <tr>
        <td className="module-message-detail__label">
          {message.direction === 'incoming' ? i18n('from') : i18n('to')}
        </td>
      </tr>
    );
  }

  public render() {
    const { errors, message, receivedAt, sentAt, serverTimestamp, i18n } =
      this.props;

    const { expirationLength, expirationTimestamp } = message;
    const options: humanizeDuration.Options = {
      units: ['d', 'h', 'm', 's'],
      maxDecimalPoints: 0,
    };

    return (
      <div className="module-message-detail">
        <div className="module-message-detail__message-container">
          <Message {...message} />
        </div>
        <table className="module-message-detail__info">
          <tbody>
            {(errors || []).map((error, index) => (
              <tr key={index}>
                <td className="module-message-detail__label">
                  {i18n('error')}
                </td>
                <td>
                  {' '}
                  <span className="error-message">{error.message}</span>{' '}
                </td>
              </tr>
            ))}
            <tr>
              <td className="module-message-detail__label">{i18n('sent')}</td>
              <td>
                {moment(sentAt).format('dddd, LL LTS')}{' '}
                <span className="module-message-detail__unix-timestamp">
                  ({sentAt})
                </span>
              </td>
            </tr>
            {receivedAt ? (
              <tr>
                <td className="module-message-detail__label">
                  {i18n('received')}
                </td>
                <td>
                  {moment(receivedAt).format('dddd, LL LTS')}{' '}
                  <span className="module-message-detail__unix-timestamp">
                    ({receivedAt})
                  </span>
                </td>
              </tr>
            ) : null}
            {serverTimestamp ? (
              <tr>
                <td className="module-message-detail__label">
                  {/* {i18n('serverTimestamp')} */}
                </td>
                <td>
                  {moment(serverTimestamp).format('dddd, LL LTS')}{' '}
                  <span className="module-message-detail__unix-timestamp">
                    ({serverTimestamp})
                  </span>
                </td>
              </tr>
            ) : null}
            {expirationLength && expirationTimestamp ? (
              <>
                <tr>
                  <td className="module-message-detail__label">
                    {i18n('expiring')}
                  </td>
                  <td>
                    {moment(expirationTimestamp).format('dddd, LL LTS')}{' '}
                    <span className="module-message-detail__unix-timestamp">
                      ({expirationTimestamp})
                    </span>
                  </td>
                </tr>
                <tr style={{ verticalAlign: 'top' }}>
                  <td className="module-message-detail__label">
                    {i18n('remained')}
                  </td>
                  <td>
                    {humanizeDuration(
                      expirationTimestamp - Date.now(),
                      options
                    )}
                    <br></br>
                    {' of '}
                    {humanizeDuration(expirationLength, options)}{' '}
                    <span className="module-message-detail__unix-timestamp">
                      ({expirationLength})
                    </span>
                  </td>
                </tr>
              </>
            ) : null}
            {this.renderDirectionLabel()}
          </tbody>
        </table>
        {/* {this.renderContacts()} */}
        {this.renderContactList()}
        {/* 屏蔽删除按钮 */}
        {/*{this.renderDeleteButton()}*/}
      </div>
    );
  }
}
