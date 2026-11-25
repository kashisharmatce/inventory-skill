// Rules for product attachments (used by the browser for early feedback and by the server to enforce).

export const MAX_FILE_BYTES = 3 * 1024 * 1024; // 3 MB per file (keeps requests within hosting limits)
export const MAX_FILES_PER_PRODUCT = 5;

// extension -> content type served back. Only these are accepted (no HTML / SVG / scripts).
export const ALLOWED_TYPES = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  csv: "text/csv",
  txt: "text/plain",
};

export const ACCEPT_ATTRIBUTE = Object.keys(ALLOWED_TYPES).map((e) => `.${e}`).join(",");

export const extensionOf = (name = "") => {
  const i = String(name).lastIndexOf(".");
  return i < 0 ? "" : String(name).slice(i + 1).toLowerCase();
};

export const isImageType = (mime = "") => /^image\/(png|jpeg|gif|webp)$/.test(mime);
export const isPdfType = (mime = "") => mime === "application/pdf";

export const formatBytes = (n) => {
  const bytes = Number(n) || 0;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

/** Returns an error message for a File/{name,size}, or "" when it is acceptable. */
export function checkFile(file) {
  const ext = extensionOf(file?.name);
  if (!ALLOWED_TYPES[ext]) return `"${file?.name}": this file type is not allowed (use images, PDF, Word, Excel, PowerPoint, CSV or text)`;
  if (!(file.size > 0)) return `"${file.name}" is empty`;
  if (file.size > MAX_FILE_BYTES) return `"${file.name}" is too large (maximum ${formatBytes(MAX_FILE_BYTES)})`;
  return "";
}
