'use client';

import { motion } from 'framer-motion';
import { Terminal, FileText } from 'lucide-react';

export default function Hero() {
  return (
    <section className="relative pt-44 pb-32 px-4">
      <div className="max-w-5xl mx-auto text-center">
        {/* Main Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2, ease: 'easeOut' }}
          className="text-5xl md:text-7xl font-bold text-text-primary leading-[1.1] mb-8 tracking-tighter"
        >
          Your site works.
          <br />
          <span className="text-signal-orange">
            Some interactions don't.
          </span>
        </motion.h1>

        {/* Subtext */}
        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4, ease: 'easeOut' }}
          className="text-xl md:text-2xl text-text-secondary mb-14 max-w-3xl mx-auto leading-relaxed font-normal"
        >
          verax detects clicks, forms, and toggles that appear to work but produce no real effect.
        </motion.p>

        {/* CTA Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.6, ease: 'easeOut' }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-20"
        >
          {/* Primary CTA */}
          <a
            href="#cli"
            className="group px-7 py-3.5 rounded-lg bg-signal-orange text-base-black text-sm font-semibold hover:bg-signal-orange-deep hover:glow-warm transition-all duration-500 ease-out flex items-center gap-2.5 w-full sm:w-auto justify-center"
          >
            <Terminal className="w-4 h-4" strokeWidth={2} />
            Run it on one page
          </a>

          {/* Secondary CTA */}
          <a
            href="#see-example"
            className="group px-7 py-3.5 rounded-lg glass-hover text-text-primary text-sm font-semibold flex items-center gap-2.5 w-full sm:w-auto justify-center"
          >
            <FileText className="w-4 h-4" strokeWidth={2} />
            See what it finds
          </a>
        </motion.div>

        {/* Trust Badge */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.8, ease: 'easeOut' }}
          className="inline-block px-5 py-2.5 rounded-lg glass text-sm text-text-muted"
        >
          Built for engineers who care about what users actually experience.
        </motion.div>
      </div>
    </section>
  );
}
