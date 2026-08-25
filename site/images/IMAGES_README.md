# Game Images Guide

This directory holds game images/logos displayed in the carousel.

## Directory Structure
```
site/images/games/
├── 2048.png
├── run3.png (or run3-cyberpunk.png)
├── alien-shooter.png
├── tetris.png
├── pac-man.png
├── snake.png
├── flappy-bird.png
├── dino-run.png
├── chess.png
├── memory-match.png
├── breakout.png
├── space-invaders.png
├── pong.png
├── minesweeper.png
├── asteroid.png
├── sokoban.png
├── galaga.png
├── connect4.png
├── tic-tac-toe.png
└── hangman.png
```

## Naming Convention
- Use the game **slug** (from games.json) as the filename
- Format: `{slug}.png` (e.g., `2048.png`, `run3.png`, `alien-shooter.png`)
- Supported formats: PNG, JPG, WebP
- **Size**: 256×256px (square) — CSS scales for all components
- **File size**: Keep under 50KB each
- **One image per game** — used everywhere (carousel, cards, grids)

## How It Works
1. Add your image to `site/images/games/`
2. Name it exactly after the game slug: `{slug}.png`
3. Rebuild: `node site/build.js run3`
4. The carousel automatically displays the image if it exists
5. If image missing, falls back to the badge/initial

## Example
For the game with `"slug": "pac-man"`:
- Create/add file: `site/images/games/pac-man.png`
- The carousel will automatically load and display it at 140x140px

## Steps to Add Images
1. Download or create 140x140px game images
2. Save to `site/images/games/` with the correct slug name
3. Run `node site/build.js run3` to copy images to dist/
4. Refresh browser to see updated carousel with images
