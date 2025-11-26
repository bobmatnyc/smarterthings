# Alexa Custom Skill Testing Guide

## Overview

The `/alexa` endpoint now supports **Custom Skill** (conversational AI) format instead of Smart Home Skill format.

**Architecture:**
- `/alexa` → Custom Skill (conversational with LLM)
- `/alexa-smarthome` → Smart Home Skill (direct device control)

## Setup Requirements

### 1. Environment Variables

Create a `.env` file with:

```bash
# SmartThings (required)
SMARTTHINGS_PAT=your_smartthings_token

# OpenRouter LLM (required for Custom Skill)
OPENROUTER_API_KEY=your_openrouter_api_key
OPENROUTER_MODEL=deepseek/deepseek-chat  # Optional, default

# Server configuration
ALEXA_SERVER_PORT=3000
ALEXA_SERVER_HOST=0.0.0.0
NODE_ENV=development
LOG_LEVEL=info
```

### 2. Start Server

```bash
# Build TypeScript
npm run build

# Start Alexa server
npm run start:alexa

# Or in development mode
npm run dev:alexa
```

Server should start on `http://localhost:3000`

## Testing Custom Skill Endpoint

### Test 1: LaunchRequest

**Request:** User opens skill: "Alexa, open smart home"

```bash
curl -X POST http://localhost:3000/alexa \
  -H "Content-Type: application/json" \
  -d '{
    "version": "1.0",
    "session": {
      "new": true,
      "sessionId": "test-session-123",
      "user": {
        "userId": "test-user"
      }
    },
    "request": {
      "type": "LaunchRequest",
      "requestId": "test-request-1",
      "timestamp": "2025-01-19T20:00:00Z",
      "locale": "en-US"
    }
  }'
```

**Expected Response:**

```json
{
  "version": "1.0",
  "response": {
    "outputSpeech": {
      "type": "PlainText",
      "text": "What would you like to do?"
    },
    "shouldEndSession": false
  }
}
```

### Test 2: CatchAllIntent with Natural Language

**Request:** User asks: "turn on living room light"

```bash
curl -X POST http://localhost:3000/alexa \
  -H "Content-Type: application/json" \
  -d '{
    "version": "1.0",
    "session": {
      "new": false,
      "sessionId": "test-session-123",
      "user": {
        "userId": "test-user"
      }
    },
    "request": {
      "type": "IntentRequest",
      "requestId": "test-request-2",
      "timestamp": "2025-01-19T20:01:00Z",
      "locale": "en-US",
      "intent": {
        "name": "CatchAllIntent",
        "confirmationStatus": "NONE",
        "slots": {
          "query": {
            "name": "query",
            "value": "turn on living room light",
            "confirmationStatus": "NONE"
          }
        }
      }
    }
  }'
```

**Expected Response:**

```json
{
  "version": "1.0",
  "response": {
    "outputSpeech": {
      "type": "PlainText",
      "text": "I turned on the living room light."
    },
    "shouldEndSession": true
  }
}
```

### Test 3: Device Status Query

**Request:** "What is the temperature in bedroom?"

```bash
curl -X POST http://localhost:3000/alexa \
  -H "Content-Type: application/json" \
  -d '{
    "version": "1.0",
    "session": {
      "new": false,
      "sessionId": "test-session-456",
      "user": {
        "userId": "test-user"
      }
    },
    "request": {
      "type": "IntentRequest",
      "requestId": "test-request-3",
      "timestamp": "2025-01-19T20:02:00Z",
      "locale": "en-US",
      "intent": {
        "name": "CatchAllIntent",
        "slots": {
          "query": {
            "name": "query",
            "value": "what is the temperature in bedroom"
          }
        }
      }
    }
  }'
```

### Test 4: AMAZON.HelpIntent

**Request:** User says: "help"

```bash
curl -X POST http://localhost:3000/alexa \
  -H "Content-Type: application/json" \
  -d '{
    "version": "1.0",
    "session": {
      "new": false,
      "sessionId": "test-session-789",
      "user": {
        "userId": "test-user"
      }
    },
    "request": {
      "type": "IntentRequest",
      "requestId": "test-request-4",
      "timestamp": "2025-01-19T20:03:00Z",
      "locale": "en-US",
      "intent": {
        "name": "AMAZON.HelpIntent"
      }
    }
  }'
```

**Expected Response:**

```json
{
  "version": "1.0",
  "response": {
    "outputSpeech": {
      "type": "PlainText",
      "text": "You can ask me to control your SmartThings devices. For example, say \"turn on living room light\" or \"what is the temperature in bedroom?\""
    },
    "shouldEndSession": false
  }
}
```

### Test 5: AMAZON.StopIntent

**Request:** User says: "stop"

```bash
curl -X POST http://localhost:3000/alexa \
  -H "Content-Type: application/json" \
  -d '{
    "version": "1.0",
    "session": {
      "new": false,
      "sessionId": "test-session-789",
      "user": {
        "userId": "test-user"
      }
    },
    "request": {
      "type": "IntentRequest",
      "requestId": "test-request-5",
      "timestamp": "2025-01-19T20:04:00Z",
      "locale": "en-US",
      "intent": {
        "name": "AMAZON.StopIntent"
      }
    }
  }'
```

**Expected Response:**

