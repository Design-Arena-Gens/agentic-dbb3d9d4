"use client";

import { useState } from "react";
import SheetMusicViewer from "./SheetMusicViewer";
import { NoteEvent, TrackResult } from "@/types";

type Props = {
  track: TrackResult;
};

const formatDuration = (seconds: number) => `${seconds.toFixed(2)} c`;

const formatVelocity = (velocity: number) => velocity.toFixed(3);

function NotesTable({ notes }: { notes: NoteEvent[] }) {
  const [expanded, setExpanded] = useState(false);
  const maxVisible = expanded ? notes.length : Math.min(12, notes.length);
  const visible = notes.slice(0, maxVisible);

  if (notes.length === 0) {
    return <p className="text-sm text-zinc-500">Ноты не распознаны.</p>;
  }

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto rounded-md border border-zinc-200">
        <table className="min-w-full divide-y divide-zinc-200 text-sm">
          <thead className="bg-zinc-50">
            <tr>
              <th className="px-3 py-2 text-left font-medium text-zinc-600">Старт</th>
              <th className="px-3 py-2 text-left font-medium text-zinc-600">Длительность</th>
              <th className="px-3 py-2 text-left font-medium text-zinc-600">Нота</th>
              <th className="px-3 py-2 text-left font-medium text-zinc-600">Velocity</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {visible.map((note, idx) => (
              <tr key={`${note.start}-${idx}`} className="even:bg-zinc-50/50">
                <td className="px-3 py-1.5 text-zinc-700">{note.start.toFixed(3)} c</td>
                <td className="px-3 py-1.5 text-zinc-700">{formatDuration(note.duration)}</td>
                <td className="px-3 py-1.5 text-zinc-700">{note.pitchName} ({note.pitchMidi})</td>
                <td className="px-3 py-1.5 text-zinc-700">{formatVelocity(note.velocity)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {notes.length > 12 && (
        <button
          type="button"
          className="text-sm font-medium text-slate-700 hover:text-slate-900"
          onClick={() => setExpanded((prev) => !prev)}
        >
          {expanded ? "Скрыть" : `Показать ещё ${notes.length - 12}`}
        </button>
      )}
    </div>
  );
}

export default function TrackCard({ track }: Props) {
  return (
    <section className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">{track.label}</h2>
          {track.status && <p className="text-sm text-amber-600">{track.status}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          {track.midi && (
            <a
              href={track.midi}
              download={`${track.id}.mid`}
              className="rounded-md border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Скачать MIDI
            </a>
          )}
          {track.musicxml && (
            <a
              href={track.musicxml}
              download={`${track.id}.musicxml`}
              className="rounded-md border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Скачать MusicXML
            </a>
          )}
          {track.notes && (
            <a
              href={track.notes}
              download={`${track.id}.json`}
              className="rounded-md border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Скачать ноты (JSON)
            </a>
          )}
        </div>
      </header>

      {track.audio ? (
        <audio controls src={track.audio} className="w-full">
          Ваш браузер не поддерживает воспроизведение аудио.
        </audio>
      ) : (
        <p className="text-sm text-zinc-600">Аудио-дорожка недоступна.</p>
      )}

      <div>
        <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-zinc-500">
          Нотная запись
        </h3>
        <SheetMusicViewer musicXmlUrl={track.musicxml} trackId={track.id} />
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-zinc-500">
          Последовательность нот
        </h3>
        <NotesTable notes={track.noteEvents ?? []} />
      </div>
    </section>
  );
}
