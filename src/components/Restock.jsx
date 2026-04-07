'use client'
// src/components/Restock.jsx
// New Stock Arrival — adds to existing stock via Supabase trigger.

import { useState, useEffect } from 'react'
import { fetchInventory, fetchRestocks, recordRestock } from '@/lib/supabaseClient'

const fmt = (n) => `₹${Number(n).toLocaleString('en-IN')}`

export default function Restock() {
  const [inventory, setInventory]   = useState([])
  const [history, setHistory]       = useState([])
  const [form, setForm]             = useState({ itemId: '', quantity: '', invoice: '', supplier: '', note: '' })
  const [preview, setPreview]       = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage]       = useState(null)

  useEffect(() => {
    fetchInventory().then(setInventory)
    fetchRestocks({ limit: 20 }).then(setHistory)
  }, [])

  // Auto-compute preview when item or quantity changes
  useEffect(() => {
    const item = inventory.find(i => i.id === parseInt(form.itemId))
    const qty  = parseInt(form.quantity)
    if (!item || !qty || qty <= 0) { setPreview(null); return }
    setPreview({
      brand:    item.brand,
      oldStock: item.stock,
      incoming: qty,
      newStock: item.stock + qty,
      unitCost: item.buying_price,
      totalCost: qty * item.buying_price
    })
  }, [form.itemId, form.quantity, inventory])

  function showMsg(text, type = 'success') {
    setMessage({ text, type })
    setTimeout(() => setMessage(null), 4000)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const item = inventory.find(i => i.id === parseInt(form.itemId))
    const qty  = parseInt(form.quantity)
    if (!item) { showMsg('Please select an item.', 'error'); return }
    if (!qty || qty <= 0) { showMsg('Enter a valid quantity.', 'error'); return }

    setSubmitting(true)
    try {
      await recordRestock({
        inventoryId:   item.id,
        brandSnapshot: item.brand,
        quantity:      qty,
        unitCost:      item.buying_price,
        invoiceNumber: form.invoice  || null,
        supplier:      form.supplier || null,
        note:          form.note     || null
      })

      // Update local inventory stock immediately (optimistic)
      setInventory(prev => prev.map(i =>
        i.id === item.id ? { ...i, stock: i.stock + qty } : i
      ))

      // Refresh history
      const updated = await fetchRestocks({ limit: 20 })
      setHistory(updated)

      const oldStock = item.stock; showMsg(`Restocked! ${item.brand}: ${oldStock} → ${oldStock + qty} units`)
      setForm({ itemId: '', quantity: '', invoice: '', supplier: '', note: '' })
    } catch (err) {
      showMsg(err.message, 'error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-xl font-semibold text-gray-900">Restock Module</h1>
        <p className="text-sm text-gray-500 mt-0.5">Record new stock arrivals — inventory updates instantly</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-start">

        {/* ── Form ── */}
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <h2 className="text-sm font-medium text-gray-700 mb-4">New Stock Arrival</h2>

          {message && (
            <div className={`mb-4 px-4 py-2.5 rounded-lg text-sm ${
              message.type === 'error'
                ? 'bg-red-50 border border-red-200 text-red-700'
                : 'bg-green-50 border border-green-200 text-green-700'
            }`}>
              {message.text}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3">
            {/* Item select */}
            <div>
              <label className="block text-xs text-gray-500 mb-1">Select Item *</label>
              <select
                value={form.itemId}
                onChange={e => setForm(f => ({ ...f, itemId: e.target.value }))}
                required
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-wine-500"
              >
                <option value="">— Select brand —</option>
                {inventory.map(i => (
                  <option key={i.id} value={i.id}>
                    {i.brand} ({i.category}) — Current Stock: {i.stock}
                  </option>
                ))}
              </select>
            </div>

            {/* Quantity */}
            <div>
              <label className="block text-xs text-gray-500 mb-1">Incoming Quantity *</label>
              <input
                type="number" min="1" required
                value={form.quantity}
                onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))}
                placeholder="e.g. 24"
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-wine-500"
              />
            </div>

            {/* Invoice */}
            <div>
              <label className="block text-xs text-gray-500 mb-1">Invoice / Bill No.</label>
              <input
                type="text"
                value={form.invoice}
                onChange={e => setForm(f => ({ ...f, invoice: e.target.value }))}
                placeholder="e.g. INV-2024-001"
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-wine-500"
              />
            </div>

            {/* Supplier */}
            <div>
              <label className="block text-xs text-gray-500 mb-1">Supplier Name</label>
              <input
                type="text"
                value={form.supplier}
                onChange={e => setForm(f => ({ ...f, supplier: e.target.value }))}
                placeholder="e.g. Sula Vineyards Ltd."
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-wine-500"
              />
            </div>

            {/* Stock preview */}
            {preview && (
              <div className="bg-gray-50 rounded-lg p-3 text-sm space-y-1">
                <div className="flex justify-between text-gray-500">
                  <span>Current Stock</span><span>{preview.oldStock} units</span>
                </div>
                <div className="flex justify-between text-gray-500">
                  <span>Incoming</span><span className="text-blue-600">+{preview.incoming} units</span>
                </div>
                <div className="flex justify-between font-medium text-green-700 border-t border-gray-200 pt-1 mt-1">
                  <span>New Stock Total</span><span>{preview.newStock} units</span>
                </div>
                <div className="flex justify-between text-gray-500">
                  <span>Estimated Cost</span><span>{fmt(preview.totalCost)}</span>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 text-sm font-medium text-white rounded-lg transition-colors disabled:opacity-50"
              style={{ backgroundColor: '#7B2D42' }}
            >
              {submitting ? 'Processing…' : 'Confirm Restock'}
            </button>
          </form>
        </div>

        {/* ── History ── */}
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex justify-between items-center">
            <h2 className="text-sm font-medium text-gray-700">Recent Restock History</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-50">
                  <th className="text-left px-4 py-2.5 text-xs text-gray-400 uppercase font-medium">Date</th>
                  <th className="text-left px-4 py-2.5 text-xs text-gray-400 uppercase font-medium">Item</th>
                  <th className="text-left px-4 py-2.5 text-xs text-gray-400 uppercase font-medium">Qty</th>
                  <th className="text-left px-4 py-2.5 text-xs text-gray-400 uppercase font-medium">Cost</th>
                  <th className="text-left px-4 py-2.5 text-xs text-gray-400 uppercase font-medium">By</th>
                </tr>
              </thead>
              <tbody>
                {history.length === 0 && (
                  <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-400">No restock history yet</td></tr>
                )}
                {history.map(r => (
                  <tr key={r.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                    <td className="px-4 py-2.5 text-gray-500">
                      {new Date(r.created_at).toLocaleDateString('en-IN')}
                    </td>
                    <td className="px-4 py-2.5 font-medium text-gray-800">{r.brand_snapshot}</td>
                    <td className="px-4 py-2.5">
                      <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full text-xs">+{r.quantity}</span>
                    </td>
                    <td className="px-4 py-2.5 text-gray-700">{fmt(r.total_cost)}</td>
                    <td className="px-4 py-2.5 text-gray-500">{r.profiles?.full_name?.split(' ')[0]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
