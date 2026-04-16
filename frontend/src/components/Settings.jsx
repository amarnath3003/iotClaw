import React, { useState, useEffect, useRef } from 'react'
import { api } from '../api.js'

const AUTH_ENABLED = false

function Section({ title, children }) {
  return (
    <div className="space-y-4">
      <h3 className="text-claw-sub text-xs font-body uppercase tracking-widest px-1">{title}</h3>
      <div className="bg-claw-surface border border-claw-border rounded-2xl overflow-hidden">
        {children}
      </div>
    </div>
  )
}

function Row({ label, sub, children }) {
  return (
    <div className="flex items-center justify-between px-5 py-4 border-b border-claw-border last:border-0">
      <div>
        <p className="text-claw-text text-sm font-body font-medium">{label}</p>
        {sub && <p className="text-claw-sub text-xs font-body mt-0.5">{sub}</p>}
      </div>
      <div className="shrink-0 ml-4">{children}</div>
    </div>
  )
}

function Input({ value, onChange, type = 'text', placeholder, className = '' }) {
  return (
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className={`bg-claw-bg border border-claw-border rounded-xl px-3 py-2
        text-sm font-body text-claw-text placeholder-claw-sub
        focus:outline-none focus:border-claw-muted transition-colors ${className}`}
    />
  )
}

