import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'

function Home() {
  const [apps, setApps] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/apps')
      .then(res => res.json())
      .then(data => {
        setApps(data)
        setLoading(false)
      })
      .catch(err => {
        console.error('Failed to load apps:', err)
        setLoading(false)
      })
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-3xl font-bold mb-2">Apps</h2>
        <p className="text-gray-400">Quick experiments and app ideas</p>
      </div>

      {apps.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <p className="text-6xl mb-4">📦</p>
          <p>No apps yet. Time to build something!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {apps.map(app => (
            <Link
              key={app.id}
              to={`/app/${app.id}`}
              className="group bg-gray-800 rounded-xl p-6 border border-gray-700 hover:border-blue-500 transition-all hover:shadow-lg hover:shadow-blue-500/10"
            >
              <div className="flex items-start gap-4">
                <div 
                  className="text-4xl p-3 rounded-xl"
                  style={{ backgroundColor: app.color + '20' }}
                >
                  {app.icon}
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-semibold group-hover:text-blue-400 transition-colors">
                    {app.name}
                  </h3>
                  <p className="text-gray-400 text-sm mt-1">{app.description}</p>
                  <div className="flex items-center gap-2 mt-3">
                    <span className={`inline-block w-2 h-2 rounded-full ${
                      app.status === 'active' ? 'bg-green-500' : 'bg-yellow-500'
                    }`}></span>
                    <span className="text-xs text-gray-500">{app.status}</span>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

export default Home
