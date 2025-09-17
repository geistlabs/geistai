# GeistAI Webapp

A basic React webapp for testing and debugging the GeistAI router service.

## Features

- Simple chat interface with message history
- Integration with the GeistAI router API
- Basic black and white styling
- Real-time message display
- Error handling and loading states

## Setup

### Docker (Recommended)

The webapp is included in the main docker-compose setup with live reload enabled:

```bash
# From the backend directory
docker compose up webapp
```

The webapp will be available at `http://localhost:3000` with automatic live reloading when you make changes to the source code.

### Local Development

1. Install dependencies:
```bash
npm install
```

2. Set environment variables (optional):
```bash
# Default is http://localhost:8000
export VITE_API_URL=http://your-router-url:8000
```

3. Start the development server with live reload:
```bash
npm run start:dev
```

4. Open your browser to `http://localhost:3000`

## API Integration

The webapp connects to the GeistAI router service at `/api/chat` endpoint. Make sure your router service is running and accessible.

## Development

- `npm run dev` - Start development server (Vite only)
- `npm run start:dev` - Start development server with nodemon live reload
- `npm run dev:watch` - Alternative live reload command
- `npm run build` - Build for production
- `npm run preview` - Preview production build

## Live Reload

The webapp is configured with nodemon for automatic live reloading:

- **File watching**: Monitors `src/` directory for changes
- **File types**: `.ts`, `.tsx`, `.js`, `.jsx`, `.json`, `.css`, `.html`
- **Delay**: 1 second delay to prevent rapid restarts
- **Docker volumes**: Source code is mounted for live reloading in containers

## Configuration

The webapp uses environment variables for configuration:

- `VITE_API_URL` - Base URL for the router API (default: http://localhost:8000)
