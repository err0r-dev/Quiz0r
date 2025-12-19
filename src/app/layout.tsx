import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { DarkModeProvider } from "@/contexts/DarkModeContext";

export const metadata: Metadata = {
  title: "Quiz0r",
  description: "Real-time multiplayer quiz application",
};

// Inline script to set dark mode before React hydrates (prevents FOUC)
const darkModeScript = `
  (function() {
    try {
      var stored = localStorage.getItem('quiz0r-dark-mode');
      var isDark = stored !== null
        ? stored === 'true'
        : window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (isDark) {
        document.documentElement.classList.add('dark');
      }
    } catch (e) {}
  })();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: darkModeScript }} />
      </head>
      <body className="font-sans">
        <DarkModeProvider>
          {children}
          <Toaster />
        </DarkModeProvider>
      </body>
    </html>
  );
}
