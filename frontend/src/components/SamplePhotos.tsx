// One-click sample land photos (Wikimedia Commons, CC BY-SA). They are user INPUT examples only,
// uploaded through the normal photo endpoint — never knowledge-base evidence.
import { useEffect, useState } from "react";

type Sample = { file: string; title: string; alt: string; credit: string; license: string; license_url: string; source_url: string };

export default function SamplePhotos({ onPick, disabled }: { onPick: (file: File) => void; disabled?: boolean }) {
  const [samples, setSamples] = useState<Sample[]>([]);
  useEffect(() => {
    fetch("/sample-photos/credits.json")
      .then((r) => (r.ok ? r.json() : { photos: [] }))
      .then((d) => setSamples(d.photos ?? []))
      .catch(() => setSamples([]));
  }, []);
  if (!samples.length) return null;

  const pick = async (s: Sample) => {
    const blob = await (await fetch(s.file)).blob();
    onPick(new File([blob], s.file.split("/").pop() ?? "sample.jpg", { type: blob.type || "image/jpeg" }));
  };

  return (
    <div>
      <div className="mb-1 font-heading text-[11px] uppercase tracking-[0.18em] text-ivory/50">Or use a sample photo</div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {samples.map((s) => (
          <button
            key={s.file}
            type="button"
            disabled={disabled}
            onClick={() => void pick(s)}
            title={`${s.title} — ${s.credit}, ${s.license}`}
            className="group relative h-16 w-24 shrink-0 overflow-hidden rounded-lg border border-white/15 hover:border-cyan-300/70 disabled:opacity-50"
          >
            <img src={s.file} alt={s.alt} loading="lazy" className="h-full w-full object-cover transition group-hover:scale-105" />
            <span className="absolute inset-x-0 bottom-0 truncate bg-black/60 px-1 text-[9px] text-ivory/90">{s.title}</span>
          </button>
        ))}
      </div>
      <div className="mt-0.5 text-[9.5px] text-ivory/40">
        Sample photos from Wikimedia Commons ({samples[0].license}) — credits in <a className="underline" href="/sample-photos/credits.json" target="_blank" rel="noreferrer">credits.json</a>.
      </div>
    </div>
  );
}
