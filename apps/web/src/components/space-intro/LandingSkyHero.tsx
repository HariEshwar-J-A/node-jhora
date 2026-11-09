import {
    type ReactNode,
    useCallback,
    useEffect,
    useLayoutEffect,
    useRef,
    useState,
    useSyncExternalStore,
} from 'react';
import { useTheme } from '../../lib/theme';
import { ConstellationOverlay } from './ConstellationOverlay';
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

export function LandingSkyHero({ children }: Props) {
    const { mode } = useTheme();
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

    useLayoutEffect(() => {
        pinLandingScroll();
    }, []);

    // After Skip unmounts, focus can jump and scroll the hero away. Pin again
    // once that commit has landed, not only in the click handler before it.
    useLayoutEffect(() => {
        if (!showSkip) pinLandingScrollSoon();
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
        setSkyReady(skyOnly);
        setShowSkip(!skyOnly && !skipRequested.current);

        import('./runSpaceScene').then(({ mountSpaceScene }) => {
            if (!mounted || !canvasRef.current) return;
            mountSpaceScene(canvasRef.current, {
                mobile,
                skipIntro: skyOnly || skipRequested.current,
                skyOnly,
                reducedMotion: prefersReduced,
                textureBase: `${import.meta.env.BASE_URL}textures/`,
                onIntroComplete: () => {
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
                if (!skyOnly && skipRequested.current) handle.skipIntro();
            });
        });

        return () => {
            mounted = false;
            sceneRef.current?.dispose();
            sceneRef.current = null;
        };
    }, [staticMode, mobile, prefersReduced, skyOnly]);

    const onSkip = useCallback(() => {
        skipRequested.current = true;
        sceneRef.current?.skipIntro();
        setSkyReady(true);
        setShowSkip(false);
        pinLandingScrollSoon();
    }, []);

    return (
        <div className={`landing-sky-hero${persistent ? ' landing-sky-hero--persistent' : ''}`}>
            {staticMode ? (
                <img
                    className="landing-sky-hero__fallback"
                    src={FALLBACK}
                    alt=""
                    aria-hidden="true"
                />
            ) : (
                <canvas ref={canvasRef} className="landing-sky-hero__canvas" aria-hidden="true" />
            )}
            <ConstellationOverlay visible={skyReady || staticMode || skyOnly} sparse={mobile} />
            <div className="landing-sky-hero__vignette" aria-hidden="true" />
            {showSkip && (
                <button type="button" className="btn btn-outline intro-skip" onClick={onSkip}>
                    Skip intro
                </button>
            )}
            <div className="landing-sky-hero__content landing-sky-hero__content--visible">
                {children}
            </div>
        </div>
    );
}
