import { Menu, X } from 'lucide-react'
import { useState } from 'react'
import { Link, NavLink, Outlet } from 'react-router'

const navigation = [
    { name: 'Home', path: '/' },
    { name: 'Platform', path: '/platform' },
    { name: 'Solutions', path: '/solutions' },
    { name: 'About', path: '/about' },
]

function SiteLayout() {
    const [menuOpen, setMenuOpen] = useState(false)

    const navClass = ({ isActive }: { isActive: boolean }) =>
        `transition ${
            isActive ? 'text-cyan-300' : 'text-slate-300 hover:text-white'
        }`

    return (
        <div className="min-h-screen overflow-x-hidden text-slate-100">
            <header className="fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-slate-950/80 backdrop-blur-xl">
                <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5 lg:px-8">
                    <Link
                        to="/"
                        className="text-sm font-semibold tracking-[0.25em] text-white uppercase"
                    >
                        Deryk Damon
                    </Link>

                    <div className="hidden items-center gap-8 text-sm md:flex">
                        {navigation.map((item) => (
                            <NavLink key={item.path} to={item.path} className={navClass}>
                                {item.name}
                            </NavLink>
                        ))}
                    </div>

                    <div className="hidden md:block">
                        <Link
                            to="/contact"
                            className="rounded-full border border-cyan-300/40 bg-cyan-300/10 px-4 py-2 text-sm font-medium text-cyan-100 transition hover:bg-cyan-300/20"
                        >
                            Contact
                        </Link>
                    </div>

                    <button
                        type="button"
                        className="rounded-lg border border-white/10 p-2 text-slate-200 md:hidden"
                        onClick={() => setMenuOpen((current) => !current)}
                        aria-label="Toggle navigation menu"
                        aria-expanded={menuOpen}
                    >
                        {menuOpen ? <X size={21} /> : <Menu size={21} />}
                    </button>
                </nav>

                {menuOpen && (
                    <div className="border-t border-white/10 bg-slate-950 px-6 py-5 md:hidden">
                        <div className="flex flex-col gap-4">
                            {navigation.map((item) => (
                                <NavLink
                                    key={item.path}
                                    to={item.path}
                                    className={navClass}
                                    onClick={() => setMenuOpen(false)}
                                >
                                    {item.name}
                                </NavLink>
                            ))}

                            <NavLink
                                to="/contact"
                                className={navClass}
                                onClick={() => setMenuOpen(false)}
                            >
                                Contact
                            </NavLink>
                        </div>
                    </div>
                )}
            </header>

            <main className="pt-[81px]">
                <Outlet />
            </main>

            <footer className="border-t border-white/10">
                <div className="mx-auto flex max-w-7xl flex-col gap-3 px-6 py-8 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between lg:px-8">
                    <p>© 2026 Deryk Damon. All rights reserved.</p>
                    <p>Healthcare technology · IT · Low voltage · Analytics</p>
                </div>
            </footer>
        </div>
    )
}

export default SiteLayout