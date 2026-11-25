import { handle, json } from "@/lib/http";
import { requireAdmin } from "@/lib/auth";
import { ApiError } from "@/lib/errors";
import { addFile, listFiles } from "@/services/productFile.service";

export const dynamic = "force-dynamic";

// GET /api/storage/:id/files   -> attachment list (no file contents)
export const GET = handle(async (_request, { params }) => {
  const { supabase } = await requireAdmin();
  const { id } = await params;
  return json({ status: true, data: await listFiles(supabase, id) });
});

// POST /api/storage/:id/files  (multipart/form-data, field "file", one file per request)
export const POST = handle(async (request, { params }) => {
  const { supabase } = await requireAdmin();
  const { id } = await params;

  let form;
  try {
    form = await request.formData();
  } catch {
    throw new ApiError(400, "Upload could not be read (is the file too large?)");
  }
  const data = await addFile(supabase, id, form.get("file"));
  return json({ status: true, message: "File uploaded successfully", data }, 201);
});
