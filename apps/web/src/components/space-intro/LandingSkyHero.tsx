import {
    type ReactNode,
    useCallback,
    useEffect,
    useRef,
    useState,
    useSyncExternalStore,
} from 'react';
import { useReducedMotion } from 'framer-motion';
import { ConstellationOverlay } from './ConstellationOverlay';
import { detectWebGL, INTRO_SESSION_KEY } from './session';
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

export function LandingSkyHero({ children }: Props) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const sceneRef = useRef<SpaceSceneHandle | null>(null);
    const reduceMotion = useReducedMotion();
    const prefersReduced = useSyncExternalStore(subscribeMotion, getMotionSnapshot, () => false);
    const mobile = useMobile();

    const [staticMode] = useState(() => prefersReduced || !detectWebGL());
    const [skipIntro] = useState(
        () => !staticMode && sessionStorage.getItem(INTRO_SESSION_KEY) === '1',
    );
    const [contentVisible, setContentVisible] = useState(staticMode || skipIntro);
    const [skyReady, setSkyReady] = useState(staticMode || skipIntro);
    const [showSkip, setShowSkip] = useState(!staticMode && !skipIntro);

    useEffect(() => {
        if (staticMode) return;
        const canvas = canvasRef.current;
        if (!canvas) return;
        let mounted = true;

        import('./runSpaceScene').then(({ mountSpaceScene }) => {
            if (!mounted || !canvasRef.current) return;
            mountSpaceScene(canvasRef.current, {
                mobile,
                skipIntro,
                textureBase: `${import.meta.env.BASE_URL}textures/`,
                onIntroComplete: () => {
                    sessionStorage.setItem(INTRO_SESSION_KEY, '1');
                    setSkyReady(true);
                    setContentVisible(true);
                    setShowSkip(false);
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
                if (skipIntro) {
                    setContentVisible(true);
                    setShowSkip(false);
                }
            });
        });

        return () => {
            mounted = false;
            sceneRef.current?.dispose();
            sceneRef.current = null;
        };
    }, [staticMode, mobile, skipIntro]);

    const onSkip = useCallback(() => {
        sessionStorage.setItem(INTRO_SESSION_KEY, '1');
        sceneRef.current?.skipIntro();
        setContentVisible(true);
        setSkyReady(true);
        setShowSkip(false);
    }, []);

    return (
        <div className="landing-sky-hero">
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
            <ConstellationOverlay visible={skyReady || staticMode} />
            <div className="landing-sky-hero__vignette" aria-hidden="true" />
            {showSkip && !reduceMotion && (
                <button type="button" className="btn btn-outline intro-skip" onClick={onSkip}>
                    Skip intro
                </button>
            )}
            <div
                className={`landing-sky-hero__content${contentVisible ? ' landing-sky-hero__content--visible' : ''}`}
            >
                {children}
            </div>
        </div>
    );
}
