import { getMapData, show3dMap } from '@mappedin/mappedin-js'
import {
  AlertTriangle,
  ArrowLeft,
  Compass,
  Eye,
  EyeOff,
  Expand,
  LoaderCircle,
  LocateFixed,
  MapPin,
  Minus,
  Navigation,
  PanelRightClose,
  PanelRightOpen,
  Play,
  Plus,
  Radar,
  RotateCcw,
  RotateCw,
  Search,
  Target,
  X,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router'

type LoadState = 'loading' | 'ready' | 'error'

type TokenPayload = {
  accessToken?: string
  mapId?: string
  error?: string
}

type FloorOption = {
  id: string
  name: string
  elevation: number
  sortOrder: number
}

type SpaceOption = {
  id: string
  name: string
  floorName: string
  raw: any
}

type LocationState = {
  status: 'off' | 'requesting' | 'ready' | 'error'
  message: string
}

const ordinalFloorRank: Record<string, number> = {
  ground: 0,
  first: 1,
  second: 2,
  third: 3,
  fourth: 4,
  fifth: 5,
  sixth: 6,
  seventh: 7,
  eighth: 8,
  ninth: 9,
  tenth: 10,
}

function safeName(value: unknown, fallback: string) {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback
}

function getFloorSortOrder(name: string, elevation: number) {
  const normalized = name.toLowerCase()

  for (const [word, value] of Object.entries(ordinalFloorRank)) {
    if (normalized.includes(word)) return value
  }

  if (Number.isFinite(elevation)) return elevation
  return 999
}

async function addPersistentLabels(mapView: any, spaces: SpaceOption[]) {
  mapView.Labels.removeAll()

  await Promise.all(
    spaces.slice(0, 1200).map((space) =>
      mapView.Labels.add(space.raw, space.name, {
        interactive: true,
        enabled: true,
        rank: 'always-visible',
        appearance: {
          margin: 8,
          maxLines: 2,
          maxWidth: 185,
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

function MappedinMissionControlDemoPage() {
  const rootRef = useRef<HTMLDivElement>(null)
  const mapElementRef = useRef<HTMLDivElement>(null)
  const mapViewRef = useRef<any>(null)
  const spacesRef = useRef<SpaceOption[]>([])
  const orbitTimerRef = useRef<number | null>(null)
  const bearingRef = useRef(0)
  const pitchRef = useRef(45)
  const zoomRef = useRef(12.2)

  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [errorMessage, setErrorMessage] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const [floors, setFloors] = useState<FloorOption[]>([])
  const [currentFloorId, setCurrentFloorId] = useState('')
  const [spaces, setSpaces] = useState<SpaceOption[]>([])
  const [selectedSpace, setSelectedSpace] = useState<SpaceOption | null>(null)
  const [query, setQuery] = useState('')
  const [labelsVisible, setLabelsVisible] = useState(true)
  const [uiVisible, setUiVisible] = useState(true)
  const [roomPanelOpen, setRoomPanelOpen] = useState(false)
  const [searchPanelOpen, setSearchPanelOpen] = useState(false)
  const [orbiting, setOrbiting] = useState(false)
  const [viewMode, setViewMode] = useState<'campus' | 'site' | 'building' | 'top'>('campus')
  const [bearing, setBearing] = useState(0)
  const [pitch, setPitch] = useState(45)
  const [zoom, setZoom] = useState(12.2)
  const [locationState, setLocationState] = useState<LocationState>({
    status: 'off',
    message: 'Browser location has not been requested.',
  })

  const filteredSpaces = useMemo(() => {
    const value = query.trim().toLowerCase()
    const source = value
      ? spaces.filter((space) => space.name.toLowerCase().includes(value))
      : spaces

    return source.slice(0, value ? 120 : 45)
  }, [query, spaces])

  const setCamera = useCallback(
    (next: { bearing?: number; pitch?: number; zoom?: number }) => {
      const mapView = mapViewRef.current
      if (!mapView) return

      const nextBearing =
        next.bearing === undefined ? bearingRef.current : ((next.bearing % 360) + 360) % 360
      const nextPitch =
        next.pitch === undefined ? pitchRef.current : Math.max(0, Math.min(76, next.pitch))
      const nextZoom =
        next.zoom === undefined ? zoomRef.current : Math.max(9, Math.min(18, next.zoom))

      bearingRef.current = nextBearing
      pitchRef.current = nextPitch
      zoomRef.current = nextZoom

      setBearing(Math.round(nextBearing))
      setPitch(Math.round(nextPitch))
      setZoom(Number(nextZoom.toFixed(1)))

      try {
        mapView.Camera.set({ bearing: nextBearing, pitch: nextPitch, zoom: nextZoom })
      } catch {
        mapView.Camera.set({ bearing: nextBearing, pitch: nextPitch })
      }
    },
    [],
  )

  const fitCampus = useCallback(() => {
    const mapView = mapViewRef.current
    if (!mapView) return

    mapView.Camera.focusOn(mapView.currentFloor)
    window.setTimeout(() => setCamera({ bearing: 0, pitch: 45, zoom: 11.7 }), 100)
    setViewMode('campus')
  }, [setCamera])

  const fitSite = useCallback(() => {
    const mapView = mapViewRef.current
    if (!mapView) return

    mapView.Camera.focusOn(mapView.currentFloor)
    window.setTimeout(() => setCamera({ bearing: 0, pitch: 48, zoom: 12.8 }), 100)
    setViewMode('site')
  }, [setCamera])

  const fitBuilding = useCallback(() => {
    const mapView = mapViewRef.current
    if (!mapView) return

    mapView.Camera.focusOn(selectedSpace?.raw ?? mapView.currentFloor)
    window.setTimeout(() => setCamera({ bearing: bearingRef.current, pitch: 58, zoom: 14.2 }), 100)
    setViewMode('building')
  }, [selectedSpace, setCamera])

  const focusSpace = useCallback(
    (space: SpaceOption) => {
      const mapView = mapViewRef.current
      if (!mapView) return

      mapView.Camera.focusOn(space.raw)
      window.setTimeout(() => setCamera({ bearing: bearingRef.current, pitch: 58, zoom: 15 }), 100)
      setSelectedSpace(space)
      setRoomPanelOpen(true)
      setViewMode('building')
    },
    [setCamera],
  )

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

    const mapData = await getMapData({
      accessToken: tokenPayload.accessToken,
      mapId: tokenPayload.mapId,
    })
    const mapView = await show3dMap(mapElement, mapData)
    mapViewRef.current = mapView

    mapView.Camera.interactions.set({
      pan: true,
      zoom: true,
      bearingAndPitch: true,
    })

    const floorOptions: FloorOption[] = mapData
      .getByType('floor')
      .map((floor: any) => {
        const name = safeName(floor.name, `Level ${floor.elevation ?? ''}`)
        const elevation = Number(floor.elevation ?? 0)

        return {
          id: String(floor.id),
          name,
          elevation,
          sortOrder: getFloorSortOrder(name, elevation),
        }
      })
      .sort((a: FloorOption, b: FloorOption) => a.sortOrder - b.sortOrder)

    const currentFloorName = safeName(mapView.currentFloor?.name, 'Current floor')
    const spaceOptions: SpaceOption[] = mapData
      .getByType('space')
      .filter((space: any) => safeName(space.name, '').length > 0)
      .map((space: any) => ({
        id: String(space.id),
        name: safeName(space.name, 'Unnamed mapped space'),
        floorName: safeName(space.floor?.name, currentFloorName),
        raw: space,
      }))
      .sort((a: SpaceOption, b: SpaceOption) => a.name.localeCompare(b.name))

    setFloors(floorOptions)
    setCurrentFloorId(mapView.currentFloor.id)
    setSpaces(spaceOptions)
    spacesRef.current = spaceOptions

    spaceOptions.forEach((space) => {
      mapView.updateState(space.raw, {
        interactive: true,
        hoverColor: '#38bdf8',
      })
    })

    await addPersistentLabels(mapView, spaceOptions)

    mapView.on('floor-change', (event: any) => {
      setCurrentFloorId(event.floor.id)
      mapView.Camera.focusOn(event.floor)
      window.setTimeout(() => setCamera({ bearing: bearingRef.current, pitch: pitchRef.current }), 100)
    })

    mapView.on('camera-change', (transform: any) => {
      if (typeof transform.bearing === 'number') {
        const nextBearing = ((transform.bearing % 360) + 360) % 360
        bearingRef.current = nextBearing
        setBearing(Math.round(nextBearing))
      }
      if (typeof transform.pitch === 'number') {
        pitchRef.current = transform.pitch
        setPitch(Math.round(transform.pitch))
      }
      if (typeof transform.zoom === 'number') {
        zoomRef.current = transform.zoom
        setZoom(Number(transform.zoom.toFixed(1)))
      }
    })

    mapView.on('click', (event: any) => {
      const clickedSpace = event.spaces?.[0]
      const clickedLabel = event.labels?.[0]

      if (clickedSpace?.id) {
        const match = spacesRef.current.find((space) => space.id === String(clickedSpace.id))
        if (match) focusSpace(match)
        return
      }

      if (clickedLabel?.text) {
        const match = spacesRef.current.find((space) => space.name === clickedLabel.text)
        if (match) focusSpace(match)
      }
    })

    mapView.Camera.focusOn(mapView.currentFloor)
    setLoadState('ready')
    window.setTimeout(() => fitCampus(), 250)
  }, [fitCampus, focusSpace, setCamera])

  useEffect(() => {
    let cancelled = false

    void loadMap().catch((error: unknown) => {
      if (cancelled) return
      setErrorMessage(error instanceof Error ? error.message : 'The map failed to load.')
      setLoadState('error')
    })

    return () => {
      cancelled = true
      if (orbitTimerRef.current) window.clearInterval(orbitTimerRef.current)
      orbitTimerRef.current = null
      mapViewRef.current?.destroy()
      mapViewRef.current = null
    }
  }, [loadMap, reloadKey])

  const changeFloor = (floorId: string) => {
    mapViewRef.current?.setFloor(floorId)
  }

  const toggleLabels = async () => {
    const mapView = mapViewRef.current
    if (!mapView) return

    if (labelsVisible) {
      mapView.Labels.removeAll()
      setLabelsVisible(false)
    } else {
      await addPersistentLabels(mapView, spacesRef.current)
      setLabelsVisible(true)
    }
  }

  const resetView = () => {
    setSelectedSpace(null)
    setRoomPanelOpen(false)
    fitCampus()
  }

  const toggleTopDown = () => {
    if (viewMode === 'top') {
      fitCampus()
      return
    }

    setCamera({ pitch: 0, zoom: Math.min(zoomRef.current, 12.6) })
    setViewMode('top')
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
      setCamera({ bearing: bearingRef.current + 3, pitch: Math.max(pitchRef.current, 45) })
    }, 120)
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
          message: `${latitude.toFixed(5)}, ${longitude.toFixed(5)} · accuracy ${Math.round(
            accuracy,
          )} m. Off-site positions are reported here but not plotted as an indoor Blue Dot.`,
        })
      },
      () =>
        setLocationState({
          status: 'error',
          message: 'Location could not be retrieved or permission was denied.',
        }),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 },
    )
  }

  const enterFullscreen = async () => {
    if (!rootRef.current) return
    if (document.fullscreenElement) await document.exitFullscreen()
    else await rootRef.current.requestFullscreen()
  }

  const firstMatch = filteredSpaces[0]

  return (
    <div ref={rootRef} className="relative h-screen overflow-hidden bg-slate-950 text-white">
      <div ref={mapElementRef} className="absolute inset-0" />

      {loadState === 'loading' && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-950">
          <div className="rounded-3xl border border-white/10 bg-slate-900/90 p-8 text-center shadow-2xl">
            <LoaderCircle className="mx-auto animate-spin text-cyan-300" size={34} />
            <p className="mt-5 text-lg font-semibold">Loading full Mappedin map</p>
            <p className="mt-2 text-sm text-slate-400">Preparing campus view, all floors, labels, room search, and camera controls.</p>
          </div>
        </div>
      )}

      {loadState === 'error' && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-950 px-6">
          <div className="max-w-lg rounded-3xl border border-red-300/20 bg-red-400/10 p-8 text-center">
            <AlertTriangle className="mx-auto text-red-300" size={34} />
            <h1 className="mt-4 text-xl font-semibold">Map failed to load</h1>
            <p className="mt-3 text-sm text-slate-300">{errorMessage}</p>
            <button
              className="mt-6 rounded-xl bg-white px-5 py-2 text-sm font-semibold text-slate-950"
              type="button"
              onClick={() => setReloadKey((value) => value + 1)}
            >
              Try again
            </button>
          </div>
        </div>
      )}

      {loadState === 'ready' && (
        <>
          <header className="absolute left-4 right-4 top-4 z-40 rounded-3xl border border-white/10 bg-slate-950/78 p-3 shadow-2xl backdrop-blur-xl">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex min-w-fit items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-300 text-slate-950">
                  <Radar size={22} />
                </div>
                <div>
                  <p className="text-sm font-semibold">Mappedin Mission Control</p>
                  <p className="text-xs text-slate-400">Demo3 · full map · campus context · real floors · real labels</p>
                </div>
              </div>

              <div className="flex flex-1 flex-wrap items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] p-2">
                <span className="hidden text-[10px] font-semibold uppercase tracking-[0.28em] text-slate-500 md:inline">
                  Ground → higher
                </span>
                {floors.map((floor) => (
                  <button
                    key={floor.id}
                    type="button"
                    onClick={() => changeFloor(floor.id)}
                    className={`rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                      currentFloorId === floor.id
                        ? 'border-cyan-300/60 bg-cyan-300/18 text-cyan-50'
                        : 'border-white/10 bg-slate-900/70 text-slate-300 hover:bg-white/10'
                    }`}
                  >
                    {floor.name}
                  </button>
                ))}
              </div>

              <div className="flex min-w-fit items-center justify-end gap-2">
                <button type="button" onClick={() => setUiVisible((value) => !value)} className="rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2 text-xs font-semibold text-slate-200">
                  {uiVisible ? 'Hide UI' : 'Show UI'}
                </button>
                <button type="button" onClick={() => void enterFullscreen()} className="rounded-xl border border-white/10 bg-white/[0.06] p-2.5 text-slate-200" aria-label="Fullscreen">
                  <Expand size={17} />
                </button>
                <Link to="/" className="rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2 text-xs font-semibold text-slate-200">
                  <ArrowLeft className="mr-1 inline" size={14} /> Website
                </Link>
              </div>
            </div>
          </header>

          {uiVisible && (
            <>
              <div className="absolute left-4 top-40 z-30 flex flex-col gap-3">
                <button type="button" onClick={() => setSearchPanelOpen((value) => !value)} className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-slate-950/78 px-4 py-3 text-sm font-semibold shadow-2xl backdrop-blur-xl">
                  <Search size={17} /> {searchPanelOpen ? 'Close room list' : 'Search rooms'}
                </button>
                <div className="rounded-2xl border border-white/10 bg-slate-950/78 px-4 py-3 text-xs text-slate-300 shadow-2xl backdrop-blur-xl">
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div><p className="text-lg font-semibold text-white">{floors.length}</p><p className="text-slate-500">Floors</p></div>
                    <div><p className="text-lg font-semibold text-white">{spaces.length}</p><p className="text-slate-500">Spaces</p></div>
                    <div><p className="text-lg font-semibold text-cyan-200">{viewMode}</p><p className="text-slate-500">View</p></div>
                  </div>
                </div>
              </div>

              {searchPanelOpen && (
                <aside className="absolute bottom-6 left-4 top-64 z-30 flex w-[min(24rem,calc(100vw-2rem))] flex-col rounded-3xl border border-white/10 bg-slate-950/86 shadow-2xl backdrop-blur-xl">
                  <div className="border-b border-white/10 p-4">
                    <label className="relative block">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={17} />
                      <input
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        onKeyDown={(event) => event.key === 'Enter' && firstMatch && focusSpace(firstMatch)}
                        placeholder="Search mapped rooms / spaces"
                        className="w-full rounded-xl border border-white/10 bg-white/[0.06] py-3 pl-10 pr-4 text-sm outline-none placeholder:text-slate-500 focus:border-cyan-300/50"
                      />
                    </label>
                  </div>
                  <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-4">
                    {filteredSpaces.map((space) => (
                      <button
                        key={space.id}
                        type="button"
                        onClick={() => focusSpace(space)}
                        className={`w-full rounded-2xl border p-3 text-left transition ${
                          selectedSpace?.id === space.id
                            ? 'border-cyan-300/55 bg-cyan-300/15'
                            : 'border-white/10 bg-white/[0.04] hover:bg-white/[0.08]'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <MapPin className="mt-0.5 text-cyan-300" size={16} />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-white">{space.name}</p>
                            <p className="mt-1 text-xs text-slate-500">{space.floorName}</p>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </aside>
              )}

              <div className="absolute bottom-5 left-5 z-30 rounded-3xl border border-white/10 bg-slate-950/82 p-3 shadow-2xl backdrop-blur-xl">
                <div className="grid grid-cols-4 gap-2">
                  <button type="button" onClick={fitCampus} className={`rounded-xl border px-3 py-2 text-sm font-semibold ${viewMode === 'campus' ? 'border-cyan-300/55 bg-cyan-300/16 text-cyan-50' : 'border-white/10 bg-white/[0.05] text-slate-200'}`}><Navigation className="mr-1 inline" size={15} />Campus</button>
                  <button type="button" onClick={fitSite} className={`rounded-xl border px-3 py-2 text-sm font-semibold ${viewMode === 'site' ? 'border-cyan-300/55 bg-cyan-300/16 text-cyan-50' : 'border-white/10 bg-white/[0.05] text-slate-200'}`}><Target className="mr-1 inline" size={15} />Site</button>
                  <button type="button" onClick={fitBuilding} className={`rounded-xl border px-3 py-2 text-sm font-semibold ${viewMode === 'building' ? 'border-cyan-300/55 bg-cyan-300/16 text-cyan-50' : 'border-white/10 bg-white/[0.05] text-slate-200'}`}><MapPin className="mr-1 inline" size={15} />Bldg</button>
                  <button type="button" onClick={toggleTopDown} className={`rounded-xl border px-3 py-2 text-sm font-semibold ${viewMode === 'top' ? 'border-cyan-300/55 bg-cyan-300/16 text-cyan-50' : 'border-white/10 bg-white/[0.05] text-slate-200'}`}><Compass className="mr-1 inline" size={15} />Top</button>

                  <button type="button" onClick={() => setCamera({ bearing: bearingRef.current - 35 })} className="rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 text-sm font-semibold text-slate-200"><RotateCcw className="mr-1 inline" size={15} />Left</button>
                  <button type="button" onClick={() => setCamera({ bearing: bearingRef.current + 35 })} className="rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 text-sm font-semibold text-slate-200"><RotateCw className="mr-1 inline" size={15} />Right</button>
                  <button type="button" onClick={() => setCamera({ pitch: pitchRef.current + 8 })} className="rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 text-sm font-semibold text-slate-200"><Plus className="mr-1 inline" size={15} />Pitch</button>
                  <button type="button" onClick={() => setCamera({ pitch: pitchRef.current - 8 })} className="rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 text-sm font-semibold text-slate-200"><Minus className="mr-1 inline" size={15} />Pitch</button>

                  <button type="button" onClick={() => setCamera({ zoom: zoomRef.current - 0.6 })} className="rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 text-sm font-semibold text-slate-200"><Minus className="mr-1 inline" size={15} />Zoom</button>
                  <button type="button" onClick={() => setCamera({ zoom: zoomRef.current + 0.6 })} className="rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 text-sm font-semibold text-slate-200"><Plus className="mr-1 inline" size={15} />Zoom</button>
                  <button type="button" onClick={() => void toggleLabels()} className="rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 text-sm font-semibold text-slate-200">
                    {labelsVisible ? <EyeOff className="mr-1 inline" size={15} /> : <Eye className="mr-1 inline" size={15} />} {labelsVisible ? 'Labels off' : 'Labels on'}
                  </button>
                  <button type="button" onClick={toggleOrbit} className={`rounded-xl border px-3 py-2 text-sm font-semibold ${orbiting ? 'border-emerald-300/50 bg-emerald-300/15 text-emerald-100' : 'border-white/10 bg-white/[0.05] text-slate-200'}`}><Play className="mr-1 inline" size={15} />Orbit</button>

                  <button type="button" onClick={requestLocation} className="rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 text-sm font-semibold text-slate-200"><LocateFixed className="mr-1 inline" size={15} />GPS</button>
                  <button type="button" onClick={resetView} className="rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 text-sm font-semibold text-slate-200"><RotateCcw className="mr-1 inline" size={15} />Reset</button>
                  <button type="button" onClick={() => setRoomPanelOpen((value) => !value)} className="rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 text-sm font-semibold text-slate-200">{roomPanelOpen ? <PanelRightClose className="mr-1 inline" size={15} /> : <PanelRightOpen className="mr-1 inline" size={15} />}Panel</button>
                  <button type="button" onClick={() => setSelectedSpace(null)} className="rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 text-sm font-semibold text-slate-200"><X className="mr-1 inline" size={15} />Clear</button>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-3 border-t border-white/10 pt-3 text-center text-xs text-slate-400">
                  <p>Bearing: <span className="text-white">{bearing}°</span></p>
                  <p>Pitch: <span className="text-white">{pitch}°</span></p>
                  <p>Zoom: <span className="text-white">{zoom}</span></p>
                </div>
              </div>

              <div className="absolute bottom-5 right-5 z-30 w-[min(31rem,calc(100vw-2rem))] rounded-3xl border border-white/10 bg-slate-950/78 p-5 text-sm shadow-2xl backdrop-blur-xl">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-300">Map instructions</p>
                <p className="mt-3 leading-6 text-slate-300">
                  Demo3 now opens in a wider campus view. Use Campus/Site/Building to jump between surrounding-area context and the facility. Floor buttons run Ground → higher, with all mapped floors shown.
                </p>
                <p className="mt-3 text-xs leading-5 text-slate-500">
                  Drag to pan. Scroll or pinch to zoom. Right-click/Control/Command drag may rotate depending on browser and device. The buttons provide the reliable 360° fallback.
                </p>
                {locationState.status !== 'off' && (
                  <p className="mt-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-xs leading-5 text-slate-300">
                    {locationState.status === 'requesting' && <LoaderCircle className="mr-2 inline animate-spin" size={14} />}
                    {locationState.message}
                  </p>
                )}
              </div>
            </>
          )}

          {roomPanelOpen && selectedSpace && (
            <aside className="absolute right-5 top-40 z-40 w-[min(27rem,calc(100vw-2rem))] rounded-3xl border border-white/10 bg-slate-950/86 p-6 shadow-2xl backdrop-blur-xl">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Selected space</p>
                  <h2 className="mt-3 text-2xl font-semibold">{selectedSpace.name}</h2>
                  <p className="mt-2 text-sm text-slate-400">{selectedSpace.floorName}</p>
                </div>
                <button type="button" onClick={() => setRoomPanelOpen(false)} className="rounded-xl border border-white/10 bg-white/[0.05] p-2 text-slate-300" aria-label="Close selected space panel">
                  <X size={17} />
                </button>
              </div>

              <dl className="mt-6 space-y-4 text-sm">
                <div className="flex justify-between gap-4 border-b border-white/10 pb-3"><dt className="text-slate-500">Mappedin ID</dt><dd className="max-w-[14rem] truncate text-right text-slate-200">{selectedSpace.id}</dd></div>
                <div className="flex justify-between gap-4 border-b border-white/10 pb-3"><dt className="text-slate-500">Labels</dt><dd className="text-slate-200">{labelsVisible ? 'Visible' : 'Hidden'}</dd></div>
                <div className="flex justify-between gap-4 border-b border-white/10 pb-3"><dt className="text-slate-500">Current view</dt><dd className="text-slate-200">{viewMode}</dd></div>
              </dl>

              <div className="mt-6 rounded-2xl border border-cyan-300/20 bg-cyan-300/10 p-4">
                <p className="font-semibold text-cyan-100">Next product layer</p>
                <p className="mt-2 text-sm leading-6 text-slate-300">
                  Link this Mappedin space ID to equipment, low-voltage, QC, documents, DITL, photos, and readiness records.
                </p>
              </div>
            </aside>
          )}
        </>
      )}
    </div>
  )
}

export default MappedinMissionControlDemoPage
