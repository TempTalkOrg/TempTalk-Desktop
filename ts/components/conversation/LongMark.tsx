import React from 'react';

type Props = {
  length: number;
  current: number;
};
export class LongMark extends React.Component<Props> {
  constructor(props: Props) {
    super(props);
  }
  public render() {
    const { current, length } = this.props;
    const items = [];
    let height = '';
    if (length === 1) {
      height = '44px';
    } else if (length === 2) {
      height = '23px';
    } else if (length === 3) {
      height = '14px';
    } else {
      height = '10px';
    }
    for (let i = 0; i < length; i += 1) {
      if (i === current) {
        items.push(
          <div
            key={i}
            style={{
              height,
              width: 2,
              backgroundColor: 'rgb(0,162,228)',
              marginTop: 2,
              borderRadius: 8,
            }}
          />
        );
      } else {
        items.push(
          <div
            key={i}
            style={{
              height,
              width: 2,
              backgroundColor: '#ded4d4',
              marginTop: 2,
              borderRadius: 8,
            }}
          />
        );
      }
    }

    if (!(current === 0 || current === 1)) {
      let scollNum = length === 3 ? 2 : 3;
      const styleOld = {
        borderRadius: 8,
        width: '8px',
        marginTop: -(current - scollNum) * 12,
        transition: '.25s all',
      };

      let styleNew = {};
      if (!(current === length - 1)) {
        styleNew = {
          marginTop: -(current - 2) * 12,
        };
      }

      return <div style={Object.assign({}, styleOld, styleNew)}>{items}</div>;
    }

    return <div style={{ width: '8px' }}>{items}</div>;
  }
}
