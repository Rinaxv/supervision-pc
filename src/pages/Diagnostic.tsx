import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  Stethoscope,
  CheckCircle2,
  AlertTriangle,
  AlertOctagon,
  Info,
  Wrench,
} from "lucide-react";
import type { DiagnosticReport, FullFixResult } from "../types";

function severityStyle(severity: string) {
  switch (severity) {
    case "critical":
      return {
        icon: <AlertOctagon size={18} />,
        color: "text-(--danger)",
        bg: "bg-(--alert-bg)",
        border: "border-(--danger)",
      };
    case "warning":
      return {
        icon: <AlertTriangle size={18} />,
        color: "text-(--warn)",
        bg: "bg-[rgba(245,158,11,0.1)]",
        border: "border-(--warn)",
      };
    case "ok":
      return {
        icon: <CheckCircle2 size={18} />,
        color: "text-(--ok)",
        bg: "bg-[rgba(34,197,94,0.1)]",
        border: "border-(--ok)",
      };
    default:
      return {
        icon: <Info size={18} />,
        color: "text-(--accent)",
        bg: "bg-[rgba(59,130,246,0.1)]",
        border: "border-(--accent)",
      };
  }
}

export default function Diagnostic() {
  const [report, setReport] = useState<DiagnosticReport | null>(null);
  const [scanning, setScanning] = useState(false);
  const [fixing, setFixing] = useState(false);
  const [fixResult, setFixResult] = useState<FullFixResult | null>(null);

  const scan = async () => {
    setScanning(true);
    setFixResult(null);
    try {
      const res = await invoke<DiagnosticReport>("run_diagnostic");
      setReport(res);
    } finally {
      setScanning(false);
    }
  };

  const fixAll = async () => {
    setFixing(true);
    try {
      const res = await invoke<FullFixResult>("run_full_fix");
      setFixResult(res);
      scan();
    } finally {
      setFixing(false);
    }
  };

  const hasRealIssues = report?.issues.some((i) => i.severity !== "ok");

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold mb-1">Diagnostic complet</h1>
          <p className="text-sm text-(--text-muted)">
            Un scan, une réparation, un seul clic.
          </p>
        </div>
        <button
          onClick={scan}
          disabled={scanning}
          className="flex items-center gap-2 bg-(--accent) text-white text-sm font-semibold px-4 py-2 rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          <Stethoscope size={16} />
          {scanning ? "Analyse en cours..." : "Scanner mon PC"}
        </button>
      </div>

      {fixResult && (
        <div className="flex items-center gap-2 bg-[rgba(34,197,94,0.12)] border border-(--ok) text-(--ok) rounded-xl px-4 py-3 mb-6 text-sm font-medium">
          <CheckCircle2 size={18} />
          Réparation terminée : {fixResult.closed_apps.length} application(s)
          fermée(s) ({fixResult.freed_ram_mb.toFixed(0)} Mo de RAM),{" "}
          {fixResult.freed_disk_mb.toFixed(0)} Mo de disque libérés.
        </div>
      )}

      {!report && !scanning && (
        <div className="bg-(--bg-card) border border-(--border) rounded-2xl p-10 shadow-lg text-center text-(--text-muted)">
          Clique sur "Scanner mon PC" pour lancer une analyse complète (CPU,
          RAM, disque, fichiers temporaires, applications gourmandes).
        </div>
      )}

      {report && (
        <>
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-(--bg-card) border border-(--border) rounded-2xl p-4 text-center">
              <div className="text-xs text-(--text-muted) mb-1">CPU</div>
              <div className="text-xl font-bold">
                {report.cpu_usage.toFixed(0)}%
              </div>
            </div>
            <div className="bg-(--bg-card) border border-(--border) rounded-2xl p-4 text-center">
              <div className="text-xs text-(--text-muted) mb-1">RAM</div>
              <div className="text-xl font-bold">
                {report.ram_percent.toFixed(0)}%
              </div>
            </div>
            <div className="bg-(--bg-card) border border-(--border) rounded-2xl p-4 text-center">
              <div className="text-xs text-(--text-muted) mb-1">Disque</div>
              <div className="text-xl font-bold">
                {report.disk_percent.toFixed(0)}%
              </div>
            </div>
          </div>

          <div className="bg-(--bg-card) border border-(--border) rounded-2xl p-5 shadow-lg mb-6">
            <div className="flex flex-col gap-3">
              {report.issues.map((issue, i) => {
                const style = severityStyle(issue.severity);
                return (
                  <div
                    key={i}
                    className={`flex items-start gap-3 border ${style.border} ${style.bg} rounded-xl px-4 py-3`}
                  >
                    <div className={style.color}>{style.icon}</div>
                    <div>
                      <div className={`text-sm font-semibold ${style.color}`}>
                        {issue.title}
                      </div>
                      <div className="text-sm text-(--text-muted)">
                        {issue.detail}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {hasRealIssues && (
            <button
              onClick={fixAll}
              disabled={fixing}
              className="w-full flex items-center justify-center gap-2 bg-(--danger) text-white text-sm font-semibold px-4 py-3 rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              <Wrench size={16} />
              {fixing ? "Réparation en cours..." : "Tout réparer en un clic"}
            </button>
          )}
        </>
      )}
    </div>
  );
}
