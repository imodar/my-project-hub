import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.d0479375ab8c489586c045a5df6d51d8',
  appName: 'منظم العائلة',
  webDir: 'dist',
  server: {
    url: 'https://d0479375-ab8c-4895-86c0-45a5df6d51d8.lovableproject.com?forceHideBadge=true',
    cleartext: true,
  },
  android: {
    backgroundColor: '#FFFFFF',
    captureInput: true,
  },
  ios: {
    contentInset: 'always',
    backgroundColor: '#FFFFFF',
    scrollEnabled: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#FFFFFF',
      androidSplashResourceName: 'splash',
      splashFullScreen: true,
      splashImmersive: true,
    },
  },
};

export default config;
