import {
  Cpu,
  MemoryStick,
  HardDrive,
  ArrowDown,
  ArrowUp,
  AlertTriangle,
  Wifi,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import type { SystemMetrics, NetworkMetrics, HistoryPoint } from "../types";

function statusColor(percent: number) {
  if (percent < 60)
    return { bar: "bg-(--ok)", text: "text-(--ok)", label: "Normal" };
  if (percent < 85)
    return { bar: "bg-(--warn)", text: "text-(--warn)", label: "Attention" };
  return { bar: "bg-(--danger)", text: "text-(--danger)", label: "Critique" };
}

function formatSpeed(kbps: number) {
  return kbps >= 1000
    ? `${(kbps / 1000).toFixed(2)} Mb/s`
    : `${kbps.toFixed(0)} kb/s`;
}

function MetricCard({
  icon,
  title,
  percent,
  detail,
}: {
  icon: React.ReactNode;
  title: string;
  percent: number;
  detail: string;
}) {
  const status = statusColor(percent);
  return (
    <div className="bg-(--bg-card) border border-(--border) rounded-2xl p-5 flex flex-col gap-3 shadow-lg">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-(--text-muted)">
          {icon}
          <span className="text-sm font-medium">{title}</span>
        </div>
        <span className={`text-xs font-semibold ${status.text}`}>
          {status.label}
        </span>
      </div>
      <div className="text-3xl font-bold text-(--text-main)">
        {percent.toFixed(1)}%
      </div>
      <div className="w-full h-2 bg-(--border) rounded-full overflow-hidden">
        <div
          className={`h-full ${status.bar} transition-all duration-500`}
          style={{ width: `${Math.min(percent, 100)}%` }}
        />
      </div>
      <div className="text-xs text-(--text-muted)">{detail}</div>
    </div>
  );
}

function SpeedCard({
  icon,
  title,
  kbps,
  color,
  alert,
}: {
  icon: React.ReactNode;
  title: string;
  kbps: number;
  color: string;
  alert?: boolean;
}) {
  return (
    <div
      className={`bg-(--bg-card) border rounded-2xl p-5 flex flex-col gap-2 shadow-lg ${alert ? "border-(--danger)" : "border-(--border)"}`}
    >
      <div className="flex items-center gap-2 text-(--text-muted)">
        {icon}
        <span className="text-sm font-medium">{title}</span>
      </div>
      <div className="text-3xl font-bold" style={{ color }}>
        {formatSpeed(kbps)}
      </div>
    </div>
  );
}

function tooltipFormatter(
  value: string | number | (string | number)[],
): [string, string] {
  const num = Array.isArray(value) ? Number(value[0]) : Number(value);
  return [formatSpeed(Number.isFinite(num) ? num : 0), ""];
}

function legendFormatter(value: string): string {
  return value === "download" ? "Débit descendant" : "Débit montant";
}

export default function Dashboard({
  metrics,
  network,
  history,
}: {
  metrics: SystemMetrics | null;
  network: NetworkMetrics | null;
  history: HistoryPoint[];
}) {
  const toGo = (bytes: number) => (bytes / 1024 / 1024 / 1024).toFixed(1);
  const ramPercent = metrics ? (metrics.ram_used / metrics.ram_total) * 100 : 0;
  const diskPercent = metrics
    ? (metrics.disk_used / metrics.disk_total) * 100
    : 0;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Tableau de bord</h1>

      {!metrics ? (
        <p className="text-(--text-muted)">Chargement des métriques...</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
          <MetricCard
            icon={<Cpu size={18} />}
            title="Processeur"
            percent={metrics.cpu_usage}
            detail="Utilisation CPU en temps réel"
          />
          <MetricCard
            icon={<MemoryStick size={18} />}
            title="Mémoire vive"
            percent={ramPercent}
            detail={`${toGo(metrics.ram_used)} Go / ${toGo(metrics.ram_total)} Go`}
          />
          <MetricCard
            icon={<HardDrive size={18} />}
            title="Disque"
            percent={diskPercent}
            detail={`${toGo(metrics.disk_used)} Go / ${toGo(metrics.disk_total)} Go`}
          />
        </div>
      )}

      <div className="flex items-center gap-2 mb-4">
        <Wifi size={20} className="text-(--accent)" />
        <h2 className="text-lg font-semibold">Réseau</h2>
      </div>

      {network?.is_peak && (
        <div className="flex items-center gap-2 bg-(--alert-bg) border border-(--danger) text-(--danger) rounded-xl px-4 py-3 mb-5 text-sm font-medium">
          <AlertTriangle size={18} />
          Pic de trafic réseau détecté — utilisation anormalement élevée
        </div>
      )}

      {network && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
            <SpeedCard
              icon={<ArrowDown size={18} />}
              title="Débit descendant"
              kbps={network.download_kbps}
              color="var(--accent)"
              alert={network.is_peak}
            />
            <SpeedCard
              icon={<ArrowUp size={18} />}
              title="Débit montant"
              kbps={network.upload_kbps}
              color="var(--upload)"
            />
          </div>

          <div className="bg-(--bg-card) border border-(--border) rounded-2xl p-5 shadow-lg h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={history}>
                <XAxis dataKey="t" hide />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--bg-card)",
                    border: "1px solid var(--border)",
                    borderRadius: "8px",
                    color: "var(--text-main)",
                  }}
                  formatter={tooltipFormatter}
                />
                <Legend
                  wrapperStyle={{
                    color: "var(--text-muted)",
                    fontSize: "13px",
                  }}
                  formatter={legendFormatter}
                />
                <Area
                  type="monotone"
                  dataKey="download"
                  name="download"
                  stroke="var(--accent)"
                  fill="var(--accent)"
                  fillOpacity={0.15}
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  dataKey="upload"
                  name="upload"
                  stroke="var(--upload)"
                  fill="var(--upload)"
                  fillOpacity={0.1}
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </div>
  );
}
