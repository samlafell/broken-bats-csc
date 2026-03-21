import React, { useState, useEffect, useMemo } from 'react';
import { Users, Calendar, Map as MapIcon, MapPin, Bell, Search, Plus, Clock, X, Save, Trash2, Filter, ChevronDown } from 'lucide-react';
import { api } from '../lib/api';

interface Player {
  id: number;
  name: string;
  nickname: string | null;
  position: string;
  batting_avg: string;
  fun_stat: string | null;
  image_url: string | null;
  status: string;
}

interface DuesRecord {
  id: number;
  player_id: number;
  player_name: string;
  amount_paid: number;
  amount_total: number;
  season: string;
}

interface Field {
  id: number;
  name: string;
  date: string;
  time_slot: string;
  status: string;
  last_updated: string;
}

interface Game {
  id: number;
  opponent: string;
  date: string;
  time: string;
  location: string;
  field_name: string | null;
  result: string | null;
  score_us: number | null;
  score_them: number | null;
}

interface FieldLocation {
  field_name: string;
  map_url: string;
}

const TIME_OPTIONS = Array.from({ length: 33 }, (_, i) => {
  const totalMin = 6 * 60 + i * 30;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  const h24 = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  const suffix = h >= 12 ? 'PM' : 'AM';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  const label = `${h12}:${String(m).padStart(2, '0')} ${suffix}`;
  return { value: h24, label };
});

function parseTimeSlot(slot: string): [string, string] {
  const parse12 = (s: string): string => {
    const match = s.trim().match(/^(\d{1,2}):(\d{2})\s*(am|pm)$/i);
    if (!match) return '00:00';
    let h = parseInt(match[1], 10);
    const m = match[2];
    const period = match[3].toLowerCase();
    if (period === 'pm' && h !== 12) h += 12;
    if (period === 'am' && h === 12) h = 0;
    return `${String(h).padStart(2, '0')}:${m}`;
  };
  const parts = slot.split('-');
  return [parse12(parts[0]), parse12(parts[1] ?? parts[0])];
}

function shortTimeLabel(slot: string): string {
  const fmt = (s: string) => {
    const m = s.trim().match(/^(\d{1,2}):(\d{2})\s*(am|pm)$/i);
    if (!m) return s.trim();
    return `${m[1]}:${m[2]}`;
  };
  const parts = slot.split('-');
  if (parts.length < 2) return fmt(parts[0]);
  return `${fmt(parts[0])}-${fmt(parts[1])}`;
}

