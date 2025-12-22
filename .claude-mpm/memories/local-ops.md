# Local Ops Agent Memories
# Initialized: 2025-12-22

## Smarter Things Deployment

### Port Configuration
- Backend port: 5182 (LOCKED - DO NOT CHANGE)
- Frontend port: 5181 (LOCKED - DO NOT CHANGE)

### Server Start Commands
- Backend server: `pnpm alexa-server:dev`
- Frontend dev server: `pnpm dev:web`
- Full stack (both): `bash scripts/dev-start.sh`

### Ngrok Tunnel Configuration
- Reserved subdomain: smarty.ngrok.app
- Start tunnel: `ngrok http --url=smarty.ngrok.app 5182`
- Verify tunnel: `curl https://smarty.ngrok.app/health`
- Required for SmartThings webhook delivery

### OAuth Re-authentication Sequence
- Step 1: Disconnect OAuth: `curl -X POST http://localhost:5182/auth/smartthings/disconnect`
- Step 2: Rebuild server: `pnpm build:dev`
- Step 3: Restart server: `pnpm alexa-server:dev`
- Step 4: Start ngrok: `ngrok http --url=smarty.ngrok.app 5182`
- Step 5: Re-authenticate in browser: `http://localhost:5182/auth/smartthings`
- Trigger when OAuth scopes change or tokens expire

### Health Check Endpoints
- Backend health: `http://localhost:5182/health`
- OAuth status: `http://localhost:5182/auth/smartthings/status`
- Ngrok tunnel: `https://smarty.ngrok.app/health`
- Use these to verify deployment status
