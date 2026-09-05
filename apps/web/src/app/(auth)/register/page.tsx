"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: name }
      }
    });

    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
    } else {
      router.push("/dashboard");
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col md:flex-row bg-background text-on-surface">
      {/* Left — form */}
      <div className="flex-1 flex flex-col justify-center px-6 sm:px-12 lg:px-20 py-12 relative overflow-hidden order-2 md:order-1">
        {/* mobile turf wash */}
        <div className="absolute inset-0 z-0 md:hidden">
          <img alt="" aria-hidden="true" src="/turf/aerial-field.jpg" className="w-full h-full object-cover  opacity-[0.12] " />
          <div className="absolute inset-0 bg-gradient-to-b from-background/60 via-background to-background z-10" />
        </div>

        <div className="relative z-20 w-full max-w-sm mx-auto">
          <Link href="/" className="flex md:hidden items-center gap-3 mb-10">
            <div className="w-9 h-9 bg-primary-container text-surface flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>sports_soccer</span>
            </div>
            <span className="font-display-lg text-2xl uppercase tracking-tighter text-on-surface">LocoFoot</span>
          </Link>

          <span className="font-label-caps text-label-caps text-on-surface-variant uppercase tracking-widest">Get Started</span>
          <h1 className="font-display-lg text-headline-lg mt-2 mb-10 uppercase tracking-tighter text-on-surface leading-none">Create Account</h1>

          <form onSubmit={handleRegister} className="flex flex-col gap-6">
            <div className="space-y-2">
              <label className="font-label-caps text-label-caps uppercase tracking-widest text-on-surface-variant">Full Name</label>
              <input
                type="text"
                placeholder="Your name"
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full p-4 bg-surface-container border border-outline-variant focus:outline-none focus:border-primary-container font-body-md text-on-surface transition-colors"
                required
              />
            </div>
            <div className="space-y-2">
              <label className="font-label-caps text-label-caps uppercase tracking-widest text-on-surface-variant">Email</label>
              <input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full p-4 bg-surface-container border border-outline-variant focus:outline-none focus:border-primary-container font-body-md text-on-surface transition-colors"
                required
              />
            </div>
            <div className="space-y-2">
              <label className="font-label-caps text-label-caps uppercase tracking-widest text-on-surface-variant">Password</label>
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full p-4 bg-surface-container border border-outline-variant focus:outline-none focus:border-primary-container font-body-md text-on-surface transition-colors"
                required
              />
            </div>

            {error && (
              <div className="border border-error bg-error/10 text-error px-4 py-3 font-body-md text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary-container text-on-primary-container py-4 font-label-caps text-label-caps uppercase tracking-widest hover:bg-primary-fixed transition-colors disabled:opacity-50 mt-2"
            >
              {loading ? "Creating…" : "Create Account"}
            </button>
          </form>

          <p className="font-body-md text-on-surface-variant mt-8 text-center md:text-left">
            Already have an account?{" "}
            <Link href="/login" className="text-primary-container uppercase tracking-widest text-sm font-label-caps hover:underline">Sign In</Link>
          </p>
        </div>
      </div>

      {/* Right — turf showcase (desktop) */}
      <div className="relative hidden md:flex md:w-1/2 lg:w-3/5 overflow-hidden border-l border-outline-variant order-1 md:order-2">
        <img
          alt=""
          aria-hidden="true"
          src="/turf/aerial-goal.jpg"
          className="absolute inset-0 w-full h-full object-cover object-center  opacity-60 "
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/55 to-background/25 z-10" />
        <div className="absolute inset-0 bg-gradient-to-l from-transparent to-background/80 z-10" />

        <div className="relative z-20 flex flex-col justify-between items-end text-right p-10 lg:p-16 w-full">
          <Link href="/" className="flex items-center gap-3 w-fit group">
            <span className="font-display-lg text-2xl uppercase tracking-tighter text-on-surface">LocoFoot</span>
            <div className="w-9 h-9 bg-primary-container text-surface flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>sports_soccer</span>
            </div>
          </Link>

          <div>
            <span className="flex items-center justify-end gap-2 mb-4 font-label-caps text-label-caps text-primary-container uppercase tracking-widest">
              Join the League
              <span className="w-2 h-2 rounded-full bg-primary-container animate-pulse shadow-[0_0_8px_rgba(57,255,106,0.8)]" />
            </span>
            <h2 className="font-display-lg text-display-lg uppercase tracking-tighter leading-none text-on-surface max-w-xl">
              Your Pitch. Your <span className="text-primary-container">Legacy</span>.
            </h2>
            <p className="font-body-lg text-on-surface-variant mt-5 max-w-md ml-auto">
              Build your player profile, track every goal, and compete in tournaments that matter.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
