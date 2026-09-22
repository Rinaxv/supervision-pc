import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import {
  Database,
  AlertTriangle,
  TrendingUp,
  CalendarDays,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { AppData, DataUsagePayload } from "../types";

const GB = 1_073_741_824;
const MB = 1024 * 1024;

function formatSize(bytes: number) {
  return bytes >= GB
    ? `${(bytes / GB).toFixed(2)} Go`
    : `${(bytes / MB).toFixed(0)} Mo`;
}

export default function DataUsage() {
  const [usage, setUsage] = useState<DataUsagePayload | null>(null);
  const [appData, setAppData] = useState<AppData | null>(null);
  const [limitInput, setLimitInput] = useState("");

  const loadAppData = () => {
    invoke<AppData>("get_app_data").then((data) => {
      setAppData(data);
      setLimitInput(data.data_limit_gb > 0 ? String(data.data_limit_gb) : "");
    });
  };

  useEffect(() => {
    loadAppData();
    const unlisten = listen<DataUsagePayload>("data-usage", (event) => {
      setUsage(event.payload);
    });
    return () => {
      unlisten.then((f) => f());
    };
  }, []);

  const saveLimit = async () => {
    const gb = parseFloat(limitInput);
    if (!isNaN(gb) && gb > 0) {
      await invoke("set_data_limit", { gb });
      loadAppData();
    }
  };

  const monthlyBytes = usage?.monthly_bytes ?? 0;
  const chartData = (usage?.daily ?? []).map(([date, bytes]) => ({
    day: date.slice(-2),
    mo: Number((bytes / MB).toFixed(1)),
  }));

  const avgDaily = chartData.length > 0 ? monthlyBytes / chartData.length : 0;

  const monthlyHistory = appData
    ? Object.entries(appData.monthly_usage)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .slice(-12)
        .map(([month, bytes]) => ({
          month: month.slice(2),
          go: Number((bytes / GB).toFixed(2)),
        }))
    : [];

  const exceeded = usage && usage.limit_gb > 0 && usage.percent >= 100;
  const warning =
    usage && usage.limit_gb > 0 && usage.percent >= 90 && !exceeded;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Consommation de données</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-6">
        <div className="bg-(--bg-card) border border-(--border) rounded-2xl p-5 shadow-lg">
          <div className="flex items-center gap-2 text-(--text-muted) mb-3">
            <Database size={18} />
            <span className="text-sm font-medium">Ce mois-ci</span>
          </div>
          <div className="text-3xl font-bold mb-2">
            {formatSize(monthlyBytes)}
          </div>
          {usage && usage.limit_gb > 0 ? (
            <>
              <div className="w-full h-2 bg-(--border) rounded-full overflow-hidden mb-1">
                <div
                  className={`h-full transition-all duration-500 ${exceeded ? "bg-(--danger)" : warning ? "bg-(--warn)" : "bg-(--ok)"}`}
                  style={{ width: `${Math.min(usage.percent, 100)}%` }}
                />
              </div>
              <div className="text-xs text-(--text-muted)">
                {usage.percent.toFixed(0)}% de {usage.limit_gb} Go
              </div>
              {exceeded && (
                <div className="flex items-center gap-1 text-(--danger) text-xs font-medium mt-2">
                  <AlertTriangle size={13} /> Limite mensuelle dépassée
                </div>
              )}
              {warning && (
                <div className="flex items-center gap-1 text-(--warn) text-xs font-medium mt-2">
                  <AlertTriangle size={13} /> Limite bientôt atteinte
                </div>
              )}
            </>
          ) : (
            <p className="text-xs text-(--text-muted)">
              Aucune limite configurée.
            </p>
          )}
        </div>

        <div className="bg-(--bg-card) border border-(--border) rounded-2xl p-5 shadow-lg">
          <div className="flex items-center gap-2 text-(--text-muted) mb-3">
            <TrendingUp size={18} />
            <span className="text-sm font-medium">Moyenne quotidienne</span>
          </div>
          <div className="text-3xl font-bold mb-1">{formatSize(avgDaily)}</div>
          <div className="text-xs text-(--text-muted)">
            sur {chartData.length} jour(s) ce mois-ci
          </div>
        </div>

        <div className="bg-(--bg-card) border border-(--border) rounded-2xl p-5 shadow-lg flex flex-col justify-between">
          <div>
            <div className="text-sm font-medium text-(--text-muted) mb-2">
              Seuil mensuel (Go)
            </div>
            <input
              type="number"
              value={limitInput}
              onChange={(e) => setLimitInput(e.target.value)}
              placeholder="ex: 10"
              className="w-full bg-(--bg-main) border border-(--border) rounded-lg px-3 py-2 text-sm outline-none text-(--text-main)"
            />
          </div>
          <button
            onClick={saveLimit}
            className="mt-4 bg-(--accent) text-white text-sm font-semibold px-4 py-2 rounded-lg hover:opacity-90 transition-opacity"
          >
            Enregistrer
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="bg-(--bg-card) border border-(--border) rounded-2xl p-5 shadow-lg h-72">
          <div className="flex items-center gap-2 text-(--text-muted) mb-3">
            <CalendarDays size={16} />
            <span className="text-sm font-medium">
              Consommation quotidienne du mois (Mo)
            </span>
          </div>
          <ResponsiveContainer width="100%" height="85%">
            <BarChart data={chartData}>
              <XAxis dataKey="day" stroke="var(--text-muted)" fontSize={11} />
              <YAxis stroke="var(--text-muted)" fontSize={11} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "var(--bg-card)",
                  border: "1px solid var(--border)",
                  borderRadius: "8px",
                  color: "var(--text-main)",
                }}
              />
              <Bar dataKey="mo" fill="var(--accent)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-(--bg-card) border border-(--border) rounded-2xl p-5 shadow-lg h-72">
          <div className="flex items-center gap-2 text-(--text-muted) mb-3">
            <CalendarDays size={16} />
            <span className="text-sm font-medium">
              Historique par mois (Go)
            </span>
          </div>
          <ResponsiveContainer width="100%" height="85%">
            <BarChart data={monthlyHistory}>
              <XAxis dataKey="month" stroke="var(--text-muted)" fontSize={11} />
              <YAxis stroke="var(--text-muted)" fontSize={11} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "var(--bg-card)",
                  border: "1px solid var(--border)",
                  borderRadius: "8px",
                  color: "var(--text-main)",
                }}
              />
              <Bar dataKey="go" fill="var(--upload)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
