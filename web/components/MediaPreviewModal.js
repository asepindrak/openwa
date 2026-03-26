import { useEffect, useState } from "react";

export function MediaPreviewModal({ media, onClose }) {
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        onClose();
      }
      if (event.key === "+" || event.key === "=") {
        event.preventDefault();
        setZoom((current) => Math.min(current + 0.2, 3));
      }
      if (event.key === "-") {
        event.preventDefault();
        setZoom((current) => Math.max(current - 0.2, 0.5));
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  if (!media) {
    return null;
  }

  const { mediaUrl, mimeType, originalName, isImage } = media;

  const handleDownload = async () => {
    try {
      const response = await fetch(mediaUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = originalName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Download failed:", error);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative max-h-[90vh] max-w-[90vw] rounded-2xl bg-black shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        {/* Close button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute right-6 top-6 z-10 rounded-full bg-black/60 w-10 h-10 flex items-center justify-center transition hover:bg-black/80 text-white text-lg"
          title="Close (Esc)"
        >
          ✕
        </button>

        {/* Download button */}
        <button
          type="button"
          onClick={handleDownload}
          className="absolute bottom-6 right-6 z-10 rounded-lg bg-black/60 px-4 py-2 text-sm font-medium text-white transition hover:bg-black/80"
          title="Download"
        >
          ⬇ Download
        </button>

        {/* Media content */}
        <div className="flex items-center justify-center overflow-auto p-4">
          {isImage ? (
            <img
              src={mediaUrl}
              alt={originalName}
              className="max-h-[calc(90vh-80px)] max-w-[calc(90vw-32px)] rounded-xl object-contain"
              style={{
                transform: `scale(${zoom})`,
                transition: "transform 0.2s ease-in-out"
              }}
            />
          ) : mimeType.startsWith("video/") ? (
            <video
              controls
              autoPlay
              className="max-h-[calc(90vh-80px)] max-w-[calc(90vw-32px)] rounded-xl"
            >
              <source src={mediaUrl} type={mimeType} />
            </video>
          ) : mimeType.startsWith("audio/") ? (
            <audio controls autoPlay className="w-full max-w-[500px]">
              <source src={mediaUrl} type={mimeType} />
            </audio>
          ) : null}
        </div>

        {/* Zoom controls (only for images) */}
        {isImage && (
          <div className="absolute bottom-6 left-6 flex items-center gap-2 rounded-lg bg-black/60 px-3 py-2">
            <button
              type="button"
              onClick={() => setZoom((current) => Math.max(current - 0.2, 0.5))}
              className="rounded p-1 transition hover:bg-black/80 text-white"
              title="Zoom out (-)  "
            >
              −
            </button>
            <span className="min-w-[40px] text-center text-sm text-white">
              {Math.round(zoom * 100)}%
            </span>
            <button
              type="button"
              onClick={() => setZoom((current) => Math.min(current + 0.2, 3))}
              className="rounded p-1 transition hover:bg-black/80 text-white"
              title="Zoom in (+)"
            >
              +
            </button>
            <div className="h-4 w-px bg-white/20" />
            <button
              type="button"
              onClick={() => setZoom(1)}
              className="px-2 py-1 text-xs transition hover:bg-black/80 text-white"
              title="Reset zoom"
            >
              Reset
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
