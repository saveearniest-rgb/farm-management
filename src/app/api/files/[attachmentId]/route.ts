import { NextResponse } from "next/server";
import { getAppContext } from "@/lib/auth";
import { readPrivateFile } from "@/lib/local-file-storage";
import { tenantDb } from "@/lib/tenant-db";

export async function GET(
  _request: Request,
  context: RouteContext<"/api/files/[attachmentId]">,
) {
  const session = await getAppContext();
  if (!session) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const { attachmentId } = await context.params;
  const attachment = await tenantDb(session.farm.id, session.user.id).fileAttachment.findFirst({
    where: { id: attachmentId, farmId: session.farm.id },
    select: { storageKey: true, filename: true, mimeType: true },
  });
  if (!attachment) return NextResponse.json({ error: "File not found in this farm." }, { status: 404 });

  const bytes = await readPrivateFile(attachment.storageKey);
  const safeName = attachment.filename.replace(/[\r\n"]/g, "_");
  return new Response(bytes, {
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Disposition": `attachment; filename="${safeName}"`,
      "Content-Length": String(bytes.byteLength),
      "Content-Type": attachment.mimeType,
      "X-Content-Type-Options": "nosniff",
    },
  });
}
