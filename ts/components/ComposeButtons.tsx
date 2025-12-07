import React from 'react';
import { Tooltip } from 'antd';
import { LocalizerType } from '../types/Util';
import { IconCall } from './shared/icons';

export type PropsType = {
  i18n: LocalizerType;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
};

export const AtPersonButton = (props: PropsType) => {
  const { i18n, onClick } = props;
  return (
    <>
      <Tooltip
        mouseEnterDelay={1.5}
        overlayClassName={'antd-tooltip-cover'}
        placement="top"
        title={i18n('chooseMembersTooltip')}
      >
        <button className="atpersons" onClick={onClick}></button>
      </Tooltip>
    </>
  );
};

export const CallButton = (props: PropsType) => {
  const { i18n, onClick } = props;
  return (
    <>
      <Tooltip
        mouseEnterDelay={1.5}
        overlayClassName={'antd-tooltip-cover'}
        placement="topLeft"
        title={i18n('callTooltip')}
      >
        <button className="call-btn" onClick={onClick}>
          <IconCall color="var(--dst-color-text-third)" />
        </button>
      </Tooltip>
    </>
  );
};

export const CaptureAudioButton = (props: PropsType) => {
  const { i18n, onClick } = props;
  return (
    <>
      <Tooltip
        mouseEnterDelay={1.5}
        overlayClassName={'antd-tooltip-cover'}
        placement="top"
        title={i18n('recordVoiceTooltip')}
      >
        <button className="microphone" onClick={onClick}></button>
      </Tooltip>
    </>
  );
};

export const CreateTopicListButton = (props: PropsType) => {
  const { i18n } = props;
  return (
    <>
      <Tooltip
        mouseEnterDelay={1.5}
        overlayClassName={'antd-tooltip-cover'}
        placement="top"
        title={i18n('topicListtip')}
      >
        <button className="topic-list"></button>
      </Tooltip>
    </>
  );
};

export const InVisibleReplyButton = (props: PropsType) => {
  const { i18n } = props;
  return (
    <>
      <Tooltip
        mouseEnterDelay={1.5}
        overlayClassName={'antd-tooltip-cover'}
        placement="top"
        title={i18n('invisibleReplyTooltip')}
      >
        <button className="switch-mode"></button>
      </Tooltip>
    </>
  );
};

export const LocalSearchButton = (props: PropsType) => {
  const { i18n, onClick } = props;
  return (
    <>
      <Tooltip
        mouseEnterDelay={1.5}
        overlayClassName={'antd-tooltip-cover'}
        placement="top"
        title={i18n('chatHistoryTooltip')}
      >
        <button className="new-search-message" onClick={onClick}></button>
      </Tooltip>
    </>
  );
};

export const EmojiPanelButton = (props: PropsType) => {
  const { i18n, onClick } = props;
  return (
    <>
      <Tooltip
        mouseEnterDelay={1.5}
        overlayClassName={'antd-tooltip-cover'}
        placement="top"
        title={i18n('stickersTooltip')}
      >
        <button className="emoji" onClick={onClick}></button>
      </Tooltip>
    </>
  );
};

export const AttachmentSelectorButton = (props: PropsType) => {
  const { i18n, onClick } = props;
  return (
    <>
      <Tooltip
        mouseEnterDelay={1.5}
        overlayClassName={'antd-tooltip-cover'}
        placement="top"
        title={i18n('attachmentTooltip')}
      >
        <button className="paperclip thumbnail" onClick={onClick}></button>
      </Tooltip>
    </>
  );
};

export const VisibleReplyButton = (props: PropsType) => {
  const { i18n } = props;
  return (
    <>
      <Tooltip
        mouseEnterDelay={1.5}
        overlayClassName={'antd-tooltip-cover'}
        placement="top"
        title={i18n('visibleReplyTooltip')}
      >
        <button className="switch-mode mode-on"></button>
      </Tooltip>
    </>
  );
};

export const QuickGroupButton = (props: PropsType) => {
  const { i18n } = props;
  return (
    <Tooltip
      mouseEnterDelay={1.5}
      overlayClassName={'antd-tooltip-cover'}
      placement="top"
      title={i18n('quickGroupTooltip')}
    >
      <button className="quick-group"></button>
    </Tooltip>
  );
};

export const ShareContactButton = (props: PropsType) => {
  const { i18n, onClick } = props;

  return (
    <Tooltip
      mouseEnterDelay={1.5}
      overlayClassName={'antd-tooltip-cover'}
      placement="top"
      title={i18n('shareContactTooltip')}
    >
      <button className="share-contact" onClick={onClick}></button>
    </Tooltip>
  );
};
