import React from 'react'

const modes = [
  { id: 'consumer',  label: 'Consumer',   icon: '◎',   desc: 'Chat in plain language', color: 'text-claw-accent', activeBg: 'bg-claw-accent/10 border-claw-accent/30' },
  { id: 'maker',     label: 'Maker',      icon: '⬡',   desc: 'Build + save workflows', color: 'text-claw-amber',  activeBg: 'bg-claw-amber/10 border-claw-amber/30' },
  { id: 'poweruser', label: 'Power User', icon: '⟨/⟩', desc: 'Full JSON + tool calls', color: 'text-claw-blue',   activeBg: 'bg-claw-blue/10 border-claw-blue/30' },
]

const views = [
  { id: 'chat',      label: 'Chat',      icon: '◈' },
  { id: 'workflows', label: 'Flows',     icon: '⬡' },
  { id: 'templates', label: 'Templates', icon: '◎' },
  { id: 'dashboard', label: 'Dashboard', icon: '◩' },
  { id: 'settings',  label: 'Settings',  icon: '⚙' },
]

export default function Sidebar({ mode, setMode, view, setView, onClear, user, onLogout }) {
  return (
    <aside className="w-60 h-screen flex flex-col bg-claw-surface border-r border-claw-border shrink-0">

      {/* Logo */}
      <div className="px-5 pt-6 pb-4 border-b border-claw-border">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-claw-accent/20 flex items-center justify-center">
            <span className="text-claw-accent text-sm font-mono font-bold">⌥</span>
          </div>
          <span className="font-display text-lg text-claw-text tracking-tight">OpenClaw</span>
        </div>
        <p className="text-claw-sub text-xs mt-1 font-body">AI Automation Platform</p>
      </div>

      {/* Views — 3 col grid now that there are 5 */}
      <div className="px-3 pt-4">
        <p className="text-claw-sub text-xs font-body font-medium uppercase tracking-widest mb-2 px-2">Navigate</p>
        <div className="grid grid-cols-3 gap-1">
          {views.map(v => (
            <button key={v.id} onClick={() => setView(v.id)}
              className={`py-2 rounded-xl text-xs font-body font-medium flex flex-col items-center gap-0.5
                transition-all duration-150 border
                ${view === v.id
                  ? 'bg-claw-muted border-claw-border text-claw-text'
                  : 'border-transparent text-claw-sub hover:text-claw-text hover:bg-claw-muted/40'}`}>
              <span className="font-mono text-sm leading-none">{v.icon}</span>
              <span className="text-xs">{v.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Mode */}
      <div className="px-3 pt-4 flex-1">
        <p className="text-claw-sub text-xs font-body font-medium uppercase tracking-widest mb-2 px-2">AI Mode</p>
        <div className="space-y-1">
          {modes.map(m => (
            <button key={m.id} onClick={() => setMode(m.id)}
              className={`w-full text-left px-3 py-2.5 rounded-xl border transition-all duration-150
                ${mode === m.id ? `${m.activeBg} border` : 'border-transparent hover:bg-claw-muted/40'}`}>
              <div className="flex items-center gap-2.5">
                <span className={`font-mono ${mode === m.id ? m.color : 'text-claw-sub'}`}>{m.icon}</span>
                <div>
                  <p className={`text-xs font-medium font-body ${mode === m.id ? 'text-claw-text' : 'text-claw-sub'}`}>{m.label}</p>
                  <p className="text-claw-sub text-xs font-body leading-tight">{m.desc}</p>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* User + actions */}
      <div className="px-3 pb-5 pt-4 border-t border-claw-border space-y-1">
        {user && (
          <div className="px-3 py-2.5 rounded-xl bg-claw-muted/30 border border-claw-border mb-2">
            <p className="text-claw-text text-xs font-body font-medium truncate">{user.username}</p>
            <p className="text-claw-sub text-xs font-body truncate">{user.email}</p>
          </div>
        )}
        <button onClick={onClear}
          className="w-full px-3 py-2 rounded-xl text-claw-sub text-xs font-body
            hover:bg-claw-muted/40 hover:text-claw-text border border-transparent
            hover:border-claw-border transition-all text-left">
          ↺ &nbsp;Clear chat
        </button>
        {onLogout && (
          <button onClick={onLogout}
            className="w-full px-3 py-2 rounded-xl text-claw-sub text-xs font-body
              hover:bg-red-500/10 hover:text-red-400 border border-transparent
              hover:border-red-500/20 transition-all text-left">
            ⎋ &nbsp;Sign out
          </button>
        )}
      </div>
    </aside>
  )
}
