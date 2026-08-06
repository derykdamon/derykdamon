import { getMapData, show3dMap } from '@mappedin/mappedin-js'
import { AlertTriangle, LoaderCircle, RotateCcw } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

type TokenPayload = {
  accessToken?: string
  mapId?: string
  error?: string
}

type LoadState = 'loading' | 'ready' | 'error'

function findDashboardMapPanel(): HTMLElement | null {
  const heading = Array.from(document.querySelectorAll('h2')).find(
    (element) => element.textContent?.trim() === 'Mappedin map area',
  )

  return heading?.closest('.relative') as HTMLElement | null
}

function DemoMapContent() {
  const mapElementRef = useRef<HTMLDivElement>(null)
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [errorMessage, setErrorMessage] = useState('')
  const [reloadKey, setReloadKey] = useState(0)

  const loadMap = useCallback(async () => {
    const mapElement = mapElementRef.current

    if (!mapElement) {
      return undefined
    }

    setLoadState('loading')
    setErrorMessage('')

    const tokenResponse = await fetch('/api/mappedin-token')
    const tokenPayload = (await tokenResponse.json()) as TokenPayload

    if (!tokenResponse.ok || !tokenPayload.accessToken || !tokenPayload.mapId) {
      throw new Error(
        tokenPayload.error ?? 'The Mappedin configuration could not be loaded.',
      )
    }

    const mapData = await getMapData({
      accessToken: tokenPayload.accessToken,
      mapId: tokenPayload.mapId,
    })

    const mapView = await show3dMap(mapElement, mapData, {
      lowDpi: false,
    })

    setLoadState('ready')
    return mapView
  }, [])

  useEffect(() => {
    let cancelled = false
    let activeMapView: Awaited<ReturnType<typeof show3dMap>> | undefined

    void loadMap()
      .then((mapView) => {
        if (cancelled) {
          mapView?.destroy()
          return
        }

        activeMapView = mapView
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return
        }

        const message =
          error instanceof Error ? error.message : 'The map failed to load.'
        setErrorMessage(message)
        setLoadState('error')
      })

    return () => {
      cancelled = true
      activeMapView?.destroy()
    }
  }, [loadMap, reloadKey])

  return (
    <div className="absolute inset-0 z-20 overflow-hidden bg-[#070b16]">
      <div ref={mapElementRef} className="h-full min-h-[34rem] w-full" />

      {loadState === 'loading' && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#070b16]">
          <div className="rounded-2xl border border-white/10 bg-[#0b1120]/95 px-8 py-7 text-center shadow-2xl backdrop-blur-xl">
            <LoaderCircle
              size={30}
              className="mx-auto animate-spin text-cyan-300"
            />
            <p className="mt-4 text-sm font-medium text-white">
              Loading Robley Rex VAMC
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Securing map access and preparing the digital twin
            </p>
          </div>
        </div>
      )}

      {loadState === 'error' && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#070b16] px-6">
          <div className="max-w-md rounded-2xl border border-red-300/20 bg-red-300/[0.06] p-7 text-center">
            <AlertTriangle size={30} className="mx-auto text-red-300" />
            <h2 className="mt-4 text-lg font-semibold text-white">
              Unable to load the facility map
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              {errorMessage}
            </p>
            <button
              type="button"
              onClick={() => setReloadKey((current) => current + 1)}
              className="mt-5 inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-4 py-2 text-sm font-medium text-white transition hover:bg-white/10"
            >
              <RotateCcw size={16} />
              Try again
            </button>
          </div>
        </div>
      )}

      {loadState === 'ready' && (
        <div className="pointer-events-none absolute left-4 top-4 rounded-full border border-emerald-300/20 bg-[#07111a]/85 px-3 py-1.5 text-xs font-medium text-emerald-200 backdrop-blur-md">
          <span className="mr-2 inline-block h-2 w-2 rounded-full bg-emerald-300" />
          Live digital twin
        </div>
      )}
    </div>
  )
}

function DemoMap() {
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null)

  useEffect(() => {
    const locateTarget = () => {
      const target = findDashboardMapPanel()

      if (target) {
        setPortalTarget(target)
        return true
      }

      return false
    }

    if (locateTarget()) {
      return undefined
    }

    const observer = new MutationObserver(() => {
      if (locateTarget()) {
        observer.disconnect()
      }
    })

    observer.observe(document.body, { childList: true, subtree: true })

    return () => observer.disconnect()
  }, [])

  return portalTarget ? createPortal(<DemoMapContent />, portalTarget) : null
}

export default DemoMap
