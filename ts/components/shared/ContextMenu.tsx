import React, { useMemo } from 'react';
import { Dropdown, DropDownProps } from 'antd';
import classNames from 'classnames';
import { useMemoizedFn } from 'ahooks';

export const ContextMenu: React.FC<
  DropDownProps & { hideWhenItemsEmpty?: boolean; position?: [number, number] }
> = ({
  children,
  hideWhenItemsEmpty = false,
  menu,
  overlayClassName = '',
  trigger = ['contextMenu'],
  position = undefined,
  ...rest
}) => {
  const formatMenuItems = useMemoizedFn((items = []) => {
    return items.map((item: any) => ({
      ...item,
      popupClassName: 'universal-context-menu-submenu',
      popupOffset: [-10, 0],
      children: item.children ? formatMenuItems(item.children) : undefined,
    }));
  });

  const formattedMenu = useMemo(() => {
    return {
      ...menu,
      items: formatMenuItems(menu?.items),
    };
  }, [menu]);

  if (hideWhenItemsEmpty) {
    const hasMenu = (menu?.items?.length ?? 0) > 0;
    if (!hasMenu) {
      return <>{children}</>;
    }
  }

  return (
    <Dropdown
      menu={formattedMenu}
      overlayClassName={classNames(
        'universal-dropdown-overlay',
        overlayClassName
      )}
      trigger={trigger}
      {...rest}
    >
      {position ? (
        <div
          className="context-menu-locator"
          style={{
            position: 'fixed',
            left: position[0],
            top: position[1],
            height: 1,
            width: 1,
            pointerEvents: 'none',
          }}
        ></div>
      ) : (
        children
      )}
    </Dropdown>
  );
};

export type { DropDownProps };
