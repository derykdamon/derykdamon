import PageHeader from '../components/ui/PageHeader'

function ContactPage() {
    return (
        <>
            <PageHeader
                eyebrow="Contact"
                title="Start a conversation."
                description="Discuss healthcare activation, technology coordination, digital facility intelligence, analytics, or custom software development."
            />

            <section className="mx-auto max-w-4xl px-6 py-24 lg:px-8">
                <div className="rounded-3xl border border-cyan-300/20 bg-gradient-to-br from-cyan-400/10 to-indigo-500/10 p-10 text-center">
                    <h2 className="text-3xl font-semibold text-white">
                        Project inquiries
                    </h2>

                    <p className="mx-auto mt-5 max-w-2xl leading-7 text-slate-300">
                        Provide a brief description of the project, operational challenge,
                        desired outcome, and current technology environment.
                    </p>

                    <a
                        href="mailto:contact@derykdamon.com"
                        className="mt-8 inline-flex rounded-full bg-white px-7 py-3 font-semibold text-slate-950 transition hover:bg-cyan-100"
                    >
                        contact@derykdamon.com
                    </a>
                </div>
            </section>
        </>
    )
}

export default ContactPage