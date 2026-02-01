import { verifySession } from '@/lib/dal'
import { ThemeToggle } from '@/components/theme-toggle'
import Link from 'next/link'

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await verifySession()

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
      {/* Header */}
      <header className="border-b border-gray-200 dark:border-gray-800">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          {/* Logo */}
          <Link href="/dashboard" className="text-lg font-semibold text-gray-900 dark:text-gray-50">
            Ship
          </Link>

          {/* Right side */}
          <div className="flex items-center space-x-4">
            <ThemeToggle />
            <a
              href="/api/auth/logout"
              className="text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-50"
            >
              Logout
            </a>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main>{children}</main>
    </div>
  )
}
