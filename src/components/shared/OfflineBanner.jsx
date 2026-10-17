import { useEffect, useState } from "react";
import { useLanguage } from "../../i18n/LanguageContext.jsx";
import "./OfflineBanner.css";

export default function OfflineBanner() {
  const { t } = useLanguage();
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showOnlineMsg, setShowOnlineMsg] = useState(false);

  useEffect(() => {
    let onlineTimer;

    function handleOnline() {
      setIsOnline(true);
      setShowOnlineMsg(true);
      onlineTimer = window.setTimeout(() => setShowOnlineMsg(false), 3000);
    }

    function handleOffline() {
      setIsOnline(false);
      setShowOnlineMsg(false);
      window.clearTimeout(onlineTimer);
    }

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.clearTimeout(onlineTimer);
    };
  }, []);

  if (isOnline && !showOnlineMsg) return null;

  return (
    <div
      className={`offline-banner${isOnline ? " online" : " offline"}`}
      role="status"
      aria-live="assertive"
      aria-atomic="true"
    >
      {isOnline
        ? t("You are back online")
        : t("You are offline. Downloaded courses still work and your answers are saved on this device.")}
    </div>
  );
}
