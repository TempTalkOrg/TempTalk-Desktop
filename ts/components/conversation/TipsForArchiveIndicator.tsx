import React from 'react';
import { LocalizerType } from '../../types/Util';
import { Popover } from 'antd';

interface Props {
  i18n: LocalizerType;
}

export class TipsForArchiveIndicator extends React.Component<Props> {
  public messageBodyDivRef: any;

  public constructor(props: Props) {
    super(props);

    this.messageBodyDivRef = React.createRef();
  }

  public renderTipsContent() {
    const { i18n } = this.props;

    return (
      <div className="module-archive-indicator__tips-content">
        <span>{i18n('groupArchiveIndicatorTips1')}</span>
        <br></br>
        <span>{i18n('groupArchiveIndicatorTips2')}</span>
      </div>
    );
  }

  public render() {
    return (
      <div ref={this.messageBodyDivRef}>
        <Popover
          trigger="click"
          destroyTooltipOnHide={true}
          getPopupContainer={() => this.messageBodyDivRef.current}
          content={this.renderTipsContent()}
          overlayClassName={'module-archive-indicator__popover'}
        >
          <div className="module-archive-indicator__tips"></div>
        </Popover>
      </div>
    );
  }
}
