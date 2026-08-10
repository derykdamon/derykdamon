import { Route, Routes } from 'react-router'
import SiteLayout from './components/layout/SiteLayout'
import DashboardPage from './features/activation/DashboardPage'
import DemoMap from './features/mappedin/DemoMap'
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
    </Routes>
  )
}

export default App
