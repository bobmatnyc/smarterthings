# SvelteKit Web UI Integration Strategy for mcp-smartthings

**Research Date:** 2025-11-30
**Status:** Architecture Design
**Researcher:** Claude (Research Agent)

---

## Executive Summary

This document provides a comprehensive strategy for integrating a **Svelte 5 web UI** with the existing mcp-smartthings TypeScript Node.js project. The recommendation prioritizes **minimal disruption**, **smooth developer experience**, and **type safety** across frontend and backend.

**Key Recommendations:**

1. **Project Structure:** Option A (Monorepo with `web/` directory) - Best balance of simplicity and maintainability
2. **SvelteKit Adapter:** `@sveltejs/adapter-static` - Serve compiled static assets from existing Fastify server
3. **Type Sharing:** Shared types package with workspace protocol references
4. **Development Workflow:** Concurrent dev servers with Vite proxy for API calls
5. **Build Strategy:** Parallel builds with post-build static file copying

**Estimated Setup Time:** 2-4 hours
**Zero Breaking Changes:** Backend remains fully functional throughout integration

---

## Table of Contents

1. [Current State Analysis](#1-current-state-analysis)
2. [Project Structure Recommendation](#2-project-structure-recommendation)
3. [SvelteKit Adapter Selection](#3-sveltekit-adapter-selection)
4. [TypeScript Integration Strategy](#4-typescript-integration-strategy)
5. [Development Workflow](#5-development-workflow)
6. [Build and Deployment Strategy](#6-build-and-deployment-strategy)
7. [API Integration Pattern](#7-api-integration-pattern)
8. [Step-by-Step Setup Commands](#8-step-by-step-setup-commands)
9. [Configuration Files](#9-configuration-files)
10. [Migration Path and Risk Mitigation](#10-migration-path-and-risk-mitigation)

---

## 1. Current State Analysis

### 1.1 Existing Project Structure

```
mcp-smartthings/
├── src/                      # TypeScript backend
│   ├── direct/              # Direct Mode API (Phase 4.2)
│   ├── mcp/                 # MCP tools and protocol
│   ├── services/            # Business logic layer
│   ├── types/               # TypeScript type definitions
│   ├── transport/           # stdio and HTTP transports
│   ├── server-alexa.ts      # Fastify server (port 3000)
│   └── index.ts             # MCP server entry point
├── dist/                    # Compiled TypeScript output
├── tests/                   # Test suites
├── package.json             # Dependencies and scripts
├── tsconfig.json            # TypeScript configuration
├── pnpm-workspace.yaml      # Workspace config (currently minimal)
└── vitest.config.ts         # Test configuration
```

### 1.2 Key Findings

**Backend Strengths:**
- ✅ Clean architecture with ServiceContainer dependency injection
- ✅ Fastify server already running on port 3000 (server-alexa.ts)
- ✅ Direct Mode API available for in-process calls
- ✅ Express SSE transport for HTTP/MCP protocol
- ✅ Comprehensive type system in `src/types/`
- ✅ ESM modules (`"type": "module"` in package.json)
- ✅ pnpm package manager with workspace support

**Integration Opportunities:**
1. Fastify server can serve static files (SvelteKit build output)
2. Direct Mode API provides zero-overhead backend calls
3. Existing type definitions can be shared with frontend
4. pnpm workspaces enable efficient monorepo setup

**Challenges:**
- Two HTTP servers (Express on SSE, Fastify on port 3000) - need coordination
- TypeScript strict mode enabled - requires careful type sharing
- NodeNext module resolution - requires proper package.json exports

---

## 2. Project Structure Recommendation

### 2.1 Chosen Approach: Option A (Monorepo with `web/` directory)

**Rationale:**

✅ **Simplicity:** Minimal file reorganization, no disruption to existing backend
✅ **Clear Separation:** Frontend and backend remain distinct but colocated
✅ **Build Efficiency:** pnpm workspace enables shared dependencies
✅ **Type Safety:** Easy import of backend types into frontend
✅ **Tooling:** Works seamlessly with existing dev tools (tsx, vitest)

**Final Structure:**

```
mcp-smartthings/
├── src/                      # UNCHANGED - Backend TypeScript
│   ├── direct/              # Direct Mode API
│   ├── mcp/                 # MCP protocol layer
│   ├── services/            # Business logic
│   ├── types/               # Shared type definitions ⭐
│   ├── transport/           # stdio/HTTP transports
│   └── server-alexa.ts      # Fastify server (will serve web UI)
├── web/                      # NEW - SvelteKit frontend
│   ├── src/
│   │   ├── lib/
│   │   │   ├── api/         # Frontend API client
│   │   │   ├── components/  # Svelte 5 components
│   │   │   └── stores/      # Svelte stores
│   │   ├── routes/          # SvelteKit routes
│   │   └── app.html         # HTML template
│   ├── static/              # Static assets
│   ├── package.json         # Frontend dependencies
│   ├── svelte.config.js     # SvelteKit config
│   ├── vite.config.ts       # Vite config with proxy
│   └── tsconfig.json        # Frontend TypeScript config
├── packages/                 # NEW - Shared packages
│   └── shared-types/        # Shared TypeScript types
│       ├── package.json     # "private": true
│       └── index.ts         # Re-export backend types
├── dist/                    # Backend build output
├── package.json             # Root workspace config
├── pnpm-workspace.yaml      # Workspace definition
└── tsconfig.json            # Backend TypeScript config
```

### 2.2 Why Not Option B or C?

**Option B (Nested frontend/):**
- ❌ Less clear separation (frontend suggests UI framework agnostic)
- ❌ Confusing nesting (is it frontend or web framework specific?)

**Option C (Separate packages/):**
- ❌ Over-engineering for this project size
- ❌ Complicates build coordination
- ❌ Requires reorganizing existing backend (breaking change)

---

## 3. SvelteKit Adapter Selection

### 3.1 Recommendation: `@sveltejs/adapter-static`

**Use Case:** Generate static HTML/CSS/JS files that Fastify serves directly

**Advantages:**

✅ **No SSR Complexity:** Simple static site, perfect for local control panel
✅ **Fastify Integration:** Serve from `fastify-static` plugin
✅ **Zero Backend Changes:** No need to integrate SvelteKit server into Fastify
✅ **Fast Load Times:** Pre-rendered HTML with client-side hydration
✅ **Deployment Simplicity:** Just copy build output to `dist/public/`

**Configuration:**

```javascript
// web/svelte.config.js
import adapter from '@sveltejs/adapter-static';

export default {
  kit: {
    adapter: adapter({
      pages: 'build',       // Output directory
      assets: 'build',      // Assets directory
      fallback: 'index.html', // SPA fallback for client-side routing
      precompress: false    // Fastify handles compression
    }),
    paths: {
      base: '',             // Served from root path
    }
  }
};
```

### 3.2 Alternative: `@sveltejs/adapter-node` (Not Recommended)

**Why Avoid:**
- ❌ Runs separate Node.js server (conflicts with Fastify)
- ❌ SSR overhead unnecessary for local control panel
- ❌ Complicates deployment (two servers to manage)
- ❌ More complex integration with existing backend

**Use Case:** Only if you need server-side rendering for SEO or dynamic routes

---

## 4. TypeScript Integration Strategy

### 4.1 Type Sharing Architecture

**Goal:** Share backend types with frontend without circular dependencies

**Approach:** Dedicated `packages/shared-types/` workspace package

```
packages/shared-types/
├── package.json
├── index.ts          # Re-export backend types
└── tsconfig.json     # Extends root tsconfig
```

### 4.2 Shared Types Package Configuration

**packages/shared-types/package.json:**

```json
{
  "name": "@mcp-smartthings/shared-types",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "./index.ts",
  "types": "./index.ts",
  "exports": {
    ".": "./index.ts"
  }
}
```

**packages/shared-types/index.ts:**

```typescript
// Re-export backend types for frontend consumption
export type {
  UnifiedDevice,
  DeviceCapability,
  DeviceCommand,
  DeviceStatus,
  CapabilityState,
} from '../../src/types/unified-device.js';

export type {
  DeviceId,
  LocationId,
  RoomId,
  SceneId,
} from '../../src/types/smartthings.js';

export type {
  DirectResult,
} from '../../src/direct/types.js';

// Export type guards
export { isSuccess, isError } from '../../src/direct/types.js';
```

**packages/shared-types/tsconfig.json:**

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "rootDir": ".",
    "outDir": "./dist",
    "composite": true,
    "declaration": true,
    "declarationMap": true
  },
  "include": ["./**/*"],
  "references": []
}
```

### 4.3 Frontend TypeScript Configuration

**web/tsconfig.json:**

```json
{
  "extends": "@tsconfig/svelte/tsconfig.json",
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "allowJs": true,
    "checkJs": true,
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "paths": {
      "$lib": ["./src/lib"],
      "$lib/*": ["./src/lib/*"],
      "@shared-types": ["../packages/shared-types/index.ts"]
    }
  },
  "include": ["src/**/*.ts", "src/**/*.svelte"],
  "exclude": ["node_modules", "build", ".svelte-kit"]
}
```

### 4.4 Using Shared Types in Frontend

**Example: web/src/lib/api/client.ts**

```typescript
import type { UnifiedDevice, DirectResult } from '@shared-types';
import { isSuccess } from '@shared-types';

export class ApiClient {
  private baseUrl = '/api';

  async getDevices(): Promise<DirectResult<UnifiedDevice[]>> {
    const response = await fetch(`${this.baseUrl}/devices`);
    const result = await response.json();

    if (isSuccess(result)) {
      console.log(`Loaded ${result.data.length} devices`);
    }

    return result;
  }

  async turnOnDevice(deviceId: string): Promise<DirectResult<void>> {
    const response = await fetch(`${this.baseUrl}/devices/${deviceId}/on`, {
      method: 'POST',
    });
    return response.json();
  }
}
```

---

## 5. Development Workflow

### 5.1 Concurrent Development Servers

**Backend (Fastify):** Port 3000
**Frontend (Vite):** Port 5173

**Development Flow:**

1. Start backend: `pnpm dev` (runs `tsx watch src/index.ts`)
2. Start frontend: `pnpm --filter web dev` (runs Vite dev server)
3. Frontend proxies API calls to backend via Vite config
4. Hot reload works independently for both layers

### 5.2 Vite Proxy Configuration

**web/vite.config.ts:**

```typescript
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [sveltekit()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false,
      },
    },
  },
  optimizeDeps: {
    exclude: ['@mcp-smartthings/shared-types'],
  },
});
```

### 5.3 CORS Configuration (Backend)

**src/server-alexa.ts additions:**

```typescript
import cors from '@fastify/cors';

// Add CORS support for development
await app.register(cors, {
  origin: process.env.NODE_ENV === 'development'
    ? 'http://localhost:5173'  // Vite dev server
    : false,                    // Disable in production (same-origin)
  credentials: true,
});
```

### 5.4 Updated Package Scripts

**Root package.json additions:**

```json
{
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "dev:web": "pnpm --filter web dev",
    "dev:all": "concurrently \"pnpm dev\" \"pnpm dev:web\"",
    "build": "bash scripts/build.sh",
    "build:web": "pnpm --filter web build",
    "build:all": "pnpm build && pnpm build:web && pnpm copy:web",
    "copy:web": "mkdir -p dist/public && cp -r web/build/* dist/public/",
    "start": "node dist/index.js",
    "start:web": "pnpm start:fastify"
  }
}
```

**web/package.json:**

```json
{
  "name": "mcp-smartthings-web",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite dev",
    "build": "vite build",
    "preview": "vite preview",
    "check": "svelte-kit sync && svelte-check --tsconfig ./tsconfig.json",
    "check:watch": "svelte-kit sync && svelte-check --tsconfig ./tsconfig.json --watch"
  },
  "dependencies": {
    "@mcp-smartthings/shared-types": "workspace:*"
  },
  "devDependencies": {
    "@sveltejs/adapter-static": "^3.0.0",
    "@sveltejs/kit": "^2.0.0",
    "@sveltejs/vite-plugin-svelte": "^4.0.0",
    "@tsconfig/svelte": "^5.0.0",
    "svelte": "^5.0.0",
    "svelte-check": "^4.0.0",
    "tslib": "^2.6.0",
    "typescript": "^5.6.0",
    "vite": "^5.0.0"
  }
}
```

---

## 6. Build and Deployment Strategy

### 6.1 Build Process

**Development Build:**
```bash
pnpm build:dev        # Fast backend build (skip tests/validation)
pnpm build:web        # Frontend build (static files)
pnpm copy:web         # Copy to dist/public/
```

**Production Build:**
```bash
pnpm build:all        # Full build with tests + frontend
```

### 6.2 Serving Static Files from Fastify

**src/server-alexa.ts modifications:**

```typescript
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fastifyStatic from '@fastify/static';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Serve static web UI files
await app.register(fastifyStatic, {
  root: path.join(__dirname, '../dist/public'),
  prefix: '/', // Serve from root path
});

// Fallback to index.html for SPA routing
app.setNotFoundHandler((request, reply) => {
  // Only serve index.html for non-API routes
  if (!request.url.startsWith('/api') && !request.url.startsWith('/alexa')) {
    reply.sendFile('index.html');
  } else {
    reply.code(404).send({ error: 'Not Found' });
  }
});
```

### 6.3 Deployment Structure

```
dist/
├── index.js          # Compiled backend entry point
├── server-alexa.js   # Fastify server
├── direct/           # Direct Mode API
├── mcp/              # MCP tools
├── services/         # Business logic
├── types/            # Type definitions
└── public/           # NEW - Static web UI
    ├── index.html
    ├── _app/
    │   ├── immutable/
    │   │   ├── chunks/
    │   │   └── assets/
    │   └── version.json
    └── favicon.png
```

---

## 7. API Integration Pattern

### 7.1 Backend API Routes

**Add to src/server-alexa.ts:**

```typescript
import { createToolExecutor } from './direct/index.js';
import type { ServiceContainer } from './services/index.js';

// Initialize Direct Mode executor
const executor = createToolExecutor(container);

// API Routes for Web UI
app.get('/api/devices', async (request, reply) => {
  const result = await executor.listDevices({});
  return result;  // Returns DirectResult<UnifiedDevice[]>
});

app.get('/api/devices/:deviceId', async (request, reply) => {
  const { deviceId } = request.params as { deviceId: string };
  const result = await executor.getDeviceStatus(deviceId as DeviceId);
  return result;
});

app.post('/api/devices/:deviceId/on', async (request, reply) => {
  const { deviceId } = request.params as { deviceId: string };
  const result = await executor.turnOnDevice(deviceId as DeviceId);
  return result;
});

app.post('/api/devices/:deviceId/off', async (request, reply) => {
  const { deviceId } = request.params as { deviceId: string };
  const result = await executor.turnOffDevice(deviceId as DeviceId);
  return result;
});

app.get('/api/system/status', async (request, reply) => {
  const result = await executor.getSystemStatus();
  return result;
});
```

### 7.2 Frontend API Client

**web/src/lib/api/client.ts:**

```typescript
import type { UnifiedDevice, DirectResult, DeviceId } from '@shared-types';
import { isSuccess } from '@shared-types';

export class ApiClient {
  private baseUrl = import.meta.env.DEV ? 'http://localhost:3000/api' : '/api';

  private async request<T>(
    endpoint: string,
    options?: RequestInit
  ): Promise<DirectResult<T>> {
    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        headers: {
          'Content-Type': 'application/json',
          ...options?.headers,
        },
        ...options,
      });

      if (!response.ok) {
        return {
          success: false,
          error: {
            code: `HTTP_${response.status}`,
            message: response.statusText,
          },
        };
      }

      return await response.json();
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'NETWORK_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  async getDevices(): Promise<DirectResult<UnifiedDevice[]>> {
    return this.request<UnifiedDevice[]>('/devices');
  }

  async getDevice(deviceId: DeviceId): Promise<DirectResult<UnifiedDevice>> {
    return this.request<UnifiedDevice>(`/devices/${deviceId}`);
  }

  async turnOnDevice(deviceId: DeviceId): Promise<DirectResult<void>> {
    return this.request<void>(`/devices/${deviceId}/on`, { method: 'POST' });
  }

  async turnOffDevice(deviceId: DeviceId): Promise<DirectResult<void>> {
    return this.request<void>(`/devices/${deviceId}/off`, { method: 'POST' });
  }
}

