import {
    Bell,
    Building2,
    ChevronDown,
    CircleHelp,
    FileText,
    Layers3,
    MapPin,
    Menu,
    Package,
    Search,
    Server,
    Settings,
    ShieldCheck,
    TriangleAlert,
    Users,
    X,
} from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'

const projects = [
    {
        id: 'robley-rex',
        name: 'Robley Rex VAMC',
        location: 'Louisville, Kentucky',
        readiness: 87,
    },
    {
        id: 'dallas-ltsci',
        name: 'Dallas LTSCI',
        location: 'Dallas, Texas',
        readiness: 74,
    },
    {
        id: 'biloxi',
        name: 'Biloxi Building 1',
        location: 'Biloxi, Mississippi',
        readiness: 68,
    },
    {
        id: 'indy-east',
        name: 'Indy East CBOC',
        location: 'Indianapolis, Indiana',
        readiness: 81,
    },
]

const floors = ['L5', 'L4', 'L3', 'L2', 'L1']

const readinessItems = [
    {
        label: 'Equipment',
        value: 92,
    },
    {
        label: 'IT and low voltage',
        value: 78,
    },
    {
        label: 'Staff training',
        value: 84,
    },
    {
        label: 'Operational validation',
        value: 73,
    },
]

function DashboardPage() {
    const [sidebarOpen, setSidebarOpen] = useState(false)
    const [selectedProject, setSelectedProject] = useState(projects[0])
    const [selectedFloor, setSelectedFloor] = useState('L3')

    return (
        <div className="min-h-screen bg-[#050816] text-slate-100">
            <header className="sticky top-0 z-40 border-b border-white/10 bg-[#070b18]/95 backdrop-blur-xl">
                <div className="flex h-16 items-center justify-between px-4 sm:px-6">
                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            className="rounded-lg border border-white/10 p-2 text-slate-300 lg:hidden"
                            onClick={() => setSidebarOpen(true)}
                            aria-label="Open dashboard navigation"
                        >
                            <Menu size={20} />
                        </button>

                        <Link to="/" className="flex items-center gap-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-300 to-indigo-500 font-bold text-slate-950">
                                A
                            </div>

                            <div>
                                <p className="text-sm font-semibold text-white">
                                    ActivationOS
                                </p>
                                <p className="hidden text-xs text-slate-500 sm:block">
                                    Healthcare Digital Operations
                                </p>
                            </div>
                        </Link>
                    </div>

                    <div className="hidden max-w-xl flex-1 px-12 md:block">
                        <label className="relative block">
                            <Search
                                size={17}
                                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
                            />

                            <input
                                type="search"
                                placeholder="Search rooms, departments, assets, or documents"
                                className="w-full rounded-xl border border-white/10 bg-white/[0.04] py-2.5 pl-10 pr-4 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-300/40 focus:bg-white/[0.06]"
                            />
                        </label>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            className="rounded-lg p-2 text-slate-400 transition hover:bg-white/5 hover:text-white"
                            aria-label="Help"
                        >
                            <CircleHelp size={20} />
                        </button>

                        <button
                            type="button"
                            className="relative rounded-lg p-2 text-slate-400 transition hover:bg-white/5 hover:text-white"
                            aria-label="Notifications"
                        >
                            <Bell size={20} />
                            <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-cyan-300" />
                        </button>

                        <button
                            type="button"
                            className="ml-1 flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-2 py-1.5"
                        >
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-700 text-xs font-semibold">
                                DD
                            </div>
                            <ChevronDown size={15} className="text-slate-500" />
                        </button>
                    </div>
                </div>
            </header>

            <div className="flex min-h-[calc(100vh-4rem)]">
                {sidebarOpen && (
                    <button
                        type="button"
                        className="fixed inset-0 z-40 bg-black/70 lg:hidden"
                        onClick={() => setSidebarOpen(false)}
                        aria-label="Close navigation overlay"
                    />
                )}

                <aside
                    className={`fixed inset-y-0 left-0 z-50 w-72 border-r border-white/10 bg-[#080c1a] transition-transform duration-300 lg:sticky lg:top-16 lg:z-30 lg:h-[calc(100vh-4rem)] lg:translate-x-0 ${
                        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
                    }`}
                >
                    <div className="flex h-16 items-center justify-between border-b border-white/10 px-5 lg:hidden">
                        <span className="font-semibold text-white">Navigation</span>
                        <button
                            type="button"
                            onClick={() => setSidebarOpen(false)}
                            className="rounded-lg p-2 text-slate-400"
                            aria-label="Close dashboard navigation"
                        >
                            <X size={20} />
                        </button>
                    </div>

                    <div className="flex h-full flex-col overflow-y-auto p-4">
                        <p className="px-3 pb-3 text-xs font-semibold tracking-[0.18em] text-slate-600 uppercase">
                            Workspace
                        </p>

                        <nav className="space-y-1">
                            <button
                                type="button"
                                className="flex w-full items-center gap-3 rounded-xl bg-cyan-300/10 px-3 py-2.5 text-sm font-medium text-cyan-200"
                            >
                                <Layers3 size={18} />
                                Digital twin
                            </button>

                            {[
                                [Package, 'Equipment'],
                                [Server, 'IT and low voltage'],
                                [ShieldCheck, 'Quality control'],
                                [FileText, 'Documents'],
                                [Users, 'Staff and training'],
                                [TriangleAlert, 'Risks and issues'],
                            ].map(([Icon, label]) => {
                                const NavigationIcon = Icon

                                return (
                                    <button
                                        key={label as string}
                                        type="button"
                                        className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-slate-400 transition hover:bg-white/5 hover:text-white"
                                    >
                                        <NavigationIcon size={18} />
                                        {label as string}
                                    </button>
                                )
                            })}
                        </nav>

                        <div className="mt-8">
                            <p className="px-3 pb-3 text-xs font-semibold tracking-[0.18em] text-slate-600 uppercase">
                                Projects
                            </p>

                            <div className="space-y-2">
                                {projects.map((project) => {
                                    const active = selectedProject.id === project.id

                                    return (
                                        <button
                                            key={project.id}
                                            type="button"
                                            onClick={() => {
                                                setSelectedProject(project)
                                                setSidebarOpen(false)
                                            }}
                                            className={`w-full rounded-xl border p-3 text-left transition ${
                                                active
                                                    ? 'border-cyan-300/25 bg-cyan-300/[0.07]'
                                                    : 'border-transparent hover:border-white/10 hover:bg-white/[0.03]'
                                            }`}
                                        >
                                            <div className="flex items-start gap-3">
                                                <Building2
                                                    size={18}
                                                    className={
                                                        active ? 'text-cyan-300' : 'text-slate-600'
                                                    }
                                                />

                                                <div className="min-w-0 flex-1">
                                                    <p
                                                        className={`truncate text-sm font-medium ${
                                                            active ? 'text-white' : 'text-slate-300'
                                                        }`}
                                                    >
                                                        {project.name}
                                                    </p>
                                                    <p className="mt-1 truncate text-xs text-slate-600">
                                                        {project.location}
                                                    </p>
                                                </div>

                                                <span className="text-xs text-slate-500">
                          {project.readiness}%
                        </span>
                                            </div>
                                        </button>
                                    )
                                })}
                            </div>
                        </div>

                        <div className="mt-auto border-t border-white/10 pt-4">
                            <button
                                type="button"
                                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-slate-500 transition hover:bg-white/5 hover:text-white"
                            >
                                <Settings size={18} />
                                Settings
                            </button>

                            <Link
                                to="/"
                                className="mt-1 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-slate-500 transition hover:bg-white/5 hover:text-white"
                            >
                                Return to website
                            </Link>
                        </div>
                    </div>
                </aside>

                <main className="min-w-0 flex-1">
                    <section className="border-b border-white/10 px-4 py-5 sm:px-6">
                        <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-center">
                            <div>
                                <div className="flex items-center gap-2 text-xs text-slate-500">
                                    <span>Projects</span>
                                    <span>/</span>
                                    <span>{selectedProject.name}</span>
                                    <span>/</span>
                                    <span className="text-slate-300">Digital twin</span>
                                </div>

                                <h1 className="mt-2 text-2xl font-semibold text-white">
                                    {selectedProject.name}
                                </h1>

                                <p className="mt-1 text-sm text-slate-500">
                                    Interactive facility and operational readiness overview
                                </p>
                            </div>

                            <div className="flex flex-wrap gap-3">
                                <div className="rounded-xl border border-white/10 bg-white/[0.035] px-4 py-2">
                                    <p className="text-xs text-slate-500">Overall readiness</p>
                                    <p className="mt-1 text-lg font-semibold text-emerald-300">
                                        {selectedProject.readiness}%
                                    </p>
                                </div>

                                <div className="rounded-xl border border-white/10 bg-white/[0.035] px-4 py-2">
                                    <p className="text-xs text-slate-500">Open issues</p>
                                    <p className="mt-1 text-lg font-semibold text-amber-300">
                                        14
                                    </p>
                                </div>

                                <div className="rounded-xl border border-white/10 bg-white/[0.035] px-4 py-2">
                                    <p className="text-xs text-slate-500">Tracked assets</p>
                                    <p className="mt-1 text-lg font-semibold text-white">342</p>
                                </div>
                            </div>
                        </div>
                    </section>

                    <div className="grid min-h-[calc(100vh-13rem)] xl:grid-cols-[minmax(0,1fr)_22rem]">
                        <section className="min-w-0 border-b border-white/10 xl:border-b-0 xl:border-r">
                            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3 sm:px-6">
                                <div>
                                    <p className="text-sm font-medium text-white">
                                        Facility map
                                    </p>
                                    <p className="mt-0.5 text-xs text-slate-600">
                                        Robley Rex VAMC interactive building model
                                    </p>
                                </div>

                                <div className="flex gap-2">
                                    {floors.map((floor) => (
                                        <button
                                            key={floor}
                                            type="button"
                                            onClick={() => setSelectedFloor(floor)}
                                            className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                                                selectedFloor === floor
                                                    ? 'border-cyan-300/30 bg-cyan-300/10 text-cyan-200'
                                                    : 'border-white/10 text-slate-500 hover:text-white'
                                            }`}
                                        >
                                            {floor}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="relative flex min-h-[34rem] items-center justify-center overflow-hidden bg-[#070b16]">
                                <div className="absolute inset-0 opacity-30">
                                    <div className="h-full w-full bg-[linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:32px_32px]" />
                                </div>

                                <div className="absolute left-1/2 top-1/2 h-96 w-96 -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan-400/10 blur-3xl" />

                                <div className="relative max-w-md px-8 text-center">
                                    <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl border border-cyan-300/20 bg-cyan-300/10">
                                        <MapPin size={34} className="text-cyan-300" />
                                    </div>

                                    <p className="mt-6 text-xs font-semibold tracking-[0.18em] text-cyan-300 uppercase">
                                        {selectedFloor} selected
                                    </p>

                                    <h2 className="mt-3 text-3xl font-semibold text-white">
                                        Mappedin map area
                                    </h2>

                                    <p className="mt-4 leading-7 text-slate-500">
                                        The live Robley Rex VAMC map will load in this panel after
                                        the secure Mappedin connection is completed.
                                    </p>

                                    <div className="mt-7 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-slate-400">
                                        <span className="h-2 w-2 animate-pulse rounded-full bg-amber-300" />
                                        Integration pending
                                    </div>
                                </div>
                            </div>
                        </section>

                        <aside className="bg-[#080c18]">
                            <div className="border-b border-white/10 p-5">
                                <p className="text-xs font-semibold tracking-[0.18em] text-slate-600 uppercase">
                                    Selected location
                                </p>

                                <h2 className="mt-3 text-xl font-semibold text-white">
                                    Room 3A-215
                                </h2>

                                <div className="mt-3 flex items-center gap-2 text-sm text-slate-500">
                                    <MapPin size={15} />
                                    Floor {selectedFloor.replace('L', '')} · Patient Care
                                </div>
                            </div>

                            <div className="space-y-6 p-5">
                                <div>
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-sm font-medium text-white">
                                            Readiness by discipline
                                        </h3>
                                        <span className="text-xs text-slate-600">
                      Updated today
                    </span>
                                    </div>

                                    <div className="mt-4 space-y-4">
                                        {readinessItems.map((item) => (
                                            <div key={item.label}>
                                                <div className="mb-2 flex justify-between text-xs">
                                                    <span className="text-slate-400">{item.label}</span>
                                                    <span className="text-slate-500">{item.value}%</span>
                                                </div>

                                                <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                                                    <div
                                                        className="h-full rounded-full bg-gradient-to-r from-cyan-300 to-indigo-400"
                                                        style={{ width: `${item.value}%` }}
                                                    />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="border-t border-white/10 pt-5">
                                    <h3 className="text-sm font-medium text-white">
                                        Room information
                                    </h3>

                                    <dl className="mt-4 space-y-3 text-sm">
                                        {[
                                            ['Department', 'Medical / Surgical'],
                                            ['Room type', 'Patient room'],
                                            ['Equipment', '18 assigned assets'],
                                            ['IT devices', '6 connected devices'],
                                            ['Open deficiencies', '2 items'],
                                        ].map(([term, value]) => (
                                            <div
                                                key={term}
                                                className="flex justify-between gap-4 border-b border-white/5 pb-3"
                                            >
                                                <dt className="text-slate-600">{term}</dt>
                                                <dd className="text-right text-slate-300">{value}</dd>
                                            </div>
                                        ))}
                                    </dl>
                                </div>

                                <div className="grid grid-cols-2 gap-3 border-t border-white/10 pt-5">
                                    {[
                                        ['Equipment', Package],
                                        ['Documents', FileText],
                                        ['Technology', Server],
                                        ['Deficiencies', TriangleAlert],
                                    ].map(([label, Icon]) => {
                                        const PanelIcon = Icon

                                        return (
                                            <button
                                                key={label as string}
                                                type="button"
                                                className="rounded-xl border border-white/10 bg-white/[0.025] p-3 text-left transition hover:border-cyan-300/20 hover:bg-cyan-300/[0.05]"
                                            >
                                                <PanelIcon
                                                    size={18}
                                                    className="mb-3 text-cyan-300"
                                                />
                                                <span className="text-xs text-slate-300">
                          {label as string}
                        </span>
                                            </button>
                                        )
                                    })}
                                </div>
                            </div>
                        </aside>
                    </div>
                </main>
            </div>
        </div>
    )
}

export default DashboardPage