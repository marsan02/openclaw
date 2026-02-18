import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'

// Dynamic app components registry
const appComponents = {
  'hello-world': () => import('../apps/HelloWorld'),
  'mortgage-simulator': () => import('../apps/MortgageSimulator'),
  'shopping-list': () => import('../apps/ShoppingList'),
  'task-manager': () => import('../apps/TaskManager'),
  'planning-poker': () => import('../apps/PlanningPoker'),
}

function AppView() {
  const { appId } = useParams()
  const [app, setApp] = useState(null)
  const [AppComponent, setAppComponent] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    // Fetch app metadata
    fetch(`/api/apps/${appId}`)
      .then(res => {
        if (!res.ok) throw new Error('App not found')
        return res.json()
      })
      .then(data => {
        setApp(data)
        // Try to load the app component
        if (appComponents[appId]) {
          appComponents[appId]()
            .then(module => {
              setAppComponent(() => module.default)
              setLoading(false)
            })
            .catch(() => {
              setLoading(false)
            })
        } else {
          setLoading(false)
        }
      })
      .catch(err => {
        setError(err.message)
        setLoading(false)
      })
  }, [appId])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-16">
        <p className="text-6xl mb-4">😵</p>
        <h2 className="text-2xl font-bold mb-2">App Not Found</h2>
        <p className="text-gray-400 mb-6">{error}</p>
        <Link to="/" className="text-blue-400 hover:text-blue-300">
          ← Back to apps
        </Link>
      </div>
    )
  }

  return (
    <div>
      {/* App header */}
      <div className="mb-8 flex items-center gap-4">
        <Link to="/" className="text-gray-400 hover:text-white">
          ←
        </Link>
        <div 
          className="text-4xl p-3 rounded-xl"
          style={{ backgroundColor: app.color + '20' }}
        >
          {app.icon}
        </div>
        <div>
          <h2 className="text-2xl font-bold">{app.name}</h2>
          <p className="text-gray-400">{app.description}</p>
        </div>
      </div>

      {/* App content */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
        {AppComponent ? (
          <AppComponent appId={appId} />
        ) : (
          <div className="text-center py-8 text-gray-500">
            <p>No frontend component for this app yet.</p>
            <p className="text-sm mt-2">API available at: <code className="bg-gray-700 px-2 py-1 rounded">/api/{appId}</code></p>
          </div>
        )}
      </div>
    </div>
  )
}

export default AppView
