import {
  AlertTriangle,
  Activity,
  Compass,
  Database,
  LoaderCircle,
  LocateFixed,
  MapPin,
  Navigation,
  RotateCcw,
  Search,
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import AetherShell from './components/AetherShell'
import {
  createCameraController,
  type CameraController,
} from './core/cameraController'
import { initializeMappedinMap } from './core/mapLifecycle'
import { presenceActions } from './core/presenceSubsystem'
import { worldActions } from './core/worldSubsystem'
import type { LoadState, MapView } from './types/mappedinTypes'

type AetherShellState = LoadState

function AetherMappedinPage() {
  const mapElementRef = useRef<HTMLDivElement>(null)
  const mapViewRef = useRef<MapView | null>(null)
  const cameraControllerRef = useRef<CameraController | null>(null)
  const wakeTimerRef = useRef<number | null>(null)
  const [loadState, setLoadState] = useState<AetherShellState>('loading')
  const [errorMessage, setErrorMessage] = useState('')
  const [reloadKey, setReloadKey] = useState(0)

  const loadMap = useCallback(async () => {
    const mapElement = mapElementRef.current
    if (!mapElement) return undefined

    setLoadState('loading')
    setErrorMessage('')

    if (wakeTimerRef.current) {
      window.clearTimeout(wakeTimerRef.current)
      wakeTimerRef.current = null
    }

    const { mapData, mapView, token } = await initializeMappedinMap(mapElement)
    mapViewRef.current = mapView

    worldActions.normalizeFromMapData(mapData, {
      fallbackFloorName: mapView.currentFloor?.name || 'Mapped floor',
      floorSort: 'semantic-asc',
    })
    worldActions.setVenue({
      type: 'venue',
      worldId: `venue:${token.mapId}`,
      externalId: token.mapId,
      name: 'Mappedin Venue',
    })
    worldActions.setBuilding({
      type: 'building',
      worldId: `building:${token.mapId}`,
      venueId: `venue:${token.mapId}`,
      externalId: token.mapId,
      name: 'Aether Building',
    })

    presenceActions.setCurrentFloor({
      id: String(mapView.currentFloor.id),
      worldId: `floor:${mapView.currentFloor.id}`,
      type: 'floor',
      name: mapView.currentFloor.name || 'Current floor',
      elevation: Number(mapView.currentFloor.elevation ?? 0),
    })

    const cameraController = createCameraController(mapView, {
      initialPitch: 0,
      initialZoom: 13.2,
      initialPreset: 'top',
    })
    cameraControllerRef.current = cameraController
    cameraController.reset(mapView.currentFloor, {
      pitch: 0,
      zoom: 13.2,
      preset: 'top',
      applyZoom: true,
    })

    setLoadState('ready')

    wakeTimerRef.current = window.setTimeout(() => {
      cameraController.flyToFloor(mapView.currentFloor, {
        bearing: 18,
        pitch: 48,
        zoom: 14.2,
        preset: 'campus',
        applyZoom: true,
        animate: true,
        duration: 1400,
        easing: 'ease-in-out',
      })
    }, 180)

    return mapView
  }, [])

  useEffect(() => {
    let cancelled = false
    let activeMapView: MapView | undefined

    void loadMap()
      .then((mapView) => {
        if (cancelled) {
          mapView?.destroy()
          return
        }
        activeMapView = mapView
      })
      .catch((error: unknown) => {
        if (cancelled) return
        setErrorMessage(
          error instanceof Error ? error.message : 'The map failed to load.',
        )
        setLoadState('error')
      })

    return () => {
      cancelled = true
      if (wakeTimerRef.current) window.clearTimeout(wakeTimerRef.current)
      wakeTimerRef.current = null
      cameraControllerRef.current?.destroy()
      cameraControllerRef.current = null
      worldActions.reset()
      presenceActions.reset()
      mapViewRef.current = null
      activeMapView?.destroy()
    }
  }, [loadMap, reloadKey])

  return (
    <AetherShell
      mapReady={loadState === 'ready'}
      mapCanvas={<div ref={mapElementRef} className="h-full w-full" />}
      topBar={
        <div className="flex items-center justify-between gap-4 px-4 py-3.5">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-cyan-200/75">
              Aether
            </p>
            <p className="mt-1 text-sm font-semibold text-white">
              Spatial Intelligence
            </p>
          </div>
          <div className="inline-flex shrink-0 items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1.5 text-xs font-medium text-emerald-200">
            <span className="h-2 w-2 rounded-full bg-emerald-300" />
            {loadState === 'ready' ? 'Mappedin online' : 'Preparing map'}
          </div>
        </div>
      }
      topOmnibox={
        <div className="flex items-center gap-3 px-4 py-3">
          <Search size={17} className="shrink-0 text-cyan-200/80" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-slate-200">
              Search rooms, floors, assets, equipment
            </p>
            <p className="truncate text-xs text-slate-500">
              Awaiting input
            </p>
          </div>
          <div className="hidden rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] font-medium text-slate-400 sm:block">
            Idle
          </div>
        </div>
      }
      leftRail={
        <div className="space-y-4 p-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
              Systems
            </p>
            <div className="mt-3 grid gap-2">
              {[
                { icon: Compass, label: 'Camera' },
                { icon: Database, label: 'World' },
                { icon: Activity, label: 'Presence' },
              ].map((item) => (
                <div
                  key={item.label}
                  className="flex items-center gap-3 rounded-xl border border-white/8 bg-white/[0.035] px-3 py-2.5 text-sm text-slate-300 transition duration-300 ease-out hover:border-cyan-200/20 hover:bg-cyan-200/[0.06] hover:text-white"
                >
                  <item.icon size={16} className="text-cyan-200/80" />
                  <span>{item.label}</span>
                </div>
              ))}
            </div>
          </div>
          <p className="text-xs leading-5 text-slate-500">
            Aether Core
          </p>
        </div>
      }
      navigation={
        <div className="p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <Navigation size={16} className="text-cyan-300" />
            Route
          </div>
          <p className="mt-2 text-xs text-slate-500">Standby</p>
        </div>
      }
      rightMissionControl={
        <div className="space-y-4 p-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan-200/70">
              Mission Control
            </p>
            <p className="mt-2 text-lg font-semibold text-white">
              Building Context
            </p>
          </div>
          <div className="grid gap-2 text-xs text-slate-400">
            <div className="flex justify-between rounded-xl border border-white/8 bg-white/[0.035] px-3 py-2 transition duration-300 hover:border-cyan-200/20 hover:bg-cyan-200/[0.05]">
              <span>World</span>
              <span className="text-slate-300">Ready</span>
            </div>
            <div className="flex justify-between rounded-xl border border-white/8 bg-white/[0.035] px-3 py-2 transition duration-300 hover:border-cyan-200/20 hover:bg-cyan-200/[0.05]">
              <span>Presence</span>
              <span className="text-slate-300">{loadState}</span>
            </div>
          </div>
        </div>
      }
      selection={
        <div className="p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <MapPin size={16} className="text-cyan-300" />
            Focus
          </div>
          <p className="mt-2 truncate text-xs text-slate-500">No selection</p>
        </div>
      }
      blueDot={
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          <div className="flex h-10 w-10 items-center justify-center rounded-full border border-cyan-300/20 bg-cyan-300/10 text-cyan-200">
            <LocateFixed size={18} />
          </div>
        </div>
      }
      bottomStatusBar={
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-xs text-slate-400">
          <div className="flex items-center gap-3">
            <span className="h-1.5 w-1.5 rounded-full bg-cyan-300" />
            <span>Aether Core</span>
          </div>
          <div className="flex items-center gap-4">
            <span>Mappedin</span>
            <span>State: {loadState}</span>
          </div>
        </div>
      }
      glassPanels={loadState === 'ready' ? undefined : (
        <>
          {loadState === 'loading' && (
            <div className="absolute inset-0 flex items-center justify-center bg-[#050816]">
              <div className="rounded-3xl border border-white/10 bg-[#0b1120]/95 px-10 py-9 text-center shadow-2xl backdrop-blur-xl">
                <LoaderCircle
                  size={34}
                  className="mx-auto animate-spin text-cyan-300"
                />
                <p className="mt-5 text-base font-semibold text-white">
                  Loading Aether
                </p>
                <p className="mt-2 max-w-sm text-sm leading-6 text-slate-400">
                  Preparing the production spatial intelligence shell.
                </p>
              </div>
            </div>
          )}

          {loadState === 'error' && (
            <div className="absolute inset-0 flex items-center justify-center bg-[#050816] px-6">
              <div className="max-w-lg rounded-3xl border border-red-300/25 bg-red-300/[0.07] p-8 text-center shadow-2xl">
                <AlertTriangle size={34} className="mx-auto text-red-300" />
                <h1 className="mt-5 text-xl font-semibold text-white">
                  Unable to load Aether
                </h1>
                <p className="mt-3 text-sm leading-6 text-slate-300">
                  {errorMessage}
                </p>
                <button
                  type="button"
                  onClick={() => setReloadKey((current) => current + 1)}
                  className="mt-6 inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.06] px-4 py-2 text-sm font-medium text-white transition hover:bg-white/10"
                >
                  <RotateCcw size={16} />
                  Try again
                </button>
              </div>
            </div>
          )}
        </>
      )}
    />
  )
}

export default AetherMappedinPage
