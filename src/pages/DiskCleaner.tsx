import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  HardDriveDownload,
  Image as ImageIcon,
  Film,
  Music,
  File as FileIcon,
  Trash2,
  Copy,
  Clock,
} from "lucide-react";
import type {
  ScanTarget,
  FileEntry,
  DuplicateGroup,
  DeleteFilesResult,
} from "../types";

function fileIcon(type: string) {
  if (type === "image")
    return <ImageIcon size={15} className="text-(--accent)" />;
  if (type === "video") return <Film size={15} className="text-(--upload)" />;
  if (type === "audio") return <Music size={15} className="text-(--ok)" />;
  return <FileIcon size={15} className="text-(--text-muted)" />;
}

export default function DiskCleaner() {
  const [tab, setTab] = useState<"old" | "duplicates">("old");
  const [targets, setTargets] = useState<ScanTarget[]>([]);
  const [selectedTargets, setSelectedTargets] = useState<Set<string>>(
    new Set(),
  );
  const [minSizeMb, setMinSizeMb] = useState(50);
  const [minMonths, setMinMonths] = useState(6);
  const [oldFiles, setOldFiles] = useState<FileEntry[]>([]);
  const [duplicateGroups, setDuplicateGroups] = useState<DuplicateGroup[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [scanning, setScanning] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    invoke<ScanTarget[]>("get_scan_targets").then((list) => {
      setTargets(list);
      setSelectedTargets(new Set(list.map((t) => t.path)));
    });
  }, []);

  const toggleTarget = (path: string) => {
    setSelectedTargets((prev) => {
      const next = new Set(prev);
      next.has(path) ? next.delete(path) : next.add(path);
      return next;
    });
  };

  const toggleFile = (path: string) => {
    setSelectedFiles((prev) => {
      const next = new Set(prev);
      next.has(path) ? next.delete(path) : next.add(path);
      return next;
    });
  };

  const scanOld = async () => {
    setScanning(true);
    setMessage(null);
    setSelectedFiles(new Set());
    try {
      const result = await invoke<FileEntry[]>("scan_old_large_files", {
        paths: Array.from(selectedTargets),
        minSizeMb,
        minDays: minMonths * 30,
      });
      setOldFiles(result);
    } finally {
      setScanning(false);
    }
  };

  const scanDup = async () => {
    setScanning(true);
    setMessage(null);
    setSelectedFiles(new Set());
    try {
      const result = await invoke<DuplicateGroup[]>("scan_duplicates", {
        paths: Array.from(selectedTargets),
      });
      setDuplicateGroups(result);
    } finally {
      setScanning(false);
    }
  };

  const autoSelectDuplicates = () => {
    const toSelect = new Set<string>();
    duplicateGroups.forEach((group) => {
      group.files.slice(1).forEach((f) => toSelect.add(f.path));
    });
    setSelectedFiles(toSelect);
  };

  const deleteSelected = async () => {
    setDeleting(true);
    try {
      const result = await invoke<DeleteFilesResult>("delete_files", {
        paths: Array.from(selectedFiles),
      });
      setSelectedFiles(new Set());
      if (tab === "old") scanOld();
      else scanDup();
      setMessage(
        `${result.deleted} fichier(s) supprimé(s) — ${result.freed_mb.toFixed(0)} Mo libérés.`,
      );
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">Analyse du disque</h1>
      <p className="text-sm text-(--text-muted) mb-6">
        Fichiers volumineux non modifiés depuis longtemps et fichiers en double
        (images, vidéos, audio, documents).
      </p>

      <div className="bg-(--bg-card) border border-(--border) rounded-2xl p-5 shadow-lg mb-6">
        <div className="text-sm font-medium text-(--text-muted) mb-3">
          Dossiers à analyser
        </div>
        <div className="flex flex-wrap gap-2">
          {targets.map((t) => (
            <label
              key={t.path}
              className="flex items-center gap-2 bg-(--bg-main) border border-(--border) rounded-lg px-3 py-1.5 text-sm cursor-pointer"
            >
              <input
                type="checkbox"
                checked={selectedTargets.has(t.path)}
                onChange={() => toggleTarget(t.path)}
                className="accent-(--accent)"
              />
              {t.label}
            </label>
          ))}
        </div>
      </div>

      <div className="flex bg-(--bg-card) border border-(--border) rounded-xl p-1 gap-1 mb-6 w-fit">
        <button
          onClick={() => setTab("old")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === "old" ? "bg-(--accent) text-white" : "text-(--text-muted)"}`}
        >
          Fichiers anciens & volumineux
        </button>
        <button
          onClick={() => setTab("duplicates")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === "duplicates" ? "bg-(--accent) text-white" : "text-(--text-muted)"}`}
        >
          Doublons
        </button>
      </div>

      {message && (
        <div className="bg-[rgba(34,197,94,0.12)] border border-(--ok) text-(--ok) rounded-xl px-4 py-3 mb-5 text-sm font-medium">
          {message}
        </div>
      )}

      {tab === "old" && (
        <>
          <div className="flex flex-wrap items-end gap-4 mb-5">
            <div>
              <div className="text-xs text-(--text-muted) mb-1">
                Taille minimum (Mo)
              </div>
              <input
                type="number"
                value={minSizeMb}
                onChange={(e) => setMinSizeMb(Number(e.target.value))}
                className="w-28 bg-(--bg-card) border border-(--border) rounded-lg px-3 py-2 text-sm outline-none"
              />
            </div>
            <div>
              <div className="text-xs text-(--text-muted) mb-1">
                Non modifié depuis (mois)
              </div>
              <input
                type="number"
                value={minMonths}
                onChange={(e) => setMinMonths(Number(e.target.value))}
                className="w-28 bg-(--bg-card) border border-(--border) rounded-lg px-3 py-2 text-sm outline-none"
              />
            </div>
            <button
              onClick={scanOld}
              disabled={scanning}
              className="flex items-center gap-2 bg-(--accent) text-white text-sm font-semibold px-4 py-2 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              <HardDriveDownload size={16} />
              {scanning ? "Analyse..." : "Analyser"}
            </button>
          </div>

          <div className="bg-(--bg-card) border border-(--border) rounded-2xl overflow-hidden shadow-lg">
            <div className="max-h-105 overflow-y-auto">
              {oldFiles.length === 0 && (
                <p className="text-sm text-(--text-muted) p-5">
                  Aucun résultat pour l'instant — lance une analyse.
                </p>
              )}
              {oldFiles.map((f) => (
                <label
                  key={f.path}
                  className="flex items-center justify-between border-b border-(--border) px-5 py-3 last:border-0 cursor-pointer hover:bg-(--bg-main)"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <input
                      type="checkbox"
                      checked={selectedFiles.has(f.path)}
                      onChange={() => toggleFile(f.path)}
                      className="accent-(--accent)"
                    />
                    {fileIcon(f.file_type)}
                    <div className="min-w-0">
                      <div className="text-sm text-(--text-main) truncate max-w-md">
                        {f.name}
                      </div>
                      <div className="text-xs text-(--text-muted) truncate max-w-md">
                        {f.path}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 shrink-0 text-xs text-(--text-muted)">
                    <span className="flex items-center gap-1">
                      <Clock size={12} /> {f.last_modified}
                    </span>
                    <span className="font-semibold text-(--text-main)">
                      {f.size_mb.toFixed(0)} Mo
                    </span>
                  </div>
                </label>
              ))}
            </div>
          </div>
        </>
      )}

      {tab === "duplicates" && (
        <>
          <div className="flex items-center gap-3 mb-5">
            <button
              onClick={scanDup}
              disabled={scanning}
              className="flex items-center gap-2 bg-(--accent) text-white text-sm font-semibold px-4 py-2 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              <Copy size={16} />
              {scanning ? "Analyse..." : "Rechercher les doublons"}
            </button>
            {duplicateGroups.length > 0 && (
              <button
                onClick={autoSelectDuplicates}
                className="text-sm font-medium text-(--accent) hover:opacity-80"
              >
                Sélectionner automatiquement les doublons (garder 1 exemplaire)
              </button>
            )}
          </div>

          <div className="flex flex-col gap-4">
            {duplicateGroups.length === 0 && (
              <p className="text-sm text-(--text-muted)">
                Aucun doublon trouvé pour l'instant — lance une analyse.
              </p>
            )}
            {duplicateGroups.map((group, i) => (
              <div
                key={i}
                className="bg-(--bg-card) border border-(--border) rounded-2xl p-4 shadow-lg"
              >
                <div className="flex items-center gap-2 text-xs text-(--text-muted) mb-3">
                  {fileIcon(group.file_type)}
                  {group.files.length} copies — {group.size_mb.toFixed(1)} Mo
                  chacune
                </div>
                <div className="flex flex-col gap-2">
                  {group.files.map((f, idx) => (
                    <label
                      key={f.path}
                      className="flex items-center gap-3 text-sm cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selectedFiles.has(f.path)}
                        onChange={() => toggleFile(f.path)}
                        className="accent-(--danger)"
                      />
                      <span
                        className={`truncate ${idx === 0 ? "text-(--ok) font-medium" : "text-(--text-main)"}`}
                      >
                        {f.path}
                      </span>
                      {idx === 0 && (
                        <span className="text-xs text-(--ok) shrink-0">
                          (à garder)
                        </span>
                      )}
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {selectedFiles.size > 0 && (
        <button
          onClick={deleteSelected}
          disabled={deleting}
          className="mt-6 w-full flex items-center justify-center gap-2 bg-(--danger) text-white text-sm font-semibold px-4 py-3 rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          <Trash2 size={16} />
          {deleting
            ? "Suppression..."
            : `Supprimer la sélection (${selectedFiles.size})`}
        </button>
      )}
    </div>
  );
}
