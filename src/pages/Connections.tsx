import { useEffect, useState, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import { RefreshCw, Search, Network } from "lucide-react";
import type { ConnectionInfo } from "../types";

function protocolBadge(protocol: string) {
  return protocol === "TCP"
    ? "bg-(--accent)/12 text-(--accent)"
    : "bg-(--upload)/12 text-(--upload)";
}

function stateBadge(state: string) {
  const s = state.toUpperCase();
  if (s.includes("ESTABLISHED")) return "bg-(--ok)/12 text-(--ok)";
  if (s.includes("LISTEN")) return "bg-(--warn)/12 text-(--warn)";
  return "bg-(--border) text-(--text-muted)";
}

export default function Connections() {
  const [connections, setConnections] = useState<ConnectionInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [autoRefresh, setAutoRefresh] = useState(true);

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
    if (!autoRefresh) return;
    const interval = setInterval(fetchConnections, 5000);
    return () => clearInterval(interval);
  }, [autoRefresh]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return connections.filter(
      (c) =>
        c.process_name.toLowerCase().includes(q) ||
        c.local_addr.includes(q) ||
        c.remote_addr.includes(q) ||
        String(c.pid).includes(q),
    );
  }, [connections, search]);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Connexions actives</h1>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-xs text-(--text-muted) font-medium">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="accent-(--accent)"
            />
            Auto-actualisation
          </label>
          <button
            onClick={fetchConnections}
            className="flex items-center gap-2 bg-(--accent) text-white text-xs font-semibold px-3 py-2 rounded-lg hover:opacity-90 transition-opacity"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            Actualiser
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2 bg-(--bg-card) border border-(--border) rounded-xl px-3 py-2 mb-5 w-full max-w-sm">
        <Search size={16} className="text-(--text-muted)" />
        <input
          type="text"
          placeholder="Filtrer par processus, IP ou PID..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-transparent outline-none text-sm text-(--text-main) placeholder:text-(--text-muted) w-full"
        />
      </div>

      <div className="bg-(--bg-card) border border-(--border) rounded-2xl overflow-hidden shadow-lg">
        <div className="flex items-center gap-2 px-5 py-3 border-b border-(--border) text-(--text-muted)">
          <Network size={16} />
          <span className="text-sm font-medium">
            {filtered.length} connexion(s)
          </span>
        </div>

        <div className="overflow-x-auto max-h-130 overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-(--bg-card) text-(--text-muted) text-xs uppercase">
              <tr className="border-b border-(--border)">
                <th className="text-left px-5 py-3 font-medium">Protocole</th>
                <th className="text-left px-5 py-3 font-medium">
                  Adresse locale
                </th>
                <th className="text-left px-5 py-3 font-medium">
                  Adresse distante
                </th>
                <th className="text-left px-5 py-3 font-medium">État</th>
                <th className="text-left px-5 py-3 font-medium">Processus</th>
                <th className="text-left px-5 py-3 font-medium">PID</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c, i) => (
                <tr
                  key={i}
                  className="border-b border-(--border) hover:bg-(--bg-main) transition-colors"
                >
                  <td className="px-5 py-3">
                    <span
                      className={`text-xs font-semibold px-2 py-1 rounded-md ${protocolBadge(c.protocol)}`}
                    >
                      {c.protocol}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-(--text-main)">
                    {c.local_addr}:{c.local_port}
                  </td>
                  <td className="px-5 py-3 text-(--text-muted)">
                    {c.remote_port ? `${c.remote_addr}:${c.remote_port}` : "-"}
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className={`text-xs font-medium px-2 py-1 rounded-md ${stateBadge(c.state)}`}
                    >
                      {c.state}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-(--text-main) font-medium">
                    {c.process_name}
                  </td>
                  <td className="px-5 py-3 text-(--text-muted)">{c.pid}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="text-center py-8 text-(--text-muted)"
                  >
                    Aucune connexion trouvée
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
