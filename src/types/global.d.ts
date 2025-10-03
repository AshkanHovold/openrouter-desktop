export {};

declare global {
  interface Window {
    electronAPI: {
      toggleTheme: () => Promise<boolean>;
      currentTheme: () => Promise<boolean>;
      callOpenRouter: (payload: { apiKey: string; body: any }) => Promise<any>;
      setApiKey: (apiKey: string) => Promise<void>;
    }
  }
}
