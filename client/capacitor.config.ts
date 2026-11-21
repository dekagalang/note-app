import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.itsnotes.app',
  appName: 'itsnotes',
  webDir: 'dist',
  plugins: {
    LocalNotifications: {
      smallIcon: 'ic_stat_itsnotes',
    },
  },
};

export default config;
