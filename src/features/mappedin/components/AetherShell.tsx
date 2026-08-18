import type { ReactNode } from 'react'

export type AetherShellProps = {
  mapCanvas: ReactNode
  mapReady?: boolean
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
    <div className="group relative overflow-hidden rounded-2xl border border-cyan-100/[0.035] bg-[#071018]/28 ring-1 ring-white/[0.015] backdrop-blur-[44px] transition duration-500 ease-out hover:border-cyan-100/[0.085] hover:bg-[#071018]/46">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-200/18 to-transparent opacity-28 transition-opacity duration-500 group-hover:opacity-56" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.03),transparent_32%,transparent_74%,rgba(34,211,238,0.016))] opacity-32 transition-opacity duration-500 group-hover:opacity-52" />
      <div className="relative">{children}</div>
    </div>
  )
}

function AetherShell({
  mapCanvas,
  mapReady = false,
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
      <div
        className={`absolute inset-0 bg-[#03070c] contrast-[1.2] saturate-[1.08] brightness-[1.06] transition-[opacity,filter,transform] duration-[1600ms] ease-out ${
          mapReady
            ? 'opacity-100 blur-0 animate-[aether-map-breathe_9s_ease-in-out_1.5s_infinite]'
            : 'opacity-0 blur-sm'
        }`}
      >
        {mapCanvas}
      </div>
      {!mapReady && (
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,rgba(34,211,238,0.12),transparent_34%),linear-gradient(90deg,rgba(3,7,12,0.62),transparent_24%,transparent_76%,rgba(3,7,12,0.66)),linear-gradient(180deg,rgba(3,7,12,0.72),transparent_20%,transparent_72%,rgba(3,7,12,0.8))]" />
      )}
      {mapReady && (
        <div className="pointer-events-none absolute inset-0 z-10 animate-[aether-world-reveal_1800ms_ease-out_both] bg-[#03070c]" />
      )}
      <div
        className={`pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(34,211,238,0.05),transparent_24%),radial-gradient(circle_at_82%_14%,rgba(59,130,246,0.04),transparent_26%),radial-gradient(circle_at_50%_100%,rgba(20,184,166,0.03),transparent_30%)] mix-blend-screen transition-opacity duration-[1800ms] ${
          mapReady
            ? 'animate-[aether-light-breathe_8s_ease-in-out_1.2s_infinite] opacity-30'
            : 'opacity-0'
        }`}
      />
      <div
        className={`pointer-events-none absolute inset-0 shadow-[inset_0_0_54px_rgba(0,0,0,0.28)] transition-opacity duration-[1800ms] ${
          mapReady ? 'opacity-100' : 'opacity-0'
        }`}
      />

      {blueDot && (
        <div className="pointer-events-none absolute inset-0 z-20">{blueDot}</div>
      )}

      {(topBar || topOmnibox) && (
        <header className="absolute inset-x-4 top-4 z-40 animate-[aether-panel-in_700ms_ease-out_both] opacity-80 transition-opacity duration-500 hover:opacity-100 md:inset-x-8 md:top-7">
          <div className="grid gap-4 lg:grid-cols-[minmax(14rem,0.68fr)_minmax(24rem,1.32fr)]">
            {topBar && <AetherGlassPanel>{topBar}</AetherGlassPanel>}
            {topOmnibox && <AetherGlassPanel>{topOmnibox}</AetherGlassPanel>}
          </div>
        </header>
      )}

      {(leftRail || search || navigation) && (
        <aside className="absolute bottom-32 left-5 top-40 z-30 hidden w-[min(20rem,calc(100%-2rem))] animate-[aether-panel-left_820ms_ease-out_120ms_both] flex-col gap-5 opacity-[0.55] transition-opacity duration-500 hover:opacity-[0.92] md:flex lg:left-8 lg:top-36">
          {leftRail && <AetherGlassPanel>{leftRail}</AetherGlassPanel>}
          {search && <AetherGlassPanel>{search}</AetherGlassPanel>}
          {navigation && <AetherGlassPanel>{navigation}</AetherGlassPanel>}
        </aside>
      )}

      {(rightMissionControl || selection) && (
        <aside className="absolute bottom-32 right-5 top-40 z-30 hidden w-[min(23rem,calc(100%-2rem))] animate-[aether-panel-right_820ms_ease-out_180ms_both] flex-col gap-5 opacity-[0.65] transition-opacity duration-500 hover:opacity-95 lg:right-8 lg:flex lg:top-36">
          {rightMissionControl && (
            <AetherGlassPanel>{rightMissionControl}</AetherGlassPanel>
          )}
          {selection && <AetherGlassPanel>{selection}</AetherGlassPanel>}
        </aside>
      )}

      {bottomStatusBar && (
        <footer className="absolute inset-x-4 bottom-4 z-40 animate-[aether-panel-up_760ms_ease-out_240ms_both] opacity-[0.68] transition-opacity duration-500 hover:opacity-95 md:inset-x-8 md:bottom-7">
          <AetherGlassPanel>{bottomStatusBar}</AetherGlassPanel>
        </footer>
      )}

      {(leftRail || search || navigation || rightMissionControl || selection) && (
        <div className="absolute inset-x-3 bottom-24 z-30 grid animate-[aether-panel-up_760ms_ease-out_180ms_both] gap-3 md:hidden">
          {(leftRail || search || navigation) && (
            <AetherGlassPanel>
              <div className="flex divide-x divide-white/[0.055]">
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
              <div className="flex divide-x divide-white/[0.055]">
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
      <style>{`
        @keyframes aether-panel-in {
          from { opacity: 0; transform: translateY(-14px) scale(0.985); filter: blur(8px); }
          to { opacity: 1; transform: translateY(0) scale(1); filter: blur(0); }
        }
        @keyframes aether-panel-left {
          from { opacity: 0; transform: translateX(-18px) scale(0.985); filter: blur(8px); }
          to { opacity: 1; transform: translateX(0) scale(1); filter: blur(0); }
        }
        @keyframes aether-panel-right {
          from { opacity: 0; transform: translateX(18px) scale(0.985); filter: blur(8px); }
          to { opacity: 1; transform: translateX(0) scale(1); filter: blur(0); }
        }
        @keyframes aether-panel-up {
          from { opacity: 0; transform: translateY(16px) scale(0.985); filter: blur(8px); }
          to { opacity: 1; transform: translateY(0) scale(1); filter: blur(0); }
        }
        @keyframes aether-world-reveal {
          0% { opacity: 1; filter: blur(10px); }
          58% { opacity: 0.34; filter: blur(3px); }
          100% { opacity: 0; filter: blur(0); }
        }
        @keyframes aether-map-breathe {
          0%, 100% { transform: scale(1); filter: contrast(1.2) saturate(1.08) brightness(1.06); }
          50% { transform: scale(1.005); filter: contrast(1.24) saturate(1.12) brightness(1.08); }
        }
        @keyframes aether-light-breathe {
          0%, 100% { opacity: 0.24; }
          50% { opacity: 0.38; }
        }
        .aether-blue-dot {
          position: relative;
          display: grid;
          width: 22px;
          height: 22px;
          place-items: center;
          border-radius: 999px;
          border: 3px solid rgba(255,255,255,0.96);
          background: #22d3ee;
          box-shadow: 0 0 0 1px rgba(8,47,73,0.32), 0 12px 32px rgba(34,211,238,0.42);
        }
        .aether-blue-dot::before {
          content: "";
          position: absolute;
          inset: -10px;
          border-radius: inherit;
          background: radial-gradient(circle, rgba(34,211,238,0.36), transparent 62%);
          animation: aether-blue-dot-pulse 1800ms ease-out infinite;
        }
        .aether-blue-dot span {
          position: relative;
          width: 6px;
          height: 6px;
          border-radius: inherit;
          background: rgba(255,255,255,0.96);
        }
        .aether-accuracy-ring {
          box-sizing: border-box;
          border-radius: 999px;
          border: 2px solid rgba(34,211,238,0.32);
          background: rgba(34,211,238,0.08);
          box-shadow: inset 0 0 20px rgba(34,211,238,0.16), 0 0 36px rgba(34,211,238,0.2);
        }
        @keyframes aether-blue-dot-pulse {
          from { opacity: 0.7; transform: scale(0.65); }
          to { opacity: 0; transform: scale(1.8); }
        }
      `}</style>
    </div>
  )
}

export default AetherShell
