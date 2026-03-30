const templates = [
  { name: 'Heat Watch', category: 'Environment' },
  { name: 'Night Light', category: 'Lighting' },
  { name: 'Ventilation Guard', category: 'HVAC' },
]

export default function TemplateLibrary() {
  return (
    <section>
      <h2 className="font-serif text-3xl mb-4">Template Library</h2>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {templates.map((t) => (
          <article key={t.name} className="bg-white border border-claw-200 rounded-xl p-4">
            <h3 className="font-semibold">{t.name}</h3>
            <p className="text-sm text-claw-700">{t.category}</p>
          </article>
        ))}
      </div>
    </section>
  )
}
