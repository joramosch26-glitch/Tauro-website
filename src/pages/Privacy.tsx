export default function Privacy() {
  return (
    <article className="mx-auto max-w-3xl px-6 py-16 lg:px-8 lg:py-24">
      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#9a6a25]">Tauro Painting</p>
      <h1 className="mt-5 text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">Privacy Notice</h1>

      <p className="mt-6 leading-7 text-slate-600">This notice covers Tauro Painting’s public marketing website and project inquiry forms. It does not cover the separate Paint Guide customer portal or information entered there.</p>

      <section className="mt-10">
        <h2 className="text-xl font-semibold text-slate-950">Project inquiries</h2>
        <p className="mt-3 leading-7 text-slate-600">When you submit a project inquiry, the site sends your name, email address, project type and details, and any phone number or project location you choose to provide, along with the page address, through FormSubmit to <a className="underline" href="mailto:office@tauropainting.com">office@tauropainting.com</a>. Tauro uses this information to review and respond to your project request.</p>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-semibold text-slate-950">Website measurement</h2>
        <p className="mt-3 leading-7 text-slate-600">The public website uses Google Analytics 4, which collects page addresses and interactions to measure page views and site use. When FormSubmit acknowledges an inquiry, the site also sends an event with the form location, project type, and page path. That custom inquiry event does not include your name, email, phone number, or project details.</p>
        <p className="mt-3 leading-7 text-slate-600">Google Analytics may use first-party cookies to distinguish browsers and sessions. <a className="underline" href="https://support.google.com/analytics/answer/11397207" target="_blank" rel="noopener noreferrer">Google explains its Analytics cookie use here.</a> The site currently loads Analytics without displaying a cookie preference prompt or sending consent signals. Advertising personalization is disabled; Analytics measurement remains active.</p>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-semibold text-slate-950">Contact</h2>
        <p className="mt-3 leading-7 text-slate-600">For questions or privacy requests about the public website or project inquiry, contact <a className="underline" href="mailto:office@tauropainting.com">office@tauropainting.com</a>.</p>
      </section>
    </article>
  );
}
