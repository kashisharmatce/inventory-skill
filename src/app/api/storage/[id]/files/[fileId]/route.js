import { NextResponse } from "next/server";
import { handle, json } from "@/lib/http";
import { requireAdmin } from "@/lib/auth";
import { deleteFile, getFileContent } from "@/services/productFile.service";
import { isImageType, isPdfType } from "@/lib/attachments";

export const dynamic = "force-dynamic";

// GET /api/storage/:id/files/:fileId  -> the file itself (images / PDFs open in the browser, others download)
export const GET = handle(async (request, { params }) => {
  const { supabase } = await requireAdmin();
  const { id, fileId } = await params;
  const { fileName, mimeType, buffer } = await getFileContent(supabase, id, fileId);

  const inline = (isImageType(mimeType) || isPdfType(mimeType)) && new URL(request.url).searchParams.get("download") !== "1";
  const encoded = encodeURIComponent(fileName);

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type": mimeType,
      "Content-Length": String(buffer.length),
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${encoded}"; filename*=UTF-8''${encoded}`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, max-age=300",
    },
  });
});

// DELETE /api/storage/:id/files/:fileId
export const DELETE = handle(async (_request, { params }) => {
  const { supabase } = await requireAdmin();
  const { id, fileId } = await params;
  await deleteFile(supabase, id, fileId);
  return json({ status: true, message: "File deleted successfully" });
});