```json
{
  "version": "1.0",
  "response": {
    "outputSpeech": {
      "type": "PlainText",
      "text": "Goodbye!"
    },
    "shouldEndSession": true
  }
}
```

### Test 6: SessionEndedRequest

**Request:** Session ends

```bash
curl -X POST http://localhost:3000/alexa \
  -H "Content-Type: application/json" \
  -d '{
    "version": "1.0",
    "session": {
      "new": false,
      "sessionId": "test-session-789",
      "user": {
        "userId": "test-user"
      }
    },
    "request": {
      "type": "SessionEndedRequest",
      "requestId": "test-request-6",
      "timestamp": "2025-01-19T20:05:00Z",
      "locale": "en-US",
      "reason": "USER_INITIATED"
    }
  }'
```

**Expected Response:**

```json
{
  "version": "1.0",
  "response": {
    "shouldEndSession": true
  }
}
```

## Testing Smart Home Endpoint (Legacy)

The original Smart Home Skill API is still available at `/alexa-smarthome`:

```bash
curl -X POST http://localhost:3000/alexa-smarthome \
  -H "Content-Type: application/json" \
  -d '{
    "directive": {
      "header": {
        "namespace": "Alexa.Discovery",
        "name": "Discover",
        "payloadVersion": "3",
        "messageId": "test-message-1"
      },
      "payload": {}
    }
  }'
```

## Ngrok Setup for Alexa Testing

### 1. Install ngrok

```bash
# macOS
brew install ngrok

# Linux
snap install ngrok
```

### 2. Setup Static Subdomain

Create/edit `~/.config/ngrok/ngrok.yml`:

```yaml
version: "2"
authtoken: your_ngrok_authtoken
tunnels:
  smartthings:
    proto: http
    addr: 3000
    subdomain: smarty
```

### 3. Start Tunnel

```bash
ngrok start smartthings
```

Your endpoint will be: `https://smarty.ngrok-free.app/alexa`

### 4. Configure Alexa Skill

1. Go to [Alexa Developer Console](https://developer.amazon.com/alexa/console/ask)
2. Create Custom Skill
3. Set endpoint: `https://smarty.ngrok-free.app/alexa`
4. Configure interaction model:

**Intent Schema:**

```json
{
  "intents": [
    {
      "name": "CatchAllIntent",
      "slots": [
        {
          "name": "query",
          "type": "AMAZON.SearchQuery"
        }
      ],
      "samples": [
        "{query}"
      ]
    },
    {
      "name": "AMAZON.HelpIntent"
    },
    {
      "name": "AMAZON.CancelIntent"
    },
    {
      "name": "AMAZON.StopIntent"
    },
    {
      "name": "AMAZON.FallbackIntent"
    }
  ]
}
```

**Sample Utterances for CatchAllIntent:**

```
{query}
```

## Troubleshooting

### Error: "OpenRouter API key is required"

**Solution:** Set `OPENROUTER_API_KEY` in `.env` file

```bash
OPENROUTER_API_KEY=your_api_key_here
```

### Error: "SmartThings Personal Access Token is required"

**Solution:** Set `SMARTTHINGS_PAT` in `.env` file

```bash
SMARTTHINGS_PAT=your_smartthings_token
```

### Error: "Invalid Custom Skill request structure"

**Cause:** Request doesn't match Custom Skill format

**Solution:** Ensure request has:
- `version` field
- `request` object with `type` field
- Valid request type: `LaunchRequest`, `IntentRequest`, or `SessionEndedRequest`

### Latency Issues

**Expected Latency:**
- Custom Skill (/alexa): 2-5 seconds (LLM processing)
- Smart Home (/alexa-smarthome): <500ms (direct API)

**If Custom Skill is too slow:**
1. Check OpenRouter API status
2. Try different model (e.g., `gpt-3.5-turbo`)
3. Check network connectivity
4. Review logs for bottlenecks

### Session Cleanup

Sessions expire after 30 minutes of inactivity. Check logs:

```bash
# View session activity
grep "chat session" logs/server.log

# View session cleanup
grep "Cleaning up expired session" logs/server.log
```

## Success Criteria

- ✅ LaunchRequest returns welcome message
- ✅ CatchAllIntent processes natural language queries
- ✅ Built-in intents (Help, Stop, Cancel, Fallback) work
- ✅ SessionEndedRequest cleans up resources
- ✅ TypeScript compilation succeeds
- ✅ Server runs on port 3000
- ✅ Both `/alexa` and `/alexa-smarthome` endpoints work
- ✅ Natural language commands execute SmartThings actions
- ✅ Error messages are user-friendly

## Architecture Diagram

```
User
  ↓
Alexa Cloud
  ↓
ngrok Tunnel (https://smarty.ngrok-free.app)
  ↓
Fastify Server (localhost:3000)
  ├── /alexa (Custom Skill)
  │     ↓
  │   CustomSkillHandler
  │     ↓
  │   ChatOrchestrator
  │     ↓
  │   LLM (OpenRouter) + MCP Client
  │     ↓
  │   SmartThings API
  │
  └── /alexa-smarthome (Smart Home Skill)
        ↓
      AlexaDirectiveHandler
        ↓
      SmartThings API (direct)
```

## Next Steps

1. Test with real Alexa device
2. Add more sophisticated error handling
3. Implement session persistence
4. Add analytics/metrics
5. Optimize LLM prompt for better responses
6. Add support for multi-turn conversations
7. Implement user preferences storage
