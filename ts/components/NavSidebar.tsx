import classNames from 'classnames';
import { clamp } from 'lodash';
import React, { useEffect, useMemo, useState } from 'react';
import { useMove } from 'react-aria';

interface INavSidebarProps {
  setLeftPaneWidth: (width: number) => void;
  leftPaneWidth?: number;
}

enum DragState {
  INITIAL,
  DRAGGING,
  DRAGEND,
}

// common-setting min width
const MIN_WIDTH = 300;
const MAX_WIDTH = 400;

function getWidth(width?: number) {
  return clamp(width ?? 300, MIN_WIDTH, MAX_WIDTH);
}

export const NavSidebar: React.FC<INavSidebarProps> = props => {
  const [dragState, setDragState] = useState(DragState.INITIAL);

  const [preferredWidth, setPreferredWidth] = useState(
    getWidth(props.leftPaneWidth)
  );

  // sync width between panes
  useEffect(() => {
    setPreferredWidth(getWidth(props.leftPaneWidth));
  }, [props.leftPaneWidth]);

  const { moveProps } = useMove({
    onMoveStart() {
      setDragState(DragState.DRAGGING);
    },
    onMoveEnd() {
      setDragState(DragState.DRAGEND);
    },
    onMove(event) {
      const { shiftKey, pointerType } = event;
      const deltaX = event.deltaX;
      const isKeyboard = pointerType === 'keyboard';
      const increment = isKeyboard && shiftKey ? 10 : 1;
      setPreferredWidth(prevWidth => {
        return prevWidth + deltaX * increment;
      });
    },
  });

  const width = useMemo(() => {
    return getWidth(preferredWidth);
  }, [preferredWidth]);

  useEffect(() => {
    if (dragState === DragState.DRAGEND) {
      setDragState(DragState.INITIAL);
      props.setLeftPaneWidth(width);
    }
  }, [
    dragState,
    // props.leftPaneWidth,
    // preferredWidth,
    props.setLeftPaneWidth,
    width,
  ]);

  return (
    <div className="nav-sidebar" style={{ width }}>
      {props.children}
      <div
        className={classNames('nav-sidebar-drag-handle', {
          'nav-sidebar-drag-handle--dragging': dragState === DragState.DRAGGING,
        })}
        tabIndex={0}
        {...moveProps}
      ></div>
    </div>
  );
};
