# Dead Sector Defense

MVP jugable de Tower Defense + Merge + Clicker + Roguelike para móvil, construido con JavaScript modular y Canvas.

## Ejecutar

```bash
npm install
npm run dev
```

Abre la URL que muestra Vite. También se puede generar una build estática con `npm run build`.

## Arquitectura

- `gameManager.js`: ciclo de partida y composición de sistemas.
- `mapGenerator.js`: caminos y zonas de construcción con semilla variable.
- `waveManager.js`, `enemyManager.js`, `towerManager.js`: combate y oleadas.
- `economyManager.js`, `clickerManager.js`, `roguelikeManager.js`: economía y builds.
- `levelManager.js`, `saveSystem.js`: progresión persistente y niveles.
- `uiManager.js`: mapa, HUD, Canvas, modal de mejoras y resultados.
- `config.js`: balance centralizado.

La primera versión prioriza el bucle completo y deja puntos claros para añadir nuevos mundos, enemigos, torres, jefes, habilidades, audio y contenido permanente.
