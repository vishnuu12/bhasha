import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.bhasha.mozhi',
  appName: 'Mozhi',
  webDir: '.mobile-build/out',
  backgroundColor: '#f6f8f7',
  loggingBehavior: 'debug',
  zoomEnabled: true,
  server: { hostname: 'localhost', androidScheme: 'https', cleartext: false },
  android: { allowMixedContent: false },
}
export default config
