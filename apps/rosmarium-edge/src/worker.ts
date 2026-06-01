import appRouter from './router.js';
import type { Env } from './router.js';
import type { ExecutionContext } from '@cloudflare/workers-types';

export default {
  fetch(request: Request, env: Env, ctx: ExecutionContext) {
    return appRouter.fetch(request, env, ctx);
  }
};
