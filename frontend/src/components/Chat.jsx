import React, { useState, useRef, useEffect } from 'react'
import { UserMessage, BotMessage } from './ChatMessage.jsx'
import { api } from '../api.js'

const PLACEHOLDERS = {
  consumer:  'Tell me what you want to automate...',
  maker:     'Describe your automation workflow...',
  poweruser: 'Define your trigger, conditions, and actions...',
}

const MODE_LABELS = {
  consumer:  { title: 'OpenClaw Assistant', sub: 'Plain language · powered by Gemini' },
  maker:     { title: 'Workflow Builder',   sub: 'Trigger → Condition → Action' },
  poweruser: { title: 'Power Console',      sub: 'Full tool visibility + JSON output' },
}

const SUGGESTIONS = {
  consumer: [
    'Turn on my light when motion is detected at night',
    'Alert me when the temperature goes above 30°C',
    'Water my plants every morning if the soil is dry',
  ],
  maker: [
    'Motion after 10PM → light on for 5 minutes then off',
    'Temperature > 30 → fan on + notify me',
    'Door opens → all lights on + fan on',
  ],
  poweruser: [
    'MQTT motion → time 22:00–06:00 → light on → delay 300s → off',
    'Read all sensors and tell me the current state',
    'Security sweep: camera on + lights + notify',
  ],
}

