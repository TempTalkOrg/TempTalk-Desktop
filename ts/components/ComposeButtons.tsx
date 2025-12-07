import React from 'react';
import { Tooltip } from 'antd';
import { LocalizerType } from '../types/Util';
import {
  IconCall,
  IconComposeAtPerson,
  IconComposeEmoji,
  IconComposeMicrophone,
  IconComposePaperclip,
  IconComposeSearch,
  IconComposeShareContact,
} from './shared/icons';

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
        <button className="compose-button" onClick={onClick}>
          <IconComposeAtPerson />
        </button>
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
        <button className="compose-button" onClick={onClick}>
          <IconComposeMicrophone />
        </button>
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
        <button className="compose-button" onClick={onClick}>
          <IconComposeSearch />
        </button>
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
        <button className="compose-button" onClick={onClick}>
          <IconComposeEmoji />
        </button>
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
        <button className="compose-button" onClick={onClick}>
          <IconComposePaperclip />
        </button>
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
      <button className="compose-button" onClick={onClick}>
        <IconComposeShareContact />
      </button>
    </Tooltip>
  );
};
