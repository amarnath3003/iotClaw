import { useState } from 'react'
import Sidebar from './components/Sidebar'
import Chat from './components/Chat'
import WorkflowList from './components/WorkflowList'
import WorkflowEditor from './components/WorkflowEditor'
import TemplateLibrary from './components/TemplateLibrary'
import Dashboard from './components/Dashboard'

const views = {
  dashboard: Dashboard,
  chat: Chat,
  workflows: WorkflowList,
  editor: WorkflowEditor,
  templates: TemplateLibrary,
}

export default function App() {
  const [activeView, setActiveView] = useState('dashboard')
  const [mode, setMode] = useState('simulation')
  const View = views[activeView] || Dashboard

  return (
    <div className="min-h-screen grid grid-cols-[260px_1fr]">
      <Sidebar activeView={activeView} setActiveView={setActiveView} mode={mode} setMode={setMode} />
      <main className="p-6">
        <View mode={mode} />
      </main>
    </div>
  )
}
