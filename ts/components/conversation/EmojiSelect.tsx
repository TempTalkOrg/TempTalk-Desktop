import React from 'react';
import data from '@emoji-mart/data';
import Picker from '@emoji-mart/react';
const i18n_zh = require('@emoji-mart/data/i18n/zh.json');
const i18n_en = require('@emoji-mart/data/i18n/en.json');
import { LocalizerType } from '../../types/Util';

type Props = {
  onPickEmoji: () => void;
  onClose: () => void;
  i18n: LocalizerType;
};

type State = {};
export class EmojiSelect extends React.Component<Props, State> {
  public wrapperRef: React.RefObject<HTMLDivElement>;
  constructor(props: Props) {
    super(props);
    this.wrapperRef = React.createRef();
    this.state = {};
    this.handleClickOutside = this.handleClickOutside.bind(this);
  }

  componentDidMount() {
    document.addEventListener('mousedown', this.handleClickOutside);
    document.addEventListener('keydown', this.handleKeyBoardEvent);
  }

  componentWillUnmount() {
    document.removeEventListener('mousedown', this.handleClickOutside);
    document.removeEventListener('keydown', this.handleKeyBoardEvent);
  }

  handleClickOutside(event: MouseEvent) {
    // prettier-ignore
    // @ts-ignore
    if (event && event.target && event.target.className && event.target.className.includes && (event.target.className.includes('emoji'))) {
      return;
    }
    if (
      event &&
      this.wrapperRef?.current &&
      !this.wrapperRef.current.contains(event.target as Node)
    ) {
      this.props?.onClose();
    }
  }
  public handleKeyBoardEvent = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      this.props?.onClose();
      return;
    }
  };
  public render() {
    let theme = (window as any).Events.getThemeSetting();
    if (theme === 'system') {
      theme = (window as any).systemTheme;
    }
    return (
      <div ref={this.wrapperRef}>
        <Picker
          data={data}
          onEmojiSelect={this.props.onPickEmoji}
          previewPosition={'none'}
          theme={theme}
          i18n={this.props.i18n('lang') === 'zh-CN' ? i18n_zh : i18n_en}
        />
      </div>
    );
  }
}
