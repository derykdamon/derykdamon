import PageHeader from '../components/ui/PageHeader'

const modules = [
    {
        title: 'Digital Facility Map',
        description:
            'Organize project information spatially by campus, building, floor, department, room, system, and asset.',
    },
    {
        title: 'Activation Readiness',
        description:
            'Track operational readiness across equipment, staffing, training, technology, logistics, and validation.',
    },
    {
        title: 'Equipment Intelligence',
        description:
            'Connect equipment records, acquisition status, installation, training, documentation, and room assignments.',
    },
    {
        title: 'IT and Low Voltage',
        description:
            'Coordinate network infrastructure, telecommunications, audiovisual, security, wireless, and connected devices.',
    },
    {
        title: 'Quality Control',
        description:
            'Capture deficiencies, photographs, ownership, status, verification, and closeout against specific locations.',
    },
    {
        title: 'Project Analytics',
        description:
            'Convert fragmented operational data into dashboards, trends, risks, forecasts, and decisions.',
    },
]

function PlatformPage() {
    return (
        <>
            <PageHeader
                eyebrow="ActivationOS"
                title="A unified operating picture for healthcare facility activation."
                description="ActivationOS is the working concept for a platform that connects facility maps, project data, operational readiness, equipment, technology, logistics, quality control, and analytics."
            />

            <section className="mx-auto max-w-7xl px-6 py-24 lg:px-8">
                <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                    {modules.map((module, index) => (
                        <article
                            key={module.title}
                            className="rounded-3xl border border-white/10 bg-white/[0.035] p-7"
                        >
                            <p className="text-sm font-semibold text-cyan-300">
                                0{index + 1}
                            </p>
                            <h2 className="mt-7 text-2xl font-semibold text-white">
                                {module.title}
                            </h2>
                            <p className="mt-4 leading-7 text-slate-400">
                                {module.description}
                            </p>
                        </article>
                    ))}
                </div>
            </section>
        </>
    )
}

export default PlatformPage