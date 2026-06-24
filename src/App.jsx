import { useState, useMemo } from 'react'
import { DEFAULT_CITY } from './state/cityModel.js'
import { runDay } from './engine/dispatch.js'
import { computeMetrics } from './engine/metrics.js'
import Grid from './ui/Grid.jsx'
import Dashboard from './ui/Dashboard.jsx'

export default function App() {
  const [city] = useState(DEFAULT_CITY)

  const dayResult = useMemo(() => runDay({
    buildings:  city.buildings,
    solarUnits: city.solarUnits,
    batteries:  city.batteries,
    levers:     city.levers,
  }), [city])

  const metrics = useMemo(() => computeMetrics(dayResult), [dayResult])

  return (
    <div style={{ minHeight: '100vh', background: '#F5F1EA', fontFamily: 'Georgia, serif', color: '#1B2327' }}>
      {/* Header */}
      <header style={{
        borderBottom: '1.5px solid #D8D0C4',
        padding: '1rem 2rem',
        display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
        background: '#F5F1EA',
      }}>
        <div style={{ fontSize: '1rem', letterSpacing: '0.08em', textTransform: 'uppercase', fontFamily: 'monospace' }}>
          Keep the Lights On
        </div>
        <div style={{ fontSize: '0.75rem', color: '#9A8A76', fontFamily: 'monospace', letterSpacing: '0.06em' }}>
          Day {city.day} · {city.levers.temperature}°F · {city.levers.modernization}% modern
        </div>
      </header>

      {/* Main */}
      <main style={{ padding: '2rem', display: 'flex', gap: '2rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: '0.65rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#9A8A76', marginBottom: '0.75rem', fontFamily: 'monospace' }}>
            City Grid
          </div>
          <Grid city={city} />
        </div>

        <Dashboard metrics={metrics} />
      </main>
    </div>
  )
}
