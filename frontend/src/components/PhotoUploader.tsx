import SamplePhotos from "./SamplePhotos";
import { useRef, useState } from "react";
import { Camera, Check, ImagePlus, Info, RefreshCw, ScanEye, Trash2 } from "lucide-react";
import { api, ApiError } from "../api/terraformApi";
import type { PhotoAnalyzeResponse } from "../types/terraform";
import { useTerraform } from "../store/terraformStore";
import { Spinner } from "./LoadingAndError";
import { Badge, cx } from "./ui";

const ACCEPT = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 8 * 1024 * 1024;

export type PhotoUploaderProps = {
  photoId: string | null | undefined;
  onChange: (photoId: string | null) => void;
  compact?: boolean;
  /** Tags the user confirmed from the photo's tentative suggestions (→ observation.photo_confirmed_tags). */
  confirmedTags?: string[];
  onConfirmedTagsChange?: (tags: string[]) => void;
};

export default function PhotoUploader({ photoId, onChange, compact, confirmedTags = [], onConfirmedTagsChange }: PhotoUploaderProps) {
  const visionEnabled = useTerraform((s) => s.health?.vision_enabled ?? false);
  const [cues, setCues] = useState<PhotoAnalyzeResponse | null>(null);
  const [cueLoading, setCueLoading] = useState(false);
  const [cueError, setCueError] = useState<string | null>(null);

  const resetCues = () => {
    setCues(null);
    setCueError(null);
    if (confirmedTags.length) onConfirmedTagsChange?.([]);
  };

  const suggestCues = async () => {
    if (!photoId) return;
    setCueLoading(true);
    setCueError(null);
    try {
      setCues(await api.analyzePhoto(photoId));
    } catch (e) {
      setCueError(e instanceof ApiError ? e.message : String(e));
    } finally {
      setCueLoading(false);
    }
  };

  const toggleTag = (tag: string) =>
    onConfirmedTagsChange?.(confirmedTags.includes(tag) ? confirmedTags.filter((t) => t !== tag) : [...confirmedTags, tag]);
  const previewUrl = useTerraform((s) => s.photoPreviewUrl);
  const setPreview = useTerraform((s) => s.setPhotoPreviewUrl);
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [lastFile, setLastFile] = useState<File | null>(null);

  const src = previewUrl ?? (photoId ? api.photoUrl(photoId) : null);

  const upload = async (file: File) => {
    setError(null);
    setMessage(null);
    if (!ACCEPT.includes(file.type)) {
      setError("Please choose a JPEG, PNG or WebP image.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setError(`That image is ${(file.size / 1024 / 1024).toFixed(1)} MB — the limit is 8 MB.`);
      return;
    }
    setLastFile(file);
    resetCues();
    const local = URL.createObjectURL(file);
    if (previewUrl?.startsWith("blob:")) URL.revokeObjectURL(previewUrl);
    setPreview(local);
    setUploading(true);
    try {
      const res = await api.uploadPhoto(file);
      onChange(res.photo_id);
      setMessage(res.message);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e));
      onChange(null);
    } finally {
      setUploading(false);
    }
  };

  const remove = () => {
    if (previewUrl?.startsWith("blob:")) URL.revokeObjectURL(previewUrl);
    setPreview(null);
    onChange(null);
    resetCues();
    setMessage(null);
    setError(null);
    setLastFile(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div className="space-y-2">
      <SamplePhotos onPick={(f) => void upload(f)} disabled={uploading} />
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT.join(",")}
        className="sr-only"
        id="land-photo-input"
        aria-label="Choose a land photo"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void upload(f);
        }}
      />
      {src ? (
        <div className={cx("flex gap-4 rounded-xl border border-white/10 bg-white/[0.03] p-3", compact ? "items-center" : "items-start")}>
          <img
            src={src}
            alt="Photo of the land you attached"
            className={cx("shrink-0 rounded-lg border border-white/10 object-cover", compact ? "h-16 w-16" : "h-24 w-32")}
          />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              {uploading ? (
                <Spinner label="Uploading photo…" />
              ) : photoId ? (
                <span className="text-sm text-ivory/90">Photo attached</span>
              ) : (
                <span className="text-sm text-coral">Not attached</span>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn-ghost !px-3 !py-1.5 text-sm" onClick={() => inputRef.current?.click()} disabled={uploading}>
                <RefreshCw className="h-4 w-4" aria-hidden /> Replace
              </button>
              <button type="button" className="btn-ghost !px-3 !py-1.5 text-sm" onClick={remove} disabled={uploading}>
                <Trash2 className="h-4 w-4" aria-hidden /> Remove
              </button>
              {error && lastFile && (
                <button type="button" className="btn-ghost !px-3 !py-1.5 text-sm" onClick={() => void upload(lastFile)}>
                  Retry upload
                </button>
              )}
            </div>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className={cx(
            "group flex w-full items-center gap-3 rounded-xl border border-dashed border-white/15 bg-white/[0.02] text-left transition-colors hover:border-cyan/50 hover:bg-cyan/5",
            compact ? "px-3 py-2.5" : "px-4 py-4",
          )}
        >
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-cyan/20 to-violet/20 text-cyan-100">
            {compact ? <Camera className="h-5 w-5" aria-hidden /> : <ImagePlus className="h-5 w-5" aria-hidden />}
          </span>
          <span>
            <span className="block font-heading font-semibold text-ivory">Attach a land photo (optional)</span>
            <span className="block text-sm text-mist">JPEG, PNG or WebP · up to 8 MB</span>
          </span>
        </button>
      )}
      {photoId && !uploading && onConfirmedTagsChange && (
        <div className="rounded-xl border border-violet/20 bg-violet/[0.04] p-3">
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className={cx(visionEnabled ? "btn-primary" : "btn-ghost", "!px-3 !py-1.5 text-sm")} onClick={() => void suggestCues()} disabled={cueLoading}>
              {cueLoading ? <Spinner label="Looking at the photo…" /> : <><ScanEye className="h-4 w-4" aria-hidden /> Suggest visible cues from photo</>}
            </button>
            {!visionEnabled && !cues && <span className="text-xs text-mist">Photo analysis may not be enabled on this backend.</span>}
          </div>
          {cueError && <p className="mt-2 text-sm text-coral" role="alert">{cueError}</p>}
          {cues && (
            <div className="mt-3 space-y-2">
              <p className="flex items-start gap-2 text-sm text-ivory/85" role="status">
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-violet-300" aria-hidden />
                {cues.message}
              </p>
              {cues.suggested?.length > 0 && (
                <>
                  <div className="flex items-center gap-2">
                    <Badge tone="amber">Tentative</Badge>
                    <span className="text-xs text-mist">Only cues you confirm are used.</span>
                  </div>
                  <ul className="flex flex-wrap gap-2">
                    {cues.suggested.map((sg) => {
                      const on = confirmedTags.includes(sg.tag);
                      return (
                        <li key={sg.tag}>
                          <button
                            type="button"
                            aria-pressed={on}
                            onClick={() => toggleTag(sg.tag)}
                            className={cx(
                              "flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-sm transition-colors",
                              on ? "border-sprout/50 bg-sprout/15 text-emerald-100" : "border-dashed border-amber/40 bg-amber/[0.05] text-ivory/85 hover:border-amber/70",
                            )}
                          >
                            <span className={cx("grid h-4 w-4 place-items-center rounded border", on ? "border-sprout bg-sprout text-midnight" : "border-white/30")}>
                              {on && <Check className="h-3 w-3" strokeWidth={3} aria-hidden />}
                            </span>
                            {sg.label}
                            <span className="text-xs text-mist">{on ? "confirmed" : "confirm?"}</span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </>
              )}
            </div>
          )}
        </div>
      )}
      {message && (
        <p className="flex items-start gap-2 text-sm text-mist" role="status">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-cyan" aria-hidden />
          {message}
        </p>
      )}
      {error && (
        <p className="text-sm text-coral" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
