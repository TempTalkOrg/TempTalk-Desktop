import React from 'react';
import classNames from 'classnames';

import { Avatar } from '../Avatar';
import { Spinner } from '../Spinner';
import { MessageBody } from './MessageBody';
// import { ExpireTimer } from './ExpireTimer';
import { ImageGrid } from './ImageGrid';
import { Timestamp } from './Timestamp';
import { ContactName } from './ContactName';
import { Quote, QuotedAttachmentType } from './Quote';
import { EmbeddedContact } from './EmbeddedContact';
import { v4 as uuidv4 } from 'uuid';
import { InfoCircleOutlined } from '@ant-design/icons';

import {
  canDisplayImage,
  getExtensionForDisplay,
  getGridDimensions,
  hasImage,
  hasVideoScreenshot,
  isAudio,
  isImage,
  isVideo,
} from '../../../ts/types/Attachment';
import { AttachmentType } from '../../types/Attachment';
import { Contact } from '../../types/Contact';

import { getIncrement } from '../../util/timer';
import { isFileDangerous } from '../../util/isFileDangerous';
import { ColorType, LocalizerType } from '../../types/Util';

import MessageAttachmentFileShow from './MessageAttachmentFileShow';
import { ForwardDialog } from '../ForwardDialog';
import { ForwardPreviewBody, ForwardedMessage } from './ForwardPreviewBody';
import { Language } from './TranslateMenu';
import moment from 'moment';
import { Tooltip, Popover, MenuProps } from 'antd';
import {
  ReactionContactList,
  Contact as ReactionContact,
} from './ReactionContactList';
import { AudioMessage } from '../AudioMessage';
import { ContextMenu } from '../shared/ContextMenu';
import { DateSeparator } from '../DateSeparator';
import ReactDOM from 'react-dom';
import { getConversationModel } from '../../shims/Whisper';
import { API_STATUS } from '../../types/APIStatus';

interface Trigger {
  handleContextClick: (event: React.MouseEvent<HTMLDivElement>) => void;
}

interface Reaction {
  emoji: string;
  contact: ReactionContact;
}

interface EmojiReaction {
  emoji: string;
  reactions: Array<Reaction>;
}

interface ReplyProps {
  text: string;
  attachment?: QuotedAttachmentType;
  isFromMe: boolean;
  authorPhoneNumber: string;
  authorProfileName?: string;
  authorName?: string;
  authorAccountName?: string;
  authorColor?: ColorType;
  onClick?: () => void;
  referencedMessageNotFound: boolean;
  isReply?: boolean;
  messageMode?: boolean;
}

export interface Props {
  leftGroup?: any;
  disableMenu?: boolean;
  text?: string;
  textPending?: boolean;
  id?: string;
  collapseMetadata?: boolean;
  direction: 'incoming' | 'outgoing';
  timestamp: number;
  status?: 'sending' | 'sent' | 'delivered' | 'read' | 'error';
  // What if changed this over to a single contact like quote, and put the events on it?
  contact?: Contact & {
    hasSignalAccount: boolean;
    onSendMessage?: () => void;
    onClick?: () => void;
  };
  i18n: LocalizerType;
  authorId?: string;
  authorName?: string;
  authorProfileName?: string;
  /** Note: this should be formatted for display */
  authorPhoneNumber: string;
  authorColor?: ColorType;
  conversationType: 'group' | 'direct' | 'forward';
  conversationId?: string;
  attachments?: Array<AttachmentType>;
  quote?: ReplyProps;
  reply?: ReplyProps;
  authorAvatarPath?: string;
  isExpired: boolean;
  expirationLength?: number;
  expirationTimestamp?: number;
  readMemberCount: number;
  noShowDetail?: boolean;
  onClickAttachment?: (attachment: AttachmentType) => void;
  onReply?: () => void;
  onReplyOldMessageWithoutTopic?: () => void;
  onRetrySend?: () => void;
  onDownload?: (isDangerous: boolean) => void;
  onOpenFile?: () => void;
  onDelete?: () => void;
  onShowDetail: () => void;
  onDoubleClickAvatar?: () => void;
  onFetchAttachments?: () => void;
  ourNumber: string;
  withMenu?: boolean;
  addAtPerson?: (id: string) => void;
  onForwardTo?: (conversationIds?: Array<string>, isMerged?: boolean) => void;
  isSelected?: boolean;
  isSelectingMode?: boolean;
  isSelectDisabled?: boolean;
  onChangeMultiSelectingMode?: (isSelecting?: boolean) => void;
  onSelectChange?: (checked: boolean, shiftKey: boolean) => void;
  isSingleForward?: boolean;
  forwardedMessages?: Array<ForwardedMessage>;
  showForwardedMessageList?: (title: string, cid?: string) => void;
  onRecall?: () => void;
  isRecalled?: boolean;
  recallable?: boolean;
  recallableTimerLen?: number;
  recallableExpiredAt?: number;

  translating?: boolean;
  translateError?: boolean | string;
  translatedText?: string;
  translateLang?: string;
  translateOff?: string;
  onChangeTranslation?: (targetLang?: string) => void;
  supportedLanguages?: Array<Language>;
  atPersons?: string;
  mentions?: Array<any>;
  onCopyImage?: (attachment: AttachmentType) => void;
  showThreadBar?: boolean;
  threadId?: string;
  threadReplied?: boolean;
  threadProps?: any;
  topicReplied?: boolean;
  isUseTopicCommand?: boolean;
  isAtBotTopic?: boolean;
  firstMessageTopicFlag?: boolean;
  onShowThread?: () => void;
  onThreadReply?: () => void;
  hasReactions?: boolean;
  emojiReactions?: Array<EmojiReaction>;
  onClickReaction?: (emoji: string, mineReaction?: Reaction) => void;

  isConfidentialMessage?: boolean;
  onMouseOverMessage?: () => void;
  virtualIndex?: number;
  dateSeparator?: boolean;
  authorAccountName?: string;
  showInSeparateView?: (event: React.MouseEvent<HTMLDivElement>) => void;
  getAttachmentObjectUrl: (
    attachment: AttachmentType
  ) => Promise<string | null>;
  onChangeSpeechToText?: (attachment: AttachmentType) => void;
  transcribing?: boolean;
  transcribingError?: string;
  transcribedText?: string;
}

interface State {
  expiring: boolean;
  expired: boolean;
  imageBroken: boolean;

  conversations: any;
  showForwardDialog: boolean;
  recallableExpired: boolean;

  reactionMenuPopoverVisible: boolean;
  reactionButtonPopoverVisible: boolean;

  onDownload?: () => void;

  isVisible: boolean;
  isMouseOver: boolean;

  contextMenuPosition?: [number, number];
  showContextMenu: boolean;
}

const EXPIRATION_CHECK_MINIMUM = 2 * 1000;
const EXPIRATION_CHECK_MAXIMUM = 2 * 60 * 60 * 1000;
const EXPIRED_DELAY = 600;
const RECALLABLE_EXPIRATION_CHECK_MINIMUM = 30 * 1000;
const RECALLABLE_EXPIRATION_CHECK_MAXIMUM = 5 * 60 * 1000;

export class Message extends React.PureComponent<Props, State> {
  public showMenuBound: (event: React.MouseEvent<HTMLDivElement>) => void;
  public handleImageErrorBound: () => void;

  public captureTranslateMenuTriggerBound: (trigger: any) => void;
  public showTranslateMenuBound: (
    event: React.MouseEvent<HTMLDivElement>
  ) => void;

  public translateMenuTriggerRef: Trigger | undefined;
  public contextMenuTriggerRef: React.RefObject<HTMLDivElement>;
  public fixedContextMenuTriggerRef: React.RefObject<HTMLDivElement>;
  public expirationCheckInterval: any;
  public expiredTimeout: any;
  public audioAddListener: any;
  public recallableCheckInterval: any;
  public messageBodyDivRef: any;
  public isUnmount?: boolean;
  public messageTextContainerRef: React.RefObject<HTMLDivElement>;
  public messageWrapperRef: React.RefObject<HTMLDivElement>;

  public observer: IntersectionObserver | undefined;
  public visibleChangeTimeout: NodeJS.Timeout | undefined;

