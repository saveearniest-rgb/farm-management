import { NextResponse } from "next/server";
import { getAppContext } from "@/lib/auth";
import { newStorageKey, removePrivateFile, storePrivateFile } from "@/lib/local-file-storage";
import { tenantDb } from "@/lib/tenant-db";

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);

function hasValidSignature(type: string, bytes: Uint8Array) {
  if (type === "image/jpeg") return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (type === "image/png") return Array.from(bytes.subarray(0, 8)).join(",") === "137,80,78,71,13,10,26,10";
  if (type === "image/webp") return String.fromCharCode(...bytes.subarray(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.subarray(8, 12)) === "WEBP";
  if (type === "application/pdf") return String.fromCharCode(...bytes.subarray(0, 5)) === "%PDF-";
  return false;
}

export async function POST(request: Request) {
  const context = await getAppContext();
  if (!context) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const form = await request.formData();
  const file = form.get("file");
  const recordType = form.get("recordType");
  const recordId = form.get("recordId");
  if (!(file instanceof File) || typeof recordId !== "string" || !recordId ||
      typeof recordType !== "string" || !["holding", "plot", "cropType", "cycle", "task"].includes(recordType)) {
    return NextResponse.json({ error: "Choose a file and a valid farm record." }, { status: 400 });
  }
  if (file.size < 1 || file.size > MAX_FILE_SIZE || !allowedTypes.has(file.type)) {
    return NextResponse.json({ error: "Files must be JPEG, PNG, WebP or PDF and no larger than 10 MB." }, { status: 400 });
  }

  const db = tenantDb(context.farm.id, context.user.id);
  const record = recordType === "holding"
    ? await db.landHolding.findFirst({ where: { id: recordId, farmId: context.farm.id }, select: { id: true } })
    : recordType === "plot"
      ? await db.plot.findFirst({ where: { id: recordId, farmId: context.farm.id }, select: { id: true } })
      : recordType === "cropType"
        ? await db.cropType.findFirst({ where: { id: recordId, farmId: context.farm.id }, select: { id: true } })
        : recordType === "cycle"
          ? await db.cropCycle.findFirst({ where: { id: recordId, farmId: context.farm.id }, select: { id: true } })
          : await db.task.findFirst({ where: { id: recordId, farmId: context.farm.id }, select: { id: true } });
  if (!record) return NextResponse.json({ error: "Record not found in this farm." }, { status: 404 });

  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!hasValidSignature(file.type, bytes)) {
    return NextResponse.json({ error: "The file content does not match its declared type." }, { status: 400 });
  }
  const storageKey = newStorageKey();
  await storePrivateFile(storageKey, bytes);
  try {
    const attachment = await db.fileAttachment.create({
      data: {
        farmId: context.farm.id,
        landHoldingId: recordType === "holding" ? recordId : null,
        plotId: recordType === "plot" ? recordId : null,
        cropTypeId: recordType === "cropType" ? recordId : null,
        cycleId: recordType === "cycle" ? recordId : null,
        taskId: recordType === "task" ? recordId : null,
        filename: file.name.replace(/[^\p{L}\p{N}._ -]/gu, "_").slice(0, 180) || "attachment",
        storageKey,
        mimeType: file.type,
        sizeBytes: file.size,
        createdById: context.user.id,
      },
      select: { id: true, filename: true, mimeType: true, sizeBytes: true, createdAt: true },
    });
    return NextResponse.json(attachment, { status: 201 });
  } catch (error) {
    await removePrivateFile(storageKey);
    throw error;
  }
}
