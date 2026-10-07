import { ArrowLeft, LockKeyhole } from 'lucide-react'
import { Link } from 'react-router'
import { useEffect } from 'react'
import './aviation.css'
export default function AviationPortal() {
  useEffect(() => { document.title = 'Customer portal · HRL Aviation' }, [])
  return <div className="aviation av-portal"><div className="av-wrap"><Link className="av-text-link" to="/aviation"><ArrowLeft size={17} /> HRL Aviation</Link><LockKeyhole size={32} strokeWidth={1} /><p className="av-eyebrow">CUSTOMER PORTAL · COMING LATER</p><h1>Your plans.<br /><em>In one private place.</em></h1><p>A secure portal for requests, quotes, and confirmed itineraries is planned. Account access is not yet available.</p><p>If you have submitted an inquiry, keep the reference shown on your receipt. Requests cannot be looked up publicly by reference.</p><Link className="av-button av-button-dark" to="/aviation/request?service=flight&step=details">Start a new inquiry</Link></div></div>
}