export default function Admin() {
  const [activeTab, setActiveTab] = useState<'roster' | 'fields' | 'schedule'>('roster');
  const [rosterData, setRosterData] = useState<Player[]>([]);
  const [duesData, setDuesData] = useState<DuesRecord[]>([]);
  const [fieldData, setFieldData] = useState<Field[]>([]);
  const [scheduleData, setScheduleData] = useState<Game[]>([]);
  const [fieldLocations, setFieldLocations] = useState<FieldLocation[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [fieldFilter, setFieldFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState('');
  const [timeStart, setTimeStart] = useState('');
  const [timeEnd, setTimeEnd] = useState('');
  const [showNewGameForm, setShowNewGameForm] = useState(false);
  const [newGame, setNewGame] = useState({ opponent: '', date: '', time: '', location: '', field_name: '' });
  const [selectedTime24, setSelectedTime24] = useState('');
  const [customFieldName, setCustomFieldName] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = () => {
    api<Player[]>('/roster').then(setRosterData).catch(console.error);
    api<DuesRecord[]>('/dues').then(setDuesData).catch(console.error);
    api<Field[]>('/fields').then(setFieldData).catch(console.error);
    api<FieldLocation[]>('/fields/locations').then(setFieldLocations).catch(console.error);
    api<Game[]>('/schedule').then(setScheduleData).catch(console.error);
  };

  const getDuesForPlayer = (playerId: number) =>
    duesData.find((d) => d.player_id === playerId);

  const handleRemind = async (player: Player) => {
    alert(`Reminder sent to ${player.name}!`);
  };

  const handleCreateGame = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api('/schedule', {
        method: 'POST',
        body: JSON.stringify(newGame),
      });
      setNewGame({ opponent: '', date: '', time: '', location: '', field_name: '' });
      setSelectedTime24('');
      setCustomFieldName(false);
      setShowNewGameForm(false);
      loadData();
    } catch (err) {
      console.error('Create game failed:', err);
    }
  };

  const handleDeleteGame = async (id: number) => {
    if (!confirm('Delete this game?')) return;
    try {
      await api(`/schedule/${id}`, { method: 'DELETE' });
      loadData();
    } catch (err) {
      console.error('Delete failed:', err);
    }
  };

  const filteredRoster = rosterData.filter((p) =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const currentFieldData = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return fieldData.filter((f) => f.date >= today);
  }, [fieldData]);

  const uniqueFieldNames = useMemo(
    () => [...new Set(currentFieldData.map((f) => f.name))].sort(),
    [currentFieldData]
  );

  const filteredFields = useMemo(() => {
    let data = currentFieldData;
    if (fieldFilter !== 'all') data = data.filter((f) => f.name === fieldFilter);
    if (dateFilter) data = data.filter((f) => f.date === dateFilter);
    if (timeStart || timeEnd) {
      data = data.filter((f) => {
        const [slotStart, slotEnd] = parseTimeSlot(f.time_slot);
        if (timeStart && slotEnd <= timeStart) return false;
        if (timeEnd && slotStart >= timeEnd) return false;
        return true;
      });
    }
    return data;
  }, [currentFieldData, fieldFilter, dateFilter, timeStart, timeEnd]);

  const fieldsByDate = useMemo(() => {
    const grouped = new Map<string, Field[]>();
    for (const field of filteredFields) {
      const existing = grouped.get(field.date) ?? [];
      existing.push(field);
      grouped.set(field.date, existing);
    }
    return [...grouped.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [filteredFields]);

  const lastScraped = useMemo(() => {
    if (fieldData.length === 0) return null;
    return fieldData.reduce((latest, f) =>
      f.last_updated > latest ? f.last_updated : latest,
      fieldData[0].last_updated
    );
  }, [fieldData]);

  const dateTimeFilteredFields = useMemo(() => {
    let data = currentFieldData;
    if (dateFilter) data = data.filter((f) => f.date === dateFilter);
    if (timeStart || timeEnd) {
      data = data.filter((f) => {
        const [slotStart, slotEnd] = parseTimeSlot(f.time_slot);
        if (timeStart && slotEnd <= timeStart) return false;
        if (timeEnd && slotStart >= timeEnd) return false;
        return true;
      });
    }
    return data;
  }, [currentFieldData, dateFilter, timeStart, timeEnd]);

  const availabilitySummary = useMemo(() => {
    const summary = new Map<string, { available: number; total: number }>();
    for (const f of dateTimeFilteredFields) {
      const entry = summary.get(f.name) ?? { available: 0, total: 0 };
      entry.total++;
      if (f.status === 'Available') entry.available++;
      summary.set(f.name, entry);
    }
    return summary;
  }, [dateTimeFilteredFields]);

  const fieldLocationMap = useMemo(
    () => new Map(fieldLocations.map((l) => [l.field_name, l.map_url])),
    [fieldLocations]
  );

  const availableGameFields = useMemo(() => {
    if (!newGame.date || !selectedTime24) return [];

    const [sh, sm] = selectedTime24.split(':').map(Number);
    const endMin = sh * 60 + sm + 240;
    const cappedMin = Math.min(endMin, 23 * 60 + 59);
    const endTime = `${String(Math.floor(cappedMin / 60)).padStart(2, '0')}:${String(cappedMin % 60).padStart(2, '0')}`;

    const daySlots = fieldData.filter(f => f.date === newGame.date);
    const grouped = new Map<string, Field[]>();

    for (const f of daySlots) {
      const [slotStart, slotEnd] = parseTimeSlot(f.time_slot);
      if (slotStart === '00:00' && slotEnd === '00:00') continue;
      if (slotStart < endTime && slotEnd > selectedTime24) {
        const arr = grouped.get(f.name) ?? [];
        arr.push(f);
        grouped.set(f.name, arr);
      }
    }

    return [...grouped.entries()]
      .filter(([, slots]) => slots.every(s => s.status === 'Available'))
      .map(([name]) => name)
      .sort();
  }, [fieldData, newGame.date, selectedTime24]);

  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      <header className="mb-8">
        <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tight mb-2">Manager's Office</h1>
        <p className="text-stone-400 text-lg">Automation, reducing the headache of herding adult men.</p>
      </header>

      {/* Admin Navigation */}
      <div className="flex overflow-x-auto pb-4 mb-8 gap-2 border-b border-stone-800">
        <button 
          onClick={() => setActiveTab('roster')}
          className={`flex items-center gap-2 px-6 py-3 rounded-t-xl font-bold uppercase tracking-wider transition-colors whitespace-nowrap ${
            activeTab === 'roster' ? 'bg-stone-800 text-white border-b-2 border-amber-500' : 'text-stone-400 hover:bg-stone-900 hover:text-stone-200'
          }`}
        >
          <Users className="w-5 h-5" /> Roster & Dues
        </button>
        <button 
          onClick={() => setActiveTab('fields')}
          className={`flex items-center gap-2 px-6 py-3 rounded-t-xl font-bold uppercase tracking-wider transition-colors whitespace-nowrap ${
            activeTab === 'fields' ? 'bg-stone-800 text-white border-b-2 border-amber-500' : 'text-stone-400 hover:bg-stone-900 hover:text-stone-200'
          }`}
        >
          <MapIcon className="w-5 h-5" /> Field Scout
        </button>
        <button 
          onClick={() => setActiveTab('schedule')}
          className={`flex items-center gap-2 px-6 py-3 rounded-t-xl font-bold uppercase tracking-wider transition-colors whitespace-nowrap ${
            activeTab === 'schedule' ? 'bg-stone-800 text-white border-b-2 border-amber-500' : 'text-stone-400 hover:bg-stone-900 hover:text-stone-200'
          }`}
        >
          <Calendar className="w-5 h-5" /> Schedule Builder
        </button>
      </div>

      {/* Tab Content */}
      <div className="bg-stone-900 border border-stone-800 rounded-2xl p-6 md:p-8">
        
        {activeTab === 'roster' && (
          <div>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
              <h2 className="text-2xl font-bold uppercase tracking-tight">Roster Management</h2>
              <div className="flex items-center gap-3 w-full sm:w-auto">
                <div className="relative flex-1 sm:w-64">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-500" />
                  <input 
                    type="text" 
                    placeholder="Search players..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-stone-950 border border-stone-800 rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none focus:border-stone-600 focus:ring-1 focus:ring-stone-600"
                  />
                </div>
                <button className="p-2 bg-stone-800 hover:bg-stone-700 rounded-lg transition-colors">
                  <Plus className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-stone-800 text-stone-400 text-xs uppercase tracking-wider">
                    <th className="p-4 font-medium">Player</th>
                    <th className="p-4 font-medium">Status</th>
                    <th className="p-4 font-medium">Dues Paid</th>
                    <th className="p-4 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-800/50">
                  {filteredRoster.map((player) => {
                    const playerDues = getDuesForPlayer(player.id);
                    const paid = playerDues?.amount_paid ?? 0;
                    const total = playerDues?.amount_total ?? 300;
                    return (
                      <tr key={player.id} className="hover:bg-stone-800/30 transition-colors">
                        <td className="p-4 font-bold">{player.name}</td>
                        <td className="p-4">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            player.status === 'Active' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'
                          }`}>
                            {player.status}
                          </span>
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            <div className="w-24 bg-stone-800 rounded-full h-2">
                              <div 
                                className={`h-2 rounded-full ${paid === total ? 'bg-emerald-500' : paid > 0 ? 'bg-amber-500' : 'bg-red-500'}`} 
                                style={{ width: `${total > 0 ? (paid / total) * 100 : 0}%` }}
                              />
                            </div>
                            <span className="text-sm font-mono text-stone-400">${paid}/${total}</span>
                          </div>
                        </td>
                        <td className="p-4 text-right">
                          {paid < total && (
                            <button
                              onClick={() => handleRemind(player)}
                              className="inline-flex items-center gap-1 px-3 py-1.5 bg-stone-800 hover:bg-stone-700 text-stone-300 rounded-md text-xs font-bold uppercase tracking-wider transition-colors"
                            >
                              <Bell className="w-3 h-3" /> Remind
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'fields' && (
          <div>
            <div className="flex flex-col gap-4 mb-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-bold uppercase tracking-tight mb-1">Field Scout</h2>
                  <p className="text-sm text-stone-400">Automated scraper results from Raleigh Parks & Rec.</p>
                </div>
                <span className="text-xs font-mono text-stone-500 bg-stone-950 px-3 py-1.5 rounded-full border border-stone-800 whitespace-nowrap">
                  {lastScraped
                    ? `Scraped: ${new Date(lastScraped + 'Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'America/New_York' })} ${new Date(lastScraped + 'Z').toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' })}`
                    : 'No data yet'}
                </span>
              </div>

              <div className="flex flex-wrap items-end gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-mono uppercase tracking-wider text-stone-500">Field</label>
                  <div className="relative">
                    <Filter className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-stone-500" />
                    <select
                      value={fieldFilter}
                      onChange={(e) => setFieldFilter(e.target.value)}
                      className="appearance-none bg-stone-950 border border-stone-800 rounded-lg pl-9 pr-8 py-1.5 text-xs font-mono focus:outline-none focus:border-stone-600"
                    >
                      <option value="all">All Fields</option>
                      {uniqueFieldNames.map((name) => (
                        <option key={name} value={name}>{name}</option>
                      ))}
                    </select>
                    <ChevronDown className="w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-500 pointer-events-none" />
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-mono uppercase tracking-wider text-stone-500">Date</label>
                  <input
                    type="date"
                    value={dateFilter}
                    onChange={(e) => setDateFilter(e.target.value)}
                    className="bg-stone-950 border border-stone-800 rounded-lg px-3 py-1.5 text-xs font-mono focus:outline-none focus:border-stone-600"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-mono uppercase tracking-wider text-stone-500">From</label>
                  <div className="relative">
                    <select
                      value={timeStart}
                      onChange={(e) => setTimeStart(e.target.value)}
                      className="appearance-none bg-stone-950 border border-stone-800 rounded-lg pl-3 pr-7 py-1.5 text-xs font-mono focus:outline-none focus:border-stone-600"
                    >
                      <option value="">Any</option>
                      {TIME_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                    <ChevronDown className="w-3.5 h-3.5 absolute right-2 top-1/2 -translate-y-1/2 text-stone-500 pointer-events-none" />
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-mono uppercase tracking-wider text-stone-500">To</label>
                  <div className="relative">
                    <select
                      value={timeEnd}
                      onChange={(e) => setTimeEnd(e.target.value)}
                      className="appearance-none bg-stone-950 border border-stone-800 rounded-lg pl-3 pr-7 py-1.5 text-xs font-mono focus:outline-none focus:border-stone-600"
                    >
                      <option value="">Any</option>
                      {TIME_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                    <ChevronDown className="w-3.5 h-3.5 absolute right-2 top-1/2 -translate-y-1/2 text-stone-500 pointer-events-none" />
                  </div>
                </div>

                {(fieldFilter !== 'all' || dateFilter || timeStart || timeEnd) && (
                  <button
                    onClick={() => { setFieldFilter('all'); setDateFilter(''); setTimeStart(''); setTimeEnd(''); }}
                    className="flex items-center gap-1 px-3 py-1.5 bg-stone-800 hover:bg-stone-700 text-stone-300 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors"
                  >
                    <X className="w-3 h-3" /> Clear
                  </button>
                )}
              </div>
            </div>

            {uniqueFieldNames.length > 0 && fieldFilter === 'all' && (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-8">
                {uniqueFieldNames.map((name) => {
                  const stats = availabilitySummary.get(name);
                  const pct = stats && stats.total > 0 ? Math.round((stats.available / stats.total) * 100) : 0;
                  return (
                    <button
                      key={name}
                      onClick={() => setFieldFilter(name)}
                      className="bg-stone-950 border border-stone-800 rounded-lg p-3 text-left hover:border-stone-600 transition-colors"
                    >
                      <p className="font-bold text-sm truncate">{name}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <div className="flex-1 bg-stone-800 rounded-full h-1.5">
                          <div
                            className={`h-1.5 rounded-full ${pct > 50 ? 'bg-emerald-500' : pct > 0 ? 'bg-amber-500' : 'bg-red-500'}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-xs font-mono text-stone-400">{pct}%</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {fieldsByDate.length === 0 && (
              <div className="text-center py-12">
                <MapIcon className="w-16 h-16 text-stone-700 mx-auto mb-4" />
                <p className="text-stone-400">No field data yet. The bot scrapes daily at 6 AM ET.</p>
              </div>
            )}

            {fieldsByDate.map(([date, fields]) => {
              const fieldNames = [...new Set(fields.map(f => f.name))].sort();
              const timeSlots = [...new Set(fields.map(f => f.time_slot))];
              timeSlots.sort((a, b) => {
                const [aStart] = parseTimeSlot(a);
                const [bStart] = parseTimeSlot(b);
                return aStart.localeCompare(bStart);
              });
              const lookup = new Map<string, Map<string, Field>>();
              for (const f of fields) {
                if (!lookup.has(f.name)) lookup.set(f.name, new Map());
                lookup.get(f.name)!.set(f.time_slot, f);
              }

              return (
                <div key={date} className="mb-8 last:mb-0">
                  <div className="flex items-center gap-3 mb-4">
                    <Calendar className="w-4 h-4 text-stone-500" />
                    <h3 className="text-lg font-bold">
                      {new Date(date + 'T12:00:00').toLocaleDateString('en-US', {
                        weekday: 'long',
                        month: 'long',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </h3>
                    <span className="text-xs font-mono text-stone-500">
                      {fields.filter((f) => f.status === 'Available').length}/{fields.length} slots open
                    </span>
                  </div>

                  <div className="overflow-x-auto rounded-xl border border-stone-800">
                    <table className="w-full border-collapse min-w-[500px]">
                      <thead>
                        <tr className="bg-stone-950">
                          <th className="sticky left-0 z-10 bg-stone-950 text-left text-[11px] font-mono uppercase tracking-wider text-stone-500 px-4 py-3 border-b border-stone-800">
                            Field
                          </th>
                          {timeSlots.map(slot => (
                            <th key={slot} className="text-center text-[11px] font-mono uppercase tracking-wider text-stone-500 px-2 py-3 border-b border-stone-800 whitespace-nowrap">
                              {shortTimeLabel(slot)}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {fieldNames.map((name, ri) => (
                          <tr key={name} className={ri % 2 === 0 ? 'bg-stone-900/40' : ''}>
                            <td className="sticky left-0 z-10 bg-stone-900 px-4 py-2.5 border-b border-stone-800/50 whitespace-nowrap">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-sm">{name}</span>
                                {fieldLocationMap.get(name) && (
                                  <a
                                    href={fieldLocationMap.get(name)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-stone-500 hover:text-amber-500 transition-colors"
                                    title="View Map"
                                  >
                                    <MapPin className="w-3.5 h-3.5" />
                                  </a>
                                )}
                              </div>
                            </td>
                            {timeSlots.map(slot => {
                              const field = lookup.get(name)?.get(slot);
                              const available = field?.status === 'Available';
                              return (
                                <td
                                  key={slot}
                                  className="border-b border-stone-800/50 p-1"
                                  title={`${name} — ${slot}: ${field?.status ?? 'No data'}`}
                                >
                                  <div className={`h-8 rounded-md ${
                                    !field ? 'bg-stone-800/50' : available ? 'bg-emerald-500' : 'bg-red-500'
                                  }`} />
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex items-center gap-4 mt-3 text-[11px] text-stone-500 font-mono">
                    <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded bg-emerald-500" /> Available</span>
                    <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded bg-red-500" /> Booked</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {activeTab === 'schedule' && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold uppercase tracking-tight">Schedule Builder</h2>
              <button
                onClick={() => setShowNewGameForm(!showNewGameForm)}
                className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-xl uppercase tracking-wider transition-colors"
              >
                {showNewGameForm ? <X className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
                {showNewGameForm ? 'Cancel' : 'New Game'}
              </button>
            </div>

            {showNewGameForm && (
              <form onSubmit={handleCreateGame} className="bg-stone-950 border border-stone-800 rounded-xl p-6 mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                <input
                  type="text"
                  placeholder="Opponent"
                  value={newGame.opponent}
                  onChange={(e) => setNewGame({ ...newGame, opponent: e.target.value })}
                  required
                  className="bg-stone-900 border border-stone-800 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-stone-600"
                />
                <input
                  type="date"
                  value={newGame.date}
                  onChange={(e) => {
                    setNewGame({ ...newGame, date: e.target.value, field_name: '', location: '' });
                    setCustomFieldName(false);
                  }}
                  required
                  className="bg-stone-900 border border-stone-800 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-stone-600"
                />
                <div className="relative">
                  <select
                    value={selectedTime24}
                    onChange={(e) => {
                      const opt = TIME_OPTIONS.find(o => o.value === e.target.value);
                      setSelectedTime24(e.target.value);
                      setNewGame({ ...newGame, time: opt?.label ?? '', field_name: '', location: '' });
                      setCustomFieldName(false);
                    }}
                    required
                    className="w-full appearance-none bg-stone-900 border border-stone-800 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-stone-600"
                  >
                    <option value="" disabled>Select time...</option>
                    {TIME_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                  <ChevronDown className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-stone-500 pointer-events-none" />
                </div>
                <div className="relative">
                  <select
                    value={customFieldName ? '__other__' : newGame.field_name}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === '__other__') {
                        setCustomFieldName(true);
                        setNewGame({ ...newGame, field_name: '', location: '' });
                      } else {
                        setCustomFieldName(false);
                        setNewGame({ ...newGame, field_name: val, location: val });
                      }
                    }}
                    disabled={!newGame.date || !selectedTime24}
                    className="w-full appearance-none bg-stone-900 border border-stone-800 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-stone-600 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <option value="" disabled>
                      {!newGame.date || !selectedTime24
                        ? 'Pick date & time first'
                        : availableGameFields.length === 0
                          ? 'No fields available — use Other'
                          : 'Select a field...'}
                    </option>
                    {availableGameFields.map((name) => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                    <option value="__other__">Other...</option>
                  </select>
                  <ChevronDown className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-stone-500 pointer-events-none" />
                </div>
                {customFieldName && (
                  <input
                    type="text"
                    placeholder="Enter field name"
                    value={newGame.field_name}
                    onChange={(e) => setNewGame({ ...newGame, field_name: e.target.value })}
                    className="bg-stone-900 border border-stone-800 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-stone-600"
                  />
                )}
                <input
                  type="text"
                  placeholder="Location"
                  value={newGame.location}
                  onChange={(e) => setNewGame({ ...newGame, location: e.target.value })}
                  required
                  className="bg-stone-900 border border-stone-800 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-stone-600"
                />
                <button
                  type="submit"
                  className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg py-2 uppercase tracking-wider transition-colors"
                >
                  <Save className="w-5 h-5" /> Save Game
                </button>
              </form>
            )}

            <div className="space-y-4">
              {scheduleData.map((game) => (
                <div key={game.id} className="bg-stone-950 border border-stone-800 rounded-xl p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className="font-bold text-lg">vs {game.opponent}</h3>
                      {game.result && (
                        <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                          game.result === 'W' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'
                        }`}>
                          {game.result} {game.score_us}-{game.score_them}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-stone-400">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" /> {game.date}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-4 h-4" /> {game.time}
                      </span>
                      <span>{game.location}{game.field_name ? `, ${game.field_name}` : ''}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDeleteGame(game.id)}
                    className="flex items-center gap-1 px-3 py-1.5 bg-stone-800 hover:bg-red-600 text-stone-400 hover:text-white rounded-md text-xs font-bold uppercase tracking-wider transition-colors"
                  >
                    <Trash2 className="w-3 h-3" /> Delete
                  </button>
                </div>
              ))}
              {scheduleData.length === 0 && (
                <div className="text-center py-12">
                  <Calendar className="w-16 h-16 text-stone-700 mx-auto mb-4" />
                  <p className="text-stone-400">No games scheduled yet. Click "New Game" to get started.</p>
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
