function setStorageItem(key: string, value: any) {
  try {
    localStorage.setItem(key, value);
  } catch (error) {
    console.error('Failed to save item to localStorage:', error);
  }
}

export const localStorageMiddleware =
  (store: any) => (next: any) => (action: any) => {
    const result = next(action);

    if (action.type === 'SET_PREFERENCE') {
      const { key, value } = action.payload;
      setStorageItem(`preferences.${key}`, JSON.stringify(value));
    }

    if (action.type === 'UPDATE_SIDEBAR_STATUS') {
      setStorageItem(`layout.sidebarStatus`, store.getState().sidebar.status);
    }

    return result;
  };
