export const localStorageMiddleware = () => (next: any) => (action: any) => {
  const result = next(action);

  if (action.type === 'SET_PREFERENCE') {
    const { key, value } = action.payload;
    try {
      localStorage.setItem(`preferences.${key}`, JSON.stringify(value));
    } catch (error) {
      console.error('Failed to save preference to localStorage:', error);
    }
  }

  return result;
};
