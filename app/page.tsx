"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type ApiResponse = {
  code: number;
  status: string;
  data?: {
    timings?: {
      Fajr?: string;
      Maghrib?: string;
    };
    date?: {
      readable?: string;
    };
    meta?: {
      timezone?: string;
      method?: {
        name?: string;
      };
    };
  };
};

type ReverseGeoResponse = {
  address?: {
    city?: string;
    town?: string;
    village?: string;
    state?: string;
    country?: string;
  };
};

function parseTimeForToday(timeStr: string, now: Date) {
  const clean = timeStr.split(" ")[0];
  const [hour, minute] = clean.split(":").map(Number);

  return new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    hour,
    minute,
    0
  );
}

function formatClock(date: Date | null) {
  if (!date) return "--:--";
  return date.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatCountdown(ms: number) {
  if (ms <= 0) return "00:00:00";
  const totalSeconds = Math.floor(ms / 1000);
  const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, "0");
  const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0");
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${hours}:${minutes}:${seconds}`;
}

export default function Page() {
  const [cityInput, setCityInput] = useState("Dhaka");
  const [countryInput, setCountryInput] = useState("Bangladesh");

  const [city, setCity] = useState("Dhaka");
  const [country, setCountry] = useState("Bangladesh");

  const [fajr, setFajr] = useState<Date | null>(null);
  const [maghrib, setMaghrib] = useState<Date | null>(null);
  const [readableDate, setReadableDate] = useState("");
  const [timezone, setTimezone] = useState("");
  const [methodName, setMethodName] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [now, setNow] = useState(new Date());

  const [locationLoading, setLocationLoading] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [playedForEvent, setPlayedForEvent] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const checkScreen = () => setIsMobile(window.innerWidth < 900);
    checkScreen();
    window.addEventListener("resize", checkScreen);
    return () => window.removeEventListener("resize", checkScreen);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  async function loadPrayerTimes(nextCity: string, nextCountry: string) {
    setLoading(true);
    setError("");

    try {
      const url =
        `https://api.aladhan.com/v1/timingsByCity?city=${encodeURIComponent(nextCity)}` +
        `&country=${encodeURIComponent(nextCountry)}&method=2`;

      const response = await fetch(url, { cache: "no-store" });
      const json: ApiResponse = await response.json();

      if (
        !response.ok ||
        json.code !== 200 ||
        !json.data?.timings?.Fajr ||
        !json.data?.timings?.Maghrib
      ) {
        throw new Error("Could not load prayer times for this location.");
      }

      const current = new Date();
      const fajrTime = parseTimeForToday(json.data.timings.Fajr, current);
      const maghribTime = parseTimeForToday(json.data.timings.Maghrib, current);

      setFajr(fajrTime);
      setMaghrib(maghribTime);
      setReadableDate(json.data.date?.readable || "");
      setTimezone(json.data.meta?.timezone || "");
      setMethodName(json.data.meta?.method?.name || "");

      setCity(nextCity);
      setCountry(nextCountry);
      setCityInput(nextCity);
      setCountryInput(nextCountry);
      setPlayedForEvent(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  async function useMyLocation() {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported on this device.");
      return;
    }

    setLocationLoading(true);
    setError("");

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const lat = position.coords.latitude;
          const lon = position.coords.longitude;

          const reverseUrl =
            `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}`;

          const response = await fetch(reverseUrl, {
            headers: { Accept: "application/json" },
          });

          const geo: ReverseGeoResponse = await response.json();

          const detectedCity =
            geo.address?.city ||
            geo.address?.town ||
            geo.address?.village ||
            geo.address?.state ||
            "Dhaka";

          const detectedCountry = geo.address?.country || "Bangladesh";

          await loadPrayerTimes(detectedCity, detectedCountry);
        } catch {
          setError("Could not detect city from your location.");
        } finally {
          setLocationLoading(false);
        }
      },
      () => {
        setLocationLoading(false);
        setError("Location permission was denied or unavailable.");
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
      }
    );
  }

 async function enableAzan() {
  if (!audioRef.current) return;

  try {
    setError("");
    audioRef.current.volume = 1;
    audioRef.current.currentTime = 0;

    await audioRef.current.play();
    setSoundEnabled(true);

    setTimeout(() => {
      if (!audioRef.current) return;
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }, 1200);
  } catch (err) {
    console.error(err);
    setError("Sound could not be enabled. Check that /azan.mp3 exists and try again after tapping the page once.");
  }
}

  useEffect(() => {
    loadPrayerTimes("Dhaka", "Bangladesh");
  }, []);

  useEffect(() => {
    const refreshAtMidnight = setInterval(() => {
      const current = new Date();
      if (
        current.getHours() === 0 &&
        current.getMinutes() === 0 &&
        current.getSeconds() < 2
      ) {
        loadPrayerTimes(city, country);
      }
    }, 1000);

    return () => clearInterval(refreshAtMidnight);
  }, [city, country]);

  const nextEvent = useMemo(() => {
    if (!fajr || !maghrib) {
      return {
        label: "Loading...",
        timeLeft: 0,
        eventKey: "loading",
      };
    }

    if (now < fajr) {
      return {
        label: "Sehri ends in",
        timeLeft: fajr.getTime() - now.getTime(),
        eventKey: "sehri",
      };
    }

    if (now < maghrib) {
      return {
        label: "Iftar in",
        timeLeft: maghrib.getTime() - now.getTime(),
        eventKey: "iftar",
      };
    }

    return {
      label: "Today's fasting window has ended",
      timeLeft: 0,
      eventKey: "done",
    };
  }, [now, fajr, maghrib]);

  useEffect(() => {
    if (!soundEnabled || !audioRef.current || !fajr || !maghrib) return;

    const isAtFajr =
      now >= fajr &&
      now.getTime() - fajr.getTime() < 4000 &&
      playedForEvent !== "fajr";

    const isAtMaghrib =
      now >= maghrib &&
      now.getTime() - maghrib.getTime() < 4000 &&
      playedForEvent !== "maghrib";

    if (isAtFajr || isAtMaghrib) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(() => {
        setError("Browser blocked azan playback.");
      });
      setPlayedForEvent(isAtFajr ? "fajr" : "maghrib");
    }
  }, [now, fajr, maghrib, soundEnabled, playedForEvent]);

  const cardStyle: React.CSSProperties = {
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: "22px",
    padding: isMobile ? "18px" : "20px",
  };

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "linear-gradient(180deg, #0b1220 0%, #111827 100%)",
        color: "white",
        padding: isMobile ? "14px" : "24px",
      }}
    >
      <audio ref={audioRef} preload="auto" src="/azan.mp3" />

      <div style={{ maxWidth: "1100px", margin: "0 auto" }}>
        <div style={{ marginBottom: "24px" }}>
          <div
            style={{
              display: "inline-block",
              padding: "8px 14px",
              borderRadius: "999px",
              background: "rgba(255,255,255,0.08)",
              border: "1px solid rgba(255,255,255,0.12)",
              fontSize: "14px",
              marginBottom: "14px",
            }}
          >
            Sehri & Iftar Countdown
          </div>

          <h1
            style={{
              margin: "0 0 10px",
              fontSize: isMobile ? "34px" : "42px",
              lineHeight: 1.08,
            }}
          >
            Live Sehri and Iftar time app
          </h1>

          <p style={{ margin: 0, color: "#c7d2e0", maxWidth: "700px", lineHeight: 1.6 }}>
            Auto location, azan sound, and live countdown for Sehri and Iftar.
          </p>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: isMobile ? "1fr" : "340px 1fr",
            gap: "20px",
          }}
        >
          <section style={cardStyle}>
            <h2>Location</h2>

            <label style={{ display: "block", margin: "14px 0 8px", fontSize: "14px", color: "#d8e0ea" }}>
              City
            </label>
            <input
              value={cityInput}
              onChange={(e) => setCityInput(e.target.value)}
              placeholder="Dhaka"
              style={{
                width: "100%",
                padding: "12px 14px",
                borderRadius: "14px",
                border: "1px solid rgba(255,255,255,0.12)",
                background: "rgba(0,0,0,0.2)",
                color: "white",
                outline: "none",
              }}
            />

            <label style={{ display: "block", margin: "14px 0 8px", fontSize: "14px", color: "#d8e0ea" }}>
              Country
            </label>
            <input
              value={countryInput}
              onChange={(e) => setCountryInput(e.target.value)}
              placeholder="Bangladesh"
              style={{
                width: "100%",
                padding: "12px 14px",
                borderRadius: "14px",
                border: "1px solid rgba(255,255,255,0.12)",
                background: "rgba(0,0,0,0.2)",
                color: "white",
                outline: "none",
              }}
            />

            <button
              onClick={() => loadPrayerTimes(cityInput.trim(), countryInput.trim())}
              disabled={loading}
              style={{
                width: "100%",
                marginTop: "16px",
                padding: "12px 14px",
                border: "none",
                borderRadius: "14px",
                background: "white",
                color: "#09111f",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              {loading ? "Loading..." : "Update times"}
            </button>

            <button
              onClick={useMyLocation}
              disabled={locationLoading}
              style={{
                width: "100%",
                marginTop: "10px",
                padding: "12px 14px",
                border: "1px solid rgba(255,255,255,0.18)",
                borderRadius: "14px",
                background: "transparent",
                color: "white",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              {locationLoading ? "Detecting location..." : "Use My Location"}
            </button>

            <button
              onClick={enableAzan}
              style={{
                width: "100%",
                marginTop: "10px",
                padding: "12px 14px",
                border: "1px solid rgba(255,255,255,0.18)",
                borderRadius: "14px",
                background: soundEnabled ? "#1f7a45" : "transparent",
                color: "white",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              {soundEnabled ? "Azan Sound Enabled" : "Enable Azan Sound"}
            </button>

            <div
              style={{
                marginTop: "18px",
                padding: "14px",
                borderRadius: "16px",
                background: "rgba(0,0,0,0.18)",
                border: "1px solid rgba(255,255,255,0.08)",
                color: "#d9e3ee",
                lineHeight: 1.8,
                fontSize: "14px",
              }}
            >
              <div><strong>Location:</strong> {city}, {country}</div>
              <div><strong>Date:</strong> {readableDate || "--"}</div>
              <div><strong>Timezone:</strong> {timezone || "--"}</div>
              <div><strong>Method:</strong> {methodName || "--"}</div>
              <div><strong>Sound:</strong> {soundEnabled ? "Enabled" : "Off"}</div>
            </div>

            {error ? (
              <div
                style={{
                  marginTop: "14px",
                  padding: "12px 14px",
                  borderRadius: "14px",
                  background: "rgba(255, 70, 70, 0.12)",
                  border: "1px solid rgba(255, 70, 70, 0.35)",
                  color: "#ffd1d1",
                }}
              >
                {error}
              </div>
            ) : null}
          </section>

          <section style={{ display: "grid", gap: "20px" }}>
            <div
              style={{
                ...cardStyle,
                padding: isMobile ? "20px" : "28px",
              }}
            >
              <div style={{ color: "#d2dbea", fontSize: "15px", marginBottom: "8px" }}>
                {nextEvent.label}
              </div>
              <div
                style={{
                  fontSize: isMobile ? "42px" : "64px",
                  lineHeight: 1,
                  fontWeight: 800,
                  letterSpacing: "1px",
                  margin: "10px 0 14px",
                  wordBreak: "break-word",
                }}
              >
                {formatCountdown(nextEvent.timeLeft)}
              </div>
              <div style={{ color: "#b8c5d6", fontSize: "14px" }}>
                Current time:{" "}
                {now.toLocaleTimeString([], {
                  hour: "numeric",
                  minute: "2-digit",
                  second: "2-digit",
                })}
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
                gap: "20px",
              }}
            >
              <div style={cardStyle}>
                <div style={{ color: "#d2dbea", fontSize: "15px", marginBottom: "8px" }}>
                  Sehri last time
                </div>
                <div style={{ fontSize: isMobile ? "28px" : "34px", fontWeight: 700, margin: "10px 0" }}>
                  {formatClock(fajr)}
                </div>
                <div style={{ color: "#b8c5d6", fontSize: "14px" }}>Based on Fajr</div>
              </div>

              <div style={cardStyle}>
                <div style={{ color: "#d2dbea", fontSize: "15px", marginBottom: "8px" }}>
                  Iftar time
                </div>
                <div style={{ fontSize: isMobile ? "28px" : "34px", fontWeight: 700, margin: "10px 0" }}>
                  {formatClock(maghrib)}
                </div>
                <div style={{ color: "#b8c5d6", fontSize: "14px" }}>Based on Maghrib</div>
              </div>
            </div>

            <div
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: "18px",
                padding: "16px 20px",
                color: "#cbd5e1",
                fontSize: "14px",
              }}
            >
              Developed by <strong>Tanzeem Hasan Tashrif</strong>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
