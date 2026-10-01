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

## Economía permanente

La economía del menú está separada de las monedas temporales de cada partida:

`partidas → Suministros → cofres → Engranajes → Nivel permanente de defensas`

Los niveles permanentes (1–10) usan engranajes según la rareza de cada defensa. Las fusiones dentro del campo siguen siendo evoluciones temporales (1–5). Los valores de engranajes, cofres, pesos, recompensas, niveles e intercambio directo con Cristales están centralizados en `src/config.js`; la lógica de reparto exacto de cofres está en `src/economyManager.js`.

La primera versión prioriza el bucle completo y deja puntos claros para añadir nuevos mundos, enemigos, torres, jefes, habilidades, audio y contenido permanente.
