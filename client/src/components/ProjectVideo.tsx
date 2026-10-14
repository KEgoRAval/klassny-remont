import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { ICON_STROKE } from "@/components/KremChrome";

export type ProjectVideoSource = { src: string; poster: string; title: string; width: number; height: number };

/** Plays a project walkthrough in a dialog; the file is requested only once the dialog opens. */
export function ProjectVideoModal({ video, onClose }: { video: ProjectVideoSource | null; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!video) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    closeRef.current?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, [video, onClose]);

  if (!video) return null;
  return (
    <div className="k-backdrop" role="dialog" aria-modal="true" aria-label={video.title} onMouseDown={onClose}>
      <div className="k-video-modal" onMouseDown={(event) => event.stopPropagation()}>
        <button ref={closeRef} className="k-modal-close" onClick={onClose} aria-label="Закрыть видео"><X size={20} strokeWidth={ICON_STROKE} /></button>
        <video src={video.src} poster={video.poster} width={video.width} height={video.height} autoPlay controls playsInline preload="auto" onEnded={onClose} />
      </div>
    </div>
  );
}
