import { getMapData, show3dMap } from '@mappedin/mappedin-js'
import {
  ArrowLeft,
  Compass,
  Eye,
  EyeOff,
  Expand,
  Layers3,
  LoaderCircle,
  LocateFixed,
  MapPin,
  Minus,
  Plus,
  Radar,
  RotateCcw,
  RotateCw,
  Search,
  Tags,
  TimerReset,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router'

type TokenPayload = {
  accessToken?: string
  mapId?: string
  error?: string
}

type LoadState = 'loading' | 'ready' | 'error'
type MapData = Awaited<ReturnType<typeof getMapData>>
type MapView = Awaited<ReturnType<typeof show3dMap>>
type MappedSpace = ReturnType<MapData['getByType']>[number]

type FloorOption = {
  id: string
  name: string
  elevation: number
}

type LocationState = {
  status: 'off' | 'requesting' | 'ready' | 'error'
  message: string
}

function formatName(value: unknown, fallback: string) {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : fallback
}

function readSpaceFloorName(space: MappedSpace, currentFloorName: string) {
  const record = space as Record<string, unknown>
  const floor = record.floor as Record<string, unknown> | undefined
  return formatName(floor?.name, currentFloorName)
}

async function addAlwaysOnLabels(mapView: MapView, mapData: MapData) {
  mapView.Labels.removeAll()

  const spaces = mapData
    .getByType('space')
    .filter((space) => Boolean(formatName((space as Record<string, unknown>).name, '')))

  await Promise.all(
    spaces.map((space) =>
      mapView.Labels.add(space, formatName((space as Record<string, unknown>).name, 'Mapped space'), {
        interactive: true,
        enabled: true,
        rank: 'always-visible',
        appearance: {
          margin: 8,
          maxLines: 2,
          maxWidth: 180,
          textSize: 12,
          textColor: '#101827',
          textOutlineColor: '#ffffff',
          pinColor: '#0f172a',
          pinOutlineColor: '#ffffff',
        },
      }),
    ),
  )
}

function MappedinControlTowerDemoPage() {
  const mapElementRef = useRef<HTMLDivElement>(null)
  const shellRef = useRef<HTMLDivElement>(null)
  const mapViewRef = useRef<MapView | null>(null)
  const mapDataRef = useRef<MapData | null>(null)
  const orbitTimerRef = useRef<number | null>(null)

  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [errorMessage, setErrorMessage] = useState('')
  const [floors, setFloors] = useState<FloorOption[]>([])
  const [currentFloorId, setCurrentFloorId] = useState('')
  const [spaces, setSpaces] = useState<MappedSpace[]>([])
  const [selectedSpaceId, setSelectedSpaceId] = useState('')
  const [selectedName, setSelectedName] = useState('No room selected')
  const [query, setQuery] = useState('')
  const [labelsVisible, setLabelsVisible] = useState(true)
  const [uiVisible, setUiVisible] = useState(true)
  const [cameraMode, setCameraMode] = useState<'orbit' | 'top' | 'walkthrough'>('orbit')
  const [bearing, setBearing] = useState(0)
  const [pitch, setPitch] = useState(58)
  const [orbiting, setOrbiting] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  const [locationState, setLocationState] = useState<LocationState>({
    status: 'off',
    message: 'Browser location has not been requested.',
  })

  const namedSpaces = useMemo(
    () =>
      spaces
        .filter((space) => Boolean(formatName((space as Record<string, unknown>).name, '')))
        .sort((a, b) =>
          formatName((a as Record<string, unknown>).name, '').localeCompare(
            formatName((b as Record<string, unknown>).name, ''),
          ),
        ),
    [spaces],
  )

  const visibleSpaces = useMemo(() => {
    const value = query.trim().toLowerCase()
    if (!value) return namedSpaces.slice(0, 24)

    return namedSpaces
      .filter((space) => formatName((space as Record<string, unknown>).name, '').toLowerCase().includes(value))
      .slice(0, 40)
  }, [namedSpaces, query])

  const applyCamera = useCallback((nextBearing: number, nextPitch: number) => {
    const mapView = mapViewRef.current
    if (!mapView) return

    const normalizedBearing = ((nextBearing % 360) + 360) % 360
    setBearing(normalizedBearing)
    setPitch(nextPitch)
    mapView.Camera.set({ bearing: normalizedBearing, pitch: nextPitch })
  }, [])

  const focusSpace = useCallback((space: MappedSpace) => {
    const mapView = mapViewRef.current
    if (!mapView) return

    const spaceRecord = space as Record<string, unknown>
    const name = formatName(spaceRecord.name, 'Unnamed mapped space')
    const floorName = readSpaceFloorName(space, formatName((mapView.currentFloor as Record<string, unknown>).name, 'Current floor'))

    mapView.Camera.focusOn(space)
    setSelectedSpaceId(String(spaceRecord.id ?? ''))
    setSelectedName(name)
    setCameraMode('walkthrough')
    applyCamera(bearing, Math.max(pitch, 45))

    const currentFloor = mapView.currentFloor as Record<string, unknown>
    if (formatName(currentFloor.name, '') !== floorName) {
      // Mappedin will move floors when focusOn can resolve the selected space. This text gives the user immediate feedback.
    }
  }, [applyCamera, bearing, pitch])

  const loadMap = useCallback(async () => {
    const mapElement = mapElementRef.current
    if (!mapElement) return

    setLoadState('loading')
    setErrorMessage('')

    const tokenResponse = await fetch('/api/mappedin-token')
    const tokenPayload = (await tokenResponse.json()) as TokenPayload

    if (!tokenResponse.ok || !tokenPayload.accessToken || !tokenPayload.mapId) {
      throw new Error(tokenPayload.error ?? 'Mappedin token configuration could not be loaded.')
    }

    const mapData = await getMapData({ accessToken: tokenPayload.accessToken, mapId: tokenPayload.mapId })
    const mapView = await show3dMap(mapElement, mapData)

    mapViewRef.current = mapView
    mapDataRef.current = mapData

    mapView.Camera.interactions.set({ pan: true, zoom: true, bearingAndPitch: true })
    mapView.Camera.set({ bearing: 0, pitch: 58 })

    const floorOptions = mapData
      .getByType('floor')
      .map((floor) => ({
        id: floor.id,
        name: formatName((floor as Record<string, unknown>).name, `Level ${(floor as Record<string, unknown>).elevation ?? ''}`),
        elevation: Number((floor as Record<string, unknown>).elevation ?? 0),
      }))
      .sort((a, b) => b.elevation - a.elevation)

    const spaceOptions = mapData.getByType('space')
    setFloors(floorOptions)
    setSpaces(spaceOptions)
    setCurrentFloorId(mapView.currentFloor.id)

    spaceOptions.forEach((space) => {
      mapView.updateState(space, {
        interactive: true,
        hoverColor: '#06b6d4',
      })
    })

    await addAlwaysOnLabels(mapView, mapData)

    mapView.on('floor-change', (event) => {
      setCurrentFloorId(event.floor.id)
      mapView.Camera.focusOn(event.floor)
      mapView.Camera.set({ bearing, pitch })
    })

    mapView.on('camera-change', (transform) => {
      if (typeof transform.bearing === 'number') setBearing(((transform.bearing % 360) + 360) % 360)
      if (typeof transform.pitch === 'number') setPitch(Math.round(transform.pitch))
    })

    mapView.on('click', (event) => {
      const space = event.spaces?.[0]
      const label = event.labels?.[0]
      if (space) {
        focusSpace(space)
        return
      }
      if (label) setSelectedName(formatName(label.text, 'Mapped label'))
    })

    mapView.Camera.focusOn(mapView.currentFloor)
    setLoadState('ready')
  }, [bearing, focusSpace, pitch])

  useEffect(() => {
    let cancelled = false
    let activeMapView: MapView | null = null

    void loadMap()
      .then(() => {
        if (cancelled && mapViewRef.current) mapViewRef.current.destroy()
        activeMapView = mapViewRef.current
      })
      .catch((error: unknown) => {
        if (cancelled) return
        setErrorMessage(error instanceof Error ? error.message : 'The map failed to load.')
        setLoadState('error')
      })

    return () => {
      cancelled = true
      if (orbitTimerRef.current) window.clearInterval(orbitTimerRef.current)
      orbitTimerRef.current = null
      activeMapView?.destroy()
      mapViewRef.current = null
      mapDataRef.current = null
    }
  }, [loadMap, reloadKey])

  const changeFloor = (floorId: string) => {
    mapViewRef.current?.setFloor(floorId)
  }

  const toggleLabels = async () => {
    const mapView = mapViewRef.current
    const mapData = mapDataRef.current
    if (!mapView || !mapData) return

    if (labelsVisible) {
      mapView.Labels.removeAll()
      setLabelsVisible(false)
    } else {
      await addAlwaysOnLabels(mapView, mapData)
      setLabelsVisible(true)
    }
  }

  const resetView = () => {
    const mapView = mapViewRef.current
    if (!mapView) return
    setCameraMode('orbit')
    mapView.Camera.focusOn(mapView.currentFloor)
    applyCamera(0, 58)
  }

  const toggleTopDown = () => {
    const nextMode = cameraMode === 'top' ? 'orbit' : 'top'
    setCameraMode(nextMode)
    applyCamera(bearing, nextMode === 'top' ? 0 : 58)
  }

  const toggleOrbit = () => {
    if (orbitTimerRef.current) {
      window.clearInterval(orbitTimerRef.current)
      orbitTimerRef.current = null
      setOrbiting(false)
      return
    }

    setOrbiting(true)
    orbitTimerRef.current = window.setInterval(() => {
      setBearing((current) => {
        const next = (current + 3) % 360
        mapViewRef.current?.Camera.set({ bearing: next, pitch: Math.max(pitch, 45) })
        return next
      })
    }, 120)
  }

  const enterFullscreen = async () => {
    if (!shellRef.current) return
    if (document.fullscreenElement) await document.exitFullscreen()
    else await shellRef.current.requestFullscreen()
  }

  const requestLocation = () => {
    if (!navigator.geolocation) {
      setLocationState({ status: 'error', message: 'This browser does not support geolocation.' })
      return
    }

    setLocationState({ status: 'requesting', message: 'Waiting for browser location permission…' })
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords
        setLocationState({
          status: 'ready',
          message: `${latitude.toFixed(5)}, ${longitude.toFixed(5)} · accuracy ${Math.round(accuracy)} m. Off-site positions are reported but not plotted as an indoor Blue Dot.`,
        })
      },
      () => setLocationState({ status: 'error', message: 'Location could not be retrieved or permission was denied.' }),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 },
    )
  }

  const firstMatch = visibleSpaces[0]

  return (
    <div ref={shellRef} className="relative h-screen overflow-hidden bg-slate-950 text-white">
      <div ref={mapElementRef} className="absolute inset-0" />

      {loadState === 'loading' && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-950">
          <div className="rounded-3xl border border-white/10 bg-slate-900/90 p-8 text-center shadow-2xl">
            <LoaderCircle className="mx-auto animate-spin text-cyan-300" size={34} />
            <p className="mt-5 text-lg font-semibold">Loading Mappedin Control Tower</p>
            <p className="mt-2 text-sm text-slate-400">Preparing floors, labels, room search, and camera controls.</p>
          </div>
        </div>
      )}

      {loadState === 'error' && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-950 px-6">
          <div className="max-w-lg rounded-3xl border border-red-300/20 bg-red-400/10 p-8 text-center">
            <AlertTriangle className="mx-auto text-red-300" size={34} />
            <h1 className="mt-4 text-xl font-semibold">Map failed to load</h1>
            <p className="mt-3 text-sm text-slate-300">{errorMessage}</p>
            <button className="mt-6 rounded-xl bg-white px-5 py-2 text-sm font-semibold text-slate-950" type="button" onClick={() => setReloadKey((value) => value + 1)}>
              Try again
            </button>
          </div>
        </div>
      )}

      {loadState === 'ready' && (
        <>
          <div className="pointer-events-none absolute left-6 top-5 z-20 flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/75 px-4 py-3 shadow-2xl backdrop-blur-xl">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-300 text-slate-950">
              <Radar size={20} />
            </div>
            <div>
              <p className="text-sm font-semibold">Mappedin Control Tower</p>
              <p className="text-xs text-slate-400">Demo2 · full-map operations console</p>
            </div>
          </div>

          <div className="absolute right-6 top-5 z-30 flex items-center gap-2">
            <button type="button" onClick={() => setUiVisible((value) => !value)} className="rounded-xl border border-white/10 bg-slate-950/80 px-3 py-2 text-xs font-semibold text-slate-200 backdrop-blur-xl">
              {uiVisible ? 'Hide UI' : 'Show UI'}
            </button>
            <button type="button" onClick={() => void enterFullscreen()} className="rounded-xl border border-white/10 bg-slate-950/80 p-2.5 text-slate-200 backdrop-blur-xl" aria-label="Fullscreen">
              <Expand size={17} />
            </button>
            <Link to="/" className="rounded-xl border border-white/10 bg-slate-950/80 px-3 py-2 text-xs font-semibold text-slate-200 backdrop-blur-xl">
              <ArrowLeft className="mr-1 inline" size={14} /> Website
            </Link>
          </div>

          {uiVisible && (
            <>
              <aside className="absolute bottom-6 left-6 top-24 z-20 flex w-[24rem] flex-col rounded-3xl border border-white/10 bg-slate-950/82 shadow-2xl backdrop-blur-xl">
                <div className="border-b border-white/10 p-5">
                  <label className="relative block">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={17} />
                    <input
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' && firstMatch) focusSpace(firstMatch)
                      }}
                      placeholder="Search mapped rooms"
                      className="w-full rounded-xl border border-white/10 bg-white/[0.06] py-3 pl-10 pr-4 text-sm outline-none placeholder:text-slate-500 focus:border-cyan-300/50"
                    />
                  </label>
                </div>

                <div className="border-b border-white/10 p-5">
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Floors</p>
                    <span className="text-xs text-slate-500">{floors.length} loaded</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {floors.map((floor) => (
                      <button
                        key={floor.id}
                        type="button"
                        onClick={() => changeFloor(floor.id)}
                        className={`rounded-xl border px-3 py-2 text-left text-sm transition ${
                          currentFloorId === floor.id
                            ? 'border-cyan-300/50 bg-cyan-300/15 text-cyan-100'
                            : 'border-white/10 bg-white/[0.04] text-slate-300 hover:bg-white/10'
                        }`}
                      >
                        {floor.name}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto p-5">
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Spaces</p>
                    <span className="text-xs text-slate-500">{namedSpaces.length} named</span>
                  </div>
                  <div className="space-y-2">
                    {visibleSpaces.map((space) => {
                      const id = String((space as Record<string, unknown>).id ?? '')
                      const name = formatName((space as Record<string, unknown>).name, 'Unnamed space')
                      return (
                        <button
                          key={id}
                          type="button"
                          onClick={() => focusSpace(space)}
                          className={`w-full rounded-xl border px-3 py-2 text-left transition ${
                            selectedSpaceId === id
                              ? 'border-cyan-300/50 bg-cyan-300/15 text-white'
                              : 'border-white/10 bg-white/[0.035] text-slate-300 hover:bg-white/[0.08]'
                          }`}
                        >
                          <span className="block truncate text-sm font-medium">{name}</span>
                          <span className="mt-1 block truncate text-[11px] text-slate-500">{id || 'mappedin-space'}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              </aside>

              <section className="absolute bottom-6 right-6 z-20 w-[26rem] rounded-3xl border border-white/10 bg-slate-950/82 p-5 shadow-2xl backdrop-blur-xl">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">Selected mapped location</p>
                <h2 className="mt-3 text-2xl font-semibold">{selectedName}</h2>
                <p className="mt-2 text-sm leading-6 text-slate-400">
                  Click labels, choose a room, or search by name. This panel is ready to become the equipment, low-voltage, QC, photo, and documents layer.
                </p>

                <div className="mt-5 grid grid-cols-3 gap-3">
                  <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
                    <Layers3 className="text-cyan-300" size={18} />
                    <p className="mt-2 text-lg font-semibold">{floors.length}</p>
                    <p className="text-[11px] text-slate-500">floors</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
                    <MapPin className="text-cyan-300" size={18} />
                    <p className="mt-2 text-lg font-semibold">{namedSpaces.length}</p>
                    <p className="text-[11px] text-slate-500">spaces</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
                    <Compass className="text-cyan-300" size={18} />
                    <p className="mt-2 text-lg font-semibold">{Math.round(bearing)}°</p>
                    <p className="text-[11px] text-slate-500">bearing</p>
                  </div>
                </div>

                <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.04] p-3">
                  <button type="button" onClick={requestLocation} className="inline-flex items-center gap-2 rounded-xl bg-cyan-300 px-3 py-2 text-xs font-bold text-slate-950">
                    <LocateFixed size={15} /> Use my location
                  </button>
                  <p className="mt-2 text-xs leading-5 text-slate-400">{locationState.message}</p>
                </div>
              </section>

              <div className="absolute left-1/2 top-5 z-20 flex -translate-x-1/2 flex-wrap justify-center gap-2 rounded-2xl border border-white/10 bg-slate-950/82 p-2 shadow-2xl backdrop-blur-xl">
                <button type="button" onClick={() => applyCamera(bearing - 20, Math.max(pitch, 45))} className="rounded-xl border border-white/10 bg-white/[0.05] p-2.5 text-slate-200 hover:bg-white/10" aria-label="Rotate left">
                  <RotateCcw size={17} />
                </button>
                <button type="button" onClick={() => applyCamera(bearing + 20, Math.max(pitch, 45))} className="rounded-xl border border-white/10 bg-white/[0.05] p-2.5 text-slate-200 hover:bg-white/10" aria-label="Rotate right">
                  <RotateCw size={17} />
                </button>
                <button type="button" onClick={() => applyCamera(bearing, Math.min(75, pitch + 8))} className="rounded-xl border border-white/10 bg-white/[0.05] p-2.5 text-slate-200 hover:bg-white/10" aria-label="Increase pitch">
                  <Plus size={17} />
                </button>
                <button type="button" onClick={() => applyCamera(bearing, Math.max(0, pitch - 8))} className="rounded-xl border border-white/10 bg-white/[0.05] p-2.5 text-slate-200 hover:bg-white/10" aria-label="Decrease pitch">
                  <Minus size={17} />
                </button>
                <button type="button" onClick={toggleTopDown} className="rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-white/10">
                  <Compass className="mr-1 inline" size={15} /> {cameraMode === 'top' ? '3D View' : 'Top View'}
                </button>
                <button type="button" onClick={toggleOrbit} className={`rounded-xl border px-3 py-2 text-xs font-semibold ${orbiting ? 'border-cyan-300/50 bg-cyan-300/15 text-cyan-100' : 'border-white/10 bg-white/[0.05] text-slate-200 hover:bg-white/10'}`}>
                  <TimerReset className="mr-1 inline" size={15} /> {orbiting ? 'Stop Orbit' : 'Auto Orbit'}
                </button>
                <button type="button" onClick={() => void toggleLabels()} className="rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-white/10">
                  {labelsVisible ? <EyeOff className="mr-1 inline" size={15} /> : <Eye className="mr-1 inline" size={15} />} {labelsVisible ? 'Hide Labels' : 'Show Labels'}
                </button>
                <button type="button" onClick={resetView} className="rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-white/10">
                  <RotateCcw className="mr-1 inline" size={15} /> Reset
                </button>
              </div>

              <div className="absolute bottom-6 left-1/2 z-20 -translate-x-1/2 rounded-full border border-white/10 bg-slate-950/75 px-4 py-2 text-xs text-slate-300 shadow-2xl backdrop-blur-xl">
                <Tags className="mr-2 inline text-cyan-300" size={14} />
                Tip: drag to pan, scroll/pinch to zoom, and use the camera bar for reliable 360° control when Ctrl/Command-drag is inconsistent.
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}

export default MappedinControlTowerDemoPage
