import React, { useState, useEffect, useCallback, useRef } from 'react'
import { api } from '../api.js'

const WS_URL = 'ws://localhost:8000/ws'

// ── Sensor card ───────────────────────────────────────────────────────────────
function SensorCard({ topic, data }) {
  const name = data.label || topic.split('/')[1]
  const val  = data.value
  const unit = data.unit || ''
  let display = '', color = 'text-claw-sub', bar = null, alert = false

  if (unit === 'bool') {
    display = val ? 'Active' : 'Idle'
    color   = val ? 'text-claw-accent' : 'text-claw-sub'
  } else if (unit === '%') {
    display = `${Number(val).toFixed(1)}%`
    alert   = val < 20
    color   = val < 20 ? 'text-red-400' : val < 30 ? 'text-claw-amber' : 'text-claw-accent'
    bar     = <div className="mt-2 h-1.5 rounded-full bg-claw-muted overflow-hidden">
      <div className="h-full rounded-full transition-all duration-700"
        style={{ width: `${Math.min(100, val)}%`,
                 background: val < 20 ? '#E24B4A' : val < 30 ? '#EF9F27' : '#1D9E75' }} />
    </div>
  } else if (unit === 'C') {
    display = `${Number(val).toFixed(1)}°C`
    alert   = val > 35
    color   = val > 35 ? 'text-red-400' : val > 28 ? 'text-claw-amber' : 'text-claw-blue'
    const pct = Math.min(100, Math.max(0, ((val - 10) / 30) * 100))
    bar = <div className="mt-2 h-1.5 rounded-full bg-claw-muted overflow-hidden">
      <div className="h-full rounded-full transition-all duration-700"
        style={{ width: `${pct}%`, background: val > 35 ? '#E24B4A' : val > 28 ? '#EF9F27' : '#378ADD' }} />
    </div>
  } else if (unit === 'lux') {
    display = `${Math.round(val)} lx`
    color   = 'text-claw-amber'
    bar     = <div className="mt-2 h-1.5 rounded-full bg-claw-muted overflow-hidden">
      <div className="h-full rounded-full bg-claw-amber transition-all duration-700"
        style={{ width: `${Math.min(100, (val / 600) * 100)}%` }} />
    </div>
  } else {
    display = String(val)
  }

  return (
    <div className={`p-4 rounded-xl border transition-all duration-300
      ${alert ? 'border-red-500/30 bg-red-500/5' : 'border-claw-border bg-claw-surface'}`}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-claw-sub text-xs font-body">{name}</span>
        <span className={`w-1.5 h-1.5 rounded-full transition-colors
          ${val && val !== 'idle' ? 'bg-claw-accent' : 'bg-claw-muted'}`} />
      </div>
      <p className={`text-base font-body font-medium transition-colors duration-300 ${color}`}>
        {display}
      </p>
      {bar}
    </div>
  )
}

