'use client';

import { motion } from 'framer-motion';
import { Github, Globe, Linkedin } from 'lucide-react';

// SVG icons for X (Twitter) and Instagram and Reddit
const XIcon = () => (
  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24h-6.514l-5.106-6.665-5.833 6.665H2.562l7.746-8.86-8.189-10.64h6.332l4.432 5.89 5.895-5.89zM17.002 18.868h1.813L6.287 4.115H4.382l12.62 14.753z" />
  </svg>
);

const InstagramIcon = () => (
  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
    <path d="M12 0C8.74 0 8.333.015 7.053.072c-1.27.058-2.13.264-2.885.563-.78.303-1.438.743-2.074 1.38C2.375 2.938 1.935 3.596 1.633 4.375c-.3.755-.506 1.615-.563 2.885C1.015 8.333 1 8.74 1 12c0 3.26.015 3.667.072 4.947.058 1.27.264 2.13.563 2.885.303.78.743 1.438 1.38 2.074.636.637 1.293 1.077 2.073 1.38.755.299 1.615.505 2.885.562 1.28.058 1.687.072 4.947.072s3.667-.015 4.947-.072c1.27-.058 2.13-.264 2.885-.563.78-.303 1.438-.743 2.074-1.38.637-.636 1.077-1.293 1.38-2.073.299-.755.505-1.615.562-2.885.058-1.28.072-1.687.072-4.947s-.015-3.667-.072-4.947c-.058-1.27-.264-2.13-.563-2.885-.303-.78-.743-1.438-1.38-2.074C21.062 2.375 20.405 1.935 19.625 1.633c-.755-.3-1.615-.506-2.885-.563C15.667.015 15.26 0 12 0zm0 2.16c3.203 0 3.585.009 4.849.07 1.17.053 1.805.24 2.227.4.56.217.96.477 1.382.896.42.42.679.822.896 1.381.16.422.347 1.057.4 2.227.061 1.264.07 1.646.07 4.85s-.009 3.585-.07 4.849c-.053 1.17-.24 1.805-.4 2.227-.217.56-.477.96-.896 1.382-.42.42-.822.678-1.381.896-.422.16-1.057.347-2.227.4-1.265.061-1.646.07-4.85.07s-3.585-.009-4.849-.07c-1.17-.053-1.805-.24-2.227-.4-.56-.217-.96-.477-1.382-.896-.42-.42-.678-.822-.896-1.381-.16-.422-.347-1.057-.4-2.227-.061-1.264-.07-1.646-.07-4.849s.009-3.585.07-4.849c.053-1.17.24-1.805.4-2.227.217-.56.477-.96.896-1.382.42-.42.822-.678 1.381-.896.422-.16 1.057-.347 2.227-.4 1.264-.061 1.646-.07 4.849-.07z" />
    <circle cx="12" cy="12" r="3.338" />
    <circle cx="18.634" cy="5.366" r="0.75" />
  </svg>
);

const RedditIcon = () => (
  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
    <path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.385 4.859-7.181 4.859-3.796 0-7.182-2.165-7.182-4.859a3.5 3.5 0 0 1 .476-1.565c-.495-.355-.8-.984-.8-1.673 0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.53l.847-4.487c.041-.218.166-.378.38-.435a.5.5 0 0 1 .528.062l2.778 2.778a1.75 1.75 0 0 1 2.456 0 1.75 1.75 0 0 1-2.456 2.457l-2.224-2.224-.847 4.487c1.922.122 3.622.632 4.85 1.515.315-.391.787-.646 1.297-.646.968 0 1.754.786 1.754 1.754 0 .96-.776 1.746-1.735 1.754-.013.009-.032.009-.045.009a4.5 4.5 0 0 1-.729.055c-1.385 0-2.639-.576-3.511-1.494-1.141.961-2.787 1.561-4.588 1.561-1.801 0-3.447-.6-4.588-1.561-.872.918-2.126 1.494-3.511 1.494a4.5 4.5 0 0 1-.729-.055c-.013 0-.032 0-.045-.009-1.024-.008-1.842-.824-1.842-1.835 0-.968.786-1.754 1.754-1.754.468 0 .898.196 1.207.49.878-.896 2.157-1.528 3.6-1.823l.847-4.487c.042-.218.166-.378.38-.435a.5.5 0 0 1 .528.062l2.778 2.778a1.75 1.75 0 1 1-2.456 2.457l-2.224-2.224-.847 4.487c1.922.122 3.622.632 4.85 1.515.315-.391.787-.646 1.297-.646.968 0 1.754.786 1.754 1.754 0 .96-.776 1.746-1.735 1.754z" />
  </svg>
);

export default function Footer() {
  return (
    <footer className="relative py-20 px-4 border-t border-brown-border/20">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row items-center justify-between gap-8">
          {/* Brand */}
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-center md:text-left"
          >
            <h3 className="text-base font-semibold text-text-primary mb-2 tracking-tight">
              ODAVL Guardian
            </h3>
            <p className="text-text-muted text-sm max-w-sm">
              Detect silent failures in web interactions.
            </p>
          </motion.div>

          {/* Social Links */}
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="flex items-center gap-5"
          >
            <a
              href="https://odavl.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-text-muted hover:text-text-primary transition-colors duration-300"
              aria-label="ODAVL Studio"
            >
              <Globe className="w-5 h-5" strokeWidth={1.5} />
            </a>
            <a
              href="https://github.com/odavlstudio/odavlguardian"
              target="_blank"
              rel="noopener noreferrer"
              className="text-text-muted hover:text-text-primary transition-colors duration-300"
              aria-label="GitHub"
            >
              <Github className="w-5 h-5" strokeWidth={1.5} />
            </a>
            <a
              href="https://twitter.com/odavlstudio"
              target="_blank"
              rel="noopener noreferrer"
              className="text-text-muted hover:text-text-primary transition-colors duration-300"
              aria-label="X (Twitter)"
            >
              <XIcon />
            </a>
            <a
              href="https://instagram.com/odavlstudio"
              target="_blank"
              rel="noopener noreferrer"
              className="text-text-muted hover:text-text-primary transition-colors duration-300"
              aria-label="Instagram"
            >
              <InstagramIcon />
            </a>
            <a
              href="https://www.linkedin.com/company/odavlstudio"
              target="_blank"
              rel="noopener noreferrer"
              className="text-text-muted hover:text-text-primary transition-colors duration-300"
              aria-label="LinkedIn"
            >
              <Linkedin className="w-5 h-5" strokeWidth={1.5} />
            </a>
            <a
              href="https://reddit.com/r/odavlguardian"
              target="_blank"
              rel="noopener noreferrer"
              className="text-text-muted hover:text-text-primary transition-colors duration-300"
              aria-label="Reddit"
            >
              <RedditIcon />
            </a>
          </motion.div>
        </div>

        {/* Copyright */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2 }}
          className="mt-16 pt-8 border-t border-brown-border/20 text-center text-sm text-text-muted"
        >
          © {new Date().getFullYear()} ODAVL. Open source under MIT license.
        </motion.div>
      </div>
    </footer>
  );
}
