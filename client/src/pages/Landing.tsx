import { Link } from 'react-router-dom';
import { ArrowRight, Shield, Key, Download, RocketLaunch, Lock, Users } from '@phosphor-icons/react';

export default function Landing() {
  return (
    <div className="min-h-[100dvh] flex flex-col">
      <div className="px-6 pt-6 max-w-[1400px] mx-auto w-full relative z-10">
        <div className="glass-header px-8 h-16 flex items-center justify-between">
          <span className="text-ivory font-bold text-lg tracking-tight">Onyx</span>
          <div className="flex gap-2">
            <Link to="/login" className="btn btn-ghost btn-sm">Sign In</Link>
            <Link to="/register" className="btn btn-primary btn-sm">Get Started</Link>
          </div>
        </div>
      </div>

      <main className="flex-1 flex flex-col" style={{ animation: 'fadeUp 0.8s cubic-bezier(0.16, 1, 0.3, 1) both' }}>
        <section className="flex-1 flex items-center px-6 max-w-[1400px] mx-auto w-full py-16 lg:py-20">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-20 items-center w-full">
            <div className="lg:col-span-5">
              <span className="eyebrow mb-6 block">Onyx Platform</span>
              <h1 className="text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-bold tracking-tighter leading-[0.95] mb-6 text-ivory">
                Minecraft mod<br />licensing,<br />done right.
              </h1>
              <p className="text-base text-stone leading-relaxed max-w-md mb-10">
                Secure authentication, hardware-bound license keys, and seamless JAR distribution
                for your Fabric mod — all in one place.
              </p>
              <div className="flex gap-4">
                <Link to="/register" className="btn btn-primary">
                  Get Started
                  <ArrowRight size={16} />
                </Link>
                <Link to="/login" className="btn btn-outline">
                  Sign In
                </Link>
              </div>
            </div>

            <div className="lg:col-span-7 flex items-center justify-center">
              <div className="relative w-full min-h-[24rem] lg:min-h-[32rem] flex items-center justify-center">
                <div className="absolute -top-12 -right-12 w-96 h-96 bg-accent/4 rounded-full blur-[120px] pointer-events-none" />
                <div className="absolute -bottom-8 -left-8 w-64 h-64 bg-accent/3 rounded-full blur-[100px] pointer-events-none" />

                <div className="absolute inset-0 glass-card overflow-hidden" style={{ animation: 'float 8s ease-in-out infinite' }}>
                  <span className="absolute inset-0 flex items-center justify-center text-[18rem] lg:text-[22rem] font-bold text-[rgba(242,239,232,0.03)] select-none leading-none tracking-tighter">
                    O
                  </span>

                  <div className="absolute top-12 left-12 w-40 h-40 rounded-full border border-[rgba(242,239,232,0.07)]" />
                  <div className="absolute top-16 left-16 w-24 h-24 rounded-full border border-[rgba(242,239,232,0.05)]" />
                  <div className="absolute top-20 left-20 w-12 h-12 rounded-full border border-[rgba(242,239,232,0.08)]" />

                  <div className="absolute top-1/2 right-16 w-3 h-3 rounded-full bg-accent/50" style={{ animation: 'pulseSlow 3s ease-in-out infinite' }} />
                  <div className="absolute top-[calc(50%+2rem)] right-20 w-1.5 h-1.5 rounded-full bg-accent/30" style={{ animation: 'pulseSlow 4s ease-in-out 1s infinite' }} />

                  <div className="absolute bottom-16 right-24 w-28 h-px bg-[rgba(242,239,232,0.08)]" />
                  <div className="absolute bottom-20 right-24 w-px h-20 bg-[rgba(242,239,232,0.06)]" />

                  <div className="absolute bottom-8 right-8 glass-card-strong p-5 min-w-[160px]">
                    <span className="text-2xl font-bold text-accent">99.9%</span>
                    <span className="block text-xs text-stone mt-1">Uptime</span>
                  </div>
                </div>

                <div className="absolute -bottom-6 -right-6 w-3/4 h-3/4 glass-card opacity-40 -z-10" style={{ animation: 'float 8s ease-in-out 2s infinite' }} />
              </div>
            </div>
          </div>
        </section>

        <section className="px-6 py-24 lg:py-32 max-w-[1400px] mx-auto w-full">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="glass-card p-8 md:col-span-2 relative overflow-hidden">
              <div className="absolute -top-8 -right-8 w-48 h-48 bg-accent/4 rounded-full blur-[80px] pointer-events-none" />
              <div className="size-12 rounded-2xl bg-accent-soft flex items-center justify-center mb-5">
                <Shield size={24} className="text-accent" />
              </div>
              <h3 className="text-xl font-semibold mb-2 text-ivory tracking-tight">Hardware Binding</h3>
              <p className="text-sm text-stone leading-relaxed max-w-md">
                Licenses locked to HWID. Each key works on one machine only. No sharing, no abuse.
              </p>
              <div className="mt-6 flex gap-4 items-center">
                <div className="flex-1 h-1.5 rounded-full bg-[rgba(242,239,232,0.06)] overflow-hidden">
                  <div className="w-3/4 h-full rounded-full bg-accent/30" />
                </div>
                <span className="text-xs text-stone font-mono">256-bit</span>
              </div>
            </div>
            <div className="glass-card p-8 relative overflow-hidden">
              <div className="size-12 rounded-2xl bg-accent-soft flex items-center justify-center mb-5">
                <Key size={24} className="text-accent" />
              </div>
              <h3 className="text-xl font-semibold mb-2 text-ivory tracking-tight">Key Generation</h3>
              <p className="text-sm text-stone leading-relaxed">
                Time-limited license keys with configurable durations.
              </p>
            </div>
            <div className="glass-card p-8 relative overflow-hidden">
              <div className="size-12 rounded-2xl bg-accent-soft flex items-center justify-center mb-5">
                <Download size={24} className="text-accent" />
              </div>
              <h3 className="text-xl font-semibold mb-2 text-ivory tracking-tight">JAR Distribution</h3>
              <p className="text-sm text-stone leading-relaxed">
                Upload and distribute obfuscated builds to authorized users.
              </p>
            </div>
            <div className="glass-card p-8 md:col-span-2 relative overflow-hidden">
              <div className="absolute -top-8 -right-8 w-48 h-48 bg-accent/4 rounded-full blur-[80px] pointer-events-none" />
              <div className="size-12 rounded-2xl bg-accent-soft flex items-center justify-center mb-5">
                <RocketLaunch size={24} className="text-accent" />
              </div>
              <h3 className="text-xl font-semibold mb-2 text-ivory tracking-tight">Obfuscation Pipeline</h3>
              <p className="text-sm text-stone leading-relaxed max-w-xl">
                Multi-stage protection: string encryption, control flow obfuscation, name mangling, and native code packing.
              </p>
              <div className="mt-6 flex flex-wrap gap-2">
                {['AES-256', 'CFG Obfuscation', 'Unicode Names', 'Native Pack'].map(tag => (
                  <span key={tag} className="px-3 py-1.5 rounded-full text-[10px] uppercase tracking-wider bg-[rgba(242,239,232,0.06)] text-stone font-mono border border-[rgba(242,239,232,0.06)]">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="px-6 py-24 lg:py-32 max-w-[1400px] mx-auto w-full">
          <div className="text-center mb-16">
            <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold tracking-tighter text-ivory mb-4">
              Trusted by developers
            </h2>
            <p className="text-stone text-sm max-w-md mx-auto">
              Secure your mod distribution with hardware-bound licensing.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-3xl mx-auto">
            {[
              { value: '500+', label: 'Active Licenses' },
              { value: '99.9%', label: 'Uptime' },
              { value: '24/7', label: 'Support' },
            ].map(s => (
              <div key={s.label} className="text-center p-8 rounded-2xl border border-[rgba(242,239,232,0.06)] bg-[rgba(242,239,232,0.02)]">
                <span className="text-3xl md:text-4xl font-bold text-accent mb-2 block tracking-tight">{s.value}</span>
                <span className="text-sm text-stone">{s.label}</span>
              </div>
            ))}
          </div>
        </section>

        <footer className="px-6 py-8 max-w-[1400px] mx-auto w-full flex items-center justify-between text-xs text-stone border-t border-[rgba(242,239,232,0.04)]">
          <span className="font-semibold tracking-tight">Onyx</span>
          <span>&copy; 2026</span>
        </footer>
      </main>
    </div>
  );
}
