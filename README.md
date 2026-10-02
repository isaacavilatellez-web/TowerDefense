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

## Sistemas de combate

- El nivel permanente (1–10) sólo modifica daño con `1.10^(nivel-1)` y usa los costes PV `[50, 150, 400, 1000, 2500, 6000, 15000, 30000, 60000]`, convertidos a engranajes con la rareza actual. Las evoluciones de campo (1–5) son temporales.
- Cada tipo y evolución admite como máximo dos defensas. Las fusiones validan el estado final antes de cobrar o retirar una carta.
- Los enemigos usan daño fijo al refugio, blindaje, regeneración y estados centralizados; el jefe final destruye el refugio al llegar.
- `Modo de prueba` reutiliza el campo y el motor normal, permite generar los siete tipos manualmente, pausar, limpiar, reiniciar, variar nivel/dificultad y activar invulnerabilidad sin escribir progreso.