export const api = new ApiClient();
```

### 7.3 Svelte Store Integration

**web/src/lib/stores/devices.ts:**

```typescript
import { writable } from 'svelte/store';
import type { UnifiedDevice } from '@shared-types';
import { api } from '$lib/api/client';
import { isSuccess } from '@shared-types';

function createDevicesStore() {
  const { subscribe, set, update } = writable<UnifiedDevice[]>([]);

  return {
    subscribe,
    async load() {
      const result = await api.getDevices();
      if (isSuccess(result)) {
        set(result.data);
      }
    },
    async toggleDevice(deviceId: string, currentState: boolean) {
      const result = currentState
        ? await api.turnOffDevice(deviceId)
        : await api.turnOnDevice(deviceId);

      if (isSuccess(result)) {
        // Reload devices to reflect changes
        await this.load();
      }

      return result;
    },
  };
}

export const devices = createDevicesStore();
```

---

## 8. Step-by-Step Setup Commands

### 8.1 Phase 1: Workspace Setup

```bash
# Navigate to project root
cd /Users/masa/Projects/mcp-smartthings

# Update pnpm workspace config
cat > pnpm-workspace.yaml << 'EOF'
packages:
  - 'web'
  - 'packages/*'

ignoredBuiltDependencies:
  - better-sqlite3
