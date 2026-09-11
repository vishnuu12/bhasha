import type { Metadata, Viewport } from 'next'
import { Geist, Noto_Sans_Tamil } from 'next/font/google'
import './globals.css'
import { PwaRegistration } from '@/components/pwa-registration'

const geist = Geist({ subsets: ['latin'], variable: '--font-geist' })
const tamil = Noto_Sans_Tamil({ subsets: ['tamil'], variable: '--font-tamil', weight: ['400', '500', '600'] })

export const metadata: Metadata = {
  title: 'Mozhi — A conversation in your language',
  applicationName: 'Mozhi',
  manifest: '/manifest.json',
  appleWebApp: { capable: true, title: 'Mozhi', statusBarStyle: 'default' },
  icons: { icon: '/icons/mozhi-32.png', apple: '/icons/mozhi-180.png' },
  description: 'Speak naturally in Tamil, English or Tanglish. Mozhi listens, responds, and speaks back in your language. Try voice or text chat with no sign-up.',
}
export const viewport: Viewport = { colorScheme: 'light', themeColor: '#f6f8f7', width: 'device-width', initialScale: 1, viewportFit: 'cover' }

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" className={`bg-background ${geist.variable} ${tamil.variable}`}><body className="font-sans antialiased"><PwaRegistration />{children}</body></html>
}
