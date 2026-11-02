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
    lightSky?: boolean;
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
    tex.flipY = false;
    return tex;
}

function buildStars(
    THREE: typeof import('three'),
    count: number,
    radius: number,
    lightSky: boolean,
) {
    const positions = new Float32Array(count * 3);
    const magnitudes = new Float32Array(count);
    const phases = new Float32Array(count);
    for (let i = 0; i < count; i++) {
        const u = Math.random();
        const v = Math.random();
        const theta = 2 * Math.PI * u;
        const phi = Math.acos(2 * v - 1);
        const r = radius * (0.85 + Math.random() * 0.15);
        positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
        positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
        positions[i * 3 + 2] = r * Math.cos(phi);
        magnitudes[i] = 0.35 + Math.random() * 0.65;
        phases[i] = Math.random() * Math.PI * 2;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('magnitude', new THREE.BufferAttribute(magnitudes, 1));
    geo.setAttribute('phase', new THREE.BufferAttribute(phases, 1));

    const mat = new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: {
            uTime: { value: 0 },
            uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
            uLightSky: { value: lightSky ? 1 : 0 },
        },
        vertexShader: `
          attribute float magnitude;
          attribute float phase;
          uniform float uTime;
          uniform float uPixelRatio;
          uniform float uLightSky;
          varying float vMag;
          varying float vTwinkle;
          void main() {
            vMag = magnitude;
            vTwinkle = 0.65 + 0.35 * sin(uTime * 2.2 + phase * 6.0);
            vec4 mv = modelViewMatrix * vec4(position, 1.0);
            float size = (1.2 + magnitude * 2.8) * uPixelRatio * (220.0 / -mv.z);
            gl_PointSize = clamp(size, 0.6, 4.5);
            gl_Position = projectionMatrix * mv;
          }
        `,
        fragmentShader: `
          varying float vMag;
          varying float vTwinkle;
          uniform float uLightSky;
          void main() {
            vec2 c = gl_PointCoord - vec2(0.5);
            float r = length(c);
            if (r > 0.5) discard;
            float core = smoothstep(0.22, 0.0, r);
            float glow = exp(-r * 7.0) * 0.55;
            float sparkle = smoothstep(0.48, 0.02, abs(c.x) * abs(c.y) * 12.0) * step(0.82, vMag);
            float alpha = (core + glow + sparkle * 0.35) * vTwinkle * (0.5 + vMag * 0.7);
            vec3 darkCol = mix(vec3(0.12, 0.16, 0.28), vec3(0.05, 0.08, 0.14), vMag);
            vec3 lightCol = mix(vec3(0.82, 0.88, 1.0), vec3(1.0), vMag);
            vec3 col = mix(lightCol, darkCol, uLightSky);
            gl_FragColor = vec4(col, alpha);
          }
        `,
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

    const lightSky = opts.lightSky === true;
    if (lightSky) {
        renderer.setClearColor(0xf8fafc, 1);
    } else {
        renderer.setClearColor(0x02040c, 1);
    }

    const scene = new THREE.Scene();
    const travelFog = new THREE.FogExp2(lightSky ? 0xf0f4f8 : 0x03050a, lightSky ? 0.0025 : 0.0012);
    scene.fog = travelFog;

    const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 800);
    camera.position.set(0, 0, -120);

    const starFar = buildStars(THREE, opts.mobile ? 650 : 3200, 180, lightSky);
    const starMid = buildStars(THREE, opts.mobile ? 420 : 2000, 120, lightSky);
    const starNear = buildStars(THREE, opts.mobile ? 180 : 900, 70, lightSky);
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
    dayMap.flipY = false;
    nightMap.flipY = false;
    dayMap.premultiplyAlpha = false;
    nightMap.premultiplyAlpha = false;

    const gl = renderer.getContext() as WebGL2RenderingContext;
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
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
        scene.fog = new THREE.FogExp2(lightSky ? 0xf8fafc : 0x020308, opts.mobile ? 0.018 : 0.014);
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
            const introT = elapsedIntro * 0.001;
            for (const p of points) {
                const u = (p.material as import('three').ShaderMaterial).uniforms;
                if (u.uTime) u.uTime.value = introT;
            }
            (nebulaMat as import('three').SpriteMaterial).opacity = 0.25 + e * 0.15;
            renderer.toneMappingExposure = 0.85 + e * 0.35;
            travelFog.density = 0.001 + e * 0.004;

            if (t >= 1) {
                finishIntro();
                applySkyCamera();
            }
        } else {
            shootingT += 0.016;
            const t = shootingT;
            for (const p of points) {
                const u = (p.material as import('three').ShaderMaterial).uniforms;
                if (u.uTime) u.uTime.value = t;
            }
            starMid.rotation.z = Math.sin(t * 0.05) * 0.02;
            starFar.rotation.y += 0.00008;
            if (Math.random() < 0.006) {
                const x0 = (Math.random() - 0.5) * 50;
                const y0 = 25 + Math.random() * 25;
                const z0 = -35 - Math.random() * 15;
                const len = 8 + Math.random() * 10;
                const ang = -0.6 - Math.random() * 0.4;
                const head = new THREE.Vector3(x0, y0, z0);
                const tail = new THREE.Vector3(
                    x0 + Math.cos(ang) * len,
                    y0 + Math.sin(ang) * len,
                    z0,
                );
                const streakGeo = new THREE.BufferGeometry().setFromPoints([tail, head]);
                const streakMat = new THREE.LineBasicMaterial({
                    color: 0xffffff,
                    transparent: true,
                    opacity: 0.95,
                    blending: THREE.AdditiveBlending,
                });
                const streak = new THREE.Line(streakGeo, streakMat);
                scene.add(streak);
                const headSprite = new THREE.Points(
                    new THREE.BufferGeometry().setAttribute(
                        'position',
                        new THREE.Float32BufferAttribute([head.x, head.y, head.z], 3),
                    ),
                    new THREE.PointsMaterial({
                        size: 3,
                        sizeAttenuation: true,
                        color: 0xffffff,
                        transparent: true,
                        opacity: 1,
                        blending: THREE.AdditiveBlending,
                        depthWrite: false,
                    }),
                );
                scene.add(headSprite);
                let life = 0;
                const fade = () => {
                    life += 1;
                    streakMat.opacity = Math.max(0, 0.95 - life * 0.08);
                    (headSprite.material as import('three').PointsMaterial).opacity = Math.max(
                        0,
                        1 - life * 0.12,
                    );
                    if (life > 14) {
                        scene.remove(streak);
                        scene.remove(headSprite);
                        streakGeo.dispose();
                        streakMat.dispose();
                        headSprite.geometry.dispose();
                        (headSprite.material as Material).dispose();
                        return;
                    }
                    requestAnimationFrame(fade);
                };
                requestAnimationFrame(fade);
            }
            renderer.toneMappingExposure = 0.62;
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