export default function Settings({ user, onLogout }) {
  const [settings, setSettings]   = useState(null)
  const [loading, setLoading]     = useState(true)

  // Password change
  const [oldPw, setOldPw]         = useState('')
  const [newPw, setNewPw]         = useState('')
  const [pwMsg, setPwMsg]         = useState(null)
  const [pwSaving, setPwSaving]   = useState(false)

  // Import
  const fileRef                   = useRef(null)
  const [importMsg, setImportMsg] = useState(null)

  // Stats
  const [stats, setStats]         = useState(null)

  useEffect(() => {
    const settingsRequest = AUTH_ENABLED
      ? api.getSettings()
      : Promise.resolve({ model: 'gemini-2.0-flash', version: '5.0', sim_active: true })

    Promise.all([
      settingsRequest,
      api.listWorkflows(),
      api.getExecLog(),
    ])
      .then(([s, wfs, log]) => {
        setSettings(s)
        setStats({ workflows: wfs.length, executions: log.length })
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  async function changePassword(e) {
    e.preventDefault()
    if (!oldPw || !newPw) { setPwMsg({ ok: false, text: 'Fill in both fields' }); return }
    setPwSaving(true); setPwMsg(null)
    try {
      await api.changePassword(oldPw, newPw)
      setPwMsg({ ok: true, text: 'Password updated' })
      setOldPw(''); setNewPw('')
    } catch (err) {
      setPwMsg({ ok: false, text: err.message })
    } finally {
      setPwSaving(false)
    }
  }

  async function handleImport(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setImportMsg(null)
    try {
      const text = await file.text()
      const json = JSON.parse(text)
      // Support single workflow or array
      const workflows = Array.isArray(json) ? json : [json]
      let count = 0
      for (const wf of workflows) {
        await api.importWorkflow(wf)
        count++
      }
      setImportMsg({ ok: true, text: `Imported ${count} workflow${count !== 1 ? 's' : ''}` })
    } catch (err) {
      setImportMsg({ ok: false, text: `Import failed: ${err.message}` })
    }
    e.target.value = ''
  }

  async function exportAll() {
    try {
      const wfs = await api.listWorkflows()
      const clean = wfs.map(wf => {
        const { id, user_id, created_at, updated_at, version, ...rest } = wf
        return rest
      })
      const blob = new Blob([JSON.stringify(clean, null, 2)], { type: 'application/json' })
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = `openclaw-workflows-${new Date().toISOString().split('T')[0]}.json`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      alert(`Export failed: ${err.message}`)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex gap-1.5">
          {[0,1,2].map(i => (
            <span key={i} className="w-1.5 h-1.5 rounded-full bg-claw-sub animate-pulse_dot"
              style={{ animationDelay: `${i*0.2}s` }} />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-hidden bg-claw-bg">
      <div className="px-6 py-5 border-b border-claw-border bg-claw-surface/50 shrink-0">
        <h2 className="font-display text-lg text-claw-text">Settings</h2>
        <p className="text-claw-sub text-xs font-body mt-0.5">Account, preferences, and data</p>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

        {/* Account info */}
        <Section title="Account">
          <Row label="Username" sub="Your login name">
            <span className="text-claw-sub text-sm font-body">{user?.username}</span>
          </Row>
          <Row label="Email" sub="Associated email address">
            <span className="text-claw-sub text-sm font-body">{user?.email}</span>
          </Row>
          <Row label="Role" sub="Account permission level">
            <span className="px-2 py-0.5 rounded-full bg-claw-muted text-claw-sub text-xs font-body">
              {user?.role || 'user'}
            </span>
          </Row>
        </Section>

        {/* Stats */}
        {stats && (
          <Section title="Usage">
            <Row label="Saved workflows">
              <span className="text-claw-text text-sm font-body font-medium">{stats.workflows}</span>
            </Row>
            <Row label="Total executions logged">
              <span className="text-claw-text text-sm font-body font-medium">{stats.executions}</span>
            </Row>
            <Row label="AI model" sub="Currently active">
              <span className="text-claw-accent text-xs font-mono">{settings?.model || 'gemini-2.0-flash'}</span>
            </Row>
            <Row label="Simulation" sub="Virtual sensors and devices">
              <span className="w-2 h-2 rounded-full bg-claw-accent inline-block" />
            </Row>
          </Section>
        )}

        {/* Data */}
        <Section title="Data">
          <Row label="Export all workflows" sub="Download as JSON file">
            <button onClick={exportAll}
              className="px-4 py-2 rounded-xl bg-claw-amber/15 border border-claw-amber/30
                text-claw-amber text-xs font-body hover:bg-claw-amber/25 transition-all">
              Export
            </button>
          </Row>
          <Row label="Import workflows" sub="Load from a JSON file">
            <div className="flex flex-col items-end gap-1">
              <button onClick={() => fileRef.current?.click()}
                className="px-4 py-2 rounded-xl bg-claw-muted border border-claw-border
                  text-claw-text text-xs font-body hover:bg-claw-muted/80 transition-all">
                Choose file
              </button>
              <input ref={fileRef} type="file" accept=".json" className="hidden" onChange={handleImport} />
              {importMsg && (
                <p className={`text-xs font-body ${importMsg.ok ? 'text-claw-accent' : 'text-red-400'}`}>
                  {importMsg.text}
                </p>
              )}
            </div>
          </Row>
        </Section>

        {AUTH_ENABLED && (
          <>
            {/* Password */}
            <Section title="Security">
              <div className="px-5 py-4">
                <p className="text-claw-text text-sm font-body font-medium mb-3">Change password</p>
                <form onSubmit={changePassword} className="space-y-3">
                  <Input type="password" value={oldPw} onChange={setOldPw}
                    placeholder="Current password" className="w-full" />
                  <Input type="password" value={newPw} onChange={setNewPw}
                    placeholder="New password (min 6 chars)" className="w-full" />
                  {pwMsg && (
                    <p className={`text-xs font-body ${pwMsg.ok ? 'text-claw-accent' : 'text-red-400'}`}>
                      {pwMsg.text}
                    </p>
                  )}
                  <button type="submit" disabled={pwSaving}
                    className="px-4 py-2 rounded-xl bg-claw-surface border border-claw-border
                      text-claw-text text-sm font-body hover:bg-claw-muted transition-all
                      disabled:opacity-50">
                    {pwSaving ? 'Saving…' : 'Update password'}
                  </button>
                </form>
              </div>
            </Section>

            {/* Danger */}
            <Section title="Session">
              <Row label="Sign out" sub="You'll need to log in again">
                <button onClick={onLogout}
                  className="px-4 py-2 rounded-xl bg-red-500/10 border border-red-500/20
                    text-red-400 text-xs font-body hover:bg-red-500/20 transition-all">
                  Sign out
                </button>
              </Row>
            </Section>
          </>
        )}

        <div className="h-2" />
      </div>
    </div>
  )
}
