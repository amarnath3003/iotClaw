import React, { useState, useEffect } from 'react'
import Sidebar from './components/Sidebar.jsx'
import Chat from './components/Chat.jsx'
import WorkflowList from './components/WorkflowList.jsx'
import WorkflowEditor from './components/WorkflowEditor.jsx'
import Dashboard from './components/Dashboard.jsx'
import TemplateLibrary from './components/TemplateLibrary.jsx'
import Settings from './components/Settings.jsx'
import DevicesView from './components/DevicesView.jsx'
import Onboarding from './components/Onboarding.jsx'
import { LoginScreen, RegisterScreen } from './components/AuthScreens.jsx'
import { api } from './api.js'

// Toggle this when you want to re-enable login/register screens.
const AUTH_ENABLED = false

const GUEST_USER = {
  id: 'guest',
  username: 'Guest',
  email: 'guest@local',
  role: 'guest',
}

export default function App() {
  const [user, setUser]               = useState(AUTH_ENABLED ? null : GUEST_USER)
  const [authView, setAuthView]       = useState('login')
  const [authChecked, setAuthChecked] = useState(!AUTH_ENABLED)
  const [mode, setMode]               = useState('consumer')
  const [view, setView]               = useState('chat')
  const [wfView, setWfView]           = useState('list')
  const [editingWf, setEditingWf]     = useState(null)
  const [refreshKey, setRefreshKey]   = useState(0)
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [simMode, setSimMode]               = useState(true)
  const [simBannerDismissed, setSimBannerDismissed] = useState(false)
  const [messagesByMode, setMessagesByMode] = useState({
    consumer: [], maker: [], poweruser: []
  })

  useEffect(() => {
    if (!AUTH_ENABLED) return

    const token = localStorage.getItem('openclaw_token')
    if (token) {
      api.me()
        .then(u => {
          setUser(u)
          setShowOnboarding(!u.onboarding_done)
          setAuthChecked(true)
        })
        .catch(() => { localStorage.removeItem('openclaw_token'); setAuthChecked(true) })
    } else {
      setAuthChecked(true)
    }
    const handler = () => { setUser(null); setAuthView('login') }
    window.addEventListener('openclaw:logout', handler)
    const statusPoll = setInterval(async () => {
      try {
        const s = await api.getStatus()
        setSimMode(s.sim_mode)
      } catch {}
    }, 5000)
    return () => {
      clearInterval(statusPoll)
      window.removeEventListener('openclaw:logout', handler)
    }
  }, [])

  function handleLogin(u) {
    setUser(u)
    setShowOnboarding(!u.onboarding_done)
  }

  function handleLogout() {
    if (!AUTH_ENABLED) return

    localStorage.removeItem('openclaw_token')
    setUser(null)
    setAuthView('login')
    setMessagesByMode({ consumer: [], maker: [], poweruser: [] })
  }

  function setMessages(msgs) {
    setMessagesByMode(prev => ({ ...prev, [mode]: msgs }))
  }

  function bump() { setRefreshKey(k => k + 1) }

  function handleViewChange(v) {
    setView(v)
    if (v !== 'workflows') setWfView('list')
  }

  if (showOnboarding && user) {
    return <Onboarding onComplete={() => setShowOnboarding(false)} />
  }

  if (!authChecked) {
    return (
      <div className="min-h-screen bg-claw-bg flex items-center justify-center">
        <div className="flex gap-1.5">
          {[0,1,2].map(i => (
            <span key={i} className="w-2 h-2 rounded-full bg-claw-sub animate-pulse_dot"
              style={{ animationDelay: `${i*0.2}s` }} />
          ))}
        </div>
      </div>
    )
  }

  if (AUTH_ENABLED && !user) {
    return authView === 'login'
      ? <LoginScreen onLogin={handleLogin} onGoRegister={() => setAuthView('register')} />
      : <RegisterScreen onLogin={handleLogin} onGoLogin={() => setAuthView('login')} />
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {simMode && !simBannerDismissed && (
        <div className="flex items-center gap-3 px-4 py-2.5 bg-claw-amber/10 border-b border-claw-amber/20 shrink-0">
          <span className="text-claw-amber text-xs font-mono">◎</span>
          <p className="text-claw-amber text-xs font-body flex-1">
            Simulation mode — showing virtual data. Add real devices in the Devices view.
          </p>
          <button onClick={() => setSimBannerDismissed(true)}
            className="text-claw-amber/60 hover:text-claw-amber text-xs">✕</button>
        </div>
      )}
      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          mode={mode} setMode={setMode}
          view={view} setView={handleViewChange}
          onClear={() => setMessagesByMode(prev => ({ ...prev, [mode]: [] }))}
          user={user} onLogout={handleLogout}
          simMode={simMode}
        />
        <main className="flex-1 overflow-hidden">
          {view === 'chat' && (
            <Chat mode={mode} messages={messagesByMode[mode]}
              setMessages={setMessages} onWorkflowSaved={bump} />
          )}
          {view === 'workflows' && wfView === 'list' && (
            <WorkflowList refreshKey={refreshKey}
              onEdit={wf => { setEditingWf(wf); setWfView('editor') }}
              onNew={() => { setEditingWf(null); setWfView('editor') }} />
          )}
          {view === 'workflows' && wfView === 'editor' && (
            <WorkflowEditor initial={editingWf}
              onSaved={() => { bump(); setWfView('list'); setEditingWf(null) }}
              onCancel={() => setWfView('list')} />
          )}
          {view === 'dashboard' && <Dashboard />}
          {view === 'templates' && <TemplateLibrary onActivated={bump} />}
          {view === 'devices'   && <DevicesView />}
          {view === 'settings'  && <Settings user={user} onLogout={handleLogout} />}
        </main>
      </div>
    </div>
  )
}
