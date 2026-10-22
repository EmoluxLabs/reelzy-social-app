import '../styles/globals.css';
import Providers from './providers';

export const metadata = {
  title: 'Obsidian Circle — Connect. Create. Go Live.',
  description: 'Obsidian Circle (OC): short-form video, live streaming, creator economy, and OBS Coin wallet — in one social platform.',
  metadataBase: new URL('https://obsidian.circle'),
  icons: { icon: '/favicon.svg', apple: '/oc-icon.png' },
  openGraph: {
    title: 'Obsidian Circle',
    description: 'Connect. Create. Go Live.',
    images: ['/oc-wordmark.png'],
  },
};

const themeScript = `
(function(){
  try {
    var saved = localStorage.getItem('oc-theme');
    var theme = saved || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    document.documentElement.classList.toggle('dark', theme === 'dark');
    document.documentElement.style.colorScheme = theme;
  } catch(e) {}
})();`;

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-screen bg-obs-bg bg-dark-radial font-sans">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
