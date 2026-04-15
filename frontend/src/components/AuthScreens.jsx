import React, { useState } from 'react'
import { api } from '../api.js'

function Field({ label, children }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-body text-claw-sub uppercase tracking-widest">{label}</label>
      {children}
    </div>
  )
}

function Input({ type = 'text', value, onChange, placeholder, autoComplete }) {
  return (
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      autoComplete={autoComplete}
      className="w-full bg-claw-bg border border-claw-border rounded-xl px-4 py-3
        text-sm font-body text-claw-text placeholder-claw-sub
        focus:outline-none focus:border-claw-muted transition-colors"
    />
  )
}

function AuthCard({ title, subtitle, children }) {
  return (
    <div className="min-h-screen bg-claw-bg flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-9 h-9 rounded-xl bg-claw-accent/20 flex items-center justify-center">
            <span className="text-claw-accent font-mono font-bold text-lg">⌥</span>
          </div>
          <div>
            <h1 className="font-display text-xl text-claw-text">OpenClaw</h1>
            <p className="text-claw-sub text-xs font-body">AI Automation Platform</p>
          </div>
        </div>
        <div className="bg-claw-surface border border-claw-border rounded-2xl p-6 space-y-5">
          <div>
            <h2 className="font-display text-lg text-claw-text">{title}</h2>
            <p className="text-claw-sub text-xs font-body mt-1">{subtitle}</p>
          </div>
          {children}
        </div>
      </div>
    </div>
  )
}

export function LoginScreen({ onLogin, onGoRegister }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')

  async function handleLogin(e) {
    e.preventDefault()
    if (!username || !password) { setError('Fill in all fields'); return }
    setLoading(true); setError('')
    try {
      const data = await api.login(username, password)
      localStorage.setItem('openclaw_token', data.access_token)
      onLogin(data.user)
    } catch (err) {
      setError(err.message || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthCard title="Welcome back" subtitle="Sign in to your account">
      <form onSubmit={handleLogin} className="space-y-4">
        <Field label="Username">
          <Input value={username} onChange={setUsername} placeholder="your_username"
            autoComplete="username" />
        </Field>
        <Field label="Password">
          <Input type="password" value={password} onChange={setPassword}
            placeholder="••••••••" autoComplete="current-password" />
        </Field>
        {error && (
          <p className="text-red-400 text-xs font-body px-1">{error}</p>
        )}
        <button type="submit" disabled={loading}
          className="w-full py-3 rounded-xl bg-claw-accent text-claw-bg text-sm
            font-body font-medium hover:bg-claw-accentdim transition-all
            disabled:opacity-50 disabled:cursor-not-allowed">
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
      <div className="text-center pt-2 border-t border-claw-border">
        <button onClick={onGoRegister}
          className="text-claw-sub text-xs font-body hover:text-claw-text transition-colors">
          No account? Create one →
        </button>
      </div>
    </AuthCard>
  )
}

export function RegisterScreen({ onLogin, onGoLogin }) {
  const [username, setUsername] = useState('')
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')

  async function handleRegister(e) {
    e.preventDefault()
    if (!username || !email || !password) { setError('Fill in all fields'); return }
    if (password.length < 6) { setError('Password must be at least 6 characters'); return }
    setLoading(true); setError('')
    try {
      const data = await api.register(username, email, password)
      localStorage.setItem('openclaw_token', data.access_token)
      onLogin(data.user)
    } catch (err) {
      setError(err.message || 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthCard title="Create account" subtitle="Start automating in seconds">
      <form onSubmit={handleRegister} className="space-y-4">
        <Field label="Username">
          <Input value={username} onChange={setUsername} placeholder="your_username"
            autoComplete="username" />
        </Field>
        <Field label="Email">
          <Input type="email" value={email} onChange={setEmail}
            placeholder="you@example.com" autoComplete="email" />
        </Field>
        <Field label="Password">
          <Input type="password" value={password} onChange={setPassword}
            placeholder="min 6 characters" autoComplete="new-password" />
        </Field>
        {error && (
          <p className="text-red-400 text-xs font-body px-1">{error}</p>
        )}
        <button type="submit" disabled={loading}
          className="w-full py-3 rounded-xl bg-claw-accent text-claw-bg text-sm
            font-body font-medium hover:bg-claw-accentdim transition-all
            disabled:opacity-50 disabled:cursor-not-allowed">
          {loading ? 'Creating account…' : 'Create account'}
        </button>
      </form>
      <div className="text-center pt-2 border-t border-claw-border">
        <button onClick={onGoLogin}
          className="text-claw-sub text-xs font-body hover:text-claw-text transition-colors">
          Already have an account? Sign in →
        </button>
      </div>
    </AuthCard>
  )
}
