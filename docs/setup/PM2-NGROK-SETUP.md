# PM2 ngrok Tunnel Management

## Overview
The ngrok tunnel for smarterthings is managed by PM2 for automatic restarts and reliability.

## Configuration
- **Config File**: `ecosystem.config.cjs`
- **Tunnel URL**: https://smarty.ngrok.app
- **Local Port**: 5181
- **Process Name**: `smarterthings-ngrok`

## PM2 Commands

### Check Status
```bash
pm2 status
```

### View Logs
```bash
# Live logs
pm2 logs smarterthings-ngrok

# Last 50 lines
pm2 logs smarterthings-ngrok --lines 50

# Error logs only
pm2 logs smarterthings-ngrok --err
```

### Restart/Stop/Start
```bash
# Restart tunnel
pm2 restart smarterthings-ngrok

# Stop tunnel
pm2 stop smarterthings-ngrok

# Start tunnel
pm2 start smarterthings-ngrok

# Start using config file
pm2 start ecosystem.config.cjs
```

### Delete Process
```bash
pm2 delete smarterthings-ngrok
```

### Save Configuration
```bash
# Save current PM2 process list
pm2 save

# View saved processes
pm2 list
```

## Auto-Restart Configuration

The ngrok tunnel is configured with:
- **Auto-restart**: Enabled
- **Max restarts**: 10
- **Min uptime**: 10 seconds before considering stable
- **Restart delay**: 3 seconds between restarts
- **Max memory**: 200MB before restart

## System Startup (Optional)

To make PM2 start on system boot:

```bash
# Generate startup script
pm2 startup

# Copy and run the command it outputs (requires sudo)
# Then save processes:
pm2 save
```

For macOS (launchd):
```bash
sudo env PATH=$PATH:/opt/homebrew/Cellar/node/24.9.0_1/bin /opt/homebrew/lib/node_modules/pm2/bin/pm2 startup launchd -u masa --hp /Users/masa
```

## Verification

### Check Tunnel Status
```bash
# Check ngrok API
curl -s http://127.0.0.1:4040/api/tunnels | jq '.tunnels[0].public_url'

# Test public URL
curl -I https://smarty.ngrok.app
```

### Check Process Health
```bash
# Monitor PM2 processes
pm2 monit

# Check specific process info
pm2 info smarterthings-ngrok
```

## Log Files

Logs are stored in:
- **Output logs**: `./logs/ngrok-out.log`
- **Error logs**: `./logs/ngrok-error.log`

## Troubleshooting

### Tunnel not responding
```bash
pm2 restart smarterthings-ngrok
pm2 logs smarterthings-ngrok --lines 100
```

### Process keeps crashing
```bash
# Check error logs
pm2 logs smarterthings-ngrok --err --lines 50

# Check if ngrok is properly installed
which ngrok

# Verify ngrok authentication
ngrok config check
```

### Kill all ngrok processes and restart
```bash
killall ngrok
pm2 restart smarterthings-ngrok
```

## Current Status

Tunnel is running and verified:
- Process Status: Online
- Public URL: https://smarty.ngrok.app
- Forwarding to: localhost:5181
- PM2 Process ID: Check with `pm2 list`