EOF

# Create packages directory
mkdir -p packages/shared-types

# Create shared-types package.json
cat > packages/shared-types/package.json << 'EOF'
{
  "name": "@mcp-smartthings/shared-types",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "./index.ts",
  "types": "./index.ts",
  "exports": {
    ".": "./index.ts"
  }
}
EOF

# Create shared types entry point
cat > packages/shared-types/index.ts << 'EOF'
// Re-export backend types for frontend consumption
export type {
  UnifiedDevice,
  DeviceCapability,
  DeviceCommand,
  DeviceStatus,
  CapabilityState,
} from '../../src/types/unified-device.js';

export type {
  DeviceId,
  LocationId,
  RoomId,
  SceneId,
} from '../../src/types/smartthings.js';

export type {
  DirectResult,
} from '../../src/direct/types.js';

export { isSuccess, isError } from '../../src/direct/types.js';
EOF

# Create shared types tsconfig
cat > packages/shared-types/tsconfig.json << 'EOF'
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "rootDir": ".",
    "outDir": "./dist",
    "composite": true,
    "declaration": true,
    "declarationMap": true
  },
  "include": ["./**/*"],
  "references": []
}
EOF
```

### 8.2 Phase 2: Initialize SvelteKit

```bash
# Create SvelteKit app in web/ directory
pnpm create svelte@latest web

