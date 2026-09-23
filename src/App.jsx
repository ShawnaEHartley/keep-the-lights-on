import { useState, useMemo, useEffect, useCallback } from 'react'
import { DEFAULT_CITY, deriveHouseTypes, atLimit } from './state/cityModel.js'
import { runDay } from './engine/dispatch.js'
import { computeMetrics } from './engine/metrics.js'
import { expectedWeather, sampleWeather } from './engine/weather.js'
import Grid from './ui/Grid.jsx'
import Inventory from './ui/Inventory.jsx'
import EstimatePanel from './ui/EstimatePanel.jsx'
import Dashboard from './ui/Dashboard.jsx'
import DayResults from './ui/DayResults.jsx'
import DayClock from './ui/DayClock.jsx'
import FlowArrows from './ui/FlowArrows.jsx'

const HOUR_MS = 700  // ms per simulated hour

export default function App() {
  const [city, setCity] = useState(DEFAULT_CITY)
  const [hour,           setHour]        = useState(0)
  const [playing,        setPlaying]     = useState(false)
  const [started,        setStarted]     = useState(false)
  const [dayComplete,    setDayComplete] = useState(false)
  const [actualResult,   setActualResult]  = useState(null)
  const [actualWeather,  setActualWeather] = useState(null)

  const climate = city.levers

  // ~1 in 5 houses works from home. Derived rather than stored, so the ratio
  // holds as houses are added; ids are preserved, so drag handlers still match.
  const buildings   = useMemo(() => deriveHouseTypes(city.buildings), [city.buildings])
  const derivedCity = useMemo(() => ({ ...city, buildings }), [city, buildings])

  // Estimate — always live, deterministic
  const estWeather = useMemo(() => expectedWeather(climate), [climate])
  const estimateResult = useMemo(() => runDay({
    buildings,
    solarUnits: city.solarUnits,
    batteries:  city.batteries,
    weather:    estWeather,
  }), [buildings, city.solarUnits, city.batteries, estWeather])

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
      buildings,
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
  }, [buildings, city.solarUnits, city.batteries, climate])

  // ── Editing the city ────────────────────────────────────────────────────
  // drag is { kind: 'move', id } for a tile already on the map, or
  // { kind: 'new', type } for a type dragged out of the inventory.
  const [drag, setDrag] = useState(null)
  const [showDetails, setShowDetails] = useState(false)

  const handleDragTile = useCallback(id   => setDrag({ kind: 'move', id }), [])
  const handleDragNew  = useCallback(type => setDrag({ kind: 'new',  type }), [])
  const handleDragEnd  = useCallback(()   => setDrag(null), [])

  // Moving is cosmetic — the engine counts building types, not positions.
  // Adding and removing are not: supply capacity comes from the utility and
  // peaker tiles, so editing those re-runs the estimate with real consequences.
  const handleDropOnCell = useCallback((col, row) => {
    setCity(prev => {
      if (prev.buildings.some(b => b.col === col && b.row === row)) return prev
      if (!drag) return prev

      if (drag.kind === 'move') {
        return { ...prev, buildings: prev.buildings.map(b => (b.id === drag.id ? { ...b, col, row } : b)) }
      }
      // One utility per city — remove it to go off-grid, drop it back to reconnect
      if (atLimit(prev.buildings, drag.type)) return prev
      const nextId = prev.buildings.reduce((m, b) => Math.max(m, b.id), 0) + 1
      return { ...prev, buildings: [...prev.buildings, { id: nextId, type: drag.type, col, row }] }
    })
    setDrag(null)
  }, [drag])

  const handleDeleteBuilding = useCallback(id => {
    setCity(prev => ({ ...prev, buildings: prev.buildings.filter(b => b.id !== id) }))
    setDrag(null)
  }, [])

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

  const activeWeather = actualWeather ?? estWeather

  // Capacity now comes from the infrastructure on the map, not the lever alone
  const utilityCount = buildings.filter(b => b.type === 'utility').length
  const peakerCount  = buildings.filter(b => b.type === 'peaker').length
  const supplyCapacity =
    (activeWeather.uCapPerUtility   ?? 1.8) * utilityCount +
    (activeWeather.peakCapPerPeaker ?? 1.0) * peakerCount

  // The gas plant is the villain — light it up the moment it has to run
  const peakerFiring = started && !dayComplete && (hourData?.peaker ?? 0) > 0.001

  // Live gauge levels for the plant tiles
  const supply = hourData ? {
    utility: hourData.utility,
    peaker:  hourData.peaker,
    uCap:    runResult.totals.uCap,
    peakCap: runResult.totals.peakCap,
  } : null

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
        utilityCapacity={runResult.totals.uCap}
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

        {/* Grid + flow arrows, with the inventory palette alongside */}
        <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'flex-start' }}>
          <div style={{ display: 'inline-block', position: 'relative' }}>
            <Grid
              city={derivedCity}
              shedIds={shedIds}
              peakerFiring={peakerFiring}
              live={started && !dayComplete}
              hour={hour}
              season={climate.season}
              supply={supply}
              modernization={climate.modernization}
              drag={drag}
              onDragTile={handleDragTile}
              onDragEnd={handleDragEnd}
              onDropOnCell={handleDropOnCell}
              overlay={
                <FlowArrows
                  buildings={buildings}
                  // Day over → clear the overlay entirely. Paused mid-day → keep
                  // the lines but frozen (see `animate`).
                  hourData={started && !dayComplete ? hourData : null}
                  shedIds={shedIds}
                  animate={playing}
                />
              }
            />
          </div>

          <Inventory
            city={city}
            drag={drag}
            onDragNew={handleDragNew}
            onDragEnd={handleDragEnd}
            onDeleteBuilding={handleDeleteBuilding}
          />
        </div>

        {/* Below grid: estimate strip while building, results after day completes */}
        {dayComplete && actualMetrics
          ? <DayResults
              actualResult={actualResult}
              estimateResult={estimateResult}
              actualMetrics={actualMetrics}
              estimateMetrics={estimateMetrics}
              city={derivedCity}
              weather={actualWeather}
            />
          : <EstimatePanel estimateMetrics={estimateMetrics} />
        }

        {/* Detail view: same numbers, real terminology, each term defined */}
        <button
          onClick={() => setShowDetails(v => !v)}
          style={{
            marginTop: '0.9rem',
            padding: '0.35rem 0.8rem',
            border: '1px solid #C8C0B4',
            borderRadius: 5,
            background: showDetails ? '#E8E2D9' : '#F5F1EA',
            color: '#7A6A56',
            fontFamily: 'monospace',
            fontSize: '0.66rem',
            letterSpacing: '0.05em',
            cursor: 'pointer',
          }}
        >
          {showDetails ? '▾ hide the details' : '▸ what do these numbers mean?'}
        </button>

        {showDetails && (
          <Dashboard
            metrics={dayComplete && actualMetrics ? actualMetrics : estimateMetrics}
            vsEstimate={dayComplete && actualMetrics ? actualMetrics.vsEstimate : null}
            isActual={dayComplete && !!actualMetrics}
          />
        )}
      </main>
    </div>
  )
}
