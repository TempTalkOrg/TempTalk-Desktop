import React, { useState } from 'react';
import classNames from 'classnames';
import { ForwardDialog } from '../ForwardDialog';
import { LocalizerType } from '../../types/Util';
import { useMemoizedFn } from 'ahooks';
import {
  IconClose,
  IconCombineAndForward,
  IconForward,
  IconSaveToNote,
} from '../shared/icons';
import { Divider } from 'antd';

interface Props {
  i18n: LocalizerType;
  open: boolean;
  onForwardTo: (conversationIds?: Array<string>, isMerged?: boolean) => void;
  onCancel: () => void;
  ourNumber: string;
  isDisabled?: boolean;
  selectedCount: number;
  maxSelectionCount?: number;
}

export const SelectActionBar: React.FC<Props> = ({
  i18n,
  open,
  onForwardTo,
  onCancel,
  ourNumber,
  isDisabled,
  selectedCount,
  maxSelectionCount = 50,
}) => {
  const [isShowForwardDialog, setIsShowForwardDialog] = useState(false);
  const [isMerge, setIsMerge] = useState<boolean>(false);
  const [conversations, setConversations] = useState<Array<any>>([]);

  const onShowForwardDialog = useMemoizedFn((merge: boolean) => {
    setIsMerge(merge);
    setIsShowForwardDialog(true);
    setConversations((window as any).getAliveConversationsProps());
  });

  const closeForwardDialog = useMemoizedFn(() => {
    setIsShowForwardDialog(false);
    onCancel();
  });

  const cancelForwardDialog = useMemoizedFn(() => {
    setIsShowForwardDialog(false);
  });

  const onForwardMessageToMe = useMemoizedFn(() => {
    if (onForwardTo && ourNumber) {
      onForwardTo([ourNumber], true);
    }
    onCancel();
  });

  const handleOneByOneForward = useMemoizedFn(() => {
    if (!isDisabled) {
      onShowForwardDialog(false);
    }
  });

  const handleCombineAndForward = useMemoizedFn(() => {
    if (!isDisabled && selectedCount > 1) {
      onShowForwardDialog(true);
    }
  });

  const handleSaveToNoteForward = useMemoizedFn(() => {
    if (!isDisabled) {
      onForwardMessageToMe();
    }
  });

  if (!open) {
    return null;
  }

  return (
    <div className={classNames('select-action-bar')}>
      <div className={classNames('select-action-bar-actions')}>
        <div className="selected-count">
          <div className="count-number">
            {selectedCount}/{maxSelectionCount}
          </div>
          <div className="count-suffix">{i18n('message')}</div>
        </div>
        <Divider type="vertical" className="action-divider" />
        <div
          className={classNames(
            'action-button',
            isDisabled ? 'action-button-disabled' : null
          )}
          onClick={handleOneByOneForward}
        >
          <IconForward className="action-button-icon" />
          <div className={classNames('action-button-text')}>
            {i18n('oneByOneForward')}
          </div>
        </div>
        <div
          className={classNames(
            'action-button',
            isDisabled || selectedCount <= 1 ? 'action-button-disabled' : null
          )}
          onClick={handleCombineAndForward}
        >
          <IconCombineAndForward className="action-button-icon" />
          <div className={classNames('action-button-text')}>
            {i18n('combineAndForward')}
          </div>
        </div>
        <div
          className={classNames(
            'action-button',
            isDisabled ? 'action-button-disabled' : null
          )}
          onClick={handleSaveToNoteForward}
        >
          <IconSaveToNote className="action-button-icon" />
          <div className={classNames('action-button-text')}>
            {i18n('saveToNoteForward')}
          </div>
        </div>
        <div className={classNames('action-button')} onClick={onCancel}>
          <div className="cancel-button-wrapper">
            <IconClose />
          </div>
        </div>
      </div>
      {isShowForwardDialog && (
        <ForwardDialog
          i18n={i18n}
          isMerge={isMerge}
          onForwardTo={onForwardTo}
          conversations={conversations}
          onClose={closeForwardDialog}
          onCancel={cancelForwardDialog}
        />
      )}
    </div>
  );
};
