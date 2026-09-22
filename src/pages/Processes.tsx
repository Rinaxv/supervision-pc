import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Cpu, MemoryStick, XCircle, RefreshCw } from "lucide-react";
import type { ProcessInfo } from "../types";

export default function Processes() {
  const [processes, setProcesses] = useState<ProcessInfo[]>([]);
  const [sortBy, setSortBy] = useState<"cpu" | "memory">("cpu");
  const [loading, setLoading] = useState(false);

  const fetchProcesses = async () => {
    setLoading(true);
    try {
      const result = await invoke<ProcessInfo[]>("get_top_processes", {
        sortBy,
      });
      setProcesses(result);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProcesses();
    const interval = setInterval(fetchProcesses, 4000);
    return () => clearInterval(interval);
  }, [sortBy]);

  const handleKill = async (pid: number) => {
    await invoke("kill_process", { pid });
    fetchProcesses();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Gestionnaire de processus</h1>
        <div className="flex items-center gap-2">
          <div className="flex bg-(--bg-card) border border-(--border) rounded-lg p-1 gap-1">
            <button
              onClick={() => setSortBy("cpu")}
              className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md transition-colors ${sortBy === "cpu" ? "bg-(--accent) text-white" : "text-(--text-muted)"}`}
            >
              <Cpu size={13} /> CPU
            </button>
            <button
              onClick={() => setSortBy("memory")}
              className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md transition-colors ${sortBy === "memory" ? "bg-(--accent) text-white" : "text-(--text-muted)"}`}
            >
              <MemoryStick size={13} /> RAM
            </button>
          </div>
          <button
            onClick={fetchProcesses}
            className="flex items-center gap-2 bg-(--accent) text-white text-xs font-semibold px-3 py-2 rounded-lg hover:opacity-90 transition-opacity"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      <div className="bg-(--bg-card) border border-(--border) rounded-2xl overflow-hidden shadow-lg">
        <table className="w-full text-sm">
          <thead className="bg-(--bg-card) text-(--text-muted) text-xs uppercase">
            <tr className="border-b border-(--border)">
              <th className="text-left px-5 py-3 font-medium">Processus</th>
              <th className="text-left px-5 py-3 font-medium">PID</th>
              <th className="text-left px-5 py-3 font-medium">CPU</th>
              <th className="text-left px-5 py-3 font-medium">Mémoire</th>
              <th className="text-left px-5 py-3 font-medium">Action</th>
            </tr>
          </thead>
          <tbody>
            {processes.map((p) => (
              <tr
                key={p.pid}
                className="border-b border-(--border) hover:bg-(--bg-main) transition-colors"
              >
                <td className="px-5 py-3 text-(--text-main) font-medium">
                  {p.name}
                </td>
                <td className="px-5 py-3 text-(--text-muted)">{p.pid}</td>
                <td className="px-5 py-3 text-(--text-main)">
                  {p.cpu_usage.toFixed(1)}%
                </td>
                <td className="px-5 py-3 text-(--text-main)">
                  {p.memory_mb.toFixed(0)} Mo
                </td>
                <td className="px-5 py-3">
                  <button
                    onClick={() => handleKill(p.pid)}
                    className="flex items-center gap-1 text-xs font-medium text-(--danger) hover:opacity-80 transition-opacity"
                  >
                    <XCircle size={14} /> Fermer
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
