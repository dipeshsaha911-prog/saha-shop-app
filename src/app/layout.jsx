import './globals.css'

export const metadata = {
  title: 'SAHA SHOP APP',
  description: 'Wine shop management — inventory, sales, restock & reports',
  manifest: '/manifest.json',
  themeColor: '#7B2D42',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'SAHA SHOP',
  },
  viewport: {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
  },
  icons: {
    icon: '/icon.svg',
    apple: '/icon-192.png',
  },
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <meta name="application-name" content="SAHA SHOP APP" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="theme-color" content="#7B2D42" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="icon" href="/icon.svg" />
      </head>
      <body>
        {children}
        <script dangerouslySetInnerHTML={{
          __html: `
            if ('serviceWorker' in navigator) {
              window.addEventListener('load', function() {
                navigator.serviceWorker.register('/sw.js')
                  .then(function(reg) { console.log('SW registered'); })
                  .catch(function(err) { console.log('SW failed:', err); });
              });
            }
          `
        }} />
      </body>
    </html>
  )
}
