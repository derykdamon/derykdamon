import { Route, Routes } from 'react-router'
import SiteLayout from './components/layout/SiteLayout'
import DashboardPage from './features/activation/DashboardPage'
import DemoMap from './features/mappedin/DemoMap'
import MappedinControlTowerDemoPage from './features/mappedin/MappedinControlTowerDemoPage'
import MappedinImmersiveDemoPage from './features/mappedin/MappedinImmersiveDemoPage'
import MappedinMissionControlDemoPage from './features/mappedin/MappedinMissionControlDemoPage'
import SynthesiaDemoPage from './features/synthesia/SynthesiaDemoPage'
import AboutPage from './pages/AboutPage'
import ContactPage from './pages/ContactPage'
import HomePage from './pages/HomePage'
import PlatformPage from './pages/PlatformPage'
import SolutionsPage from './pages/SolutionsPage'

function App() {
  return (
    <Routes>
      <Route element={<SiteLayout />}>
        <Route index element={<HomePage />} />
        <Route path="platform" element={<PlatformPage />} />
        <Route path="solutions" element={<SolutionsPage />} />
        <Route path="about" element={<AboutPage />} />
        <Route path="contact" element={<ContactPage />} />
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
    </Routes>
  )
}

export default App
