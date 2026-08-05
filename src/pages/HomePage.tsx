const capabilities = [
    {
        title: 'Healthcare Activation',
        description:
            'Coordinate operational readiness, equipment, logistics, training, occupancy, and transition activities.',
    },
    {
        title: 'Digital Building Intelligence',
        description:
            'Connect floor plans, rooms, assets, documents, deficiencies, and project status through an interactive spatial interface.',
    },
    {
        title: 'IT & Low Voltage',
        description:
            'Plan and track network infrastructure, devices, telecommunications, security systems, and technology readiness.',
    },
    {
        title: 'Project Analytics',
        description:
            'Turn fragmented project information into clear dashboards, controls, decisions, and actionable reporting.',
    },
]

function App() {
    return (
        <div>
            <header>
            </header>

            <main id="top">
                <section className="relative flex min-h-screen items-center pt-28">
                    <div className="absolute inset-0 -z-10">
                        <div className="absolute left-1/2 top-32 h-96 w-96 -translate-x-1/2 rounded-full bg-cyan-400/10 blur-3xl" />
                        <div className="absolute right-0 top-1/3 h-80 w-80 rounded-full bg-indigo-500/10 blur-3xl" />
                    </div>

                    <div className="mx-auto grid w-full max-w-7xl gap-16 px-6 py-24 lg:grid-cols-[1.15fr_0.85fr] lg:px-8">
                        <div className="flex flex-col justify-center">
                            <p className="mb-6 text-sm font-semibold tracking-[0.25em] text-cyan-300 uppercase">
                                Healthcare technology and project intelligence
                            </p>

                            <h1 className="max-w-5xl text-5xl font-semibold tracking-tight text-white sm:text-6xl lg:text-7xl">
                                Transforming complex facilities into
                                <span className="block bg-gradient-to-r from-cyan-300 via-sky-300 to-indigo-300 bg-clip-text text-transparent">
                  operational intelligence.
                </span>
                            </h1>

                            <p className="mt-8 max-w-3xl text-lg leading-8 text-slate-300 sm:text-xl">
                                A digital platform vision connecting healthcare activation,
                                indoor mapping, equipment, logistics, IT, low voltage, quality
                                control, and project analytics.
                            </p>

                            <div className="mt-10 flex flex-col gap-4 sm:flex-row">
                                <a
                                    href="#platform"
                                    className="rounded-full bg-white px-6 py-3 text-center font-semibold text-slate-950 transition hover:bg-cyan-100"
                                >
                                    Explore the platform
                                </a>

                                <a
                                    href="#contact"
                                    className="rounded-full border border-white/15 px-6 py-3 text-center font-semibold text-white transition hover:border-white/30 hover:bg-white/5"
                                >
                                    Discuss a project
                                </a>
                            </div>
                        </div>

                        <div className="flex items-center justify-center">
                            <div className="relative w-full max-w-lg">
                                <div className="absolute -inset-6 rounded-[2.5rem] bg-gradient-to-br from-cyan-400/20 to-indigo-500/20 blur-2xl" />

                                <div className="relative rounded-[2rem] border border-white/10 bg-white/[0.05] p-5 shadow-2xl backdrop-blur-xl">
                                    <div className="mb-5 flex items-center justify-between">
                                        <div>
                                            <p className="text-xs tracking-[0.2em] text-slate-400 uppercase">
                                                Activation platform
                                            </p>
                                            <p className="mt-1 text-lg font-semibold text-white">
                                                Project readiness
                                            </p>
                                        </div>

                                        <div className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1 text-xs text-emerald-200">
                                            Live concept
                                        </div>
                                    </div>

                                    <div className="rounded-2xl border border-white/10 bg-slate-950/80 p-5">
                                        <div className="mb-5 grid grid-cols-3 gap-3">
                                            {[
                                                ['87%', 'Readiness'],
                                                ['342', 'Assets'],
                                                ['14', 'Open issues'],
                                            ].map(([value, label]) => (
                                                <div
                                                    key={label}
                                                    className="rounded-xl border border-white/10 bg-white/[0.04] p-3"
                                                >
                                                    <p className="text-xl font-semibold text-white">
                                                        {value}
                                                    </p>
                                                    <p className="mt-1 text-xs text-slate-400">{label}</p>
                                                </div>
                                            ))}
                                        </div>

                                        <div className="space-y-3">
                                            {[
                                                ['Equipment installation', '92%'],
                                                ['IT and low voltage', '78%'],
                                                ['Staff training', '84%'],
                                                ['Operational validation', '73%'],
                                            ].map(([label, value]) => (
                                                <div key={label}>
                                                    <div className="mb-2 flex justify-between text-sm">
                                                        <span className="text-slate-300">{label}</span>
                                                        <span className="text-slate-400">{value}</span>
                                                    </div>
                                                    <div className="h-2 overflow-hidden rounded-full bg-white/10">
                                                        <div
                                                            className="h-full rounded-full bg-gradient-to-r from-cyan-300 to-indigo-400"
                                                            style={{ width: value }}
                                                        />
                                                    </div>
                                                </div>
                                            ))}
                                        </div>

                                        <div className="mt-5 grid grid-cols-5 gap-2">
                                            {[1, 2, 3, 4, 5].map((floor) => (
                                                <div
                                                    key={floor}
                                                    className="flex aspect-square items-center justify-center rounded-lg border border-cyan-300/10 bg-cyan-300/[0.06] text-xs text-cyan-100"
                                                >
                                                    L{floor}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                <section
                    id="platform"
                    className="border-y border-white/10 bg-white/[0.025]"
                >
                    <div className="mx-auto max-w-7xl px-6 py-24 lg:px-8">
                        <p className="text-sm font-semibold tracking-[0.22em] text-cyan-300 uppercase">
                            Platform vision
                        </p>

                        <div className="mt-5 grid gap-10 lg:grid-cols-2">
                            <h2 className="text-4xl font-semibold tracking-tight text-white sm:text-5xl">
                                One operational picture for the entire facility.
                            </h2>

                            <p className="text-lg leading-8 text-slate-300">
                                Move beyond disconnected spreadsheets, folders, floor plans,
                                reports, and meeting notes. The platform is designed to
                                organize project intelligence around the building itself:
                                project, floor, department, room, system, and asset.
                            </p>
                        </div>
                    </div>
                </section>

                <section id="capabilities">
                    <div className="mx-auto max-w-7xl px-6 py-24 lg:px-8">
                        <div className="max-w-3xl">
                            <p className="text-sm font-semibold tracking-[0.22em] text-cyan-300 uppercase">
                                Core capabilities
                            </p>

                            <h2 className="mt-5 text-4xl font-semibold tracking-tight text-white sm:text-5xl">
                                Built around real operational work.
                            </h2>
                        </div>

                        <div className="mt-14 grid gap-5 md:grid-cols-2">
                            {capabilities.map((capability, index) => (
                                <article
                                    key={capability.title}
                                    className="group rounded-3xl border border-white/10 bg-white/[0.035] p-7 transition hover:-translate-y-1 hover:border-cyan-300/25 hover:bg-white/[0.055]"
                                >
                                    <p className="text-sm font-semibold text-cyan-300">
                                        0{index + 1}
                                    </p>
                                    <h3 className="mt-8 text-2xl font-semibold text-white">
                                        {capability.title}
                                    </h3>
                                    <p className="mt-4 leading-7 text-slate-400">
                                        {capability.description}
                                    </p>
                                </article>
                            ))}
                        </div>
                    </div>
                </section>

                <section
                    id="about"
                    className="border-y border-white/10 bg-white/[0.025]"
                >
                    <div className="mx-auto grid max-w-7xl gap-12 px-6 py-24 lg:grid-cols-[0.8fr_1.2fr] lg:px-8">
                        <div>
                            <p className="text-sm font-semibold tracking-[0.22em] text-cyan-300 uppercase">
                                About
                            </p>
                            <h2 className="mt-5 text-4xl font-semibold tracking-tight text-white">
                                Technology grounded in field operations.
                            </h2>
                        </div>

                        <div className="space-y-6 text-lg leading-8 text-slate-300">
                            <p>
                                Deryk Damon combines experience in information technology, low
                                voltage systems, healthcare facility activation, project
                                coordination, analytics, and operational planning.
                            </p>
                            <p>
                                The objective is practical: create clearer systems for managing
                                complex facilities, coordinating stakeholders, tracking
                                readiness, and converting project data into decisions.
                            </p>
                        </div>
                    </div>
                </section>

                <section id="contact">
                    <div className="mx-auto max-w-7xl px-6 py-24 lg:px-8">
                        <div className="rounded-[2rem] border border-cyan-300/20 bg-gradient-to-br from-cyan-400/10 to-indigo-500/10 px-8 py-16 text-center sm:px-16">
                            <p className="text-sm font-semibold tracking-[0.22em] text-cyan-300 uppercase">
                                Start a conversation
                            </p>

                            <h2 className="mx-auto mt-5 max-w-3xl text-4xl font-semibold tracking-tight text-white sm:text-5xl">
                                Build a clearer operating picture for your next project.
                            </h2>

                            <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-slate-300">
                                Healthcare activation, digital facility intelligence, IT and
                                low voltage coordination, analytics, and custom software
                                development.
                            </p>

                            <a
                                href="mailto:contact@derykdamon.com"
                                className="mt-9 inline-flex rounded-full bg-white px-7 py-3 font-semibold text-slate-950 transition hover:bg-cyan-100"
                            >
                                contact@derykdamon.com
                            </a>
                        </div>
                    </div>
                </section>
            </main>

            <footer>

            </footer>
        </div>
    )
}

export default App