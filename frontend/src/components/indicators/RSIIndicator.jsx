import { useEffect, useRef } from 'react'
import { createChart } from 'lightweight-charts'
import { calculateRSI } from '@/utils/calculations'

export default function RSIIndicator({ historyData, height = 200 }) {
  const chartContainerRef = useRef(null)
  const chartRef = useRef(null)

  useEffect(() => {
    if (!chartContainerRef.current || !historyData || historyData.length < 15) return

    const rsiData = calculateRSI(historyData, 14)

    if (rsiData.length === 0) return

    // 創建圖表
    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: height,
      layout: {
        background: { color: 'transparent' },
        textColor: '#a1a1aa',
      },
      grid: {
        vertLines: { color: '#27272a' },
        horzLines: { color: '#27272a' },
      },
      crosshair: {
        mode: 1,
      },
      rightPriceScale: {
        borderColor: '#3f3f46',
      },
      timeScale: {
        borderColor: '#3f3f46',
        timeVisible: true,
        secondsVisible: false,
      },
    })

    chartRef.current = chart

    // RSI 線
    const rsiSeries = chart.addLineSeries({
      color: '#3b82f6',
      lineWidth: 2,
      priceFormat: {
        type: 'price',
        precision: 2,
        minMove: 0.01,
      },
    })

    rsiSeries.setData(rsiData)

    // 超買線 (70)
    const overboughtSeries = chart.addLineSeries({
      color: '#ef4444',
      lineWidth: 1,
      lineStyle: 2,
      priceLineVisible: false,
      lastValueVisible: false,
    })

    overboughtSeries.setData(
      rsiData.map(item => ({ time: item.time, value: 70 }))
    )

    // 超賣線 (30)
    const oversoldSeries = chart.addLineSeries({
      color: '#10b981',
      lineWidth: 1,
      lineStyle: 2,
      priceLineVisible: false,
      lastValueVisible: false,
    })

    oversoldSeries.setData(
      rsiData.map(item => ({ time: item.time, value: 30 }))
    )

    // 中線 (50)
    const midlineSeries = chart.addLineSeries({
      color: '#6b7280',
      lineWidth: 1,
      lineStyle: 2,
      priceLineVisible: false,
      lastValueVisible: false,
    })

    midlineSeries.setData(
      rsiData.map(item => ({ time: item.time, value: 50 }))
    )

    chart.priceScale('right').applyOptions({
      scaleMargins: {
        top: 0.1,
        bottom: 0.1,
      },
    })

    chart.timeScale().fitContent()

    // 響應式調整
    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
        })
      }
    }

    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      if (chartRef.current) {
        chartRef.current.remove()
      }
    }
  }, [historyData, height])

  if (!historyData || historyData.length < 15) {
    return (
      <div className="flex items-center justify-center" style={{ height: `${height}px` }}>
        <p className="text-neutral-light/60">數據不足 (需要至少 15 個數據點)</p>
      </div>
    )
  }

  const rsiData = calculateRSI(historyData, 14)
  const latestRSI = rsiData[rsiData.length - 1]?.value

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-sm font-semibold text-neutral-light/70">RSI (14) 指標</h4>
        {latestRSI && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-neutral-light/60">當前值:</span>
            <span className={`text-sm font-bold ${
              latestRSI > 70 ? 'text-bear-light' : 
              latestRSI < 30 ? 'text-bull-light' : 
              'text-neutral-light'
            }`}>
              {latestRSI.toFixed(2)}
            </span>
            {latestRSI > 70 && (
              <span className="text-xs px-2 py-0.5 bg-bear/20 text-bear-light rounded">超買</span>
            )}
            {latestRSI < 30 && (
              <span className="text-xs px-2 py-0.5 bg-bull/20 text-bull-light rounded">超賣</span>
            )}
          </div>
        )}
      </div>
      <div ref={chartContainerRef} className="rounded-lg overflow-hidden" />
      <div className="flex items-center justify-center gap-4 mt-2 text-xs">
        <div className="flex items-center gap-1">
          <div className="w-3 h-0.5 bg-[#ef4444]"></div>
          <span className="text-neutral-light/60">超買區(70)</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-0.5 bg-[#6b7280]"></div>
          <span className="text-neutral-light/60">中線(50)</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-0.5 bg-[#10b981]"></div>
          <span className="text-neutral-light/60">超賣區(30)</span>
        </div>
      </div>
    </div>
  )
}
