import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import "driver.js/dist/driver.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Legal AI",
  description: "A professional enterprise-style foundation.",
};

import { Suspense } from "react"
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import { AppHeader } from "@/components/app-header"
import { DocumentsProvider } from "@/context/vault-context"
import { RecentChatsProvider } from "@/context/history-context"
import { UserSettingsProvider } from "@/context/user-settings-context"
import { Auth0Provider } from "@auth0/nextjs-auth0/client"

import { Toaster } from "@/components/ui/sonner"

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <Auth0Provider>
          <SidebarProvider>
            <UserSettingsProvider>
              <DocumentsProvider>
                <RecentChatsProvider>
                  <AppSidebar />
                  <SidebarInset className="w-full h-svh flex flex-col overflow-hidden bg-background">
                    <Suspense fallback={<div className="h-14" />}>
                      <AppHeader />
                    </Suspense>
                    {children}
                  </SidebarInset>
                  <Toaster />
                </RecentChatsProvider>
              </DocumentsProvider>
            </UserSettingsProvider>
          </SidebarProvider>
        </Auth0Provider>
      </body>
    </html>
  );
}
