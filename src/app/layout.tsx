import type { Metadata } from "next";
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
    <html lang="en">
      <body>
        {children}
        <PwaRegister />
      </body>
    </html>
  );
}
