# verax verax Website

Premium landing page for verax verax built with Next.js, Tailwind CSS, and Framer Motion.

## Getting Started

1. Install dependencies:
   ```bash
   npm install
   ```

2. Run the development server:
   ```bash
   npm run dev
   ```

3. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Features

- **Premium Dark Aesthetic**: Glassmorphism, soft neon gradients, and subtle animations
- **Animated Background**: Floating gradient blobs with noise overlay
- **Responsive Design**: Mobile-first, fully responsive layout
- **Framer Motion**: Smooth scroll animations and interactive elements
- **Inter Font**: Modern typography with next/font/google
- **Performance Optimized**: Server components where possible

## Tech Stack

- Next.js 15 (App Router)
- React 19
- TypeScript
- Tailwind CSS
- Framer Motion
- Lucide React Icons

## Project Structure

```
app/
  ├── layout.tsx      # Root layout with font
  ├── page.tsx        # Main landing page
  └── globals.css     # Global styles and utilities
components/
  ├── GlowBackground.tsx  # Animated gradient blobs
  ├── Navbar.tsx          # Glass navbar with links
  ├── Hero.tsx            # Hero section with CTAs
  ├── FeatureGrid.tsx     # Feature cards
  ├── CLISection.tsx      # CLI code snippet
  └── Footer.tsx          # Footer with links
```

## License

MIT
