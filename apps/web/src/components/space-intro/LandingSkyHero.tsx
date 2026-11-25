import {
    type ReactNode,
    useCallback,
    useEffect,
    useLayoutEffect,
    useRef,
    useState,
    useSyncExternalStore,
} from 'react';
import { createPortal } from 'react-dom';
import { useI18n } from '../../i18n';
import { useTheme } from '../../lib/theme';
import { ConstellationOverlay } from './ConstellationOverlay';
import { mountInkSky } from './inkSky';
import { detectWebGL } from './session';
import type { SpaceSceneHandle } from './runSpaceScene';

const FALLBACK = `${import.meta.env.BASE_URL}textures/night-sky-fallback.webp`;

function subscribeMotion(onStoreChange: () => void) {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    mq.addEventListener('change', onStoreChange);
    return () => mq.removeEventListener('change', onStoreChange);
}

function getMotionSnapshot() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function useMobile() {
    return useSyncExternalStore(
        (onStoreChange) => {
            const mq = window.matchMedia('(max-width: 768px)');
            mq.addEventListener('change', onStoreChange);
            return () => mq.removeEventListener('change', onStoreChange);
        },
        () => window.matchMedia('(max-width: 768px)').matches,
        () => false,
    );
}

type Props = {
    children: ReactNode;
};

/** Keep the hero at the top of the viewport. Scroll restoration and a focus
 * jump onto the Skip control (it sits at the bottom of a 100svh hero, below
 * the sticky header) were leaving the headline above the viewport while the
 * fixed starfield stayed put. */
function pinLandingScroll() {
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
    window.scrollTo(0, 0);
}

function pinLandingScrollSoon() {
    pinLandingScroll();
    requestAnimationFrame(() => {
        pinLandingScroll();
        requestAnimationFrame(pinLandingScroll);
    });
}

/** Skip is fixed at the bottom; when it unmounts, focus can jump and scroll. */
function releaseIntroFocus() {
    const el = document.activeElement;
    if (el instanceof HTMLElement && el.closest('.intro-skip')) el.blur();
}

