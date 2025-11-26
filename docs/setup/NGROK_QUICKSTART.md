# ngrok Quick Reference - SmartThings Alexa

## Current Status

✅ **Tunnel Active**
- Public URL: `https://smarty.ngrok.app`
- Local Port: 3000
- Process ID: 22416

## Quick Commands

### Start Tunnel
```bash
# Method 1: Using config
ngrok start smarty

# Method 2: Direct command
ngrok http 3000 --domain=smarty.ngrok.app
```

### Stop Tunnel
```bash
pkill -f "ngrok http 3000"
```

### Check Status
```bash
# Check if running
ps aux | grep "[n]grok http 3000"

# Test public endpoint
curl https://smarty.ngrok.app/health

# Test local endpoint
curl http://localhost:3000/health
```

## Alexa Configuration

**Endpoint URL for Alexa Developer Console:**
```
https://smarty.ngrok.app/alexa
```

**SSL Certificate Type:**
- "My development endpoint is a sub-domain of a domain that has a wildcard certificate from a certificate authority"

## Troubleshooting

### Tunnel Not Working?
```bash
# 1. Check if server is running
lsof -i :3000

# 2. Restart ngrok
pkill -f "ngrok http 3000"
ngrok http 3000 --domain=smarty.ngrok.app

# 3. Verify connectivity
curl https://smarty.ngrok.app/health
```

### Port Already in Use?
```bash
# Check what's using port 3000
lsof -i :3000 | grep LISTEN
```

## Important Notes

- Server runs on port 3000 (not 80)
- Domain `smarty.ngrok.app` is reserved and persists
- HTTPS automatically provided by ngrok
- Multiple ngrok instances can run simultaneously

---

**Quick Links:**
- [Full Documentation](docs/NGROK_SETUP.md)
- [Server Status](http://localhost:3000/health)
- [Public Status](https://smarty.ngrok.app/health)
