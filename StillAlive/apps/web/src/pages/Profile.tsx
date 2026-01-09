export default function Profile() {
  return (
    <div className="space-y-6">
      {/* Profile Card */}
      <div className="bg-white rounded-2xl p-6 shadow-sm text-center border border-slate-100">
        <div className="w-20 h-20 bg-slate-100 rounded-full mx-auto mb-3 flex items-center justify-center text-4xl">
          😊
        </div>
        <h2 className="font-bold text-slate-800 text-lg">用户昵称</h2>
        <p className="text-slate-500 text-sm">已存活 365 天</p>
      </div>

      {/* Placeholder */}
      <div className="bg-white rounded-xl p-12 text-center border border-slate-100">
        <p className="text-slate-400 text-lg">⚙️ 设置页面开发中...</p>
      </div>
    </div>
  );
}
