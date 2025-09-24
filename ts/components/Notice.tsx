import React from 'react';

export interface Props {}

interface State {
  type: string;
  message: string;
  expireTime: number;
  showNotice: boolean;
  timeoutHandle: any;
}

export class Notice extends React.Component<Props, State> {
  constructor(props: Readonly<Props>) {
    super(props);
    this.state = {
      type: 'info',
      message: '',
      expireTime: 2,
      showNotice: false,
      timeoutHandle: 0,
    };
  }
  public componentDidMount = () => {
    window.addEventListener('main-menu-show-notice', this.updateNoticeState);
  };

  public componentWillUnmount = () => {
    window.removeEventListener('main-menu-show-notice', this.updateNoticeState);
  };

  private updateNoticeState = (ev: any) => {
    if (!ev || !ev.detail) {
      return;
    }

    let expireTime = ev.detail.expireTime || 2;
    //最大延时毫秒数  2^31 = 2147483648  超过即立即执行,  超过设置默认时长为3s
    if (expireTime && expireTime * 1000 > 2147483648) {
      expireTime = 3;
    }

    this.setState(() => ({
      type: ev.detail.type || 'info',
      message: ev.detail.message || '',
      expireTime,
      showNotice: true,
    }));

    if (this.state.timeoutHandle) {
      clearTimeout(this.state.timeoutHandle);
    }
    const timeoutHandle = setTimeout(() => {
      this.setState({
        timeoutHandle: 0,
        showNotice: false,
      });
    }, this.state.expireTime * 1000);
    this.setState({ timeoutHandle });
  };

  public render() {
    const { message, type, showNotice } = this.state;
    const display = showNotice ? 'block' : 'none';
    return (
      <div className={'notice-' + type} style={{ display: display }}>
        {type !== 'noneType' ? (
          <span className={'notice-icon-' + type} />
        ) : null}
        <span>{message}</span>
      </div>
    );
  }
}
