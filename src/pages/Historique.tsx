import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { History as HistoryIcon, Zap, Trash2, MemoryStick } from "lucide-react";
import type { AppData, ActionLogEntry } from "../types";

function actionIcon(action: string) {
  if (action.includes("Focus"))
    return <Zap size={15} className="text-(--accent)" />;
  if (action.includes("disque") || action.includes("Nettoyage"))
    return <Trash2 size={15} className="text-(--upload)" />;
  return <MemoryStick size={15} className="text-(--ok)" />;
}

export default function Historique() {
  const [log, setLog] = useState<ActionLogEntry[]>([]);

  useEffect(() => {
    invoke<AppData>("get_app_data").then((data) => {
      setLog([...data.actions_log].reverse());
    });
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Historique des actions</h1>

      <div className="bg-(--bg-card) border border-(--border) rounded-2xl p-5 shadow-lg">
        <div className="flex items-center gap-2 mb-4 text-(--text-muted)">
          <HistoryIcon size={16} />
          <span className="text-sm font-medium">
            Actions effectuées par l'application
          </span>
        </div>

        <div className="flex flex-col gap-3">
          {log.length === 0 && (
            <p className="text-sm text-(--text-muted)">
              Aucune action enregistrée pour l'instant. Utilise le Mode Focus ou
              le nettoyage de disque pour voir apparaître un historique ici.
            </p>
          )}
          {log.map((entry, i) => (
            <div
              key={i}
              className="flex items-start gap-3 border-b border-(--border) py-3 last:border-0"
            >
              <div className="bg-(--bg-main) p-2 rounded-lg mt-0.5">
                {actionIcon(entry.action)}
              </div>
              <div>
                <div className="text-sm font-semibold text-(--text-main)">
                  {entry.action}
                </div>
                <div className="text-sm text-(--text-muted)">
                  {entry.detail}
                </div>
                <div className="text-xs text-(--text-muted) mt-1">
                  {new Date(entry.date).toLocaleString()}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
