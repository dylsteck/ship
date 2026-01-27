'use client'

import { AppLayout } from '@/components/layout/app-layout'

interface AppLayoutWrapperProps {
  children: React.ReactNode
}

export function AppLayoutWrapper({ children }: AppLayoutWrapperProps) {
  return (
    <AppLayout
      initialSidebarWidth={288}
      initialSidebarOpen={true}
      initialIsMobile={false}
    >
      {children}
    </AppLayout>
  )
}
