import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { track } from "@/lib/analytics";
import { Input } from "@/components/ui/input";

/** Share panel with copy link, QR code download and native share. */
export function ShareCard({ slug, title }: { slug: string; title: string }) {
  const [origin, setOrigin] = useState("");
  const [qr, setQr] = useState<string | null>(null);

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const url = origin ? `${origin}/l/${slug}` : "";

  useEffect(() => {
    if (!url) return;
    let cancelled = false;
    void import("qrcode").then(async (mod) => {
      const dataUrl = await mod.default.toDataURL(url, { width: 512, margin: 2 });
      if (!cancelled) setQr(dataUrl);
    });
    return () => {
      cancelled = true;
    };
  }, [url]);

  return (
    <div className="grid gap-6 md:grid-cols-[2fr_1fr]">
      <div className="space-y-4">
        <div className="space-y-2">
          <p className="text-sm font-medium">Lien public de votre liste</p>
          <Input readOnly value={url} onFocus={(event) => event.target.select()} />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            onClick={() => {
              void navigator.clipboard.writeText(url);
              toast.success("Lien copié");
            }}
          >
            Copier le lien
          </Button>
          <Button asChild variant="outline">
            <a href={url} target="_blank" rel="noreferrer">
              Voir la page publique
            </a>
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              const message = `Découvre ma liste « ${title} » : ${url}`;
              track("list_shared", { method: "native" });
              if (navigator.share) {
                void navigator.share({ title, text: message, url }).catch(() => undefined);
              } else {
                void navigator.clipboard.writeText(message);
                toast.success("Message copié");
              }
            }}
          >
            Partager
          </Button>
          <Button asChild variant="ghost">
            <a
              href={`https://wa.me/?text=${encodeURIComponent(`Découvre ma liste « ${title} » : ${url}`)}`}
              target="_blank"
              rel="noreferrer"
            >
              WhatsApp
            </a>
          </Button>
          <Button asChild variant="ghost">
            <a
              href={`mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(url)}`}
            >
              Email
            </a>
          </Button>
        </div>
      </div>

      <div className="rounded-xl border p-4 text-center">
        {qr ? (
          <>
            <img src={qr} alt={`QR code vers la liste ${title}`} className="mx-auto h-40 w-40" />
            <Button asChild variant="link" size="sm" className="mt-2">
              <a href={qr} download={`qr-${slug}.png`}>
                Télécharger le QR code
              </a>
            </Button>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Génération du QR code…</p>
        )}
      </div>
    </div>
  );
}
