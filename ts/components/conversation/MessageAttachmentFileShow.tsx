import React from 'react';
import { isFileRegular } from '../../util/isFileRegular';

type Props = {
  extension?: string;
  staged?: boolean;
};

const MessageAttachmentFileShow = (props: Props) => {
  const extension = props.extension?.toLowerCase();
  const ext = isFileRegular(extension || '');

  // 默认以扩展名展示
  if (!ext) {
    if (props.staged) {
      return (
        <div className="module-staged-generic-attachment__icon">
          {extension ? (
            <div className="module-staged-generic-attachment__icon__extension">
              {extension}
            </div>
          ) : null}
        </div>
      );
    } else {
      return (
        <div className="module-message__generic-attachment__icon">
          {extension ? (
            <div className="module-message__generic-attachment__icon__extension">
              {extension}
            </div>
          ) : null}
        </div>
      );
    }
  }

  if (props.staged) {
    return (
      <div
        className={'module-message__generic-attachment__icon_' + ext}
        style={{ margin: '30px 32px -4px 32px', height: '44px', width: '56px' }}
      />
    );
  }
  return <div className={'module-message__generic-attachment__icon_' + ext} />;
};

export default MessageAttachmentFileShow;
