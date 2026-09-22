import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  Zap,
  MemoryStick,
  Trash2,
  CheckCircle2,
  RefreshCw,
} from "lucide-react";
import type { ProcessInfo, ClosedResult, TempCleanupResult } from "../types";

export default function QuickActions() {
  const [ramProcesses, setRamProcesses] = useState<ProcessInfo[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const loadProcesses = async () => {
    const list = await invoke<ProcessInfo[]>("get_top_ram_processes");
    setRamProcesses(list);
    setSelected(new Set(list.slice(0, 3).map((p) => p.pid)));
  };

  useEffect(() => {
    loadProcesses();
  }, []);

  const toggle = (pid: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(pid) ? next.delete(pid) : next.add(pid);
      return next;
    });
  };

  const closeSelected = async () => {
    setLoading(true);
    setResult(null);
    try {
      const res = await invoke<ClosedResult>("close_processes", {
        pids: Array.from(selected),
      });
      setResult(
        `${res.closed.length} application(s) fermée(s) — ${res.freed_mb.toFixed(0)} Mo de RAM libérés.`,
      );
      loadProcesses();
    } finally {
      setLoading(false);
    }
  };

  const runFocusMode = async () => {
    setLoading(true);
    setResult(null);
    try {
      const res = await invoke<ClosedResult>("run_focus_mode");
      setResult(
        res.closed.length > 0
          ? `Mode Focus activé : ${res.closed.length} application(s) fermée(s), ${res.freed_mb.toFixed(0)} Mo libérés.`
          : "Aucune application gourmande à fermer pour le moment.",
      );
      loadProcesses();
    } finally {
      setLoading(false);
    }
  };

  const cleanDisk = async () => {
    setLoading(true);
    setResult(null);
    try {
      const res = await invoke<TempCleanupResult>("clean_temp_files");
      setResult(`Disque nettoyé : ${res.freed_mb.toFixed(0)} Mo libérés.`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Actions rapides</h1>

      {result && (
        <div className="flex items-center gap-2 bg-[rgba(34,197,94,0.12)] border border-(--ok) text-(--ok) rounded-xl px-4 py-3 mb-6 text-sm font-medium">
          <CheckCircle2 size={18} />
          {result}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6">
        <button
          onClick={runFocusMode}
          disabled={loading}
          className="bg-(--bg-card) border border-(--border) rounded-2xl p-6 shadow-lg text-left hover:border-(--accent) transition-colors disabled:opacity-50"
        >
          <div className="bg-(--accent) w-10 h-10 rounded-xl flex items-center justify-center mb-3">
            <Zap className="text-white" size={20} />
          </div>
          <div className="font-semibold mb-1">Mode Focus</div>
          <div className="text-sm text-(--text-muted)">
            Ferme automatiquement les applications gourmandes en un clic pour
            libérer des ressources.
          </div>
        </button>

        <button
          onClick={cleanDisk}
          disabled={loading}
          className="bg-(--bg-card) border border-(--border) rounded-2xl p-6 shadow-lg text-left hover:border-(--accent) transition-colors disabled:opacity-50"
        >
          <div className="bg-(--upload) w-10 h-10 rounded-xl flex items-center justify-center mb-3">
            <Trash2 className="text-white" size={20} />
          </div>
          <div className="font-semibold mb-1">
            Nettoyer le disque maintenant
          </div>
          <div className="text-sm text-(--text-muted)">
            Supprime les fichiers temporaires accumulés pour libérer de l'espace
            disque.
          </div>
        </button>
      </div>

      <div className="bg-(--bg-card) border border-(--border) rounded-2xl p-5 shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 text-(--text-muted)">
            <MemoryStick size={16} />
            <span className="text-sm font-medium">
              Libérer de la RAM — choisis les applications à fermer
            </span>
          </div>
          <button
            onClick={loadProcesses}
            className="text-(--text-muted) hover:text-(--text-main)"
          >
            <RefreshCw size={15} />
          </button>
        </div>

        <div className="flex flex-col gap-2 mb-4">
          {ramProcesses.length === 0 && (
            <p className="text-sm text-(--text-muted)">
              Aucune application gourmande détectée.
            </p>
          )}
          {ramProcesses.map((p) => (
            <label
              key={p.pid}
              className="flex items-center justify-between border-b border-(--border) py-2 last:border-0 cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={selected.has(p.pid)}
                  onChange={() => toggle(p.pid)}
                  className="accent-(--accent)"
                />
                <span className="text-sm font-medium text-(--text-main)">
                  {p.name}
                </span>
              </div>
              <span className="text-sm text-(--text-muted)">
                {p.memory_mb.toFixed(0)} Mo
              </span>
            </label>
          ))}
        </div>

        <button
          onClick={closeSelected}
          disabled={loading || selected.size === 0}
          className="bg-(--danger) text-white text-sm font-semibold px-4 py-2 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          Fermer la sélection ({selected.size})
        </button>
      </div>
    </div>
  );
}