  public constructor(props: Props) {
    super(props);

    this.showMenuBound = this.showMenu.bind(this);
    this.captureTranslateMenuTriggerBound =
      this.captureTranslateMenuTrigger.bind(this);
    this.showTranslateMenuBound = this.showTranslateMenu.bind(this);
    this.handleImageErrorBound = this.handleImageError.bind(this);

    this.messageBodyDivRef = React.createRef();
    this.contextMenuTriggerRef = React.createRef();
    this.fixedContextMenuTriggerRef = React.createRef();
    this.messageTextContainerRef = React.createRef();
    this.messageWrapperRef = React.createRef();

    this.state = {
      expiring: false,
      expired: false,
      imageBroken: false,

      conversations: [],
      showForwardDialog: false,

      recallableExpired: false,

      reactionMenuPopoverVisible: false,
      reactionButtonPopoverVisible: false,

      isVisible: true,

      isMouseOver: false,

      contextMenuPosition: undefined,
      showContextMenu: false,
    };
  }

  public handleMouseDown = (event: MouseEvent) => {
    if (!event) {
      return;
    }

    const { button } = event;
    if (button === 2) {
      if (
        this.fixedContextMenuTriggerRef.current &&
        !this.fixedContextMenuTriggerRef.current.contains(event.target as Node)
      ) {
        this.setState({
          showContextMenu: false,
        });
        this.unregisterHideContextMenu();
      }
    }
  };

  public handleClick = (event: MouseEvent) => {
    if (event) {
      this.setState({ showContextMenu: false });
      this.unregisterHideContextMenu();
    }
  };

  public handleWheel = (event: any) => {
    // ignore emoji reactions horizontal scroll
    if (Math.abs(event.deltaX) > 0) {
      return;
    }
    this.setState({ showContextMenu: false });
    this.unregisterHideContextMenu();
  };

  public registerHideContextMenu = () => {
    window.addEventListener('mousedown', this.handleMouseDown);
    window.addEventListener('click', this.handleClick);
    window.addEventListener('wheel', this.handleWheel, {
      capture: true,
    });
  };

  public unregisterHideContextMenu = () => {
    window.removeEventListener('mousedown', this.handleMouseDown);
    window.removeEventListener('click', this.handleClick);
    window.removeEventListener('wheel', this.handleWheel, {
      capture: true,
    });
  };

  public async componentDidMount() {
    this.setRecallableExpiredCheckInterval();
    this.setExpiredCheckInterval();

    this.observer = new IntersectionObserver(entries => {
      // should filter out reloaded element
      const validEntires = entries.filter(entry => !!entry.rootBounds);
      if (!validEntires.length) {
        return;
      }

      if (this.visibleChangeTimeout) {
        clearTimeout(this.visibleChangeTimeout);
        this.visibleChangeTimeout = undefined;
      }

      const isVisible = validEntires[0].isIntersecting;

      this.visibleChangeTimeout = setTimeout(() => {
        this.setState({ isVisible });
        this.visibleChangeTimeout = undefined;
      }, 500);
    });

    this.observer.observe(this.messageBodyDivRef.current);
  }

  public componentWillUnmount() {
    if (this.expirationCheckInterval) {
      clearInterval(this.expirationCheckInterval);
      this.expirationCheckInterval = null;
    }

    if (this.expiredTimeout) {
      clearTimeout(this.expiredTimeout);
      this.expiredTimeout = null;
    }

    if (this.recallableCheckInterval) {
      clearInterval(this.recallableCheckInterval);
      this.recallableCheckInterval = null;
    }

    this.isUnmount = true;

    this.observer?.disconnect();

    if (this.visibleChangeTimeout) {
      clearTimeout(this.visibleChangeTimeout);
      this.visibleChangeTimeout = undefined;
    }
  }

  public componentDidUpdate() {
    if (this.state.isVisible) {
      if (this.expirationCheckInterval) {
        this.checkExpired();
      } else {
        this.setExpiredCheckInterval();
      }

      if (this.recallableCheckInterval) {
        this.checkRecallableExpired();
      } else {
        this.setRecallableExpiredCheckInterval();
      }
    } else {
      if (this.expirationCheckInterval) {
        clearInterval(this.expirationCheckInterval);
        this.expirationCheckInterval = null;
      }

      if (this.recallableCheckInterval) {
        clearInterval(this.recallableCheckInterval);
        this.recallableCheckInterval = null;
      }
    }
  }

  public setExpiredCheckInterval() {
    const { expirationLength } = this.props;
    if (!expirationLength) {
      return;
    }

    this.checkExpired();

    if (this.expiredTimeout) {
      return;
    }

    const { expirationTimestamp } = this.props;

    let remained;
    if (expirationTimestamp) {
      remained = expirationTimestamp - Date.now();
    } else {
      remained = expirationLength;
    }

    if (remained < 0) {
      remained = 0;
    }

    const increment = getIncrement(remained);
    const checkFrequency = Math.min(
      Math.max(EXPIRATION_CHECK_MINIMUM, increment),
      EXPIRATION_CHECK_MAXIMUM
    );

    this.expirationCheckInterval = setInterval(() => {
      this.checkExpired();
    }, checkFrequency);
  }

  public checkExpired() {
    const now = Date.now();
    const { isExpired, expirationTimestamp, expirationLength } = this.props;

    if (!expirationTimestamp || !expirationLength) {
      return;
    }

    if (this.expiredTimeout) {
      return;
    }

    if (isExpired || now >= expirationTimestamp) {
      this.setState({
        expiring: true,
      });

      const setExpired = () => {
        if (this.isUnmount) {
          return;
        }

        this.setState({
          expired: true,
        });
      };
      this.expiredTimeout = setTimeout(setExpired, EXPIRED_DELAY);

      if (this.expirationCheckInterval) {
        clearInterval(this.expirationCheckInterval);
        this.expirationCheckInterval = null;
      }
    }
  }

  public setRecallableExpiredCheckInterval() {
    if (this.recallableCheckInterval) {
      clearInterval(this.recallableCheckInterval);
      this.recallableCheckInterval = null;
    }

    const { recallableTimerLen, recallable } = this.props;

    if (!recallableTimerLen || !recallable) {
      return;
    }

    const { recallableExpiredAt } = this.props;

    let remained;
    if (recallableExpiredAt) {
      remained = recallableExpiredAt - Date.now();
    } else {
      remained = recallableTimerLen;
    }

    if (remained < 0) {
      remained = 0;
    }

    const increment = getIncrement(remained);
    const checkFrequency = Math.min(
      Math.max(RECALLABLE_EXPIRATION_CHECK_MINIMUM, increment),
      RECALLABLE_EXPIRATION_CHECK_MAXIMUM
    );

    this.checkRecallableExpired();

    this.recallableCheckInterval = setInterval(() => {
      this.checkRecallableExpired();
    }, checkFrequency);
  }

  public checkRecallableExpired() {
    const { recallable, recallableExpiredAt, direction, status } = this.props;

    if (
      !recallable ||
      direction !== 'outgoing' ||
      status === 'sending' ||
      status === 'error'
    ) {
      return;
    }

    if (!recallableExpiredAt) {
      return;
    }

    if (this.state.recallableExpired) {
      return;
    }

    const delta = recallableExpiredAt - Date.now();
    if (delta <= 0) {
      this.setState({
        recallableExpired: true,
      });

      if (this.recallableCheckInterval) {
        clearInterval(this.recallableCheckInterval);
        this.recallableCheckInterval = null;
      }
    }
  }

  public handleImageError() {
    console.log('Message: Image failed to load; failing over to placeholder');
    this.setState({
      imageBroken: true,
    });
  }

  public renderErrorText() {
    const { i18n, isRecalled } = this.props;

    let errorMessage = 'sendFailed';

    if (isRecalled) {
      errorMessage = 'recallFailed';
    }

    return i18n(errorMessage);
  }

  public renderReplyThreadButton() {
    const {
      direction,
      showThreadBar,
      onThreadReply,
      threadProps,
      conversationType,
      i18n,
    } = this.props;

    if (conversationType === 'direct') {
      return null;
    }

    if (!showThreadBar || !threadProps) {
      return null;
    }

    if (
      // threadProps.replyToUser ||
      !threadProps.replyToUser &&
      threadProps.topicId === undefined &&
      direction === 'outgoing'
    ) {
      return null;
    }

    return (
      <div
        role="button"
        className={classNames(
          direction === 'outgoing' && threadProps.topicId
            ? 'module-message__topic-reply-button'
            : 'module-message__thread-reply-button'
        )}
        style={{
          marginLeft:
            direction === 'outgoing' &&
            (threadProps.topicId || !threadProps.topicId)
              ? '10px'
              : '',
          fontSize: '10px',
          lineHeight:
            direction === 'outgoing' &&
            (threadProps.topicId || !threadProps.topicId)
              ? 'normal'
              : '',
        }}
        onClick={onThreadReply}
      >
        {i18n('replyButton')}
      </div>
    );
  }

