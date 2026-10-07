import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import land from './data/valley-land.json'
import { places, projectPoint } from './region'

export default function ValleyScene({ active, motion, angle }: { active: number; motion: boolean; angle: number }) {
  const host = useRef<HTMLDivElement>(null)
  const selection = useRef(active)
  const movement = useRef(motion)
  const rotation = useRef(angle)
  const renderNow = useRef<() => void>(() => {})
  const [failed, setFailed] = useState(false)
  useEffect(() => { selection.current = active; renderNow.current() }, [active])
  useEffect(() => { movement.current = motion; renderNow.current() }, [motion])
  useEffect(() => { rotation.current = angle; renderNow.current() }, [angle])

  useEffect(() => {
    const container = host.current
    if (!container) return
    let renderer: THREE.WebGLRenderer
    try { renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power' }) }
    catch { queueMicrotask(() => setFailed(true)); return }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5))
    renderer.setClearColor(0x000000, 0)
    container.appendChild(renderer.domElement)
    renderer.domElement.setAttribute('aria-hidden', 'true')
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(37, 1, 0.1, 50)
    const world = new THREE.Group()
    scene.add(world)
    scene.add(new THREE.AmbientLight(0xe4e7e2, 2.2))
    const light = new THREE.DirectionalLight(0xdbc79e, 4)
    light.position.set(-3, 8, 4)
    scene.add(light)

    const sea = new THREE.Mesh(new THREE.PlaneGeometry(7.44, 6.9), new THREE.MeshStandardMaterial({ color: 0x10252b, roughness: .65, metalness: .55 }))
    sea.rotation.x = -Math.PI / 2
    sea.position.y = -.025
    world.add(sea)
    const grid = new THREE.GridHelper(8, 32, 0x365054, 0x1c353b)
    grid.position.y = -.015
    world.add(grid)

    for (const polygon of land.polygons) {
      const points = polygon.map(point => new THREE.Vector2(...projectPoint(point)))
      const shape = new THREE.Shape(points)
      const geometry = new THREE.ExtrudeGeometry(shape, { depth: .09, bevelEnabled: false })
      const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: 0x314342, metalness: .5, roughness: .8 }))
      mesh.rotation.x = -Math.PI / 2
      world.add(mesh)
      const coast = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(points.map(p => new THREE.Vector3(p.x, .095, -p.y))), new THREE.LineBasicMaterial({ color: 0x9b987a, transparent: true, opacity: .8 }))
      world.add(coast)
    }

    const markers = places.map((place, index) => {
      const [x, y] = projectPoint(place.coordinates)
      const marker = new THREE.Group()
      marker.position.set(x, .15, -y)
      const pin = new THREE.Mesh(new THREE.SphereGeometry(.047, 16, 12), new THREE.MeshBasicMaterial({ color: index === 0 ? 0xf1d29c : 0xa8d0c7 }))
      const ring = new THREE.Mesh(new THREE.RingGeometry(.1, .114, 48), new THREE.MeshBasicMaterial({ color: 0xddbc83, side: THREE.DoubleSide, transparent: true }))
      ring.rotation.x = -Math.PI / 2
      marker.add(pin, ring)
      world.add(marker)
      const textCanvas = document.createElement('canvas')
      textCanvas.width = 512; textCanvas.height = 96
      const ctx = textCanvas.getContext('2d')
      if (ctx) {
        ctx.font = '500 38px Arial'; ctx.fillStyle = '#f4ead6'; ctx.textAlign = 'center'
        ctx.fillText(index === 0 ? 'HRL / HARLINGEN' : place.name.toUpperCase(), 256, 54)
        const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(textCanvas), depthTest: false }))
        label.scale.set(2.15, .4, 1)
        label.position.set(x, .38, -y + (index === 2 ? -.24 : .22))
        world.add(label)
      }
      return ring
    })
    const origin = projectPoint(places[0].coordinates)
    const arcs = places.slice(1).map(place => {
      const [x, y] = projectPoint(place.coordinates)
      const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(origin[0], .15, -origin[1]), new THREE.Vector3((x + origin[0]) / 2, 1.1, -(y + origin[1]) / 2), new THREE.Vector3(x, .15, -y))
      const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(curve.getPoints(70)), new THREE.LineBasicMaterial({ color: 0xd9bc88, transparent: true, opacity: .25 }))
      const point = new THREE.Mesh(new THREE.SphereGeometry(.025, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffe5b2 }))
      world.add(line, point)
      return { line, point, curve }
    })
    let frame = 0
    let visible = false
    let disposed = false
    let pointerX = 0
    let pointerY = 0
    let lastTime = 0
    const render = (time = 0) => {
      frame = 0
      if (disposed || !visible || document.hidden) return
      // Cap the optional animation at 30fps; static views render only on demand.
      if (time - lastTime >= 30 || !movement.current || time === 0) {
        lastTime = time
        const a = rotation.current + (movement.current ? pointerX * .08 : 0)
        camera.position.set(Math.sin(a) * 9.5, 7 + (movement.current ? pointerY * .25 : 0), Math.cos(a) * 9.5)
        camera.lookAt(0, 0, 0)
        markers.forEach((ring, index) => {
          ring.scale.setScalar(index === selection.current ? 1.7 + (movement.current ? Math.sin(time * .0015) * .18 : 0) : 1)
          ring.material.opacity = index === selection.current ? 1 : .45
        })
        arcs.forEach(({ line, point, curve }, index) => {
          const selected = selection.current === index + 1
          line.material.opacity = selected ? .85 : .18
          point.visible = movement.current && selected
          point.position.copy(curve.getPoint((time * .00013) % 1))
        })
        renderer.render(scene, camera)
      }
      if (movement.current) frame = requestAnimationFrame(render)
    }
    const schedule = () => { cancelAnimationFrame(frame); frame = 0; render() }
    renderNow.current = schedule
    const resize = new ResizeObserver(() => {
      const { width, height } = container.getBoundingClientRect()
      if (!width || !height) return
      renderer.setSize(width, height)
      camera.aspect = width / height
      camera.fov = width < 500 ? 48 : 37
      camera.updateProjectionMatrix()
      schedule()
    })
    resize.observe(container)
    const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; schedule() })
    observer.observe(container)
    const onVisibility = () => schedule()
    const onPointer = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse') return
      const rect = container.getBoundingClientRect()
      pointerX = (event.clientX - rect.left) / rect.width - .5
      pointerY = (event.clientY - rect.top) / rect.height - .5
    }
    const onLost = (event: Event) => { event.preventDefault(); setFailed(true); cancelAnimationFrame(frame) }
    document.addEventListener('visibilitychange', onVisibility)
    container.addEventListener('pointermove', onPointer, { passive: true })
    renderer.domElement.addEventListener('webglcontextlost', onLost)
    return () => {
      disposed = true; cancelAnimationFrame(frame); resize.disconnect(); observer.disconnect()
      document.removeEventListener('visibilitychange', onVisibility)
      container.removeEventListener('pointermove', onPointer)
      renderer.domElement.removeEventListener('webglcontextlost', onLost)
      scene.traverse(object => {
        if (object instanceof THREE.Mesh || object instanceof THREE.Line || object instanceof THREE.Sprite) {
          if ('geometry' in object) object.geometry.dispose()
          const materials = Array.isArray(object.material) ? object.material : [object.material]
          materials.forEach(material => { if ('map' in material && material.map instanceof THREE.Texture) material.map.dispose(); material.dispose() })
        }
      })
      renderer.dispose(); renderer.domElement.remove(); renderNow.current = () => {}
    }
  }, [])

  return <div className={`av-valley-canvas${failed ? ' is-unavailable' : ''}`} ref={host} aria-hidden="true" />
}
