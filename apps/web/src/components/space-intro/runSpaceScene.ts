import type { BufferGeometry, Material, Mesh, Points, Texture, WebGLRenderer } from 'three';

export type SpaceScenePhase = 'intro' | 'sky';

export type SpaceSceneHandle = {
    skipIntro: () => void;
    dispose: () => void;
};

export type MountSpaceSceneOptions = {
    mobile: boolean;
    skipIntro: boolean;
    textureBase: string;
    onIntroComplete: () => void;
    onPhaseChange?: (phase: SpaceScenePhase) => void;
};

const INTRO_MS = 7200;

function easeInOutCubic(t: number): number {
    return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

function createNebulaTexture(THREE: typeof import('three')): Texture {
    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    const g = ctx.createRadialGradient(
        size * 0.45,
        size * 0.4,
        0,
        size * 0.5,
        size * 0.5,
        size * 0.55,
    );
    g.addColorStop(0, 'rgba(120, 140, 180, 0.35)');
    g.addColorStop(0.45, 'rgba(60, 70, 100, 0.12)');
    g.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
}

function buildStars(THREE: typeof import('three'), count: number, radius: number) {
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
        const u = Math.random();
        const v = Math.random();
        const theta = 2 * Math.PI * u;
        const phi = Math.acos(2 * v - 1);
        const r = radius * (0.85 + Math.random() * 0.15);
        positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
        positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
        positions[i * 3 + 2] = r * Math.cos(phi);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
        size: 0.35,
        sizeAttenuation: true,
        transparent: true,
        opacity: 0.85,
        color: 0xdde4ff,
        depthWrite: false,
    });
    return new THREE.Points(geo, mat);
}

