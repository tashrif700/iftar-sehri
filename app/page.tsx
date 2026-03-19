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
