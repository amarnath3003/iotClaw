import React, { useState } from 'react'
import { api } from '../api.js'

// ── Constants ─────────────────────────────────────────────────────────────────

const TRIGGER_TYPES = [
  { id: 'mqtt_event', label: 'MQTT event',    icon: '⬡', desc: 'Fires when a sensor publishes' },
  { id: 'time',       label: 'Time trigger',  icon: '◷', desc: 'Fires on a schedule' },
  { id: 'manual',     label: 'Manual',        icon: '▷', desc: 'Triggered by hand' },
]

const ACTION_TYPES = [
  { id: 'device_control', label: 'Device control', icon: '⚙' },
  { id: 'delay',          label: 'Delay',           icon: '⏱' },
  { id: 'notify',         label: 'Notify user',     icon: '🔔' },
  { id: 'robot_move',     label: 'Robot move',      icon: '⬡' },
]

const CONDITION_TYPES = [
  { id: 'time',    label: 'Time window' },
  { id: 'numeric', label: 'Numeric check' },
  { id: 'state',   label: 'Device state' },
]

const BLANK_WORKFLOW = {
  name: '',
  description: '',
  enabled: true,
  trigger: { type: 'manual', topic: '', condition: '' },
  conditions: [],
  actions: [],
  error_policy: { retry_count: 2, on_failure: 'notify_user' },
}

// ── Small reusable UI bits ────────────────────────────────────────────────────

function Field({ label, children }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-body text-claw-sub uppercase tracking-widest">{label}</label>
      {children}
    </div>
  )
}

function Input({ value, onChange, placeholder, className = '' }) {
  return (
    <input
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className={`w-full bg-claw-bg border border-claw-border rounded-xl px-3 py-2.5
        text-sm font-body text-claw-text placeholder-claw-sub
        focus:outline-none focus:border-claw-muted transition-colors ${className}`}
    />
  )
}

function Select({ value, onChange, options }) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="w-full bg-claw-bg border border-claw-border rounded-xl px-3 py-2.5
        text-sm font-body text-claw-text focus:outline-none focus:border-claw-muted
        transition-colors appearance-none cursor-pointer"
    >
      {options.map(o => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  )
}

// ── Trigger editor ────────────────────────────────────────────────────────────

function TriggerEditor({ trigger, onChange }) {
  function set(key, val) { onChange({ ...trigger, [key]: val }) }

  return (
    <div className="space-y-3">
      <Field label="Trigger type">
        <div className="grid grid-cols-3 gap-2">
          {TRIGGER_TYPES.map(t => (
            <button
              key={t.id}
              onClick={() => set('type', t.id)}
              className={`px-3 py-2.5 rounded-xl border text-left transition-all
                ${trigger.type === t.id
                  ? 'border-claw-amber/40 bg-claw-amber/10 text-claw-amber'
                  : 'border-claw-border bg-claw-bg text-claw-sub hover:border-claw-muted'
                }`}
            >
              <div className="text-base font-mono mb-0.5">{t.icon}</div>
              <div className="text-xs font-body font-medium">{t.label}</div>
            </button>
          ))}
        </div>
      </Field>

      {trigger.type === 'mqtt_event' && (
        <>
          <Field label="MQTT topic">
            <Input value={trigger.topic || ''} onChange={v => set('topic', v)} placeholder="sensors/motion" />
          </Field>
          <Field label="Condition (optional)">
            <Input value={trigger.condition || ''} onChange={v => set('condition', v)} placeholder="payload == 'detected'" />
          </Field>
        </>
      )}
      {trigger.type === 'time' && (
        <Field label="Cron expression">
          <Input value={trigger.cron || ''} onChange={v => set('cron', v)} placeholder="0 7 * * * (daily at 7am)" />
        </Field>
      )}
    </div>
  )
}

// ── Condition editor ──────────────────────────────────────────────────────────