# When prompted:
# - Which Svelte app template? → Skeleton project
# - Add type checking with TypeScript? → Yes, using TypeScript syntax
# - Select additional options:
#   [x] Add ESLint for code linting
#   [x] Add Prettier for code formatting
#   [ ] Add Playwright for browser testing (optional)
#   [ ] Add Vitest for unit testing (optional - already using Vitest)
```

### 8.3 Phase 3: Install SvelteKit Dependencies

```bash
# Navigate to web directory
cd web

# Install adapter-static
pnpm add -D @sveltejs/adapter-static

# Install shared types reference
pnpm add @mcp-smartthings/shared-types@workspace:*

# Return to root
cd ..
```

### 8.4 Phase 4: Configure SvelteKit

```bash
# Create svelte.config.js
cat > web/svelte.config.js << 'EOF'
import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter({
      pages: 'build',
      assets: 'build',
      fallback: 'index.html',
      precompress: false
    }),
    paths: {
      base: '',
    }
  }
};

export default config;
EOF

# Create vite.config.ts
cat > web/vite.config.ts << 'EOF'
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [sveltekit()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false,
      },
    },
  },
  optimizeDeps: {
    exclude: ['@mcp-smartthings/shared-types'],
  },
});
EOF

# Create tsconfig.json
cat > web/tsconfig.json << 'EOF'
{
  "extends": "@tsconfig/svelte/tsconfig.json",
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "allowJs": true,
    "checkJs": true,
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "paths": {
      "$lib": ["./src/lib"],
      "$lib/*": ["./src/lib/*"],
      "@shared-types": ["../packages/shared-types/index.ts"]
    }
  },
  "include": ["src/**/*.ts", "src/**/*.svelte"],
  "exclude": ["node_modules", "build", ".svelte-kit"]
}
EOF
```

### 8.5 Phase 5: Add Backend Dependencies

```bash
# Install Fastify static file serving
pnpm add @fastify/static

