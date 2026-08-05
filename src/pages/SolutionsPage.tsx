import PageHeader from '../components/ui/PageHeader'

const solutions = [
    'Healthcare activation and transition planning',
    'Interactive indoor mapping and digital facility intelligence',
    'Equipment planning, acquisition, installation, and readiness',
    'IT and low-voltage infrastructure coordination',
    'Day-in-the-Life scenario planning and validation',
    'Project analytics, reporting, and workflow automation',
]

function SolutionsPage() {
    return (
        <>
            <PageHeader
                eyebrow="Solutions"
                title="Technology aligned with the realities of complex facility projects."
                description="Solutions are designed around operational problems encountered during planning, construction coordination, activation, occupancy, and long-term facility operations."
            />

            <section className="mx-auto max-w-7xl px-6 py-24 lg:px-8">
                <div className="space-y-4">
                    {solutions.map((solution, index) => (
                        <div
                            key={solution}
                            className="flex gap-6 rounded-2xl border border-white/10 bg-white/[0.03] p-6"
                        >
              <span className="font-semibold text-cyan-300">
                {String(index + 1).padStart(2, '0')}
              </span>
                            <p className="text-lg text-slate-200">{solution}</p>
                        </div>
                    ))}
                </div>
            </section>
        </>
    )
}

export default SolutionsPage