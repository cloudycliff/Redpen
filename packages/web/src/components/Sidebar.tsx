import {
  Archive,
  ChevronLeft,
  ChevronRight,
  FileText,
  Inbox,
  Settings,
} from "lucide-react";

export type TopView = "inbox" | "articles" | "archive" | "settings";

interface SidebarProps {
  activeView: TopView;
  collapsed: boolean;
  hasApiKey: boolean;
  onSelectView: (v: TopView) => void;
  onToggleCollapse: () => void;
}

export function Sidebar({
  activeView,
  collapsed,
  hasApiKey,
  onSelectView,
  onToggleCollapse,
}: SidebarProps) {
  const navItems: Array<{ id: TopView; label: string; icon: typeof Inbox }> = [
    { id: "inbox", label: "收件箱", icon: Inbox },
    { id: "articles", label: "文章", icon: FileText },
    { id: "archive", label: "档案馆", icon: Archive },
  ];

  return (
    <aside
      className={`flex flex-col border-r border-[#E7E4DC] bg-[#F3F1EB] transition-all duration-150 shrink-0 ${
        collapsed ? "w-14" : "w-48"
      }`}
    >
      <div className="flex items-center justify-between px-3 py-4 border-b border-[#E7E4DC]">
        {!collapsed && (
          <div className="min-w-0">
            <div className="text-sm font-semibold tracking-wide text-[#1F1E1C] truncate">
              承重墙 · 写作台
            </div>
            <div className="text-[11px] text-[#78716C] truncate">
              Local-first 思想工坊
            </div>
          </div>
        )}
        <button
          onClick={onToggleCollapse}
          className="p-1.5 rounded-md text-[#78716C] hover:text-[#1F1E1C] hover:bg-[#E7E4DC]/60 transition"
          title={collapsed ? "展开导航" : "收起导航（专注写作）"}
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      <nav className="flex-1 p-2 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = activeView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelectView(item.id)}
              title={item.label}
              className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm transition ${
                active
                  ? "bg-white text-[#1F1E1C] font-medium shadow-xs border border-[#E7E4DC]"
                  : "text-[#57534E] hover:bg-[#E7E4DC]/50 hover:text-[#1F1E1C]"
              }`}
            >
              <Icon size={17} className="shrink-0" />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </button>
          );
        })}
      </nav>

      <div className="p-2 border-t border-[#E7E4DC]">
        <button
          onClick={() => onSelectView("settings")}
          title="设置"
          className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm transition ${
            activeView === "settings"
              ? "bg-white text-[#1F1E1C] font-medium shadow-xs border border-[#E7E4DC]"
              : "text-[#57534E] hover:bg-[#E7E4DC]/50 hover:text-[#1F1E1C]"
          }`}
        >
          <Settings size={17} className="shrink-0" />
          {!collapsed && (
            <div className="flex items-center justify-between flex-1 min-w-0">
              <span>设置</span>
              <span
                className={`w-2 h-2 rounded-full ${
                  hasApiKey ? "bg-emerald-500" : "bg-amber-500"
                }`}
                title={hasApiKey ? "API 已配置" : "尚未配置 API Key"}
              />
            </div>
          )}
        </button>
      </div>
    </aside>
  );
}
