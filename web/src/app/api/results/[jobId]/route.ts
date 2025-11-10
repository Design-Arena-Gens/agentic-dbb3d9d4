import { promises as fs } from "fs";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import mime from "mime-types";

export async function GET(req: NextRequest, context: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await context.params;
  const parsedUrl = new URL(req.url);
  const relativePath = parsedUrl.searchParams.get("path");

  if (!relativePath) {
    return NextResponse.json({ error: "Не указан путь к файлу." }, { status: 400 });
  }

  const safeRelative = relativePath.replace(/\0/g, "");
  if (safeRelative.includes("..")) {
    return NextResponse.json({ error: "Недопустимый путь." }, { status: 400 });
  }

  const baseDir = path.resolve(process.cwd(), "storage", jobId, "output");
  const filePath = path.resolve(baseDir, safeRelative);

  if (!(filePath === baseDir || filePath.startsWith(baseDir + path.sep))) {
    return NextResponse.json({ error: "Выход за пределы рабочей директории запрещен." }, { status: 400 });
  }

  try {
    const fileBuffer = await fs.readFile(filePath);
    const contentType = mime.lookup(filePath) || "application/octet-stream";
    const fileName = path.basename(filePath);

    return new NextResponse(fileBuffer, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `inline; filename="${encodeURIComponent(fileName)}"`,
      },
    });
  } catch (error) {
    return NextResponse.json({ error: "Файл не найден.", details: `${error}` }, { status: 404 });
  }
}
