import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { HardDrive, AlertTriangle, XCircle } from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import type { DiskIoMetrics, DiskIoPoint } from "../types";

function formatKbps(v: number) {
  return v >= 1000 ? `${(v / 1000).toFixed(1)} Mo/s` : `${v.toFixed(0)} Ko/s`;
}

export default function DiskIO() {
  const [current, setCurrent] = useState<DiskIoMetrics | null>(null);
  const [history, setHistory] = useState<DiskIoPoint[]>([]);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    const unlisten = listen<DiskIoMetrics>("disk-io", (event) => {
      setCurrent(event.payload);
      setHistory((prev) => {
        const next = [
          ...prev,
          {
            t: prev.length,
            read: event.payload.read_kbps,
            write: event.payload.write_kbps,
          },
        ];
        return next.length > 30 ? next.slice(next.length - 30) : next;
      });
    });
    return () => {
      unlisten.then((f) => f());
    };
  }, []);

  const closeResponsible = async () => {
    if (!current?.top_writer) return;
    setClosing(true);
    try {
      await invoke("close_processes", { pids: [current.top_writer.pid] });
    } finally {
      setClosing(false);
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Activité disque en temps réel</h1>

      {current?.is_heavy && current.top_writer && (
        <div className="flex items-center justify-between gap-3 bg-(--alert-bg) border border-(--danger) text-(--danger) rounded-xl px-4 py-3 mb-6 text-sm font-medium">
          <div className="flex items-center gap-2">
            <AlertTriangle size={18} />
            Forte activité disque détectée — application responsable probable :{" "}
            <strong>{current.top_writer.name}</strong>
          </div>
          <button
            onClick={closeResponsible}
            disabled={closing}
            className="flex items-center gap-1 bg-(--danger) text-white text-xs font-semibold px-3 py-1.5 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            <XCircle size={13} /> Fermer l'application
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6">
        <div className="bg-(--bg-card) border border-(--border) rounded-2xl p-5 shadow-lg">
          <div className="flex items-center gap-2 text-(--text-muted) mb-2">
            <HardDrive size={18} />
            <span className="text-sm font-medium">Lecture disque</span>
          </div>
          <div
            className="text-3xl font-bold"
            style={{ color: "var(--accent)" }}
          >
            {current ? formatKbps(current.read_kbps) : "..."}
          </div>
        </div>
        <div className="bg-(--bg-card) border border-(--border) rounded-2xl p-5 shadow-lg">
          <div className="flex items-center gap-2 text-(--text-muted) mb-2">
            <HardDrive size={18} />
            <span className="text-sm font-medium">Écriture disque</span>
          </div>
          <div
            className="text-3xl font-bold"
            style={{ color: "var(--upload)" }}
          >
            {current ? formatKbps(current.write_kbps) : "..."}
          </div>
        </div>
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
              formatter={(v: unknown) => formatKbps(Number(v) || 0)}
            />
            <Legend
              wrapperStyle={{ color: "var(--text-muted)", fontSize: "13px" }}
              formatter={(value) => (value === "read" ? "Lecture" : "Écriture")}
            />
            <Area
              type="monotone"
              dataKey="read"
              name="read"
              stroke="var(--accent)"
              fill="var(--accent)"
              fillOpacity={0.15}
              strokeWidth={2}
            />
            <Area
              type="monotone"
              dataKey="write"
              name="write"
              stroke="var(--upload)"
              fill="var(--upload)"
              fillOpacity={0.1}
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
