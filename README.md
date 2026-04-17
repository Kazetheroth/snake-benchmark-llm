# Neon Snake - Browser Version

A browser-based implementation of the classic Snake game using TypeScript, Vite, and HTML5 Canvas.

## Features

- **Desktop Controls**: Arrow keys or WASD to move, SPACE to pause, R to restart, ESC to quit
- **Mobile Controls**: Swipe gestures on touch screens
- **Responsive Design**: Adapts to different screen sizes
- **Local Persistence**: High score stored in browser local storage
- **Neon Visual Style**: Matches the original pygame version

## Tech Stack

- **TypeScript** - Type-safe JavaScript
- **Vite** - Fast build tool and dev server
- **HTML5 Canvas** - Rendering
- **Vitest** - Testing framework

## Getting Started

### Prerequisites

- Node.js 18+ (or newer)

### Installation

```bash
cd browser
npm install
```

### Development

Run the development server:

```bash
npm run dev
```

The app will be available at `http://localhost:5173`

### Production Build

Build for production:

```bash
npm run build
```

The built files will be in the `dist/` directory.

### Running Tests

```bash
npm run test
```

## Project Structure

```
browser/
├── src/
│   ├── app/           # Application bootstrap and storage
│   ├── game/          # Game engine and constants
│   ├── input/         # Keyboard and touch input handlers
│   ├── render/        # Canvas renderer and theme
│   └── ui/            # HUD and overlays
├── public/            # Static assets
├── tests/             # Test files
├── index.html         # Entry HTML file
├── vite.config.ts     # Vite configuration
└── package.json       # Dependencies and scripts
```

## Deployment

The production build can be deployed to any static hosting service:

- **Vercel**: `vercel deploy`
- **Netlify**: Drag and drop `dist/` folder
- **GitHub Pages**: Push `dist/` to `gh-pages` branch
- **Any static server**: Serve the `dist/` directory

### Example: GitHub Pages

```bash
npm run build
git add dist
git commit -m "Build for deployment"
git push origin main:gh-pages
```

## Game Rules

- **Objective**: Eat food to grow and score points
- **Controls**: Use arrow keys or WASD to change direction
- **Death**: Hitting walls or yourself ends the game
- **Pause**: Press SPACE to pause/resume
- **Restart**: Press R after game over

## Architecture

### Game Engine (Pure, Browser-agnostic)

The `GameEngine` class contains all game logic:
- Snake movement and growth
- Collision detection (walls, self)
- Food spawning
- Score tracking

### Renderer (Canvas)

The `CanvasRenderer` class handles all visual rendering:
- Grid background
- Snake and food drawing
- Score display
- Overlay screens (pause, game over)

### Input Handlers

- `KeyboardInput`: Desktop keyboard controls
- `TouchInput`: Mobile swipe gestures

## Testing

Run all tests:

```bash
npm run test
```

Tests cover:
- Snake movement and growth
- Direction input validation
- Wall and self collision
- Food consumption
- Pause/resume functionality
