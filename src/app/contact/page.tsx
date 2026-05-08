import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Contact | QRON Protocol',
  description: 'Get in touch with the QRON team. Enterprise inquiries, partnerships, and support.',
};

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-black text-white selection:bg-gold selection:text-black">
      {/* Header */}
      <section className="pt-32 pb-20 px-6 text-center">
        <h1 className="text-5xl md:text-7xl font-black mb-6 tracking-tighter uppercase leading-none">
          GET IN{' '}
          <span className="gold-text">TOUCH</span>
        </h1>
        <p className="max-w-2xl mx-auto text-zinc-500 text-lg font-medium uppercase tracking-widest">
          Enterprise inquiries. Partnerships. Support.
          <br />
          We respond within 24 hours.
        </p>
      </section>

      {/* Contact Form */}
      <section className="max-w-2xl mx-auto px-6 pb-32">
        <form
          className="space-y-6"
          action="/api/contact"
          method="POST"
        >
          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-zinc-400 mb-2">
              Name
            </label>
            <input
              type="text"
              name="name"
              required
              className="w-full bg-zinc-900 border border-zinc-800 rounded px-4 py-3 text-white placeholder-zinc-600 focus:outline-none focus:border-yellow-500"
              placeholder="Your full name"
            />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-zinc-400 mb-2">
              Email
            </label>
            <input
              type="email"
              name="email"
              required
              className="w-full bg-zinc-900 border border-zinc-800 rounded px-4 py-3 text-white placeholder-zinc-600 focus:outline-none focus:border-yellow-500"
              placeholder="you@company.com"
            />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-zinc-400 mb-2">
              Company
            </label>
            <input
              type="text"
              name="company"
              className="w-full bg-zinc-900 border border-zinc-800 rounded px-4 py-3 text-white placeholder-zinc-600 focus:outline-none focus:border-yellow-500"
              placeholder="Your organization (optional)"
            />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-zinc-400 mb-2">
              Message
            </label>
            <textarea
              name="message"
              required
              rows={6}
              className="w-full bg-zinc-900 border border-zinc-800 rounded px-4 py-3 text-white placeholder-zinc-600 focus:outline-none focus:border-yellow-500 resize-none"
              placeholder="Tell us about your project or inquiry..."
            />
          </div>
          <button
            type="submit"
            className="w-full bg-yellow-500 text-black font-black uppercase tracking-widest py-4 rounded hover:bg-yellow-400 transition-colors"
          >
            Send Message
          </button>
        </form>

        {/* Alternative Contact */}
        <div className="mt-16 grid md:grid-cols-3 gap-6 text-center">
          <div className="border border-zinc-800 rounded p-6">
            <div className="text-xs uppercase tracking-widest text-zinc-500 mb-2">Email</div>
            <a href="mailto:hello@qron.space" className="text-yellow-500 hover:text-yellow-400">
              hello@qron.space
            </a>
          </div>
          <div className="border border-zinc-800 rounded p-6">
            <div className="text-xs uppercase tracking-widest text-zinc-500 mb-2">Enterprise</div>
            <a href="mailto:enterprise@qron.space" className="text-yellow-500 hover:text-yellow-400">
              enterprise@qron.space
            </a>
          </div>
          <div className="border border-zinc-800 rounded p-6">
            <div className="text-xs uppercase tracking-widest text-zinc-500 mb-2">GitHub</div>
            <a href="https://github.com/undone0603" target="_blank" rel="noopener noreferrer" className="text-yellow-500 hover:text-yellow-400">
              @undone0603
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
