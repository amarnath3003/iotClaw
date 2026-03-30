export default function ChatMessage({ role, text }) {
  const isUser = role === 'user'
  return (
    <div className={`max-w-[80%] rounded-lg p-3 my-2 ${isUser ? 'ml-auto bg-claw-500 text-white' : 'bg-white border border-claw-200'}`}>
      <p className="text-sm leading-relaxed whitespace-pre-wrap">{text}</p>
    </div>
  )
}
