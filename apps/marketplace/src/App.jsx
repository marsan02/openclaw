import { Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import AppView from './pages/AppView'
import Layout from './components/Layout'

function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/app/:appId/*" element={<AppView />} />
      </Routes>
    </Layout>
  )
}

export default App
