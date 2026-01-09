export default function Checkin() {
  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-xl p-4 text-center border border-slate-100">
          <p className="text-2xl font-bold text-emerald-500">365</p>
          <p className="text-slate-500 text-xs">总打卡天数</p>
        </div>
        <div className="bg-white rounded-xl p-4 text-center border border-slate-100">
          <p className="text-2xl font-bold text-indigo-500">28</p>
          <p className="text-slate-500 text-xs">连续打卡</p>
        </div>
        <div className="bg-white rounded-xl p-4 text-center border border-slate-100">
          <p className="text-2xl font-bold text-amber-500">42</p>
          <p className="text-slate-500 text-xs">记录条数</p>
        </div>
      </div>

      {/* Placeholder */}
      <div className="bg-white rounded-xl p-12 text-center border border-slate-100">
        <p className="text-slate-400 text-lg">📅 日历视图开发中...</p>
      </div>
    </div>
  );
}
