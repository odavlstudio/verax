'use client';

import { motion } from 'framer-motion';

export default function GlowBackground() {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10">
      {/* Base gradient background */}
      <div className="absolute inset-0 bg-gradient-to-b from-base-black via-brown-dark to-base-black" />

      {/* Grid overlay */}
      <div className="absolute inset-0 grid-overlay opacity-20" />

      {/* Animated blob 1 - Warm brown ambient */}
      <motion.div
        className="absolute top-0 left-1/4 w-[700px] h-[700px] rounded-full opacity-[0.06] blur-3xl"
        style={{
          background: 'radial-gradient(circle, rgba(42, 31, 26, 0.5) 0%, transparent 70%)',
        }}
        animate={{
          x: [0, 40, -30, 0],
          y: [0, -50, 40, 0],
          scale: [1, 1.08, 0.96, 1],
        }}
        transition={{
          duration: 40,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />

      {/* Animated blob 2 - Deep brown shadow */}
      <motion.div
        className="absolute top-1/3 right-1/4 w-[800px] h-[800px] rounded-full opacity-[0.05] blur-3xl"
        style={{
          background: 'radial-gradient(circle, rgba(28, 20, 16, 0.6) 0%, transparent 70%)',
        }}
        animate={{
          x: [0, -50, 30, 0],
          y: [0, 50, -40, 0],
          scale: [1, 0.94, 1.06, 1],
        }}
        transition={{
          duration: 45,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />

      {/* Subtle orange accent - minimal presence */}
      <motion.div
        className="absolute bottom-1/4 left-1/2 w-[500px] h-[500px] rounded-full opacity-[0.04] blur-3xl"
        style={{
          background: 'radial-gradient(circle, rgba(245, 158, 11, 0.2) 0%, transparent 70%)',
        }}
        animate={{
          x: [0, 30, -30, 0],
          y: [0, -40, 20, 0],
          scale: [1, 1.05, 0.98, 1],
        }}
        transition={{
          duration: 50,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />

      {/* Noise texture overlay */}
      <div className="absolute inset-0 noise-texture" />
    </div>
  );
}
