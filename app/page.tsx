"use client";

import { useEffect, useMemo, useState } from "react";

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
    minute
  );
}

function formatCountdown(ms: number) {
  if (ms <= 0) return "00:00:00";

  const s = Math.floor(ms / 1000);
  const h = String(Math.floor(s / 3600)).padStart(2, "0");
  const m = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const sec = String(s % 60).padStart(2, "0");

  return `${h}:${m}:${sec}`;
}

export default function Page() {
  const [city, setCity] = useState("Dhaka");
  const [country, setCountry] = useState("Bangladesh");

  const [fajr, setFajr] = useState<Date | null>(null);
  const [maghrib, setMaghrib] = useState<Date | null>(null);

  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  async function load() {
    const res = await fetch(
      `https://api.aladhan.com/v1/timingsByCity?city=${city}&country=${country}`
    );
    const json: ApiResponse = await res.json();

    if (json.data?.timings?.Fajr && json.data?.timings?.Maghrib) {
      const today = new Date();
      setFajr(parseTimeForToday(json.data.timings.Fajr, today));
      setMaghrib(parseTimeForToday(json.data.timings.Maghrib, today));
    }
  }

  useEffect(() => {
    load();
  }, []);

  let label = "Loading...";
  let remaining = 0;

  if (fajr && now < fajr) {
    label = "Sehri ends in";
    remaining = fajr.getTime() - now.getTime();
  } else if (maghrib && now < maghrib) {
    label = "Iftar in";
    remaining = maghrib.getTime() - now.getTime();
  }

  return (
    <div style={{ padding: 20 }}>
      <h1>Sehri & Iftar Countdown</h1>

      <input value={city} onChange={e => setCity(e.target.value)} />
      <input value={country} onChange={e => setCountry(e.target.value)} />

      <button onClick={load}>Update</button>

      <h2>{label}</h2>
      <h1>{formatCountdown(remaining)}</h1>

      <p>Sehri: {fajr?.toLocaleTimeString()}</p>
      <p>Iftar: {maghrib?.toLocaleTimeString()}</p>
    </div>
  );
}
