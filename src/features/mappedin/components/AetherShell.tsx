import type { ReactNode } from 'react'

export type AetherShellProps = {
  mapCanvas: ReactNode
  topBar?: ReactNode
  topOmnibox?: ReactNode
  leftRail?: ReactNode
  rightMissionControl?: ReactNode
  bottomStatusBar?: ReactNode
  search?: ReactNode
  navigation?: ReactNode
  blueDot?: ReactNode
  selection?: ReactNode
  glassPanels?: ReactNode
}

function AetherGlassPanel({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-cyan-100/10 bg-[#071018]/78 shadow-[0_20px_70px_rgba(0,0,0,0.42)] ring-1 ring-white/[0.03] backdrop-blur-2xl transition duration-300 ease-out hover:border-cyan-100/16 hover:bg-[#071018]/86">
      {children}
    </div>
  )
}

function AetherShell({
  mapCanvas,
  topBar,
  topOmnibox,
  leftRail,
  rightMissionControl,
  bottomStatusBar,
  search,
  navigation,
  blueDot,
  selection,
  glassPanels,
}: AetherShellProps) {
  return (
    <div className="relative h-[100dvh] overflow-hidden bg-[#03070c] text-slate-100">
      <div className="absolute inset-0 bg-[#03070c]">{mapCanvas}</div>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,rgba(34,211,238,0.12),transparent_34%),linear-gradient(90deg,rgba(3,7,12,0.62),transparent_24%,transparent_76%,rgba(3,7,12,0.66)),linear-gradient(180deg,rgba(3,7,12,0.72),transparent_20%,transparent_72%,rgba(3,7,12,0.8))]" />
      <div className="pointer-events-none absolute inset-0 shadow-[inset_0_0_140px_rgba(0,0,0,0.72)]" />

      {blueDot && (
        <div className="pointer-events-none absolute inset-0 z-20">{blueDot}</div>
      )}

      {(topBar || topOmnibox) && (
        <header className="absolute inset-x-3 top-3 z-40 md:inset-x-5 md:top-5">
          <div className="grid gap-3 lg:grid-cols-[minmax(15rem,0.78fr)_minmax(24rem,1.42fr)]">
            {topBar && <AetherGlassPanel>{topBar}</AetherGlassPanel>}
            {topOmnibox && <AetherGlassPanel>{topOmnibox}</AetherGlassPanel>}
          </div>
        </header>
      )}

      {(leftRail || search || navigation) && (
        <aside className="absolute bottom-28 left-3 top-32 z-30 hidden w-[min(22rem,calc(100%-2rem))] flex-col gap-3 md:flex lg:top-28">
          {leftRail && <AetherGlassPanel>{leftRail}</AetherGlassPanel>}
          {search && <AetherGlassPanel>{search}</AetherGlassPanel>}
          {navigation && <AetherGlassPanel>{navigation}</AetherGlassPanel>}
        </aside>
      )}

      {(rightMissionControl || selection) && (
        <aside className="absolute bottom-28 right-3 top-32 z-30 hidden w-[min(25rem,calc(100%-2rem))] flex-col gap-3 lg:flex lg:top-28">
          {rightMissionControl && (
            <AetherGlassPanel>{rightMissionControl}</AetherGlassPanel>
          )}
          {selection && <AetherGlassPanel>{selection}</AetherGlassPanel>}
        </aside>
      )}

      {bottomStatusBar && (
        <footer className="absolute inset-x-3 bottom-3 z-40 md:inset-x-5 md:bottom-5">
          <AetherGlassPanel>{bottomStatusBar}</AetherGlassPanel>
        </footer>
      )}

      {(leftRail || search || navigation || rightMissionControl || selection) && (
        <div className="absolute inset-x-3 bottom-24 z-30 grid gap-3 md:hidden">
          {(leftRail || search || navigation) && (
            <AetherGlassPanel>
              <div className="flex divide-x divide-white/10">
                {leftRail && <div className="min-w-0 flex-1">{leftRail}</div>}
                {search && <div className="min-w-0 flex-1">{search}</div>}
                {navigation && (
                  <div className="min-w-0 flex-1">{navigation}</div>
                )}
              </div>
            </AetherGlassPanel>
          )}
          {(rightMissionControl || selection) && (
            <AetherGlassPanel>
              <div className="flex divide-x divide-white/10">
                {rightMissionControl && (
                  <div className="min-w-0 flex-1">{rightMissionControl}</div>
                )}
                {selection && <div className="min-w-0 flex-1">{selection}</div>}
              </div>
            </AetherGlassPanel>
          )}
        </div>
      )}

      {glassPanels && <div className="absolute inset-0 z-50">{glassPanels}</div>}
    </div>
  )
}

export default AetherShell
