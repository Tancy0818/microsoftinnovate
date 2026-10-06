import { useEffect, useRef, useState } from "react";
import { ExternalLink, RotateCw } from "lucide-react";

export function PowerBIReport({
  url,
  onPreview,
}: {
  url: string;
  onPreview: () => void;
}) {
  const [attempt, setAttempt] = useState(0);
  const isPublic = new URL(url).pathname === "/view";
  const [opened, setOpened] = useState(false);
  const [slow, setSlow] = useState(false);
  const loadTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    setOpened(false);
    setSlow(false);
    loadTimer.current = setTimeout(() => setSlow(true), 15000);
    return () => clearTimeout(loadTimer.current);
  }, [url, attempt]);
  return (
    <section className="bi-report" aria-label="Power BI analytics">
      <div className="bi-report-toolbar">
        <span>
          <strong>Analytics</strong>
          <small>Power BI · {isPublic ? "Public synthetic-data report" : "Historical synthetic data"}</small>
        </span>
        <div>
          <button onClick={() => setAttempt((n) => n + 1)}>
            <RotateCw size={14} />
            Reload report
          </button>
          <a href={url} target="_blank" rel="noopener noreferrer">
            Open report
            <ExternalLink size={14} />
          </a>
          <button onClick={onPreview}>Use local preview</button>
        </div>
      </div>
      {!opened && (
        <p className="bi-message" role="status">
          Opening Power BI…
        </p>
      )}
      {slow && (
        <p className="bi-message">
          {isPublic
            ? "If the report stays blank, open it separately or use the local preview."
            : "If Power BI asks you to sign in, use an account with report access. If the report stays blank, open it separately or use the local preview."}
        </p>
      )}
      <iframe
        key={`${url}-${attempt}`}
        title="AcuityCompass Power BI analytics report"
        src={url}
        onLoad={() => {
          clearTimeout(loadTimer.current);
          setOpened(true);
          setSlow(false);
        }}
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
      />
      <p className="bi-report-note">
        Report date filters apply to analytics only. The patient queue and
        actions below use the latest database snapshot. Reloading this view does
        not refresh Power BI’s imported dataset.
      </p>
    </section>
  );
}
