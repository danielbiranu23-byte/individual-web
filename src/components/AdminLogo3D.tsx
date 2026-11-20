import { useState } from 'react';

interface AdminLogo3DProps {
  src: string;
  alt: string;
  size?: 'sm' | 'md' | 'lg';
  interactiveSpin?: boolean;
  className?: string;
}

export function AdminLogo3D({
  src,
  alt,
  size = 'md',
  interactiveSpin = false,
  className = '',
}: AdminLogo3DProps) {
  const [tilt, setTilt] = useState<{ rx: number; ry: number; gx: number; gy: number; hovered: boolean }>({
    rx: 0,
    ry: 0,
    gx: 50,
    gy: 35,
    hovered: false,
  });
  const [spinTurns, setSpinTurns] = useState(0);
  const [imgFailed, setImgFailed] = useState(false);

  const sizeConfig = {
    sm: {
      wrapper: 'w-10 h-10',
      maxTilt: 22,
      zFace: 5,
      zSheen: 8,
      zRim1: -2,
      zRim2: -4,
      zRim3: -6,
      padClass: 'p-[2.5px]',
      shadowClass: 'shadow-[0_4px_0_rgba(30,58,138,0.65),0_10px_18px_-4px_rgba(14,116,144,0.45)]',
    },
    md: {
      wrapper: 'w-16 h-16',
      maxTilt: 20,
      zFace: 7,
      zSheen: 11,
      zRim1: -3,
      zRim2: -6,
      zRim3: -9,
      padClass: 'p-[3px]',
      shadowClass: 'shadow-[0_6px_0_rgba(30,58,138,0.72),0_16px_28px_-6px_rgba(15,23,42,0.5)]',
    },
    lg: {
      wrapper: 'w-full max-w-[320px] aspect-square',
      maxTilt: 16,
      zFace: 12,
      zSheen: 18,
      zRim1: -4,
      zRim2: -8,
      zRim3: -12,
      padClass: 'p-[7px]',
      shadowClass: 'shadow-[0_12px_0_rgba(30,58,138,0.6),0_30px_54px_-12px_rgba(15,23,42,0.55)]',
    },
  }[size];

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const nx = (e.clientX - rect.left) / rect.width;
    const ny = (e.clientY - rect.top) / rect.height;
    const ry = (nx - 0.5) * 2 * sizeConfig.maxTilt;
    const rx = (0.5 - ny) * 2 * sizeConfig.maxTilt;
    setTilt({
      rx,
      ry,
      gx: Math.round(nx * 100),
      gy: Math.round(ny * 100),
      hovered: true,
    });
  }

  function handlePointerLeave() {
    setTilt({ rx: 0, ry: 0, gx: 50, gy: 35, hovered: false });
  }

  function handleSpinClick() {
    if (!interactiveSpin) return;
    setSpinTurns((prev) => prev + 1);
  }

  const interactiveTransform = `rotateX(${tilt.rx.toFixed(2)}deg) rotateY(${(
    tilt.ry +
    spinTurns * 360
  ).toFixed(2)}deg) scale(${tilt.hovered ? (size === 'lg' ? 1.03 : 1.08) : 1})`;

  return (
    <div
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      onClick={handleSpinClick}
      role={interactiveSpin ? 'button' : undefined}
      tabIndex={interactiveSpin ? 0 : undefined}
      onKeyDown={
        interactiveSpin
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleSpinClick();
              }
            }
          : undefined
      }
      aria-label={interactiveSpin ? `${alt} (3D interactive)` : undefined}
      className={`logo-3d-stage relative inline-flex items-center justify-center select-none shrink-0 ${
        sizeConfig.wrapper
      } ${interactiveSpin ? 'cursor-pointer' : ''} ${className}`}
    >
      <div
        className={`logo-3d-preserve relative w-full h-full rounded-full ${
          !tilt.hovered && spinTurns === 0 ? 'logo-3d-idle' : ''
        }`}
        style={{
          transform: tilt.hovered || spinTurns > 0 ? interactiveTransform : undefined,
          transition:
            spinTurns > 0 && !tilt.hovered
              ? 'transform 780ms cubic-bezier(0.22, 1, 0.36, 1)'
              : tilt.hovered
                ? 'transform 120ms ease-out'
                : 'transform 420ms cubic-bezier(0.22, 1, 0.36, 1)',
        }}
      >
        {/* 3D Extruded Back Coin Rim Layers */}
        <div
          aria-hidden="true"
          className="absolute inset-0 rounded-full bg-gradient-to-br from-slate-800 via-blue-950 to-slate-950 pointer-events-none"
          style={{ transform: `translateZ(${sizeConfig.zRim3}px)` }}
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 rounded-full bg-gradient-to-br from-blue-900 via-indigo-900 to-slate-900 pointer-events-none"
          style={{ transform: `translateZ(${sizeConfig.zRim2}px)` }}
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 rounded-full bg-gradient-to-br from-sky-500 via-blue-800 to-indigo-950 pointer-events-none"
          style={{ transform: `translateZ(${sizeConfig.zRim1}px)` }}
        />

        {/* Front Beveled Medallion Frame */}
        <div
          className={`logo-3d-preserve relative w-full h-full rounded-full ${sizeConfig.padClass} bg-gradient-to-br from-sky-300 via-blue-600 to-indigo-900 dark:from-cyan-300 dark:via-blue-500 dark:to-indigo-900 ${sizeConfig.shadowClass}`}
          style={{ transform: 'translateZ(0px)' }}
        >
          {/* Inner Sculpted Portrait / Logo Surface */}
          <div
            className="relative w-full h-full rounded-full overflow-hidden bg-slate-950 ring-1 ring-white/50 dark:ring-sky-200/40"
            style={{ transform: `translateZ(${sizeConfig.zFace}px)` }}
          >
            {!imgFailed ? (
              <img
                src={src}
                alt={alt}
                referrerPolicy="no-referrer"
                onError={() => setImgFailed(true)}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-700 to-indigo-900 text-white font-display font-bold text-lg">
                {alt.slice(0, 2).toUpperCase()}
              </div>
            )}

            {/* Inner 3D Concave Depth Shadow */}
            <div
              aria-hidden="true"
              className="absolute inset-0 rounded-full pointer-events-none shadow-[inset_0_3px_10px_rgba(255,255,255,0.35),inset_0_-8px_16px_rgba(2,6,23,0.45)]"
            />
          </div>

          {/* Dynamic Specular 3D Light Reflection */}
          <div
            aria-hidden="true"
            className="absolute inset-[2px] rounded-full pointer-events-none mix-blend-screen"
            style={{
              transform: `translateZ(${sizeConfig.zSheen}px)`,
              background: `radial-gradient(circle at ${tilt.gx}% ${tilt.gy}%, rgba(255,255,255,0.42) 0%, rgba(186,230,253,0.12) 34%, transparent 65%)`,
            }}
          />
        </div>
      </div>
    </div>
  );
}
