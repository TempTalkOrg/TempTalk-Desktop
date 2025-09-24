import React from 'react';
import classNames from 'classnames';

import { Spinner } from '../Spinner';
import { LocalizerType } from '../../types/Util';
import { AttachmentType } from '../../types/Attachment';

interface Props {
  alt: string;
  attachment: AttachmentType;
  url: string;

  height?: number;
  width?: number;

  overlayText?: string;

  bottomOverlay?: boolean;
  closeButton?: boolean;
  curveBottomLeft?: boolean;
  curveBottomRight?: boolean;
  curveTopLeft?: boolean;
  curveTopRight?: boolean;

  smallCurveTopLeft?: boolean;

  darkOverlay?: boolean;
  playIconOverlay?: boolean;
  softCorners?: boolean;

  i18n: LocalizerType;
  onClick?: (attachment: AttachmentType) => void;
  onClickClose?: (attachment: AttachmentType) => void;
  onError?: () => void;
  onFetchAttachments?: () => void;
}

export class Image extends React.Component<Props> {
  public render() {
    const {
      alt,
      attachment,
      bottomOverlay,
      closeButton,
      curveBottomLeft,
      curveBottomRight,
      curveTopLeft,
      curveTopRight,
      darkOverlay,
      height,
      i18n,
      onClick,
      onClickClose,
      onError,
      overlayText,
      playIconOverlay,
      smallCurveTopLeft,
      softCorners,
      url,
      width,
      onFetchAttachments,
    } = this.props;

    const { caption, pending, fetchError } = attachment || {
      caption: null,
      pending: true,
      fetchError: false,
    };
    const canClick = onClick && !pending && !fetchError;
    const role = canClick ? 'button' : undefined;

    return (
      <div
        role={role}
        onClick={() => {
          if (canClick && onClick) {
            onClick(attachment);
          } else if (fetchError && onFetchAttachments && !pending) {
            onFetchAttachments();
          }
        }}
        className={classNames(
          'module-image',
          canClick ? 'module-image__with-click-handler' : null,
          curveBottomLeft ? 'module-image--curved-bottom-left' : null,
          curveBottomRight ? 'module-image--curved-bottom-right' : null,
          curveTopLeft ? 'module-image--curved-top-left' : null,
          curveTopRight ? 'module-image--curved-top-right' : null,
          smallCurveTopLeft ? 'module-image--small-curved-top-left' : null,
          softCorners ? 'module-image--soft-corners' : null
        )}
      >
        {pending ? (
          <div
            className="module-image__loading-placeholder"
            style={{
              height: `${height}px`,
              width: `${width}px`,
              lineHeight: `${height}px`,
              textAlign: 'center',
            }}
            // alt={i18n('loading')}
          >
            <Spinner size="small" />
          </div>
        ) : fetchError ? (
          <div
            className="module-image__fetch-error-placeholder"
            style={{
              height: `${height}px`,
              width: `${width}px`,
              lineHeight: `${height}px`,
              textAlign: 'center',
            }}
          >
            <div className="module-image__fetch-error-icon"></div>
          </div>
        ) : (
          <img
            onError={onError}
            className="module-image__image"
            alt={alt}
            height={height}
            width={width}
            src={url}
          />
        )}
        {caption ? (
          <img
            className="module-image__caption-icon"
            src="images/caption-shadow.svg"
            alt={i18n('imageCaptionIconAlt')}
          />
        ) : null}
        <div
          className={classNames(
            'module-image__border-overlay',
            curveTopLeft ? 'module-image--curved-top-left' : null,
            curveTopRight ? 'module-image--curved-top-right' : null,
            curveBottomLeft ? 'module-image--curved-bottom-left' : null,
            curveBottomRight ? 'module-image--curved-bottom-right' : null,
            smallCurveTopLeft ? 'module-image--small-curved-top-left' : null,
            softCorners ? 'module-image--soft-corners' : null,
            darkOverlay ? 'module-image__border-overlay--dark' : null
          )}
        />
        {closeButton ? (
          <div
            role="button"
            onClick={(e: React.MouseEvent<{}>) => {
              e.stopPropagation();
              if (onClickClose) {
                onClickClose(attachment);
              }
            }}
            className="module-image__close-button"
          />
        ) : null}
        {bottomOverlay ? (
          <div
            className={classNames(
              'module-image__bottom-overlay',
              curveBottomLeft ? 'module-image--curved-bottom-left' : null,
              curveBottomRight ? 'module-image--curved-bottom-right' : null
            )}
          />
        ) : null}
        {!pending && playIconOverlay ? (
          <div className="module-image__play-overlay__circle">
            <div className="module-image__play-overlay__icon" />
          </div>
        ) : null}
        {overlayText ? (
          <div
            className="module-image__text-container"
            style={{ lineHeight: `${height}px` }}
          >
            {overlayText}
          </div>
        ) : null}
      </div>
    );
  }
}
