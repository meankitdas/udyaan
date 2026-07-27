export type Vec2 = [number, number];

/* ---------- world constants ---------- */

/**
 * The simulation runs in SI units: one world unit is one metre, one second of
 * game time is one second of simulated time, and gravity is Earth's.
 * Every derived quantity below (mass, drag, rolling resistance, blast
 * overpressure) is therefore directly comparable with real measurements.
 */
export const GRAVITY = -9.81;
export const KILL_Y = -13;
/** How close a bursting storm pod must be to damage the crop. */
export const STORM_RADIUS = 3.2;
/** Vines cannot be planted inside this bubble around the crop. */
export const CROP_SAFE_RADIUS = 1.2;
/**
 * Pickup volume for seed packets. A packet only had to touch the crop's solid
 * collider before, which made a delivery flip between hit and miss on sub-
 * centimetre differences in the drawn chute. The reach is a sensor, so it
 * changes nothing about how hazards or the crop actually move.
 */
export const SEED_REACH = 1.5;
export const VINE_RADIUS = 0.2;
/** World units between sampled points of a drawn vine. */
export const VINE_SAMPLE = 0.26;
/** Design area the camera always tries to fit. Wide enough for the outermost
 *  hazard spawns (|x| up to ~7.6 plus its radius) so nothing is cropped. */
export const VIEW = { cx: 0, cy: 0, w: 17, h: 10 };
/** Lowest useful world y, used to frame portrait screens without dead space. */
export const VIEW_FLOOR = -7;
/** Top surface of the main field, used as the reflecting plane for blasts. */
export const SOIL_TOP = -4;

/* ---------- simulation model ---------- */

export const PHYSICS = {
  /**
   * Fixed 120 Hz step. A hailstone falling the full height of the field peaks
   * near 14 m/s, so it advances 0.12 m per step against a 0.4 m thick vine —
   * a 3.4x margin, which keeps contacts from being missed even before CCD.
   */
  timeStep: 1 / 120,
  /** Rapier defaults to 4/1; the field stacks bodies, so solve them harder. */
  solverIterations: 8,
  pgsIterations: 2,
  /** Air density (kg/m^3) expressed on the same scale as material density. */
  airDensity: 0.001225,
  /**
   * Peak overpressure of a bursting storm pod. Sized so a straw bale two
   * metres away is thrown at roughly 5 m/s while a hailstone at the same
   * range barely shifts, which is how a real blast sorts a field by density.
   */
  blastPressure: 3,
  /** Bodies slower than this on a surface are treated as no longer rolling. */
  rollingCutoff: 0.05,
} as const;

/**
 * Material properties taken from standard engineering tables. Densities are
 * relative to water, so a hailstone really is ~6.5x denser than baled straw
 * and impacts transfer momentum in the proportions you would measure in a
 * field. Drag is the dimensionless coefficient for the body's shape and
 * `rolling` is the rolling-resistance coefficient on tilled ground.
 */
export const MATERIALS = {
  ice: { density: 0.917, friction: 0.32, restitution: 0.2, drag: 0.47, rolling: 0.05 },
  hay: { density: 0.14, friction: 0.62, restitution: 0.04, drag: 0.9, rolling: 0.12 },
  wood: { density: 0.55, friction: 0.5, restitution: 0.15, drag: 1.05, rolling: 0.16 },
  pod: { density: 1.0, friction: 0.42, restitution: 0.24, drag: 0.47, rolling: 0.07 },
  paper: { density: 0.35, friction: 0.46, restitution: 0.1, drag: 1.05, rolling: 0.18 },
  plant: { density: 0.45, friction: 1.1, restitution: 0.02, drag: 1.2, rolling: 0.4 },
} as const;

/** Surface properties for the static field geometry and for planted vines. */
export const SURFACES = {
  soil: { friction: 0.8, restitution: 0.04 },
  stone: { friction: 0.62, restitution: 0.22 },
  wood: { friction: 0.48, restitution: 0.16 },
  metal: { friction: 0.28, restitution: 0.38 },
  /** A living vine: fibrous and grippy, not the near-frictionless rail it was. */
  vine: { friction: 0.58, restitution: 0.12 },
} as const;