  public renderBottomBar() {
    const { direction, contact, forwardedMessages } = this.props;

    if (contact) {
      return null;
    }
    if (forwardedMessages && forwardedMessages.length > 1) {
      return null;
    }

    return (
      <div className={`module-message__bottom-bar--${direction}`}>
        {/*接受的消息暂时用上面这个渲染*/}
        {direction === 'incoming' ? this.renderReplyThreadButton() : null}
        {/* 发送到topic消息以及发送到topic回复，reply按钮在这里面渲染*/}
        {this.renderMetadata()}
      </div>
    );
  }

  public renderMetadata() {
    const {
      attachments,
      collapseMetadata,
      direction,
      // expirationLength,
      // expirationTimestamp,
      i18n,
      status,
      // text,
      textPending,
      timestamp,
      noShowDetail,
      onShowDetail,
      readMemberCount,
      onChangeMultiSelectingMode,
    } = this.props;
    const { imageBroken } = this.state;

    if (collapseMetadata) {
      return null;
    }

    const canDisplayAttachment = canDisplayImage(attachments);
    const withImageNoCaption = Boolean(
      false &&
        canDisplayAttachment &&
        !imageBroken &&
        ((isImage(attachments) && hasImage(attachments)) ||
          (isVideo(attachments) && hasVideoScreenshot(attachments)))
    );
    const showError = status === 'error' && direction === 'outgoing';
    return (
      <div
        className={classNames(
          'module-message__metadata',
          withImageNoCaption
            ? 'module-message__metadata--with-image-no-caption'
            : null
        )}
        onClick={event => {
          if (event.shiftKey) {
            if (onChangeMultiSelectingMode && !noShowDetail) {
              onChangeMultiSelectingMode(true);
            }
          }
        }}
      >
        {showError ? (
          <span
            className={classNames(
              'module-message__metadata__date',
              `module-message__metadata__date--${direction}`,
              withImageNoCaption
                ? 'module-message__metadata__date--with-image-no-caption'
                : null
            )}
          >
            {this.renderErrorText()}
          </span>
        ) : (
          <Timestamp
            i18n={i18n}
            timestamp={timestamp}
            direction={direction}
            withImageNoCaption={withImageNoCaption}
            module={'module-message__metadata__date'}
            relativeTime={false}
            short={true}
          />
        )}
        {/* {expirationLength && expirationTimestamp ? (
          <ExpireTimer
            direction={direction}
            expirationLength={expirationLength}
            expirationTimestamp={expirationTimestamp}
            withImageNoCaption={withImageNoCaption}
          />
        ) : null} */}
        {direction === 'outgoing' ? this.renderReplyThreadButton() : null}
        {direction === 'incoming' ? null : (
          <span className="module-message__metadata__spacer" />
        )}
        {textPending ? (
          <div className="module-message__metadata__spinner-container">
            <Spinner size="mini" direction={direction} />
          </div>
        ) : null}
        {!textPending && direction === 'outgoing' && status !== 'error' && (
          <div className="module-message__metadata__status-new-icon--wrapper">
            <div
              className={classNames(
                'module-message__metadata__status-icon',
                status === 'sending'
                  ? 'module-message__metadata__status-icon--sending'
                  : readMemberCount === Number.MAX_VALUE
                    ? 'module-message__metadata__status-new-icon--read'
                    : readMemberCount > 99
                      ? 'module-message__metadata__status-new-icon--read-exceed'
                      : 'module-message__metadata__status-new-icon--read-count',
                withImageNoCaption
                  ? 'module-message__metadata__status-icon--with-image-no-caption'
                  : null
              )}
              onClick={noShowDetail ? () => {} : onShowDetail}
              style={noShowDetail ? {} : { cursor: 'pointer' }}
            />
            {readMemberCount <= 99 &&
            readMemberCount > 0 &&
            status !== 'sending' ? (
              <div
                className={classNames(
                  'module-message__metadata__status-text--read-count'
                )}
              >
                {readMemberCount}
              </div>
            ) : null}
          </div>
        )}
      </div>
    );
  }

  public renderAuthor() {
    const {
      authorName,
      authorPhoneNumber,
      authorProfileName,
      conversationType,
      direction,
      i18n,
      virtualIndex,
      authorAccountName,
    } = this.props;

    const title =
      conversationType === 'forward'
        ? authorAccountName
        : authorName
          ? authorName
          : authorPhoneNumber;

    if (
      (conversationType !== 'forward' && direction !== 'incoming') ||
      !title
    ) {
      return null;
    }

    if (virtualIndex !== 0) {
      return null;
    }

    return (
      <>
        <div
          className="module-message__author"
          onDoubleClick={e => e.stopPropagation()}
        >
          <ContactName
            phoneNumber={authorPhoneNumber}
            name={title}
            profileName={authorProfileName}
            module="module-message__author"
            i18n={i18n}
          />
        </div>
      </>
    );
  }

  public renderRegularFileShow(extension: string | undefined) {
    return <MessageAttachmentFileShow extension={extension} />;
    // old code
    // return <div className="module-message__generic-attachment__icon">
    //   {extension ? (
    //     <div className="module-message__generic-attachment__icon__extension">
    //       {extension}
    //     </div>
    //   ) : null}
    // </div>
  }

  public renderAttachment() {
    const {
      attachments,
      // text,
      collapseMetadata,
      conversationType,
      direction,
      i18n,
      quote,
      onClickAttachment,
      onFetchAttachments,
      isConfidentialMessage,
      isSingleForward,
      threadProps,
      onOpenFile,
      getAttachmentObjectUrl,
    } = this.props;
    const { imageBroken } = this.state;

    if (!attachments || !attachments[0]) {
      return null;
    }
    const firstAttachment = attachments[0];

    const { replyToUser, quotedUser } = threadProps || {};

    // For attachments which aren't full-frame
    const withContentBelow = true;
    const withContentAbove =
      Boolean(quote) ||
      conversationType === 'forward' ||
      direction === 'incoming' ||
      Boolean(isSingleForward) ||
      (replyToUser && quotedUser);

    const displayImage = canDisplayImage(attachments);

    const shouldHide = isConfidentialMessage && !this.state.isMouseOver;

    if (
      displayImage &&
      !imageBroken &&
      ((isImage(attachments) && hasImage(attachments)) ||
        (isVideo(attachments) && hasVideoScreenshot(attachments)))
    ) {
      return (
        <div style={shouldHide ? { background: '#B7BDC6' } : {}}>
          <div
            className={classNames(
              'module-message__attachment-container',
              withContentAbove
                ? 'module-message__attachment-container--with-content-above'
                : null,
              withContentBelow
                ? 'module-message__attachment-container--with-content-below'
                : null
            )}
            style={shouldHide ? { visibility: 'hidden' } : {}}
          >
            <ImageGrid
              attachments={attachments}
              withContentAbove={withContentAbove}
              withContentBelow={withContentBelow}
              bottomOverlay={!collapseMetadata}
              i18n={i18n}
              onError={this.handleImageErrorBound}
              onClickAttachment={onClickAttachment}
              onFetchAttachments={onFetchAttachments}
            />
          </div>
        </div>
      );
    } else if (
      !firstAttachment.pending &&
      isAudio(attachments) &&
      !firstAttachment.fetchError
    ) {
      return (
        <div style={shouldHide ? { background: '#B7BDC6' } : {}}>
          {!firstAttachment.isVoiceMessage ? (
            <div className="module-message__audio-file-prefix">
              <div className="module-message__audio-file-prefix__icon" />
              <div className="module-message__audio-file-prefix__text">
                {firstAttachment.fileName}
              </div>
            </div>
          ) : null}
          <AudioMessage
            getAttachmentObjectUrl={() =>
              getAttachmentObjectUrl(firstAttachment)
            }
            src={firstAttachment.url}
            classNames={classNames([shouldHide ? 'should-hidden' : ''])}
          />
        </div>
      );
    } else {
      const {
        pending,
        fileName,
        fileSize,
        contentType,
        fetchError,
        error,
        // sha256,
        // size,
      } = firstAttachment;

      const extension = getExtensionForDisplay({ contentType, fileName });
      const isDangerous = isFileDangerous(fileName || '');
      return (
        <div style={shouldHide ? { background: '#B7BDC6' } : {}}>
          <div
            className={classNames(
              'module-message__generic-attachment',
              withContentBelow
                ? 'module-message__generic-attachment--with-content-below'
                : null,
              withContentAbove
                ? 'module-message__generic-attachment--with-content-above'
                : null
            )}
            onClick={async () => {
              if (error || pending || fetchError) {
                return;
              }

              if (onOpenFile) {
                onOpenFile();
              }
            }}
            style={shouldHide ? { visibility: 'hidden' } : {}}
          >
            {error ? (
              <div className="module-message__generic-attachment__permanent-error-container">
                <div className="module-message__generic-attachment__permanent-error">
                  X
                </div>
              </div>
            ) : pending ? (
              <div className="module-message__generic-attachment__spinner-container">
                <Spinner size="small" direction={direction} />
              </div>
            ) : fetchError ? (
              <div className="module-message__generic-attachment__fetch-error-container">
                <div
                  className="module-message__generic-attachment__fetch-error"
                  onClick={onFetchAttachments}
                ></div>
              </div>
            ) : (
              <div className="module-message__generic-attachment__icon-container">
                {this.renderRegularFileShow(extension)}
                {isDangerous ? (
                  <div className="module-message__generic-attachment__icon-dangerous-container">
                    <div className="module-message__generic-attachment__icon-dangerous" />
                  </div>
                ) : null}
              </div>
            )}
            <div className="module-message__generic-attachment__text">
              <div
                className={classNames(
                  'module-message__generic-attachment__file-name',
                  `module-message__generic-attachment__file-name--${direction}`
                )}
              >
                {fileName}
              </div>
              <div
                className={classNames(
                  'module-message__generic-attachment__file-size',
                  `module-message__generic-attachment__file-size--${direction}`
                )}
              >
                {fileSize}
              </div>
            </div>
          </div>
          {error === API_STATUS.NoPermission && (
            <div className="module-message__generic-attachment__error-desc">
              {i18n('attachementError.expired')}
            </div>
          )}
        </div>
      );
    }
  }

