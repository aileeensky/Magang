"use client";

import { useEffect, useRef } from "react";

type MathFieldElement = HTMLElement & {
  value: string;
  setOptions?: (options: Record<string, unknown>) => void;
};

declare global {
  interface Window {
    __simonikMathLivePromise?: Promise<void>;
  }
}

function loadMathLive() {
  if (typeof window === "undefined") return Promise.resolve();

  if (window.__simonikMathLivePromise) {
    return window.__simonikMathLivePromise;
  }

  if (customElements.get("math-field")) {
    return Promise.resolve();
  }

  window.__simonikMathLivePromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector(
      'script[data-simonik-mathlive="true"]',
    );

    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Gagal memuat MathLive.")), {
        once: true,
      });
      return;
    }

    const script = document.createElement("script");
    script.src = "https://unpkg.com/mathlive";
    script.async = true;
    script.dataset.simonikMathlive = "true";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Gagal memuat editor persamaan."));
    document.head.appendChild(script);
  });

  return window.__simonikMathLivePromise;
}

type Props = {
  value?: string;
  onChange: (value: string) => void;
};

export default function MathField({ value = "", onChange }: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const fieldRef = useRef<MathFieldElement | null>(null);
  const lastValueRef = useRef(value);

  useEffect(() => {
    let cancelled = false;

    loadMathLive()
      .then(() => {
        if (cancelled || !hostRef.current || fieldRef.current) return;

        const field = document.createElement("math-field") as MathFieldElement;
        field.className = "iku-math-field";
        field.setAttribute(
          "aria-label",
          "Editor formula indikator kinerja utama",
        );
        field.setAttribute("virtual-keyboard-mode", "onfocus");
        field.setAttribute("smart-mode", "true");
        field.value = value || "";

        const handleInput = () => {
          const nextValue = field.value || "";
          lastValueRef.current = nextValue;
          onChange(nextValue);
        };

        field.addEventListener("input", handleInput);
        hostRef.current.appendChild(field);
        fieldRef.current = field;
      })
      .catch((error) => {
        console.error(error);
      });

    return () => {
      cancelled = true;
      if (fieldRef.current) {
        fieldRef.current.remove();
        fieldRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const field = fieldRef.current;
    if (!field || value === lastValueRef.current) return;

    if (field.value !== value) {
      field.value = value || "";
    }
    lastValueRef.current = value || "";
  }, [value]);

  return (
    <div className="iku-formula-editor">
      <div ref={hostRef} />
      <div className="iku-formula-help">
        Gunakan toolbar/keyboard matematika untuk pecahan, ×, ÷, pangkat,
        akar, kurung, dan simbol lainnya. Formula disimpan sebagai LaTeX.
      </div>
    </div>
  );
}