/** Steady horizontal wind in m/s, which enters the drag model directly. */
export const WIND: Record<Weather, number> = {
  sunny: 0.3,
  breezy: 2.5,
  cloudy: 0.8,
  stormy: 5,
};

export const PALETTE = {
  vine: "#277a45",
  vineGlow: "#65db78",
  leaf: "#3b9a52",
  leafLight: "#72bf4b",
  hail: "#a9d7eb",
  hailDark: "#6da7c1",
  hay: "#dcae45",
  hayDark: "#a66c24",
  crate: "#b87536",
  storm: "#37405f",
  seed: "#f4d35e",
  stone: "#817f70",
  soil: "#80552f",
  grass: "#65a94f",
  wood: "#a56735",
  metal: "#91a3ad",
};

/* ---------- level shapes ---------- */

export type BlockKind = "soil" | "stone" | "wood" | "metal";
export type Weather = "sunny" | "breezy" | "cloudy" | "stormy";

export type Block = {
  x: number;
  y: number;
  w: number;
  h: number;
  /** Rotation about z, in radians. */
  rot?: number;
  kind?: BlockKind;
};

export type HazardKind = "hail" | "hayBale" | "crate" | "stormPod";

export type Hazard = {
  id: string;
  kind: HazardKind;
  x: number;
  y: number;
  /** Radius (hail/hay/storm) or half-extent (crate). */
  size?: number;
  /** Seconds after the run starts before the hazard is released. */
  delay?: number;
  vx?: number;
  vy?: number;
  /** Storm pods only: seconds after release before bursting. */
  fuse?: number;
};

export type SeedPack = {
  id: string;
  x: number;
  y: number;
  delay?: number;
  vx?: number;
};

export type Zone = { x: number; y: number; w: number; h: number };

export type Level = {
  id: string;
  name: string;
  season: string;
  hint: string;
  lesson: string;
  weather: Weather;
  crop: Vec2;
  blocks: Block[];
  hazards: Hazard[];
  seeds?: SeedPack[];
  noPlant?: Zone[];
  /** Total vine length the player may spend. */
  vine: number;
  /** Spend this much or less for the efficiency star. */
  par: number;
  /** Seconds the crop must survive. */
  duration: number;
};

const field = (): Block => ({
  x: 0,
  y: -5.6,
  w: 30,
  h: 3.2,
  kind: "soil",
});

