"use client";

import * as Sentry from "@sentry/react";
import { useEffect } from "react";

export function SentryClientInit() {
  useEffect(() => {
    const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
    if (!dsn) return;
    Sentry.init({
      dsn,
      environment: process.env.NODE_ENV,
      tracesSampleRate: 0,
    });
  }, []);
  return null;
}
