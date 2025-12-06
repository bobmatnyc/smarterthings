# Constants and Labels

This directory contains centralized constants and text labels for the application.

## Labels System (`labels.ts`)

Type-safe, centralized text labels for UI consistency and i18n readiness.

### Usage

Import specific label groups as needed:

```typescript
import { AUTH_LABELS, DEVICE_LABELS, ERROR_LABELS } from '$lib/constants/labels';

// Static labels
console.log(AUTH_LABELS.connectButton); // "Connect SmartThings Account"
console.log(DEVICE_LABELS.on); // "On"

// Dynamic labels (functions)
const deviceCount = DEVICE_LABELS.deviceCount(5); // "5 devices"
const copyright = FOOTER_LABELS.copyright(2025); // "© 2025 Smarter Things. All rights reserved."
```

### In Svelte Components

```svelte
<script lang="ts">
  import { AUTH_LABELS } from '$lib/constants/labels';
</script>

<h1>{AUTH_LABELS.connectTitle}</h1>
<p>{AUTH_LABELS.connectDescription}</p>
<button>{AUTH_LABELS.connectButton}</button>
```

### Label Categories

- **APP_LABELS** - Application name, tagline, description
- **NAV_LABELS** - Navigation menu items
- **AUTH_LABELS** - Authentication and OAuth flows
- **ROOM_LABELS** - Room management
- **DEVICE_LABELS** - Device control and status
- **AUTOMATION_LABELS** - Automations and scenes
- **RULE_LABELS** - Rules management
- **EVENT_LABELS** - Event history and display
- **CHAT_LABELS** - AI assistant chat interface
- **LOADING_LABELS** - Loading states
- **ERROR_LABELS** - Error messages
- **ACTION_LABELS** - Common action buttons
- **FOOTER_LABELS** - Footer text
- **A11Y_LABELS** - Accessibility labels (ARIA)

### Benefits

1. **Type Safety** - TypeScript autocomplete for all labels
2. **Consistency** - Single source of truth for UI text
3. **Maintainability** - Change text in one place, updates everywhere
4. **i18n Ready** - Prepared for future internationalization
5. **Searchability** - Easy to find where text is used

### Future: Internationalization (i18n)

This system is designed for easy migration to i18n:

```typescript
// Future i18n integration example
import { t } from '$lib/i18n';

// Current
AUTH_LABELS.connectButton;

// Future with i18n
t('auth.connectButton', AUTH_LABELS.connectButton);
```

### Adding New Labels

1. Add to appropriate section in `labels.ts`
2. Use `as const` for type inference
3. Export type if needed for external use
4. Update this README with the new category

### Naming Conventions

- Use camelCase for label keys
- Use descriptive, clear names
- Group related labels together
- Use functions for dynamic content (counts, dates, etc.)
