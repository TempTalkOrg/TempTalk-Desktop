import React from 'react';
import { useState } from 'react';
import Tooltip from 'antd/lib/tooltip';

type Props = {
  title: string;
  content?: string | undefined | any;
  onCopied: () => void;
  isShowCopy: boolean;
  isShowArrowimg?: boolean;
  onClickArrowimg?: (event: any) => void;
  isRole: boolean;
  isShowTip: boolean;
  onClick?: (event: any) => void;
};

const ProfileItem = (props: Props) => {
  const [showCopy, setShowCopy] = useState(false);
  const mouseOver = () => {
    if (props.content && props.isShowCopy) {
      setShowCopy(true);
    }
  };

  const mouseLeave = () => {
    setShowCopy(false);
  };

  const copyText = async () => {
    if (props.content) {
      (window as any).copyText(props.content);
      // await navigator.clipboard.writeText(props.content);
      props?.onCopied();
    }
  };

  const renderArrowimg = () => {
    if (props.isShowArrowimg) {
      return <div className="setting-item-arrow-img" style={{ top: '0px' }} />;
    }
    return null;
  };
  const renderCopyButton = () => {
    if (showCopy) {
      return (
        <label
          className={'copy-btn'}
          style={{ right: '10px' }}
          onClick={copyText}
        />
      );
    }
    return null;
  };

  // 文字长度显示限制128字符
  let content = props.content;
  let isRole = props.isRole;
  let isShowTip = props.isShowTip;
  let str = '';
  let content1 = '';
  if (content && content.length > 128) {
    content = content.substring(0, 128);
  }
  if (content instanceof Array && props.isRole) {
    for (let i = 0; i < content.length; i++) {
      str += content[i] + ' | ';
    }
    if (str.length > 0) {
      content = str.substr(0, str.length - 2);
    }
  }
  if (content instanceof Array && !props.isRole) {
    content1 = content[content.length - 1];
    for (let i = 0; i < content.length; i++) {
      str += content[i] + ' > ';
    }
    if (str.length > 0) {
      content = str.substr(0, str.length - 2);
    }
  }
  return (
    <div
      className={'profile-item'}
      onMouseOver={mouseOver}
      onMouseLeave={mouseLeave}
      style={{ margin: '0 0 12px 24px', height: 'auto' }}
    >
      <div
        className={'profile-item-title'}
        style={{
          width: '60px',
          height: '20px',
          marginRight: '8px',
          display: 'inline-block',
          // fontFamily: 'SF Pro',
          // fontStyle: 'normal',
          // fontWeight: 400,
          // fontSize: '14px',
          // lineHeight: '20px',
          // color: '#1E2329',
        }}
      >
        {props.title}
      </div>

      <div
        className={'profile-item-sub'}
        style={{
          width: '176px',
          cursor: 'pointer',
          // display:'inline-block',
          // whiteSpace: 'nowrap',
          // textOverflow: 'ellipsis',
          // overflow: 'hidden',
          wordBreak: 'break-word',
        }}
        onClick={props.onClickArrowimg}
      >
        {isRole && !props.onClick ? (
          <Tooltip
            placement="top"
            align={{ offset: [0, 5] }}
            autoAdjustOverflow={true}
            title={content}
            mouseEnterDelay={1.5}
            overlayClassName={'antd-tooltip-cover'}
          >
            <span style={{ maxWidth: '100%' }}>{content}</span>
          </Tooltip>
        ) : null}

        {!isRole &&
        props.content instanceof Array &&
        isShowTip &&
        !props.onClick ? (
          <Tooltip
            placement="top"
            align={{ offset: [0, 5] }}
            autoAdjustOverflow={true}
            title={content}
            mouseEnterDelay={1.5}
            overlayClassName={'antd-tooltip-cover'}
          >
            <span style={{ maxWidth: '100%' }}>{content1}</span>
          </Tooltip>
        ) : null}

        {!isRole && !(props.content instanceof Array) && !isShowTip ? (
          <div
            style={{ cursor: props.onClick ? 'pointer' : 'default' }}
            onClick={event => {
              if (props.onClick) {
                props.onClick(event);
              }
            }}
          >
            {content}
          </div>
        ) : null}
        {renderArrowimg()}
      </div>

      {renderCopyButton()}
    </div>
  );
};

export default ProfileItem;
