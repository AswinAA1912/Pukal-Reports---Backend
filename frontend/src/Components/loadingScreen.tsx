import React, { useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";

type SoftUILoaderProps = {
    loading: boolean;
    message?: string | React.ReactNode;
    progress?: number | null;
    tone?: "light" | "dark";
    logo?: React.ReactNode;
    zIndex?: number;
};

const EVENTS_TO_BLOCK: (keyof WindowEventMap)[] = [
    "keydown",
    "keypress",
    "keyup",
    "click",
    "mousedown",
    "mouseup",
    "dblclick",
    "contextmenu",
    "pointerdown",
    "pointerup",
    "pointercancel",
    "wheel",
    "touchstart",
    "touchend",
    "touchmove",
];

export function LoadingScreen({
    loading,
    message = "Processing the request",
    progress = null,
    tone = "light",
    logo,
    zIndex = 99999,
}: SoftUILoaderProps) {
    const overlayRef = useRef<HTMLDivElement | null>(null);

    const theme = useMemo(() => {
        if (tone === "dark") {
            return {
                bg: "#1f2430",
                bgAccent: "#232a39",
                surface: "#242b3a",
                text: "#e9eef8",
                subtext: "#a9b4c7",
                shadowLight: "#2f3748",
                shadowDark: "#141820",
            };
        }
        return {
            bg: "#e6ecf5",
            bgAccent: "#eef3fb",
            surface: "#edf2fa",
            text: "#263244",
            subtext: "#5a6a82",
            shadowLight: "#ffffff",
            shadowDark: "#c8d1e2",
        };
    }, [tone]);

    useEffect(() => {
        if (!loading || typeof window === "undefined" || typeof document === "undefined") return;

        const block = (e: Event) => {
            e.preventDefault();
            const eventWithStopImmediate = e as Event & {
                stopImmediatePropagation?: () => void;
            };
            if (typeof eventWithStopImmediate.stopImmediatePropagation === "function") {
                eventWithStopImmediate.stopImmediatePropagation();
            }
            e.stopPropagation();
            return false;
        };

        EVENTS_TO_BLOCK.forEach((t) =>
            window.addEventListener(t, block, { capture: true, passive: false })
        );

        const prevHtmlOverflow = document.documentElement.style.overflow;
        const prevBodyOverflow = document.body.style.overflow;
        document.documentElement.style.overflow = "hidden";
        document.body.style.overflow = "hidden";
        document.body.setAttribute("aria-busy", "true");

        const focusTrap = () => {
            const el = overlayRef.current;
            if (!el) return;
            if (!el.contains(document.activeElement)) {
                el.focus();
            }
        };
        window.addEventListener("focusin", focusTrap, { capture: true });

        overlayRef.current?.focus();

        return () => {
            const cleanupOptions: EventListenerOptions = { capture: true };
            
            EVENTS_TO_BLOCK.forEach((t) =>
                window.removeEventListener(t, block, cleanupOptions)
            );
            window.removeEventListener("focusin", focusTrap, cleanupOptions);
            document.documentElement.style.overflow = prevHtmlOverflow;
            document.body.style.overflow = prevBodyOverflow;
            document.body.removeAttribute("aria-busy");
        };
    }, [loading]);

    if (!loading) return null;

    const overlay = (
        <div
            ref={overlayRef}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-live="assertive"
            aria-label={typeof message === "string" ? message : "Loading"}
            style={{
                position: "fixed",
                inset: 0,
                zIndex,
                display: "grid",
                placeItems: "center",
                background: `
                    radial-gradient(1200px 1200px at 20% 15%, ${theme.bgAccent} 0%, ${theme.bg} 40%),
                    radial-gradient(900px 900px at 80% 85%, ${theme.bgAccent} 0%, ${theme.bg} 35%), ${theme.bg}`,
                pointerEvents: "all",
            }}
        >
            {/* Local styles for spinner & progress */}
            <style>{`
                @keyframes sui-rotate { to { transform: rotate(1turn); } }
                @keyframes sui-pulse  { 0%,100% { opacity: .6; transform: translateY(0) } 50% { opacity: 1; transform: translateY(-2px) } }
                @keyframes sui-orbit { to { transform: translate(-50%, -50%) rotate(360deg) translateY(-34px); }}
                .sui-card {
                  min-width: 280px;
                  max-width: min(90vw, 520px);
                  padding: 28px 28px 24px;
                  border-radius: 22px;
                  background: ${theme.surface};
                  box-shadow:
                    18px 18px 34px ${theme.shadowDark},
                    -18px -18px 34px ${theme.shadowLight};
                  display: flex; flex-direction: column; align-items: center; gap: 18px;
                }
                .sui-logo {
                  display: grid; place-items: center;
                  width: 56px; height: 56px; border-radius: 16px;
                  background: ${theme.surface};
                  box-shadow:
                    10px 10px 20px ${theme.shadowDark},
                    -10px -10px 20px ${theme.shadowLight},
                    inset 2px 2px 4px ${theme.shadowDark},
                    inset -2px -2px 4px ${theme.shadowLight};
                }
                .sui-spinner {
                  width: 84px; height: 84px; border-radius: 999px;
                  position: relative;
                  display: grid; place-items: center;
                  background: ${theme.surface};
                  box-shadow:
                    inset 10px 10px 18px ${theme.shadowDark},
                    inset -10px -10px 18px ${theme.shadowLight};
                }
                .sui-spinner::before{
                  content:"";
                  position:absolute; inset: 10px;
                  border-radius: 999px;
                  box-shadow:
                    -10px -10px 18px ${theme.shadowLight},
                    10px 10px 18px ${theme.shadowDark};
                  opacity: .7;
                }
                .sui-dot {
                  position: absolute;
                  top: 50%;
                  left: 50%;
                  width: 18px;
                  height: 18px;
                  border-radius: 999px;
                  background:  ${theme.text};
                  box-shadow: 0 0 22px ${theme.text};
                  transform: translate(-50%, -50%) rotate(0deg) translateY(-34px);
                  animation: sui-orbit 1.1s linear infinite;
                  will-change: transform;
                }
                .sui-msg {
                  margin-top: 4px;
                  font-size: 15px; line-height: 1.35;
                  color: ${theme.text}; text-align: center;
                  letter-spacing: .2px;
                }
                .sui-sub {
                  font-size: 12px; color: ${theme.subtext}; text-align:center;
                  animation: sui-pulse 1.6s ease-in-out infinite;
                }
                .sui-progress-wrap {
                  width: 100%;
                  margin-top: 2px;
                  padding: 10px;
                  border-radius: 16px;
                  background: ${theme.surface};
                  box-shadow:
                    inset 8px 8px 14px ${theme.shadowDark},
                    inset -8px -8px 14px ${theme.shadowLight};
                }
                .sui-progress-bar {
                  height: 12px; border-radius: 10px;
                  background: linear-gradient(180deg, ${theme.bgAccent}, ${theme.surface});
                  box-shadow:
                    6px 6px 12px ${theme.shadowDark},
                    -6px -6px 12px ${theme.shadowLight};
                  position: relative;
                  overflow: hidden;
                }
                .sui-progress-fill {
                  height: 100%; border-radius: 10px;
                  background: ${theme.text};
                  width: 0%;
                  transition: width .35s ease;
                  box-shadow: 0 0 24px ${theme.text};
                }`}
            </style>

            <div className="sui-card" aria-busy="true">
                {logo ? <div className="sui-logo" aria-hidden="true">{logo}</div> : null}

                <div className="sui-spinner" aria-hidden="true">
                    <div className="sui-dot" />
                </div>

                <div className="sui-msg">
                    {message}
                </div>

                {typeof progress === "number" && progress >= 0 && progress <= 1 ? (
                    <div
                        className="sui-progress-wrap"
                        role="progressbar"
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={Math.round(progress * 100)}
                        aria-label="Loading progress"
                    >
                        <div className="sui-progress-bar">
                            <div
                                className="sui-progress-fill"
                                style={{ width: `${Math.max(0, Math.min(100, progress * 100))}%` }}
                            />
                        </div>
                        <div className="sui-sub" style={{ marginTop: 8 }}>
                            {Math.round(progress * 100)}%
                        </div>
                    </div>
                ) : (
                    <div className="sui-sub">Please wait…</div>
                )}
            </div>
        </div>
    );

    return typeof document !== "undefined" ? createPortal(overlay, document.body) : overlay;
}

export default LoadingScreen;