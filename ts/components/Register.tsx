import { Modal, Button, Input, Form } from 'antd';
import React, { useState } from 'react';

type Props = {
  doLogin: (value: string) => void;
};

const REG_INVITE_CODE = /^[a-zA-Z0-9]{32}$/;
const REG_VERIFY_CODE = /^\d{17}$/;

export const Register = (props: Props) => {
  const { doLogin } = props;
  const [form] = Form.useForm();
  const [visible, setVisible] = useState(true);
  const [loading, setLoading] = useState(false);

  const handleOk = async () => {
    const values = await form.getFieldsValue();

    // 第一个页面不输入邮箱点击登录，验证提示错误信息
    if (values.InputValue === undefined) {
      form.validateFields();
    }

    // 32位邀请码
    if (REG_INVITE_CODE.test(values.InputValue)) {
      doLogin(values.InputValue);
      setLoading(true);
      setVisible(false);
      return;
    }

    // 17位验证码
    if (REG_VERIFY_CODE.test(values.InputValue)) {
      doLogin(values.InputValue);
      setLoading(true);
      setVisible(false);
      return;
    }
  };

  return (
    <Modal
      open={visible}
      title={'Register'}
      onOk={handleOk}
      onCancel={() => setVisible(false)}
      mask={false}
      centered={true}
      maskClosable={false}
      style={{ top: 100 }}
      footer={null}
    >
      <Form form={form} name="dynamic_rule" onFinish={handleOk}>
        <Form.Item
          name="InputValue"
          rules={[
            {
              validator: (_, value, callback) => {
                if (value == '' || value === undefined) {
                  callback('Please enter your Code');
                }

                if (
                  !REG_INVITE_CODE.test(value) &&
                  !REG_VERIFY_CODE.test(value) &&
                  value != ''
                ) {
                  callback('Please enter the correct Code');
                }
              },
            },
          ]}
        >
          <Input placeholder="Enter your Code" size={'large'} allowClear />
        </Form.Item>
        <br />
        <Form.Item>
          <Button
            type="primary"
            htmlType="button"
            onClick={handleOk}
            loading={loading}
            block={true}
            size={'large'}
          >
            Login
          </Button>
        </Form.Item>
      </Form>
    </Modal>
  );
};
