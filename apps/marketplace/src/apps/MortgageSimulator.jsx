import { useState } from 'react'

function MortgageSimulator({ appId }) {
  // Mortgage details
  const [principal, setPrincipal] = useState(250000)
  const [rate, setRate] = useState(3.5)
  const [years, setYears] = useState(25)
  
  // Results
  const [baseResult, setBaseResult] = useState(null)
  const [scenarios, setScenarios] = useState([])
  const [loading, setLoading] = useState(false)
  
  // Scenario builder
  const [newScenario, setNewScenario] = useState({
    name: '',
    strategy: 'shorten-term',
    payments: [{ month: 12, amount: 10000 }]
  })

  const calculateBase = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/${appId}/calculate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ principal, annualRate: rate, termYears: years })
      })
      const data = await res.json()
      setBaseResult(data)
    } catch (err) {
      console.error(err)
    }
    setLoading(false)
  }

  const addScenario = () => {
    if (!newScenario.name) {
      setNewScenario({ ...newScenario, name: `Scenario ${scenarios.length + 1}` })
    }
    setScenarios([...scenarios, { ...newScenario, id: Date.now() }])
    setNewScenario({
      name: '',
      strategy: 'shorten-term',
      payments: [{ month: 12, amount: 10000 }]
    })
  }

  const removeScenario = (id) => {
    setScenarios(scenarios.filter(s => s.id !== id))
  }

  const addPayment = () => {
    setNewScenario({
      ...newScenario,
      payments: [...newScenario.payments, { month: 24, amount: 5000 }]
    })
  }

  const updatePayment = (index, field, value) => {
    const payments = [...newScenario.payments]
    payments[index][field] = field === 'month' ? parseInt(value) : parseFloat(value)
    setNewScenario({ ...newScenario, payments })
  }

  const removePayment = (index) => {
    setNewScenario({
      ...newScenario,
      payments: newScenario.payments.filter((_, i) => i !== index)
    })
  }

  const compareScenarios = async () => {
    if (scenarios.length === 0) return
    setLoading(true)
    try {
      const res = await fetch(`/api/${appId}/compare`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          principal,
          annualRate: rate,
          termYears: years,
          scenarios: scenarios.map(s => ({
            name: s.name,
            strategy: s.strategy,
            payments: s.payments
          }))
        })
      })
      const data = await res.json()
      setBaseResult({ ...baseResult, comparison: data })
    } catch (err) {
      console.error(err)
    }
    setLoading(false)
  }

  const formatCurrency = (n) => new Intl.NumberFormat('es-ES', { 
    style: 'currency', 
    currency: 'EUR',
    maximumFractionDigits: 0
  }).format(n)

  const formatMonths = (months) => {
    const y = Math.floor(months / 12)
    const m = months % 12
    return y > 0 ? `${y}y ${m}m` : `${m}m`
  }

  return (
    <div className="space-y-8">
      {/* Mortgage Input */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm text-gray-400 mb-1">Principal (€)</label>
          <input
            type="number"
            value={principal}
            onChange={(e) => setPrincipal(parseFloat(e.target.value))}
            className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-1">Interest Rate (%)</label>
          <input
            type="number"
            step="0.1"
            value={rate}
            onChange={(e) => setRate(parseFloat(e.target.value))}
            className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-1">Term (years)</label>
          <input
            type="number"
            value={years}
            onChange={(e) => setYears(parseInt(e.target.value))}
            className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500"
          />
        </div>
      </div>

      <button
        onClick={calculateBase}
        disabled={loading}
        className="bg-blue-600 hover:bg-blue-500 px-6 py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
      >
        {loading ? 'Calculating...' : 'Calculate'}
      </button>

      {/* Base Result */}
      {baseResult && (
        <div className="bg-gray-700/50 rounded-xl p-6">
          <h3 className="text-lg font-semibold mb-4">📊 Base Mortgage</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-gray-400 text-sm">Monthly Payment</p>
              <p className="text-2xl font-bold text-blue-400">{formatCurrency(baseResult.monthlyPayment)}</p>
            </div>
            <div>
              <p className="text-gray-400 text-sm">Total Interest</p>
              <p className="text-2xl font-bold text-red-400">{formatCurrency(baseResult.summary.totalInterest)}</p>
            </div>
            <div>
              <p className="text-gray-400 text-sm">Total Paid</p>
              <p className="text-2xl font-bold">{formatCurrency(baseResult.summary.totalPaid)}</p>
            </div>
            <div>
              <p className="text-gray-400 text-sm">Duration</p>
              <p className="text-2xl font-bold">{formatMonths(baseResult.summary.monthsToPayoff)}</p>
            </div>
          </div>
        </div>
      )}

      {/* Scenario Builder */}
      {baseResult && (
        <div className="border border-gray-700 rounded-xl p-6">
          <h3 className="text-lg font-semibold mb-4">➕ Add Early Repayment Scenario</h3>
          
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Scenario Name</label>
                <input
                  type="text"
                  value={newScenario.name}
                  onChange={(e) => setNewScenario({ ...newScenario, name: e.target.value })}
                  placeholder="e.g., 10k each year"
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Strategy</label>
                <select
                  value={newScenario.strategy}
                  onChange={(e) => setNewScenario({ ...newScenario, strategy: e.target.value })}
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500"
                >
                  <option value="shorten-term">Shorten loan term (same payment)</option>
                  <option value="reduce-payment">Reduce monthly payment</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-2">Extra Payments</label>
              <div className="space-y-2">
                {newScenario.payments.map((payment, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <span className="text-gray-400 text-sm">Month</span>
                    <input
                      type="number"
                      value={payment.month}
                      onChange={(e) => updatePayment(i, 'month', e.target.value)}
                      className="w-20 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm"
                    />
                    <span className="text-gray-400 text-sm">Amount €</span>
                    <input
                      type="number"
                      value={payment.amount}
                      onChange={(e) => updatePayment(i, 'amount', e.target.value)}
                      className="w-28 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm"
                    />
                    {newScenario.payments.length > 1 && (
                      <button
                        onClick={() => removePayment(i)}
                        className="text-red-400 hover:text-red-300 text-sm"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <button
                onClick={addPayment}
                className="text-blue-400 hover:text-blue-300 text-sm mt-2"
              >
                + Add another payment
              </button>
            </div>

            <button
              onClick={addScenario}
              className="bg-green-600 hover:bg-green-500 px-4 py-2 rounded-lg text-sm font-medium"
            >
              Add Scenario
            </button>
          </div>
        </div>
      )}

      {/* Scenarios List */}
      {scenarios.length > 0 && (
        <div className="border border-gray-700 rounded-xl p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">📋 Scenarios to Compare ({scenarios.length})</h3>
            <button
              onClick={compareScenarios}
              disabled={loading}
              className="bg-purple-600 hover:bg-purple-500 px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
            >
              {loading ? 'Comparing...' : 'Compare All'}
            </button>
          </div>
          
          <div className="space-y-2">
            {scenarios.map((s) => (
              <div key={s.id} className="flex justify-between items-center bg-gray-700/30 rounded-lg px-4 py-2">
                <div>
                  <span className="font-medium">{s.name || 'Unnamed'}</span>
                  <span className="text-gray-400 text-sm ml-2">
                    ({s.strategy === 'reduce-payment' ? '↓ payment' : '↓ term'})
                  </span>
                  <span className="text-gray-400 text-sm ml-2">
                    {s.payments.length} payment(s), total: {formatCurrency(s.payments.reduce((sum, p) => sum + p.amount, 0))}
                  </span>
                </div>
                <button
                  onClick={() => removeScenario(s.id)}
                  className="text-red-400 hover:text-red-300"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Comparison Results */}
      {baseResult?.comparison && (
        <div className="bg-gradient-to-br from-gray-800 to-gray-700 rounded-xl p-6">
          <h3 className="text-lg font-semibold mb-4">🏆 Comparison Results</h3>
          
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-400 border-b border-gray-600">
                  <th className="text-left py-2 px-2">Scenario</th>
                  <th className="text-right py-2 px-2">Strategy</th>
                  <th className="text-right py-2 px-2">Extra Paid</th>
                  <th className="text-right py-2 px-2">Total Interest</th>
                  <th className="text-right py-2 px-2 text-green-400">Interest Saved</th>
                  <th className="text-right py-2 px-2">Time Saved</th>
                  <th className="text-right py-2 px-2 text-green-400">Net Savings</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-gray-700">
                  <td className="py-2 px-2 font-medium">Base (no extra)</td>
                  <td className="text-right py-2 px-2">-</td>
                  <td className="text-right py-2 px-2">{formatCurrency(0)}</td>
                  <td className="text-right py-2 px-2">{formatCurrency(baseResult.comparison.baseScenario.summary.totalInterest)}</td>
                  <td className="text-right py-2 px-2">-</td>
                  <td className="text-right py-2 px-2">-</td>
                  <td className="text-right py-2 px-2">-</td>
                </tr>
                {baseResult.comparison.scenarios.map((s, i) => (
                  <tr key={i} className="border-b border-gray-700 hover:bg-gray-700/30">
                    <td className="py-2 px-2 font-medium">{s.name}</td>
                    <td className="text-right py-2 px-2 text-gray-400">
                      {s.strategy === 'reduce-payment' ? '↓ payment' : '↓ term'}
                    </td>
                    <td className="text-right py-2 px-2">{formatCurrency(s.totalExtraPayments)}</td>
                    <td className="text-right py-2 px-2">{formatCurrency(s.summary.totalInterest)}</td>
                    <td className="text-right py-2 px-2 text-green-400 font-medium">
                      {formatCurrency(s.interestSaved)}
                    </td>
                    <td className="text-right py-2 px-2">
                      {s.monthsSaved > 0 ? formatMonths(s.monthsSaved) : '-'}
                    </td>
                    <td className={`text-right py-2 px-2 font-medium ${s.netSavings > 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {formatCurrency(s.netSavings)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          <p className="text-xs text-gray-500 mt-4">
            * Net Savings = Interest Saved - Extra Payments Made. Positive means you come out ahead.
          </p>
        </div>
      )}
    </div>
  )
}

export default MortgageSimulator
