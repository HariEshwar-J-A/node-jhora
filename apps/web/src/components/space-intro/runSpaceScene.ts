import type { BufferGeometry, Material, Points, Texture } from 'three';

export type SpaceScenePhase = 'intro' | 'sky';

export type SpaceSceneHandle = {
    skipIntro: () => void;
    setParallax: (scrollY: number) => void;
    dispose: () => void;
};

export type MountSpaceSceneOptions = {
    mobile: boolean;
    skipIntro: boolean;
    /** Light theme: night sky only, no Earth flight. */
    skyOnly?: boolean;
    reducedMotion?: boolean;
    textureBase: string;
    onIntroComplete: () => void;
    onPhaseChange?: (phase: SpaceScenePhase) => void;
};

const INTRO_MS = 7500;
const REDUCED_MS = 1500;
const EARTH_R = 6.4;
const EARTH_YAW = -2.62;
const EARTH_TILT = 0.41;

function clamp01(v: number): number {
    return Math.min(1, Math.max(0, v));
}

function lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
}

function smoothstep(edge0: number, edge1: number, x: number): number {
    const t = clamp01((x - edge0) / (edge1 - edge0));
    return t * t * (3 - 2 * t);
}

function smootherstep(t: number): number {
    const x = clamp01(t);
    return x * x * x * (x * (x * 6 - 15) + 10);
}

function easeInCubic(t: number): number {
    const x = clamp01(t);
    return x * x * x;
}

function buildStars(THREE: typeof import('three'), count: number) {
    const positions = new Float32Array(count * 3);
    const magnitudes = new Float32Array(count);
    const phases = new Float32Array(count);
    for (let i = 0; i < count; i++) {
        const theta = 2 * Math.PI * Math.random();
        const phi = Math.acos(2 * Math.random() - 1);
        const radius = 110 + Math.random() * 90;
        positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
        positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
        positions[i * 3 + 2] = radius * Math.cos(phi);
        magnitudes[i] = Math.pow(Math.random(), 2.2);
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
            uPixelRatio: { value: 1 },
        },
        vertexShader: `
          attribute float magnitude;
          attribute float phase;
          uniform float uTime;
          uniform float uPixelRatio;
          varying float vMag;
          varying float vTwinkle;
          varying float vPhase;
          void main() {
            vMag = magnitude;
            vPhase = phase;
            float tw = sin(uTime * (1.4 + magnitude * 3.2) + phase);
            vTwinkle = 0.72 + 0.28 * tw * tw;
            vec4 mv = modelViewMatrix * vec4(position, 1.0);
            float size = (0.7 + pow(magnitude, 1.4) * 1.35) * uPixelRatio;
            size *= clamp(70.0 / max(1.0, -mv.z), 0.5, 1.1);
            gl_PointSize = clamp(size, 1.0, 2.4);
            gl_Position = projectionMatrix * mv;
          }
        `,
        fragmentShader: `
          varying float vMag;
          varying float vTwinkle;
          varying float vPhase;
          void main() {
            vec2 c = gl_PointCoord - vec2(0.5);
            float r = length(c);
            if (r > 0.5) discard;
            float core = smoothstep(0.16, 0.0, r);
            float spikes = 0.0;
            if (vMag > 0.72) {
              float sx = smoothstep(0.045, 0.0, abs(c.y)) * smoothstep(0.5, 0.12, abs(c.x));
              float sy = smoothstep(0.045, 0.0, abs(c.x)) * smoothstep(0.5, 0.12, abs(c.y));
              spikes = (sx + sy) * smoothstep(0.72, 0.95, vMag);
            }
            float alpha = (core + spikes * 0.85) * vTwinkle;
            if (alpha < 0.02) discard;
            float warm = step(0.62, fract(vPhase * 1.7));
            vec3 col = mix(vec3(0.94, 0.94, 0.96), vec3(1.0, 0.95, 0.88), warm);
            col = mix(col, vec3(1.0), core * 0.65);
            gl_FragColor = vec4(col, alpha);
          }
        `,
    });
    return new THREE.Points(geo, mat);
}

function sunTexture(THREE: typeof import('three')) {
    const size = 64;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.18, 'rgba(255,236,200,0.95)');
    g.addColorStop(0.45, 'rgba(255,200,120,0.28)');
    g.addColorStop(1, 'rgba(255,180,80,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
}

function configureMap(THREE: typeof import('three'), tex: Texture, color: boolean, aniso: number) {
    tex.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.anisotropy = aniso;
    tex.flipY = true;
}

const SKY_CLEAR = 0x090909;

