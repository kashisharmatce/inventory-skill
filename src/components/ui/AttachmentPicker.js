"use client";

import { useRef } from "react";
import { Button, Form } from "react-bootstrap";
import { toast } from "react-toastify";
import { LuPaperclip, LuX } from "react-icons/lu";
import { ACCEPT_ATTRIBUTE, MAX_FILES_PER_PRODUCT, MAX_FILE_BYTES, checkFile, formatBytes } from "@/lib/attachments";

const same = (a, b) => a.name === b.name && a.size === b.size;

/**
 * File chooser for images / PDFs / documents. `files` is the list of chosen File objects (uploaded by
 * the parent after the product is saved). `existingCount` is how many attachments the product already has.
 */
export default function AttachmentPicker({ files, onChange, existingCount = 0, disabled = false }) {
  const inputRef = useRef(null);
  const room = MAX_FILES_PER_PRODUCT - existingCount - files.length;

  const handlePick = (e) => {
    const picked = Array.from(e.target.files || []);
    e.target.value = ""; // allow choosing the same file again later
    const accepted = [];
    for (const file of picked) {
      const problem = checkFile(file);
      if (problem) {
        toast.error(problem);
      } else if (files.some((f) => same(f, file)) || accepted.some((f) => same(f, file))) {
        toast.info(`"${file.name}" is already selected`);
      } else if (accepted.length >= room) {
        toast.error(`You can attach at most ${MAX_FILES_PER_PRODUCT} files to a product`);
        break;
      } else {
        accepted.push(file);
      }
    }
    if (accepted.length) onChange([...files, ...accepted]);
  };

  return (
    <Form.Group className="attachment-picker mb-3">
      <Form.Label>Attachments (image / PDF / file)</Form.Label>
      <div>
        <Button
          variant="outline-secondary"
          size="sm"
          className="attachment-picker__button"
          onClick={() => inputRef.current?.click()}
          disabled={disabled || room <= 0}
        >
          <LuPaperclip /> Choose files
        </Button>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPT_ATTRIBUTE}
          onChange={handlePick}
          className="d-none"
          aria-label="Choose attachment files"
        />
      </div>
      <Form.Text muted>
        Up to {MAX_FILES_PER_PRODUCT} files, {formatBytes(MAX_FILE_BYTES)} each. Images, PDF, Word, Excel, PowerPoint, CSV, text.
      </Form.Text>

      {files.length > 0 && (
        <ul className="attachment-chosen">
          {files.map((file, i) => (
            <li key={`${file.name}-${file.size}-${i}`}>
              <span className="attachment-chosen__name" title={file.name}>{file.name}</span>
              <span className="attachment-chosen__size">{formatBytes(file.size)}</span>
              <button
                type="button"
                className="attachment-chosen__remove"
                onClick={() => onChange(files.filter((_, idx) => idx !== i))}
                aria-label={`Remove ${file.name}`}
                disabled={disabled}
              >
                <LuX />
              </button>
            </li>
          ))}
        </ul>
      )}
    </Form.Group>
  );
}
