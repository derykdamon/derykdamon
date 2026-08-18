import type { ReactNode } from 'react'

export type AetherShellProps = {
  mapCanvas: ReactNode
  topBar?: ReactNode
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
    <div className="rounded-2xl border border-white/10 bg-[#07111a]/88 shadow-2xl backdrop-blur-xl">
      {children}
    </div>
  )
}

function AetherShell({
  mapCanvas,
  topBar,
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
    <div className="relative h-[100dvh] overflow-hidden bg-[#050816] text-slate-100">
      <div className="absolute inset-0">{mapCanvas}</div>

      {blueDot && (
        <div className="pointer-events-none absolute inset-0 z-20">{blueDot}</div>
      )}

      {topBar && (
        <header className="absolute inset-x-4 top-4 z-40">
          <AetherGlassPanel>{topBar}</AetherGlassPanel>
        </header>
      )}

      {(leftRail || search || navigation) && (
        <aside className="absolute bottom-24 left-4 top-24 z-30 flex w-[min(24rem,calc(100%-2rem))] flex-col gap-3">
          {leftRail && <AetherGlassPanel>{leftRail}</AetherGlassPanel>}
          {search && <AetherGlassPanel>{search}</AetherGlassPanel>}
          {navigation && <AetherGlassPanel>{navigation}</AetherGlassPanel>}
        </aside>
      )}

      {(rightMissionControl || selection) && (
        <aside className="absolute bottom-24 right-4 top-24 z-30 flex w-[min(26rem,calc(100%-2rem))] flex-col gap-3">
          {rightMissionControl && (
            <AetherGlassPanel>{rightMissionControl}</AetherGlassPanel>
          )}
          {selection && <AetherGlassPanel>{selection}</AetherGlassPanel>}
        </aside>
      )}

      {bottomStatusBar && (
        <footer className="absolute inset-x-4 bottom-4 z-40">
          <AetherGlassPanel>{bottomStatusBar}</AetherGlassPanel>
        </footer>
      )}

      {glassPanels && <div className="absolute inset-0 z-50">{glassPanels}</div>}
    </div>
  )
}

export default AetherShell