async function mountSkyBackdrop(
    canvas: HTMLCanvasElement,
    opts: MountSpaceSceneOptions,
): Promise<SpaceSceneHandle> {
    const THREE = await import('three');
    const disposables: { dispose: () => void }[] = [];
    const track = <T extends { dispose: () => void }>(item: T): T => {
        disposables.push(item);
        return item;
    };
    const renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: !opts.mobile,
        alpha: false,
        powerPreference: 'high-performance',
    });
    const maxDpr = opts.mobile ? 1.25 : 1.5;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxDpr));
    renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = opts.mobile ? 1.02 : 1.08;
    renderer.setClearColor(SKY_CLEAR, 1);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(68, 1, 0.08, 900);
    scene.add(camera);
    const skyRig = new THREE.Object3D();
    skyRig.position.set(0, -0.12, 0.04);
    skyRig.rotation.set(-Math.PI / 2 + 0.22, 0.18, 0.04);
    const skyPos = skyRig.position.clone();
    const skyQuat = skyRig.quaternion.clone();

    const starCounts = opts.mobile ? [720, 380, 160] : [2600, 1500, 640];
    const starGroups = starCounts.map((count) => {
        const pts = buildStars(THREE, count);
        scene.add(pts);
        track(pts.geometry);
        track(pts.material as Material);
        return pts;
    });

    const [{ EffectComposer }, { RenderPass }, { OutputPass }] = await Promise.all([
        import('three/addons/postprocessing/EffectComposer.js'),
        import('three/addons/postprocessing/RenderPass.js'),
        import('three/addons/postprocessing/OutputPass.js'),
    ]);
    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    if (!opts.mobile) {
        const { UnrealBloomPass } = await import('three/addons/postprocessing/UnrealBloomPass.js');
        composer.addPass(
            new UnrealBloomPass(
                new THREE.Vector2(
                    Math.max(1, canvas.clientWidth / 2),
                    Math.max(1, canvas.clientHeight / 2),
                ),
                0.22,
                0.32,
                0.86,
            ),
        );
    }
    composer.addPass(new OutputPass());
    track(composer);

    const streaks: { line: import('three').Line; head: Points; life: number }[] = [];
    const spawnStreak = () => {
        const x0 = (Math.random() - 0.5) * 46;
        const y0 = 18 + Math.random() * 22;
        const z0 = -30 - Math.random() * 18;
        const len = 7 + Math.random() * 9;
        const ang = -0.7 - Math.random() * 0.35;
        const headPos = new THREE.Vector3(x0, y0, z0);
        const tail = new THREE.Vector3(x0 + Math.cos(ang) * len, y0 + Math.sin(ang) * len, z0);
        const line = new THREE.Line(
            new THREE.BufferGeometry().setFromPoints([tail, headPos]),
            new THREE.LineBasicMaterial({
                color: 0xffffff,
                transparent: true,
                opacity: 0.9,
                blending: THREE.AdditiveBlending,
            }),
        );
        const head = new THREE.Points(
            new THREE.BufferGeometry().setAttribute(
                'position',
                new THREE.Float32BufferAttribute([headPos.x, headPos.y, headPos.z], 3),
            ),
            new THREE.PointsMaterial({
                size: 1.6,
                sizeAttenuation: true,
                color: 0xffffff,
                transparent: true,
                opacity: 1,
                blending: THREE.AdditiveBlending,
                depthWrite: false,
            }),
        );
        scene.add(line);
        scene.add(head);
        streaks.push({ line, head, life: 0 });
    };
    const tickStreaks = () => {
        for (let i = streaks.length - 1; i >= 0; i--) {
            const streak = streaks[i]!;
            streak.life += 1;
            (streak.line.material as import('three').LineBasicMaterial).opacity = Math.max(
                0,
                0.9 - streak.life * 0.07,
            );
            (streak.head.material as import('three').PointsMaterial).opacity = Math.max(
                0,
                1 - streak.life * 0.1,
            );
            if (streak.life > 16) {
                scene.remove(streak.line);
                scene.remove(streak.head);
                streak.line.geometry.dispose();
                (streak.line.material as Material).dispose();
                streak.head.geometry.dispose();
                (streak.head.material as Material).dispose();
                streaks.splice(i, 1);
            }
        }
    };

    let parallax = 0;
    let raf = 0;
    let paused = false;
    let shootAcc = 1.4;
    const started = performance.now();
    const resize = () => {
        const w = canvas.clientWidth;
        const h = canvas.clientHeight;
        if (w <= 0 || h <= 0) return;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxDpr));
        renderer.setSize(w, h, false);
        composer.setSize(w, h);
        const pr = renderer.getPixelRatio();
        for (const pts of starGroups) {
            (pts.material as import('three').ShaderMaterial).uniforms.uPixelRatio.value = pr;
        }
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    const onVis = () => {
        paused = document.hidden;
    };
    document.addEventListener('visibilitychange', onVis);
    canvas.dataset.intro = '1';
    opts.onPhaseChange?.('sky');
    opts.onIntroComplete();

    const tick = (now: number) => {
        raf = requestAnimationFrame(tick);
        if (paused) return;
        const shift = Math.max(-1.4, Math.min(1.4, parallax * 0.00032));
        camera.position.copy(skyPos);
        camera.quaternion.copy(skyQuat);
        camera.position.x += shift * 8;
        camera.position.y += shift * 2.2;
        camera.rotateZ(shift * 0.06);
        shootAcc += 0.016;
        if (shootAcc > 2.6) {
            shootAcc = 0;
            spawnStreak();
        }
        tickStreaks();
        const elapsed = (now - started) / 1000;
        for (const pts of starGroups) {
            (pts.material as import('three').ShaderMaterial).uniforms.uTime.value = elapsed;
        }
        composer.render();
    };
    raf = requestAnimationFrame(tick);

    return {
        skipIntro() {},
        setParallax(scrollY: number) {
            parallax = scrollY;
        },
        dispose() {
            cancelAnimationFrame(raf);
            ro.disconnect();
            document.removeEventListener('visibilitychange', onVis);
            for (const streak of streaks) {
                scene.remove(streak.line);
                scene.remove(streak.head);
                streak.line.geometry.dispose();
                (streak.line.material as Material).dispose();
                streak.head.geometry.dispose();
                (streak.head.material as Material).dispose();
            }
            composer.passes.forEach((pass) => pass.dispose());
            renderer.dispose();
            for (const item of disposables) item.dispose();
        },
    };
}

