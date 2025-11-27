# ngrok Tunnel Configuration for SmartThings Alexa Integration

## Summary

Successfully configured ngrok tunnel to expose the SmartThings Alexa server publicly.

## Configuration Details

### Server Configuration
- **Local Server**: Running on `localhost:3000`
- **Process ID**: 12973
- **Service**: mcp-smarterthings-alexa v1.0.1

### ngrok Tunnel Configuration
- **Public URL**: `https://smarty.ngrok.app`
- **Local Port**: 3000
- **Protocol**: HTTP
- **Domain Type**: Custom reserved domain (paid plan)
- **Process ID**: 22416

### Configuration File Location
```
/Users/masa/Library/Application Support/ngrok/ngrok.yml
```

### Tunnel Configuration Added
```yaml
smarty:
    proto: http
    addr: 3000
    domain: smarty.ngrok.app
    metadata: "SmartThings Alexa Integration Server"
```

## Endpoints

### Health Check Endpoint
- **URL**: `https://smarty.ngrok.app/health`
- **Method**: GET
- **Response**:
```json
{
  "status": "healthy",
  "service": "mcp-smarterthings-alexa",
  "version": "1.0.1",
  "uptime": 1018.850840041,
  "timestamp": "2025-11-26T09:42:31.816Z"
}
```

### Alexa Skill Endpoint
- **URL**: `https://smarty.ngrok.app/alexa`
- **Method**: POST
- **Use in**: Amazon Alexa Developer Console
- **SSL Certificate**: Provided by ngrok (automatic HTTPS)

## Verification Tests

### 1. Health Check Test
```bash
curl -s https://smarty.ngrok.app/health | jq '.'
```
✅ Status: 200 OK

### 2. Alexa Endpoint Test
```bash
curl -s https://smarty.ngrok.app/alexa -X POST \
  -H "Content-Type: application/json" \
  -d '{"version":"1.0","session":{"new":true},"request":{"type":"LaunchRequest"}}'
```
✅ Status: 200 OK (requires signature headers as expected)

## Starting the Tunnel

### Method 1: Using Configuration File
```bash
ngrok start smarty
```

### Method 2: Direct Command
```bash
ngrok http 3000 --domain=smarty.ngrok.app
```

### Current Running Process
The tunnel is currently active with the following command:
```bash
ngrok http 3000 --domain=smarty.ngrok.app
```

## Important Notes

### Port Mapping
- Original request specified port 80, but server runs on 3000
- Correct mapping: `https://smarty.ngrok.app` → `localhost:3000`
- ngrok automatically handles HTTPS termination

### Multiple ngrok Instances
- Running multiple ngrok instances simultaneously (the-island + smarty)
- Each instance has its own web interface port (only first instance gets 4040)
- Both tunnels function independently

### Domain Requirements
- `smarty.ngrok.app` is a custom reserved domain
- Requires paid ngrok plan
- Domain persists across restarts
- No configuration needed in DNS

### SSL/TLS
- ngrok automatically provides HTTPS
- Certificate is managed by ngrok
- No additional SSL configuration needed
- Meets Alexa skill security requirements

## Alexa Developer Console Configuration

When configuring your Alexa skill:

1. **Endpoint Type**: HTTPS
2. **Default Region URL**: `https://smarty.ngrok.app/alexa`
3. **SSL Certificate Type**: "My development endpoint is a sub-domain of a domain that has a wildcard certificate from a certificate authority"
4. **Account Linking** (if needed): Configure separately

## Troubleshooting

### Check Tunnel Status
```bash
# Check if ngrok process is running
ps aux | grep "[n]grok http 3000"

# Test public endpoint
curl -I https://smarty.ngrok.app/health
```

### Check Local Server
```bash
# Check if server is running on port 3000
lsof -i :3000 | grep LISTEN

# Test local endpoint
curl http://localhost:3000/health
```

### Restart Tunnel
```bash
# Stop current tunnel
pkill -f "ngrok http 3000"

# Start new tunnel
ngrok http 3000 --domain=smarty.ngrok.app
```

### View ngrok Web Interface
If this is the first ngrok instance started:
```bash
open http://localhost:4040
```

## Maintenance

### Keeping Tunnel Active
- The tunnel remains active as long as the ngrok process runs
- Consider using a process manager (PM2, systemd) for production
- Free tier tunnels expire on restart; paid domains persist

### Monitoring
- Monitor tunnel health via health endpoint
- Check ngrok process status regularly
- Review server logs for any connection issues

## Security Considerations

1. **Request Validation**: Server validates Alexa request signatures
2. **HTTPS Only**: All traffic encrypted via ngrok
3. **Domain Verification**: Using reserved custom domain
4. **Rate Limiting**: Consider implementing if needed
5. **Monitoring**: Monitor for unusual traffic patterns

## Next Steps

1. Configure Alexa skill in Amazon Developer Console
2. Set endpoint URL to `https://smarty.ngrok.app/alexa`
3. Test skill invocations
4. Monitor server logs during testing
5. Consider production deployment strategy

---

**Status**: ✅ Tunnel Active and Verified
**Date**: 2025-11-26
**Last Tested**: 2025-11-26T09:42:31.816Z
