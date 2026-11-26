import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'top.gcrdev.neonapex',
  appName: 'NEON APEX',
  webDir: 'dist',
  backgroundColor: '#040714',
  server: {
    androidScheme: 'https',
  },
  android: {
    allowMixedContent: false,
    backgroundColor: '#040714',
    webContentsDebuggingEnabled: false,
  },
  plugins: {
    StatusBar: {
      overlaysWebView: true,
      style: 'DARK',
      backgroundColor: '#040714',
    },
  },
};

export default config;
