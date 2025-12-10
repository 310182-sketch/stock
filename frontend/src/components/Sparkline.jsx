import { useEffect, useMemo, useState } from 'react'
import { fetchTwHistory } from '@/services/api'

export default function Sparkline({ symbol, months = 3, height = 36 }) {
  const [points, setPoints] = useState([])
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        setError(null)
        const res = await fetchTwHistory(symbol, months)
        const data = res?.data || res
        if (!Array.isArray(data) || data.length === 0) throw new Error('no data')
        if (cancelled) return
        setPoints(data.map((d) => ({ x: d.date, y: Number(d.close) || 0 })))
      } catch (e) {
        if (!cancelled) setError(e.message)
      }
    }
    if (symbol) load()
    return () => {
      cancelled = true
    }
  }, [symbol, months])

  const { path, minY, maxY, lastY } = useMemo(() => {
    if (!points.length) return { path: '', minY: 0, maxY: 0, lastY: 0 }
    const values = points.map((p) => p.y)
    const min = Math.min(...values)
    const max = Math.max(...values)
    const range = max - min || 1
    const step = points.length > 1 ? 100 / (points.length - 1) : 100
    const coords = points.map((p, idx) => {
      const x = idx * step
      const y = ((max - p.y) / range) * (height - 4) + 2
      return `${x.toFixed(2)},${y.toFixed(2)}`
    })
    return {
      path: `M ${coords.join(' L ')}`,
      minY: min,
      maxY: max,
      lastY: values[values.length - 1],
    }
  }, [points, height])

  if (error) {
    return <span className="text-xs text-bear-light">ERR</span>
  }

  if (!path) {
    return <div className="h-9 w-24 animate-pulse rounded bg-bg-card/60 border border-bg-card/60" />
  }

  const trendUp = lastY >= minY + (maxY - minY) / 2

  return (
    <div className="relative">
      <svg viewBox="0 0 100 40" width="120" height={height}>
        <path d={path} fill="none" stroke={trendUp ? '#00C853' : '#FF1744'} strokeWidth="2" strokeLinecap="round" />
      </svg>
    </div>
  )
}
