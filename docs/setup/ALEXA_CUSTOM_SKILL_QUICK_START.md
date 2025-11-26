# Alexa Custom Skill Quick Start

## What Changed?

The `/alexa` endpoint now supports **Custom Skill** format (conversational AI with LLM) instead of Smart Home Skill format.

### Before (Smart Home Skill)
```
User: "Alexa, turn on living room light"
  ↓
Alexa recognizes "turn on" command
  ↓
Sends PowerController.TurnOn directive
  ↓
Direct SmartThings API call
```

### After (Custom Skill)
```
User: "Alexa, turn on living room light"
  ↓
Alexa captures natural language
  ↓
Sends to LLM (ChatOrchestrator)
  ↓
LLM decides which MCP tools to call
  ↓
MCP executes SmartThings operations
  ↓
Natural language response
```

## API Endpoints

| Endpoint | Type | Use Case |
|----------|------|----------|
| `/alexa` | Custom Skill | Conversational AI, natural language queries |
| `/alexa-smarthome` | Smart Home Skill | Direct device control (legacy) |

## Quick Test

### Test LaunchRequest

```bash
curl -X POST http://localhost:3000/alexa \
  -H "Content-Type: application/json" \
  -d '{
    "version": "1.0",
    "request": {
      "type": "LaunchRequest",
      "requestId": "test-1",
      "timestamp": "2025-01-19T20:00:00Z"
    }
  }'
```

Expected: `{"version":"1.0","response":{"outputSpeech":{"type":"PlainText","text":"What would you like to do?"},"shouldEndSession":false}}`

### Test Natural Language Query

```bash
curl -X POST http://localhost:3000/alexa \
  -H "Content-Type: application/json" \
  -d '{
    "version": "1.0",
    "session": {
      "sessionId": "test-123",
      "new": false
    },
    "request": {
      "type": "IntentRequest",
      "requestId": "test-2",
      "timestamp": "2025-01-19T20:00:00Z",
      "intent": {
        "name": "CatchAllIntent",
        "slots": {
          "query": {
            "name": "query",
            "value": "list all devices"
          }
        }
      }
    }
  }'
```

## Environment Setup

Required environment variables:

```bash
# .env file
SMARTTHINGS_PAT=your_smartthings_token
OPENROUTER_API_KEY=your_openrouter_key
```

## Start Server

```bash
npm run build
npm run start:alexa
```

Server runs on `http://localhost:3000`

## Key Differences

### Request Format

**Custom Skill:**
```json
{
  "version": "1.0",
  "request": {
    "type": "LaunchRequest | IntentRequest | SessionEndedRequest"
  }
}
```

**Smart Home Skill:**
```json
{
  "directive": {
    "header": {
      "namespace": "Alexa.PowerController",
      "name": "TurnOn"
    }
  }
}
```

### Response Format

**Custom Skill:**
```json
{
  "version": "1.0",
  "response": {
    "outputSpeech": {
      "type": "PlainText",
      "text": "Natural language response"
    },
    "shouldEndSession": true
  }
}
```

**Smart Home Skill:**
```json
{
  "event": {
    "header": {
      "namespace": "Alexa",
      "name": "Response"
    }
  }
}
```

## Integration Flow

### Custom Skill (/alexa)

1. **LaunchRequest**: User opens skill
   - Response: "What would you like to do?"

2. **IntentRequest**: User makes query
   - CatchAllIntent: Natural language → ChatOrchestrator → LLM + MCP → SmartThings
   - Built-in intents: Help, Stop, Cancel, Fallback

3. **SessionEndedRequest**: Cleanup session
   - Close orchestrator
   - Remove from session store

### Session Management

- Sessions stored in-memory by sessionId
- 30-minute timeout for inactive sessions
- Automatic cleanup every 5 minutes
- Maintains conversation context across requests

## Supported Intents

| Intent | Purpose | Example |
|--------|---------|---------|
| `CatchAllIntent` | Natural language queries | "turn on living room light" |
| `AMAZON.HelpIntent` | Help information | "help" |
| `AMAZON.StopIntent` | Stop and exit | "stop" |
| `AMAZON.CancelIntent` | Cancel operation | "cancel" |
| `AMAZON.FallbackIntent` | Unrecognized input | (anything not understood) |

## Performance

| Metric | Custom Skill | Smart Home |
|--------|--------------|------------|
| Latency | 2-5 seconds | <500ms |
| Complexity | High (LLM processing) | Low (direct API) |
| Flexibility | Natural language | Fixed commands |
| Session | Stateful | Stateless |

## Error Messages

User-friendly error responses:

- **Chatbot error**: "Sorry, something went wrong."
- **Unknown request**: "I didn't understand that."
- **Missing query**: "I did not hear what you wanted to do."
- **Unknown intent**: "I'm not sure how to help with that."

## Troubleshooting

### Server won't start
- Check `SMARTTHINGS_PAT` is set
- Check `OPENROUTER_API_KEY` is set
- Verify port 3000 is available

### Requests fail
- Verify request format (use examples above)
- Check server logs for errors
- Test with `/health` endpoint first

### Slow responses
- Expected: 2-5 seconds for LLM processing
- If slower: Check OpenRouter API status
- Alternative: Use `/alexa-smarthome` for direct control

## Migration from Smart Home Skill

If you have existing Smart Home Skill integration:

1. **No code changes needed** - Smart Home API moved to `/alexa-smarthome`
2. **Update Alexa Skill configuration** to use new endpoint format
3. **Test both endpoints** to ensure backward compatibility
4. **Choose your integration**:
   - Custom Skill: Better UX, natural language, conversational
   - Smart Home Skill: Lower latency, fixed commands, device-centric

## Next Steps

1. Set up ngrok tunnel: `ngrok http 3000 --subdomain=smarty`
2. Configure Alexa Custom Skill in developer console
3. Set endpoint: `https://smarty.ngrok-free.app/alexa`
4. Add CatchAllIntent with `{query}` sample utterance
5. Test with real Alexa device

## Documentation

- Full testing guide: `ALEXA_CUSTOM_SKILL_TESTING.md`
- Architecture details: See `src/server-alexa.ts` header comments
- Handler implementation: `src/alexa/custom-skill.ts`
