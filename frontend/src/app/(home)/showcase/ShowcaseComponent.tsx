'use client';

import { memo } from 'react';
import { Spotlight } from '@/components/ui/spotlight';
import { motion } from 'framer-motion';
import { ExternalLink, Globe } from 'lucide-react';
import { ShowcaseGrid } from '@/components/showcase/showcase-grid';
import { geist } from '@/lib/fonts';
import { cn } from '@/lib/utils';

// Hoisted motion configs (stable identities across renders)
const FADE_INITIAL = { opacity: 0, y: 20 } as const;
const FADE_ANIMATE = { opacity: 1, y: 0 } as const;
const HEADER_TRANSITION = { duration: 0.6 } as const;
const TITLE_TRANSITION = { duration: 0.6, delay: 0.2 } as const;
const DESC_TRANSITION = { duration: 0.6, delay: 0.3 } as const;
const CTA_TRANSITION = { duration: 0.6, delay: 0.4 } as const;

function ShowCaseComponent() {
  return (
    <div className="relative min-h-screen overflow-hidden px-2 py-32 md:px-6">
      <Spotlight />
      <div className="mx-auto max-w-7xl">
        <motion.div
          initial={FADE_INITIAL}
          animate={FADE_ANIMATE}
          transition={HEADER_TRANSITION}
          className="text-center"
        >
          {/* Title */}
          <motion.h1
            initial={FADE_INITIAL}
            animate={FADE_ANIMATE}
            transition={TITLE_TRANSITION}
            className={cn(
              'from-foreground via-foreground/90 to-foreground/70 mb-6 bg-gradient-to-b bg-clip-text text-4xl tracking-tight text-transparent sm:text-5xl lg:text-6xl',
              geist.className,
            )}
          >
            Built with{' '}
            <span className="bg-primary from-foreground to-primary via-rose-200 bg-clip-text dark:bg-gradient-to-b">
              Mvpblocks
            </span>
          </motion.h1>

          {/* Description */}
          <motion.p
            initial={FADE_INITIAL}
            animate={FADE_ANIMATE}
            transition={DESC_TRANSITION}
            className="text-muted-foreground mx-auto mb-12 max-w-3xl text-lg sm:text-xl"
          >
            Discover amazing websites and applications built by our community
            using MVPBlocks components. Get inspired and see what&apos;s
            possible with our component library.
          </motion.p>

          {/* CTA */}
          <motion.div
            initial={FADE_INITIAL}
            animate={FADE_ANIMATE}
            transition={CTA_TRANSITION}
            className="mb-16 flex flex-col items-center gap-4 sm:flex-row sm:justify-center"
          >
            <a
              href="https://github.com/subhadeeproy3902/mvpblocks/discussions/19"
              target="_blank"
              rel="noopener noreferrer"
              className="group bg-primary text-primary-foreground hover:bg-primary/90 hover:shadow-primary/25 inline-flex items-center gap-2 rounded-lg px-6 py-3 text-sm font-medium transition-all duration-200 hover:scale-105 hover:shadow-lg"
            >
              <Globe className="h-4 w-4" />
              Submit Your Site
              <ExternalLink className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </a>
          </motion.div>
        </motion.div>

        <ShowcaseGrid />
      </div>
    </div>
  );
}

export default memo(ShowCaseComponent);
