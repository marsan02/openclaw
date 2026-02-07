import { useState, useEffect } from 'react'

function HelloWorld({ appId }) {
  const [message, setMessage] = useState('')
  const [greeting, setGreeting] = useState(null)
  const [loading, setLoading] = useState(false)

  const fetchGreeting = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/${appId}/greet?name=${encodeURIComponent(message || 'World')}`)
      const data = await res.json()
      setGreeting(data)
    } catch (err) {
      console.error('Failed to fetch greeting:', err)
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchGreeting()
  }, [])

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-4">Try the API</h3>
        <div className="flex gap-4">
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Enter your name..."
            className="flex-1 bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500"
          />
          <button
            onClick={fetchGreeting}
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-500 px-6 py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
          >
            {loading ? 'Loading...' : 'Greet!'}
          </button>
        </div>
      </div>

      {greeting && (
        <div className="bg-gray-700/50 rounded-lg p-6">
          <p className="text-2xl mb-2">{greeting.message}</p>
          <p className="text-gray-400 text-sm">
            Response from API at {new Date(greeting.timestamp).toLocaleTimeString()}
          </p>
        </div>
      )}

      <div className="border-t border-gray-700 pt-6">
        <h4 className="font-medium mb-2">API Endpoints:</h4>
        <ul className="text-gray-400 text-sm space-y-1">
          <li><code className="bg-gray-700 px-2 py-0.5 rounded">GET /api/{appId}/greet?name=X</code> - Get a greeting</li>
          <li><code className="bg-gray-700 px-2 py-0.5 rounded">GET /api/{appId}/stats</code> - Get app stats</li>
        </ul>
      </div>
    </div>
  )
}

export default HelloWorld
