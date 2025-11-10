import { randomUUID } from "crypto";
import { promises as fs } from "fs";
import { createWriteStream } from "fs";
import { NextRequest, NextResponse } from "next/server";
import path from "path";
import { spawn } from "child_process";
import ytdl from "ytdl-core";
import AdmZip from "adm-zip";

export const maxDuration = 300;

type ProcessResult = {
  jobId: string;
  tracks: Array<{
    id: string;
    label: string;
    audio: string | null;
    midi: string | null;
    musicxml: string | null;
    notes: string | null;
    noteEvents?: Array<{
      start: number;
      duration: number;
      pitchMidi: number;
      pitchName: string;
      velocity: number;
    }>;
    status?: string;
  }>;
};

async function writeUploadToDisk(file: File, targetPath: string) {
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  await fs.writeFile(targetPath, buffer);
}

async function downloadYoutubeAudio(url: string, targetPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const stream = ytdl(url, {
      filter: "audioonly",
      quality: "highestaudio",
      highWaterMark: 1 << 25,
    });
    const writable = createWriteStream(targetPath);
    stream.on("error", reject);
    writable.on("error", reject);
    writable.on("finish", resolve);
    stream.pipe(writable);
  });
}

async function runPythonProcess(args: string[], cwd: string): Promise<string> {
  const pythonExecutable = process.env.PYTHON_PATH || "python3";
  return new Promise((resolve, reject) => {
    const proc = spawn(pythonExecutable, args, { cwd });
    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", (data) => {
      stdout += data.toString();
    });
    proc.stderr.on("data", (data) => {
      stderr += data.toString();
    });
    proc.on("close", (code) => {
      if (code === 0) {
        resolve(stdout.trim());
      } else {
        reject(new Error(`Python process failed (${code}): ${stderr || stdout}`));
      }
    });
  });
}

function serializeTracks(jobId: string, payload: ProcessResult): ProcessResult {
  const baseUrl = `/api/results/${jobId}`;
  return {
    jobId: payload.jobId,
    tracks: payload.tracks.map((track) => {
      const mapPath = (relative: string | null) => {
        if (!relative) return null;
        const encoded = encodeURIComponent(relative);
        return `${baseUrl}?path=${encoded}`;
      };

      return {
        ...track,
        audio: mapPath(track.audio),
        midi: mapPath(track.midi),
        musicxml: mapPath(track.musicxml),
        notes: mapPath(track.notes),
      };
    }),
  };
}

function zipOutputDirectory(outputDir: string, archivePath: string): void {
  const zip = new AdmZip();
  zip.addLocalFolder(outputDir);
  zip.writeZip(archivePath);
}

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const sourceType = (form.get("sourceType") as string | null) ?? "upload";
  const youtubeUrl = form.get("youtubeUrl") as string | null;
  const file = form.get("file") as File | null;

  if (sourceType === "youtube") {
    if (!youtubeUrl || !ytdl.validateURL(youtubeUrl)) {
      return NextResponse.json({ error: "Некорректная ссылка на YouTube." }, { status: 400 });
    }
  } else if (!file) {
    return NextResponse.json({ error: "Необходимо загрузить аудиофайл." }, { status: 400 });
  }

  const jobId = randomUUID();
  const workspaceRoot = path.join(process.cwd(), "storage", jobId);
  const inputDir = path.join(workspaceRoot, "input");
  const outputDir = path.join(workspaceRoot, "output");

  await fs.mkdir(inputDir, { recursive: true });
  await fs.mkdir(outputDir, { recursive: true });

  const inputPath = path.join(inputDir, sourceType === "youtube" ? "source.mp3" : file?.name ?? "source.mp3");

  try {
    if (sourceType === "youtube" && youtubeUrl) {
      await downloadYoutubeAudio(youtubeUrl, inputPath);
    } else if (file) {
      await writeUploadToDisk(file, inputPath);
    }

    const scriptPath = path.join(process.cwd(), "python", "process_audio.py");
    const args = [
      scriptPath,
      "--input",
      inputPath,
      "--output",
      outputDir,
      "--job-id",
      jobId,
    ];

    const rawOutput = await runPythonProcess(args, process.cwd());
    const parsed: ProcessResult = JSON.parse(rawOutput);
    const responsePayload = serializeTracks(jobId, parsed);

    const archivePath = path.join(outputDir, "results.zip");
    zipOutputDirectory(outputDir, archivePath);

    return NextResponse.json({
      jobId,
      tracks: responsePayload.tracks,
      archive: `/api/results/${jobId}?path=${encodeURIComponent("results.zip")}`,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Ошибка обработки аудио.", details: `${error}` }, { status: 500 });
  }
}
