# Introduction 
[Generation AI](https://www.generation-ai-stn.fi) base code library for all common components of our educational apps.

# Getting Started
```bash
npm install @knicos/genai-base
```

```typescript
import { ConnectionMonitor } from '@knicos/genai-base';

function MyComponent() {
    return <ConnectionMonitor />;
}
```

# Build and Test
Use `npm run build` to build the library in the `dist` folder. Testing uses vitest with `npm test`.
