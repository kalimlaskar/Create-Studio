import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ServiceWorkerRegister } from "@/components/pwa/ServiceWorkerRegister";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Cliprame · Browser Video Studio & Reels Creator",
  description: "Record camera videos with a built-in teleprompter, add word-by-word animated captions, and edit social-ready reels right in your browser.",
  icons: { icon: "/cliprame-icon.svg", apple: "/apple-touch-icon.png" },
  appleWebApp: { capable: true, title: "Cliprame", statusBarStyle: "black-translucent" },

  openGraph: {
    title: "Cliprame · Browser Video Studio & Reels Creator",
    description: "Record camera videos with a built-in teleprompter, add word-by-word animated captions, and edit social-ready reels right in your browser.",
    url: "https://www.cliprame.com",
    siteName: "Cliprame",
    images: [
      {
        url: "/cliprame-og-image.png",
        width: 1200,
        height: 630,
        alt: "Cliprame Studio Preview",
      },
    ],
    locale: "en_US",
    type: "website",
  },

  twitter: {
    card: "summary_large_image",
    title: "Cliprame · Browser Video Studio & Reels Creator",
    description: "Record camera videos with a built-in teleprompter, add word-by-word animated captions, and edit social-ready reels right in your browser.",
    images: ["/cliprame-og-image.png"],
  },
};

export const viewport: Viewport = {
  themeColor: "#0a0a0a",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased scroll-smooth`} data-scroll-behavior="smooth"
    >
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}