import React from 'react';
// import classNames from 'classnames';

import { ContactName } from './ContactName';
import { Intl } from '../Intl';
import { LocalizerType } from '../../types/Util';
import { getIncrement } from '../../util/timer';

const EXPIRATION_CHECK_MINIMUM = 10 * 1000;

interface Contact {
  phoneNumber: string;
  profileName?: string;
  name?: string;
  isMe?: boolean;
}

interface Props {
  contact: Contact;
  i18n: LocalizerType;
  onEdit: () => void;
  recallFinished: boolean;
  editable: boolean;
  editableTimerLen: number;
  editableExpiredAt: number;
}

interface State {
  editableExpired: boolean;
}

export class RecallMessageNotification extends React.Component<Props, State> {
  public editableCheckInterval: any;

  public constructor(props: Props) {
    super(props);

    this.state = {
      editableExpired: false,
    };
  }

  public componentDidMount() {
    this.setEditableExpiredCheckInterval();
  }

  public componentWillUnmount() {
    if (this.editableCheckInterval) {
      clearInterval(this.editableCheckInterval);
    }
  }

  public componentDidUpdate() {
    this.checkEditable();
  }

  public setEditableExpiredCheckInterval() {
    const { editableTimerLen, editable } = this.props;

    if (!editableTimerLen || !editable) {
      return;
    }

    const increment = getIncrement(editableTimerLen);
    const checkFrequency = Math.max(EXPIRATION_CHECK_MINIMUM, increment);

    this.checkEditable();

    this.editableCheckInterval = setInterval(() => {
      this.checkEditable();
    }, checkFrequency);
  }

  public checkEditable() {
    const { editable, editableExpiredAt } = this.props;

    if (!editable || !editableExpiredAt) {
      return;
    }

    if (this.state.editableExpired) {
      return;
    }

    const now = Date.now();
    const delta = editableExpiredAt - now;
    if (delta <= 0) {
      this.setState({
        editableExpired: true,
      });

      if (this.editableCheckInterval) {
        clearInterval(this.editableCheckInterval);
        this.editableCheckInterval = null;
      }
    }
  }

  public render() {
    const {
      contact,
      i18n,
      //onEdit,
      recallFinished,
      // editable,
      //editableExpiredAt,
    } = this.props;

    if (!recallFinished) {
      return null;
    }

    return (
      <div className="module-recall-message-notification">
        <div className="module-recall-message-notification__text">
          {contact.isMe ? (
            i18n('youRecalledAMessage')
          ) : (
            <Intl
              id={'recalledAMessage'}
              components={[
                <span
                  key="external-1"
                  className="module-recall-message-notification__contact"
                >
                  <span>"</span>
                  <ContactName
                    i18n={i18n}
                    name={contact.name}
                    profileName={contact.profileName}
                    phoneNumber={contact.phoneNumber}
                    module="module-verification-notification__contact"
                  />
                  <span>"</span>
                </span>,
              ]}
              i18n={i18n}
            />
          )}
        </div>
        {/* {contact.isMe &&
        editable &&
        !this.state.editableExpired &&
        editableExpiredAt ? (
          <div
            role="button"
            onClick={onEdit}
            className="module-recall-message-notification__button"
          >
            {i18n('re-editButtonTitle')}
          </div>
        ) : null} */}
      </div>
    );
  }
}