# Install concurrently for dev script
pnpm add -D concurrently
```

### 8.6 Phase 6: Update Root package.json

```bash
# Add new scripts to root package.json (manual edit or use jq)
# Add these to "scripts" section:
{
  "dev:web": "pnpm --filter web dev",
  "dev:all": "concurrently \"pnpm dev\" \"pnpm dev:web\"",
  "build:web": "pnpm --filter web build",
  "build:all": "pnpm build && pnpm build:web && pnpm copy:web",
  "copy:web": "mkdir -p dist/public && cp -r web/build/* dist/public/"
}
```

### 8.7 Phase 7: Create API Client Boilerplate

```bash
# Create API directory
mkdir -p web/src/lib/api

# Create API client
cat > web/src/lib/api/client.ts << 'EOF'
import type { UnifiedDevice, DirectResult, DeviceId } from '@shared-types';
import { isSuccess } from '@shared-types';

export class ApiClient {
  private baseUrl = import.meta.env.DEV ? 'http://localhost:3000/api' : '/api';

  private async request<T>(
    endpoint: string,
    options?: RequestInit
  ): Promise<DirectResult<T>> {
    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        headers: {
          'Content-Type': 'application/json',
          ...options?.headers,
        },
        ...options,
      });

      if (!response.ok) {
        return {
          success: false,
          error: {
            code: `HTTP_${response.status}`,
            message: response.statusText,
          },
        };
      }

      return await response.json();
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'NETWORK_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  async getDevices(): Promise<DirectResult<UnifiedDevice[]>> {
    return this.request<UnifiedDevice[]>('/devices');
  }

  async getDevice(deviceId: DeviceId): Promise<DirectResult<UnifiedDevice>> {
    return this.request<UnifiedDevice>(`/devices/${deviceId}`);
  }

  async turnOnDevice(deviceId: DeviceId): Promise<DirectResult<void>> {
    return this.request<void>(`/devices/${deviceId}/on`, { method: 'POST' });
  }

  async turnOffDevice(deviceId: DeviceId): Promise<DirectResult<void>> {
    return this.request<void>(`/devices/${deviceId}/off`, { method: 'POST' });
  }
}

