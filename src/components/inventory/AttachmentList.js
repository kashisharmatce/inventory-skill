"use client";

import { useEffect, useState } from "react";
import { LuDownload, LuFileText, LuTrash2 } from "react-icons/lu";
import { api } from "@/lib/api";
import { formatBytes, isImageType, isPdfType } from "@/lib/attachments";

/**
 * Attachments of one product: image thumbnails and file links. `refreshKey` re-loads the list.
 * Pass onDelete(file) to show a remove button (edit mode); omit it for a read-only list.
 */
export default function AttachmentList({ productId, refreshKey = 0, onDelete, onLoaded }) {
  const [files, setFiles] = useState(null); // null = loading
  const [error, setError] = useState("");

  useEffect(() => {
    if (!productId) return;
    let active = true;
    setFiles(null);
    setError("");
    api(`/storage/${productId}/files`)
      .then((res) => {
        if (!active) return;
        setFiles(res.data);
        onLoaded?.(res.data);
      })
      .catch((e) => {
        if (!active) return;
        setError(e.message);
        setFiles([]);
        onLoaded?.([]);
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId, refreshKey]);

  if (files === null) return <div className="attachment-empty">Loading attachments...</div>;
  if (error) return <div className="attachment-empty text-danger">{error}</div>;
  if (files.length === 0) return <div className="attachment-empty">No attachments</div>;

  return (
    <ul className="attachment-list">
      {files.map((f) => {
        const url = `/api/storage/${productId}/files/${f.id}`;
        const image = isImageType(f.mimeType);
        return (
          <li key={f.id} className="attachment-item">
            <a href={url} target="_blank" rel="noopener noreferrer" className="attachment-item__preview" title={`Open ${f.fileName}`}>
              {image ? <img src={url} alt={f.fileName} loading="lazy" /> : <LuFileText size={28} aria-hidden="true" />}
              {isPdfType(f.mimeType) && <span className="attachment-item__tag">PDF</span>}
            </a>
            <div className="attachment-item__info">
              <a href={url} target="_blank" rel="noopener noreferrer" className="attachment-item__name" title={f.fileName}>
                {f.fileName}
              </a>
              <span className="attachment-item__size">{formatBytes(f.sizeBytes)}</span>
            </div>
            <a href={`${url}?download=1`} className="attachment-item__action" aria-label={`Download ${f.fileName}`} title="Download">
              <LuDownload />
            </a>
            {onDelete && (
              <button
                type="button"
                className="attachment-item__action attachment-item__action--danger"
                onClick={() => onDelete(f)}
                aria-label={`Delete ${f.fileName}`}
                title="Delete"
              >
                <LuTrash2 />
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}