function ConditionRow({ cond, onChange, onRemove }) {
  function set(key, val) { onChange({ ...cond, [key]: val }) }

  return (
    <div className="p-3 rounded-xl border border-claw-border bg-claw-bg space-y-2.5">
      <div className="flex items-center justify-between">
        <Select
          value={cond.type}
          onChange={v => set('type', v)}
          options={CONDITION_TYPES.map(c => ({ value: c.id, label: c.label }))}
        />
        <button onClick={onRemove} className="ml-2 w-6 h-6 rounded-lg text-claw-sub hover:text-red-400
          hover:bg-red-500/10 text-xs flex items-center justify-center transition-all shrink-0">✕</button>
      </div>

      {cond.type === 'time' && (
        <div className="grid grid-cols-2 gap-2">
          <Field label="After">
            <Input value={cond.after || ''} onChange={v => set('after', v)} placeholder="22:00" />
          </Field>
          <Field label="Before">
            <Input value={cond.before || ''} onChange={v => set('before', v)} placeholder="06:00" />
          </Field>
        </div>
      )}
      {cond.type === 'numeric' && (
        <div className="grid grid-cols-3 gap-2">
          <Field label="Field">
            <Input value={cond.field || ''} onChange={v => set('field', v)} placeholder="temperature" />
          </Field>
          <Field label="Operator">
            <Select value={cond.operator || 'gt'} onChange={v => set('operator', v)}
              options={[
                { value: 'gt', label: '> greater' },
                { value: 'lt', label: '< less' },
                { value: 'gte', label: '>= gte' },
                { value: 'lte', label: '<= lte' },
                { value: 'eq', label: '= equal' },
              ]} />
          </Field>
          <Field label="Value">
            <Input value={cond.value || ''} onChange={v => set('value', v)} placeholder="30" />
          </Field>
        </div>
      )}
      {cond.type === 'state' && (
        <div className="grid grid-cols-2 gap-2">
          <Field label="Device">
            <Input value={cond.field || ''} onChange={v => set('field', v)} placeholder="fan_bedroom" />
          </Field>
          <Field label="State">
            <Input value={cond.value || ''} onChange={v => set('value', v)} placeholder="off" />
          </Field>
        </div>
      )}
    </div>
  )
}

// ── Action editor ─────────────────────────────────────────────────────────────

function ActionRow({ action, index, onChange, onRemove, total, onMove }) {
  function set(key, val) { onChange({ ...action, [key]: val }) }

  return (
    <div className="p-3 rounded-xl border border-claw-border bg-claw-bg space-y-2.5">
      <div className="flex items-center gap-2">
        <div className="flex flex-col gap-0.5 shrink-0">
          <button onClick={() => onMove(index, -1)} disabled={index === 0}
            className="w-5 h-4 text-claw-sub hover:text-claw-text disabled:opacity-20 text-xs leading-none">▲</button>
          <button onClick={() => onMove(index, 1)} disabled={index === total - 1}
            className="w-5 h-4 text-claw-sub hover:text-claw-text disabled:opacity-20 text-xs leading-none">▼</button>
        </div>
        <span className="w-6 h-6 rounded-lg bg-claw-muted flex items-center justify-center
          text-xs font-mono text-claw-sub shrink-0">{index + 1}</span>
        <div className="flex-1">
          <Select
            value={action.type}
            onChange={v => set('type', v)}
            options={ACTION_TYPES.map(a => ({ value: a.id, label: `${a.icon}  ${a.label}` }))}
          />
        </div>
        <button onClick={onRemove} className="w-6 h-6 rounded-lg text-claw-sub hover:text-red-400
          hover:bg-red-500/10 text-xs flex items-center justify-center transition-all shrink-0">✕</button>
      </div>

      {action.type === 'device_control' && (
        <div className="grid grid-cols-2 gap-2">
          <Field label="Device">
            <Input value={action.device || ''} onChange={v => set('device', v)} placeholder="light_bedroom" />
          </Field>
          <Field label="Command">
            <Input value={action.command || ''} onChange={v => set('command', v)} placeholder="on / off / toggle" />
          </Field>
        </div>
      )}
      {action.type === 'delay' && (
        <Field label="Seconds">
          <Input value={action.seconds || ''} onChange={v => set('seconds', parseInt(v) || 0)} placeholder="300" />
        </Field>
      )}
      {action.type === 'notify' && (
        <Field label="Message">
          <Input value={action.message || ''} onChange={v => set('message', v)} placeholder="Temperature too high!" />
        </Field>
      )}
      {action.type === 'robot_move' && (
        <div className="grid grid-cols-2 gap-2">
          <Field label="Command">
            <Select value={action.command || 'forward'} onChange={v => set('command', v)}
              options={[
                { value: 'forward', label: 'Forward' },
                { value: 'backward', label: 'Backward' },
                { value: 'turn_left', label: 'Turn left' },
                { value: 'turn_right', label: 'Turn right' },
                { value: 'stop', label: 'Stop' },
              ]} />
          </Field>
          <Field label="Duration (ms)">
            <Input value={action.params?.duration || ''} onChange={v => set('params', { ...action.params, duration: parseInt(v) || 1000 })} placeholder="1000" />
          </Field>
        </div>
      )}
    </div>
  )
}

// ── Workflow flow preview (mini visual) ───────────────────────────────────────

