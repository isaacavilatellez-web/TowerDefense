import { GAME_CONFIG } from './config.js';

function seeded(seed) {
  let value = seed % 2147483647;
  return () => {
    value = value * 16807 % 2147483647;
    return (value - 1) / 2147483646;
  };
}

export class MapGenerator {
  static generate(level, seed = level * 9127) {
    const random = seeded(seed);
    const { width, height } = GAME_CONFIG.map;
    const points = [{ x: 36, y: height * (0.23 + random() * 0.14) }];
    const segments = 6;
    for (let index = 1; index <= segments; index += 1) {
      const x = 36 + ((width - 145) / segments) * index;
      const previous = points[index - 1].y;
      const y = Math.min(height - 90, Math.max(75, previous + (random() - 0.5) * 210));
      points.push({ x, y });
    }
    points.push({ x: width - 58, y: height * (0.46 + random() * 0.12) });

    const buildSpots = [];
    for (let i = 0; i < points.length - 1; i += 1) {
      const a = points[i];
      const b = points[i + 1];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const length = Math.hypot(dx, dy) || 1;
      const nx = -dy / length;
      const ny = dx / length;
      for (const offset of [-1, 1]) {
        const t = 0.4 + random() * 0.42;
        const distance = 68 + random() * 38;
        const x = a.x + dx * t + nx * distance * offset;
        const y = a.y + dy * t + ny * distance * offset;
        if (x > 90 && x < width - 100 && y > 55 && y < height - 55) buildSpots.push({ x, y, occupied: false });
      }
    }

    const naturalKinds = ['rock', 'shrub', 'tree', 'stump', 'grass'];
    const distanceToPath = (x, y) => points.slice(0, -1).reduce((closest, point, index) => {
      const next = points[index + 1]; const dx = next.x - point.x; const dy = next.y - point.y; const length = dx * dx + dy * dy || 1;
      const t = Math.max(0, Math.min(1, ((x - point.x) * dx + (y - point.y) * dy) / length));
      return Math.min(closest, Math.hypot(x - (point.x + dx * t), y - (point.y + dy * t)));
    }, Infinity);
    const obstacles = [];
    let attempts = 0;
    while (obstacles.length < 16 && attempts < 80) {
      attempts += 1;
      const x = 80 + random() * (width - 200); const y = 42 + random() * (height - 90); const size = 7 + random() * 13;
      if (distanceToPath(x, y) < 43) continue;
      obstacles.push({ x, y, size, kind: naturalKinds[Math.floor(random() * naturalKinds.length)], rotation: random() * Math.PI });
    }
    return { points, buildSpots, obstacles, seed };
  }
}