export function LandingSkyHero({ children }: Props) {
    const { mode } = useTheme();
    const { t } = useI18n();
    const skyOnly = mode === 'light';
    const persistent = mode === 'dark';
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const sceneRef = useRef<SpaceSceneHandle | null>(null);
    const skipRequested = useRef(false);
    const prefersReduced = useSyncExternalStore(subscribeMotion, getMotionSnapshot, () => false);
    const mobile = useMobile();

    const [staticMode] = useState(() => !detectWebGL());
    const [skyReady, setSkyReady] = useState(staticMode || skyOnly);
    const [showSkip, setShowSkip] = useState(!staticMode && !skyOnly);
    const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);

    useLayoutEffect(() => {
        pinLandingScroll();
    }, []);

    useLayoutEffect(() => {
        if (typeof document === 'undefined') return;
        setPortalTarget(document.body);
        document.body.classList.add('landing-sky-active');
        return () => {
            document.body.classList.remove('landing-sky-active');
        };
    }, []);

    // After Skip unmounts, focus can jump and scroll the hero away. Pin again
    // once that commit has landed, not only in the click handler before it.
    useLayoutEffect(() => {
        if (!showSkip) {
            releaseIntroFocus();
            pinLandingScrollSoon();
        }
    }, [showSkip]);

    useEffect(() => {
        if (staticMode || skyOnly) return;
        const fallback = window.setTimeout(() => {
            setSkyReady(true);
            setShowSkip(false);
        }, 14000);
        return () => clearTimeout(fallback);
    }, [staticMode, skyOnly]);

    useEffect(() => {
        const onScroll = () => {
            sceneRef.current?.setParallax(window.scrollY);
        };
        onScroll();
        window.addEventListener('scroll', onScroll, { passive: true });
        return () => window.removeEventListener('scroll', onScroll);
    }, []);

    useEffect(() => {
        if (staticMode) return;
        const canvas = canvasRef.current;
        if (!canvas) return;
        let mounted = true;
        let idleId = 0;
        let timer = 0;
        setSkyReady(skyOnly);
        setShowSkip(!skyOnly && !skipRequested.current);

        const start = () => {
            if (!mounted || !canvasRef.current) return;
            if (skyOnly) {
                const sky = mountInkSky(canvasRef.current, {
                    mobile,
                    reducedMotion: prefersReduced,
                });
                sceneRef.current = {
                    skipIntro() {},
                    setParallax: (y) => sky.setParallax(y),
                    dispose: () => sky.dispose(),
                };
                sky.setParallax(window.scrollY);
                return;
            }
            void import('./runSpaceScene').then(({ mountSpaceScene }) => {
                if (!mounted || !canvasRef.current) return;
                mountSpaceScene(canvasRef.current, {
                    mobile,
                    skipIntro: skipRequested.current,
                    skyOnly: false,
                    reducedMotion: prefersReduced,
                    textureBase: `${import.meta.env.BASE_URL}textures/`,
                    onIntroComplete: () => {
                        releaseIntroFocus();
                        setShowSkip(false);
                        pinLandingScrollSoon();
                    },
                    onPhaseChange: (phase) => {
                        if (phase === 'sky') setSkyReady(true);
                    },
                }).then((handle) => {
                    if (!mounted) {
                        handle.dispose();
                        return;
                    }
                    sceneRef.current = handle;
                    handle.setParallax(window.scrollY);
                    if (skipRequested.current) handle.skipIntro();
                });
            });
        };

        const schedule = () => {
            if (typeof window.requestIdleCallback === 'function') {
                idleId = window.requestIdleCallback(start, { timeout: skyOnly ? 500 : 900 });
            } else {
                timer = window.setTimeout(start, skyOnly ? 32 : 200);
            }
        };
        const outer = requestAnimationFrame(() => {
            requestAnimationFrame(schedule);
        });

        return () => {
            mounted = false;
            cancelAnimationFrame(outer);
            if (idleId) window.cancelIdleCallback?.(idleId);
            if (timer) window.clearTimeout(timer);
            sceneRef.current?.dispose();
            sceneRef.current = null;
        };
    }, [staticMode, mobile, prefersReduced, skyOnly, portalTarget]);

    const onSkip = useCallback(() => {
        skipRequested.current = true;
        sceneRef.current?.skipIntro();
        setSkyReady(true);
        releaseIntroFocus();
        setShowSkip(false);
        pinLandingScrollSoon();
    }, []);

    const skyLayer =
        portalTarget != null ? (
            <div className="landing-sky-layer" aria-hidden="true">
                {staticMode ? (
                    <img
                        className="landing-sky-hero__fallback"
                        src={FALLBACK}
                        alt=""
                        aria-hidden="true"
                    />
                ) : (
                    <canvas
                        ref={canvasRef}
                        className="landing-sky-hero__canvas"
                        aria-hidden="true"
                    />
                )}
                {!skyOnly && (
                    <ConstellationOverlay visible={skyReady || staticMode} sparse={mobile} />
                )}
                <div className="landing-sky-hero__vignette" aria-hidden="true" />
            </div>
        ) : null;

    return (
        <>
            {portalTarget != null && skyLayer != null ? createPortal(skyLayer, portalTarget) : null}
            <div className={`landing-sky-hero${persistent ? ' landing-sky-hero--persistent' : ''}`}>
                <div className="landing-sky-hero__foreground">
                    {showSkip && (
                        <button
                            type="button"
                            className="btn btn-outline intro-skip"
                            onClick={onSkip}
                        >
                            {t('landing.skipIntro')}
                        </button>
                    )}
                    <div className="landing-sky-hero__content landing-sky-hero__content--visible">
                        {children}
                    </div>
                </div>
            </div>
        </>
    );
}
