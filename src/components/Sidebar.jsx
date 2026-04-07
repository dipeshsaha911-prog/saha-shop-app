'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { signOut } from '@/lib/supabaseClient'

const NAV = [
  { href: '/dashboard', label: 'Home',      icon: '📊' },
  { href: '/inventory', label: 'Stock',     icon: '🗃️' },
  { href: '/restock',   label: 'Restock',   icon: '📦' },
  { href: '/sales',     label: 'Sales',     icon: '💳' },
  { href: '/reports',   label: 'Reports',   icon: '📋' },
]

export default function Sidebar() {
  const pathname = usePathname()
  const router   = useRouter()

  async function handleSignOut() {
    await signOut()
    router.push('/login')
  }

  return (
    <>
      {/* ── Desktop sidebar (hidden on mobile) ── */}
      <aside className="hidden md:flex w-52 min-h-screen bg-white border-r border-gray-100 flex-col">
        {/* Logo */}
        <div className="px-5 py-5 border-b border-gray-100 flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-lg" style={{ backgroundColor: '#7B2D42' }}>
            🍷
          </div>
          <div>
            <div className="font-bold text-gray-900 text-sm leading-tight">SAHA SHOP</div>
            <div className="text-xs text-gray-400">Management</div>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {NAV.map(({ href, label, icon }) => {
            const active = pathname === href
            return (
              <Link key={href} href={href}
                className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  active ? 'text-white font-medium' : 'text-gray-600 hover:bg-gray-50'
                }`}
                style={active ? { backgroundColor: '#7B2D42' } : {}}
              >
                <span className="text-base">{icon}</span>
                {label}
              </Link>
            )
          })}
        </nav>

        <div className="px-3 py-4 border-t border-gray-100">
          <button onClick={handleSignOut}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-gray-500 hover:bg-gray-50 transition-colors">
            <span>🚪</span> Sign Out
          </button>
        </div>
      </aside>

      {/* ── Mobile top bar ── */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 py-3 border-b border-gray-100"
        style={{ backgroundColor: '#7B2D42' }}>
        <div className="flex items-center gap-2">
          <span className="text-xl">🍷</span>
          <div>
            <div className="font-bold text-white text-sm leading-tight">SAHA SHOP</div>
            <div className="text-xs text-red-200">Management</div>
          </div>
        </div>
        <button onClick={handleSignOut}
          className="text-white text-xs px-3 py-1.5 rounded-lg border border-red-400 hover:bg-red-800 transition-colors">
          Sign Out
        </button>
      </div>

      {/* ── Mobile bottom nav ── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 flex"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        {NAV.map(({ href, label, icon }) => {
          const active = pathname === href
          return (
            <Link key={href} href={href}
              className={`flex-1 flex flex-col items-center justify-center py-2 gap-0.5 transition-colors ${
                active ? 'text-white' : 'text-gray-400'
              }`}
              style={active ? { backgroundColor: '#7B2D42' } : {}}>
              <span className="text-xl leading-none">{icon}</span>
              <span className="text-xs font-medium">{label}</span>
            </Link>
          )
        })}
      </nav>
    </>
  )
}
