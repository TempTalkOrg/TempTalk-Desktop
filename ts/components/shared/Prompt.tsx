import { useMemoizedFn } from 'ahooks';
import { Input, Modal } from 'antd';
import React, { useState } from 'react';

type Props = {
  title: string;
  content: string;
  onCancel: () => void;
  onOk: (value?: string) => void;
};

export const Prompt = (props: Props) => {
  const { title, content, onCancel, onOk } = props;

  const [value, setValue] = useState('');

  const onChange = useMemoizedFn((e: React.ChangeEvent<HTMLInputElement>) => {
    setValue(e.target.value);
  });

  const handleOk = useMemoizedFn(() => {
    onOk(value);
  });

  return (
    <Modal
      open
      title={title}
      onCancel={onCancel}
      onOk={handleOk}
      destroyOnClose
    >
      {content}
      <div>
        <Input value={value} onChange={onChange} />
      </div>
    </Modal>
  );
};
