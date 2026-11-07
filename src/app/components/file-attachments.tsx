"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

type Attachment = {
  id: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
  recordType: string;
  recordId: string;
};

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_IMAGE_SOURCE_SIZE = 30 * 1024 * 1024;
const MAX_IMAGE_DIMENSION = 1920;

async function compressImage(file: File) {
  const image = await createImageBitmap(file);
  try {
    const scale = Math.min(1, MAX_IMAGE_DIMENSION / Math.max(image.width, image.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Image compression is not available in this browser.");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const compressed = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/webp", 0.82),
    );
    if (!compressed) throw new Error("The selected image could not be compressed.");
    if (!["image/jpeg", "image/png", "image/webp"].includes(compressed.type)) return file;
    if (compressed.size >= file.size) return file;

    const extension = compressed.type === "image/webp" ? "webp" : compressed.type === "image/png" ? "png" : "jpg";
    const baseName = file.name.replace(/\.[^.]+$/, "") || "image";
    return new File([compressed], `${baseName}.${extension}`, {
      type: compressed.type,
      lastModified: file.lastModified,
    });
  } finally {
    image.close();
  }
}

export function FileAttachments({
  attachments,
  targets,
  locale,
}: {
  attachments: Attachment[];
  targets: Array<{ id: string; type: string; label: string }>;
  locale: "en" | "sw";
}) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [target, setTarget] = useState(targets[0]?.id ?? "");
  const t = locale === "sw";

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget;
    const file = new FormData(form).get("file");
    const [recordType, recordId] = target.split(":", 2);
    if (!(file instanceof File) || !recordType || !recordId) {
      setMessage(t ? "Chagua rekodi na faili." : "Choose a record and a file.");
      return;
    }
    const isImage = file.type.startsWith("image/");
    if (isImage && file.size > MAX_IMAGE_SOURCE_SIZE) {
      setMessage(t ? "Picha lazima iwe ndogo kuliko MB 30 kabla ya kubana." : "Choose an image smaller than 30 MB before compression.");
      return;
    }
    if (!isImage && file.size > MAX_FILE_SIZE) {
      setMessage(t ? "Faili za PDF haziwezi kuzidi MB 10." : "PDF files cannot exceed 10 MB.");
      return;
    }

    setBusy(true);
    let uploadFile = file;
    let optimized = false;
    if (isImage) {
      setMessage(t ? "Inapunguza ukubwa wa picha…" : "Compressing image…");
      try {
        uploadFile = await compressImage(file);
        optimized = uploadFile !== file;
      } catch {
        if (file.size > MAX_FILE_SIZE) {
          setMessage(t ? "Picha haikuweza kubanwa. Jaribu picha ndogo au kivinjari cha kisasa." : "Image compression failed. Try a smaller image or a modern browser.");
          setBusy(false);
          return;
        }
      }
    }
    if (uploadFile.size > MAX_FILE_SIZE) {
      setMessage(t ? "Picha iliyobanwa bado inazidi MB 10." : "The compressed image is still larger than 10 MB.");
      setBusy(false);
      return;
    }

    const body = new FormData();
    body.set("file", uploadFile);
    body.set("recordType", recordType);
    body.set("recordId", recordId);
    setMessage(t ? "Inapakia faili kwa faragha…" : "Uploading securely…");
    try {
      const response = await fetch("/api/files", { method: "POST", body });
      const result = await response.json() as { error?: string };
      if (!response.ok) {
        setMessage(result.error ?? (t ? "Faili halikupakiwa." : "File upload failed."));
        return;
      }
      form.reset();
      setMessage(optimized
        ? (t ? "Picha imebanwa na kuhifadhiwa kwa faragha." : "Image compressed and stored privately.")
        : (t ? "Faili limehifadhiwa kwa faragha." : "File stored privately."));
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : (t ? "Faili halikupakiwa." : "File upload failed."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel data-panel">
      <div className="panel-header"><div><h3>{t ? "Nyaraka na picha" : "Documents and photos"}</h3><p>{t ? "Picha hubanwa kwenye kifaa chako na kuhifadhiwa kwa usimbaji fiche kwa wanachama wa shamba pekee." : "Images are compressed on your device, then encrypted and stored privately for farm members."}</p></div></div>
      {targets.length > 0 ? (
        <form className="record-form attachment-form" onSubmit={upload}>
          <label className="field"><span>{t ? "Unganisha na rekodi" : "Attach to record"}</span>
            <select value={target} onChange={(event) => setTarget(event.target.value)} required>
              {targets.map((item) => <option key={`${item.type}:${item.id}`} value={`${item.type}:${item.id}`}>{item.label}</option>)}
            </select>
          </label>
          <label className="field"><span>{t ? "Picha (hadi MB 30 kabla ya kubana) au PDF (hadi MB 10)" : "Image (up to 30 MB before compression) or PDF (up to 10 MB)"}</span>
            <input name="file" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" required />
          </label>
          <div className="form-footer"><button className="button button-primary" disabled={busy} type="submit">{busy ? (t ? "Inapakia…" : "Uploading…") : (t ? "Pakia faili" : "Upload file")}</button><p aria-live="polite" className="form-message" role="status">{message}</p></div>
        </form>
      ) : <p className="field-help">{t ? "Ongeza rekodi ya shamba kabla ya kupakia faili." : "Add a farm record before uploading a file."}</p>}
      {attachments.length > 0 ? <div className="data-list">{attachments.map((attachment) => (
        <div className="data-row" key={attachment.id}>
          <span className="data-row-icon">↗</span>
          <div><strong>{attachment.filename}</strong><span>{attachment.recordType} · {new Date(attachment.createdAt).toLocaleDateString(locale === "sw" ? "sw-TZ" : "en-TZ")}</span></div>
          <a className="button button-quiet" href={`/api/files/${encodeURIComponent(attachment.id)}`}>{t ? "Pakua" : "Download"}</a>
        </div>
      ))}</div> : <p className="field-help">{t ? "Hakuna faili zilizohifadhiwa." : "No files uploaded yet."}</p>}
    </section>
  );
}