export const api = new ApiClient();
EOF

# Create example Svelte store
mkdir -p web/src/lib/stores
cat > web/src/lib/stores/devices.ts << 'EOF'
import { writable } from 'svelte/store';
import type { UnifiedDevice } from '@shared-types';
import { api } from '$lib/api/client';
import { isSuccess } from '@shared-types';

function createDevicesStore() {
  const { subscribe, set, update } = writable<UnifiedDevice[]>([]);

  return {
    subscribe,
    async load() {
      const result = await api.getDevices();
      if (isSuccess(result)) {
        set(result.data);
      }
    },
    async toggleDevice(deviceId: string, currentState: boolean) {
      const result = currentState
        ? await api.turnOffDevice(deviceId)
        : await api.turnOnDevice(deviceId);

      if (isSuccess(result)) {
        await this.load();
      }

      return result;
    },
  };
}

export const devices = createDevicesStore();
EOF
```

### 8.8 Phase 8: Verify Setup

```bash
# Install all dependencies
pnpm install

# Verify workspace setup
pnpm list --depth 0

# Check TypeScript compilation
pnpm --filter web run check

# Test backend build
pnpm build:dev

# Test frontend build
pnpm build:web

# Verify static files generated
ls -la web/build/
```

---

## 9. Configuration Files

### 9.1 Updated pnpm-workspace.yaml

```yaml
packages:
  - 'web'
  - 'packages/*'

