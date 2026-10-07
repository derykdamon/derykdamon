import { lazy, Suspense } from 'react'
import { Route, Routes } from 'react-router'
import SiteLayout from './components/layout/SiteLayout'
const DashboardPage = lazy(() => import('./features/activation/DashboardPage'))
const AetherMappedinPage = lazy(() => import('./features/mappedin/AetherMappedinPage'))
const DemoMap = lazy(() => import('./features/mappedin/DemoMap'))
const MappedinControlTowerDemoPage = lazy(() => import('./features/mappedin/MappedinControlTowerDemoPage'))
const MappedinImmersiveDemoPage = lazy(() => import('./features/mappedin/MappedinImmersiveDemoPage'))
const MappedinMissionControlDemoPage = lazy(() => import('./features/mappedin/MappedinMissionControlDemoPage'))
const SynthesiaDemoPage = lazy(() => import('./features/synthesia/SynthesiaDemoPage'))
import AboutPage from './pages/AboutPage'
import ContactPage from './pages/ContactPage'
import HomePage from './pages/HomePage'
import PlatformPage from './pages/PlatformPage'
import SolutionsPage from './pages/SolutionsPage'
const AviationPage = lazy(() => import('./features/aviation/AviationPage'))
const AviationRequest = lazy(() => import('./features/aviation/AviationRequest'))
const AviationPortal = lazy(() => import('./features/aviation/AviationPortal'))

function App() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-950 p-10 text-slate-300" role="status">Loading…</div>}><Routes>
      <Route element={<SiteLayout />}>
        <Route index element={<HomePage />} />
        <Route path="platform" element={<PlatformPage />} />
        <Route path="solutions" element={<SolutionsPage />} />
        <Route path="about" element={<AboutPage />} />
        <Route path="contact" element={<ContactPage />} />
        <Route path="aviation" element={<AviationPage />} />
        <Route path="aviation/request" element={<AviationRequest />} />
        <Route path="aviation/portal" element={<AviationPortal />} />
      </Route>

      <Route
        path="/demo"
        element={
          <>
            <DashboardPage />
            <DemoMap />
          </>
        }
      />

      <Route path="/demo0" element={<SynthesiaDemoPage />} />
      <Route path="/demo1" element={<MappedinImmersiveDemoPage />} />
      <Route path="/demo2" element={<MappedinControlTowerDemoPage />} />
      <Route path="/demo3" element={<MappedinMissionControlDemoPage />} />
      <Route path="/mappedin" element={<AetherMappedinPage />} />
    </Routes></Suspense>
  )
}

export default App
