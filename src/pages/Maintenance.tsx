import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Trash2, Sparkles, Power, PowerOff } from "lucide-react";
import type { TempCleanupResult, StartupApp } from "../types";

export default function Maintenance() {
  const [tempSize, setTempSize] = useState<number | null>(null);
  const [cleaning, setCleaning] = useState(false);
  const [result, setResult] = useState<TempCleanupResult | null>(null);
  const [startupApps, setStartupApps] = useState<StartupApp[]>([]);

  const loadTempSize = async () => {
    const size = await invoke<number>("get_temp_size");
    setTempSize(size);
  };

  const loadStartupApps = async () => {
    const apps = await invoke<StartupApp[]>("get_startup_apps");
    setStartupApps(apps.sort((a, b) => a.name.localeCompare(b.name)));
  };

  useEffect(() => {
    loadTempSize();
    loadStartupApps();
  }, []);

  const handleClean = async () => {
    setCleaning(true);
    try {
      const res = await invoke<TempCleanupResult>("clean_temp_files");
      setResult(res);
      setTempSize(res.after_mb);
    } finally {
      setCleaning(false);
    }
  };

  const toggleStartup = async (name: string, enabled: boolean) => {
    await invoke("toggle_startup_app", { name, enable: !enabled });
    loadStartupApps();
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Maintenance</h1>

      <div className="bg-(--bg-card) border border-(--border) rounded-2xl p-6 shadow-lg mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 text-(--text-muted)">
            <Trash2 size={18} />
            <span className="text-sm font-medium">Fichiers temporaires</span>
          </div>
          <button
            onClick={handleClean}
            disabled={cleaning}
            className="flex items-center gap-2 bg-(--accent) text-white text-sm font-semibold px-4 py-2 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            <Sparkles size={15} />
            {cleaning ? "Nettoyage..." : "Nettoyer maintenant"}
          </button>
        </div>
        <div className="text-3xl font-bold mb-1">
          {tempSize !== null ? `${tempSize.toFixed(0)} Mo` : "..."}
        </div>
        <div className="text-xs text-(--text-muted)">
          Actuellement occupés par des fichiers temporaires
        </div>
        {result && (
          <div className="mt-3 text-sm text-(--ok) font-medium">
            {result.freed_mb.toFixed(0)} Mo libérés avec succès.
          </div>
        )}
      </div>

      <div className="bg-(--bg-card) border border-(--border) rounded-2xl p-5 shadow-lg">
        <div className="text-sm font-medium text-(--text-muted) mb-4">
          Programmes au démarrage de Windows
        </div>
        <div className="flex flex-col gap-2">
          {startupApps.length === 0 && (
            <p className="text-sm text-(--text-muted)">
              Aucun programme de démarrage détecté.
            </p>
          )}
          {startupApps.map((app) => (
            <div
              key={app.name}
              className="flex items-center justify-between border-b border-(--border) py-3 last:border-0"
            >
              <div className="min-w-0">
                <div className="text-sm font-medium text-(--text-main) truncate">
                  {app.name}
                </div>
                <div className="text-xs text-(--text-muted) truncate max-w-md">
                  {app.command}
                </div>
              </div>
              <button
                onClick={() => toggleStartup(app.name, app.enabled)}
                className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg shrink-0 ml-3 ${app.enabled ? "bg-(--alert-bg) text-(--danger)" : "bg-[rgba(34,197,94,0.12)] text-(--ok)"}`}
              >
                {app.enabled ? <PowerOff size={13} /> : <Power size={13} />}
                {app.enabled ? "Désactiver" : "Activer"}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
