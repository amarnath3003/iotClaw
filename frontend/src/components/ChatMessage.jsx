import React, { useState } from 'react'

function parseContent(text, mode) {
  if (mode !== 'poweruser') {
    // Strip workflow blocks from display — they show as save card instead
    const clean = text.replace(/```workflow[\s\S]*?```/g, '').trim()
    return <p className="text-sm font-body leading-relaxed whitespace-pre-wrap">{clean}</p>
  }

  // Power user: render ```workflow as JSON block, ``` as code, plain text as text
  const parts = text.split(/(```(?:workflow|json|python|bash)?[\s\S]*?```)/g)
  return (
    <div className="space-y-3">
      {parts.map((part, i) => {
        if (part.startsWith('```')) {
          const lang  = part.match(/^```(\w+)/)?.[1] || ''
          const code  = part.replace(/^```\w*\n?/, '').replace(/```$/, '').trim()
          const label = lang === 'workflow' ? 'workflow' : lang || 'code'
          const color = lang === 'workflow' ? 'text-claw-amber' : 'text-claw-accent'
          return (
            <div key={i} className="rounded-xl overflow-hidden border border-claw-border">
              <div className={`px-3 py-1.5 bg-claw-muted/50 flex items-center justify-between`}>
                <span className={`text-xs font-mono ${color}`}>{label}</span>
                <button
                  onClick={() => navigator.clipboard.writeText(code)}
                  className="text-claw-sub hover:text-claw-text text-xs font-body transition-colors"
                >
                  copy
                </button>
              </div>
              <pre className="bg-claw-bg p-4 text-claw-accent font-mono text-xs overflow-x-auto leading-relaxed">
                {code}
              </pre>
            </div>
          )
        }
        return part.trim()
          ? <p key={i} className="text-sm font-body leading-relaxed whitespace-pre-wrap">{part.trim()}</p>
          : null
      })}
    </div>
  )
}

export function ToolCallBadge({ calls }) {
  const [open, setOpen] = useState(false)
  if (!calls || calls.length === 0) return null

  return (
    <div className="mt-2">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 text-xs font-body text-claw-sub
          hover:text-claw-text transition-colors"
      >
        <span className="w-1.5 h-1.5 rounded-full bg-claw-accent" />
        {calls.length} tool call{calls.length !== 1 ? 's' : ''} made
        <span className="font-mono">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="mt-2 space-y-1.5 animate-fadeup">
          {calls.map((c, i) => (
            <div key={i} className="px-3 py-2 rounded-lg bg-claw-bg border border-claw-border">
              <div className="flex items-center gap-2">
                <span className="text-claw-accent text-xs font-mono">{c.name}</span>
                {c.ok !== undefined && (
                  <span className={`text-xs font-mono ${c.ok ? 'text-claw-accent' : 'text-red-400'}`}>
                    {c.ok ? '✓' : '✗'}
                  </span>
                )}
              </div>
              {c.args && Object.keys(c.args).length > 0 && (
                <p className="text-claw-sub text-xs font-body mt-0.5">
                  {Object.entries(c.args).map(([k, v]) => `${k}: ${JSON.stringify(v)}`).join(' · ')}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function UserMessage({ text }) {
  return (
    <div className="flex justify-end animate-fadeup">
      <div className="max-w-[75%] px-4 py-3 rounded-2xl rounded-br-sm
        bg-claw-accent/15 border border-claw-accent/20 text-claw-text">
        <p className="text-sm font-body leading-relaxed">{text}</p>
      </div>
    </div>
  )
}

export function BotMessage({ text, mode, isLoading, toolCalls }) {
  const modeAccent = {
    consumer:  'text-claw-accent',
    maker:     'text-claw-amber',
    poweruser: 'text-claw-blue',
  }
  const modeBorder = {
    consumer:  'border-claw-accent/15',
    maker:     'border-claw-amber/15',
    poweruser: 'border-claw-blue/15',
  }

  return (
    <div className="flex gap-3 animate-fadeup">
      <div className={`w-7 h-7 rounded-lg bg-claw-surface border ${modeBorder[mode]}
        flex items-center justify-center shrink-0 mt-0.5`}>
        <span className={`text-xs font-mono ${modeAccent[mode]}`}>⌥</span>
      </div>
      <div className={`flex-1 px-4 py-3 rounded-2xl rounded-tl-sm
        bg-claw-surface border ${modeBorder[mode]} text-claw-text`}>
        {isLoading ? (
          <div className="flex items-center gap-1.5 h-5">
            {[0,1,2].map(i => (
              <span key={i} className="w-1.5 h-1.5 rounded-full bg-claw-sub animate-pulse_dot"
                style={{ animationDelay: `${i*0.2}s` }} />
            ))}
          </div>
        ) : (
          <>
            {parseContent(text, mode)}
            <ToolCallBadge calls={toolCalls} />
          </>
        )}
      </div>
    </div>
  )
}
