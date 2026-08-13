import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { getAnalyticsConsent, setAnalyticsConsent, startWebVitals } from "@/lib/analytics";

export function ConsentBanner() {
  const [choice, setChoice] = useState<"granted" | "denied" | "unset">("unset");
  useEffect(() => {
    setChoice(getAnalyticsConsent());
    if (getAnalyticsConsent() === "granted") return startWebVitals();
    return undefined;
  }, []);
  if (choice !== "unset") return null;
  return (
    <aside
      className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-2xl rounded-xl border bg-background p-4 shadow-lg"
      aria-label="Choix de mesure d’audience"
    >
      <p className="text-sm">
        Mila utilise uniquement une mesure d’audience interne et pseudonyme pour améliorer le
        parcours. Elle reste désactivée sans votre accord.
      </p>
      <div className="mt-3 flex gap-2">
        <Button
          size="sm"
          onClick={() => {
            setAnalyticsConsent(true);
            setChoice("granted");
            startWebVitals();
          }}
        >
          Accepter la mesure
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            setAnalyticsConsent(false);
            setChoice("denied");
          }}
        >
          Continuer sans mesure
        </Button>
      </div>
    </aside>
  );
}
