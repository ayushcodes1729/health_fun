"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

import { Notice } from "./ui";

/**
 * The Google callback cannot render UI; it redirects here with the outcome in
 * the query string. Before this existed a failed sign-in (missing env var,
 * database unreachable, redirect_uri mismatch) looked like nothing happened.
 */
function Inner() {
  const params = useSearchParams();
  const auth = params.get("auth");
  if (auth === "success") {
    return <Notice kind="success">Signed in with Google.</Notice>;
  }
  if (auth === "error") {
    const reason = params.get("reason") ?? "unknown";
    return (
      <Notice kind="error">
        Google sign-in failed: <code className="font-mono">{reason}</code>
        {reason.startsWith("Missing required environment variable")
          ? " — set this variable in your deployment's environment and redeploy."
          : null}
      </Notice>
    );
  }
  return null;
}

export function AuthNotice() {
  return (
    <Suspense fallback={null}>
      <Inner />
    </Suspense>
  );
}
