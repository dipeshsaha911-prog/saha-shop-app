'use client'
// src/components/Reports.jsx
// Daily/Monthly summaries, full transaction audit log, CSV export.

import { useState, useEffect } from 'react'
import { fetchDailySummary, fetchSales, fetchRestocks } from '@/lib/supabaseClient'

const fmt = (n) => `₹${Number(n).toLocaleString('en-IN')}`

export default function Reports() {
  const [daily, setDaily]       = useState([])
  const [allSales, setAllSales] = useState([])
  const [restocks, setRestocks] = useState([])
  const [view, setView]         = useState('daily')   // 'daily' | 'log'
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    Promise.all([
      fetchDailySummary({ months: 3 }),
      fetchSales({ limit: 200 }),
      fetchRestocks({ limit: 200 })
    ]).then(([d, s, r]) => {
      setDaily(d); setAllSales(s); setRestocks(r)
    }).finally(() => setLoading(false))
  }, [])

  // Merge sales + restocks into a unified transaction log, sorted by date desc
  const txLog = [
    ...allSales.map(t => ({ ...t, txType: 'sale',    amount: t.total_amount, person: t.profiles?.full_name })),
    ...restocks.map(t => ({ ...t, txType: 'restock', amount: t.total_cost,   person: t.profiles?.full_name })),
  ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))

  const totalRevenue = allSales.reduce((s, t) => s + Number(t.total_amount), 0)
  const totalProfit  = allSales.reduce((s, t) => s + Number(t.profit), 0)

  // ── CSV Export ─────────────────────────────────────────────────────────────
  function exportTransactionsCSV() {
    const headers = ['Date', 'Time', 'Type', 'Item', 'Qty', 'Unit Price', 'Amount', 'Profit', 'By', 'Invoice']
    const rows = txLog.map(t => [
      new Date(t.created_at).toLocaleDateString('en-IN'),
      new Date(t.created_at).toLocaleTimeString('en-IN'),
      t.txType,
      `"${t.brand_snapshot}"`,
      t.quantity,
      t.txType === 'sale' ? t.unit_price : t.unit_cost,
      t.amount,
      t.txType === 'sale' ? t.profit : 0,
      `"${t.person || ''}"`,
      `"${t.invoice_number || ''}"`,
    ])
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' }) // BOM for Excel
    const url  = URL.createObjectURL(blob)
    const a    = Object.assign(document.createElement('a'), {
      href: url,
      download: `wine-shop-audit-${new Date().toISOString().split('T')[0]}.csv`
    })
    a.click()
  }

  function exportDailySummaryCSV() {
    const headers = ['Date', 'Transactions', 'Units Sold', 'Revenue', 'Profit', 'Margin %']
    const rows = daily.map(d => [d.sale_date, d.transaction_count, d.total_units_sold, d.total_revenue, d.total_profit, d.margin_pct])
    const csv  = [headers, ...rows].map(r => r.join(',')).join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' })
    const url  = URL.createObjectURL(blob)
    const a    = Object.assign(document.createElement('a'), {
      href: url,
      download: `daily-summary-${new Date().toISOString().split('T')[0]}.csv`
    })
    a.click()
  }

  if (loading) return <div className="flex items-center justify-center h-48 text-gray-400">Loading reports…</div>

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Reports & Audit</h1>
          <p className="text-sm text-gray-500 mt-0.5">Daily summaries, transaction log · Ready for ITR filing</p>
        </div>
        <div className="flex gap-2">
          <button onClick={exportDailySummaryCSV} className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg hover:bg-gray-50">
            Export Summary CSV
          </button>
          <button
            onClick={exportTransactionsCSV}
            className="px-3 py-1.5 text-xs text-white rounded-lg"
            style={{ backgroundColor: '#7B2D42' }}
          >
            Export Full Audit CSV
          </button>
        </div>
      </div>

      {/* Summary metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        {[
          { label: 'Total Revenue',     value: fmt(totalRevenue) },
          { label: 'Total Profit',      value: fmt(totalProfit) },
          { label: 'Margin',            value: totalRevenue > 0 ? `${Math.round(totalProfit/totalRevenue*100)}%` : '—' },
          { label: 'Total Transactions',value: allSales.length },
        ].map(m => (
          <div key={m.label} className="bg-gray-50 rounded-lg p-3">
            <div className="text-xs text-gray-400 uppercase tracking-wide mb-1">{m.label}</div>
            <div className="text-lg font-semibold text-gray-900">{m.value}</div>
          </div>
        ))}
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 mb-4 p-1 bg-gray-100 rounded-lg w-fit">
        {[['daily','Daily Summary'], ['log','Transaction Log']].map(([v, l]) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`px-4 py-1.5 text-sm rounded-md transition-colors ${
              view === v ? 'bg-white shadow-sm font-medium text-gray-900' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {l}
          </button>
        ))}
      </div>

      {/* ── Daily Summary Table ── */}
      {view === 'daily' && (
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                {['Date','Transactions','Units Sold','Revenue','Profit','Margin'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs text-gray-400 uppercase font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {daily.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-6 text-center text-gray-400">No data yet</td></tr>
              )}
              {daily.map(d => (
                <tr key={d.sale_date} className="border-b border-gray-50 hover:bg-gray-50/50">
                  <td className="px-4 py-3 font-medium text-gray-800">{d.sale_date}</td>
                  <td className="px-4 py-3 text-center text-gray-600">{d.transaction_count}</td>
                  <td className="px-4 py-3 text-center text-gray-600">{d.total_units_sold}</td>
                  <td className="px-4 py-3 text-gray-800">{fmt(d.total_revenue)}</td>
                  <td className="px-4 py-3 text-gray-800">{fmt(d.total_profit)}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      Number(d.margin_pct) > 25
                        ? 'bg-green-50 text-green-700'
                        : 'bg-amber-50 text-amber-700'
                    }`}>
                      {d.margin_pct}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Transaction Log ── */}
      {view === 'log' && (
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex justify-between items-center">
            <h2 className="text-sm font-medium text-gray-700">All Transactions (Sales + Restocks)</h2>
            <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full text-xs">{txLog.length} records</span>
          </div>
          <div className="overflow-x-auto max-h-96 overflow-y-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-50 sticky top-0 bg-white">
                  {['Date & Time','Type','Item','Qty','Amount','Profit','By'].map(h => (
                    <th key={h} className="text-left px-3 py-2.5 text-xs text-gray-400 uppercase font-medium whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {txLog.map(t => (
                  <tr key={`${t.txType}-${t.id}`} className="border-b border-gray-50 hover:bg-gray-50/50">
                    <td className="px-3 py-2.5 text-gray-400 text-xs whitespace-nowrap">
                      {new Date(t.created_at).toLocaleDateString('en-IN')}{' '}
                      {new Date(t.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        t.txType === 'sale'
                          ? 'bg-green-50 text-green-700'
                          : 'bg-blue-50 text-blue-700'
                      }`}>
                        {t.txType}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 font-medium text-gray-800">{t.brand_snapshot}</td>
                    <td className="px-3 py-2.5 text-gray-600 text-center">{t.quantity}</td>
                    <td className="px-3 py-2.5 text-gray-800">{fmt(t.amount)}</td>
                    <td className="px-3 py-2.5">
                      {t.txType === 'sale'
                        ? <span className="px-1.5 py-0.5 bg-green-50 text-green-700 rounded text-xs">+{fmt(t.profit)}</span>
                        : <span className="text-gray-300">—</span>
                      }
                    </td>
                    <td className="px-3 py-2.5 text-gray-400">{t.person?.split(' ')[0]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