  public renderReplyHeader() {
    const {
      i18n,
      direction,
      threadProps,
      isUseTopicCommand,
      firstMessageTopicFlag,
      isAtBotTopic,
      conversationType,
      attachments,
      forwardedMessages,
    } = this.props;

    if (!threadProps) {
      return null;
    }
    if (conversationType === 'direct') {
      return null;
    }

    //replyToUser,
    const {
      replyToUser,
      quotedUser,
      topicId,
      replyTopicMessageHeader,
      botId,
      firstBotName,
      supportType,
    } = threadProps;
    if (!quotedUser) {
      return null;
    }

    const { isFromMe, authorPhoneNumber, authorName } = quotedUser;
    if (replyToUser) {
      // bot转发到问题群的消息样式
      if (supportType === 0) {
        return (
          <div className={classNames(`module-message__reply-to--${direction}`)}>
            {i18n('replyFromBotHeader', [firstBotName || botId])}
          </div>
        );
      }
      // 在支持群开启R时回复 消息样式
      return (
        <div className={classNames(`module-message__reply-to--${direction}`)}>
          {i18n('replyToHeader', [
            isFromMe ? i18n('you') : authorName || authorPhoneNumber,
          ])}
        </div>
      );
    } else if (!replyToUser && supportType === 1) {
      // 在支持群关闭R按钮回复 消息样式
      return null;
    } else if (!botId) {
      return (
        <div
          className={classNames(
            `module-message__reply-to--${direction}`,
            attachments && attachments?.length > 0 && direction === 'outgoing'
              ? 'module-message__reply-to--outgoing-attachment'
              : 'module-message__reply-to--outgoing-no_attachment',
            (forwardedMessages && forwardedMessages?.length > 1) ||
              direction === 'incoming'
              ? 'module-message__reply-to--outgoing-special-type'
              : 'module-message__reply-to--outgoing-no-special-type'
          )}
        >
          {isUseTopicCommand || !!firstMessageTopicFlag
            ? i18n('topicHeader')
            : topicId
              ? i18n('replyTopicHeader') + replyTopicMessageHeader
              : null}
        </div>
      );
    } else if (botId && topicId) {
      // && topicId 是为去掉老版本发到支持群的topic的标题
      return (
        <div
          className={classNames(
            `module-message__reply-to--${direction}`,
            attachments && attachments?.length > 0 && direction === 'outgoing'
              ? 'module-message__reply-to--outgoing-attachment'
              : 'module-message__reply-to--outgoing-no_attachment'
          )}
        >
          {isAtBotTopic
            ? i18n('atBotTopicHeader', [
                firstBotName ? firstBotName + ':' : botId + ':',
              ])
            : i18n('replyAtBotTopicHeader', [
                firstBotName ? firstBotName + ':' : botId + ':',
              ])}
        </div>
      );
    } else {
      return null;
    }
  }

  public renderQuote() {
    const {
      // conversationType,
      authorColor,
      direction,
      i18n,
      quote,
      threadProps,
      reply,
    } = this.props;

    if (!quote && !threadProps) {
      return null;
    }

    const withContentAbove = direction === 'incoming';

    if (quote) {
      const quoteColor =
        direction === 'incoming' ? authorColor : quote.authorColor;

      return (
        <Quote
          i18n={i18n}
          onClick={quote.onClick}
          text={quote.text}
          attachment={quote.attachment}
          isIncoming={direction === 'incoming'}
          authorPhoneNumber={quote.authorPhoneNumber}
          authorProfileName={quote.authorProfileName}
          authorName={quote.authorName}
          authorColor={quoteColor}
          referencedMessageNotFound={quote.referencedMessageNotFound}
          isFromMe={quote.isFromMe}
          withContentAbove={withContentAbove}
          messageMode={quote.messageMode}
        />
      );
    } else if (reply) {
      const replyColor =
        direction === 'incoming' ? authorColor : reply.authorColor;
      return (
        <Quote
          i18n={i18n}
          onClick={reply.onClick}
          text={reply.text}
          attachment={reply.attachment}
          isIncoming={direction === 'incoming'}
          authorPhoneNumber={reply.authorPhoneNumber}
          authorProfileName={reply.authorProfileName}
          authorName={reply.authorName}
          authorColor={replyColor}
          referencedMessageNotFound={reply.referencedMessageNotFound}
          isFromMe={reply.isFromMe}
          withContentAbove={withContentAbove}
          isReply={reply.isReply}
        />
      );
    } else {
      return null;
    }
  }

  public renderEmbeddedContact() {
    const {
      collapseMetadata,
      contact,
      // conversationType,
      direction,
      authorId,
      i18n,
      text,
    } = this.props;
    if (!contact) {
      return null;
    }
    const withCaption = Boolean(text);
    const withContentAbove = direction === 'incoming';
    const withContentBelow = withCaption || !collapseMetadata;

    return (
      <div className="card-message-content-wrapper">
        <EmbeddedContact
          //分享人id
          shareId={authorId}
          contact={contact}
          hasSignalAccount={contact.hasSignalAccount}
          isIncoming={direction === 'incoming'}
          i18n={i18n}
          onClick={contact.onClick}
          withContentAbove={withContentAbove}
          withContentBelow={withContentBelow}
        />
        <div
          className="card-message-metadata-wrapper"
          style={{ bottom: 8, right: 8 }}
        >
          {this.renderMetadata()}
        </div>
      </div>
    );
  }

  public renderSendMessageButton() {
    const { contact, i18n, conversationType } = this.props;
    if (
      !contact ||
      !contact.hasSignalAccount ||
      conversationType === 'forward'
    ) {
      return null;
    }

    return (
      <div
        role="button"
        onClick={contact.onSendMessage}
        className="module-message__send-message-button"
      >
        {i18n('sendMessageToContact')}
      </div>
    );
  }

