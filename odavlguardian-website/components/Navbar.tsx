'use client';

import { motion } from 'framer-motion';
import { Shield } from 'lucide-react';

export default function Navbar() {
  return (
    <motion.nav
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.8, ease: 'easeOut' }}
      className="fixed top-0 left-0 right-0 z-50 px-4 py-6"
    >
      <div className="max-w-7xl mx-auto">
        <div className="glass rounded-xl px-6 py-3.5 flex items-center justify-between">
          {/* Brand */}
          <a href="/" className="flex items-center gap-2.5 hover:opacity-80 transition-opacity duration-300">
            <div className="w-7 h-7 rounded-lg bg-signal-orange flex items-center justify-center">
              <Shield className="w-4 h-4 text-base-black" strokeWidth={2.5} />
            </div>
            <span className="text-base font-semibold text-text-primary tracking-tight">
              ODAVL Guardian
            </span>
          </a>

          {/* Center Links - Hidden on mobile */}
          <div className="hidden md:flex items-center gap-6">
            <a
              href="#how-it-works"
              className="text-sm text-text-muted hover:text-text-primary transition-colors duration-300"
            >
              How it works
            </a>
            <a
              href="#cli"
              className="text-sm text-text-muted hover:text-text-primary transition-colors duration-300"
            >
              CLI
            </a>
            <a
              href="#ci"
              className="text-sm text-text-muted hover:text-text-primary transition-colors duration-300"
            >
              CI
            </a>
            <a
              href="https://github.com/odavlstudio/odavlguardian"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-text-muted hover:text-text-primary transition-colors duration-300"
            >
              GitHub
            </a>
          </div>

          {/* CTA Button */}
          <a
            href="#cli"
            className="hidden sm:block px-5 py-2 rounded-lg bg-signal-orange text-base-black text-sm font-medium hover:bg-signal-orange-deep transition-all duration-300"
          >
            Run it now
          </a>
        </div>
      </div>
    </motion.nav>
  );
}