export default function Chat({ mode, messages, setMessages, onWorkflowSaved }) {
  const [input, setInput]             = useState('')
  const [loading, setLoading]         = useState(false)
  const [pendingWorkflow, setPending] = useState(null)
  const [savingWf, setSavingWf]       = useState(false)
  const [savedName, setSavedName]     = useState(null)
  const bottomRef   = useRef(null)
  const textareaRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading, pendingWorkflow])

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 140) + 'px'
    }
  }, [input])

  async function send(text) {
    const userText = (text || input).trim()
    if (!userText || loading) return
    setInput('')
    setPending(null)
    setSavedName(null)

    const newMessages = [...messages, { role: 'user', content: userText }]
    setMessages(newMessages)
    setLoading(true)

    try {
      const data = await api.chat(newMessages, mode)
      // Attach tool calls to the message for display
      setMessages([...newMessages, {
        role:      'assistant',
        content:   data.reply,
        toolCalls: data.tool_calls || [],
      }])
      if (data.workflow) setPending(data.workflow)
    } catch (err) {
      setMessages([...newMessages, {
        role:    'assistant',
        content: `Error: ${err.message}. Make sure the backend is running on port 8000.`,
      }])
    } finally {
      setLoading(false)
    }
  }

  async function saveWorkflow() {
    if (!pendingWorkflow) return
    setSavingWf(true)
    try {
      await api.createWorkflow(pendingWorkflow)
      setSavedName(pendingWorkflow.name)
      setPending(null)
      if (onWorkflowSaved) onWorkflowSaved()
    } catch (err) {
      alert(`Save failed: ${err.message}`)
    } finally {
      setSavingWf(false)
    }
  }

  function onKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  const accentClass = {
    consumer:  'text-claw-accent border-claw-accent/30 hover:bg-claw-accent/10',
    maker:     'text-claw-amber border-claw-amber/30 hover:bg-claw-amber/10',
    poweruser: 'text-claw-blue border-claw-blue/30 hover:bg-claw-blue/10',
  }
  const sendBtnClass = {
    consumer:  'bg-claw-accent hover:bg-claw-accentdim text-claw-bg',
    maker:     'bg-claw-amber hover:bg-claw-amber/80 text-claw-bg',
    poweruser: 'bg-claw-blue hover:bg-claw-blue/80 text-claw-bg',
  }

  return (
    <div className="flex flex-col h-screen flex-1 bg-claw-bg overflow-hidden">
      <header className="px-8 py-5 border-b border-claw-border bg-claw-surface/50 shrink-0">
        <h1 className="font-display text-xl text-claw-text">{MODE_LABELS[mode].title}</h1>
        <p className="text-claw-sub text-xs font-body mt-0.5">{MODE_LABELS[mode].sub}</p>
      </header>

      <div className="flex-1 overflow-y-auto px-8 py-6 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-6 animate-fadeup">
            <div className="text-center">
              <p className="font-display text-2xl text-claw-text mb-2">What do you want to automate?</p>
              <p className="text-claw-sub text-sm font-body">Try one of these or describe your own</p>
            </div>
            <div className="flex flex-col gap-2 w-full max-w-lg">
              {SUGGESTIONS[mode].map((s, i) => (
                <button key={i} onClick={() => send(s)}
                  className={`px-4 py-3 rounded-xl border text-sm font-body text-left
                    transition-all duration-150 ${accentClass[mode]}`}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) =>
          m.role === 'user'
            ? <UserMessage key={i} text={m.content} />
            : <BotMessage key={i} text={m.content} mode={mode} toolCalls={m.toolCalls} />
        )}

        {loading && <BotMessage isLoading mode={mode} />}

        {pendingWorkflow && (
          <div className="animate-fadeup mx-auto max-w-md">
            <div className="px-5 py-4 rounded-2xl border border-claw-amber/30 bg-claw-amber/5">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <p className="text-claw-amber text-xs font-body uppercase tracking-widest mb-1">
                    Workflow detected
                  </p>
                  <p className="text-claw-text text-sm font-body font-medium">{pendingWorkflow.name}</p>
                  {pendingWorkflow.description && (
                    <p className="text-claw-sub text-xs font-body mt-0.5">{pendingWorkflow.description}</p>
                  )}
                </div>
                <button onClick={() => setPending(null)}
                  className="text-claw-sub hover:text-claw-text text-xs mt-0.5">✕</button>
              </div>
              <div className="flex items-center gap-2 text-xs font-body text-claw-sub mb-3 flex-wrap">
                <span className="px-2 py-0.5 rounded-full bg-claw-muted">
                  {pendingWorkflow.trigger?.type || 'manual'}
                </span>
                <span>{pendingWorkflow.conditions?.length || 0} conditions</span>
                <span>·</span>
                <span>{pendingWorkflow.actions?.length || 0} actions</span>
              </div>
              <button onClick={saveWorkflow} disabled={savingWf}
                className="w-full py-2 rounded-xl bg-claw-amber/20 border border-claw-amber/30
                  text-claw-amber text-sm font-body font-medium hover:bg-claw-amber/30
                  transition-all disabled:opacity-50">
                {savingWf ? 'Saving…' : '+ Save to workflows'}
              </button>
            </div>
          </div>
        )}

        {savedName && (
          <div className="animate-fadeup mx-auto max-w-md px-4 py-3 rounded-xl
            border border-claw-accent/30 bg-claw-accent/5 text-claw-accent text-sm font-body text-center">
            ✓ &ldquo;{savedName}&rdquo; saved to your workflows
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      <div className="px-8 py-5 border-t border-claw-border bg-claw-surface/50 shrink-0">
        <div className="flex gap-3 items-end max-w-3xl mx-auto">
          <div className="flex-1">
            <textarea
              ref={textareaRef}
              rows={1}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={onKey}
              placeholder={PLACEHOLDERS[mode]}
              className="w-full resize-none bg-claw-surface border border-claw-border
                rounded-xl px-4 py-3 text-sm font-body text-claw-text placeholder-claw-sub
                focus:outline-none focus:border-claw-muted transition-colors leading-relaxed"
            />
          </div>
          <button onClick={() => send()} disabled={!input.trim() || loading}
            className={`px-5 py-3 rounded-xl text-sm font-body font-medium
              transition-all disabled:opacity-30 disabled:cursor-not-allowed ${sendBtnClass[mode]}`}>
            Send
          </button>
        </div>
        <p className="text-claw-sub text-xs font-body text-center mt-2.5">
          Enter to send · Shift+Enter for new line
        </p>
      </div>
    </div>
  )
}
