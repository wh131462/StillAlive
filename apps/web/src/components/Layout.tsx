import { Outlet, NavLink } from 'react-router-dom';

const navItems = [
  { path: '/', label: '主页', icon: '🏠' },
  { path: '/checkin', label: '打卡', icon: '📅' },
  { path: '/people', label: '人物', icon: '👥' },
  { path: '/profile', label: '我的', icon: '👤' },
];

export default function Layout() {
  return (
    <div className="min-h-screen max-w-md mx-auto bg-slate-50 flex flex-col">
      {/* Header */}
      <header className="bg-white px-4 py-3 flex justify-between items-center shadow-sm sticky top-0 z-10">
        <h1 className="text-xl font-bold text-slate-800">今天又活了一天</h1>
        <div className="flex space-x-4">
          <button className="text-slate-600 relative">
            🔔
            <span className="absolute -top-1 -right-1 w-2 h-2 bg-rose-500 rounded-full"></span>
          </button>
          <button className="text-slate-600">⚙️</button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow overflow-y-auto pb-20 p-4">
        <Outlet />
      </main>

      {/* Navigation Bar */}
      <nav className="bg-white border-t border-slate-100 px-6 py-2 flex justify-around items-center fixed bottom-0 left-0 right-0 max-w-md mx-auto">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `flex flex-col items-center py-1 px-3 ${
                isActive ? 'text-slate-900' : 'text-slate-400'
              }`
            }
          >
            <span className="text-xl">{item.icon}</span>
            <span className="text-[10px] mt-1">{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
