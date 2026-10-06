import {
  LayoutDashboard,
  Network,
  Wifi,
  Database,
  Gauge as GaugeIcon,
  Signal,
  ShieldCheck,
  Sun,
  Moon,
  Palette,
  Activity,
  Sparkles,
  BatteryFull,
  Zap,
  History,
  HardDrive,
  Stethoscope,
  FolderSearch,
  CircuitBoard,
  DownloadCloud,
} from "lucide-react";
import type { Page, Theme } from "../types";

function ThemeSwitcher({
  theme,
  setTheme,
  accentColor,
  setAccentColor,
}: {
  theme: Theme;
  setTheme: (t: Theme) => void;
  accentColor: string;
  setAccentColor: (c: string) => void;
}) {
  const options: { id: Theme; icon: React.ReactNode; label: string }[] = [
    { id: "dark", icon: <Moon size={15} />, label: "Sombre" },
    { id: "light", icon: <Sun size={15} />, label: "Clair" },
    { id: "custom", icon: <Palette size={15} />, label: "Perso" },
  ];
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col bg-(--bg-main) border border-(--border) rounded-xl p-1 gap-1">
        {options.map((opt) => (
          <button
            key={opt.id}
            onClick={() => setTheme(opt.id)}
            className={`flex items-center gap-2 text-xs font-medium px-3 py-2 rounded-lg transition-colors ${theme === opt.id ? "bg-(--accent) text-white" : "text-(--text-muted) hover:text-(--text-main)"}`}
          >
            {opt.icon}
            {opt.label}
          </button>
        ))}
      </div>
      {theme === "custom" && (
        <input
          type="color"
          value={accentColor}
          onChange={(e) => setAccentColor(e.target.value)}
          className="w-full h-8 rounded-lg border border-(--border) bg-transparent cursor-pointer"
          title="Couleur d'accent"
        />
      )}
    </div>
  );
}

export default function Sidebar({
  page,
  setPage,
  theme,
  setTheme,
  accentColor,
  setAccentColor,
}: {
  page: Page;
  setPage: (p: Page) => void;
  theme: Theme;
  setTheme: (t: Theme) => void;
  accentColor: string;
  setAccentColor: (c: string) => void;
}) {
  const navItems: { id: Page; label: string; icon: React.ReactNode }[] = [
    {
      id: "diagnostic",
      label: "Diagnostic complet",
      icon: <Stethoscope size={19} />,
    },
    {
      id: "dashboard",
      label: "Tableau de bord",
      icon: <LayoutDashboard size={19} />,
    },
    { id: "quick-actions", label: "Actions rapides", icon: <Zap size={19} /> },
    {
      id: "windows-update",
      label: "Mises à jour Windows",
      icon: <DownloadCloud size={19} />,
    },
    {
      id: "drivers",
      label: "Pilotes obsolètes",
      icon: <CircuitBoard size={19} />,
    },
    {
      id: "disk-cleaner",
      label: "Analyse du disque",
      icon: <FolderSearch size={19} />,
    },
    {
      id: "connections",
      label: "Connexions actives",
      icon: <Network size={19} />,
    },
    {
      id: "network-apps",
      label: "Qui utilise mon internet ?",
      icon: <Wifi size={19} />,
    },
    { id: "disk-io", label: "Activité disque", icon: <HardDrive size={19} /> },
    {
      id: "data-usage",
      label: "Consommation data",
      icon: <Database size={19} />,
    },
    {
      id: "speed-test",
      label: "Test de vitesse",
      icon: <GaugeIcon size={19} />,
    },
    { id: "wifi-health", label: "Santé du Wi-Fi", icon: <Signal size={19} /> },
    { id: "processes", label: "Processus", icon: <Activity size={19} /> },
    { id: "maintenance", label: "Maintenance", icon: <Sparkles size={19} /> },
    { id: "battery", label: "Batterie", icon: <BatteryFull size={19} /> },
    {
      id: "historique",
      label: "Historique des actions",
      icon: <History size={19} />,
    },
  ];

  return (
    <aside className="w-64 h-screen bg-(--bg-card) border-r border-(--border) flex flex-col p-4 shrink-0 overflow-y-auto">
      <div className="flex items-center gap-2.5 px-2 py-3 mb-6">
        <div className="bg-(--accent) p-2 rounded-xl">
          <ShieldCheck className="text-white" size={22} />
        </div>
        <div>
          <div className="font-bold text-(--text-main) leading-tight">
            Supervision PC
          </div>
          <div className="text-[11px] text-(--text-muted)">
            Surveillance temps réel
          </div>
        </div>
      </div>

      <nav className="flex flex-col gap-1 flex-1">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setPage(item.id)}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors text-left ${page === item.id ? "bg-(--accent) text-white" : "text-(--text-muted) hover:bg-(--bg-main) hover:text-(--text-main)"}`}
          >
            {item.icon}
            <span className="truncate">{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="pt-4 border-t border-(--border)">
        <ThemeSwitcher
          theme={theme}
          setTheme={setTheme}
          accentColor={accentColor}
          setAccentColor={setAccentColor}
        />
      </div>
    </aside>
  );
}
