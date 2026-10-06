import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  CircuitBoard,
  AlertTriangle,
  CheckCircle2,
  Search,
} from "lucide-react";
import type { DriverInfo } from "../types";

export default function Drivers() {
  const [drivers, setDrivers] = useState<DriverInfo[]>([]);
  const [threshold, setThreshold] = useState(2);
  const [loading, setLoading] = useState(false);
  const [scanned, setScanned] = useState(false);

  const analyze = async () => {
    setLoading(true);
    try {
      const result = await invoke<DriverInfo[]>("get_driver_report", {
        thresholdYears: threshold,
      });
      setDrivers(result);
      setScanned(true);
    } finally {
      setLoading(false);
    }
  };

  const oldCount = drivers.filter((d) => d.is_old).length;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold mb-1">Pilotes obsolètes</h1>
          <p className="text-sm text-(--text-muted)">
            Liste des pilotes installés, avec leur ancienneté. Aucune mise à
            jour n'est effectuée automatiquement.
          </p>
        </div>
      </div>

      <div className="bg-(--bg-card) border border-(--border) rounded-2xl p-5 shadow-lg mb-6">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <div className="text-xs text-(--text-muted) mb-1">
              Seuil d'ancienneté (années)
            </div>
            <input
              type="number"
              min={1}
              step={0.5}
              value={threshold}
              onChange={(e) => setThreshold(Number(e.target.value))}
              className="w-28 bg-(--bg-main) border border-(--border) rounded-lg px-3 py-2 text-sm outline-none text-(--text-main)"
            />
          </div>
          <button
            onClick={analyze}
            disabled={loading}
            className="flex items-center gap-2 bg-(--accent) text-white text-sm font-semibold px-4 py-2 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            <Search size={16} />
            {loading ? "Analyse en cours..." : "Analyser les pilotes"}
          </button>
        </div>
      </div>

      {scanned && (
        <div
          className={`flex items-center gap-2 rounded-xl px-4 py-3 mb-6 text-sm font-medium border ${
            oldCount > 0
              ? "bg-(--alert-bg) border-(--danger) text-(--danger)"
              : "bg-[rgba(34,197,94,0.12)] border-(--ok) text-(--ok)"
          }`}
        >
          {oldCount > 0 ? (
            <AlertTriangle size={18} />
          ) : (
            <CheckCircle2 size={18} />
          )}
          {oldCount > 0
            ? `${oldCount} pilote(s) dépassent le seuil de ${threshold} an(s) sur ${drivers.length} détecté(s).`
            : `Tous les pilotes détectés (${drivers.length}) sont dans le seuil d'ancienneté.`}
        </div>
      )}

      <div className="bg-(--bg-card) border border-(--border) rounded-2xl overflow-hidden shadow-lg">
        <div className="flex items-center gap-2 px-5 py-3 border-b border-(--border) text-(--text-muted)">
          <CircuitBoard size={16} />
          <span className="text-sm font-medium">
            {drivers.length} pilote(s)
          </span>
        </div>
        <div className="max-h-120 overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-(--bg-card) text-(--text-muted) text-xs uppercase">
              <tr className="border-b border-(--border)">
                <th className="text-left px-5 py-3 font-medium">
                  Périphérique
                </th>
                <th className="text-left px-5 py-3 font-medium">Fabricant</th>
                <th className="text-left px-5 py-3 font-medium">Version</th>
                <th className="text-left px-5 py-3 font-medium">Date</th>
                <th className="text-left px-5 py-3 font-medium">Ancienneté</th>
              </tr>
            </thead>
            <tbody>
              {drivers.map((d, i) => (
                <tr
                  key={i}
                  className={`border-b border-(--border) hover:bg-(--bg-main) transition-colors ${d.is_old ? "bg-(--alert-bg)" : ""}`}
                >
                  <td className="px-5 py-3 text-(--text-main) font-medium">
                    {d.device_name}
                  </td>
                  <td className="px-5 py-3 text-(--text-muted)">
                    {d.manufacturer}
                  </td>
                  <td className="px-5 py-3 text-(--text-muted)">{d.version}</td>
                  <td className="px-5 py-3 text-(--text-muted)">{d.date}</td>
                  <td className="px-5 py-3">
                    <span
                      className={`text-xs font-semibold px-2 py-1 rounded-md ${d.is_old ? "bg-(--danger)/15 text-(--danger)" : "bg-(--ok)/15 text-(--ok)"}`}
                    >
                      {d.age_years.toFixed(1)} an(s)
                      {d.is_old ? " — obsolète" : ""}
                    </span>
                  </td>
                </tr>
              ))}
              {drivers.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="text-center py-8 text-(--text-muted)"
                  >
                    {scanned
                      ? "Aucun pilote détecté."
                      : "Lance une analyse pour voir la liste des pilotes."}
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
