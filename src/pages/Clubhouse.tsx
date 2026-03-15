import { useState } from 'react';
import { CheckCircle2, XCircle, Clock, DollarSign, Trophy, MessageSquare } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function Clubhouse() {
  const [rsvpStatus, setRsvpStatus] = useState<'in' | 'out' | 'bench' | null>(null);

  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      <header className="mb-12">
        <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tight mb-2">The Clubhouse</h1>
        <p className="text-stone-400 text-lg">Leave the 9-to-5 behind. Step into the box.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: RSVP & Board */}
        <div className="lg:col-span-2 space-y-8">
          {/* Next Game RSVP */}
          <section className="bg-stone-900 border border-stone-800 rounded-2xl p-6 md:p-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold uppercase tracking-tight">Next Game RSVP</h2>
              <span className="px-3 py-1 bg-amber-500/10 text-amber-500 rounded-full text-xs font-bold uppercase tracking-wider">
                Action Required
              </span>
            </div>
            
            <div className="flex flex-col md:flex-row items-center justify-between gap-6 bg-stone-950 rounded-xl p-6 border border-stone-800 mb-8">
              <div>
                <h3 className="text-xl font-bold mb-1">vs Yankees</h3>
                <p className="text-stone-400">Sat, April 12 @ 10:00 AM • Centennial Park</p>
              </div>
              
              <div className="flex items-center gap-3 w-full md:w-auto">
                <button 
                  onClick={() => setRsvpStatus('in')}
                  className={cn(
                    "flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-bold uppercase tracking-wider transition-all",
                    rsvpStatus === 'in' ? "bg-emerald-500 text-white" : "bg-stone-800 text-stone-300 hover:bg-stone-700"
                  )}
                >
                  <CheckCircle2 className="w-5 h-5" /> In
                </button>
                <button 
                  onClick={() => setRsvpStatus('out')}
                  className={cn(
                    "flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-bold uppercase tracking-wider transition-all",
                    rsvpStatus === 'out' ? "bg-red-500 text-white" : "bg-stone-800 text-stone-300 hover:bg-stone-700"
                  )}
                >
                  <XCircle className="w-5 h-5" /> Out
                </button>
                <button 
                  onClick={() => setRsvpStatus('bench')}
                  className={cn(
                    "flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-bold uppercase tracking-wider transition-all",
                    rsvpStatus === 'bench' ? "bg-amber-500 text-white" : "bg-stone-800 text-stone-300 hover:bg-stone-700"
                  )}
                  title="Available, but prefer to bench/coach"
                >
                  <Clock className="w-5 h-5" /> Bench
                </button>
              </div>
            </div>
          </section>

          {/* Locker Room Board */}
          <section className="bg-stone-900 border border-stone-800 rounded-2xl p-6 md:p-8">
            <div className="flex items-center gap-3 mb-6">
              <MessageSquare className="w-6 h-6 text-stone-400" />
              <h2 className="text-2xl font-bold uppercase tracking-tight">Locker Room Board</h2>
            </div>
            
            <div className="space-y-4">
              <div className="bg-stone-950 border-l-4 border-amber-500 rounded-r-xl p-5">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-amber-500 uppercase tracking-wider text-sm">Manager Skip</span>
                  <span className="text-stone-500 text-xs">2 hours ago</span>
                </div>
                <p className="text-stone-300">No metal cleats on Field 4 this week. Parks Dept is getting strict. Bring your turfs or molded.</p>
              </div>
              
              <div className="bg-stone-950 border-l-4 border-stone-700 rounded-r-xl p-5">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-stone-400 uppercase tracking-wider text-sm">Dave "The Wall" Smith</span>
                  <span className="text-stone-500 text-xs">Yesterday</span>
                </div>
                <p className="text-stone-300">Who's bringing the post-game cooler this week? I got it last time.</p>
              </div>
            </div>
          </section>
        </div>

        {/* Right Column: Finances & Stats */}
        <div className="space-y-8">
          {/* Front Office (Finances) */}
          <section className="bg-stone-900 border border-stone-800 rounded-2xl p-6 md:p-8">
            <div className="flex items-center gap-3 mb-6">
              <DollarSign className="w-6 h-6 text-emerald-500" />
              <h2 className="text-2xl font-bold uppercase tracking-tight">Front Office</h2>
            </div>
            
            <div className="bg-stone-950 rounded-xl p-6 border border-stone-800 mb-6 text-center">
              <span className="text-stone-400 text-sm uppercase tracking-wider block mb-2">Outstanding Dues</span>
              <span className="text-4xl font-black text-white">$150.00</span>
              <div className="w-full bg-stone-800 rounded-full h-2 mt-4 mb-2">
                <div className="bg-emerald-500 h-2 rounded-full" style={{ width: '50%' }}></div>
              </div>
              <div className="flex justify-between text-xs text-stone-500 font-mono">
                <span>Paid: $150</span>
                <span>Total: $300</span>
              </div>
            </div>
            
            <button className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl uppercase tracking-widest transition-colors flex items-center justify-center gap-2">
              <DollarSign className="w-5 h-5" /> Pay Now
            </button>
          </section>

          {/* Team Stats Leaderboard */}
          <section className="bg-stone-900 border border-stone-800 rounded-2xl p-6 md:p-8">
            <div className="flex items-center gap-3 mb-6">
              <Trophy className="w-6 h-6 text-amber-500" />
              <h2 className="text-2xl font-bold uppercase tracking-tight">Leaderboard</h2>
            </div>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-stone-950 rounded-lg border border-stone-800">
                <div className="flex items-center gap-3">
                  <span className="text-amber-500 font-black w-4">1</span>
                  <span className="font-bold">Jimmy Carter</span>
                </div>
                <span className="font-mono text-stone-400">.342 AVG</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-stone-950 rounded-lg border border-stone-800">
                <div className="flex items-center gap-3">
                  <span className="text-stone-400 font-black w-4">2</span>
                  <span className="font-bold">Mike Johnson</span>
                </div>
                <span className="font-mono text-stone-400">.310 AVG</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-stone-950 rounded-lg border border-stone-800">
                <div className="flex items-center gap-3">
                  <span className="text-amber-700 font-black w-4">3</span>
                  <span className="font-bold">Tom Davis</span>
                </div>
                <span className="font-mono text-stone-400">.295 AVG</span>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
