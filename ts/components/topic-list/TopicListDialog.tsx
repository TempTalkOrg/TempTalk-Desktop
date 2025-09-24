import React from 'react';
import { LocalizerType } from '../../types/Util';
import PollModal from '../PollModal';
import { TopicListItem } from './TopicListItem';

import { AutoSizer, List } from 'react-virtualized';

interface Props {
  i18n: LocalizerType;
  conversationId?: string;
  conversationIdV1?: string;
  onCancel: () => void;
  ourNumber: string;
  getListThreads: () => Promise<any>;
  model?: any;
}

interface State {
  currentTopicItems: any;
  operationLoading: boolean;
}

export class TopicListDialog extends React.Component<Props, State> {
  constructor(props: Readonly<Props>) {
    super(props);

    const currentTopicItems: any = [];
    this.state = {
      currentTopicItems,
      operationLoading: true,
    };
  }

  public renderCloseBtn() {
    return (
      <span
        className={'common-close'}
        style={{ position: 'absolute', right: '15px', top: '20px' }}
        onClick={(event: React.MouseEvent<HTMLSpanElement>) => {
          event.stopPropagation();
          this.props.onCancel();
        }}
      />
    );
  }
  public componentDidMount() {
    const { getListThreads } = this.props;
    this.setState({
      operationLoading: true,
    });
    getListThreads().then((list: any) => {
      this.setState({
        operationLoading: false,
        currentTopicItems: list,
      });
    });
  }

  public closeSelf = () => {
    this.props.onCancel();
  };

  public renderTitle() {
    const { i18n } = this.props;
    return (
      <div className={'header-container'}>
        <h3>{i18n('topic_list')}</h3>
      </div>
    );
  }

  // @ts-ignore
  public renderRow = ({ index, style }: any): JSX.Element => {
    const { i18n, model } = this.props;
    const { currentTopicItems } = this.state;

    const topicItem = currentTopicItems[index];

    //需要传的是 topicItem
    // @ts-ignore
    return (
      <TopicListItem
        key={index}
        style={style}
        firstMessageInfo={topicItem.firstMessageInfo}
        lastMessageInfo={topicItem.lastMessageInfo}
        threadMessage={topicItem.threadMessage}
        botInfo={topicItem.botInfo}
        i18n={i18n}
        model={model}
        onClick={this.props.onCancel}
      ></TopicListItem>
    );
  };

  public renderTopicItem(): JSX.Element | Array<JSX.Element | null> {
    const { currentTopicItems } = this.state;
    const list = (
      <div
        className={'module-left-pane__list'}
        key={0}
        style={{
          height: 'calc(100% - 58px)',
          width: '100%',
          overflow: 'auto',
          position: 'relative',
          overflowX: 'hidden',
        }}
      >
        <AutoSizer>
          {({ height, width }) => (
            <List
              scrollToAlignment={'start'}
              currentTopicItems={currentTopicItems}
              height={height}
              rowCount={currentTopicItems.length}
              rowHeight={56}
              rowRenderer={this.renderRow}
              width={width}
            />
          )}
        </AutoSizer>
      </div>
    );

    return [list];
  }

  public renderBlankPage() {
    const { i18n } = this.props;
    const { operationLoading } = this.state;
    if (operationLoading) {
      return null;
    }

    return (
      <div className={'topic-blank-page'}>
        <div className={'logo'}>
          <img
            style={{
              height: '120px',
              width: '120px',
              marginBottom: '16px',
            }}
            src="./images/topic-list-logo.svg"
            alt={''}
          />
        </div>
        <div>
          <h3 style={{ display: 'block' }}>{i18n('noTopic')}</h3>
          <span>{i18n('sendTopic')}</span>
        </div>
      </div>
    );
  }
  public renderOperationLoading = () => {
    const { operationLoading } = this.state;
    if (!operationLoading) {
      return null;
    }
    return (
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          display: 'block',
          alignItems: 'center',
          textAlign: 'center',
          zIndex: 200,
        }}
      >
        <div className={'topic-list-loading-screen'}>
          <img
            style={{
              height: '120px',
              width: '120px',
              marginBottom: '16px',
              position: 'relative',
              top: '250px',
            }}
            src="./images/topic-list-logo.svg"
            alt={''}
          />
          <div className={'container'} style={{ top: '400px', left: '55%' }}>
            <span className="dot"></span>
            <span className="dot"></span>
            <span className="dot"></span>
          </div>
        </div>
      </div>
    );
  };

  public render() {
    const { onCancel } = this.props;
    const { currentTopicItems } = this.state;
    return (
      <PollModal onClose={onCancel}>
        <div className="topic-list-dialog">
          {this.renderOperationLoading()}
          {this.renderCloseBtn()}
          {this.renderTitle()}
          {currentTopicItems && currentTopicItems.length > 0
            ? this.renderTopicItem()
            : this.renderBlankPage()}
        </div>
      </PollModal>
    );
  }
}