export const LEVELS: Level[] = [
  {
    id: "field-01",
    name: "First Hail",
    season: "Seedling Season",
    hint: "Draw a vine canopy above Sunny, then start the weather.",
    lesson: "A raised canopy can shield young crops from direct hail impact.",
    weather: "sunny",
    crop: [0, -3.2],
    blocks: [field()],
    hazards: [{ id: "h1", kind: "hail", x: 0.15, y: 4.5, size: 0.65 }],
    vine: 12,
    par: 7,
    duration: 5,
  },
  {
    id: "field-02",
    name: "Haywire",
    season: "Windbreak Training",
    hint: "The hay bale will roll downhill. Plant a strong vine in its path.",
    lesson: "Windbreaks and barriers reduce damage from rolling farm debris.",
    weather: "breezy",
    crop: [5.1, -3.2],
    blocks: [
      field(),
      { x: -4, y: -1.6, w: 7.6, h: 0.7, rot: -0.42, kind: "stone" },
    ],
    hazards: [{ id: "h1", kind: "hayBale", x: -7, y: 2.4, size: 0.8 }],
    vine: 16,
    par: 9,
    duration: 9,
  },
  {
    id: "field-03",
    name: "Protected Plot",
    season: "Soil Care",
    hint: "The amber crop bed cannot be planted in. Deflect the hail from above.",
    lesson: "Protect root zones from compaction while controlling hazards around them.",
    weather: "cloudy",
    crop: [0, -3.2],
    blocks: [field()],
    noPlant: [{ x: 0, y: -0.3, w: 6.4, h: 5.6 }],
    hazards: [{ id: "h1", kind: "hail", x: 0.1, y: 4.6, size: 0.7 }],
    vine: 15,
    par: 10,
    duration: 6,
  },
  {
    id: "field-04",
    name: "Seed Delivery",
    season: "Sowing Day",
    hint: "Guide the seed packet to Sunny while shielding the crop from hail.",
    lesson: "Good channels move seed and water where the field needs them.",
    weather: "sunny",
    crop: [3, -3.2],
    blocks: [field()],
    hazards: [{ id: "h1", kind: "hail", x: 3.1, y: 4.6, size: 0.65, delay: 2.1 }],
    seeds: [{ id: "s1", x: -6.4, y: 4 }],
    vine: 22,
    par: 17,
    duration: 10,
  },
  {
    id: "field-05",
    name: "Storm Pod",
    season: "Monsoon Watch",
    hint: "The storm pod bursts on soil or when its charge runs out. Divert it far away.",
    lesson: "Drainage paths move dangerous stormwater away from vulnerable crops.",
    weather: "stormy",
    crop: [0, -3.2],
    blocks: [field()],
    hazards: [{ id: "h1", kind: "stormPod", x: 0.2, y: 4.5, size: 0.58, fuse: 4.8 }],
    vine: 18,
    par: 11,
    duration: 8,
  },
  {
    id: "field-06",
    name: "Hail Season",
    season: "Canopy Design",
    hint: "Vine is limited. A peaked canopy sheds hail better than a flat roof.",
    lesson: "Sloped covers redirect hail and rain instead of collecting their weight.",
    weather: "cloudy",
    crop: [0, -3.2],
    blocks: [field()],
    hazards: [
      { id: "h1", kind: "hail", x: -3.6, y: 4.4, size: 0.48 },
      { id: "h2", kind: "hail", x: -1.7, y: 4.7, size: 0.48, delay: 0.9 },
      { id: "h3", kind: "hail", x: 0.3, y: 4.4, size: 0.48, delay: 1.8 },
      { id: "h4", kind: "hail", x: 2.2, y: 4.7, size: 0.48, delay: 2.7 },
      { id: "h5", kind: "hail", x: 3.9, y: 4.4, size: 0.48, delay: 3.6 },
    ],
    vine: 13,
    par: 10,
    duration: 9.5,
  },
  {
    id: "field-07",
    name: "The Seed Sieve",
    season: "Sorting Shed",
    hint: "A seed packet is small; a hay bale is not. Leave a gap for only one.",
    lesson: "Agricultural screens sort useful material from oversized debris.",
    weather: "breezy",
    crop: [0, -3.2],
    blocks: [
      field(),
      { x: -1.7, y: 4.4, w: 1, h: 4, kind: "metal" },
      { x: 1.7, y: 4.4, w: 1, h: 4, kind: "metal" },
    ],
    hazards: [
      { id: "h1", kind: "hayBale", x: 0, y: 4.4, size: 0.8, delay: 2.25 },
      { id: "h2", kind: "hayBale", x: 0, y: 6.4, size: 0.8, delay: 5.1 },
    ],
    seeds: [{ id: "s1", x: 0, y: 2.9 }],
    vine: 18,
    par: 13,
    duration: 10,
  },
  {
    id: "field-08",
    name: "Crosswind",
    season: "Field Edge",
    hint: "Fast hail is crossing the field, and Sunny's root bed is off limits.",
    lesson: "Edge barriers slow wind-driven debris before it reaches the crop.",
    weather: "breezy",
    crop: [-4.6, -3.2],
    blocks: [field()],
    noPlant: [{ x: -4.6, y: -1.8, w: 4.4, h: 4.6 }],
    hazards: [
      { id: "h1", kind: "hail", x: 7.6, y: -3.3, size: 0.5, vx: -8 },
      { id: "h2", kind: "hail", x: 7.6, y: -3.3, size: 0.5, vx: -9.4, delay: 3.3 },
    ],
    vine: 16,
    par: 11,
    duration: 9,
  },
  {
    id: "field-09",
    name: "Terrace Edge",
    season: "Hillside Farming",
    hint: "Sunny stands on a narrow terrace. One hail strike can send the crop over.",
    lesson: "Terraces and retaining barriers stabilize crops on steep land.",
    weather: "cloudy",
    crop: [-3.2, 0.4],
    blocks: [
      { x: -8.5, y: -5.6, w: 6, h: 3.2, kind: "soil" },
      { x: -3.2, y: -3.1, w: 2.6, h: 5.4, kind: "stone" },
      { x: 5.5, y: -5.6, w: 10, h: 3.2, kind: "soil" },
    ],
    hazards: [{ id: "h1", kind: "hail", x: -1, y: 4.4, size: 0.52, vx: -2.3 }],
    vine: 14,
    par: 8,
    duration: 6.5,
  },
  {
    id: "field-10",
    name: "Harvest Storm",
    season: "Final Harvest",
    hint: "Hail, a storm pod, and a runaway bale. Build one complete farm defense.",
    lesson: "Resilient farms combine drainage, barriers, canopies, and careful routing.",
    weather: "stormy",
    crop: [0, -3.2],
    blocks: [
      field(),
      { x: -5, y: -2, w: 5.8, h: 0.7, rot: -0.36, kind: "stone" },
    ],
    noPlant: [{ x: 0, y: -2.7, w: 4.6, h: 2.4 }],
    hazards: [
      { id: "h1", kind: "hail", x: -2, y: 4.4, size: 0.52 },
      { id: "h2", kind: "stormPod", x: 0.2, y: 5, size: 0.55, delay: 2.7, fuse: 4.5 },
      { id: "h3", kind: "hayBale", x: -7.2, y: 1, size: 0.72, delay: 5.1 },
      { id: "h4", kind: "hail", x: 2.2, y: 4.6, size: 0.48, delay: 7.8 },
    ],
    seeds: [{ id: "s1", x: 4.5, y: 4.2, delay: 0.75 }],
    vine: 28,
    par: 21,
    duration: 11,
  },
];

