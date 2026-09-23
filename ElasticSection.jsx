/**
 * ElasticSection — scroll-driven elastic blob divider
 * Requires: motion/react  (npm i motion)
 *
 * Usage:
 *   <ElasticSection color="#171512">
 *     <p>optional centred white content</p>
 *   </ElasticSection>
 */
import { useRef } from 'react';
import {
  motion,
  useScroll,
  useTransform,
  useSpring,
  useVelocity,
  useMotionTemplate,
} from 'motion/react';

const DEFAULT_SPRING        = { stiffness: 90,  damping: 14, mass: 1 };
const DEFAULT_STRETCH_SPRING = { stiffness: 400, damping: 40 };

export function ElasticSection({
  color         = '#000',
  maxStretch    = 25,
  restBulge     = 50,
  springConfig  = DEFAULT_SPRING,
  children,
  style,
}) {
  const ref = useRef(null);

  // p: 0 when section top hits viewport bottom → 1 when section bottom hits viewport top
  const { scrollY, scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start'],
  });

  // Linear base: 0 → -restBulge as page scrolls through section
  const base       = useTransform(scrollYProgress, [0, 1], [0, -restBulge]);
  const springBase = useSpring(base, springConfig);

  // Velocity stretch: proportional to |scroll speed|, clamped at maxStretch
  const velocity     = useVelocity(scrollY);
  const rawStretch   = useTransform(velocity, x => Math.abs(x) * 0.0145);
  const smoothStretch = useSpring(rawStretch, DEFAULT_STRETCH_SPRING);
  const stretch      = useTransform(smoothStretch, x => Math.min(maxStretch, x));

  // SVG control-point values
  const topCtrl    = useTransform([springBase, stretch], ([sb, st]) => sb - st);
  const bottomCtrl = useTransform([springBase, stretch], ([sb, st]) => sb + 100 + restBulge + st);

  // Build path `d` strings reactively (no re-renders, 60fps via motion values)
  const topD    = useMotionTemplate`M 0 100 V 0 Q 50 ${topCtrl} 100 0 V 100 Z`;
  const bottomD = useMotionTemplate`M 0 0 V 100 Q 50 ${bottomCtrl} 100 100 V 0 Z`;

  return (
    <section
      ref={ref}
      style={{
        position:   'relative',
        height:     '100vh',
        width:      '100%',
        zIndex:     2,
        background: 'transparent',
        ...style,
      }}
    >
      {/* SVG overflows section bounds so curved edges bleed into adjacent sections */}
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        style={{
          position: 'absolute',
          inset:    0,
          width:    '100%',
          height:   '100%',
          overflow: 'visible',
          display:  'block',
          zIndex:   1,
        }}
      >
        <motion.path fill={color} d={topD}    />
        <motion.path fill={color} d={bottomD} />
      </svg>

      {children && (
        <div
          style={{
            position:       'relative',
            zIndex:         2,
            height:         '100%',
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'center',
            color:          '#fff',
          }}
        >
          {children}
        </div>
      )}
    </section>
  );
}

// ── Demo: three stacked 100vh sections ───────────────────────────────────────
export default function ElasticDemo() {
  const sectionStyle = {
    height:         '100vh',
    display:        'flex',
    alignItems:     'center',
    justifyContent: 'center',
    fontSize:       '1.25rem',
    color:          '#555',
  };

  return (
    <div style={{ background: '#F2F0EC' }}>
      <section style={sectionStyle}>
        <span>Scroll down ↓</span>
      </section>

      <ElasticSection color="#171512">
        <span style={{ opacity: 0.4, fontSize: '0.9rem', letterSpacing: '0.12em' }}>
          ELASTIC TRANSITION
        </span>
      </ElasticSection>

      <section style={sectionStyle}>
        <span>Next section</span>
      </section>
    </div>
  );
}
