import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { ArrowUpRight, RotateCcw, RotateCw } from 'lucide-react'
import { Link } from 'react-router'
import { places, projectPoint } from './region'
import land from './data/valley-land.json'

const ValleyScene = lazy(() => import('./ValleyScene').catch(() => ({ default: () => <></> })))

export default function RegionalExplorer({ motion }: { motion: boolean }) {
  const [active, setActive] = useState(0)
  const [angle, setAngle] = useState(-.08)
  const [ready, setReady] = useState(false)
  const container = useRef<HTMLDivElement>(null)
  const place = places[active]
  useEffect(() => {
    if (!container.current) return
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setReady(true); observer.disconnect() }
    }, { rootMargin: '200px' })
    observer.observe(container.current)
    return () => observer.disconnect()
  }, [])
  return <section className="av-region av-wrap" id="the-valley" ref={container} aria-labelledby="valley-heading">
    <div className="av-section-heading av-reveal"><div><p className="av-eyebrow">26° NORTH / A WORLD WITHIN REACH</p><h2 id="valley-heading">This is <em>our corner</em><br />of the world.</h2></div><p>Rooted in Harlingen.<br />Open to everything around it.</p></div>
    <div className="av-region-layout">
      <div className="av-map-panel">
        <div className="av-map-heading"><span>THE RIO GRANDE VALLEY</span><span className="av-map-north">N ↑</span></div>
        <div className="av-map-visual" role="img" aria-label="Dimensional regional map showing Harlingen, South Padre Island, and Laguna Atascosa. Use the location buttons below to explore.">
          <svg className="av-map-fallback" viewBox="-4 -4 8 8" aria-hidden="true">
            <g transform="scale(1,-1)">{land.polygons.map((polygon, i) => <polygon key={i} points={polygon.map(p => projectPoint(p).join(',')).join(' ')} />)}
              {places.map((item, i) => { const [x, y] = projectPoint(item.coordinates); return <circle key={item.id} cx={x} cy={y} r={i === active ? .12 : .07} /> })}
            </g>
          </svg>
          {ready && <Suspense fallback={null}><ValleyScene active={active} angle={angle} motion={motion} /></Suspense>}
        </div>
        <div className="av-map-controls"><span>Explore a place below</span><div><button type="button" aria-label="Rotate map left" onClick={() => setAngle(v => v - .25)}><RotateCcw size={16} /></button><button type="button" aria-label="Reset map view" onClick={() => setAngle(-.08)}>Reset</button><button type="button" aria-label="Rotate map right" onClick={() => setAngle(v => v + .25)}><RotateCw size={16} /></button></div></div>
        <div className="av-place-tabs" role="group" aria-label="Explore the region">{places.map((item, i) => <button key={item.id} type="button" aria-pressed={active === i} aria-controls="regional-place" onClick={() => setActive(i)}><span>{item.number}</span>{item.name}<ArrowUpRight size={15} /></button>)}</div>
        <p className="av-map-note">Illustrative geography, not a navigation chart or service route. Map data: <a href="https://www.naturalearthdata.com/about/terms-of-use/" target="_blank" rel="noreferrer">Natural Earth</a>.</p>
      </div>
      <article className="av-destination" id="regional-place" aria-live="polite" aria-atomic="true">
        <img key={place.image} src={place.image} alt={place.alt} width="1600" height="1100" loading="lazy" decoding="async" />
        <div className="av-destination-body"><p className="av-eyebrow">{place.category} <span>{place.coordinateLabel}</span></p><h3>{place.title}</h3><p>{place.text}</p>{place.link.startsWith('/') ? <Link className="av-text-link" to={place.link}>{place.action} <ArrowUpRight size={17} /></Link> : <a className="av-text-link" href={place.link} target="_blank" rel="noreferrer">{place.action} <ArrowUpRight size={17} /></a>}<small>{place.caption}<br /><a href={place.source} target="_blank" rel="noreferrer">Photo: {place.author}</a> · <a href={active === 2 ? 'https://creativecommons.org/licenses/by/2.0/' : 'https://creativecommons.org/licenses/by-sa/4.0/'} target="_blank" rel="noreferrer">{place.license}</a> · Cropped for display</small></div>
      </article>
    </div>
  </section>
}