// ── Device card ───────────────────────────────────────────────────────────────
function DeviceCard({ topic, data, onToggle }) {
  const name    = data.label || topic.split('/')[1]
  const isState = data.unit === 'state'
  const isOn    = isState ? data.value !== 'idle' : data.value === true

  return (
    <div className={`p-4 rounded-xl border transition-all duration-300
      ${isOn ? 'border-claw-accent/30 bg-claw-accent/5' : 'border-claw-border bg-claw-surface'}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-claw-text text-sm font-body font-medium">{name}</p>
          <p className={`text-xs font-body mt-0.5 transition-colors
            ${isOn ? 'text-claw-accent' : 'text-claw-sub'}`}>
            {isState ? String(data.value) : isOn ? 'On' : 'Off'}
          </p>
        </div>
        {!isState && (
          <button onClick={() => onToggle(topic, !isOn)}
            className={`w-11 h-6 rounded-full border relative transition-all duration-200
              ${isOn ? 'bg-claw-accent/20 border-claw-accent/40' : 'bg-claw-muted border-claw-border'}`}>
            <span className={`absolute top-0.5 w-5 h-5 rounded-full transition-all duration-200
              ${isOn ? 'left-5 bg-claw-accent' : 'left-0.5 bg-claw-sub'}`} />
          </button>
        )}
      </div>
    </div>
  )
}

// ── Log row ───────────────────────────────────────────────────────────────────
function LogRow({ entry }) {
  const time   = entry.ts?.split('T')[1]?.split('.')[0] || ''
  const isOk   = entry.status === 'ok'
  const source = entry.detail?.includes('hardware') ? 'hw' :
                 entry.detail?.includes('sim')       ? 'sim' :
                 entry.workflow === 'gemini'          ? 'ai' :
                 entry.workflow === 'manual'          ? 'ui' : ''
  const srcColor = { hw: 'text-claw-blue', sim: 'text-claw-sub', ai: 'text-purple-400', ui: 'text-claw-amber' }

  return (
    <div className="flex items-start gap-2.5 py-2 border-b border-claw-border/40 last:border-0">
      <span className={`text-xs font-mono shrink-0 mt-0.5 ${isOk ? 'text-claw-accent' : 'text-red-400'}`}>
        {isOk ? '✓' : '✗'}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-claw-text text-xs font-body font-medium truncate">{entry.workflow}</span>
          <span className="text-claw-border text-xs">·</span>
          <span className="text-claw-sub text-xs font-body truncate">{entry.action}</span>
          {source && (
            <span className={`text-xs font-mono px-1.5 py-0 rounded-full bg-claw-muted ${srcColor[source]}`}>
              {source}
            </span>
          )}
        </div>
        {entry.detail && !entry.detail.includes('hardware') && !entry.detail.includes('sim') && (
          <p className="text-claw-sub text-xs font-body mt-0.5 truncate">{entry.detail}</p>
        )}
      </div>
      <span className="text-claw-sub text-xs font-mono shrink-0">{time}</span>
    </div>
  )
}

// ── Main Dashboard ────────────────────────────────────────────────────────────
export default function Dashboard() {
  const [state, setState]             = useState({})
  const [execLog, setExecLog]         = useState([])
  const [notifications, setNotifs]    = useState([])
  const [dismissed, setDismissed]     = useState(new Set())
  const [loading, setLoading]         = useState(true)
  const [lastRefresh, setLastRefresh] = useState(null)
  const [wsStatus, setWsStatus]       = useState('connecting') // connecting | live | polling
  const [logFilter, setLogFilter]     = useState('all')  // all | ok | error
  const wsRef = useRef(null)

  // Fallback REST poll
  const restPoll = useCallback(async () => {
    try {
      const [s, l, n] = await Promise.all([api.getState(), api.getExecLog(), api.getNotifications()])
      setState(s?.devices ?? s); setExecLog(l); setNotifs(n)
      setLastRefresh(new Date().toLocaleTimeString())
      setLoading(false)
    } catch { setLoading(false) }
  }, [])

  // WebSocket setup
  useEffect(() => {
    let pollInterval = null

    function connect() {
      try {
        const ws = new WebSocket(WS_URL)
        wsRef.current = ws

        ws.onopen = () => {
          setWsStatus('live')
          if (pollInterval) { clearInterval(pollInterval); pollInterval = null }
          // Still fetch logs/notifs via REST (WS only pushes state)
          restPoll()
          const logInterval = setInterval(async () => {
            const [l, n] = await Promise.all([api.getExecLog(), api.getNotifications()])
            setExecLog(l); setNotifs(n)
            setLastRefresh(new Date().toLocaleTimeString())
          }, 2000)
          ws._logInterval = logInterval
        }

        ws.onmessage = (e) => {
          try {
            const msg = JSON.parse(e.data)
            if (msg.type === 'state') {
              setState(msg.data?.devices ?? msg.data)
              setLastRefresh(new Date().toLocaleTimeString())
              setLoading(false)
            }
          } catch {}
        }

        ws.onclose = () => {
          setWsStatus('polling')
          if (ws._logInterval) clearInterval(ws._logInterval)
          // Fall back to REST polling
          pollInterval = setInterval(restPoll, 2000)
        }

        ws.onerror = () => {
          setWsStatus('polling')
          ws.close()
        }
      } catch {
        setWsStatus('polling')
        pollInterval = setInterval(restPoll, 2000)
      }
    }

    restPoll()  // immediate first load
    connect()

    return () => {
      if (wsRef.current) {
        if (wsRef.current._logInterval) clearInterval(wsRef.current._logInterval)
        wsRef.current.close()
      }
      if (pollInterval) clearInterval(pollInterval)
    }
  }, [restPoll])

  async function toggleDevice(topic, value) {
    await api.controlDevice(topic, value)
    // Optimistic update
    setState(prev => ({
      ...prev,
      [topic]: { ...prev[topic], value }
    }))
  }

  function dismissNotif(i) {
    setDismissed(prev => new Set([...prev, i]))
  }

  const sensors  = Object.entries(state).filter(([k]) => k.startsWith('sensor/'))
  const devices  = Object.entries(state).filter(([k]) => k.startsWith('device/'))
  const visibleNotifs = notifications
    .map((n, i) => ({ ...n, _i: i }))
    .filter(n => !dismissed.has(n._i))
    .slice(0, 5)

  const filteredLog = execLog.filter(e =>
    logFilter === 'all' ? true :
    logFilter === 'ok'  ? e.status === 'ok' :
    e.status !== 'ok'
  )

  const wsColor = { live: 'bg-claw-accent', polling: 'bg-claw-amber', connecting: 'bg-claw-sub' }

  return (
    <div className="flex flex-col h-full overflow-hidden bg-claw-bg">

      {/* Header */}
      <div className="px-6 py-4 border-b border-claw-border bg-claw-surface/50 shrink-0
        flex items-center justify-between">
        <div>
          <h2 className="font-display text-lg text-claw-text">Dashboard</h2>
          <p className="text-claw-sub text-xs font-body mt-0.5">
            {lastRefresh ? `Updated ${lastRefresh}` : 'Loading…'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${wsColor[wsStatus]}
              ${wsStatus === 'live' ? 'animate-pulse' : ''}`} />
            <span className="text-claw-sub text-xs font-body">
              {wsStatus === 'live' ? 'Real-time' : wsStatus === 'polling' ? 'Polling' : 'Connecting'}
            </span>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-hidden flex">

        {/* Left column — sensors + devices */}
        <div className="w-80 shrink-0 border-r border-claw-border overflow-y-auto px-4 py-4 space-y-5">

          {loading ? (
            <div className="flex items-center justify-center h-40">
              <div className="flex gap-1.5">
                {[0,1,2].map(i => (
                  <span key={i} className="w-1.5 h-1.5 rounded-full bg-claw-sub animate-pulse_dot"
                    style={{ animationDelay: `${i*0.2}s` }} />
                ))}
              </div>
            </div>
          ) : (
            <>
              {/* Notifications */}
              {visibleNotifs.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-claw-sub text-xs font-body uppercase tracking-widest">Alerts</p>
                  {visibleNotifs.map(n => (
                    <div key={n._i} className="px-3 py-2.5 rounded-xl border border-claw-amber/30
                      bg-claw-amber/5 flex items-start gap-2 animate-fadeup">
                      <span className="text-claw-amber text-xs shrink-0 mt-0.5">⚑</span>
                      <span className="text-claw-text text-xs font-body flex-1 leading-relaxed">
                        {n.message}
                      </span>
                      <button onClick={() => dismissNotif(n._i)}
                        className="text-claw-sub hover:text-claw-text text-xs shrink-0 mt-0.5
                          transition-colors">
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Sensors */}
              <div>
                <p className="text-claw-sub text-xs font-body uppercase tracking-widest mb-2">Sensors</p>
                <div className="space-y-2">
                  {sensors.map(([t, d]) => <SensorCard key={t} topic={t} data={d} />)}
                </div>
              </div>

              {/* Devices */}
              <div>
                <p className="text-claw-sub text-xs font-body uppercase tracking-widest mb-2">Devices</p>
                <div className="space-y-2">
                  {devices.map(([t, d]) => (
                    <DeviceCard key={t} topic={t} data={d} onToggle={toggleDevice} />
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Right column — execution log */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="px-5 py-3 border-b border-claw-border shrink-0 flex items-center justify-between">
            <p className="text-claw-sub text-xs font-body uppercase tracking-widest">Execution log</p>
            <div className="flex gap-1">
              {['all','ok','error'].map(f => (
                <button key={f} onClick={() => setLogFilter(f)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-body transition-all
                    ${logFilter === f
                      ? 'bg-claw-muted text-claw-text border border-claw-border'
                      : 'text-claw-sub hover:text-claw-text'}`}>
                  {f}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-2">
            {filteredLog.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 gap-2 text-center">
                <span className="text-3xl text-claw-border">◎</span>
                <p className="text-claw-sub text-sm font-body">
                  {logFilter === 'all'
                    ? 'No executions yet — enable a workflow to see activity.'
                    : `No ${logFilter} entries.`}
                </p>
              </div>
            ) : (
              filteredLog.slice(0, 50).map((e, i) => <LogRow key={i} entry={e} />)
            )}
          </div>
        </div>

      </div>
    </div>
  )
}
