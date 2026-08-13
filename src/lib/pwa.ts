export function registerPwa() {
  if (
    !import.meta.env.PROD ||
    typeof window === "undefined" ||
    !("serviceWorker" in navigator) ||
    !window.isSecureContext
  )
    return;
  window.addEventListener(
    "load",
    () => void navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => undefined),
    { once: true },
  );
}
export async function shareNative(data: ShareData) {
  if (navigator.share && (!navigator.canShare || navigator.canShare(data))) {
    await navigator.share(data);
    return true;
  }
  return false;
}
