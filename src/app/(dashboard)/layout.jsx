import AuthGuard from '@/components/AuthGuard'
import Sidebar from '@/components/Sidebar'

export default function DashboardLayout({ children }) {
  return (
    <AuthGuard>
      <div className="flex min-h-screen bg-gray-50">
        <Sidebar />
        {/* pt-16 on mobile for top bar, pb-20 for bottom nav, md: uses sidebar instead */}
        <main className="flex-1 p-4 md:p-6 pt-20 pb-24 md:pt-6 md:pb-6 overflow-auto w-full">
          {children}
        </main>
      </div>
    </AuthGuard>
  )
}