function FlowPreview({ workflow }) {
  const trigger = workflow.trigger
  const conditions = workflow.conditions || []
  const actions = workflow.actions || []

  const nodeClass = "px-3 py-1.5 rounded-lg border text-xs font-body font-medium"
  const arrow = <div className="w-px h-4 bg-claw-border mx-auto" />

  return (
    <div className="flex flex-col items-center py-3 px-4 gap-0 min-w-[180px]">
      {/* Trigger */}
      <div className={`${nodeClass} border-claw-amber/40 bg-claw-amber/10 text-claw-amber`}>
        {trigger.type === 'mqtt_event' ? trigger.topic || 'MQTT event'
          : trigger.type === 'time' ? trigger.cron || 'Time'
          : 'Manual'}
      </div>

      {/* Conditions */}
      {conditions.map((c, i) => (
        <React.Fragment key={i}>
          {arrow}
          <div className={`${nodeClass} border-claw-blue/30 bg-claw-blue/10 text-claw-blue`}>
            {c.type === 'time' ? `${c.after}–${c.before}`
              : c.type === 'numeric' ? `${c.field} ${c.operator} ${c.value}`
              : `${c.field} = ${c.value}`}
          </div>
        </React.Fragment>
      ))}

      {/* Actions */}
      {actions.map((a, i) => (
        <React.Fragment key={i}>
          {arrow}
          <div className={`${nodeClass} border-claw-accent/30 bg-claw-accent/10 text-claw-accent`}>
            {a.type === 'device_control' ? `${a.device} → ${a.command}`
              : a.type === 'delay' ? `wait ${a.seconds}s`
              : a.type === 'notify' ? 'notify'
              : a.command || 'robot'}
          </div>
        </React.Fragment>
      ))}

      {actions.length === 0 && conditions.length === 0 && (
        <>{arrow}<div className="text-claw-sub text-xs font-body italic">add actions below</div></>
      )}
    </div>
  )
}

// ── Main WorkflowEditor ───────────────────────────────────────────────────────

