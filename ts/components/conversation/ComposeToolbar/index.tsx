import React from 'react';
import classNames from 'classnames';

import { LocalizerType } from '../../../types/Util';
import {
  MessageModeButton,
  PropsType as MessageModeButtonProps,
} from '../MessageModeButton';
import { withToolbarItemVisible } from './withToolbarItemVisible';
import {
  PropsType as ComposeButtonPropsType,
  EmojiPanelButton,
  AttachmentSelectorButton,
  AtPersonButton,
  ShareContactButton,
  LocalSearchButton,
  CallButton,
} from '../../ComposeButtons';
import {
  CaptureAudioWrapper,
  CaptureAudioWrapperProps,
} from './CaptureAudioWrapper';

export interface ICommonProps {
  i18n: LocalizerType;
}

interface ComposeToolbarProps extends ICommonProps {
  toolbar: {
    active: boolean;
    visible: boolean;
  };
  messageMode: MessageModeButtonProps;
  emojiPanel: ComposeButtonPropsType;
  attachmentSelector: ComposeButtonPropsType;
  atPerson: ComposeButtonPropsType;
  shareContact: ComposeButtonPropsType;
  localSearch: ComposeButtonPropsType;
  call: ComposeButtonPropsType;
  captureAudio: CaptureAudioWrapperProps;
}

const MessageModeButtonWrapper = withToolbarItemVisible(MessageModeButton);
const EmojiPanelWrapper = withToolbarItemVisible(EmojiPanelButton);
const AttachmentSelectorWrapper = withToolbarItemVisible(
  AttachmentSelectorButton
);
const AtPersonButtonWrapper = withToolbarItemVisible(AtPersonButton);
const ShareContactButtonWrapper = withToolbarItemVisible(ShareContactButton);
const LocalSearchButtonWrapper = withToolbarItemVisible(LocalSearchButton);
const CallButtonWrapper = withToolbarItemVisible(CallButton);

export const ComposeToolbar = (props: ComposeToolbarProps) => {
  const {
    i18n,
    messageMode,
    toolbar,
    emojiPanel,
    attachmentSelector,
    atPerson,
    shareContact,
    localSearch,
    call,
    captureAudio,
  } = props;
  return (
    <div
      className={classNames('compose-toolbar', {
        active: toolbar.active,
        hidden: !toolbar.visible,
      })}
    >
      <div className="compose-toolbar-left">
        <MessageModeButtonWrapper {...messageMode} i18n={i18n} />
        <EmojiPanelWrapper {...emojiPanel} i18n={i18n} />
        <AttachmentSelectorWrapper {...attachmentSelector} i18n={i18n} />
        <AtPersonButtonWrapper {...atPerson} i18n={i18n} />
        <ShareContactButtonWrapper {...shareContact} i18n={i18n} />
        <LocalSearchButtonWrapper {...localSearch} i18n={i18n} />
      </div>

      <div className="compose-toolbar-right">
        <CaptureAudioWrapper {...captureAudio} i18n={i18n} />
        <CallButtonWrapper {...call} i18n={i18n} />
      </div>
    </div>
  );
};
