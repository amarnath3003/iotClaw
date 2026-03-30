import { useState } from 'react'
import ChatMessage from './ChatMessage'

export default function Chat() {
  const [messages, setMessages] = useState([
    { role: 'assistant', text: 'Describe your automation and I will draft a workflow.' },
  ])
  const [input, setInput] = useState('')

  const send = () => {
    if (!input.trim()) return
    setMessages((m) => [...m, { role: 'user', text: input }, { role: 'assistant', text: 'Draft received. Save from Workflow Editor.' }])
    setInput('')
  }

  return (
    <section className="max-w-3xl mx-auto animate-rise">
      <h2 className="font-serif text-3xl mb-4">Automation Chat</h2>
      <div className="bg-claw-50 border border-claw-200 rounded-xl p-4 min-h-[320px]">
        {messages.map((msg, idx) => <ChatMessage key={idx} role={msg.role} text={msg.text} />)}
      </div>
      <div className="mt-4 flex gap-2">
        <input value={input} onChange={(e) => setInput(e.target.value)} className="flex-1 border border-claw-300 rounded px-3 py-2" placeholder="If temperature > 30, turn on fan" />
        <button onClick={send} className="bg-claw-600 text-white px-4 py-2 rounded">Send</button>
      </div>
    </section>
  )
}
