import React, { useState, useEffect } from 'react'
import Sidebar from './components/Sidebar.jsx'
import Chat from './components/Chat.jsx'
import WorkflowList from './components/WorkflowList.jsx'
import WorkflowEditor from './components/WorkflowEditor.jsx'
import Dashboard from './components/Dashboard.jsx'
import TemplateLibrary from './components/TemplateLibrary.jsx'
import Settings from './components/Settings.jsx'
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
  const [messagesByMode, setMessagesByMode] = useState({
    consumer: [], maker: [], poweruser: []
  })

  useEffect(() => {
    if (!AUTH_ENABLED) return

    const token = localStorage.getItem('openclaw_token')
    if (token) {
      api.me()
        .then(u => { setUser(u); setAuthChecked(true) })
        .catch(() => { localStorage.removeItem('openclaw_token'); setAuthChecked(true) })
    } else {
      setAuthChecked(true)
    }
    const handler = () => { setUser(null); setAuthView('login') }
    window.addEventListener('openclaw:logout', handler)
    return () => window.removeEventListener('openclaw:logout', handler)
  }, [])

  function handleLogin(u) { setUser(u) }

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
    <div className="flex h-screen overflow-hidden">
      <Sidebar
        mode={mode} setMode={setMode}
        view={view} setView={handleViewChange}
        onClear={() => setMessagesByMode(prev => ({ ...prev, [mode]: [] }))}
        user={user} onLogout={AUTH_ENABLED ? handleLogout : null}
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
        {view === 'settings' && <Settings user={user} onLogout={AUTH_ENABLED ? handleLogout : null} />}
      </main>
    </div>
  )
}
