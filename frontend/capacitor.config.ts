import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.education.agent',
  appName: 'EducationAgent',
  webDir: 'dist',
  server: {
    url: 'https://two-dogs-fail.loca.lt',
    cleartext: true,
  },
  android: {
    backgroundColor: '#ffffff',
  },
};

export default config;
