import {
  AlertTriangle,
  Compass,
  LoaderCircle,
  LocateFixed,
  MapPin,
  Navigation,
  RotateCcw,
  Search,
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import AetherShell from './components/AetherShell'
import { initializeMappedinMap } from './core/mapLifecycle'
import type { LoadState, MapView } from './types/mappedinTypes'

type AetherShellState = LoadState

function AetherMappedinPage() {
  const mapElementRef = useRef<HTMLDivElement>(null)
  const mapViewRef = useRef<MapView | null>(null)
  const [loadState, setLoadState] = useState<AetherShellState>('loading')
  const [errorMessage, setErrorMessage] = useState('')
  const [reloadKey, setReloadKey] = useState(0)

  const loadMap = useCallback(async () => {
    const mapElement = mapElementRef.current
    if (!mapElement) return undefined

    setLoadState('loading')
    setErrorMessage('')

    const { mapView } = await initializeMappedinMap(mapElement)
    mapViewRef.current = mapView
    setLoadState('ready')

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
      mapViewRef.current = null
      activeMapView?.destroy()
    }
  }, [loadMap, reloadKey])

  return (
    <AetherShell
      mapCanvas={<div ref={mapElementRef} className="h-full w-full" />}
      topBar={
        <div className="flex items-center justify-between gap-4 px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-white">Aether</p>
            <p className="text-xs text-slate-400">
              Production spatial intelligence shell
            </p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1.5 text-xs font-medium text-emerald-200">
            <span className="h-2 w-2 rounded-full bg-emerald-300" />
            {loadState === 'ready' ? 'Mappedin online' : 'Preparing map'}
          </div>
        </div>
      }
      leftRail={
        <div className="p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <Compass size={16} className="text-cyan-300" />
            Aether Controls
          </div>
          <p className="mt-2 text-xs leading-5 text-slate-400">
            Shared control regions are mounted here as production subsystems
            migrate out of the demos.
          </p>
        </div>
      }
      search={
        <div className="p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <Search size={16} className="text-cyan-300" />
            Search
          </div>
          <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-slate-500">
            Search region
          </div>
        </div>
      }
      navigation={
        <div className="p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <Navigation size={16} className="text-cyan-300" />
            Navigation
          </div>
          <p className="mt-2 text-xs leading-5 text-slate-400">
            Navigation region
          </p>
        </div>
      }
      rightMissionControl={
        <div className="p-4">
          <div className="text-sm font-semibold text-white">
            Mission Control
          </div>
          <p className="mt-2 text-xs leading-5 text-slate-400">
            Right-side mission region
          </p>
        </div>
      }
      selection={
        <div className="p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <MapPin size={16} className="text-cyan-300" />
            Selection
          </div>
          <p className="mt-2 text-xs leading-5 text-slate-400">
            Selection region
          </p>
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
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-xs text-slate-300">
          <span>Aether shell active</span>
          <span>Load state: {loadState}</span>
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