export async function mountSpaceScene(
    canvas: HTMLCanvasElement,
    opts: MountSpaceSceneOptions,
): Promise<SpaceSceneHandle> {
    const THREE = await import('three');
    const disposables: (BufferGeometry | Material | Texture)[] = [];
    const meshes: Mesh[] = [];
    const points: Points[] = [];

    const renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: !opts.mobile,
        alpha: true,
        powerPreference: 'high-performance',
    });
    const maxDpr = opts.mobile ? 1.25 : 1.5;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, maxDpr));
    renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = opts.mobile ? 0.95 : 1.05;

    const scene = new THREE.Scene();
    const travelFog = new THREE.FogExp2(0x03050a, 0.0012);
    scene.fog = travelFog;

    const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 800);
    camera.position.set(0, 0, -120);

    const starFar = buildStars(THREE, opts.mobile ? 1200 : 3200, 180);
    const starMid = buildStars(THREE, opts.mobile ? 800 : 2000, 120);
    const starNear = buildStars(THREE, opts.mobile ? 400 : 900, 70);
    [starFar, starMid, starNear].forEach((p) => {
        points.push(p);
        scene.add(p);
        disposables.push(p.geometry, p.material as Material);
    });

    const nebulaTex = createNebulaTexture(THREE);
    disposables.push(nebulaTex);
    const nebulaMat = new THREE.SpriteMaterial({
        map: nebulaTex,
        transparent: true,
        opacity: 0.35,
        color: 0xaabbdd,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
    });
    disposables.push(nebulaMat);
    const nebula = new THREE.Sprite(nebulaMat);
    nebula.scale.set(280, 180, 1);
    nebula.position.set(40, 20, -90);
    scene.add(nebula);
    const nebula2Mat = nebulaMat.clone();
    disposables.push(nebula2Mat);
    const nebula2 = new THREE.Sprite(nebula2Mat);
    nebula2.position.set(-60, -10, -110);
    nebula2.scale.set(220, 140, 1);
    scene.add(nebula2);

    const loader = new THREE.TextureLoader();
    const suffix = opts.mobile ? 'mobile' : 'desktop';
    const dayMap = loader.load(`${opts.textureBase}earth-day-${suffix}.webp`);
    const nightMap = loader.load(`${opts.textureBase}earth-night-${suffix}.webp`);
    dayMap.colorSpace = THREE.SRGBColorSpace;
    nightMap.colorSpace = THREE.SRGBColorSpace;
    disposables.push(dayMap, nightMap);

    const earthGeo = new THREE.SphereGeometry(8, opts.mobile ? 48 : 64, opts.mobile ? 32 : 48);
    disposables.push(earthGeo);
    const earthMat = new THREE.MeshStandardMaterial({
        map: dayMap,
        emissiveMap: nightMap,
        emissive: new THREE.Color(0xffaa66),
        emissiveIntensity: opts.mobile ? 0.55 : 0.75,
        roughness: 0.85,
        metalness: 0.05,
    });
    disposables.push(earthMat);
    const earth = new THREE.Mesh(earthGeo, earthMat);
    earth.position.set(0, -2, 0);
    meshes.push(earth);
    scene.add(earth);

    const atmoGeo = new THREE.SphereGeometry(8.25, opts.mobile ? 40 : 56, opts.mobile ? 28 : 40);
    disposables.push(atmoGeo);
    const atmoMat = new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: {
            c: { value: 0.38 },
            p: { value: 3.8 },
            glowColor: { value: new THREE.Color(0x6eb5ff) },
        },
        vertexShader: `
          varying vec3 vNormal;
          void main() {
            vNormal = normalize(normalMatrix * normal);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          uniform float c;
          uniform float p;
          uniform vec3 glowColor;
          varying vec3 vNormal;
          void main() {
            float intensity = pow(c - dot(vNormal, vec3(0.0, 0.0, 1.0)), p);
            gl_FragColor = vec4(glowColor, 1.0) * intensity;
          }
        `,
    });
    disposables.push(atmoMat);
    const atmosphere = new THREE.Mesh(atmoGeo, atmoMat);
    atmosphere.position.copy(earth.position);
    meshes.push(atmosphere);
    scene.add(atmosphere);

    scene.add(new THREE.AmbientLight(0x334466, 0.35));
    const sun = new THREE.DirectionalLight(0xfff2dd, 1.4);
    sun.position.set(30, 10, 20);
    scene.add(sun);

    let phase: SpaceScenePhase = opts.skipIntro ? 'sky' : 'intro';
    let introStart = performance.now();
    let introSkipped = opts.skipIntro;
    let raf = 0;
    let paused = false;
    let shootingT = 0;

    const resize = () => {
        const w = canvas.clientWidth;
        const h = canvas.clientHeight;
        if (w <= 0 || h <= 0) return;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h, false);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const onVis = () => {
        paused = document.hidden;
    };
    document.addEventListener('visibilitychange', onVis);

    const finishIntro = () => {
        if (phase === 'sky') return;
        phase = 'sky';
        opts.onPhaseChange?.('sky');
        opts.onIntroComplete();
        scene.fog = new THREE.FogExp2(0x020308, opts.mobile ? 0.018 : 0.014);
        earth.visible = false;
        atmosphere.visible = false;
        nebula.visible = false;
        nebula2.visible = false;
    };

    const applySkyCamera = () => {
        camera.position.set(0, -0.2, 0.01);
        camera.rotation.set(-Math.PI / 2 + 0.15, 0, 0);
        camera.fov = 68;
        camera.updateProjectionMatrix();
    };

    if (opts.skipIntro) {
        finishIntro();
        applySkyCamera();
    }

    const tick = (now: number) => {
        raf = requestAnimationFrame(tick);
        if (paused) return;

        const elapsedIntro = now - introStart;
        const t = introSkipped ? 1 : Math.min(1, elapsedIntro / INTRO_MS);

        if (phase === 'intro') {
            const e = easeInOutCubic(t);
            const z = -140 + e * 132;
            const y = Math.sin(e * Math.PI) * 6 - e * 4;
            camera.position.set(Math.sin(e * 0.8) * 8, y, z);
            camera.lookAt(earth.position);
            earth.rotation.y = e * 1.2;
            starFar.rotation.y = e * 0.05;
            starMid.rotation.y = e * 0.08;
            starNear.rotation.y = e * 0.12;
            (nebulaMat as import('three').SpriteMaterial).opacity = 0.25 + e * 0.15;
            renderer.toneMappingExposure = 0.85 + e * 0.35;
            travelFog.density = 0.001 + e * 0.004;

            if (t >= 1) {
                finishIntro();
                applySkyCamera();
            }
        } else {
            shootingT += 0.016;
            const tw = 0.5 + Math.sin(shootingT * 1.7) * 0.12;
            (starNear.material as import('three').PointsMaterial).opacity = tw;
            starMid.rotation.z = Math.sin(shootingT * 0.05) * 0.02;
            starFar.rotation.y += 0.00008;
            if (Math.random() < 0.004) {
                const streak = new THREE.Line(
                    new THREE.BufferGeometry().setFromPoints([
                        new THREE.Vector3((Math.random() - 0.5) * 40, 20 + Math.random() * 20, -30),
                        new THREE.Vector3(
                            (Math.random() - 0.5) * 40 + 4,
                            10 + Math.random() * 10,
                            -28,
                        ),
                    ]),
                    new THREE.LineBasicMaterial({
                        color: 0xffffff,
                        transparent: true,
                        opacity: 0.7,
                    }),
                );
                scene.add(streak);
                setTimeout(() => {
                    scene.remove(streak);
                    streak.geometry.dispose();
                    (streak.material as Material).dispose();
                }, 420);
            }
            renderer.toneMappingExposure = 0.55;
        }

        renderer.render(scene, camera);
    };
    raf = requestAnimationFrame(tick);

    return {
        skipIntro: () => {
            introSkipped = true;
            introStart = performance.now() - INTRO_MS;
            finishIntro();
            applySkyCamera();
        },
        dispose: () => {
            cancelAnimationFrame(raf);
            ro.disconnect();
            document.removeEventListener('visibilitychange', onVis);
            meshes.forEach((m) => scene.remove(m));
            points.forEach((p) => scene.remove(p));
            scene.remove(nebula);
            scene.remove(nebula2);
            renderer.dispose();
            disposables.forEach((d) => d.dispose());
            earthGeo.dispose();
            atmoGeo.dispose();
        },
    };
}
