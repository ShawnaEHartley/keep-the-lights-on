import { useState, useMemo, useEffect, useCallback } from 'react'
import { DEFAULT_CITY } from './state/cityModel.js'
import { runDay } from './engine/dispatch.js'
import { computeMetrics } from './engine/metrics.js'
import { expectedWeather, sampleWeather } from './engine/weather.js'
import Grid from './ui/Grid.jsx'
import EstimatePanel from './ui/EstimatePanel.jsx'
import DayResults from './ui/DayResults.jsx'
import DayClock from './ui/DayClock.jsx'
import FlowArrows from './ui/FlowArrows.jsx'

const HOUR_MS = 700  // ms per simulated hour

export default function App() {
  const [city]          = useState(DEFAULT_CITY)
  const [hour,           setHour]        = useState(0)
  const [playing,        setPlaying]     = useState(false)
  const [started,        setStarted]     = useState(false)
  const [dayComplete,    setDayComplete] = useState(false)
  const [actualResult,   setActualResult]  = useState(null)
  const [actualWeather,  setActualWeather] = useState(null)

  const climate = city.levers

  // Estimate — always live, deterministic
  const estWeather = useMemo(() => expectedWeather(climate), [climate])
  const estimateResult = useMemo(() => runDay({
    buildings:  city.buildings,
    solarUnits: city.solarUnits,
    batteries:  city.batteries,
    weather:    estWeather,
  }), [city, estWeather])

  const estimateMetrics = useMemo(
    () => computeMetrics(estimateResult, null, null, climate.modernization),
    [estimateResult, climate.modernization]
  )

  // Actual — set when user presses Run Day
  const actualMetrics = useMemo(() => {
    if (!actualResult) return null
    return computeMetrics(actualResult, estimateResult, null, climate.modernization)
  }, [actualResult, estimateResult, climate.modernization])

  // Animation clock
  useEffect(() => {
    if (!playing) return
    const id = setInterval(() => {
      setHour(h => {
        if (h >= 23) { setPlaying(false); setDayComplete(true); return 23 }
        return h + 1
      })
    }, HOUR_MS)
    return () => clearInterval(id)
  }, [playing])

  const handleRun = useCallback(() => {
    const weather = sampleWeather(climate, Date.now())
    const result  = runDay({
      buildings:  city.buildings,
      solarUnits: city.solarUnits,
      batteries:  city.batteries,
      weather,
    })
    setActualWeather(weather)
    setActualResult(result)
    setHour(0)
    setStarted(true)
    setDayComplete(false)
    setPlaying(true)
  }, [city, climate])

  const handlePause  = useCallback(() => setPlaying(false), [])
  const handleResume = useCallback(() => {
    if (hour >= 23) { setHour(0); setDayComplete(false) }
    setPlaying(true)
  }, [hour])
  const handleReset  = useCallback(() => {
    setPlaying(false); setStarted(false); setDayComplete(false)
    setActualResult(null); setActualWeather(null); setHour(0)
  }, [])

  const runResult  = actualResult ?? estimateResult
  const hourData   = runResult.hourly[hour]
  const shedIds    = (started && hourData) ? (hourData.shedBuildingIds ?? []) : []

  const activeWeather    = actualWeather ?? estWeather
  const supplyCapacity   = (activeWeather.uCap ?? 1.9) + (activeWeather.peakCap ?? 0.1)

  return (
    <div style={{ minHeight: '100vh', background: '#F5F1EA', fontFamily: 'Georgia, serif', color: '#1B2327' }}>
      {/* Header */}
      <header style={{
        borderBottom: '1.5px solid #D8D0C4',
        padding: '0.65rem 2rem',
        display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
        background: '#F5F1EA',
      }}>
        <div style={{ fontSize: '1rem', letterSpacing: '0.08em', textTransform: 'uppercase', fontFamily: 'monospace' }}>
          Keep the Lights On
        </div>
        <div style={{ fontSize: '0.72rem', color: '#9A8A76', fontFamily: 'monospace', letterSpacing: '0.05em' }}>
          Day {city.day} · {climate.season} · {climate.modernization}% renewable mix
        </div>
      </header>

      {/* Day clock + sparkline */}
      <DayClock
        hour={hour}
        playing={playing}
        started={started}
        dayComplete={dayComplete}
        hourly={actualResult?.hourly ?? null}
        estimateHourly={estimateResult.hourly}
        cloudByHour={activeWeather.cloudByHour}
        supplyCapacity={supplyCapacity}
        temperature={climate.temperature}
        actualTemperature={actualWeather?.temperature ?? null}
        onRun={handleRun}
        onPause={handlePause}
        onResume={handleResume}
        onReset={handleReset}
      />

      {/* Main: grid full-width, panel below */}
      <main style={{ padding: '1.5rem 2rem 2rem' }}>
        <div style={{ fontSize: '0.6rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#9A8A76', marginBottom: '0.6rem', fontFamily: 'monospace' }}>
          City Grid
        </div>

        {/* Grid + flow arrows */}
        <div style={{ display: 'inline-block', position: 'relative' }}>
          <Grid
            city={city}
            shedIds={shedIds}
            overlay={
              <FlowArrows
                buildings={city.buildings}
                hourData={started ? hourData : null}
                shedIds={shedIds}
              />
            }
          />
        </div>

        {/* Below grid: estimate strip while building, results after day completes */}
        {dayComplete && actualMetrics
          ? <DayResults
              actualResult={actualResult}
              estimateResult={estimateResult}
              actualMetrics={actualMetrics}
              estimateMetrics={estimateMetrics}
              city={city}
              weather={actualWeather}
            />
          : <EstimatePanel estimateMetrics={estimateMetrics} />
        }
      </main>
    </div>
  )
}
