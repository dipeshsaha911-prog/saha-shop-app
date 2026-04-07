'use client'
// src/components/Inventory.jsx
// Full Inventory table with inline price editing.
// Uses Supabase real-time so price changes reflect instantly for ALL partners.

import React, { useState, useEffect, useCallback } from 'react'
import { fetchInventory, updateItemPrice, subscribeToInventory } from '@/lib/supabaseClient'

const CATEGORIES = ['All', 'Red Wine', 'White Wine', 'Sparkling', 'Beer', 'Whisky', 'Rum', 'Vodka']

const fmt = (n) => `₹${Number(n).toLocaleString('en-IN')}`
const margin = (buy, sell) => Math.round(((sell - buy) / sell) * 100)

export default function Inventory() {
  const [items, setItems]           = useState([])
  const [loading, setLoading]       = useState(true)
  const [filterCat, setFilterCat]   = useState('All')
  const [search, setSearch]         = useState('')
  const [editingId, setEditingId]   = useState(null)
  const [editValues, setEditValues] = useState({ buy: '', sell: '' })
  const [saving, setSaving]         = useState(false)
  const [message, setMessage]       = useState(null)  // { text, type }

  // ── Data fetch ────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    try {
      const data = await fetchInventory()
      setItems(data)
    } catch (e) {
      showMsg(e.message, 'error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    // Real-time: any partner's price/stock update reflects immediately
    const unsubscribe = subscribeToInventory(() => load())
    return unsubscribe
  }, [load])

  // ── Message helper ────────────────────────────────────────────────────────
  function showMsg(text, type = 'success') {
    setMessage({ text, type })
    setTimeout(() => setMessage(null), 4000)
  }

  // ── Edit handlers ─────────────────────────────────────────────────────────
  function startEdit(item) {
    setEditingId(item.id)
    setEditValues({ buy: item.buying_price, sell: item.selling_price })
  }

  function cancelEdit() {
    setEditingId(null)
    setEditValues({ buy: '', sell: '' })
  }

  async function savePrice(item) {
    const buy  = parseFloat(editValues.buy)
    const sell = parseFloat(editValues.sell)

    if (isNaN(buy) || isNaN(sell) || buy <= 0 || sell <= 0) {
      showMsg('Enter valid positive prices.', 'error')
      return
    }
    if (sell <= buy) {
      showMsg('Selling price must be higher than buying price.', 'error')
      return
    }

    setSaving(true)
    try {
      await updateItemPrice(item.id, buy, sell)
      // Optimistic local update (real-time will also confirm)
      setItems(prev => prev.map(i => i.id === item.id
        ? { ...i, buying_price: buy, selling_price: sell }
        : i
      ))
      cancelEdit()
      showMsg(`${item.brand} prices updated — Buy: ${fmt(buy)} / Sell: ${fmt(sell)}`)
    } catch (e) {
      showMsg(e.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  // ── Filter ─────────────────────────────────────────────────────────────────
  const filtered = items.filter(i => {
    const matchCat = filterCat === 'All' || i.category === filterCat
    const matchSearch = i.brand.toLowerCase().includes(search.toLowerCase())
    return matchCat && matchSearch
  })

  // ── Render ─────────────────────────────────────────────────────────────────
  if (loading) return <div className="flex items-center justify-center h-48 text-gray-400">Loading inventory…</div>

  return (
    <div>
      {/* Page header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Inventory & Price Management</h1>
          <p className="text-sm text-gray-500 mt-0.5">{items.length} items · Click Edit to update prices instantly</p>
        </div>
      </div>

      {/* Message banner */}
      {message && (
        <div className={`mb-4 px-4 py-2.5 rounded-lg text-sm ${
          message.type === 'error'
            ? 'bg-red-50 border border-red-200 text-red-700'
            : 'bg-green-50 border border-green-200 text-green-700'
        }`}>
          {message.text}
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-3 mb-4">
        <input
          type="text"
          placeholder="Search brand…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg w-48 focus:outline-none focus:ring-2 focus:ring-wine-500"
        />
        <div className="flex gap-1">
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setFilterCat(cat)}
              className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                filterCat === cat
                  ? 'bg-wine-700 text-white border-wine-700'
                  : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                {['Brand', 'Category', 'Size', 'Buy Price', 'Sell Price', 'Stock', 'Margin', 'Action'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(item => (
                <React.Fragment key={item.id}>
                  {/* ── Main row ── */}
                  <tr className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                    <td className="px-4 py-3 font-medium text-gray-900">{item.brand}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 bg-purple-50 text-purple-700 rounded-full text-xs">
                        {item.category}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{item.size}</td>
                    <td className="px-4 py-3 text-gray-700">{fmt(item.buying_price)}</td>
                    <td className="px-4 py-3 text-gray-700 font-medium">{fmt(item.selling_price)}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        item.stock < item.low_stock_threshold
                          ? 'bg-red-50 text-red-700'
                          : item.stock < item.low_stock_threshold * 2
                          ? 'bg-amber-50 text-amber-700'
                          : 'bg-green-50 text-green-700'
                      }`}>
                        {item.stock} units
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        margin(item.buying_price, item.selling_price) > 25
                          ? 'bg-green-50 text-green-700'
                          : 'bg-amber-50 text-amber-700'
                      }`}>
                        {margin(item.buying_price, item.selling_price)}%
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {editingId === item.id ? (
                        <button
                          onClick={cancelEdit}
                          className="px-3 py-1 text-xs border border-gray-200 rounded-lg hover:bg-gray-50"
                        >
                          Cancel
                        </button>
                      ) : (
                        <button
                          onClick={() => startEdit(item)}
                          className="px-3 py-1 text-xs bg-wine-700 text-white rounded-lg hover:bg-wine-800 transition-colors"
                          style={{ backgroundColor: '#7B2D42' }}
                        >
                          Edit Price
                        </button>
                      )}
                    </td>
                  </tr>

                  {/* ── Inline edit row ── */}
                  {editingId === item.id && (
                    <tr key={`edit-${item.id}`} className="bg-gray-50 border-b border-gray-100">
                      <td colSpan={8} className="px-4 py-3">
                        <div className="flex items-end gap-3 max-w-lg">
                          <div>
                            <label className="block text-xs text-gray-500 mb-1">New Buying Price (₹)</label>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={editValues.buy}
                              onChange={e => setEditValues(v => ({ ...v, buy: e.target.value }))}
                              className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg w-32 focus:outline-none focus:ring-2 focus:ring-wine-500"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-gray-500 mb-1">New Selling Price (₹)</label>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={editValues.sell}
                              onChange={e => setEditValues(v => ({ ...v, sell: e.target.value }))}
                              className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg w-32 focus:outline-none focus:ring-2 focus:ring-wine-500"
                            />
                          </div>
                          {/* Live margin preview */}
                          {editValues.buy && editValues.sell && parseFloat(editValues.sell) > parseFloat(editValues.buy) && (
                            <div className="text-xs text-green-600 pb-2">
                              Margin: {margin(editValues.buy, editValues.sell)}%
                              &nbsp;·&nbsp;Profit/unit: {fmt(editValues.sell - editValues.buy)}
                            </div>
                          )}
                          <button
                            onClick={() => savePrice(item)}
                            disabled={saving}
                            className="px-4 py-1.5 text-sm text-white rounded-lg transition-colors disabled:opacity-50"
                            style={{ backgroundColor: '#7B2D42' }}
                          >
                            {saving ? 'Saving…' : 'Save Price'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