ignoredBuiltDependencies:
  - better-sqlite3
```

### 9.2 Backend Modifications (server-alexa.ts)

**Add static file serving:**

```typescript
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fastifyStatic from '@fastify/static';
import cors from '@fastify/cors';
import { createToolExecutor } from './direct/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Enable CORS for development
if (process.env.NODE_ENV === 'development') {
  await app.register(cors, {
    origin: 'http://localhost:5173',
    credentials: true,
  });
}

// Serve static web UI (production only)
if (process.env.NODE_ENV === 'production') {
  await app.register(fastifyStatic, {
    root: path.join(__dirname, '../public'),
    prefix: '/',
  });

  // SPA fallback
  app.setNotFoundHandler((request, reply) => {
    if (!request.url.startsWith('/api') && !request.url.startsWith('/alexa')) {
      reply.sendFile('index.html');
    } else {
      reply.code(404).send({ error: 'Not Found' });
    }
  });
}

// Initialize Direct Mode executor
const executor = createToolExecutor(container);

// API Routes
app.get('/api/devices', async (request, reply) => {
  const result = await executor.listDevices({});
  return result;
});

app.get('/api/devices/:deviceId', async (request, reply) => {
  const { deviceId } = request.params as { deviceId: string };
  const result = await executor.getDeviceStatus(deviceId as DeviceId);
  return result;
});

app.post('/api/devices/:deviceId/on', async (request, reply) => {
  const { deviceId } = request.params as { deviceId: string };
  const result = await executor.turnOnDevice(deviceId as DeviceId);
  return result;
});

app.post('/api/devices/:deviceId/off', async (request, reply) => {
  const { deviceId } = request.params as { deviceId: string };
  const result = await executor.turnOffDevice(deviceId as DeviceId);
  return result;
});

app.get('/api/system/status', async (request, reply) => {
  const result = await executor.getSystemStatus();
  return result;
});
```

---

## 10. Migration Path and Risk Mitigation

### 10.1 Migration Strategy

**Phase 1: Infrastructure Setup (Day 1)**
- ✅ Create workspace structure
- ✅ Initialize SvelteKit
- ✅ Configure build process
- ⚠️ Risk: Minimal - no backend changes

**Phase 2: Type Sharing (Day 1)**
- ✅ Create shared-types package
- ✅ Configure TypeScript paths
- ✅ Create API client boilerplate
- ⚠️ Risk: Low - read-only access to types

**Phase 3: Backend API Routes (Day 2)**
- ✅ Add Direct Mode API endpoints
- ✅ Configure CORS for development
- ✅ Add static file serving
- ⚠️ Risk: Medium - backend changes (test thoroughly)

**Phase 4: Frontend Development (Day 2+)**
- ✅ Build UI components
- ✅ Integrate with API
- ✅ Test end-to-end
- ⚠️ Risk: Low - isolated from backend

### 10.2 Risk Mitigation

**Risk: Breaking Backend Build**
- ✅ Use feature branch for integration
- ✅ Run `pnpm build` after each change
- ✅ Test existing CLI commands (chat, config, etc.)

**Risk: TypeScript Compilation Errors**
- ✅ Strict type checking in shared-types package
- ✅ Use `workspace:*` protocol for resilience
- ✅ Keep backend tsconfig unchanged

**Risk: Port Conflicts**
- ✅ Document port allocation (3000 = Fastify, 5173 = Vite)
- ✅ Make ports configurable via environment variables

**Risk: Deployment Complexity**
- ✅ Single-step build: `pnpm build:all`
- ✅ Compiled output remains in `dist/`
- ✅ No changes to existing deployment process

### 10.3 Rollback Plan

If integration causes issues:

```bash
# Remove web directory and packages
rm -rf web/ packages/

