"use client";

import { useCallback, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import TrackCard from "@/components/TrackCard";
import { ProcessResponse, TrackResult } from "@/types";

const formSchema = z
  .object({
    sourceType: z.enum(["upload", "youtube"]),
    youtubeUrl: z.string().optional(),
    file: z.any().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.sourceType === "youtube") {
      if (!data.youtubeUrl) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Укажите ссылку на видео.",
          path: ["youtubeUrl"],
        });
        return;
      }
      try {
        const parsed = new URL(data.youtubeUrl);
        if (!parsed.hostname.includes("youtube.com") && !parsed.hostname.includes("youtu.be")) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Введите корректный URL YouTube.",
            path: ["youtubeUrl"],
          });
        }
      } catch {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Введите корректный URL YouTube.",
          path: ["youtubeUrl"],
        });
      }
    } else if (!(data.file instanceof File)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Необходимо выбрать аудиофайл.",
        path: ["file"],
      });
    }
  });

type FormValues = z.infer<typeof formSchema>;

const initialValues: FormValues = {
  sourceType: "upload",
  youtubeUrl: undefined,
  file: undefined,
};

export default function Page() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ProcessResponse | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: initialValues,
  });

  const sourceType = watch("sourceType");

  const onSubmit = useCallback(
    async (values: FormValues) => {
      try {
        setIsProcessing(true);
        setError(null);
        setResult(null);

        const formData = new FormData();
        formData.append("sourceType", values.sourceType);

        if (values.sourceType === "youtube") {
          const urlValue = values.youtubeUrl?.trim() ?? "";
          formData.append("youtubeUrl", urlValue);
        } else if (values.file instanceof File) {
          formData.append("file", values.file);
        }

        const response = await fetch("/api/process", {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          const payload = await response.json().catch(() => null);
          throw new Error(payload?.error ?? "Ошибка при обработке.");
        }

        const payload: ProcessResponse = await response.json();
        setResult(payload);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Неизвестная ошибка.");
      } finally {
        setIsProcessing(false);
      }
    },
    []
  );

  const trackCount = useMemo(() => result?.tracks.length ?? 0, [result]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 pb-20 pt-16 sm:px-6 lg:px-8">
        <header className="space-y-4 text-center sm:text-left">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-400">
            Анализатор аудио
          </p>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Мультитрековая расшифровка</h1>
          <p className="max-w-2xl text-base text-slate-300">
            Загружайте MP3-файлы или указывайте ссылки на YouTube: сервис автоматически разделит аудио на
            дорожки, создаст ноты, MusicXML и MIDI, а также сформирует готовый PDF.
          </p>
        </header>

        <section className="rounded-3xl border border-white/10 bg-white/5 p-8 backdrop-blur">
          <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => {
                  setValue("sourceType", "upload");
                  setValue("youtubeUrl", undefined, { shouldValidate: true });
                }}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                  sourceType === "upload"
                    ? "bg-white text-slate-900 shadow-lg shadow-white/20"
                    : "bg-white/10 text-white hover:bg-white/20"
                }`}
              >
                Загрузка файла
              </button>
              <button
                type="button"
                onClick={() => {
                  setValue("sourceType", "youtube");
                  setValue("file", undefined, { shouldValidate: true });
                }}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                  sourceType === "youtube"
                    ? "bg-white text-slate-900 shadow-lg shadow-white/20"
                    : "bg-white/10 text-white hover:bg-white/20"
                }`}
              >
                Ссылка на YouTube
              </button>
              <button
                type="button"
                onClick={() => {
                  reset(initialValues);
                  setResult(null);
                  setError(null);
                }}
                className="rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/20"
              >
                Очистить
              </button>
            </div>

            {sourceType === "upload" ? (
              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-200">MP3 / WAV файл</label>
                <input
                  type="file"
                  accept="audio/*"
                  {...register("file")}
                  className="w-full rounded-xl border border-white/20 bg-white/10 p-3 text-sm text-white file:mr-3 file:cursor-pointer file:rounded-lg file:border-0 file:bg-white file:px-4 file:py-2 file:text-sm file:font-semibold file:text-slate-900"
                  onChange={(event) => {
                    const selected = event.target.files?.[0];
                    setValue("file", selected ?? undefined, {
                      shouldValidate: true,
                      shouldDirty: true,
                    });
                  }}
                />
                {typeof errors.file?.message === "string" && (
                  <p className="text-sm text-rose-400">{errors.file.message}</p>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-200">Ссылка на YouTube</label>
                <input
                  type="url"
                  placeholder="https://www.youtube.com/watch?v=..."
                  {...register("youtubeUrl")}
                  className="w-full rounded-xl border border-white/20 bg-white/10 p-3 text-sm text-white placeholder:text-white/40 focus:border-white focus:outline-none focus:ring-2 focus:ring-white/40"
                />
                {typeof errors.youtubeUrl?.message === "string" && (
                  <p className="text-sm text-rose-400">{errors.youtubeUrl.message}</p>
                )}
              </div>
            )}

            <button
              type="submit"
              disabled={isProcessing}
              className="inline-flex items-center gap-2 rounded-full bg-emerald-400 px-6 py-3 text-sm font-semibold text-slate-950 hover:bg-emerald-300 disabled:cursor-wait disabled:bg-emerald-500/70"
            >
              {isProcessing ? "Обработка..." : "Запустить анализ"}
            </button>
          </form>
          {error && (
            <p className="mt-4 rounded-xl bg-rose-500/10 p-4 text-sm text-rose-200">
              {error}
            </p>
          )}
          {result && (
            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white/10 p-4 text-sm text-white/80">
              <p>
                Готово! Сформировано дорожек:{" "}
                <span className="font-semibold text-white">{trackCount}</span>
              </p>
              <div className="flex flex-wrap gap-3">
                <a
                  href={result.archive}
                  className="rounded-full bg-white px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-900 hover:bg-slate-100"
                >
                  Скачать все результаты (ZIP)
                </a>
              </div>
            </div>
          )}
        </section>

        {result && (
          <div className="space-y-6">
            {result.tracks.map((track: TrackResult) => (
              <TrackCard key={track.id} track={track} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