/* ---------- geometry helpers ---------- */

export function strokeLength(points: Vec2[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i += 1) {
    total += Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]);
  }
  return total;
}

export function totalVine(strokes: Vec2[][]): number {
  return strokes.reduce((sum, stroke) => sum + strokeLength(stroke), 0);
}

export function insideZone(zone: Zone, x: number, y: number, pad = 0): boolean {
  return (
    Math.abs(x - zone.x) <= zone.w / 2 + pad && Math.abs(y - zone.y) <= zone.h / 2 + pad
  );
}

export function canPlantAt(level: Level, x: number, y: number): boolean {
  if (Math.hypot(x - level.crop[0], y - level.crop[1]) < CROP_SAFE_RADIUS) return false;
  if (level.noPlant?.some((zone) => insideZone(zone, x, y, VINE_RADIUS))) return false;
  const half = { w: VIEW.w / 2 + 3, h: VIEW.h / 2 + 3 };
  if (Math.abs(x - VIEW.cx) > half.w || Math.abs(y - VIEW.cy) > half.h) return false;
  return true;
}

export function hazardSize(hazard: Hazard): number {
  if (hazard.size) return hazard.size;
  if (hazard.kind === "hayBale") return 0.95;
  if (hazard.kind === "crate") return 0.6;
  if (hazard.kind === "stormPod") return 0.6;
  return 0.6;
}

/** Narrowest and widest the camera is allowed to frame a field. */
const VIEW_MIN_W = 12;
const VIEW_MAX_W = 18;

/**
 * Horizontal framing for a single field.
 *
 * Fitting every level to one fixed width forces a phone in portrait to pull the
 * camera back far enough for the widest level in the game, which leaves simple
 * fields tiny and unreadable. Measuring the parts a player actually has to see
 * lets narrow fields stay close. Wide screens are limited by height rather than
 * width, so this only changes framing where width is the binding constraint.
 */
export function levelView(level: Level): { cx: number; w: number } {
  let min = level.crop[0] - 1.2;
  let max = level.crop[0] + 1.2;
  const grow = (low: number, high: number) => {
    min = Math.min(min, low);
    max = Math.max(max, high);
  };

  level.hazards.forEach((hazard) => {
    const reach = hazardSize(hazard) + 0.6;
    grow(hazard.x - reach, hazard.x + reach);
  });
  level.seeds?.forEach((seed) => grow(seed.x - 0.8, seed.x + 0.8));
  level.noPlant?.forEach((zone) => grow(zone.x - zone.w / 2, zone.x + zone.w / 2));
  level.blocks.forEach((block) => {
    // The ground slab spans far beyond the playable area; framing to it would
    // undo the measurement.
    if (block.w >= 24) return;
    grow(block.x - block.w / 2, block.x + block.w / 2);
  });

  const width = Math.min(VIEW_MAX_W, Math.max(VIEW_MIN_W, max - min + 1.2));
  // Keep the camera near the middle so the terraced ground and hills still fill
  // the frame behind the action.
  const cx = Math.max(-3, Math.min(3, (min + max) / 2));
  return { cx, w: width };
}

