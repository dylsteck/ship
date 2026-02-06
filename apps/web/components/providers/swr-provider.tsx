'use client'

import { SWRConfig } from 'swr'
import { ReactNode } from 'react'
import { fetcher } from '@/lib/api/client'

interface SWRProviderProps {
  children: ReactNode
}

export function SWRProvider({ children }: SWRProviderProps) {
  return (
    <SWRConfig
      value={{
        fetcher,
        revalidateOnFocus: true,
        revalidateOnReconnect: true,
        dedupingInterval: 2000,
        errorRetryCount: 3,
        errorRetryInterval: 5000,
        onError: (error, key) => {
          // Global error handling
          if (process.env.NODE_ENV === 'development') {
            console.error(`SWR Error [${key}]:`, error)
          }
        },
      }}
    >
      {children}
    </SWRConfig>
  )
}
