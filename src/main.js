import './styles.css';
import { GameManager } from './gameManager.js';
import { UIManager } from './uiManager.js';

const ui = new UIManager();
const game = new GameManager(ui);
ui.mount(game);
