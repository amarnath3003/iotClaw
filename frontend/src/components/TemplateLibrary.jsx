import React, { useState, useEffect } from 'react'
import { api } from '../api.js'

const CATEGORIES = ['All', 'Home', 'Climate', 'Security', 'Garden', 'Robotics']

const CATEGORY_COLORS = {
  Home:     { badge: 'bg-claw-purple/10 text-purple-400 border-purple-400/20',  dot: 'bg-purple-400' },
  Climate:  { badge: 'bg-claw-blue/10 text-claw-blue border-claw-blue/20',      dot: 'bg-claw-blue' },
  Security: { badge: 'bg-red-500/10 text-red-400 border-red-400/20',            dot: 'bg-red-400' },
  Garden:   { badge: 'bg-green-500/10 text-green-400 border-green-400/20',      dot: 'bg-green-400' },
  Robotics: { badge: 'bg-claw-amber/10 text-claw-amber border-claw-amber/20',   dot: 'bg-claw-amber' },
}

const TRIGGER_LABEL = {
  mqtt_event: 'Sensor event',
  time: 'Scheduled',
  manual: 'Manual',
}

function TemplateCard({ template, onActivate, activating }) {
  const colors = CATEGORY_COLORS[template.category] || CATEGORY_COLORS.Home
  const actionCount  = template.actions?.length || 0
  const condCount    = template.conditions?.length || 0
  const triggerLabel = TRIGGER_LABEL[template.trigger?.type] || 'Manual'

  return (
    <div className="group flex flex-col p-5 rounded-2xl border border-claw-border
      bg-claw-surface hover:border-claw-muted transition-all duration-200 animate-fadeup">

      {/* Top row */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="w-9 h-9 rounded-xl bg-claw-muted flex items-center justify-center shrink-0">
          <span className="text-claw-sub font-mono text-base">{template.icon}</span>
        </div>
        <span className={`text-xs font-body px-2 py-0.5 rounded-full border ${colors.badge}`}>
          {template.category}
        </span>
      </div>

      {/* Name + description */}
      <h3 className="text-claw-text text-sm font-body font-medium mb-1">{template.name}</h3>
      <p className="text-claw-sub text-xs font-body leading-relaxed flex-1 mb-4">
        {template.description}
      </p>

      {/* Meta chips */}
      <div className="flex items-center gap-2 flex-wrap mb-4">
        <span className="px-2 py-0.5 rounded-full bg-claw-muted text-claw-sub text-xs font-body">
          {triggerLabel}
        </span>
        <span className="px-2 py-0.5 rounded-full bg-claw-muted text-claw-sub text-xs font-body">
          {actionCount} action{actionCount !== 1 ? 's' : ''}
        </span>
        {condCount > 0 && (
          <span className="px-2 py-0.5 rounded-full bg-claw-muted text-claw-sub text-xs font-body">
            {condCount} condition{condCount !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Activate button */}
      <button
        onClick={() => onActivate(template)}
        disabled={activating === template.id}
        className="w-full py-2 rounded-xl border border-claw-amber/30 bg-claw-amber/10
          text-claw-amber text-xs font-body font-medium
          hover:bg-claw-amber/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {activating === template.id ? 'Adding…' : '+ Use this template'}
      </button>
    </div>
  )
}

function FlowPreview({ template }) {
  if (!template) return null
  const trigger    = template.trigger
  const conditions = template.conditions || []
  const actions    = template.actions || []
  const nodeBase   = "px-3 py-1.5 rounded-lg text-xs font-body font-medium w-full text-center"
  const arrow      = <div className="w-px h-3 bg-claw-border mx-auto" />

  return (
    <div className="flex flex-col items-stretch gap-0 p-4">
      <p className="text-claw-sub text-xs font-body uppercase tracking-widest mb-3">Flow</p>
      <div className={`${nodeBase} border border-claw-amber/40 bg-claw-amber/10 text-claw-amber`}>
        {trigger.type === 'mqtt_event' ? trigger.topic || 'Sensor event'
          : trigger.type === 'time' ? 'Scheduled'
          : 'Manual'}
      </div>
      {conditions.map((c, i) => (
        <React.Fragment key={i}>
          {arrow}
          <div className={`${nodeBase} border border-claw-blue/30 bg-claw-blue/10 text-claw-blue`}>
            {c.type === 'time' ? `${c.after}–${c.before}`
              : c.type === 'numeric' ? `${c.field} ${c.operator} ${c.value}`
              : `${c.field} = ${c.value}`}
          </div>
        </React.Fragment>
      ))}
      {actions.map((a, i) => (
        <React.Fragment key={i}>
          {arrow}
          <div className={`${nodeBase} border border-claw-accent/30 bg-claw-accent/10 text-claw-accent`}>
            {a.type === 'device_control' ? `${a.device} → ${a.command}`
              : a.type === 'delay' ? `wait ${a.seconds}s`
              : a.type === 'notify' ? 'notify'
              : `robot → ${a.command}`}
          </div>
        </React.Fragment>
      ))}
    </div>
  )
}

export default function TemplateLibrary({ onActivated }) {
  const [templates, setTemplates] = useState([])
  const [loading, setLoading]     = useState(true)
  const [category, setCategory]   = useState('All')
  const [search, setSearch]       = useState('')
  const [activating, setActivating] = useState(null)
  const [justAdded, setJustAdded]   = useState(null)
  const [preview, setPreview]       = useState(null)

  useEffect(() => {
    api.listTemplates()
      .then(setTemplates)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  async function handleActivate(template) {
    setActivating(template.id)
    try {
      await api.activateTemplate(template.id)
      setJustAdded(template.id)
      setTimeout(() => setJustAdded(null), 2500)
      if (onActivated) onActivated()
    } catch {
      alert('Failed to activate template. Is the backend running?')
    } finally {
      setActivating(null)
    }
  }

  const visible = templates
    .filter(t => category === 'All' || t.category === category)
    .filter(t =>
      !search ||
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.description.toLowerCase().includes(search.toLowerCase())
    )

  return (
    <div className="flex h-full overflow-hidden">
      {/* Main panel */}
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-5 border-b border-claw-border bg-claw-surface/50 shrink-0">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-display text-lg text-claw-text">Template library</h2>
              <p className="text-claw-sub text-xs font-body mt-0.5">
                {templates.length} ready-made automations — activate in one click
              </p>
            </div>
            {justAdded && (
              <div className="px-4 py-2 rounded-xl border border-claw-accent/30
                bg-claw-accent/10 text-claw-accent text-xs font-body animate-fadeup">
                ✓ Added to your workflows
              </div>
            )}
          </div>

          {/* Search */}
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search templates…"
            className="w-full bg-claw-bg border border-claw-border rounded-xl px-4 py-2.5
              text-sm font-body text-claw-text placeholder-claw-sub
              focus:outline-none focus:border-claw-muted transition-colors mb-3"
          />

          {/* Category pills */}
          <div className="flex gap-2 flex-wrap">
            {CATEGORIES.map(c => (
              <button key={c} onClick={() => setCategory(c)}
                className={`px-3 py-1.5 rounded-full text-xs font-body font-medium border transition-all
                  ${category === c
                    ? 'bg-claw-amber/15 border-claw-amber/30 text-claw-amber'
                    : 'border-claw-border text-claw-sub hover:border-claw-muted hover:text-claw-text'
                  }`}>
                {c}
              </button>
            ))}
          </div>
        </div>

        {/* Grid */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {loading ? (
            <div className="flex items-center justify-center h-40">
              <div className="flex gap-1.5">
                {[0,1,2].map(i => (
                  <span key={i} className="w-1.5 h-1.5 rounded-full bg-claw-sub animate-pulse_dot"
                    style={{ animationDelay: `${i*0.2}s` }} />
                ))}
              </div>
            </div>
          ) : visible.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 gap-2 text-center">
              <span className="text-3xl text-claw-border">⬡</span>
              <p className="text-claw-sub text-sm font-body">No templates match your search.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              {visible.map(t => (
                <div key={t.id} onClick={() => setPreview(t)} className="cursor-pointer">
                  <TemplateCard
                    template={t}
                    activating={activating}
                    onActivate={e => { e.stopPropagation?.(); handleActivate(t) }}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right: flow preview panel */}
      <div className="w-52 border-l border-claw-border bg-claw-surface shrink-0 flex flex-col overflow-hidden">
        {preview ? (
          <>
            <div className="px-4 py-3 border-b border-claw-border flex items-center justify-between">
              <p className="text-claw-text text-xs font-body font-medium truncate">{preview.name}</p>
              <button onClick={() => setPreview(null)} className="text-claw-sub hover:text-claw-text text-xs">✕</button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <FlowPreview template={preview} />
            </div>
            <div className="p-3 border-t border-claw-border">
              <button
                onClick={() => handleActivate(preview)}
                disabled={activating === preview.id}
                className="w-full py-2 rounded-xl bg-claw-amber/15 border border-claw-amber/30
                  text-claw-amber text-xs font-body font-medium hover:bg-claw-amber/25
                  transition-all disabled:opacity-50"
              >
                {activating === preview.id ? 'Adding…' : '+ Activate'}
              </button>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full p-4 text-center">
            <span className="text-2xl text-claw-border mb-2">◎</span>
            <p className="text-claw-sub text-xs font-body leading-relaxed">
              Click a template to preview its flow
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
