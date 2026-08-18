import { AlertTriangle, LoaderCircle, RotateCcw } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
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
    <div className="relative h-[100dvh] overflow-hidden bg-[#050816] text-slate-100">
      <div ref={mapElementRef} className="absolute inset-0 h-full w-full" />

      {loadState === 'loading' && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-[#050816]">
          <div className="rounded-3xl border border-white/10 bg-[#0b1120]/95 px-10 py-9 text-center shadow-2xl backdrop-blur-xl">
            <LoaderCircle size={34} className="mx-auto animate-spin text-cyan-300" />
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
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-[#050816] px-6">
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
    </div>
  )
}

export default AetherMappedinPage
