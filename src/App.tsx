import "./App.css";
import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import Sidebar from "./components/Sidebar";
import Dashboard from "./pages/Dashboard";
import Connections from "./pages/Connections";
import NetworkApps from "./pages/NetworkApps";
import DataUsage from "./pages/DataUsage";
import SpeedTest from "./pages/SpeedTest";
import WifiHealth from "./pages/WifiHealth";
import Processes from "./pages/Processes";
import Maintenance from "./pages/Maintenance";
import Battery from "./pages/Battery";
import QuickActions from "./pages/QuickActions";
import Historique from "./pages/Historique";
import DiskIO from "./pages/DiskIO";
import Diagnostic from "./pages/Diagnostic";
import DiskCleaner from "./pages/DiskCleaner";
import { AlertTriangle, X } from "lucide-react";
import type {
  SystemMetrics,
  NetworkMetrics,
  HistoryPoint,
  Theme,
  Page,
} from "./types";

function App() {
  const [page, setPage] = useState<Page>("diagnostic");

  const [metrics, setMetrics] = useState<SystemMetrics | null>(null);
  const [network, setNetwork] = useState<NetworkMetrics | null>(null);
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const [suspiciousApps, setSuspiciousApps] = useState<string[]>([]);

  const [theme, setTheme] = useState<Theme>(
    () => (localStorage.getItem("app-theme") as Theme) || "dark",
  );
  const [accentColor, setAccentColor] = useState<string>(
    () => localStorage.getItem("app-accent") || "#8b5cf6",
  );

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("app-theme", theme);
    if (theme === "custom") {
      document.documentElement.style.setProperty("--accent", accentColor);
    } else {
      document.documentElement.style.removeProperty("--accent");
    }
  }, [theme, accentColor]);

  useEffect(() => {
    localStorage.setItem("app-accent", accentColor);
  }, [accentColor]);

  useEffect(() => {
    const unlistenSystem = listen<SystemMetrics>("system-metrics", (event) => {
      setMetrics(event.payload);
    });

    const unlistenNetwork = listen<NetworkMetrics>(
      "network-metrics",
      (event) => {
        setNetwork(event.payload);
        setHistory((prev) => {
          const next = [
            ...prev,
            {
              t: prev.length,
              download: event.payload.download_kbps,
              upload: event.payload.upload_kbps,
            },
          ];
          return next.length > 30 ? next.slice(next.length - 30) : next;
        });
      },
    );

    const unlistenSuspicious = listen<string>("suspicious-app", (event) => {
      setSuspiciousApps((prev) => [...prev, event.payload]);
    });

    return () => {
      unlistenSystem.then((f) => f());
      unlistenNetwork.then((f) => f());
      unlistenSuspicious.then((f) => f());
    };
  }, []);

  return (
    <div className="flex h-screen bg-(--bg-main)">
      <Sidebar
        page={page}
        setPage={setPage}
        theme={theme}
        setTheme={setTheme}
        accentColor={accentColor}
        setAccentColor={setAccentColor}
      />
      <main className="flex-1 overflow-y-auto p-8">
        {suspiciousApps.length > 0 && (
          <div className="flex flex-col gap-2 mb-6">
            {suspiciousApps.map((name, i) => (
              <div
                key={i}
                className="flex items-center justify-between gap-2 bg-(--alert-bg) border border-(--danger) text-(--danger) rounded-xl px-4 py-3 text-sm font-medium"
              >
                <div className="flex items-center gap-2">
                  <AlertTriangle size={18} />
                  Nouvelle application détectée sur le réseau :{" "}
                  <strong>{name}</strong>
                </div>
                <button
                  onClick={() =>
                    setSuspiciousApps((prev) =>
                      prev.filter((_, idx) => idx !== i),
                    )
                  }
                >
                  <X size={16} />
                </button>
              </div>
            ))}
          </div>
        )}

        {page === "diagnostic" && <Diagnostic />}
        {page === "dashboard" && (
          <Dashboard metrics={metrics} network={network} history={history} />
        )}
        {page === "quick-actions" && <QuickActions />}
        {page === "disk-cleaner" && <DiskCleaner />}
        {page === "connections" && <Connections />}
        {page === "network-apps" && <NetworkApps />}
        {page === "disk-io" && <DiskIO />}
        {page === "data-usage" && <DataUsage />}
        {page === "speed-test" && <SpeedTest />}
        {page === "wifi-health" && <WifiHealth network={network} />}
        {page === "processes" && <Processes />}
        {page === "maintenance" && <Maintenance />}
        {page === "battery" && <Battery />}
        {page === "historique" && <Historique />}
      </main>
    </div>
  );
}

export default App;
