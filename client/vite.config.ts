import { defineConfig } from 'vite';

// No custom config needed for now
export default defineConfig({
  optimizeDeps: {
    include: [
      'miniplex',
      'eventery' // Also include the problematic transitive dependency
    ]
  }
}); 