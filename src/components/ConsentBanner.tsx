import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { getLegalConfig } from "@/features/legal/api";
import {
  readCookieConsent,
  saveCookieConsent,
  type CookieChoices,
} from "@/features/privacy/cookie-consent";
import { startWebVitals } from "@/lib/analytics";

export function ConsentBanner() {
  const [version, setVersion] = useState<string>();
  const [visible, setVisible] = useState(false);
  const [customizing, setCustomizing] = useState(false);
  const [choices, setChoices] = useState<CookieChoices>({ analytics: false, marketing: false });

  useEffect(() => {
    let stopVitals: (() => void) | undefined;
    void getLegalConfig().then((config) => {
      setVersion(config.versions.cookies);
      const stored = readCookieConsent(config.versions.cookies);
      setVisible(!stored);
      if (stored) {
        setChoices(stored.choices);
        if (stored.choices.analytics) stopVitals = startWebVitals();
      }
    });
    const open = () => {
      const stored = readCookieConsent();
      setChoices(stored?.choices ?? { analytics: false, marketing: false });
      setCustomizing(true);
      setVisible(true);
    };
    const changed = (event: Event) => {
      stopVitals?.();
      const consent = (event as CustomEvent<{ choices: CookieChoices }>).detail;
      if (consent.choices.analytics) stopVitals = startWebVitals();
    };
    window.addEventListener("mila:open-cookie-manager", open);
    window.addEventListener("mila:cookie-consent", changed);
    return () => {
      stopVitals?.();
      window.removeEventListener("mila:open-cookie-manager", open);
      window.removeEventListener("mila:cookie-consent", changed);
    };
  }, []);

  const commit = async (next: CookieChoices) => {
    if (!version) return;
    setChoices(next);
    setVisible(false);
    setCustomizing(false);
    await saveCookieConsent(version, next);
  };
  if (!visible || !version) return null;

  return (
    <aside
      className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-2xl rounded-2xl border bg-background p-5 shadow-xl"
      aria-label="Gestion des cookies"
    >
      <h2 className="font-display text-xl">Votre vie privée, votre choix</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Les éléments nécessaires restent actifs. La mesure d’audience interne et toute technologie
        marketing restent désactivées sans votre accord.
      </p>
      {customizing && (
        <div className="mt-4 space-y-3 border-y py-4">
          <ConsentToggle
            label="Mesure d’audience interne"
            checked={choices.analytics}
            onChange={(analytics) => setChoices((value) => ({ ...value, analytics }))}
          />
          <ConsentToggle
            label="Marketing et attribution"
            checked={choices.marketing}
            onChange={(marketing) => setChoices((value) => ({ ...value, marketing }))}
          />
          <p className="text-xs text-muted-foreground">
            Aucun traceur marketing tiers n’est actuellement chargé par Mila.
          </p>
        </div>
      )}
      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        <Button
          variant="outline"
          onClick={() => void commit({ analytics: false, marketing: false })}
        >
          Tout refuser
        </Button>
        {customizing ? (
          <Button variant="secondary" onClick={() => void commit(choices)}>
            Enregistrer mes choix
          </Button>
        ) : (
          <Button variant="secondary" onClick={() => setCustomizing(true)}>
            Personnaliser
          </Button>
        )}
        <Button onClick={() => void commit({ analytics: true, marketing: true })}>
          Tout accepter
        </Button>
      </div>
    </aside>
  );
}

function ConsentToggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex min-h-11 cursor-pointer items-center justify-between gap-4 text-sm">
      <span>{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-5 w-5 accent-primary"
      />
    </label>
  );
}