  public renderAvatar() {
    const {
      authorId,
      authorAvatarPath,
      authorName,
      authorProfileName,
      authorAccountName,
      collapseMetadata,
      authorColor,
      // conversationType,
      direction,
      i18n,
      onDoubleClickAvatar,
      withMenu,
      addAtPerson,

      authorPhoneNumber,
      conversationId,
      leftGroup,
      virtualIndex,
    } = this.props;

    // if (
    //   collapseMetadata ||
    //   conversationType !== 'group' ||
    //   direction === 'outgoing'
    // ) {
    //   return;
    // }
    if (virtualIndex !== 0) {
      return;
    }

    if (collapseMetadata) {
      return;
    }

    const theClass =
      direction === 'outgoing'
        ? 'module-message__author-avatar-right'
        : 'module-message__author-avatar';
    return (
      <div
        className={theClass}
        onContextMenu={e => {
          this.setState({ showContextMenu: false });
          e.stopPropagation();
        }}
      >
        <Avatar
          id={authorId}
          avatarPath={authorAvatarPath}
          color={authorColor}
          conversationType="direct"
          i18n={i18n}
          name={authorName}
          profileName={authorProfileName}
          accountName={authorAccountName}
          size={36}
          onDoubleClickAvatar={onDoubleClickAvatar}
          withMenu={withMenu}
          addAtPerson={addAtPerson}
          direction={direction}
          authorPhoneNumber={authorPhoneNumber}
          conversationId={conversationId}
          leftGroup={leftGroup}
        />
      </div>
    );
  }

  public renderText() {
    const {
      text,
      textPending,
      i18n,
      direction,
      status,
      contact,
      isConfidentialMessage,
      isSingleForward,
      forwardedMessages,
      mentions,
      showInSeparateView,
    } = this.props;

    const contents =
      direction === 'incoming' && status === 'error'
        ? i18n('incomingError')
        : text;

    if (!contents) {
      return null;
    }

    // contact message has no text body.
    if (contact) {
      return null;
    }

    // 单条转发时，需要使用第一个转发消息的mentions
    let singleForwardMentions;
    if (isSingleForward && forwardedMessages && forwardedMessages.length > 0) {
      singleForwardMentions = forwardedMessages[0].mentions;
    }

    return (
      <div
        ref={this.messageTextContainerRef}
        dir="auto"
        className={classNames(
          'module-message__text',
          `module-message__text--${direction}`,
          status === 'error' && direction === 'incoming'
            ? 'module-message__text--error'
            : null
        )}
      >
        <MessageBody
          allowExpand
          text={contents || ''}
          isMouseOver={this.state.isMouseOver}
          isConfidentialMessage={isConfidentialMessage}
          showOnMouseOver={false}
          mentions={singleForwardMentions || mentions}
          i18n={i18n}
          textPending={textPending}
          onClickMask={showInSeparateView}
          containerRef={this.fixedContextMenuTriggerRef}
          onScrollIntoView={this.onScrollIntoView}
        />
      </div>
    );
  }

  public onScrollIntoView = () => {
    this.messageWrapperRef.current?.scrollIntoView({ block: 'end' });
  };

  public renderMenuReactionButton(
    emojiReaction: EmojiReaction,
    closePopover: () => void
  ) {
    const { onClickReaction } = this.props;

    const { emoji, reactions } = emojiReaction;
    const mineReaction = reactions.find(reaction => reaction.contact?.isMe);

    return (
      <button
        className={classNames(
          'module-message__reaction-menu-button',
          `module-message__reaction-menu-button--${
            mineReaction ? 'with-self' : 'with-none'
          }`
        )}
        key={emoji}
        onClick={() => {
          if (onClickReaction) {
            onClickReaction(emoji, mineReaction);
            closePopover();
          }
        }}
      >
        {emoji}
      </button>
    );
  }

  public renderEmojiReactionContactList(contacts: Array<ReactionContact>) {
    const { i18n } = this.props;
    return (
      <ReactionContactList
        contacts={contacts}
        i18n={i18n}
      ></ReactionContactList>
    );
  }

  public renderMessageReactionButton(emojiReaction: EmojiReaction) {
    const { onClickReaction, direction } = this.props;

    const { emoji, reactions } = emojiReaction;
    if (!reactions.length) {
      return null;
    }

    const length = reactions.length;
    const emojiWithNumberTitle = `${emoji} (${length})`;
    const emojiWithNumberButtonTitle =
      length === 1
        ? `${emoji} ${reactions[0].contact.name}`
        : `${emoji} ${length > 999 ? '999+' : length}`;

    const contacts = reactions.map(reaction => reaction.contact);
    const mineReaction = reactions.find(reaction => reaction.contact?.isMe);

    return (
      <Popover
        key={emoji}
        mouseEnterDelay={1}
        content={this.renderEmojiReactionContactList(contacts)}
        title={emojiWithNumberTitle}
        overlayClassName={'module-message__reaction-list-popover'}
      >
        <button
          className={classNames(
            'module-message__reaction-button',
            `module-message__reaction-button--${direction}`,
            `module-message__reaction-button--${
              mineReaction ? 'with-self' : 'with-others'
            }--${direction}`
          )}
          key={emoji}
          onClick={() => {
            if (onClickReaction) {
              onClickReaction(emoji, mineReaction);
            }
          }}
        >
          {emojiWithNumberButtonTitle}
        </button>
      </Popover>
    );
  }

  public renderMessageReactions() {
    const { hasReactions, emojiReactions, direction } = this.props;
    if (!hasReactions || !emojiReactions?.length) {
      return;
    }

    return (
      <div
        className={classNames(
          'module-message__reaction',
          `module-message__reaction--${direction}`
        )}
      >
        {emojiReactions.map(this.renderMessageReactionButton.bind(this))}
      </div>
    );
  }

  public renderTranslateText() {
    const {
      i18n,
      direction,
      status,
      translateLang,
      translatedText,
      translating,
      translateError,
      isConfidentialMessage,
      onChangeTranslation,
    } = this.props;

    if (direction === 'incoming' && status === 'error') {
      return null;
    }

    if (translating) {
      return (
        <div className="module-message__warning__status">
          <div
            className={classNames(
              'module-message__warning__status_translating--icon',
              `module-message__warning__status_translating--icon--${direction}`
            )}
          ></div>
          <span>{i18n('translating')}</span>
        </div>
      );
    }

    if (translateError) {
      let errorTemplate = 'translateFailed';
      if (typeof translateError === 'string') {
        errorTemplate = translateError;
      }

      return (
        <div className="module-message__warning__status">
          <div
            className={classNames(
              'module-message__warning__status_translate_failed--icon'
            )}
            onClick={() => {
              if (onChangeTranslation) {
                onChangeTranslation(translateLang);
              }
            }}
          ></div>
          <span>{i18n(errorTemplate)}</span>
        </div>
      );
    }

    if (translateLang && translatedText) {
      return (
        <div
          dir="auto"
          className={classNames(
            'module-message__translate__text',
            `module-message__translate__text--${direction}`
          )}
        >
          <MessageBody
            text={translatedText}
            isMouseOver={this.state.isMouseOver}
            isConfidentialMessage={isConfidentialMessage}
            i18n={i18n}
            textPending={false}
          />
        </div>
      );
    }

    return null;
  }

  public renderForwardedMessage() {
    const {
      forwardedMessages,
      i18n,
      showForwardedMessageList,
      isSingleForward,
      conversationId,
      isConfidentialMessage,
    } = this.props;
    if (!forwardedMessages || forwardedMessages.length < 1) {
      return null;
    }

    if (isSingleForward) {
      return null;
    }

    return (
      <div className="card-message-content-wrapper">
        <ForwardPreviewBody
          isMouseOver={this.state.isMouseOver}
          isConfidentialMessage={isConfidentialMessage}
          key={forwardedMessages[0].timestamp}
          i18n={i18n}
          forwardedMessages={forwardedMessages}
          onClick={showForwardedMessageList}
          conversationId={conversationId}
        />
        <div
          className="card-message-metadata-wrapper"
          style={{ bottom: 10, right: 12 }}
        >
          {this.renderMetadata()}
        </div>
      </div>
    );
  }

