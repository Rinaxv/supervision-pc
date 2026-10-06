import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import {
  DownloadCloud,
  HardDrive,
  Clock,
  CalendarClock,
  AlertTriangle,
  RefreshCw,
  Play,
  Pause,
  PlayCircle,
  CheckCircle2,
} from "lucide-react";
import type { WindowsUpdateReport, InstallUpdatesResult } from "../types";

function formatMinutes(min: number) {
  if (min < 1) return "< 1 min";
  if (min < 60) return `${Math.round(min)} min`;
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return `${h} h ${m} min`;
}

export default function WindowsUpdate() {
  const [report, setReport] = useState<WindowsUpdateReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [installResult, setInstallResult] =
    useState<InstallUpdatesResult | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [bgActive, setBgActive] = useState<string[]>([]);
  const [wuStatus, setWuStatus] = useState<"active" | "paused">("active");
  const [pauseHours, setPauseHours] = useState(24);
  const [pausing, setPausing] = useState(false);

  const loadStatus = async () => {
    const status = await invoke<string>("get_wu_service_status");
    setWuStatus(status === "paused" ? "paused" : "active");
  };

  useEffect(() => {
    loadStatus();
    const unlisten = listen<string[]>("wu-background-activity", (e) =>
      setBgActive(e.payload),
    );
    return () => {
      unlisten.then((f) => f());
    };
  }, []);

  const analyze = async () => {
    setLoading(true);
    setInstallResult(null);
    try {
      const result = await invoke<WindowsUpdateReport>(
        "get_windows_update_report",
      );
      setReport(result);
    } finally {
      setLoading(false);
    }
  };

  const installNow = async () => {
    setInstalling(true);
    setActionError(null);
    setInstallResult(null);
    try {
      const result = await invoke<InstallUpdatesResult>(
        "install_windows_updates",
      );
      if (result.success) {
        setInstallResult(result);
        analyze();
      } else {
        setActionError(result.message);
      }
    } catch (e) {
      setActionError(String(e));
    } finally {
      setInstalling(false);
    }
  };

  const pauseNow = async () => {
    setPausing(true);
    setActionError(null);
    setActionMessage(null);
    try {
      const msg = await invoke<string>("pause_windows_updates", {
        hours: pauseHours,
      });
      setActionMessage(msg);
      loadStatus();
    } catch (e) {
      setActionError(String(e));
    } finally {
      setPausing(false);
    }
  };

  const resumeNow = async () => {
    setPausing(true);
    setActionError(null);
    setActionMessage(null);
    try {
      const msg = await invoke<string>("resume_windows_updates");
      setActionMessage(msg);
      loadStatus();
    } catch (e) {
      setActionError(String(e));
    } finally {
      setPausing(false);
    }
  };

  const daysLate = report ? report.days_since_last_update : -1;
  const isLate = daysLate >= 30;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold mb-1">Mises à jour Windows</h1>
          <p className="text-sm text-(--text-muted)">
            Taille, durée estimée, installation et pause des mises à jour.
          </p>
        </div>
        <button
          onClick={analyze}
          disabled={loading}
          className="flex items-center gap-2 bg-(--accent) text-white text-sm font-semibold px-4 py-2 rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          {loading
            ? "Analyse en cours (jusqu'à 30s)..."
            : "Analyser les mises à jour"}
        </button>
      </div>

      {actionError && (
        <div className="flex items-center gap-2 bg-(--alert-bg) border border-(--danger) text-(--danger) rounded-xl px-4 py-3 mb-5 text-sm font-medium">
          <AlertTriangle size={18} />
          {actionError}
        </div>
      )}

      {actionMessage && (
        <div className="flex items-center gap-2 bg-[rgba(34,197,94,0.12)] border border-(--ok) text-(--ok) rounded-xl px-4 py-3 mb-5 text-sm font-medium">
          <CheckCircle2 size={18} />
          {actionMessage}
        </div>
      )}

      {installResult && (
        <div className="flex items-center gap-2 bg-[rgba(34,197,94,0.12)] border border-(--ok) text-(--ok) rounded-xl px-4 py-3 mb-5 text-sm font-medium">
          <CheckCircle2 size={18} />
          {installResult.message}
          {installResult.installed_count > 0 &&
            ` (${installResult.installed_count} installée(s))`}
          {installResult.reboot_required &&
            " — redémarrage requis pour finaliser."}
        </div>
      )}

      {bgActive.length > 0 && (
        <div className="flex items-center gap-2 bg-(--alert-bg) border border-(--danger) text-(--danger) rounded-xl px-4 py-3 mb-6 text-sm font-medium">
          <AlertTriangle size={18} />
          Windows Update tourne actuellement en arrière-plan (
          {bgActive.join(", ")}) — c'est probablement la cause d'un
          ralentissement réseau.
        </div>
      )}

      <div className="bg-(--bg-card) border border-(--border) rounded-2xl p-5 shadow-lg mb-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-(--text-muted)">
              Statut du service :
            </span>
            <span
              className={`text-xs font-semibold px-2 py-1 rounded-md ${wuStatus === "paused" ? "bg-(--warn)/15 text-(--warn)" : "bg-(--ok)/15 text-(--ok)"}`}
            >
              {wuStatus === "paused" ? "En pause" : "Actif"}
            </span>
          </div>
          {wuStatus === "paused" ? (
            <button
              onClick={resumeNow}
              disabled={pausing}
              className="flex items-center gap-2 bg-(--ok) text-white text-sm font-semibold px-4 py-2 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              <PlayCircle size={16} />
              Réactiver maintenant
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                value={pauseHours}
                onChange={(e) => setPauseHours(Number(e.target.value))}
                className="w-20 bg-(--bg-main) border border-(--border) rounded-lg px-3 py-2 text-sm outline-none text-(--text-main)"
              />
              <span className="text-xs text-(--text-muted)">heures</span>
              <button
                onClick={pauseNow}
                disabled={pausing}
                className="flex items-center gap-2 bg-(--warn) text-white text-sm font-semibold px-4 py-2 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                <Pause size={16} />
                Mettre en pause
              </button>
            </div>
          )}
        </div>
        <p className="text-xs text-(--text-muted) mt-3">
          Nécessite les droits administrateur. La réactivation se fait
          automatiquement après la durée choisie, ou manuellement à tout moment.
        </p>
      </div>

      {!report && !loading && (
        <div className="bg-(--bg-card) border border-(--border) rounded-2xl p-10 shadow-lg text-center text-(--text-muted)">
          Clique sur "Analyser les mises à jour" pour interroger Windows Update
          (peut prendre jusqu'à 30 secondes).
        </div>
      )}

      {report && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-5 mb-6">
            <div className="bg-(--bg-card) border border-(--border) rounded-2xl p-5 shadow-lg">
              <div className="flex items-center gap-2 text-(--text-muted) mb-2">
                <HardDrive size={18} />
                <span className="text-sm font-medium">Taille totale</span>
              </div>
              <div className="text-3xl font-bold">
                {report.total_size_gb.toFixed(2)} Go
              </div>
            </div>
            <div className="bg-(--bg-card) border border-(--border) rounded-2xl p-5 shadow-lg">
              <div className="flex items-center gap-2 text-(--text-muted) mb-2">
                <DownloadCloud size={18} />
                <span className="text-sm font-medium">
                  Téléchargement estimé
                </span>
              </div>
              <div className="text-3xl font-bold">
                {formatMinutes(report.estimated_download_minutes)}
              </div>
            </div>
            <div className="bg-(--bg-card) border border-(--border) rounded-2xl p-5 shadow-lg">
              <div className="flex items-center gap-2 text-(--text-muted) mb-2">
                <Clock size={18} />
                <span className="text-sm font-medium">
                  Installation estimée
                </span>
              </div>
              <div className="text-3xl font-bold">
                {formatMinutes(report.estimated_install_minutes)}
              </div>
            </div>
            <div
              className={`bg-(--bg-card) border rounded-2xl p-5 shadow-lg ${isLate ? "border-(--warn)" : "border-(--border)"}`}
            >
              <div className="flex items-center gap-2 text-(--text-muted) mb-2">
                <CalendarClock size={18} />
                <span className="text-sm font-medium">
                  Dernière mise à jour
                </span>
              </div>
              <div
                className={`text-2xl font-bold ${isLate ? "text-(--warn)" : ""}`}
              >
                {daysLate >= 0 ? `Il y a ${daysLate} j` : "Inconnue"}
              </div>
              {report.last_install_date && (
                <div className="text-xs text-(--text-muted) mt-1">
                  {report.last_install_date}
                </div>
              )}
            </div>
          </div>

          {report.pending.length > 0 && (
            <button
              onClick={installNow}
              disabled={installing}
              className="w-full flex items-center justify-center gap-2 bg-(--accent) text-white text-sm font-semibold px-4 py-3 rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50 mb-6"
            >
              <Play size={16} />
              {installing
                ? "Téléchargement et installation en cours (plusieurs minutes)..."
                : "Télécharger et installer maintenant"}
            </button>
          )}

          <div className="bg-(--bg-card) border border-(--border) rounded-2xl overflow-hidden shadow-lg">
            <div className="flex items-center gap-2 px-5 py-3 border-b border-(--border) text-(--text-muted)">
              <DownloadCloud size={16} />
              <span className="text-sm font-medium">
                {report.pending.length} mise(s) à jour en attente
              </span>
            </div>
            <div className="max-h-96 overflow-y-auto">
              {report.pending.length === 0 && (
                <p className="text-center py-8 text-(--text-muted) text-sm">
                  Aucune mise à jour en attente — le système est à jour.
                </p>
              )}
              {report.pending.map((u, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between px-5 py-3 border-b border-(--border) last:border-0"
                >
                  <span className="text-sm text-(--text-main) truncate max-w-md">
                    {u.title}
                  </span>
                  <span className="text-xs text-(--text-muted) font-semibold shrink-0 ml-3">
                    {(u.size_mb / 1024).toFixed(2)} Go
                  </span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
