# Мультитрековый анализатор аудио

Веб-приложение на Next.js, которое принимает MP3-файлы или ссылки на YouTube, автоматически разделяет композицию на дорожки (вокал, клавишные, бас, ударные, гитара и остальные инструменты), извлекает ноты, формирует нотный стан и предоставляет загрузку результатов в форматах MIDI, MusicXML, PDF и JSON.

## Возможности

- Загрузка локального файла или анализ по ссылке на YouTube.
- Автоматическое разделение на 5–6 стемов (Spleeter) + выделение гитары с использованием HPSS.
- Распознавание нот с помощью `basic-pitch` и конвертация в MusicXML (`music21`).
- Визуализация нот в браузере через OpenSheetMusicDisplay.
- Выгрузка отдельных треков и объединённого архива (MIDI, MusicXML, JSON, аудио стемы).

## Требования

- Node.js 18+ (Next.js App Router).
- Python 3.9+ с установленными системными зависимостями для `spleeter`, `librosa`, `tensorflow`.
- `ffmpeg` (рекомендуется) для корректной работы `spleeter`.

## Установка

```bash
npm install
python3 -m venv .venv
source .venv/bin/activate
pip install -r python/requirements.txt
```

## Запуск разработки

```bash
npm run dev
```

После запуска приложение будет доступно на `http://localhost:3000`.

## Сборка и запуск

```bash
npm run build
npm start
```

## Окружение

- `PYTHON_PATH` — (опционально) путь к Python-интерпретатору для серверного скрипта (`python/process_audio.py`).

## Структура проекта

- `src/app/page.tsx` — основная страница с формой загрузки и отображением результатов.
- `src/app/api/process/route.ts` — API-обработчик загрузки и вызова Python-скрипта.
- `src/app/api/results/[jobId]/route.ts` — выдача файлов результатов.
- `python/process_audio.py` — скрипт, который вызывает Spleeter, Basic-Pitch и Music21.
- `storage/` — временное хранилище с результатами выполнения (игнорируется в Git).

## Развёртывание на Vercel

1. Убедитесь, что зависимости собраны (`npm run build`).
2. Приложение ожидает наличие Python-окружения и модели Spleeter на сервере.
3. Используйте команду:

```bash
vercel deploy --prod --yes --token $VERCEL_TOKEN --name agentic-dbb3d9d4
```

После успешного деплоя проверьте результат:

```bash
curl https://agentic-dbb3d9d4.vercel.app
```

Если требуется, повторите проверку до 3 раз с ожиданием 5–10 секунд между попытками.
