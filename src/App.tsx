import React, { useEffect, useRef, useState } from "react";

// Warm Pulse Arcade — Seven Mini‑Games in one React file
// Controls: touch/click. Works on mobile + desktop. Uses Web Audio API (tones) and Vibration (when available).
// Tailwind classes for styling (canvas environment supports Tailwind).

// -----------------------------
// Utilities
// -----------------------------
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
// Useful function maybe later
// const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const now = () => performance.now();
const rand = (min: number, max: number) => Math.random() * (max - min) + min;

// Soft palettes (name, [from, via, to])
const PALETTES = [
  { key: "aurora", g: "from-rose-300 via-amber-200 to-emerald-200", a: ["#fecdd3", "#fde68a", "#a7f3d0"] },
  { key: "molten", g: "from-orange-300 via-rose-200 to-pink-300", a: ["#fdba74", "#fecdd3", "#f9a8d4"] },
  { key: "sunset", g: "from-amber-200 via-rose-200 to-violet-200", a: ["#fde68a", "#fecdd3", "#ddd6fe"] },
  { key: "lilac", g: "from-fuchsia-200 via-violet-200 to-sky-200", a: ["#f5d0fe", "#ddd6fe", "#bae6fd"] },
  { key: "reef", g: "from-teal-200 via-emerald-200 to-sky-200", a: ["#99f6e4", "#a7f3d0", "#bae6fd"] },
];

// -----------------------------
// Haptics wrapper
// -----------------------------
const vibrate = (pattern: number | number[]) => {
  if (typeof navigator !== "undefined" && (navigator as any).vibrate) {
    try { (navigator as any).vibrate(pattern as any); } catch {}
  }
};

// -----------------------------
// Audio (Web Audio API) — simple tone & blip
// -----------------------------
class Sound {
  ctx: AudioContext | null = null;
  gain!: GainNode;
  unlocked = false;

  ensure(): AudioContext | null {
    if (this.ctx) return this.ctx;
    const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return null;                 // no API, bail safely
    const ctx: AudioContext = new Ctx();   // ✅ make an instance
    const gain = ctx.createGain();         // ✅ safe: ctx is non-null
    gain.gain.value = 0.1;
    gain.connect(ctx.destination);
    this.ctx = ctx;
    this.gain = gain;
    return ctx;
  }

  async unlock() {
    const ctx = this.ensure();
    if (!ctx) return;
    if (ctx.state === "suspended") {
      try { await ctx.resume(); } catch {}
    }
    this.unlocked = true;
  }

  tone(freq = 440, dur = 0.08) {
    const ctx = this.ensure();
    if (!ctx) return;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine";
    o.frequency.value = freq;
    g.gain.value = 0.001;
    o.connect(g); g.connect(this.gain);
    const t = ctx.currentTime;
    g.gain.exponentialRampToValueAtTime(0.12, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  blip(success = true) {
    this.tone(success ? 740 : 180, success ? 0.06 : 0.12);
  }
}

const sound = new Sound();

// -----------------------------
// Shared UI
// -----------------------------
function Card(props: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...props}
      className={
        "rounded-2xl shadow-xl p-4 md:p-6 backdrop-blur bg-white/40 border border-white/50 " +
        (props.className || "")
      }
    />
  );
}

function GradientBG({ palette }: { palette: (typeof PALETTES)[number] }) {
  return (
    <div className={`absolute inset-0 bg-gradient-to-br ${palette.g} transition-all`} />
  );
}

function TopBar({ title, onBack, palette, setPalette, tokens }: any) {
  return (
    <div className="fixed z-30 top-0 left-0 right-0 flex items-center justify-between px-4 py-3">
      <div className="flex items-center gap-2">
        {onBack && (
          <button
            onClick={onBack}
            className="px-3 py-2 rounded-xl bg-white/50 hover:bg-white/70 active:scale-95 transition"
          >
            ← Back
          </button>
        )}
        <h1 className="text-xl md:text-2xl font-semibold drop-shadow-sm text-slate-800">
          {title}
        </h1>
      </div>
      <div className="flex items-center gap-2">
        <div className="px-3 py-1 rounded-xl bg-white/60 border">⭐ {tokens}</div>
        <select
          aria-label="Palette"
          className="px-2 py-1 rounded-xl bg-white/60 border"
          value={palette.key}
          onChange={(e) => setPalette(PALETTES.find(p => p.key === e.target.value) || PALETTES[0])}
        >
          {PALETTES.map(p => <option key={p.key} value={p.key}>{p.key}</option>)}
        </select>
      </div>
    </div>
  );
}