  public renderError(isCorrectSide: boolean) {
    const { status, direction } = this.props;

    if (!isCorrectSide || status !== 'error') {
      return null;
    }

    return (
      <div className="module-message__error-container">
        <div
          className={classNames(
            'module-message__error',
            `module-message__error--${direction}`
          )}
          onClick={this.showMenuBound}
        />
      </div>
    );
  }

  public showMenu() {
    if (this.contextMenuTriggerRef?.current) {
      this.contextMenuTriggerRef.current.click();
    }
  }

  public captureTranslateMenuTrigger(triggerRef: Trigger) {
    this.translateMenuTriggerRef = triggerRef;
  }

  public showTranslateMenu(event: React.MouseEvent<HTMLDivElement>) {
    const { translateLang, translateOff, onChangeTranslation } = this.props;

    if (
      translateLang &&
      translateLang !== translateOff &&
      onChangeTranslation
    ) {
      onChangeTranslation(translateOff);
    } else {
      if (this.translateMenuTriggerRef) {
        this.translateMenuTriggerRef.handleContextClick(event);
      }
    }
  }
  public onForwardMessage = async () => {
    this.setState({
      showForwardDialog: true,
      conversations: (window as any).getAliveConversationsProps(),
    });
  };

  public onForwardMessageToMe = () => {
    const { onForwardTo, ourNumber } = this.props;
    if (onForwardTo && ourNumber) {
      onForwardTo([ourNumber], true);
    }
  };

  public isAttachmentsReady(attachments: Array<AttachmentType>) {
    let ready: boolean = true;

    if (attachments) {
      for (let i = 0; i < attachments.length; i++) {
        const attachment = attachments[i];

        if (
          attachment &&
          (attachment.pending || attachment.fetchError || attachment.error)
        ) {
          ready = false;
          break;
        }
      }
    }

    return ready;
  }

  public renderMenu(isCorrectSide: boolean) {
    const {
      // i18n,
      // attachments,
      direction,
      disableMenu,
      // onDownload,
      // onReply,
      // status,
      // conversationType,
      // forwardedMessages,
      // onRecall,
      // recallable,
      // recallableExpiredAt,
      // text,
      // translateLang,
      // onChangeTranslation,
      // supportedLanguages,
      // contact,
      i18n,
      // emojiReactions,
      // showThreadBar,
      // threadProps,
      // onThreadReply,
      // onReplyOldMessageWithoutTopic,
      // isConfidentialMessage,
    } = this.props;

    if (!isCorrectSide || disableMenu) {
      return null;
    }

    // const fileName =
    //   attachments && attachments[0] ? attachments[0].fileName : null;
    // const isDangerous = isFileDangerous(fileName || '');
    // const multipleAttachments = attachments && attachments.length > 1;
    // const firstAttachment = attachments && attachments[0];
    // const sha256 = firstAttachment?.sha256;
    // const size = firstAttachment?.size;

    // const { recallableExpired } = this.state;

    // const showRecallMenuItem = (
    //   status !== 'error' &&
    //   status !== 'sending' &&
    //   recallable &&
    //   !recallableExpired &&
    //   direction === 'outgoing' &&
    //   recallableExpiredAt
    // );

    // const showTranslateMenuItem =
    //   text &&
    //   text.length > 0 &&
    //   onChangeTranslation &&
    //   supportedLanguages &&
    //   supportedLanguages.length > 0 &&
    //   !contact;

    // const attachmentsReady = this.isAttachmentsReady(attachments || []);

    const menuItems = this.getMessageContextmenuItems();

    const menuButton = (
      <ContextMenu
        menu={{ items: menuItems }}
        trigger={['click']}
        dropdownRender={menu => {
          return this.messageContextMenuDropdownRender(menu, menuItems, true);
        }}
      >
        <Tooltip
          mouseEnterDelay={1.5}
          overlayClassName={'antd-tooltip-cover'}
          placement="top"
          title={i18n('moreTooltip')}
        >
          <div
            ref={this.contextMenuTriggerRef}
            role="button"
            onDoubleClick={e => e.stopPropagation()}
            className={classNames(
              'module-message__buttons__menu',
              `module-message__buttons__menu--${direction}`
            )}
          />
        </Tooltip>
      </ContextMenu>
    );

    if (!menuItems || menuItems.length === 0) {
      return null;
    }

    return (
      <div
        className={classNames(
          'module-message__buttons',
          `module-message__buttons--${direction}`
        )}
      >
        {menuButton}
      </div>
    );
  }

  public messageContextMenuDropdownRender = (
    menu: any,
    menuItems: MenuProps['items'],
    simulateClickTrigger?: boolean
  ) => {
    if (!menuItems || !menuItems.length) {
      return <></>;
    }

    const { conversationType, emojiReactions } = this.props;

    const isForwardConversation = conversationType === 'forward';
    const showEmojiReaction = !isForwardConversation;

    return (
      <div>
        {React.cloneElement(menu)}
        {showEmojiReaction && (
          <div className={'emoji-div'}>
            <div className={'emoji-div-mask-right'}></div>
            {emojiReactions?.map(emojiReaction => {
              return this.renderMenuReactionButton(emojiReaction, () => {
                if (
                  simulateClickTrigger &&
                  this.contextMenuTriggerRef?.current
                ) {
                  this.contextMenuTriggerRef.current.click();
                }
              });
            })}
            {/* margin with no future */}
            <div style={{ minWidth: '10px' }}></div>
          </div>
        )}
      </div>
    );
  };

  public renderSelectMenuItem = () => {
    const { i18n, onChangeMultiSelectingMode } = this.props;

    return {
      key: 'select',
      label: (
        <span
          className="module-message-contextmenu-item module-message__context__mutli_select"
          onClick={() => {
            if (onChangeMultiSelectingMode) {
              onChangeMultiSelectingMode(true);
            }
          }}
        >
          {i18n('selectMessages')}
        </span>
      ),
    };
  };

  public renderTranslateMenuItem = (skipOff?: boolean) => {
    const { supportedLanguages, onChangeTranslation } = this.props;

    if (!supportedLanguages) {
      return undefined;
    }

    let shouldSkip = skipOff;

    const menuItems: MenuProps['items'] = [];
    for (let item of supportedLanguages) {
      if (shouldSkip) {
        shouldSkip = false;
        continue;
      }

      menuItems.push({
        key: item.lang,
        label: (
          <span
            className={`module-message__context__translate-${item.lang}}`}
            onClick={() => {
              if (onChangeTranslation) {
                onChangeTranslation(item.lang);
              }
            }}
          >
            {item.name}
          </span>
        ),
      });
    }

    return menuItems;
  };

