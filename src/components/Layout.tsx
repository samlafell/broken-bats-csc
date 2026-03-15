import { Outlet } from 'react-router-dom';
import Ticker from './Ticker';
import Navbar from './Navbar';

export default function Layout() {
  return (
    <div className="min-h-screen bg-stone-950 text-stone-50 font-sans selection:bg-amber-500/30">
      <Ticker />
      <Navbar />
      <main>
        <Outlet />
      </main>
    </div>
  );
}
