'use client';

import { memo } from 'react';
import { Spotlight } from '@/components/ui/spotlight';
import { motion } from 'framer-motion';
import { ExternalLink, Globe } from 'lucide-react';
import { geist } from '@/lib/fonts';
import Image from 'next/image';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { products } from '@/constants/templates';

// Hoisted motion configs (stable identities across renders)
const FADE_INITIAL = { opacity: 0, y: 20 } as const;
const FADE_ANIMATE = { opacity: 1, y: 0 } as const;
const HEADER_TRANSITION = { duration: 0.6 } as const;
const TITLE_TRANSITION = { duration: 0.6, delay: 0.2 } as const;
const DESC_TRANSITION = { duration: 0.6, delay: 0.3 } as const;
const CTA_TRANSITION = { duration: 0.6, delay: 0.4 } as const;
const GRID_TRANSITION = { duration: 0.7, delay: 0.6 } as const;

function TemplateComponent() {
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
            Premium Web{' '}
            <span className="bg-primary from-foreground to-primary via-rose-200 bg-clip-text dark:bg-gradient-to-b">
              Templates
            </span>
          </motion.h1>

          {/* Description */}
          <motion.p
            initial={FADE_INITIAL}
            animate={FADE_ANIMATE}
            transition={DESC_TRANSITION}
            className="text-muted-foreground mx-auto mb-12 max-w-3xl text-lg sm:text-xl"
          >
            Explore our collection of professionally designed templates to
            kickstart your next project. Crafted with care and attention to
            detail, our templates are ready to use and easy to customize.
          </motion.p>

          {/* CTA */}
          <motion.div
            initial={FADE_INITIAL}
            animate={FADE_ANIMATE}
            transition={CTA_TRANSITION}
            className="mb-16 flex flex-col items-center gap-4 sm:flex-row sm:justify-center"
          >
            <a
              href="https://sites.auradevs.co"
              target="_blank"
              rel="noopener noreferrer"
              className="group bg-primary text-primary-foreground hover:bg-primary/90 hover:shadow-primary/25 inline-flex items-center gap-2 rounded-lg px-6 py-3 text-sm font-medium transition-all duration-200 hover:scale-105 hover:shadow-lg"
            >
              <Globe className="h-4 w-4" />
              View More Here
              <ExternalLink className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </a>
          </motion.div>
        </motion.div>
      </div>

      <ProductSection />
    </div>
  );
}

export default memo(TemplateComponent);

const ProductSection = memo(function ProductSection() {
  return (
    <div className="z-50 space-y-8">
      <motion.div
        initial={FADE_INITIAL}
        animate={FADE_ANIMATE}
        transition={GRID_TRANSITION}
        className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3"
      >
        {products.map((product, i) => (
          <ProductItem
            key={product.id}
            link={product.link}
            image={product.image}
            name={product.name}
            price={product.price}
            index={i}
          />
        ))}
      </motion.div>
    </div>
  );
});

interface ProductItemProps {
  link: string;
  image: string;
  name: string;
  price: number;
  index: number;
}

const ProductItem = memo(function ProductItem({
  link,
  image,
  name,
  price,
  index,
}: ProductItemProps) {
  return (
    <motion.a
      href={link}
      initial={FADE_INITIAL}
      animate={FADE_ANIMATE}
      transition={{ duration: 0.5, delay: index * 0.3 + 0.8 }}
    >
      <ProductCard image={image} name={name} price={price} />
    </motion.a>
  );
});

interface ProductCardProps {
  image: string;
  name: string;
  price: number;
  delay?: string;
}

const ProductCard = memo(function ProductCard({
  image,
  name,
  price,
  delay = '',
}: ProductCardProps) {
  return (
    <Card
      className={`group animate-fade-in-up cursor-pointer gap-2! overflow-hidden border-0 bg-transparent! pt-0 ${delay}`}
    >
      <div className="relative aspect-4/3 overflow-hidden rounded-xl">
        <Image
          src={
            image ||
            `https://xvatar.vercel.app/api/avatar/${name}.svg?rounded=0&size=500`
          }
          alt={name}
          fill
          draggable={false}
          className="object-cover transition-transform duration-500 group-hover:scale-105 select-none"
        />
        <p className="absolute right-2 bottom-2 rounded-full bg-black/30 px-3 py-1 text-sm font-semibold text-white backdrop-blur-md transition-all duration-300">
          {price > 0 ? (
            <>
              <del className="text-muted-foreground px-2 line-through group-hover:text-red-300/60">
                ${price * 2}
              </del>{' '}
              <span className="group-hover:text-emerald-300">${price}</span>
            </>
          ) : (
            <span className="group-hover:text-emerald-300">FREE</span>
          )}
        </p>
      </div>
      <CardContent className="p-0!">
        <div className="space-y-2">
          <h3 className="text-foreground text-lg transition-all duration-500 ease-in-out group-hover:font-bold">
            {name}
          </h3>
          <div className="flex items-center gap-10">
            <p className="text-muted-foreground text-sm tracking-wider uppercase">
              {price > 0 ? <>PREMIUM</> : <>FREE</>}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
});
