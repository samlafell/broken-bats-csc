import React, { useState, useEffect } from 'react';
import { CheckCircle2, XCircle, Clock, DollarSign, Trophy, MessageSquare, Send } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { api } from '../lib/api';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface Game {
  id: number;
  opponent: string;
  date: string;
  time: string;
  location: string;
  field_name: string | null;
}

interface Rsvp {
  id: number;
  player_id: number;
  game_id: number;
  status: 'in' | 'out' | 'bench';
  player_name: string;
}

interface Post {
  id: number;
  author_name: string;
  author_role: 'manager' | 'player';
  content: string;
  created_at: string;
}

interface DuesRecord {
  id: number;
  player_id: number;
  player_name: string;
  amount_paid: number;
  amount_total: number;
  season: string;
}

interface Player {
  id: number;
  name: string;
  nickname: string | null;
  batting_avg: string;
}

export default function Clubhouse() {
  const [nextGame, setNextGame] = useState<Game | null>(null);
  const [rsvpStatus, setRsvpStatus] = useState<'in' | 'out' | 'bench' | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [newPostContent, setNewPostContent] = useState('');
  const [dues, setDues] = useState<DuesRecord[]>([]);
  const [leaderboard, setLeaderboard] = useState<Player[]>([]);
  const [rsvps, setRsvps] = useState<Rsvp[]>([]);

  useEffect(() => {
    api<Game | null>('/schedule?next=true').then(setNextGame).catch(console.error);
    api<Post[]>('/posts').then(setPosts).catch(console.error);
    api<DuesRecord[]>('/dues').then(setDues).catch(console.error);
    api<Player[]>('/roster?sort=avg&limit=5').then(setLeaderboard).catch(console.error);
  }, []);

  useEffect(() => {
    if (nextGame) {
      api<Rsvp[]>(`/rsvp?game_id=${nextGame.id}`).then((data) => {
        setRsvps(data);
      }).catch(console.error);
    }
  }, [nextGame]);

  const handleRsvp = async (status: 'in' | 'out' | 'bench') => {
    if (!nextGame) return;
    setRsvpStatus(status);
    try {
      await api('/rsvp', {
        method: 'POST',
        body: JSON.stringify({ player_id: 1, game_id: nextGame.id, status }),
      });
      const updated = await api<Rsvp[]>(`/rsvp?game_id=${nextGame.id}`);
      setRsvps(updated);
    } catch (err) {
      console.error('RSVP failed:', err);
    }
  };

  const handlePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPostContent.trim()) return;
    try {
      await api('/posts', {
        method: 'POST',
        body: JSON.stringify({ author_name: 'You', content: newPostContent }),
      });
      setNewPostContent('');
      const updated = await api<Post[]>('/posts');
      setPosts(updated);
    } catch (err) {
      console.error('Post failed:', err);
    }
  };

  const myDues = dues.length > 0 ? dues[0] : null;
  const totalPaid = dues.reduce((s, d) => s + d.amount_paid, 0);
  const totalDue = dues.reduce((s, d) => s + d.amount_total, 0);

  const formatRelativeTime = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    if (hours < 1) return 'Just now';
    if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
    const days = Math.floor(hours / 24);
    return days === 1 ? 'Yesterday' : `${days} days ago`;
  };

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
            
            {nextGame ? (
              <>
                <div className="flex flex-col md:flex-row items-center justify-between gap-6 bg-stone-950 rounded-xl p-6 border border-stone-800 mb-8">
                  <div>
                    <h3 className="text-xl font-bold mb-1">vs {nextGame.opponent}</h3>
                    <p className="text-stone-400">
                      {new Date(nextGame.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'long', day: 'numeric' })} @ {nextGame.time} &bull; {nextGame.location}
                    </p>
                  </div>
                  
                  <div className="flex items-center gap-3 w-full md:w-auto">
                    <button 
                      onClick={() => handleRsvp('in')}
                      className={cn(
                        "flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-bold uppercase tracking-wider transition-all",
                        rsvpStatus === 'in' ? "bg-emerald-500 text-white" : "bg-stone-800 text-stone-300 hover:bg-stone-700"
                      )}
                    >
                      <CheckCircle2 className="w-5 h-5" /> In
                    </button>
                    <button 
                      onClick={() => handleRsvp('out')}
                      className={cn(
                        "flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-bold uppercase tracking-wider transition-all",
                        rsvpStatus === 'out' ? "bg-red-500 text-white" : "bg-stone-800 text-stone-300 hover:bg-stone-700"
                      )}
                    >
                      <XCircle className="w-5 h-5" /> Out
                    </button>
                    <button 
                      onClick={() => handleRsvp('bench')}
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

                {rsvps.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {rsvps.map((r) => (
                      <span
                        key={r.id}
                        className={cn(
                          "px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider",
                          r.status === 'in' && "bg-emerald-500/10 text-emerald-400",
                          r.status === 'out' && "bg-red-500/10 text-red-400",
                          r.status === 'bench' && "bg-amber-500/10 text-amber-400"
                        )}
                      >
                        {r.player_name}
                      </span>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <p className="text-stone-400">No upcoming games.</p>
            )}
          </section>

          {/* Locker Room Board */}
          <section className="bg-stone-900 border border-stone-800 rounded-2xl p-6 md:p-8">
            <div className="flex items-center gap-3 mb-6">
              <MessageSquare className="w-6 h-6 text-stone-400" />
              <h2 className="text-2xl font-bold uppercase tracking-tight">Locker Room Board</h2>
            </div>
            
            <form onSubmit={handlePost} className="flex gap-3 mb-6">
              <input
                type="text"
                value={newPostContent}
                onChange={(e) => setNewPostContent(e.target.value)}
                placeholder="Post a message to the board..."
                className="flex-1 bg-stone-950 border border-stone-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-stone-600 focus:ring-1 focus:ring-stone-600"
              />
              <button
                type="submit"
                disabled={!newPostContent.trim()}
                className="px-4 py-3 bg-amber-600 hover:bg-amber-500 disabled:bg-stone-700 text-white rounded-xl transition-colors"
              >
                <Send className="w-5 h-5" />
              </button>
            </form>

            <div className="space-y-4">
              {posts.map((post) => (
                <div key={post.id} className={cn(
                  "bg-stone-950 border-l-4 rounded-r-xl p-5",
                  post.author_role === 'manager' ? "border-amber-500" : "border-stone-700"
                )}>
                  <div className="flex items-center justify-between mb-2">
                    <span className={cn(
                      "font-bold uppercase tracking-wider text-sm",
                      post.author_role === 'manager' ? "text-amber-500" : "text-stone-400"
                    )}>
                      {post.author_name}
                    </span>
                    <span className="text-stone-500 text-xs">{formatRelativeTime(post.created_at)}</span>
                  </div>
                  <p className="text-stone-300">{post.content}</p>
                </div>
              ))}
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
              <span className="text-4xl font-black text-white">
                ${myDues ? (myDues.amount_total - myDues.amount_paid).toFixed(2) : '0.00'}
              </span>
              <div className="w-full bg-stone-800 rounded-full h-2 mt-4 mb-2">
                <div
                  className="bg-emerald-500 h-2 rounded-full"
                  style={{ width: totalDue > 0 ? `${(totalPaid / totalDue) * 100}%` : '0%' }}
                />
              </div>
              <div className="flex justify-between text-xs text-stone-500 font-mono">
                <span>Paid: ${totalPaid}</span>
                <span>Total: ${totalDue}</span>
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
              {leaderboard.map((player, i) => (
                <div key={player.id} className="flex items-center justify-between p-3 bg-stone-950 rounded-lg border border-stone-800">
                  <div className="flex items-center gap-3">
                    <span className={cn(
                      "font-black w-4",
                      i === 0 && "text-amber-500",
                      i === 1 && "text-stone-400",
                      i === 2 && "text-amber-700",
                      i > 2 && "text-stone-600"
                    )}>
                      {i + 1}
                    </span>
                    <span className="font-bold">{player.name}</span>
                  </div>
                  <span className="font-mono text-stone-400">{player.batting_avg} AVG</span>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
