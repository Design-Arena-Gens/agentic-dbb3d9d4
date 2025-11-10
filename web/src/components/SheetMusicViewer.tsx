"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { OpenSheetMusicDisplay } from "opensheetmusicdisplay";

type ExportableOSMD = OpenSheetMusicDisplay & {
  export?: (type: "svg" | "png" | "jpeg" | "pdf") => Promise<Blob>;
};

type Props = {
  musicXmlUrl: string | null;
  trackId: string;
};

export default function SheetMusicViewer({ musicXmlUrl, trackId }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const osmdRef = useRef<OpenSheetMusicDisplay | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setupOsmd = useCallback(async () => {
    if (!musicXmlUrl || !containerRef.current) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [{ OpenSheetMusicDisplay }, response] = await Promise.all([
        import("opensheetmusicdisplay"),
        fetch(musicXmlUrl),
      ]);
      if (!response.ok) {
        throw new Error("Не удалось загрузить MusicXML.");
      }
      const xmlText = await response.text();
      if (!osmdRef.current) {
        osmdRef.current = new OpenSheetMusicDisplay(containerRef.current, {
          autoResize: true,
          drawTitle: false,
        });
      }
      await osmdRef.current.load(xmlText);
      await osmdRef.current.render();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Неизвестная ошибка при отображении нот.");
    } finally {
      setLoading(false);
    }
  }, [musicXmlUrl]);

  useEffect(() => {
    setupOsmd();
  }, [setupOsmd]);

  const handlePdf = async () => {
    if (!osmdRef.current) return;
    try {
      const osmd = osmdRef.current as ExportableOSMD;
      if (typeof osmd.export !== "function") {
        throw new Error("Экспорт PDF недоступен в текущей версии OpenSheetMusicDisplay.");
      }
      const blob: Blob = await osmd.export("pdf");
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = `${trackId}.pdf`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(blobUrl), 1500);
    } catch {
      setError("Не удалось экспортировать PDF.");
    }
  };

  if (!musicXmlUrl) {
    return (
      <div className="rounded-lg border border-dashed border-zinc-300 bg-white/50 p-6 text-sm text-zinc-500">
        Нотная запись недоступна для этой дорожки.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
        <div ref={containerRef} className="osmd-container overflow-x-auto" />
        {loading && <p className="pt-2 text-sm text-zinc-500">Загрузка нот...</p>}
        {error && (
          <p className="pt-2 text-sm text-rose-600">
            {error}
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={handlePdf}
        disabled={!osmdRef.current || loading}
        className="inline-flex items-center justify-center rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white shadow hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400"
      >
        Скачать PDF
      </button>
    </div>
  );
}