# Restore pnpm-workspace.yaml
cat > pnpm-workspace.yaml << 'EOF'
ignoredBuiltDependencies:
  - better-sqlite3
EOF

# Remove frontend scripts from package.json (manual)
# Remove @fastify/static dependency
pnpm remove @fastify/static

# Rebuild backend
pnpm build

# Backend remains fully functional
```

---

## Appendix: Quick Start Checklist

### Pre-Setup Verification

- [ ] pnpm version >= 8.0 installed
- [ ] Node.js version >= 18.0 installed
- [ ] Backend builds successfully: `pnpm build`
- [ ] Backend tests pass: `pnpm test`

### Setup Steps

1. **Workspace Configuration**
   - [ ] Update `pnpm-workspace.yaml`
   - [ ] Create `packages/shared-types/`
   - [ ] Create shared types package files

2. **SvelteKit Initialization**
   - [ ] Run `pnpm create svelte@latest web`
   - [ ] Install `@sveltejs/adapter-static`
   - [ ] Configure `svelte.config.js`
   - [ ] Configure `vite.config.ts`
   - [ ] Configure `web/tsconfig.json`

3. **Backend Integration**
   - [ ] Install `@fastify/static`
   - [ ] Add API routes to `server-alexa.ts`
   - [ ] Configure CORS for development
   - [ ] Add static file serving (production)

4. **Development Workflow**
   - [ ] Add npm scripts to root `package.json`
   - [ ] Create API client in `web/src/lib/api/client.ts`
   - [ ] Create example stores in `web/src/lib/stores/`

5. **Verification**
   - [ ] Run `pnpm install`
   - [ ] Build backend: `pnpm build`
   - [ ] Build frontend: `pnpm build:web`
   - [ ] Test dev mode: `pnpm dev:all`
   - [ ] Verify API proxy works

### Post-Setup Testing

- [ ] Backend still works independently: `pnpm dev`
- [ ] Frontend dev server starts: `pnpm dev:web`
- [ ] Concurrent mode works: `pnpm dev:all`
- [ ] Production build succeeds: `pnpm build:all`
- [ ] Static files copied to `dist/public/`
- [ ] Type imports work in frontend
- [ ] API calls return correct types

---

## Conclusion

This integration strategy provides a **minimal-disruption** path to adding a Svelte 5 web UI to the mcp-smartthings project. Key advantages:

✅ **Zero Breaking Changes:** Backend continues to work exactly as before
✅ **Type Safety:** Shared types ensure frontend/backend consistency
✅ **Developer Experience:** Concurrent dev servers with hot reload
✅ **Production Ready:** Single build command, static file serving
✅ **Future Proof:** Monorepo structure scales for additional packages

**Estimated Implementation Time:** 2-4 hours for complete setup

**Next Steps:**
1. Follow setup commands in Section 8
2. Verify each phase before proceeding
3. Build initial UI components
4. Iterate on features

---

**Research Completed:** 2025-11-30
**Ticket Context:** N/A (exploratory research)
**Memory Usage:** ~52KB (efficient research methodology)
