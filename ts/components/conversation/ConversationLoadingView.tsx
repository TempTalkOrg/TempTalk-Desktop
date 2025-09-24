import React from 'react';
import { Spin } from 'antd';

interface Props {
  onCancel: () => void;
}

export class ConversationLodingView extends React.Component<Props> {
  constructor(props: Readonly<Props>) {
    super(props);
  }

  public render() {
    return (
      <div className={'conversation-loading-box'}>
        <div className={'conversation-loading'}>
          <Spin size="large" />
        </div>
      </div>
    );
  }
}
