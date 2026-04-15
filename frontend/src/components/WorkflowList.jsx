import React, { useEffect, useState } from 'react'
import { api } from '../api.js'

const TRIGGER_ICONS  = { mqtt_event: '⬡', time: '◷', manual: '▷' }
const TRIGGER_LABELS = { mqtt_event: 'MQTT', time: 'Scheduled', manual: 'Manual' }

export default function WorkflowList({ onEdit, onNew, refreshKey }) {
  const [workflows, setWorkflows] = useState([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState(null)
  const [running, setRunning]     = useState(null)  // id currently being run
  const [runFlash, setRunFlash]   = useState(null)  // id that just ran
  const [search, setSearch]       = useState('')

  useEffect(() => {
    setLoading(true)
    api.listWorkflows()
      .then(setWorkflows)
      .catch(() => setError('Could not reach backend'))
      .finally(() => setLoading(false))
  }, [refreshKey])

  async function handleToggle(e, wf) {
    e.stopPropagation()
    const updated = await api.toggleWorkflow(wf.id)
    setWorkflows(prev => prev.map(w => w.id === wf.id ? { ...w, enabled: updated.enabled } : w))
  }

  async function handleRun(e, wf) {
    e.stopPropagation()
    setRunning(wf.id)
    try {
      await api.runWorkflow(wf.id)
      setRunFlash(wf.id)
      setTimeout(() => setRunFlash(null), 2000)
    } catch (err) {
      alert(`Run failed: ${err.message}`)
    } finally {
      setRunning(null)
    }
  }

  async function handleExport(e, wf) {
    e.stopPropagation()
    try {
      const data = await fetch(`http://localhost:8000/workflows/${wf.id}/export`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('openclaw_token')}` }
      }).then(r => r.json())
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = `${wf.name.replace(/\s+/g, '_').toLowerCase()}.json`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      alert(`Export failed: ${err.message}`)
    }
  }

  async function handleDelete(e, wf) {
    e.stopPropagation()
    if (!confirm(`Delete "${wf.name}"?`)) return
    await api.deleteWorkflow(wf.id)
    setWorkflows(prev => prev.filter(w => w.id !== wf.id))
  }

  return (
    <div className="flex flex-col h-full bg-claw-bg">
      <div className="flex items-center justify-between px-6 py-5 border-b border-claw-border bg-claw-surface/50 shrink-0">
        <div>
          <h2 className="font-display text-lg text-claw-text">Workflows</h2>
          <p className="text-claw-sub text-xs font-body mt-0.5">
            {workflows.length} saved automation{workflows.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button onClick={onNew}
          className="px-4 py-2 rounded-xl bg-claw-amber/15 border border-claw-amber/30
            text-claw-amber text-sm font-body font-medium hover:bg-claw-amber/25 transition-all">
          + New
        </button>
      </div>
      {/* Search */}
      <div className="px-4 py-2 border-b border-claw-border">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search workflows…"
          className="w-full bg-claw-bg border border-claw-border rounded-xl px-3 py-2
            text-sm font-body text-claw-text placeholder-claw-sub
            focus:outline-none focus:border-claw-muted transition-colors"
        />
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
        {loading && (
          <div className="flex items-center justify-center h-32">
            <div className="flex gap-1.5">
              {[0,1,2].map(i => (
                <span key={i} className="w-1.5 h-1.5 rounded-full bg-claw-sub animate-pulse_dot"
                  style={{ animationDelay: `${i*0.2}s` }} />
              ))}
            </div>
          </div>
        )}

        {error && (
          <div className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-body">
            {error}
          </div>
        )}

        {!loading && !error && workflows.length === 0 && (
          <div className="flex flex-col items-center justify-center h-48 gap-3 text-center">
            <span className="text-3xl text-claw-border">⬡</span>
            <p className="text-claw-sub text-sm font-body">
              No workflows yet.<br />Create one or ask the AI in chat.
            </p>
          </div>
        )}

        {workflows.filter(wf => !search || wf.name.toLowerCase().includes(search.toLowerCase()) || (wf.description || '').toLowerCase().includes(search.toLowerCase())).map(wf => (
          <div
            key={wf.id}
            onClick={() => onEdit(wf)}
            className={`group px-4 py-3.5 rounded-xl border cursor-pointer
              transition-all duration-150 animate-fadeup
              ${runFlash === wf.id
                ? 'border-claw-accent/40 bg-claw-accent/5'
                : 'border-claw-border bg-claw-surface hover:border-claw-amber/30 hover:bg-claw-muted/20'
              }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-claw-amber text-xs font-mono">
                    {TRIGGER_ICONS[wf.trigger?.type] || '▷'}
                  </span>
                  <span className="text-claw-text text-sm font-body font-medium truncate">
                    {wf.name}
                  </span>
                  <span className="text-claw-sub text-xs font-mono shrink-0">v{wf.version}</span>
                  {runFlash === wf.id && (
                    <span className="text-claw-accent text-xs font-body animate-fadeup shrink-0">
                      ✓ triggered
                    </span>
                  )}
                </div>

                {wf.description && (
                  <p className="text-claw-sub text-xs font-body truncate mb-2">{wf.description}</p>
                )}

                <div className="flex items-center gap-3 flex-wrap">
                  <span className="text-claw-sub text-xs font-body">
                    {TRIGGER_LABELS[wf.trigger?.type] || 'Manual'}
                  </span>
                  <span className="text-claw-border text-xs">·</span>
                  <span className="text-claw-sub text-xs font-body">
                    {wf.actions?.length || 0} action{(wf.actions?.length || 0) !== 1 ? 's' : ''}
                  </span>
                  {(wf.conditions?.length || 0) > 0 && (
                    <>
                      <span className="text-claw-border text-xs">·</span>
                      <span className="text-claw-sub text-xs font-body">
                        {wf.conditions.length} condition{wf.conditions.length !== 1 ? 's' : ''}
                      </span>
                    </>
                  )}
                </div>
              </div>

              {/* Controls */}
              <div className="flex items-center gap-1.5 shrink-0">
                {/* Run now */}
                <button
                  onClick={e => handleRun(e, wf)}
                  disabled={running === wf.id}
                  title="Run now"
                  className="opacity-0 group-hover:opacity-100 w-7 h-7 rounded-lg
                    flex items-center justify-center text-claw-sub hover:text-claw-accent
                    hover:bg-claw-accent/10 transition-all text-xs disabled:opacity-30"
                >
                  {running === wf.id ? '…' : '▷'}
                </button>

                {/* Export */}
                <button
                  onClick={e => handleExport(e, wf)}
                  title="Export as JSON"
                  className="opacity-0 group-hover:opacity-100 w-7 h-7 rounded-lg
                    flex items-center justify-center text-claw-sub hover:text-claw-amber
                    hover:bg-claw-amber/10 transition-all text-xs"
                >
                  ↓
                </button>

                {/* Enable/disable toggle */}
                <button
                  onClick={e => handleToggle(e, wf)}
                  className={`w-9 h-5 rounded-full border transition-all duration-200 relative
                    ${wf.enabled
                      ? 'bg-claw-accent/20 border-claw-accent/40'
                      : 'bg-claw-muted border-claw-border'
                    }`}
                >
                  <span className={`absolute top-0.5 w-4 h-4 rounded-full transition-all duration-200
                    ${wf.enabled ? 'left-4 bg-claw-accent' : 'left-0.5 bg-claw-sub'}`} />
                </button>

                {/* Delete */}
                <button
                  onClick={e => handleDelete(e, wf)}
                  title="Delete"
                  className="opacity-0 group-hover:opacity-100 w-7 h-7 rounded-lg
                    flex items-center justify-center text-claw-sub hover:text-red-400
                    hover:bg-red-500/10 transition-all text-xs"
                >
                  ✕
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
