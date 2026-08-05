import PageHeader from '../components/ui/PageHeader'

function AboutPage() {
    return (
        <>
            <PageHeader
                eyebrow="About"
                title="Technology, analytics, and operational experience."
                description="Deryk Damon brings together information technology, low voltage, healthcare facility activation, project coordination, business analytics, finance, and military leadership experience."
            />

            <section className="mx-auto grid max-w-7xl gap-12 px-6 py-24 lg:grid-cols-2 lg:px-8">
                <div>
                    <h2 className="text-3xl font-semibold text-white">
                        Built from operational experience
                    </h2>
                </div>

                <div className="space-y-6 text-lg leading-8 text-slate-300">
                    <p>
                        The objective is to create systems that make complicated projects
                        easier to understand, coordinate, manage, and validate.
                    </p>
                    <p>
                        The work focuses on the intersection of facility operations,
                        technology infrastructure, project data, stakeholder coordination,
                        and decision support.
                    </p>
                </div>
            </section>
        </>
    )
}

export default AboutPage