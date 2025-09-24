import React from 'react';
interface Props {
  translateChangeTitle: string;
}

export class TranslateChangeNotification extends React.Component<Props> {
  public render() {
    const { translateChangeTitle } = this.props;

    return (
      <div className="module-translate-change-notification">
        {translateChangeTitle}
      </div>
    );
  }
}