export async function mountSpaceScene(
    canvas: HTMLCanvasElement,
    opts: MountSpaceSceneOptions,
): Promise<SpaceSceneHandle> {
    if (opts.skyOnly) return mountSkyBackdrop(canvas, opts);
    const THREE = await import('three');
    const reduced = opts.reducedMotion === true;
    const duration = reduced ? REDUCED_MS : INTRO_MS;
    const disposables: { dispose: () => void }[] = [];
    const track = <T extends { dispose: () => void }>(item: T): T => {
        disposables.push(item);
        return item;
    };

    const renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: !opts.mobile,
        alpha: false,
        powerPreference: 'high-performance',
    });
    const maxDpr = opts.mobile ? 1.25 : 1.5;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxDpr));
    renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = opts.mobile ? 1.02 : 1.08;
    renderer.setClearColor(SKY_CLEAR, 1);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, 1, 0.08, 900);
    scene.add(camera);

    const aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    const starCounts = opts.mobile ? [720, 380, 160] : [2600, 1500, 640];
    const starGroups = starCounts.map((count) => {
        const pts = buildStars(THREE, count);
        scene.add(pts);
        track(pts.geometry);
        track(pts.material as Material);
        return pts;
    });

    const loader = new THREE.TextureLoader();
    const suffix = opts.mobile ? 'mobile' : 'desktop';
    const base = opts.textureBase;
    let texturesReady = false;
    let pendingTextures = 6;
    const markTex = () => {
        pendingTextures -= 1;
        if (pendingTextures <= 0) texturesReady = true;
    };
    const loadMap = (url: string, color: boolean, anisoLevel: number) => {
        const tex = loader.load(url, markTex, undefined, markTex);
        configureMap(THREE, tex, color, anisoLevel);
        track(tex);
        return tex;
    };
    const dayMap = loadMap(`${base}earth-day-${suffix}.webp`, true, aniso);
    const nightMap = loadMap(`${base}earth-night-${suffix}.webp`, true, aniso);
    const cloudMap = loadMap(`${base}earth-clouds-${suffix}.webp`, false, aniso);
    const specMap = loadMap(`${base}earth-spec-${suffix}.webp`, false, 1);
    const normalMap = loadMap(`${base}earth-normal-${suffix}.webp`, false, 4);
    const moonMap = loadMap(`${base}earth-moon.webp`, true, 4);
    window.setTimeout(() => {
        texturesReady = true;
    }, 4000);

    const sunDir = new THREE.Vector3(-0.42, 0.34, 0.84).normalize();
    const segs = opts.mobile ? 48 : 96;
    const hSegs = opts.mobile ? 32 : 64;

    const earthGeo = track(new THREE.SphereGeometry(EARTH_R, segs, hSegs));
    const earthMat = track(
        new THREE.ShaderMaterial({
            uniforms: {
                uDay: { value: dayMap },
                uNight: { value: nightMap },
                uSpec: { value: specMap },
                uNormal: { value: normalMap },
                uCloud: { value: cloudMap },
                uSunDir: { value: sunDir },
                uCloudOffset: { value: 0 },
                uOpacity: { value: 1 },
            },
            transparent: true,
            vertexShader: `
              varying vec2 vUv;
              varying vec3 vWorldPos;
              varying vec3 vWorldNormal;
              void main() {
                vUv = uv;
                vec4 worldPos = modelMatrix * vec4(position, 1.0);
                vWorldPos = worldPos.xyz;
                vWorldNormal = normalize(mat3(modelMatrix) * normal);
                gl_Position = projectionMatrix * viewMatrix * worldPos;
              }
            `,
            fragmentShader: `
              uniform sampler2D uDay;
              uniform sampler2D uNight;
              uniform sampler2D uSpec;
              uniform sampler2D uNormal;
              uniform sampler2D uCloud;
              uniform vec3 uSunDir;
              uniform float uCloudOffset;
              uniform float uOpacity;
              varying vec2 vUv;
              varying vec3 vWorldPos;
              varying vec3 vWorldNormal;
              void main() {
                vec3 N = normalize(vWorldNormal);
                vec3 dp1 = dFdx(vWorldPos);
                vec3 dp2 = dFdy(vWorldPos);
                vec2 duv1 = dFdx(vUv);
                vec2 duv2 = dFdy(vUv);
                vec3 dp2perp = cross(dp2, N);
                vec3 dp1perp = cross(N, dp1);
                vec3 T = dp2perp * duv1.x + dp1perp * duv2.x;
                vec3 B = dp2perp * duv1.y + dp1perp * duv2.y;
                float invmax = inversesqrt(max(dot(T, T), dot(B, B)));
                mat3 tbn = mat3(T * invmax, B * invmax, N);

                float specMask = texture2D(uSpec, vUv).r;
                float land = 1.0 - smoothstep(0.42, 0.72, specMask);
                vec3 nTex = texture2D(uNormal, vUv).xyz * 2.0 - 1.0;
                nTex.xy *= land * 1.25;
                vec3 Nn = normalize(tbn * nTex);

                vec3 L = normalize(uSunDir);
                float ndl = dot(Nn, L);
                float dayFactor = smoothstep(-0.14, 0.28, ndl);
                vec3 dayCol = texture2D(uDay, vUv).rgb;
                vec3 nightCol = texture2D(uNight, vUv).rgb;
                float nightLuma = dot(nightCol, vec3(0.299, 0.587, 0.114));
                float cities = smoothstep(0.05, 0.4, nightLuma);
                vec3 cityCol = nightCol * vec3(1.2, 0.82, 0.48) * (0.9 + cities * 1.8);

                vec2 cloudUv = vec2(fract(vUv.x + uCloudOffset), vUv.y);
                float cloud = texture2D(uCloud, cloudUv).r;
                float cloudAmt = smoothstep(0.28, 0.82, cloud);
                float shadow = mix(1.0, 0.62, cloudAmt * dayFactor);

                vec3 color = dayCol * (0.045 + 0.96 * dayFactor) * shadow;
                color += cityCol * (1.0 - dayFactor);
                color *= mix(0.78, 1.0, pow(clamp(dot(Nn, normalize(cameraPosition - vWorldPos)), 0.0, 1.0), 0.45));

                vec3 V = normalize(cameraPosition - vWorldPos);
                vec3 H = normalize(L + V);
                float spec = pow(max(dot(Nn, H), 0.0), 90.0) * specMask * dayFactor;
                color += spec * vec3(0.55, 0.5, 0.4);

                gl_FragColor = vec4(color, uOpacity);
              }
            `,
        }),
    );
    const earth = new THREE.Mesh(earthGeo, earthMat);
    earth.rotation.order = 'YXZ';
    scene.add(earth);

    const cloudMat = track(
        new THREE.ShaderMaterial({
            uniforms: { uCloud: { value: cloudMap }, uAlpha: { value: 0.92 } },
            transparent: true,
            depthWrite: false,
            vertexShader: `
              varying vec2 vUv;
              void main() {
                vUv = uv;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
              }
            `,
            fragmentShader: `
              uniform sampler2D uCloud;
              uniform float uAlpha;
              varying vec2 vUv;
              void main() {
                float c = texture2D(uCloud, vUv).r;
                float a = smoothstep(0.32, 0.88, c) * uAlpha;
                if (a < 0.02) discard;
                gl_FragColor = vec4(vec3(0.97, 0.98, 1.0), a);
              }
            `,
        }),
    );
    const clouds = new THREE.Mesh(track(new THREE.SphereGeometry(6.58, segs, hSegs)), cloudMat);
    clouds.rotation.order = 'YXZ';
    scene.add(clouds);
    const cloudMatFar = track(cloudMat.clone());
    cloudMatFar.uniforms.uAlpha.value = 0.45;
    const cloudsFar = new THREE.Mesh(
        track(new THREE.SphereGeometry(7.18, opts.mobile ? 40 : 64, opts.mobile ? 24 : 40)),
        cloudMatFar,
    );
    cloudsFar.rotation.order = 'YXZ';
    scene.add(cloudsFar);

    const atmoMat = track(
        new THREE.ShaderMaterial({
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            side: THREE.FrontSide,
            uniforms: { uSunDir: { value: sunDir } },
            vertexShader: `
              varying vec3 vWorldPos;
              varying vec3 vWorldNormal;
              void main() {
                vec4 worldPos = modelMatrix * vec4(position, 1.0);
                vWorldPos = worldPos.xyz;
                vWorldNormal = normalize(mat3(modelMatrix) * normal);
                gl_Position = projectionMatrix * viewMatrix * worldPos;
              }
            `,
            fragmentShader: `
              uniform vec3 uSunDir;
              varying vec3 vWorldPos;
              varying vec3 vWorldNormal;
              void main() {
                vec3 N = normalize(vWorldNormal);
                vec3 V = normalize(cameraPosition - vWorldPos);
                float ndv = clamp(dot(N, V), 0.0, 1.0);
                float rim = pow(1.0 - ndv, 3.05);
                float mu = pow(max(dot(N, normalize(uSunDir)), 0.0), 1.5);
                vec3 rayleigh = vec3(0.28, 0.5, 1.0);
                vec3 mie = vec3(1.0, 0.78, 0.5);
                vec3 col = mix(rayleigh, mie, mu * 0.55);
                gl_FragColor = vec4(col, rim * (0.95 + mu * 0.65));
              }
            `,
        }),
    );
    const atmosphere = new THREE.Mesh(
        track(new THREE.SphereGeometry(7.45, opts.mobile ? 40 : 64, opts.mobile ? 28 : 48)),
        atmoMat,
    );
    scene.add(atmosphere);

    const moon = new THREE.Mesh(
        track(new THREE.SphereGeometry(1.15, opts.mobile ? 24 : 40, opts.mobile ? 16 : 28)),
        track(
            new THREE.MeshStandardMaterial({
                map: moonMap,
                roughness: 0.96,
                metalness: 0,
            }),
        ),
    );
    moon.position.set(-6, 14, -34);
    scene.add(moon);

    scene.add(new THREE.AmbientLight(0x8aa0c8, 0.08));
    const sun = new THREE.DirectionalLight(0xfff4e5, 2.5);
    sun.position.copy(sunDir).multiplyScalar(40);
    scene.add(sun);

    const sunSprite = new THREE.Sprite(
        track(
            new THREE.SpriteMaterial({
                map: track(sunTexture(THREE)),
                color: new THREE.Color().setRGB(1.7, 1.4, 1.05),
                blending: THREE.AdditiveBlending,
                transparent: true,
                depthWrite: false,
                toneMapped: false,
            }),
        ),
    );
    sunSprite.position.copy(sunDir).multiplyScalar(78);
    sunSprite.scale.set(opts.mobile ? 7 : 11, opts.mobile ? 7 : 11, 1);
    scene.add(sunSprite);

    const flash = new THREE.Mesh(
        track(new THREE.PlaneGeometry(8, 8)),
        track(
            new THREE.MeshBasicMaterial({
                color: 0xf7fbff,
                transparent: true,
                opacity: 0,
                depthTest: false,
                depthWrite: false,
                toneMapped: false,
            }),
        ),
    );
    flash.position.set(0, 0, -0.35);
    flash.renderOrder = 20;
    flash.frustumCulled = false;
    camera.add(flash);

    let composer: import('three/addons/postprocessing/EffectComposer.js').EffectComposer | null =
        null;
    let bloomPass: import('three/addons/postprocessing/UnrealBloomPass.js').UnrealBloomPass | null =
        null;
    const [{ EffectComposer }, { RenderPass }, { OutputPass }] = await Promise.all([
        import('three/addons/postprocessing/EffectComposer.js'),
        import('three/addons/postprocessing/RenderPass.js'),
        import('three/addons/postprocessing/OutputPass.js'),
    ]);
    composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    if (!opts.mobile) {
        const { UnrealBloomPass } = await import('three/addons/postprocessing/UnrealBloomPass.js');
        const bloomRes = new THREE.Vector2(
            Math.max(1, canvas.clientWidth / 2),
            Math.max(1, canvas.clientHeight / 2),
        );
        bloomPass = new UnrealBloomPass(bloomRes, 0.28, 0.36, 0.86);
        composer.addPass(bloomPass);
    }
    composer.addPass(new OutputPass());
    track(composer);

    const WORLD_UP = new THREE.Vector3(0, 1, 0);
    const ORIGIN = new THREE.Vector3(0, 0, 0);
    const pos = new THREE.Vector3();
    const outward = new THREE.Vector3();
    const rolledUp = new THREE.Vector3();
    const lookTarget = new THREE.Vector3();
    const qDown = new THREE.Quaternion();
    const qOut = new THREE.Quaternion();
    const qFlight = new THREE.Quaternion();
    const qTmp = new THREE.Quaternion();
    // Camera, not Object3D: Object3D.lookAt aims +Z, so a camera given that
    // quaternion looks away from the target.
    const rig = new THREE.PerspectiveCamera();
    const skyRig = new THREE.Object3D();
    skyRig.position.set(0, -0.12, 0.04);
    skyRig.rotation.set(-Math.PI / 2 + 0.22, 0.18, 0.04);
    const SKY_POS = skyRig.position.clone();
    const SKY_QUAT = skyRig.quaternion.clone();

    const beautyAz = -0.72;
    const beautyEl = 0.3;
    const beautyDist = 20;

    function orbit(dist: number, az: number, el: number, target: import('three').Vector3) {
        const ce = Math.cos(el);
        target.set(ce * Math.sin(az) * dist, Math.sin(el) * dist, ce * Math.cos(az) * dist);
    }

    function lookQuat(
        eye: import('three').Vector3,
        target: import('three').Vector3,
        up: import('three').Vector3,
        out: import('three').Quaternion,
    ) {
        rig.position.copy(eye);
        rig.up.copy(up);
        rig.lookAt(target);
        out.copy(rig.quaternion);
    }

    function slerpSafe(
        from: import('three').Quaternion,
        to: import('three').Quaternion,
        t: number,
        out: import('three').Quaternion,
    ) {
        qTmp.copy(to);
        if (from.dot(qTmp) < 0) qTmp.set(-qTmp.x, -qTmp.y, -qTmp.z, -qTmp.w);
        out.copy(from).slerp(qTmp, t);
    }

    function fovAt(t: number): number {
        if (reduced) return 36;
        if (t < 0.533) return lerp(42, 34, smoothstep(0, 0.533, t));
        if (t < 0.66) return lerp(34, 52, easeInCubic((t - 0.533) / 0.127));
        if (t < 0.84) return lerp(52, 62, smoothstep(0.66, 0.84, t));
        return lerp(62, 68, smoothstep(0.84, 1, t));
    }

    let flightGone = false;

    function placeFlight(t: number) {
        if (reduced) {
            const cover = t < 0.5 ? smootherstep(t / 0.5) : 1 - smootherstep((t - 0.5) / 0.5);
            (flash.material as import('three').MeshBasicMaterial).opacity = cover;
            if (t < 0.5) {
                orbit(beautyDist, beautyAz, beautyEl, pos);
                lookQuat(pos, ORIGIN, WORLD_UP, qFlight);
                if (!flightGone) earthMat.uniforms.uOpacity.value = 1;
            } else {
                pos.copy(SKY_POS);
                qFlight.copy(SKY_QUAT);
                if (!flightGone) earthMat.uniforms.uOpacity.value = 0;
            }
            camera.fov = 36;
        } else {
            let dist: number;
            if (t < 0.533) dist = lerp(64, 18.5, smoothstep(0, 0.533, t));
            else if (t < 0.66) dist = lerp(18.5, 7.15, easeInCubic((t - 0.533) / 0.127));
            else if (t < 0.84) dist = lerp(7.15, 12.5, smoothstep(0.66, 0.84, t));
            else dist = 12.5;

            const approach = smoothstep(0, 0.62, t);
            const az = lerp(-1.05, 0.42, approach);
            const el = lerp(0.38, 0.05, approach);
            orbit(dist, az, el, pos);

            const roll = smoothstep(0.62, 0.88, t);
            lookQuat(pos, ORIGIN, WORLD_UP, qDown);
            outward.copy(pos).normalize();
            rolledUp.copy(WORLD_UP).applyAxisAngle(outward, roll * Math.PI);
            lookTarget.copy(pos).add(outward);
            lookQuat(pos, lookTarget, rolledUp, qOut);
            slerpSafe(qDown, qOut, smootherstep(roll), qFlight);

            const settle = smoothstep(0.84, 1, t);
            if (settle > 0) {
                pos.lerp(SKY_POS, smootherstep(settle));
                slerpSafe(qFlight, SKY_QUAT, smootherstep(settle), qFlight);
            }

            const hazeIn = smoothstep(0.6, 0.66, t);
            const hazeOut = 1 - smoothstep(0.68, 0.75, t);
            (flash.material as import('three').MeshBasicMaterial).opacity =
                Math.min(hazeIn, hazeOut) * 0.68;
            if (!flightGone) earthMat.uniforms.uOpacity.value = 1 - smoothstep(0.76, 0.88, t);
            camera.fov = fovAt(t);
        }

        camera.position.copy(pos);
        camera.quaternion.copy(qFlight);
        camera.updateProjectionMatrix();
    }

    let spin = 0;
    let cloudLead = 0.18;
    function posePlanet(time: number, rush: number) {
        if (flightGone) return;
        spin = time * 0.035;
        cloudLead += (0.012 + rush) * 0.016;
        earth.rotation.y = EARTH_YAW + spin;
        earth.rotation.z = EARTH_TILT;
        clouds.rotation.y = EARTH_YAW + spin + cloudLead;
        clouds.rotation.z = EARTH_TILT;
        cloudsFar.rotation.y = EARTH_YAW + spin + cloudLead * 1.8;
        cloudsFar.rotation.z = EARTH_TILT;
        atmosphere.rotation.z = EARTH_TILT;
        earthMat.uniforms.uCloudOffset.value = cloudLead / (Math.PI * 2);
        const fade = earthMat.uniforms.uOpacity.value as number;
        earthMat.depthWrite = fade > 0.85;
        earth.visible = fade > 0.02;
        const showShell = earth.visible;
        clouds.visible = showShell;
        cloudsFar.visible = showShell;
        atmosphere.visible = showShell;
    }

    function dropDisposed(item: { dispose: () => void }) {
        const index = disposables.indexOf(item);
        if (index >= 0) disposables.splice(index, 1);
        item.dispose();
    }
    function releaseFlight() {
        if (flightGone) return;
        flightGone = true;
        scene.remove(earth, clouds, cloudsFar, atmosphere, moon, sunSprite);
        dropDisposed(earthGeo);
        dropDisposed(earthMat);
        dropDisposed(clouds.geometry as BufferGeometry);
        dropDisposed(cloudMat);
        dropDisposed(cloudsFar.geometry as BufferGeometry);
        dropDisposed(cloudMatFar);
        dropDisposed(atmosphere.geometry as BufferGeometry);
        dropDisposed(atmoMat);
        dropDisposed(moon.geometry as BufferGeometry);
        dropDisposed(moon.material as Material);
        dropDisposed(dayMap);
        dropDisposed(nightMap);
        dropDisposed(cloudMap);
        dropDisposed(specMap);
        dropDisposed(normalMap);
        dropDisposed(moonMap);
        dropDisposed((sunSprite.material as import('three').SpriteMaterial).map as Texture);
        dropDisposed(sunSprite.material as Material);
        if (bloomPass && composer) {
            composer.removePass(bloomPass);
            bloomPass.dispose();
            bloomPass = null;
        }
    }

    const streaks: { line: import('three').Line; head: Points; life: number }[] = [];
    function spawnStreak() {
        const x0 = (Math.random() - 0.5) * 46;
        const y0 = 18 + Math.random() * 22;
        const z0 = -30 - Math.random() * 18;
        const len = 7 + Math.random() * 9;
        const ang = -0.7 - Math.random() * 0.35;
        const headPos = new THREE.Vector3(x0, y0, z0);
        const tail = new THREE.Vector3(x0 + Math.cos(ang) * len, y0 + Math.sin(ang) * len, z0);
        const streakGeo = new THREE.BufferGeometry().setFromPoints([tail, headPos]);
        const streakMat = new THREE.LineBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.9,
            blending: THREE.AdditiveBlending,
        });
        const line = new THREE.Line(streakGeo, streakMat);
        const head = new THREE.Points(
            new THREE.BufferGeometry().setAttribute(
                'position',
                new THREE.Float32BufferAttribute([headPos.x, headPos.y, headPos.z], 3),
            ),
            new THREE.PointsMaterial({
                size: 1.6,
                sizeAttenuation: true,
                color: 0xffffff,
                transparent: true,
                opacity: 1,
                blending: THREE.AdditiveBlending,
                depthWrite: false,
            }),
        );
        scene.add(line);
        scene.add(head);
        streaks.push({ line, head, life: 0 });
    }

    function tickStreaks() {
        for (let i = streaks.length - 1; i >= 0; i--) {
            const s = streaks[i];
            s.life += 1;
            (s.line.material as import('three').LineBasicMaterial).opacity = Math.max(
                0,
                0.9 - s.life * 0.07,
            );
            (s.head.material as import('three').PointsMaterial).opacity = Math.max(
                0,
                1 - s.life * 0.1,
            );
            if (s.life > 16) {
                scene.remove(s.line);
                scene.remove(s.head);
                s.line.geometry.dispose();
                (s.line.material as Material).dispose();
                s.head.geometry.dispose();
                (s.head.material as Material).dispose();
                streaks.splice(i, 1);
            }
        }
    }

    let parallax = 0;
    let introStart = 0;
    let clockStarted = false;
    let skySent = false;
    let completed = false;
    let raf = 0;
    let paused = false;
    let shootAcc = 0;
    let elapsed = 0;

    const resize = () => {
        const w = canvas.clientWidth;
        const h = canvas.clientHeight;
        if (w <= 0 || h <= 0) return;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxDpr));
        renderer.setSize(w, h, false);
        composer?.setSize(w, h);
        const pr = renderer.getPixelRatio();
        for (const pts of starGroups) {
            (pts.material as import('three').ShaderMaterial).uniforms.uPixelRatio.value = pr;
        }
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    const onVis = () => {
        paused = document.hidden;
    };
    document.addEventListener('visibilitychange', onVis);

    function sendSky() {
        if (skySent) return;
        skySent = true;
        opts.onPhaseChange?.('sky');
    }

    function completeIntro() {
        if (completed) return;
        completed = true;
        releaseFlight();
        sendSky();
        (flash.material as import('three').MeshBasicMaterial).opacity = 0;
        camera.position.copy(SKY_POS);
        camera.quaternion.copy(SKY_QUAT);
        camera.fov = reduced ? 36 : 68;
        camera.updateProjectionMatrix();
        canvas.dataset.intro = '1';
        opts.onIntroComplete();
    }

    if (opts.skipIntro) {
        texturesReady = true;
        clockStarted = true;
        completeIntro();
    } else {
        placeFlight(0);
        posePlanet(0, 0);
    }

    const renderFrame = () => {
        if (composer) composer.render();
        else renderer.render(scene, camera);
    };

    const tick = (now: number) => {
        raf = requestAnimationFrame(tick);
        if (paused) return;
        if (!texturesReady) {
            canvas.dataset.intro = '-1';
            placeFlight(0);
            renderFrame();
            return;
        }
        if (!clockStarted) {
            clockStarted = true;
            introStart = now;
        }
        elapsed = (now - introStart) / 1000;
        const heldRaw = canvas.dataset.hold;
        const held = heldRaw === undefined || heldRaw === '' ? Number.NaN : Number(heldRaw);
        const t = completed
            ? 1
            : Number.isFinite(held)
              ? clamp01(held)
              : Math.min(1, (now - introStart) / duration);
        canvas.dataset.intro = t.toFixed(4);

        if (!completed) {
            placeFlight(t);
            const rush = !reduced && t > 0.55 && t < 0.72 ? 1.6 : 0;
            posePlanet(elapsed, rush);
            if (!Number.isFinite(held) || held >= 0.84) {
                if (t >= 0.84) releaseFlight();
            }
            if ((!Number.isFinite(held) || held >= 0.82) && !reduced && t >= 0.82) sendSky();
            if ((!Number.isFinite(held) || held >= 0.5) && reduced && t >= 0.5) sendSky();
            if ((!Number.isFinite(held) || held >= 1) && t >= 1) completeIntro();
        } else {
            const shift = Math.max(-1.4, Math.min(1.4, parallax * 0.00032));
            camera.position.copy(SKY_POS);
            camera.quaternion.copy(SKY_QUAT);
            camera.position.x += shift * 8;
            camera.position.y += shift * 2.2;
            camera.rotateZ(shift * 0.06);
            shootAcc += 0.016;
            if (shootAcc > 2.6) {
                shootAcc = 0;
                spawnStreak();
            }
            tickStreaks();
        }

        const starTime = elapsed;
        for (const pts of starGroups) {
            (pts.material as import('three').ShaderMaterial).uniforms.uTime.value = starTime;
        }
        renderFrame();
    };
    raf = requestAnimationFrame(tick);

    return {
        skipIntro: () => {
            completeIntro();
        },
        setParallax: (scrollY: number) => {
            parallax = scrollY;
        },
        dispose: () => {
            cancelAnimationFrame(raf);
            ro.disconnect();
            document.removeEventListener('visibilitychange', onVis);
            releaseFlight();
            for (const s of streaks) {
                scene.remove(s.line);
                scene.remove(s.head);
                s.line.geometry.dispose();
                (s.line.material as Material).dispose();
                s.head.geometry.dispose();
                (s.head.material as Material).dispose();
            }
            streaks.length = 0;
            for (const pts of starGroups) scene.remove(pts);
            camera.remove(flash);
            scene.remove(camera);
            composer?.passes.forEach((pass) => pass.dispose());
            renderer.dispose();
            for (const item of disposables) item.dispose();
        },
    };
}
