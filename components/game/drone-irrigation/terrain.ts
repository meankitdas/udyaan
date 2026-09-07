export function terrainHeight(x: number, z: number) {
  const distance = Math.hypot(x, z);
  const transition = Math.min(1, Math.max(0, (distance - 62) / 65));
  const hills = 5 + Math.sin(x * 0.027 + z * 0.011) * 3.8 + Math.cos(z * 0.036 - x * 0.015) * 2.7;
  return hills * transition * transition * (3 - 2 * transition);
}