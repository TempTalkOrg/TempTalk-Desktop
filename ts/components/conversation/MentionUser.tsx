import React, { useRef, useState } from 'react';
import { Popover } from 'antd';
import { Profile } from '../commonSettings/Profile';
import { CloseWhenScrollMove } from '../CloseWhenScrollMove';

interface Props {
  uid: string;
  text: string;
  type: number;
  disableShowProfile?: boolean;
}

export const MentionUser = (props: Props) => {
  const { text, uid, disableShowProfile } = props;
  const [showProfileDialog, SetShowProfileDialog] = useState(false);
  const [popoverPlacement, setPopoverPlacement] = useState<any>(undefined);
  const elementRef = useRef<any>();

  // 左右侧显示
  const showProfileCardLeftRight = () => {
    const w = elementRef.current;
    if (!w) {
      return;
    }

    const rect = w.getBoundingClientRect();
    const padding = 8;
    // const profileDialogHeight = 380 + 36;
    const profileDialogWidth = 280;

    // const maxY = window.innerHeight - profileDialogHeight - padding;
    const maxX = window.innerWidth - profileDialogWidth - padding;

    const x = rect.x + rect.width + padding;
    const y = rect.y;

    const maxCardHeight = 498;
    const halfHeight = maxCardHeight / 2;

    const getTopBottom = () => {
      if (y < halfHeight && y < window.innerHeight - maxCardHeight) {
        // top
        return 'Top';
      } else if (y > maxCardHeight) {
        // bottom
        return 'Bottom';
      } else {
        // middle
        return '';
      }
    };

    const getLeftRight = () => {
      if (x > maxX) {
        return 'left';
      } else {
        return 'right';
      }
    };

    const placement = getLeftRight() + getTopBottom();
    setPopoverPlacement(placement);
  };

  const getPlacement = () => {
    switch (popoverPlacement) {
      case 'left':
        return 'left';
      case 'leftTop':
        return 'leftTop';
      case 'leftBottom':
        return 'leftBottom';
      case 'right':
        return 'right';
      case 'rightTop':
        return 'rightTop';
      case 'rightBottom':
        return 'rightBottom';
    }
    return undefined;
  };

  const renderProfile = () => {
    return (
      <Profile
        id={uid}
        i18n={(window as any).i18n}
        onClose={() => SetShowProfileDialog(false)}
        x={0}
        y={0}
      />
    );
  };

  const isAtAll = uid === 'MENTIONS_ALL';

  let pointerStyle = {};
  if (isAtAll) {
    pointerStyle = { cursor: 'default' };
  }

  return (
    <Popover
      overlayClassName={'avatar-context-popover'}
      content={renderProfile()}
      trigger="click"
      placement={getPlacement()}
      open={!isAtAll && showProfileDialog}
      onOpenChange={visible => {
        if (visible === false) {
          SetShowProfileDialog(visible);
        }
      }}
      destroyTooltipOnHide={true}
      // getPopupContainer={() => this.avatarRef.current || document.body}
      // fix jump problem
      // https://github.com/ant-design/ant-design/issues/27102
      transitionName=""
    >
      <span
        onClick={() => {
          if (disableShowProfile) {
            return;
          }
          showProfileCardLeftRight();
          SetShowProfileDialog(true);
        }}
        ref={elementRef}
        className={'module-message-mention'}
        style={pointerStyle}
      >
        {text}
      </span>
      {!isAtAll && showProfileDialog ? (
        <CloseWhenScrollMove onClose={() => SetShowProfileDialog(false)} />
      ) : null}
    </Popover>
  );
};
