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
    const body = new FormData();
    body.set("file", file);
    body.set("recordType", recordType);
    body.set("recordId", recordId);
    setBusy(true);
    try {
      const response = await fetch("/api/files", { method: "POST", body });
      const result = await response.json() as { error?: string };
      if (!response.ok) {
        setMessage(result.error ?? (t ? "Faili halikupakiwa." : "File upload failed."));
        return;
      }
      form.reset();
      setMessage(t ? "Faili limehifadhiwa kwa faragha." : "File stored privately.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : (t ? "Faili halikupakiwa." : "File upload failed."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel data-panel">
      <div className="panel-header"><div><h3>{t ? "Nyaraka na picha" : "Documents and photos"}</h3><p>{t ? "Faili za shamba huhifadhiwa faragha na wanachama wa shamba pekee." : "Files are private to members of this farm."}</p></div></div>
      {targets.length > 0 ? (
        <form className="record-form attachment-form" onSubmit={upload}>
          <label className="field"><span>{t ? "Unganisha na rekodi" : "Attach to record"}</span>
            <select value={target} onChange={(event) => setTarget(event.target.value)} required>
              {targets.map((item) => <option key={`${item.type}:${item.id}`} value={`${item.type}:${item.id}`}>{item.label}</option>)}
            </select>
          </label>
          <label className="field"><span>{t ? "Faili (JPEG, PNG, WebP au PDF; hadi MB 10)" : "File (JPEG, PNG, WebP or PDF; up to 10 MB)"}</span>
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
