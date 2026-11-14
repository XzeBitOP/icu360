"use client";
import { useMounted } from "./useMounted";

export function Greeting() {
  if (!useMounted()) return <>Hello.</>;
  const h = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hour12: false, timeZone: "Asia/Kolkata" }).format(new Date()));
  return <>{h < 5 ? "Night shift?" : h < 12 ? "Good morning." : h < 17 ? "Good afternoon." : "Good evening."}</>;
}