/* ---------- physical bodies ---------- */

export type Material = (typeof MATERIALS)[keyof typeof MATERIALS];

/**
 * Everything the solver and the aerodynamics pass need about a body:
 * `area` is the frontal area used for drag and blast loading, `radius` is the
 * characteristic length used for spin drag and rolling resistance.
 */
export type BodyProfile = {
  drag: number;
  rolling: number;
  area: number;
  radius: number;
  /** Angular inertia about z as a multiple of m*r^2 (sphere 2/5, cylinder 1/2). */
  inertia: number;
};

export type HazardBody =
  | { shape: "ball"; radius: number; material: Material; profile: BodyProfile }
  | {
      shape: "cylinder";
      halfHeight: number;
      radius: number;
      material: Material;
      profile: BodyProfile;
    }
  | {
      shape: "cuboid";
      half: [number, number, number];
      material: Material;
      profile: BodyProfile;
    };

/**
 * Colliders are derived from the rendered mesh rather than guessed, so what
 * the player sees is exactly what the solver tests against.
 */
export function hazardBody(hazard: Hazard): HazardBody {
  const size = hazardSize(hazard);

  if (hazard.kind === "hayBale") {
    // Mesh: a cylinder of radius ~0.97r and length 1.3r lying on its side.
    const radius = size * 0.97;
    const halfHeight = (size * 1.3) / 2;
    return {
      shape: "cylinder",
      halfHeight,
      radius,
      material: MATERIALS.hay,
      profile: {
        drag: MATERIALS.hay.drag,
        rolling: MATERIALS.hay.rolling,
        area: 2 * radius * halfHeight * 2,
        radius,
        inertia: 1 / 2,
      },
    };
  }

  if (hazard.kind === "crate") {
    // Mesh: a box of 2r x 2r x 1.7r.
    const half: [number, number, number] = [size, size, size * 0.85];
    return {
      shape: "cuboid",
      half,
      material: MATERIALS.wood,
      profile: {
        drag: MATERIALS.wood.drag,
        rolling: MATERIALS.wood.rolling,
        area: 2 * half[1] * 2 * half[2],
        radius: size,
        inertia: (half[0] ** 2 + half[1] ** 2) / (3 * size * size),
      },
    };
  }

  if (hazard.kind === "stormPod") {
    return {
      shape: "ball",
      radius: size,
      material: MATERIALS.pod,
      profile: {
        drag: MATERIALS.pod.drag,
        rolling: MATERIALS.pod.rolling,
        area: Math.PI * size * size,
        radius: size,
        inertia: 2 / 5,
      },
    };
  }

  // Hail is a randomised icosahedron whose vertices sit at 0.84-1.08 of the
  // nominal radius; 0.94 is the sphere that best matches that visible hull.
  const radius = size * 0.94;
  return {
    shape: "ball",
    radius,
    material: MATERIALS.ice,
    profile: {
      drag: MATERIALS.ice.drag,
      rolling: MATERIALS.ice.rolling,
      area: Math.PI * radius * radius,
      radius,
      inertia: 2 / 5,
    },
  };
}

/** Seed packets are light card: large frontal area, very little mass. */
export const SEED_BODY = {
  half: [0.27, 0.34, 0.12] as [number, number, number],
  material: MATERIALS.paper,
  profile: {
    drag: MATERIALS.paper.drag,
    rolling: MATERIALS.paper.rolling,
    area: 0.54 * 0.68,
    radius: 0.34,
    inertia: (0.27 ** 2 + 0.34 ** 2) / (3 * 0.34 ** 2),
  } satisfies BodyProfile,
};
