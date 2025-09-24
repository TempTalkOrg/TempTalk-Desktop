import { useMemoizedFn } from 'ahooks';
import { Modal, Row, Col, Spin, ConfigProvider, Input } from 'antd';
import React, { useEffect, useMemo, useState } from 'react';
import { LottieAnimation } from '../LottieAnimation';
import { SearchOutlined } from '@ant-design/icons';

interface ShareScreenModalProps {
  open: boolean;
  closeModal: () => void;
  sources: any[];
  handleSelectSource: (id: string) => void;
}

type SourceType = {
  id: string;
  name: string;
  thumbnailDataURI: string | (() => Promise<string>);
};

function Thumbnail({ source }: { source: SourceType }) {
  const [src, setSrc] = useState<string>();

  const loadThumbnail = useMemoizedFn(async () => {
    try {
      const src =
        typeof source.thumbnailDataURI === 'function'
          ? await source.thumbnailDataURI()
          : source.thumbnailDataURI;
      setSrc(src);
    } catch (e) {
      // console.log(e);
    }
  });

  useEffect(() => {
    if (!source) {
      return;
    }
    loadThumbnail();
  }, []);

  return src ? (
    <img className="desktop-capture-item-img" alt={source.name} src={src} />
  ) : null;
}

export const ShareScreenModal = ({
  open,
  closeModal,
  sources,
  handleSelectSource,
}: ShareScreenModalProps) => {
  const [search, setSearch] = useState('');

  const filteredSources = useMemo(() => {
    return sources.filter(source =>
      source.name.toLowerCase().includes(search.toLowerCase())
    );
  }, [sources, search]);

  useEffect(() => {
    if (!open) {
      setSearch('');
    }
  }, [open]);

  return (
    <ConfigProvider
      theme={{
        token: {
          motionDurationMid: '0.1s',
          motionDurationSlow: '0.1s',
        },
      }}
    >
      <Modal
        title="Select a screen to share"
        open={open}
        onCancel={closeModal}
        footer={null}
        width={640}
        wrapClassName="screen-share-modal"
        centered
      >
        <Input
          placeholder="Search"
          value={search}
          onChange={e => setSearch(e.target.value || '')}
          prefix={
            <SearchOutlined style={{ color: 'var(--dst-color-text-third)' }} />
          }
          className="screen-share-search"
        />
        <Spin
          spinning={sources.length === 0}
          wrapperClassName="screen-share-selector-spin"
          indicator={
            <LottieAnimation
              src="../lotties/conversation-loading-dark.lottie"
              style={{ height: 120 }}
            />
          }
        >
          <Row className="desktop-capture-list" gutter={[16, 16]}>
            {filteredSources.map(source => (
              <Col span={8} key={source.id}>
                <div
                  onClick={() => handleSelectSource(source.id)}
                  className="desktop-capture-item"
                >
                  <Thumbnail source={source} />
                  <div className="desktop-capture-item-name">{source.name}</div>
                </div>
              </Col>
            ))}
          </Row>
        </Spin>
      </Modal>
    </ConfigProvider>
  );
};