  public getMessageContextmenuItems() {
    const {
      attachments,
      direction,
      status,
      onDelete,
      onDownload,
      onReply,
      onRetrySend,
      onShowDetail,
      i18n,
      conversationType,
      onRecall,
      isRecalled,
      recallable,
      recallableExpiredAt,
      // text,
      // onChangeTranslation,
      // supportedLanguages,
      onCopyImage,
      // contact,
      isConfidentialMessage,
      // showThreadBar,
      onChangeSpeechToText,
      transcribedText,
      conversationId,
    } = this.props;

    if (!this.state.isVisible) {
      return undefined;
    }

    const menuItems: MenuProps['items'] = [];

    const multipleAttachments = attachments && attachments.length > 1;
    const firstAttachment = attachments && attachments[0];
    const isSingleAttachment = !multipleAttachments && !!firstAttachment;

    if (isSingleAttachment && this.isAttachmentsReady(attachments)) {
      const isDangerous = isFileDangerous(firstAttachment.fileName || '');

      const isVoiceMessage = firstAttachment.isVoiceMessage;

      if (!isVoiceMessage) {
        menuItems.push({
          key: 'download',
          label: (
            <span
              className="module-message-contextmenu-item module-message__context__download"
              onClick={() => {
                if (onDownload) {
                  onDownload(isDangerous);
                }
              }}
            >
              {i18n('downloadAttachment')}
            </span>
          ),
        });
      } else {
        menuItems.push({
          key: 'speech-to-text',
          label: (
            <span
              className="module-message-contextmenu-item module-message__context__speech-to-text"
              onClick={() => onChangeSpeechToText?.(firstAttachment)}
            >
              {transcribedText
                ? i18n('cancelSpeechToText')
                : i18n('speechToText')}
            </span>
          ),
        });
      }

      // copy image
      const { imageBroken } = this.state;
      const displayImage = canDisplayImage(attachments);

      if (
        displayImage &&
        !imageBroken &&
        isImage(attachments) &&
        hasImage(attachments) &&
        onCopyImage &&
        !isConfidentialMessage
      ) {
        menuItems.push({
          key: 'copy-image',
          label: (
            <span
              className="module-message-contextmenu-item module-message__context__copy-image"
              onClick={() => {
                onCopyImage(firstAttachment);
              }}
            >
              {i18n('copyImage')}
            </span>
          ),
        });
      }
    }

    const isForwardConversation = conversationType === 'forward';
    const showReply = !isForwardConversation;

    if (showReply) {
      menuItems.push({
        key: 'reply',
        label: (
          <span
            className="module-message-contextmenu-item module-message__context__reply"
            onClick={onReply}
          >
            {i18n('replyToMessage')}
          </span>
        ),
      });
    }

    const attachmentsReady = this.isAttachmentsReady(attachments || []);
    // status for messag alreay post to server.
    const alreayPost = status !== 'error' && status !== 'sending';
    //alert(isConfidentialMessage);

    const showSave =
      !isForwardConversation &&
      alreayPost &&
      !isConfidentialMessage &&
      attachmentsReady;

    // 基于 showSave 定义 showForward: 大部分消息类型允许 forward 时一定允许 save
    const showForward = showSave && !isAudio(attachments);

    if (showForward) {
      menuItems.push({
        key: 'forward',
        label: (
          <span
            className="module-message-contextmenu-item module-message__context__forward"
            onClick={this.onForwardMessage}
          >
            {i18n('forwardMessage')}
          </span>
        ),
      });
    }

    if (showSave) {
      menuItems.push({
        key: 'save',
        label: (
          <span
            key={uuidv4()}
            className="module-message-contextmenu-item module-message__context__forward_me"
            onClick={this.onForwardMessageToMe}
          >
            {i18n('forwardMessageToMe')}
          </span>
        ),
      });
    }

    if (showForward) {
      menuItems.push(this.renderSelectMenuItem());
    }

    if (
      getConversationModel(conversationId)?.isMe() ||
      (status === 'error' && direction === 'outgoing')
    ) {
      menuItems.push({
        key: 'delete',
        label: (
          <span
            className="module-message-contextmenu-item module-message__context__delete"
            onClick={onDelete}
          >
            {i18n('deleteMessage')}
          </span>
        ),
      });
    }

    const showRecall =
      alreayPost &&
      recallable &&
      !this.state.recallableExpired &&
      direction === 'outgoing' &&
      recallableExpiredAt;

    if (showRecall) {
      menuItems.push({
        key: 'recall',
        label: (
          <span
            className="module-message-contextmenu-item module-message__context__recall"
            onClick={onRecall}
          >
            {i18n('recallTitle')}
          </span>
        ),
      });
    }

    // const showTranslate =
    //   text &&
    //   text.length > 0 &&
    //   onChangeTranslation &&
    //   supportedLanguages &&
    //   supportedLanguages.length > 0;

    // if (showTranslate) {
    //   const { translateLang, translateOff } = this.props;
    //   const showOff = Boolean(translateOff && translateLang === translateOff);

    //   menuItems.push({
    //     key: 'translate',
    //     label: (
    //       <div
    //         className="module-message-contextmenu-item module-message__context__translate"
    //         key={'context-translate'}
    //       >
    //         {i18n('translateTitle')}
    //       </div>
    //     ),
    //     children: this.renderTranslateMenuItem(showOff),
    //   });
    // }

    const showMoreInfo = !isForwardConversation;

    if (showMoreInfo) {
      menuItems.push({
        key: 'more-info',
        label: (
          <span
            className="module-message-contextmenu-item module-message__context__more-info"
            onClick={onShowDetail}
          >
            {i18n('moreInfo')}
          </span>
        ),
      });
    }

    const showRetry = status === 'error' && direction === 'outgoing';
    if (showRetry) {
      menuItems.push({
        key: 'retry-send',
        label: (
          <span
            className="module-message-contextmenu-item module-message__context__retry-send"
            onClick={onRetrySend}
          >
            {isRecalled ? i18n('retryRecall') : i18n('retrySend')}
          </span>
        ),
      });
    }

    if (menuItems.length <= 0) {
      return undefined;
    }

    return menuItems;
  }

  public renderForwardHeader() {
    const { i18n, direction, isSingleForward, forwardedMessages } = this.props;

    if (!isSingleForward) {
      return null;
    }

    if (!forwardedMessages || forwardedMessages.length !== 1) {
      return null;
    }

    const { authorAccountName, timestamp } = forwardedMessages[0];

    const formatedSentAt = moment(timestamp).format('DD/MM/YYYY HH:mm');

    return (
      <>
        <div
          className={classNames(`module-message__forward-header--${direction}`)}
        >
          <span>{i18n('forwardHeader') + ' '}</span>
          <span
            className={classNames(
              'module-message__forward-header-origin-time',
              `module-message__forward-header-origin-time--${direction}`
            )}
          >
            {formatedSentAt}
          </span>
        </div>
        <div
          className={classNames(`module-message__forward-from--${direction}`)}
        >
          {i18n('forwardFrom', [authorAccountName])}
        </div>
      </>
    );
  }

  public closeForwardDialog = () => {
    this.setState({ showForwardDialog: false });
  };

  public onCheckboxClicked = (e: any) => {
    const { onSelectChange } = this.props;

    if (onSelectChange && e.target.type === 'checkbox') {
      onSelectChange(e.target.checked, e.shiftKey);
    }
  };

  public onCheckedChange = (_e: any) => {
    // const { id, authorId } = this.props;
    // (window as any).console.log(`${authorId} ${id} checked changed to ${e?.target?.checked}`);
  };

  public renderTranslateContent() {
    const {
      i18n,
      direction,
      translatedText,
      translateLang,
      translating,
      onMouseOverMessage,
      isConfidentialMessage,
      translateError,
    } = this.props;

    if (isConfidentialMessage) {
      return null;
    }

    const displayTranslate = translatedText && translateLang;
    if (!displayTranslate && !translating && !translateError) {
      return null;
    }

    return (
      <div
        className={classNames(
          'module-message',
          `module-message--${direction}`,
          'module-message__translate',
          this.state.expiring ? 'module-message--expired' : null
        )}
      >
        <div
          onMouseLeave={() => {
            this.setState({ isMouseOver: false });
          }}
          onMouseEnter={() => {
            this.setState({ isMouseOver: true });
            if (onMouseOverMessage && isConfidentialMessage) {
              onMouseOverMessage();
            }
          }}
          className={classNames(
            'module-message__container',
            `module-message__container__translate--${direction}`
          )}
        >
          {this.renderTranslateText()}
          <div
            className={classNames(
              'module-message__metadata',
              'module-message__metadata__translated_by',
              `module-message__metadata__translated_by--${direction}`
            )}
          >
            <div
              className={classNames(
                'module-message__metadata__translated_by--icon',
                `module-message__metadata__translated_by--icon--${direction}`
              )}
            ></div>
            {i18n('translatedBy')}
          </div>
        </div>
      </div>
    );
  }

  public renderTranscribeText() {
    const {
      transcribing,
      transcribingError,
      transcribedText,
      i18n,
      direction,
    } = this.props;

    if (!transcribedText && !transcribingError && !transcribing) {
      return null;
    }

    if (transcribing) {
      return <div className="transcribing-icon"></div>;
    }

    if (transcribingError) {
      return (
        <div className="module-message__warning__status">
          <div
            className={classNames(
              'module-message__warning__status_transcribe_failed--icon'
            )}
          ></div>
          <span>{i18n(`transcribingError.${transcribingError}`)}</span>
        </div>
      );
    }

    return (
      <div className="module-message__transcribe-wrapper">
        <div className="module-message__transcribe-text">{transcribedText}</div>
        <div className={`module-message__transcribe-text-by--${direction}`}>
          <Tooltip
            rootClassName="universal-tooltip"
            title={
              <span className="module-message__transcribe-text-by__tips">
                {i18n('transcribeTextBy')}
              </span>
            }
            placement="bottomLeft"
            trigger={['click']}
            align={{
              offset: [direction === 'outgoing' ? 15 : -15, 12],
            }}
          >
            <InfoCircleOutlined
              style={{ fontSize: 10, color: 'var(--dst-color-text-third)' }}
            />
          </Tooltip>
        </div>
      </div>
    );
  }

