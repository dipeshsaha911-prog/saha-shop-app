'use client'
// src/components/Dashboard.jsx

import { useState, useEffect } from 'react'
import { fetchSales, fetchLowStockAlerts } from '@/lib/supabaseClient'

const fmt = (n) => `₹${Number(n).toLocaleString('en-IN')}`
const todayIST = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })

export default function Dashboard() {
  const [lowStock, setLowStock]     = useState([])
  const [todaySales, setTodaySales] = useState([])
  const [allSales, setAllSales]     = useState([])
  const [loading, setLoading]       = useState(true)

  useEffect(() => {
    Promise.all([
      fetchLowStockAlerts(),
      fetchSales({ date: todayIST(), limit: 20 }),
      fetchSales({ limit: 5 }),
    ]).then(([low, today, recent]) => {
      setLowStock(low); setTodaySales(today); setAllSales(recent)
    }).finally(() => setLoading(false))
  }, [])

  const todayRevenue = todaySales.reduce((s, t) => s + Number(t.total_amount), 0)
  const todayProfit  = todaySales.reduce((s, t) => s + Number(t.profit), 0)
  const cashInHand   = allSales.reduce((s, t) => s + Number(t.total_amount), 0)

  if (loading) return <div className="flex items-center justify-center h-48 text-gray-400">Loading…</div>

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-xl font-semibold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        {[
          { label: "Today's Sales",    value: fmt(todayRevenue), sub: `${todaySales.length} transactions` },
          { label: "Today's Profit",   value: fmt(todayProfit),  sub: 'Estimated margin' },
          { label: 'Cash in Hand',     value: fmt(cashInHand),   sub: 'All-time revenue' },
          { label: 'Low Stock Alerts', value: lowStock.length,   sub: 'Items below threshold',
            accent: lowStock.length > 0 ? 'text-red-600' : 'text-green-600' },
        ].map(m => (
          <div key={m.label} className="bg-gray-50 rounded-lg p-4">
            <div className="text-xs text-gray-400 uppercase tracking-wide mb-1">{m.label}</div>
            <div className={`text-2xl font-semibold ${m.accent || 'text-gray-900'}`}>{m.value}</div>
            <div className="text-xs text-gray-400 mt-1">{m.sub}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Low stock alerts */}
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-sm font-medium text-gray-700">Low Stock Alerts</h2>
            <span className="px-2 py-0.5 bg-red-50 text-red-600 rounded-full text-xs">{lowStock.length} items</span>
          </div>
          {lowStock.length === 0
            ? <p className="text-sm text-gray-400">All items are well stocked.</p>
            : lowStock.map(i => (
              <div key={i.id} className="flex justify-between items-center py-2 border-b border-gray-50 last:border-0">
                <div>
                  <div className="text-sm font-medium text-gray-800">{i.brand}</div>
                  <div className="text-xs text-gray-400">{i.category} · {i.size}</div>
                </div>
                <span className="px-2 py-0.5 bg-red-50 text-red-700 rounded-full text-xs font-medium">
                  {i.stock} left
                </span>
              </div>
            ))
          }
        </div>

        {/* Recent sales */}
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <h2 className="text-sm font-medium text-gray-700">Today's Recent Sales</h2>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-50">
                {['Item','Qty','Total','Profit','By'].map(h => (
                  <th key={h} className="text-left px-4 py-2 text-xs text-gray-400 uppercase font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {todaySales.slice(0, 6).map(t => (
                <tr key={t.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                  <td className="px-4 py-2 font-medium text-gray-800">{t.brand_snapshot}</td>
                  <td className="px-4 py-2 text-gray-600">{t.quantity}</td>
                  <td className="px-4 py-2 text-gray-800">{fmt(t.total_amount)}</td>
                  <td className="px-4 py-2">
                    <span className="px-1.5 py-0.5 bg-green-50 text-green-700 rounded text-xs">
                      +{fmt(t.profit)}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-gray-400">{t.profiles?.full_name?.split(' ')[0]}</td>
                </tr>
              ))}
              {todaySales.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-400">No sales yet today</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
