import { useState, useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  AreaChart,
  Area,
  BarChart,
  Bar,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  PieChart,
  Pie,
  Cell,
  Legend,
  ComposedChart,
  ReferenceLine
} from 'recharts';

// ============================================
// 風險儀表板元件
// ============================================

/**
 * 風險指標概覽卡片
 */
export function RiskOverviewCard({ riskMetrics }) {
  const {
    totalRisk = 20,
    maxDrawdown = 15,
    sharpeRatio = 1.2,
    var95 = 2.5,
    riskLevel = { name: '中等風險', color: 'yellow' }
  } = riskMetrics || {};

  return (
    <div className="risk-overview-card">
      <div className="risk-header">
        <h3>📊 風險概覽</h3>
        <span className={`risk-badge risk-${riskLevel.color}`}>
          {riskLevel.name}
        </span>
      </div>
      
      <div className="risk-metrics-grid">
        <div className="risk-metric">
          <span className="risk-metric-label">波動率</span>
          <span className="risk-metric-value">{totalRisk.toFixed(1)}%</span>
        </div>
        <div className="risk-metric">
          <span className="risk-metric-label">最大回檔</span>
          <span className="risk-metric-value">{maxDrawdown.toFixed(1)}%</span>
        </div>
        <div className="risk-metric">
          <span className="risk-metric-label">Sharpe Ratio</span>
          <span className="risk-metric-value">{sharpeRatio.toFixed(2)}</span>
        </div>
        <div className="risk-metric">
          <span className="risk-metric-label">VaR 95%</span>
          <span className="risk-metric-value">{var95.toFixed(2)}%</span>
        </div>
      </div>
    </div>
  );
}

/**
 * 回檔圖表
 */
