import { useEffect, useState, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import { RefreshCw, Wifi, XCircle, AlertCircle } from "lucide-react";
import type { ConnectionInfo } from "../types";

interface AppUsage {
  process_name: string;
  pid: number;
  connectionCount: number;
}

export default function NetworkApps() {
  const [connections, setConnections] = useState<ConnectionInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [killedMessage, setKilledMessage] = useState<string | null>(null);

  const fetchConnections = async () => {
    setLoading(true);
    try {
      const result = await invoke<ConnectionInfo[]>("get_active_connections");
      setConnections(result);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConnections();
    const interval = setInterval(fetchConnections, 5000);
    return () => clearInterval(interval);
  }, []);

  const apps: AppUsage[] = useMemo(() => {
    const map = new Map<string, AppUsage>();
    for (const c of connections) {
      const key = `${c.process_name}-${c.pid}`;
      if (!map.has(key)) {
        map.set(key, {
          process_name: c.process_name,
          pid: c.pid,
          connectionCount: 0,
        });
      }
      map.get(key)!.connectionCount += 1;
    }
    return Array.from(map.values())
      .filter((a) => a.process_name !== "Inconnu")
      .sort((a, b) => b.connectionCount - a.connectionCount);
  }, [connections]);

  const maxCount = apps.length > 0 ? apps[0].connectionCount : 1;

  const handleClose = async (pid: number, name: string) => {
    const ok = await invoke<boolean>("kill_process", { pid });
    setKilledMessage(
      ok
        ? `${name} a été fermé.`
        : `Impossible de fermer ${name} (droits administrateur requis).`,
    );
    setTimeout(() => setKilledMessage(null), 4000);
    fetchConnections();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold mb-1">
            Qui utilise mon internet ?
          </h1>
          <p className="text-sm text-(--text-muted)">
            Classement des applications par nombre de connexions réseau actives
          </p>
        </div>
        <button
          onClick={fetchConnections}
          className="flex items-center gap-2 bg-(--accent) text-white text-xs font-semibold px-3 py-2 rounded-lg hover:opacity-90 transition-opacity"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          Actualiser
        </button>
      </div>

      {killedMessage && (
        <div className="flex items-center gap-2 bg-(--alert-bg) border border-(--danger) text-(--danger) rounded-xl px-4 py-3 mb-5 text-sm font-medium">
          <AlertCircle size={18} />
          {killedMessage}
        </div>
      )}

      <div className="bg-(--bg-card) border border-(--border) rounded-2xl p-5 shadow-lg">
        <div className="flex items-center gap-2 mb-5 text-(--text-muted)">
          <Wifi size={16} />
          <span className="text-sm font-medium">
            {apps.length} application(s) active(s) sur le réseau
          </span>
        </div>

        <div className="flex flex-col gap-3">
          {apps.map((app) => {
            const percent = (app.connectionCount / maxCount) * 100;
            return (
              <div
                key={`${app.process_name}-${app.pid}`}
                className="flex items-center gap-4"
              >
                <div
                  className="w-40 shrink-0 text-sm font-medium text-(--text-main) truncate"
                  title={app.process_name}
                >
                  {app.process_name}
                </div>
                <div className="flex-1 h-2.5 bg-(--border) rounded-full overflow-hidden">
                  <div
                    className="h-full bg-(--accent) transition-all duration-500"
                    style={{ width: `${percent}%` }}
                  />
                </div>
                <div className="w-24 shrink-0 text-xs text-(--text-muted) text-right">
                  {app.connectionCount} connexion
                  {app.connectionCount > 1 ? "s" : ""}
                </div>
                <button
                  onClick={() => handleClose(app.pid, app.process_name)}
                  className="shrink-0 flex items-center gap-1 text-xs font-medium text-(--danger) hover:opacity-80 transition-opacity px-2 py-1"
                  title="Fermer cette application"
                >
                  <XCircle size={14} />
                  Fermer
                </button>
              </div>
            );
          })}
          {apps.length === 0 && (
            <p className="text-center text-(--text-muted) py-6">
              Aucune activité réseau détectée pour le moment
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
