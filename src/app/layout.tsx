import type { Metadata } from "next";
import Script from "next/script";
import { PwaRegister } from "@/app/components/pwa-register";
import "./globals.css";

export const metadata: Metadata = {
  title: "Shamba | Farm management",
  description: "Manage crop cycles, field work and farm costs in one place.",
  applicationName: "Shamba",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Shamba",
  },
  formatDetection: {
    telephone: false,
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        {children}
        <PwaRegister />
        <Script id="theme-preference" strategy="beforeInteractive">
          {`try {
            const theme = localStorage.getItem("shamba-theme");
            if (theme === "dark") document.documentElement.dataset.theme = "dark";
          } catch (error) {
            console.error("Could not restore the saved appearance preference.", error);
          }`}
        </Script>
      </body>
    </html>
  );
}
