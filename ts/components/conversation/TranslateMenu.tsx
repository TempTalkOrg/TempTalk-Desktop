import React from 'react';

import { LocalizerType } from '../../types/Util';

export interface Language {
  lang: string;
  name: string;
}

interface Props {
  i18n: LocalizerType;
  targetLang?: string;
  onChangeTranslation: (targetLang?: string) => void;
  supportedLanguages: Array<Language>;
  buttonClassNames?: Array<string>;
}

export class TranslateMenu extends React.Component<Props> {
  public renderMenuItems() {
    const menuItems: any[] = [];

    return menuItems;
  }

  public renderMenu() {
    return <></>;
  }

  public render() {
    return <>{this.renderMenu()}</>;
  }
}
