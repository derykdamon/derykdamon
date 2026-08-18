import type { MapView } from '../types/mappedinTypes'

export type PresenceProviderSource = 'browser' | 'simulated' | 'future'

export type PresenceProviderUpdate = {
  latitude: number
  longitude: number
  accuracy?: number
  heading?: number | null
  floorId?: string
  source: PresenceProviderSource
}

export type PresenceProviderError = {
  message: string
  source: PresenceProviderSource
}

export type PresenceProvider = {
  id: PresenceProviderSource
  label: string
  start(
    onUpdate: (update: PresenceProviderUpdate) => void,
    onError: (error: PresenceProviderError) => void,
  ): () => void
}

export function createBrowserPresenceProvider(
  getFloorId: () => string | undefined,
): PresenceProvider {
  return {
    id: 'browser',
    label: 'Browser',
    start(onUpdate, onError) {
      if (!('geolocation' in navigator)) {
        onError({
          source: 'browser',
          message: 'Browser geolocation is unavailable.',
        })
        return () => undefined
      }

      const watchId = navigator.geolocation.watchPosition(
        (position) => {
          onUpdate({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            heading: position.coords.heading,
            floorId: getFloorId(),
            source: 'browser',
          })
        },
        (error) => {
          onError({
            source: 'browser',
            message: error.message,
          })
        },
        {
          enableHighAccuracy: true,
          maximumAge: 1000,
          timeout: 10000,
        },
      )

      return () => navigator.geolocation.clearWatch(watchId)
    },
  }
}

export function createSimulationPresenceProvider(
  mapView: MapView,
): PresenceProvider {
  return {
    id: 'simulated',
    label: 'Simulation',
    start(onUpdate) {
      const floorId = String(mapView.currentFloor.id)
      const center = mapView.Camera.center
      let angle = 0

      const publish = () => {
        angle += Math.PI / 20
        const radius = 0.000035
        onUpdate({
          latitude: center.latitude + Math.sin(angle) * radius,
          longitude: center.longitude + Math.cos(angle) * radius,
          accuracy: 8 + Math.round(Math.abs(Math.sin(angle)) * 6),
          heading: ((angle * 180) / Math.PI + 90) % 360,
          floorId,
          source: 'simulated',
        })
      }

      publish()
      const intervalId = window.setInterval(publish, 1200)

      return () => window.clearInterval(intervalId)
    },
  }
}

