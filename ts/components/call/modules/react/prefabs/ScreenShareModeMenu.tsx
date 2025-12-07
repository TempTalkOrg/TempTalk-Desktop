import * as React from 'react';
import { ContextMenu } from '../../../../shared/ContextMenu';
import { useMemoizedFn } from 'ahooks';
import { IconMediaDeviceCheck } from '../../../../shared/icons';
import { useFeatureContext } from '../context/feature-context';

export function ScreenShareModeMenu(
  props: React.HTMLAttributes<HTMLButtonElement>
) {
  const featureFlags = useFeatureContext();
  const isSupportSystemMode = featureFlags?.isSupportSystemMode;
  const screenShareMode = featureFlags?.screenShareMode;
  const onScreenShareModeChange = featureFlags?.onScreenShareModeChange;

  const renderDropdown = useMemoizedFn(() => {
    return (
      <div>
        <div className="screen-share-mode-select-title">
          Screen Sharing Selector
        </div>
        <ul className="screen-share-mode-select-list">
          <li
            className="screen-share-mode-select-list-item"
            onClick={() => onScreenShareModeChange?.('default')}
          >
            <div className="screen-share-mode-select-item-text">
              Default - Yelling mode
            </div>
            <div className="screen-share-mode-select-item-status">
              {screenShareMode === 'default' ? <IconMediaDeviceCheck /> : null}
            </div>
          </li>
          {isSupportSystemMode ? (
            <li
              className="screen-share-mode-select-list-item"
              onClick={() => onScreenShareModeChange?.('system')}
            >
              <div className="screen-share-mode-select-item-text">
                System mode
              </div>
              <div className="screen-share-mode-select-item-status">
                {screenShareMode === 'system' ? <IconMediaDeviceCheck /> : null}
              </div>
            </li>
          ) : null}
        </ul>
      </div>
    );
  });

  return (
    <ContextMenu
      overlayClassName="screen-share-mode-select"
      trigger={['click']}
      placement="top"
      dropdownRender={renderDropdown}
    >
      <button className="lk-button lk-button-menu">{props.children}</button>
    </ContextMenu>
  );
}