  public renderTranscribeContent() {
    const { direction, transcribedText, transcribingError, transcribing } =
      this.props;

    if (!transcribedText && !transcribingError && !transcribing) {
      return null;
    }

    return (
      <div
        className={classNames(
          'module-message',
          `module-message--${direction} module-message__transcribe`
        )}
      >
        <div
          className={classNames(
            'module-message__container',
            `module-message__container__transcribe--${direction}`
          )}
        >
          {this.renderTranscribeText()}
        </div>
      </div>
    );
  }

  public renderThread() {
    const {
      direction,
      showThreadBar,
      threadId,
      threadReplied,
      onShowThread,
      threadProps,
      isSelectingMode,
      conversationType,
    } = this.props;

    if (
      !showThreadBar ||
      !onShowThread ||
      !threadId ||
      !threadProps ||
      !threadReplied ||
      conversationType === 'direct'
    ) {
      return null;
    }

    const backgroundColors = [
      'rgb(255,69,58)',
      'rgb(255,159,11)',
      'rgb(254,215,9)',
      'rgb(49,209,91)',
      'rgb(120,195,255)',
      'rgb(11,132,255)',
      'rgb(94,92,230)',
      'rgb(213,127,245)',
      'rgb(114,126,135)',
      'rgb(255,79,121)',
    ];

    const calcColor = (radix: number) => {
      const sub = threadId.substr(threadId.length - 2, 2);
      const index = parseInt(sub, radix) % 10;
      return backgroundColors[index];
    };

    return (
      <div
        className={classNames(
          `module-message__thread__header-bar--${direction}`,
          isSelectingMode
            ? 'module-message__thread__header-bar-selecting'
            : null
        )}
        style={{ backgroundColor: calcColor(16) }}
        onClick={() => {
          onShowThread();
        }}
      ></div>
    );
  }

  public renderMessageContent() {
    const {
      authorColor,
      direction,
      attachments,
      contact,
      onMouseOverMessage,
      isConfidentialMessage,
      forwardedMessages,
    } = this.props;

    const { imageBroken, expiring } = this.state;

    const hasValidAttachment =
      (isImage(attachments) && hasImage(attachments)) ||
      (isVideo(attachments) && hasVideoScreenshot(attachments));

    const showImage =
      canDisplayImage(attachments) && !imageBroken && hasValidAttachment;

    const isCardMessage =
      contact || (forwardedMessages && forwardedMessages.length > 1);
    const cellStyle: any = {};
    if (isCardMessage) {
      cellStyle.padding = direction === 'incoming' ? '10px 0' : '0';
      cellStyle.backgroundColor = 'transparent';
      // set container maxWidth to card width
      cellStyle.maxWidth = contact ? 286 : 280;
    }

    return (
      <div
        ref={this.messageBodyDivRef}
        className={classNames(
          'module-message',
          `module-message--${direction}`,
          expiring ? 'module-message--expired' : null
        )}
        style={{ width: showImage ? getGridDimensions()?.width : undefined }}
      >
        {this.renderMenu(direction === 'outgoing')}
        {this.renderError(direction === 'outgoing')}
        <div
          onMouseLeave={() => {
            this.setState({ isMouseOver: false });
          }}
          onMouseEnter={() => {
            this.setState({ isMouseOver: true });
            if (onMouseOverMessage && isConfidentialMessage) {
              onMouseOverMessage();
            }
          }}
          ref={this.fixedContextMenuTriggerRef}
          onContextMenu={e => {
            if (this.shouldUseNativeContextMenu(e)) {
              return;
            }
            e.preventDefault();
            this.showMessageContextMenu(e);
          }}
          className={classNames(
            'module-message__container',
            `module-message__container--${direction}`,
            hasValidAttachment
              ? 'module-message__container__media_with_text'
              : null,
            direction === 'incoming'
              ? `module-message__container--incoming-${authorColor}`
              : null
          )}
          style={cellStyle}
        >
          {/*{this.renderReplyHeader()}*/}
          {this.renderForwardHeader()}
          {this.renderQuote()}
          {this.renderAttachment()}
          {this.renderEmbeddedContact()}
          {this.renderText()}
          {this.renderForwardedMessage()}
          {this.renderMessageReactions()}
          {this.renderBottomBar()}
          {this.renderSendMessageButton()}
          {this.renderAvatar()}
        </div>
        {this.renderMenu(direction === 'incoming')}
        {this.renderError(direction === 'incoming')}
        {this.renderMessageContextMenu()}
      </div>
    );
  }

  public shouldUseNativeContextMenu(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target instanceof HTMLAnchorElement) {
      return true;
    }

    const selection = window.getSelection();
    if (selection && selection.toString().length > 0) {
      return this.messageBodyDivRef.current.contains(selection.anchorNode);
    }

    return false;
  }

  public showMessageContextMenu(e: React.MouseEvent<HTMLDivElement>) {
    ReactDOM.flushSync(() => {
      this.setState({ showContextMenu: false });
    });

    this.setState({
      contextMenuPosition: [e.clientX, e.clientY],
      showContextMenu: true,
    });

    this.registerHideContextMenu();
  }

  public renderMessageContextMenu() {
    const { contextMenuPosition, showContextMenu } = this.state;
    const menuItems = this.getMessageContextmenuItems();
    return (
      <ContextMenu
        position={contextMenuPosition}
        trigger={['click']}
        menu={{
          items: menuItems,
        }}
        dropdownRender={menu => {
          return this.messageContextMenuDropdownRender(menu, menuItems);
        }}
        open={showContextMenu}
        align={{ offset: [0, 0] }}
        overlayStyle={{ padding: 0 }}
      ></ContextMenu>
    );
  }

  public renderForwardDialog() {
    const { showForwardDialog, conversations } = this.state;
    if (!showForwardDialog) {
      return null;
    }

    const { i18n, onForwardTo } = this.props;

    return (
      <ForwardDialog
        i18n={i18n}
        onForwardTo={onForwardTo}
        conversations={conversations}
        onClose={this.closeForwardDialog}
        onCancel={this.closeForwardDialog}
      />
    );
  }

  public quickQuoteMessage = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    const { onReply } = this.props;
    if (this.messageTextContainerRef.current?.contains(e.target as Node)) {
      return;
    } else {
      onReply?.();
    }
  };

  public render() {
    const {
      isSelected,
      isSelectingMode,
      isConfidentialMessage,
      isSelectDisabled,
      // conversationType,
      status,
      isRecalled,
      dateSeparator,
      timestamp,
      i18n,
    } = this.props;

    const { expired } = this.state;

    if (
      expired ||
      (isRecalled &&
        (status === 'sent' || status === 'delivered' || status === 'read'))
    ) {
      return null;
    }

    return (
      <>
        {dateSeparator && <DateSeparator timestamp={timestamp} i18n={i18n} />}
        <div
          style={{ position: 'relative', height: '100%' }}
          onDoubleClick={this.quickQuoteMessage}
          ref={this.messageWrapperRef}
        >
          {isSelectingMode && !isConfidentialMessage ? (
            <div
              className="message-select-checkbox-wrapper"
              onClick={this.onCheckboxClicked}
            >
              <label className="message-select-checkbox-label">
                <input
                  className={classNames([
                    'message-select-checkbox',
                    'check-box-border',
                  ])}
                  type="checkbox"
                  onChange={this.onCheckedChange}
                  checked={isSelected && !isSelectDisabled ? true : false}
                  disabled={isSelectDisabled}
                />
              </label>
            </div>
          ) : null}
          <div
            className={classNames(
              isSelectingMode ? 'message-select-wrapper' : 'message-wrapper'
            )}
          >
            {/* {conversationType === 'forward' ? null : (
            <ContextMenuTrigger id={triggerId + '-hidden'} holdToDisplay={-1}>
              <div
                className={classNames('module-message__hidden__right_menu_div')}
              />
            </ContextMenuTrigger>
          ) */}
            {this.renderAuthor()}
            <div className="module-message__content-wrapper">
              {this.renderThread()}
              {this.renderMessageContent()}
              {this.renderTranslateContent()}
              {this.renderTranscribeContent()}
            </div>
          </div>

          {this.renderForwardDialog()}
        </div>
      </>
    );
  }
}