export function DrawdownChart({ equityCurve }) {
  const drawdownData = useMemo(() => {
    if (!equityCurve || equityCurve.length === 0) return [];
    
    let peak = equityCurve[0].equity;
    return equityCurve.map(point => {
      const currentEquity = point.smoothedEquity || point.equity;
      if (currentEquity > peak) peak = currentEquity;
      const drawdown = ((peak - currentEquity) / peak) * 100;
      return {
        date: point.date,
        drawdown: -drawdown,
        equity: currentEquity
      };
    });
  }, [equityCurve]);

  if (drawdownData.length === 0) {
    return <div className="chart-placeholder">無數據</div>;
  }

  return (
    <div className="chart-container">
      <h4>回檔分析</h4>
      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={drawdownData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
          <XAxis 
            dataKey="date" 
            tick={{ fontSize: 10 }} 
            tickFormatter={(d) => d.slice(5)}
          />
          <YAxis 
            domain={['dataMin', 0]} 
            tick={{ fontSize: 10 }}
            tickFormatter={(v) => `${v}%`}
          />
          <Tooltip 
            formatter={(value) => [`${value.toFixed(2)}%`, '回檔']}
            labelFormatter={(label) => `日期: ${label}`}
          />
          <Area 
            type="monotone" 
            dataKey="drawdown" 
            stroke="#e74c3c" 
            fill="#ffcccc"
            fillOpacity={0.6}
          />
          <ReferenceLine y={-10} stroke="#ff9800" strokeDasharray="3 3" />
          <ReferenceLine y={-20} stroke="#e74c3c" strokeDasharray="3 3" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/**
 * 報酬分布圖
 */
export function ReturnDistributionChart({ trades }) {
  const distributionData = useMemo(() => {
    if (!trades || trades.length === 0) return [];
    
    // 計算每筆交易報酬
    const returns = [];
    for (let i = 0; i < trades.length - 1; i += 2) {
      if (trades[i].type === 'BUY' && trades[i + 1]?.type === 'SELL') {
        const ret = ((trades[i + 1].price - trades[i].price) / trades[i].price) * 100;
        returns.push(ret);
      }
    }
    
    // 分組
    const bins = [
      { range: '< -10%', count: 0, color: '#e74c3c' },
      { range: '-10% ~ -5%', count: 0, color: '#ff9800' },
      { range: '-5% ~ 0%', count: 0, color: '#ffc107' },
      { range: '0% ~ 5%', count: 0, color: '#8bc34a' },
      { range: '5% ~ 10%', count: 0, color: '#4caf50' },
      { range: '> 10%', count: 0, color: '#2e7d32' }
    ];
    
    returns.forEach(r => {
      if (r < -10) bins[0].count++;
      else if (r < -5) bins[1].count++;
      else if (r < 0) bins[2].count++;
      else if (r < 5) bins[3].count++;
      else if (r < 10) bins[4].count++;
      else bins[5].count++;
    });
    
    return bins;
  }, [trades]);

  if (distributionData.length === 0) {
    return <div className="chart-placeholder">無交易數據</div>;
  }

  return (
    <div className="chart-container">
      <h4>報酬分布</h4>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={distributionData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
          <XAxis dataKey="range" tick={{ fontSize: 10 }} />
          <YAxis tick={{ fontSize: 10 }} />
          <Tooltip />
          <Bar dataKey="count" name="交易次數">
            {distributionData.map((entry, index) => (
              <Cell key={index} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/**
 * 績效雷達圖
 */
export function PerformanceRadarChart({ metrics }) {
  const radarData = useMemo(() => {
    if (!metrics) return [];
    
    // 標準化各項指標到 0-100 分
    const normalize = (value, min, max) => {
      return Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));
    };
    
    return [
      { subject: '報酬率', value: normalize(metrics.totalReturn || 0, -50, 100), fullMark: 100 },
      { subject: '勝率', value: metrics.winRate || 0, fullMark: 100 },
      { subject: 'Sharpe', value: normalize(metrics.sharpeRatio || 0, -1, 3) , fullMark: 100 },
      { subject: '穩定性', value: normalize(100 - (metrics.maxDrawdown || 0), 0, 100), fullMark: 100 },
      { subject: '盈虧比', value: normalize(metrics.profitFactor || 0, 0, 3), fullMark: 100 },
      { subject: '交易頻率', value: normalize(metrics.totalTrades || 0, 0, 50), fullMark: 100 }
    ];
  }, [metrics]);

  if (radarData.length === 0) {
    return <div className="chart-placeholder">無指標數據</div>;
  }

  return (
    <div className="chart-container">
      <h4>績效雷達圖</h4>
      <ResponsiveContainer width="100%" height={250}>
        <RadarChart data={radarData}>
          <PolarGrid stroke="#ddd" />
          <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11 }} />
          <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 10 }} />
          <Radar
            name="績效"
            dataKey="value"
            stroke="#3498db"
            fill="#3498db"
            fillOpacity={0.5}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}

/**
 * 月度報酬熱力圖
 */
export function MonthlyReturnsHeatmap({ equityCurve }) {
  const monthlyData = useMemo(() => {
    if (!equityCurve || equityCurve.length === 0) return [];
    
    const monthly = {};
    let prevMonthEquity = equityCurve[0].equity;
    
    equityCurve.forEach(point => {
      const [year, month] = point.date.split('-');
      const key = `${year}-${month}`;
      
      if (!monthly[key]) {
        monthly[key] = { year, month, startEquity: prevMonthEquity, endEquity: point.equity };
      }
      monthly[key].endEquity = point.equity;
    });
    
    return Object.entries(monthly).map(([key, data]) => {
      const ret = ((data.endEquity - data.startEquity) / data.startEquity) * 100;
      return {
        month: key,
        return: ret,
        color: ret > 5 ? '#2e7d32' : ret > 0 ? '#8bc34a' : ret > -5 ? '#ffcdd2' : '#e74c3c'
      };
    });
  }, [equityCurve]);

  if (monthlyData.length === 0) {
    return <div className="chart-placeholder">無月度數據</div>;
  }

  return (
    <div className="chart-container">
      <h4>月度報酬</h4>
      <div className="monthly-heatmap">
        {monthlyData.map((m, i) => (
          <div
            key={i}
            className="monthly-cell"
            style={{ backgroundColor: m.color }}
            title={`${m.month}: ${m.return.toFixed(1)}%`}
          >
            <span className="monthly-label">{m.month.slice(5)}</span>
            <span className="monthly-value">{m.return.toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * 交易時間分析
 */
export function TradeTimingAnalysis({ trades }) {
  const timingData = useMemo(() => {
    if (!trades || trades.length === 0) return [];
    
    const weekdayStats = Array(7).fill(null).map((_, i) => ({
      day: ['週日', '週一', '週二', '週三', '週四', '週五', '週六'][i],
      trades: 0,
      profit: 0
    }));
    
    for (let i = 0; i < trades.length - 1; i += 2) {
      if (trades[i].type === 'BUY' && trades[i + 1]?.type === 'SELL') {
        const sellDate = new Date(trades[i + 1].date);
        const dayOfWeek = sellDate.getDay();
        const ret = ((trades[i + 1].price - trades[i].price) / trades[i].price) * 100;
        
        weekdayStats[dayOfWeek].trades++;
        weekdayStats[dayOfWeek].profit += ret;
      }
    }
    
    return weekdayStats.filter(d => d.trades > 0).map(d => ({
      ...d,
      avgProfit: d.trades > 0 ? d.profit / d.trades : 0
    }));
  }, [trades]);

  if (timingData.length === 0) {
    return <div className="chart-placeholder">無交易時間數據</div>;
  }

  return (
    <div className="chart-container">
      <h4>交易日分析</h4>
      <ResponsiveContainer width="100%" height={200}>
        <ComposedChart data={timingData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
          <XAxis dataKey="day" tick={{ fontSize: 11 }} />
          <YAxis yAxisId="left" tick={{ fontSize: 10 }} />
          <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} />
          <Tooltip />
          <Bar yAxisId="left" dataKey="trades" name="交易次數" fill="#3498db" />
          <Line 
            yAxisId="right" 
            type="monotone" 
            dataKey="avgProfit" 
            name="平均報酬%" 
            stroke="#e74c3c"
            strokeWidth={2}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

/**
 * 持倉時間分析
 */
export function HoldingPeriodAnalysis({ trades }) {
  const holdingData = useMemo(() => {
    if (!trades || trades.length === 0) return [];
    
    const periods = [
      { range: '1-5天', min: 1, max: 5, trades: 0, totalProfit: 0 },
      { range: '6-10天', min: 6, max: 10, trades: 0, totalProfit: 0 },
      { range: '11-20天', min: 11, max: 20, trades: 0, totalProfit: 0 },
      { range: '21-40天', min: 21, max: 40, trades: 0, totalProfit: 0 },
      { range: '40天以上', min: 41, max: Infinity, trades: 0, totalProfit: 0 }
    ];
    
    for (let i = 0; i < trades.length - 1; i += 2) {
      if (trades[i].type === 'BUY' && trades[i + 1]?.type === 'SELL') {
        const buyDate = new Date(trades[i].date);
        const sellDate = new Date(trades[i + 1].date);
        const holdingDays = Math.ceil((sellDate - buyDate) / (1000 * 60 * 60 * 24));
        const ret = ((trades[i + 1].price - trades[i].price) / trades[i].price) * 100;
        
        for (const period of periods) {
          if (holdingDays >= period.min && holdingDays <= period.max) {
            period.trades++;
            period.totalProfit += ret;
            break;
          }
        }
      }
    }
    
    return periods.filter(p => p.trades > 0).map(p => ({
      range: p.range,
      trades: p.trades,
      avgProfit: p.totalProfit / p.trades
    }));
  }, [trades]);

  if (holdingData.length === 0) {
    return <div className="chart-placeholder">無持倉數據</div>;
  }

  return (
    <div className="chart-container">
      <h4>持倉時間分析</h4>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={holdingData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
          <XAxis dataKey="range" tick={{ fontSize: 10 }} />
          <YAxis yAxisId="left" tick={{ fontSize: 10 }} />
          <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} />
          <Tooltip />
          <Bar yAxisId="left" dataKey="trades" name="交易次數" fill="#9b59b6" />
          <Bar yAxisId="right" dataKey="avgProfit" name="平均報酬%" fill="#2ecc71" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/**
 * 技術指標儀表板
 */
export function IndicatorsDashboard({ indicators }) {
  if (!indicators) {
    return <div className="chart-placeholder">無指標數據</div>;
  }

  const {
    ma5, ma10, ma20, ma60,
    rsi14, macd, kd, bollinger, atr
  } = indicators;

  const getRSIColor = (rsi) => {
    if (rsi === null || rsi === undefined) return '#999';
    if (rsi < 30) return '#4caf50';
    if (rsi > 70) return '#e74c3c';
    return '#ff9800';
  };

  const getRSILabel = (rsi) => {
    if (rsi === null || rsi === undefined) return '無數據';
    if (rsi < 30) return '超賣';
    if (rsi > 70) return '超買';
    return '中性';
  };

  return (
    <div className="indicators-dashboard">
      <h4>📈 技術指標</h4>
      
      <div className="indicators-grid">
        {/* 移動平均線 */}
        <div className="indicator-group">
          <h5>移動平均線</h5>
          <div className="indicator-row">
            <span>MA5:</span>
            <span className="indicator-value">{ma5?.toFixed(2) || '-'}</span>
          </div>
          <div className="indicator-row">
            <span>MA10:</span>
            <span className="indicator-value">{ma10?.toFixed(2) || '-'}</span>
          </div>
          <div className="indicator-row">
            <span>MA20:</span>
            <span className="indicator-value">{ma20?.toFixed(2) || '-'}</span>
          </div>
          <div className="indicator-row">
            <span>MA60:</span>
            <span className="indicator-value">{ma60?.toFixed(2) || '-'}</span>
          </div>
        </div>

        {/* RSI */}
        <div className="indicator-group">
          <h5>RSI 指標</h5>
          <div className="rsi-gauge">
            <div 
              className="rsi-value" 
              style={{ color: getRSIColor(rsi14) }}
            >
              {rsi14?.toFixed(1) || '-'}
            </div>
            <div className="rsi-label" style={{ color: getRSIColor(rsi14) }}>
              {getRSILabel(rsi14)}
            </div>
          </div>
          <div className="rsi-bar">
            <div 
              className="rsi-fill" 
              style={{ 
                width: `${rsi14 || 0}%`,
                backgroundColor: getRSIColor(rsi14)
              }}
            />
          </div>
        </div>

        {/* MACD */}
        {macd && (
          <div className="indicator-group">
            <h5>MACD</h5>
            <div className="indicator-row">
              <span>MACD:</span>
              <span className="indicator-value" style={{ color: macd.macd > 0 ? '#4caf50' : '#e74c3c' }}>
                {macd.macd?.toFixed(2) || '-'}
              </span>
            </div>
            <div className="indicator-row">
              <span>Signal:</span>
              <span className="indicator-value">{macd.signal?.toFixed(2) || '-'}</span>
            </div>
            <div className="indicator-row">
              <span>Histogram:</span>
              <span className="indicator-value" style={{ color: macd.histogram > 0 ? '#4caf50' : '#e74c3c' }}>
                {macd.histogram?.toFixed(2) || '-'}
              </span>
            </div>
          </div>
        )}

        {/* KD */}
        {kd && (
          <div className="indicator-group">
            <h5>KD 指標</h5>
            <div className="indicator-row">
              <span>K:</span>
              <span className="indicator-value">{kd.k?.toFixed(1) || '-'}</span>
            </div>
            <div className="indicator-row">
              <span>D:</span>
              <span className="indicator-value">{kd.d?.toFixed(1) || '-'}</span>
            </div>
            <div className="indicator-row">
              <span>J:</span>
              <span className="indicator-value">{kd.j?.toFixed(1) || '-'}</span>
            </div>
          </div>
        )}

        {/* 布林通道 */}
        {bollinger && (
          <div className="indicator-group">
            <h5>布林通道</h5>
            <div className="indicator-row">
              <span>上軌:</span>
              <span className="indicator-value">{bollinger.upper?.toFixed(2) || '-'}</span>
            </div>
            <div className="indicator-row">
              <span>中軌:</span>
              <span className="indicator-value">{bollinger.middle?.toFixed(2) || '-'}</span>
            </div>
            <div className="indicator-row">
              <span>下軌:</span>
              <span className="indicator-value">{bollinger.lower?.toFixed(2) || '-'}</span>
            </div>
            <div className="indicator-row">
              <span>%B:</span>
              <span className="indicator-value">{bollinger.percentB?.toFixed(1) || '-'}%</span>
            </div>
          </div>
        )}

        {/* ATR */}
        {atr && (
          <div className="indicator-group">
            <h5>波動率</h5>
            <div className="indicator-row">
              <span>ATR:</span>
              <span className="indicator-value">{atr?.toFixed(2) || '-'}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * 策略比較表格
 */
export function StrategyComparisonTable({ results }) {
  if (!results || results.length === 0) {
    return <div className="chart-placeholder">無比較數據</div>;
  }

  return (
    <div className="comparison-table-container">
      <h4>策略比較</h4>
      <table className="comparison-table">
        <thead>
          <tr>
            <th>策略</th>
            <th>總報酬</th>
            <th>年化報酬</th>
            <th>勝率</th>
            <th>最大回檔</th>
            <th>Sharpe</th>
            <th>交易次數</th>
          </tr>
        </thead>
        <tbody>
          {results.map((r, i) => (
            <tr key={i} className={i === 0 ? 'best-row' : ''}>
              <td>{r.strategy}</td>
              <td style={{ color: r.metrics?.totalReturn > 0 ? '#4caf50' : '#e74c3c' }}>
                {r.metrics?.totalReturn?.toFixed(1)}%
              </td>
              <td>{r.metrics?.annualizedReturn?.toFixed(1)}%</td>
              <td>{r.metrics?.winRate?.toFixed(1)}%</td>
              <td>{r.metrics?.maxDrawdown?.toFixed(1)}%</td>
              <td>{r.metrics?.sharpeRatio?.toFixed(2)}</td>
              <td>{r.metrics?.totalTrades}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * 風險警報列表
 */
export function RiskAlertsList({ alerts }) {
  if (!alerts || alerts.length === 0) {
    return (
      <div className="risk-alerts">
        <h4>⚠️ 風險警報</h4>
        <div className="no-alerts">✅ 目前沒有風險警報</div>
      </div>
    );
  }

  const getLevelIcon = (level) => {
    switch (level) {
      case 'CRITICAL': return '🔴';
      case 'WARNING': return '🟡';
      case 'INFO': return '🔵';
      default: return '⚪';
    }
  };

  return (
    <div className="risk-alerts">
      <h4>⚠️ 風險警報 ({alerts.length})</h4>
      <div className="alerts-list">
        {alerts.map((alert, i) => (
          <div key={i} className={`alert-item alert-${alert.level.toLowerCase()}`}>
            <span className="alert-icon">{getLevelIcon(alert.level)}</span>
            <div className="alert-content">
              <div className="alert-message">{alert.message}</div>
              <div className="alert-action">💡 {alert.action}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * 壓力測試結果
 */
export function StressTestResults({ results }) {
  if (!results || results.length === 0) {
    return <div className="chart-placeholder">無壓力測試數據</div>;
  }

  return (
    <div className="stress-test-results">
      <h4>🔥 壓力測試</h4>
      <table className="stress-test-table">
        <thead>
          <tr>
            <th>情境</th>
            <th>市場跌幅</th>
            <th>組合跌幅</th>
            <th>損失金額</th>
            <th>恢復所需</th>
          </tr>
        </thead>
        <tbody>
          {results.map((r, i) => (
            <tr key={i}>
              <td>{r.scenario}</td>
              <td>{r.marketDrop}%</td>
              <td style={{ color: '#e74c3c' }}>{r.portfolioDrop}%</td>
              <td style={{ color: '#e74c3c' }}>${r.lossAmount.toLocaleString()}</td>
              <td>{r.recoveryNeeded}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * 進階分析面板
 */
export function AdvancedAnalysisPanel({ result, expanded = false }) {
  const [isExpanded, setIsExpanded] = useState(expanded);

  if (!result) {
    return null;
  }

  return (
    <div className="advanced-analysis-panel">
      <button 
        className="panel-toggle"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        {isExpanded ? '收起進階分析 ▲' : '展開進階分析 ▼'}
      </button>
      
      {isExpanded && (
        <div className="analysis-content">
          <div className="analysis-row">
            <PerformanceRadarChart metrics={result.metrics} />
            <DrawdownChart equityCurve={result.equityCurve} />
          </div>
          
          <div className="analysis-row">
            <ReturnDistributionChart trades={result.trades} />
            <MonthlyReturnsHeatmap equityCurve={result.equityCurve} />
          </div>
          
          <div className="analysis-row">
            <TradeTimingAnalysis trades={result.trades} />
            <HoldingPeriodAnalysis trades={result.trades} />
          </div>
        </div>
      )}
    </div>
  );
}

export default {
  RiskOverviewCard,
  DrawdownChart,
  ReturnDistributionChart,
  PerformanceRadarChart,
  MonthlyReturnsHeatmap,
  TradeTimingAnalysis,
  HoldingPeriodAnalysis,
  IndicatorsDashboard,
  StrategyComparisonTable,
  RiskAlertsList,
  StressTestResults,
  AdvancedAnalysisPanel
};
