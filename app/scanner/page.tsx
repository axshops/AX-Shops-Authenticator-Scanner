// app/scanner/page.tsx
'use client'
import { useState } from 'react'

export default function Scanner() {
  const [orderId, setOrderId] = useState('')

  async function scan() {
    await fetch('/api/scans', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orderId,
        componentType: 'order_id',
        scanValue: orderId,
        device: navigator.userAgent
      })
    })
  }

  return (
    <main>
      <h1>AX Auth Scanner</h1>
      <input
        placeholder="Order ID"
        value={orderId}
        onChange={e => setOrderId(e.target.value)}
      />
      <button onClick={scan}>Scan</button>
    </main>
  )
}