// -----------------------------
// Game: PulseLink — tap in sync with pulsating orb
// -----------------------------
function GamePulseLink({ onExit, award }: { onExit: (score: number) => void, award: (n:number)=>void }) {
  const [score, setScore] = useState(0);
//const [running, setRunning] = useState(false);
  const [beatAt, setBeatAt] = useState(0);
  const beatRef = useRef({ bpm: 84, last: 0 });
  const [phase, setPhase] = useState(0); // for visual

  useEffect(() => {
    let raf = 0;
    const loop = () => {
      const t = now();
      // animate phase by current beat interval
      const interval = 60 / beatRef.current.bpm;
      const p = ((t / 1000) % interval) / interval;
      setPhase(p);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    let id: number | null = null;
    const start = () => {
//    setRunning(true);
      beatRef.current.bpm = Math.round(rand(72, 128));
      const tick = () => {
        const interval = 60000 / beatRef.current.bpm;
        setBeatAt(performance.now());
        sound.tone(220, 0.05);
        vibrate(10);
        id = window.setTimeout(tick, interval);
      };
      tick();
    };
    start();
    return () => { if (id) clearTimeout(id); };
  }, []);

  const onTap = () => {
    sound.blip(true);
    const interval = 60000 / beatRef.current.bpm;
    const t = performance.now();
    const d = Math.abs((t - beatAt) % interval);
    const err = Math.min(d, interval - d); // nearest beat error
    const acc = 1 - clamp(err / (interval / 2), 0, 1);
    const gain = Math.round(acc * 10);
    setScore(s => s + gain);
    if (gain >= 9) vibrate([10, 10, 10]);
  };

  return (
    <div className="relative pt-16 min-h-screen flex items-center justify-center">
      <div className="absolute inset-0 flex items-center justify-center">
        <div
          className="w-64 h-64 rounded-full shadow-2xl"
          style={{
            background: `radial-gradient(circle at 50% 55%, rgba(255,255,255,0.9), rgba(255,255,255,0.2))`,
            transform: `scale(${1 + 0.15 * Math.sin(phase * Math.PI * 2)})`,
            transition: "transform 50ms linear",
          }}
        />
      </div>

      <Card className="relative z-10 w-80 text-center">
        <div className="text-3xl font-bold mb-2">PulseLink</div>
        <div className="text-slate-700 mb-4">Tap in sync with the pulse</div>
        <div className="text-5xl font-black mb-4">{score}</div>
        <button
          onPointerDown={onTap}
          className="w-full py-4 rounded-xl bg-white hover:bg-rose-50 active:scale-95 transition font-semibold"
        >Tap</button>
        <div className="mt-4 text-sm text-slate-600">BPM: {beatRef.current.bpm}</div>
        <div className="mt-4 flex gap-2"><button className="flex-1 px-3 py-2 rounded-xl bg-white/70" onClick={() => { award(Math.floor(score/5)); onExit(score); }}>Exit & Save</button></div>
      </Card>
    </div>
  );
}

// -----------------------------
// Game: HeatBloom — hold & balance heat to bloom the crystal
// -----------------------------
function GameHeatBloom({ onExit, award }: { onExit: (score: number) => void, award:(n:number)=>void }) {
  const [score, setScore] = useState(0);
  const heat = useRef(0);
  const target = useRef({ min: 0.45, max: 0.65 });
  const holding = useRef(false);
  const [viewHeat, setViewHeat] = useState(0);
  const [bloom, setBloom] = useState(0);

  useEffect(() => {
    let raf = 0; let last = now();
    const loop = () => {
      const t = now();
      const dt = (t - last) / 1000; last = t;
      // heat physics
      const kUp = 0.55, kDown = 0.35;
      if (holding.current) heat.current += kUp * dt; else heat.current -= kDown * dt;
      heat.current = clamp(heat.current, 0, 1);
      setViewHeat(heat.current);

      const inBand = heat.current >= target.current.min && heat.current <= target.current.max;
      if (inBand) {
        setBloom(b => clamp(b + dt * 0.6, 0, 1));
        if (bloom + dt * 0.6 >= 1) {
          // success
          setScore(s => s + 10);
          sound.blip(true); vibrate([10, 10, 10]);
          setBloom(0);
          target.current = { min: rand(0.3, 0.5), max: rand(0.6, 0.8) };
        }
      } else {
        setBloom(b => clamp(b - dt * 0.8, 0, 1));
      }

      // overheat crack
      if (heat.current >= 0.995) {
        sound.blip(false); vibrate(40);
        setScore(s => Math.max(0, s - 3));
        heat.current = 0.3; setBloom(0);
        target.current = { min: rand(0.35, 0.55), max: rand(0.6, 0.85) };
      }

      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [bloom]);

  return (
    <div className="relative pt-16 min-h-screen flex items-center justify-center">
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-64 h-64 rounded-3xl shadow-2xl backdrop-blur"
             style={{
               background: `conic-gradient(from 0deg, rgba(255,255,255,${0.4 + 0.4*bloom}) ${viewHeat*360}deg, rgba(255,255,255,0.12) 0deg)`,
               transform: `scale(${1 + bloom*0.2})`,
               transition: "transform 120ms linear"
             }} />
      </div>

      <Card className="relative z-10 w-80 text-center select-none">
        <div className="text-3xl font-bold mb-2">HeatBloom</div>
        <div className="text-slate-700 mb-3">Hold to warm. Keep heat in the band until it blooms.</div>
        <div className="text-5xl font-black mb-4">{score}</div>
        <div className="h-4 rounded-full bg-white/60 overflow-hidden mb-2">
          <div className="h-full bg-white" style={{ width: `${viewHeat*100}%` }} />
        </div>
        <div className="flex items-center justify-between text-xs mb-2">
          <span>0</span><span>heat</span><span>1</span>
        </div>
        <div className="h-2 w-full bg-emerald-600/30 rounded relative mb-4">
          <div className="absolute top-0 bottom-0 bg-emerald-400/70" style={{ left: `${target.current.min*100}%`, right: `${(1-target.current.max)*100}%` }} />
        </div>
        <button
          onPointerDown={() => { holding.current = true; sound.tone(320, 0.04); }}
          onPointerUp={() => { holding.current = false; }}
          onPointerCancel={() => { holding.current = false; }}
          className="w-full py-4 rounded-xl bg-white hover:bg-emerald-50 active:scale-95 transition font-semibold"
        >Hold</button>
        <div className="mt-4 flex gap-2"><button className="flex-1 px-3 py-2 rounded-xl bg-white/70" onClick={() => { award(Math.floor(score/5)); onExit(score); }}>Exit & Save</button></div>
      </Card>
    </div>
  );
}

// -----------------------------
// Game: TensionLine — stretch thread to the perfect length
// -----------------------------
function GameTensionLine({ onExit, award }: { onExit: (score: number) => void, award:(n:number)=>void }) {
  const [score, setScore] = useState(0);
  const [len, setLen] = useState(0.4);
  const [target, setTarget] = useState(rand(0.35, 0.8));
  const pulling = useRef(false);

  const onDown = () => {
	  pulling.current = true;
  };
  
  const onUp = () => {
    pulling.current = false;
    const err = Math.abs(len - target);
    const pts = Math.max(0, Math.round(12 - err * 40));
    setScore(s => s + pts);
    if (err < 0.04) {
		sound.blip(true);
		vibrate([10, 10, 10]);
	} else {
		sound.blip(false);
		}
    setTarget(rand(0.3, 0.9));
  };

  useEffect(() => {
    let raf = 0; let last = now();
    const loop = () => {
      const t = now();
	  const dt = (t - last) / 1000; last = t;
      if (pulling.current) {
		  setLen(v => clamp(v + dt * 0.35, 0, 1));
	  } else {
		  setLen(v => clamp(v - dt * 0.25, 0, 1));
	  }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className="relative pt-16 min-h-screen flex items-center justify-center">
      <Card className="w-[360px] text-center">
        <div className="text-3xl font-bold mb-2">TensionLine</div>
        <div className="text-slate-700 mb-3">Hold to stretch. Release when the line matches the target.</div>
        <div className="text-5xl font-black mb-4">{score}</div>
        <div className="h-24 relative bg-white/50 rounded-xl mb-4 flex items-center justify-center overflow-hidden">
          <div className="absolute left-6 right-6 h-[2px] bg-slate-700/40" />
          <div className="absolute left-6" style={{ right: `${(1-target)*100+6}%` }}>
            <div className="h-3 w-3 rounded-full bg-emerald-500/80" style={{ position: 'absolute', left: `${target*100}%`, transform: 'translateX(-50%)' }} />
          </div>
          <div className="absolute left-6 right-6 flex items-center" style={{ gap: 0 }}>
            <div className="h-[3px] bg-fuchsia-500/90" style={{ width: `${len*100}%` }} />
          </div>
        </div>
        <button onPointerDown={onDown} onPointerUp={onUp} onPointerCancel={onUp}
                className="w-full py-4 rounded-xl bg-white hover:bg-fuchsia-50 active:scale-95 transition font-semibold">Hold</button>
        <div className="mt-4 flex gap-2"><button className="flex-1 px-3 py-2 rounded-xl bg-white/70" onClick={() => { award(Math.floor(score/6)); onExit(score); }}>Exit & Save</button></div>
      </Card>
    </div>
  );
}

// -----------------------------
// Game: Echo Orb — recall interval & echo it back with two taps
// -----------------------------
function GameEchoOrb({ onExit, award }: { onExit: (score: number) => void, award:(n:number)=>void }) {
  const [phase, setPhase] = useState<'listen'|'tap'|'result'>('listen');
  const [intervalMs, setIntervalMs] = useState(800);
  const [score, setScore] = useState(0);
  const [pulse, setPulse] = useState(0);
  const taps = useRef<number[]>([]);

  useEffect(() => {
    let timer: any;
    if (phase === 'listen') {
      setPulse(1);
      sound.tone(240, 0.1); vibrate(10);
      timer = setTimeout(() => {
        setPulse(0);
        timer = setTimeout(() => {
          setPhase('tap');
        }, intervalMs);
      }, 300);
    }
    return () => clearTimeout(timer);
  }, [phase, intervalMs]);

  const onTap = () => {
    if (phase !== 'tap') return;
    taps.current.push(performance.now());
    if (taps.current.length === 2) {
      const d = Math.abs(taps.current[1] - taps.current[0]);
      const err = Math.abs(d - intervalMs);
      const acc = 1 - clamp(err / 800, 0, 1);
      const pts = Math.round(acc * 12);
      setScore(s => s + pts);
      if (pts > 8) { sound.blip(true); vibrate([10,10,10]); } else sound.blip(false);
      setPhase('result');
      setTimeout(() => {
        taps.current = [];
        setIntervalMs(rand(500, 1400));
        setPhase('listen');
      }, 700);
    }
  };

  return (
    <div className="relative pt-16 min-h-screen flex items-center justify-center" onPointerDown={onTap}>
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-56 h-56 rounded-full shadow-xl"
             style={{
               background: `radial-gradient(circle, rgba(255,255,255,${0.9 - pulse*0.2}), rgba(255,255,255,0.18))`,
               transform: `scale(${1 + pulse*0.25})`, transition: 'transform 150ms ease'
             }} />
      </div>
      <Card className="relative z-10 w-80 text-center">
        <div className="text-3xl font-bold mb-2">Echo Orb</div>
        <div className="text-slate-700 mb-3">Watch the pulse, then tap twice to echo the interval.</div>
        <div className="text-5xl font-black mb-4">{score}</div>
        <div className="mb-2 text-sm">Phase: {phase}</div>
        <div className="text-xs text-slate-600 mb-4">Target interval: {Math.round(intervalMs)}ms</div>
        <div className="mt-4 flex gap-2"><button className="flex-1 px-3 py-2 rounded-xl bg-white/70" onClick={() => { award(Math.floor(score/6)); onExit(score); }}>Exit & Save</button></div>
      </Card>
    </div>
  );
}

// -----------------------------
// Game: PressureCraft — press & release inside zone to forge
// -----------------------------
function GamePressureCraft({ onExit, award }: { onExit: (score: number) => void, award:(n:number)=>void }) {
  const [score, setScore] = useState(0);
  const [level, setLevel] = useState(1);
  const [fill, setFill] = useState(0);
  const [holding, setHolding] = useState(false);
  const [zone, setZone] = useState({ a: 0.5, b: 0.7, dir: 1 });

  useEffect(() => {
    let raf = 0; let last = now();
    const loop = () => {
      const t = now(); const dt = (t - last) / 1000; last = t;
      setFill(f => clamp(f + (holding ? 1 : -1) * dt * 0.8, 0, 1));
      setZone(z => {
        const speed = 0.2 + level * 0.04;
        let a = z.a + z.dir * dt * speed; let b = z.b + z.dir * dt * speed;
        if (b >= 1 || a <= 0) { z.dir *= -1; a = clamp(a, 0, 0.85); b = clamp(b, 0.15, 1); }
        return { ...z, a, b };
      });
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [holding, level]);

  const release = () => {
    setHolding(false);
    if (fill >= zone.a && fill <= zone.b) {
      sound.blip(true); vibrate([10,10,10]);
      setScore(s => s + 12);
      setLevel(l => l + 1);
      setFill(0.15);
    } else {
      sound.blip(false); vibrate(30);
      setScore(s => Math.max(0, s - 4));
      setFill(0.05);
    }
  };

  return (
    <div className="relative pt-16 min-h-screen flex items-center justify-center">
      <Card className="w-[360px] text-center">
        <div className="text-3xl font-bold mb-2">PressureCraft</div>
        <div className="text-slate-700 mb-3">Press & hold to fill. Release inside the moving zone to forge.</div>
        <div className="text-5xl font-black mb-4">{score}</div>
        <div className="h-36 bg-white/50 rounded-xl p-4 flex flex-col gap-3">
          <div className="flex-1 relative rounded-md overflow-hidden bg-white/70">
            <div className="absolute inset-0">
              <div className="absolute left-0 top-0 bottom-0 bg-emerald-300/50" style={{ left: `${zone.a*100}%`, right: `${(1-zone.b)*100}%` }} />
              <div className="absolute left-0 top-0 bottom-0 bg-fuchsia-500/80" style={{ width: `${fill*100}%` }} />
            </div>
          </div>
          <div className="text-sm">Level {level}</div>
        </div>
        <button
          onPointerDown={() => setHolding(true)} onPointerUp={release} onPointerCancel={release}
          className="mt-4 w-full py-4 rounded-xl bg-white hover:bg-emerald-50 active:scale-95 transition font-semibold"
        >Hold</button>
        <div className="mt-4 flex gap-2"><button className="flex-1 px-3 py-2 rounded-xl bg-white/70" onClick={() => { award(Math.floor(score/6)); onExit(score); }}>Exit & Save</button></div>
      </Card>
    </div>
  );
}

// -----------------------------
// Game: Ascend Light — tap to thrust, ride updrafts, avoid ground/ceiling
// -----------------------------
function GameAscendLight({ onExit, award }: { onExit: (score: number) => void, award:(n:number)=>void }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [running, setRunning] = useState(true);
  const [score, setScore] = useState(0);
  const pressRef = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current!; const ctx = canvas.getContext('2d')!;
    let W = 360, H = 560; let dpr = Math.min(2, window.devicePixelRatio || 1);
    const resize = () => { W = Math.min(420, canvas.clientWidth); H = Math.min(720, canvas.clientHeight); canvas.width = W * dpr; canvas.height = H * dpr; ctx.setTransform(dpr,0,0,dpr,0,0); };
    resize();
    const onRes = () => resize();
    window.addEventListener('resize', onRes);

    // world
    let y = H*0.6, vy = 0; let t = 0; let alive = true; let last = now();
    const zones = Array.from({length: 5}, (_,i)=>({x: i*220 + 200, y: rand(120,H-120), r: 60}));

    const loop = () => {
      const tt = now(); const dt = (tt - last)/1000; last = tt; t += dt;
      ctx.clearRect(0,0,W,H);

      // physics
      if (!alive) vy += 40*dt; else { vy += 160*dt; if (pressRef.current) { vy -= 360*dt; if (Math.random()<0.2) sound.tone(500,0.02); } }
      y += vy*dt; if (y<10) { y=10; vy=0; alive=false; } if (y>H-10) { y=H-10; vy=0; alive=false; }

      // zones & score
      for (const z of zones) { z.x -= 120*dt; if (z.x < -60) { z.x += 5*220; z.y = rand(120,H-120); }
        const dx = (W*0.35) - z.x; const dy = y - z.y; const d = Math.hypot(dx,dy);
        const boost = clamp(1 - d/z.r, 0, 1); vy -= 240*boost*dt; // updraft
        if (alive && boost>0.8) setScore(s=>s+1);
      }

      // draw
      // ship
      ctx.save(); ctx.translate(W*0.35, y); ctx.rotate(Math.atan2(-vy, 120));
      ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.beginPath(); ctx.moveTo(18,0); ctx.lineTo(-12,8); ctx.lineTo(-12,-8); ctx.closePath(); ctx.fill();
      ctx.restore();

      // zones
      for (const z of zones) {
        const grd = ctx.createRadialGradient(z.x, z.y, 5, z.x, z.y, z.r);
        grd.addColorStop(0, 'rgba(255,255,255,0.9)');
        grd.addColorStop(1, 'rgba(255,255,255,0.1)');
        ctx.fillStyle = grd; ctx.beginPath(); ctx.arc(z.x, z.y, z.r, 0, Math.PI*2); ctx.fill();
      }

      // ground/ceiling
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.fillRect(0,0,W,6); ctx.fillRect(0,H-6,W,6);

      if (!alive) {
        ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(0,0,W,H);
        ctx.fillStyle = 'white'; ctx.font = 'bold 24px ui-sans-serif'; ctx.fillText('Crashed · Tap Exit', W/2-90, H/2);
      }
      if (running) requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);

    return () => { setRunning(false); window.removeEventListener('resize', onRes); };
  }, [running]);

  return (
    <div className="relative pt-16 min-h-screen flex items-center justify-center select-none">
      <Card className="w-[380px] h-[640px] p-2 flex flex-col">
        <div className="text-3xl font-bold mb-2 text-center">Ascend Light</div>
        <div className="text-center text-slate-700 mb-2">Tap to thrust. Ride thermals. Avoid ground & ceiling.</div>
        <div className="text-center text-4xl font-black mb-2">{score}</div>
        <div className="flex-1 relative rounded-xl overflow-hidden bg-white/40">
          <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" onPointerDown={()=>{ pressRef.current=true; vibrate(10); }} onPointerUp={()=>{ pressRef.current=false; }} onPointerCancel={()=>{ pressRef.current=false; }} />
        </div>
        <div className="mt-3 flex gap-2"><button className="flex-1 px-3 py-2 rounded-xl bg-white/70" onClick={()=>{ award(Math.floor(score/8)); onExit(score); }}>Exit & Save</button></div>
      </Card>
    </div>
  );
}

// -----------------------------
// Game: Heartbeat Collective — tap your natural rhythm, then sync
// -----------------------------
function GameHeartbeat({ onExit, award }: { onExit: (score: number) => void, award:(n:number)=>void }) {
  const [phase, setPhase] = useState<'cal'|'sync'>('cal');
  const [bpm, setBpm] = useState(0);
  const taps = useRef<number[]>([]);
  const [score, setScore] = useState(0);
  const [pulse, setPulse] = useState(0);

  useEffect(() => {
    if (phase !== 'sync') return;
    let id: any; const interval = 60000 / (bpm || 60);
    const tick = () => { setPulse(1); sound.tone(200, 0.08); vibrate(8); id = setTimeout(()=> setPulse(0), 180); id = setTimeout(tick, interval); };
    tick();
    return () => clearTimeout(id);
  }, [phase, bpm]);

  const onTap = () => {
    if (phase === 'cal') {
      taps.current.push(performance.now());
      sound.tone(260, 0.05);
      if (taps.current.length >= 6) {
        const ds = taps.current.slice(1).map((t,i)=> t - taps.current[i]);
        const avg = ds.reduce((a,b)=>a+b,0)/ds.length; const candidate = clamp(60000/avg, 50, 150);
        setBpm(candidate);
        setPhase('sync'); taps.current = [];
      }
    } else {
      // measure sync accuracy vs beat time
      const interval = 60000 / (bpm || 60);
      const d = (performance.now()) % interval; const err = Math.min(d, interval - d);
      const acc = 1 - clamp(err / (interval/2), 0, 1);
      const pts = Math.round(acc * 10);
      setScore(s=>s+pts);
      if (pts>8) { sound.blip(true); vibrate([10,10,10]); } else sound.blip(false);
    }
  };

  return (
    <div className="relative pt-16 min-h-screen flex items-center justify-center" onPointerDown={onTap}>
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-56 h-56 rounded-full shadow-xl"
             style={{ background: `radial-gradient(circle, rgba(255,255,255,${0.9 - pulse*0.2}), rgba(255,255,255,0.18))`, transform: `scale(${1 + pulse*0.3})`, transition: 'transform 120ms ease' }} />
      </div>
      <Card className="relative z-10 w-80 text-center">
        <div className="text-3xl font-bold mb-2">Heartbeat Collective</div>
        {phase==='cal' ? (
          <>
            <div className="text-slate-700 mb-3">Tap your natural rhythm 6+ times to calibrate.</div>
            <div className="text-5xl font-black mb-2">—</div>
          </>
        ) : (
          <>
            <div className="text-slate-700 mb-1">Sync to your beat · BPM {Math.round(bpm)}</div>
            <div className="text-5xl font-black mb-2">{score}</div>
          </>
        )}
        <div className="mt-4 flex gap-2"><button className="flex-1 px-3 py-2 rounded-xl bg-white/70" onClick={()=>{ award(Math.floor(score/6)); onExit(score); }}>Exit & Save</button></div>
      </Card>
    </div>
  );
}

// -----------------------------
// Menu game: simple wrapper to choose which game to play
// -----------------------------

type GameKey = 'pulse'|'heat'|'tension'|'echo'|'pressure'|'ascend'|'heart';

function GameFrame({ game, onExit, award }:{ game: GameKey, onExit: (score:number)=>void, award:(n:number)=>void }){
  if (game==='pulse') return <GamePulseLink onExit={onExit} award={award} />;
  if (game==='heat') return <GameHeatBloom onExit={onExit} award={award} />;
  if (game==='tension') return <GameTensionLine onExit={onExit} award={award} />;
  if (game==='echo') return <GameEchoOrb onExit={onExit} award={award} />;
  if (game==='pressure') return <GamePressureCraft onExit={onExit} award={award} />;
  if (game==='ascend') return <GameAscendLight onExit={onExit} award={award} />;
  return <GameHeartbeat onExit={onExit} award={award} />;
}

// -----------------------------
// Store & Persistence (localStorage)
// -----------------------------
const LS_KEY = "warm-pulse-arcade";

type SaveState = {
  tokens: number;
  palette: string;
  best: Record<GameKey, number>;
};

function loadState(): SaveState {
  try {
    const txt = localStorage.getItem(LS_KEY);
    if (txt) return JSON.parse(txt);
  } catch {}
  return { tokens: 0, palette: PALETTES[0].key, best: { pulse:0, heat:0, tension:0, echo:0, pressure:0, ascend:0, heart:0 } };
}

function saveState(s: SaveState){ try { localStorage.setItem(LS_KEY, JSON.stringify(s)); } catch {} }

// -----------------------------
// Main App
// -----------------------------
export default function App(){
  const [state, setState] = useState<SaveState>(()=> loadState());
  const [palette, setPalette] = useState(PALETTES.find(p=>p.key===state.palette) || PALETTES[0]);
  const [view, setView] = useState<'menu'|GameKey|"store"|"about">('menu');
  const [audioReady, setAudioReady] = useState(false);

  useEffect(()=>{ const s = { ...state, palette: palette.key }; setState(s); saveState(s); }, [palette.key]);
  useEffect(()=>{ saveState(state); }, [state]);

  const startAudio = async () => { await sound.unlock(); setAudioReady(true); };

  const award = (n:number)=> setState(s=> ({...s, tokens: s.tokens + Math.max(0, n)}));
  const onExit = (gscore:number) => {
    if (view=== 'menu' || view==='store' || view==='about') return;
    setState(s=> ({...s, best: { ...s.best, [view]: Math.max(s.best[view], gscore) }}));
    setView('menu');
  };

  const menuItems: { key: GameKey, title: string, desc: string }[] = [
    { key: 'pulse', title: 'PulseLink', desc: 'Tap in sync with a living beat' },
    { key: 'heat', title: 'HeatBloom', desc: 'Warm crystals — don\'t overheat' },
    { key: 'tension', title: 'TensionLine', desc: 'Stretch the thread to tune' },
    { key: 'echo', title: 'Echo Orb', desc: 'Hear a pulse — echo it back' },
    { key: 'pressure', title: 'PressureCraft', desc: 'Press & release in the zone' },
    { key: 'ascend', title: 'Ascend Light', desc: 'Glide on thermals — ascend' },
    { key: 'heart', title: 'Heartbeat Collective', desc: 'Calibrate, then sync to you' },
  ];

  const spend = (n:number) => setState(s=> ({...s, tokens: Math.max(0, s.tokens - n)}));

  return (
    <div className="relative min-h-screen overflow-hidden">
      <GradientBG palette={palette} />
      <TopBar title={view==='menu' ? 'Warm Pulse Arcade' : view==='store' ? 'Shop' : view==='about' ? 'About' : menuItems.find(m=>m.key===view)?.title}
              onBack={view!=='menu' ? ()=> setView('menu') : undefined}
              glow={0}
              palette={palette} setPalette={setPalette} tokens={state.tokens} />

      {!audioReady && (
        <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur flex items-center justify-center">
          <Card className="w-80 text-center">
            <div className="text-xl font-semibold mb-2">Enable Sound & Haptics</div>
            <div className="text-slate-700 mb-4">Tap below so your browser lets the game play soft tones and vibrations.</div>
            <button className="w-full py-3 rounded-xl bg-white hover:bg-rose-50 active:scale-95 font-semibold" onClick={startAudio}>Tap to Start</button>
          </Card>
        </div>
      )}

      {view==='menu' && (
        <div className="pt-20 pb-10 px-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-w-5xl mx-auto">
          {menuItems.map(m => (
            <Card key={m.key} className="cursor-pointer hover:scale-[1.01] transition" onClick={()=> setView(m.key)}>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xl font-semibold">{m.title}</div>
                  <div className="text-slate-700 text-sm">{m.desc}</div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-slate-600">Best</div>
                  <div className="text-2xl font-bold">{state.best[m.key]}</div>
                </div>
              </div>
            </Card>
          ))}

          <Card className="col-span-1 md:col-span-2 lg:col-span-3">
            <div className="flex flex-wrap items-center gap-3 justify-between">
              <div>
                <div className="font-semibold">Cosmetics & Tokens</div>
                <div className="text-slate-700 text-sm">Earn ⭐ by scoring well. Visit the shop for ambient themes.</div>
              </div>
              <div className="flex gap-2">
                <button className="px-3 py-2 rounded-xl bg-white/70" onClick={()=> setView('store')}>Open Shop</button>
                <button className="px-3 py-2 rounded-xl bg-white/70" onClick={()=> setView('about')}>About</button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {view==='store' && (
        <div className="pt-20 pb-10 px-4 max-w-3xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-4">
          {PALETTES.map(p => (
            <Card key={p.key}>
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold">Theme: {p.key}</div>
                  <div className="flex gap-1 mt-2">
                    {p.a.map((c,i)=> <div key={i} className="w-6 h-6 rounded-full border" style={{ background: c }} />)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm">Cost: 20 ⭐</div>
                  <button disabled={palette.key===p.key || state.tokens<20}
                          onClick={()=>{ spend(20); setPalette(p); sound.blip(true); vibrate([10,10,10]); }}
                          className={`mt-2 px-3 py-2 rounded-xl ${palette.key===p.key? 'bg-white/50' : 'bg-white/80 hover:bg-white'}`}>{palette.key===p.key? 'Equipped' : 'Buy'}</button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {view==='about' && (
        <div className="pt-20 pb-10 px-4 max-w-xl mx-auto">
          <Card>
            <div className="text-lg font-semibold mb-2">About</div>
            <p className="text-slate-800">Seven minimalist, cozy‑tension mini‑games with soft audio & haptics. Earn ⭐ to unlock themes. No login; data stays on your device.</p>
          </Card>
        </div>
      )}

      {(['pulse','heat','tension','echo','pressure','ascend','heart'] as GameKey[]).includes(view as GameKey) && (
        <div className="pt-12">
          <GameFrame game={view as GameKey} onExit={onExit} award={award} />
        </div>
      )}

      <footer className="fixed bottom-2 left-0 right-0 text-center text-[11px] text-slate-700/80">
        Built for mobile · Haptics where supported · Your data lives in localStorage
      </footer>
    </div>
  );
}
