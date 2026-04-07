import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.d0479375ab8c489586c045a5df6d51d8',
  appName: 'منظم العائلة',
  webDir: 'dist',
  // No server.url → Capacitor loads from local dist/ bundle (offline-first, native feel)
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
      launchShowDuration: 1500,
      backgroundColor: '#FFFFFF',
      androidSplashResourceName: 'splash',
      splashFullScreen: true,
      splashImmersive: false,   // false = Android nav bar stays visible after splash
    },
  },
};

export default config;
