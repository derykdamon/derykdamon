type PageHeaderProps = {
    eyebrow: string
    title: string
    description: string
}

function PageHeader({ eyebrow, title, description }: PageHeaderProps) {
    return (
        <section className="border-b border-white/10 bg-white/[0.025]">
            <div className="mx-auto max-w-7xl px-6 py-24 lg:px-8">
                <p className="text-sm font-semibold tracking-[0.22em] text-cyan-300 uppercase">
                    {eyebrow}
                </p>

                <h1 className="mt-5 max-w-4xl text-5xl font-semibold tracking-tight text-white sm:text-6xl">
                    {title}
                </h1>

                <p className="mt-7 max-w-3xl text-lg leading-8 text-slate-300">
                    {description}
                </p>
            </div>
        </section>
    )
}

export default PageHeader