export default function WorkflowEditor({ initial, onSaved, onCancel }) {
  const isNew = !initial?.id
  const [wf, setWf] = useState(initial || BLANK_WORKFLOW)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState(null)
  const [running, setRunning] = useState(false)
  const [runMsg, setRunMsg] = useState(null)

  function setField(key, val) { setWf(prev => ({ ...prev, [key]: val })) }

  function addCondition() {
    setField('conditions', [...(wf.conditions || []), { type: 'time', after: '', before: '' }])
  }

  function updateCondition(i, val) {
    const updated = [...wf.conditions]
    updated[i] = val
    setField('conditions', updated)
  }

  function removeCondition(i) {
    setField('conditions', wf.conditions.filter((_, idx) => idx !== i))
  }

  function addAction() {
    setField('actions', [...(wf.actions || []), { type: 'device_control', device: '', command: '' }])
  }

  function updateAction(i, val) {
    const updated = [...wf.actions]
    updated[i] = val
    setField('actions', updated)
  }

  function removeAction(i) {
    setField('actions', wf.actions.filter((_, idx) => idx !== i))
  }

  function moveAction(i, dir) {
    const arr = [...wf.actions]
    const j = i + dir
    if (j < 0 || j >= arr.length) return
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
    setField('actions', arr)
  }

  async function runNow() {
    if (!initial?.id) { setError('Save the workflow first before running'); return }
    setRunning(true); setRunMsg(null)
    try {
      await api.runWorkflow(initial.id)
      setRunMsg('✓ Triggered — check the dashboard')
      setTimeout(() => setRunMsg(null), 3000)
    } catch (err) {
      setError(err.message)
    } finally {
      setRunning(false)
    }
  }

  async function save() {
    if (!wf.name.trim()) { setError('Give your workflow a name first'); return }
    setSaving(true); setError(null)
    try {
      const result = isNew
        ? await api.createWorkflow(wf)
        : await api.updateWorkflow(initial.id, wf)
      setSaved(true)
      setTimeout(() => { setSaved(false); onSaved(result) }, 800)
    } catch {
      setError('Save failed — is the backend running?')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left: form */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-claw-border shrink-0">
          <div className="flex items-center gap-3">
            <button onClick={onCancel} className="text-claw-sub hover:text-claw-text text-sm font-body transition-colors">
              ← Back
            </button>
            <span className="text-claw-border">|</span>
            <span className="text-claw-sub text-xs font-body">{isNew ? 'New workflow' : `Editing v${wf.version || 1}`}</span>
          </div>
          <div className="flex items-center gap-2">
            {error && <span className="text-red-400 text-xs font-body">{error}</span>}
          {runMsg && <span className="text-claw-accent text-xs font-body">{runMsg}</span>}
          {initial?.id && (
            <button
              onClick={runNow}
              disabled={running}
              className="px-4 py-2 rounded-xl text-sm font-body font-medium transition-all
                bg-claw-muted border border-claw-border text-claw-sub hover:text-claw-text
                disabled:opacity-50">
              {running ? '…' : '▷ Run'}
            </button>
          )}
            <button
              onClick={save}
              disabled={saving || saved}
              className={`px-4 py-2 rounded-xl text-sm font-body font-medium transition-all
                ${saved
                  ? 'bg-claw-accent/20 border border-claw-accent/30 text-claw-accent'
                  : 'bg-claw-amber/15 border border-claw-amber/30 text-claw-amber hover:bg-claw-amber/25'
                } disabled:opacity-60`}
            >
              {saved ? '✓ Saved' : saving ? 'Saving…' : isNew ? 'Create workflow' : 'Save changes'}
            </button>
          </div>
        </div>

        {/* Form scroll area */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

          {/* Name + description */}
          <div className="space-y-3">
            <Field label="Workflow name">
              <Input value={wf.name} onChange={v => setField('name', v)} placeholder="Night lighting automation" />
            </Field>
            <Field label="Description (optional)">
              <Input value={wf.description} onChange={v => setField('description', v)} placeholder="Turns lights on when motion detected after 10pm" />
            </Field>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-claw-border" />
            <span className="text-claw-sub text-xs font-body uppercase tracking-widest">Trigger</span>
            <div className="flex-1 h-px bg-claw-border" />
          </div>

          <TriggerEditor trigger={wf.trigger} onChange={v => setField('trigger', v)} />

          {/* Conditions */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-claw-border" />
            <span className="text-claw-sub text-xs font-body uppercase tracking-widest">Conditions</span>
            <div className="flex-1 h-px bg-claw-border" />
          </div>

          <div className="space-y-2">
            {(wf.conditions || []).map((c, i) => (
              <ConditionRow
                key={i} cond={c}
                onChange={v => updateCondition(i, v)}
                onRemove={() => removeCondition(i)}
              />
            ))}
            <button onClick={addCondition}
              className="w-full py-2.5 rounded-xl border border-dashed border-claw-border
                text-claw-sub text-sm font-body hover:border-claw-muted hover:text-claw-text
                transition-all duration-150">
              + Add condition
            </button>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-claw-border" />
            <span className="text-claw-sub text-xs font-body uppercase tracking-widest">Actions</span>
            <div className="flex-1 h-px bg-claw-border" />
          </div>

          <div className="space-y-2">
            {(wf.actions || []).map((a, i) => (
              <ActionRow
                key={i} action={a} index={i}
                total={wf.actions.length}
                onChange={v => updateAction(i, v)}
                onRemove={() => removeAction(i)}
                onMove={(idx, dir) => moveAction(idx, dir)}
              />
            ))}
            <button onClick={addAction}
              className="w-full py-2.5 rounded-xl border border-dashed border-claw-border
                text-claw-sub text-sm font-body hover:border-claw-muted hover:text-claw-text
                transition-all duration-150">
              + Add action
            </button>
          </div>

          {/* Error policy */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-claw-border" />
            <span className="text-claw-sub text-xs font-body uppercase tracking-widest">Error policy</span>
            <div className="flex-1 h-px bg-claw-border" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Retry count">
              <Input
                value={wf.error_policy?.retry_count ?? 2}
                onChange={v => setField('error_policy', { ...wf.error_policy, retry_count: parseInt(v) || 0 })}
                placeholder="2"
              />
            </Field>
            <Field label="On failure">
              <Select
                value={wf.error_policy?.on_failure || 'notify_user'}
                onChange={v => setField('error_policy', { ...wf.error_policy, on_failure: v })}
                options={[
                  { value: 'notify_user', label: 'Notify user' },
                  { value: 'pause', label: 'Pause workflow' },
                  { value: 'ignore', label: 'Ignore' },
                ]}
              />
            </Field>
          </div>

          <div className="h-4" />
        </div>
      </div>

      {/* Right: live flow preview */}
      <div className="w-52 border-l border-claw-border bg-claw-surface shrink-0 flex flex-col">
        <div className="px-4 py-3 border-b border-claw-border">
          <p className="text-claw-sub text-xs font-body uppercase tracking-widest">Flow preview</p>
        </div>
        <div className="flex-1 overflow-y-auto">
          <FlowPreview workflow={wf} />
        </div>
      </div>
    </div>
  )
}
