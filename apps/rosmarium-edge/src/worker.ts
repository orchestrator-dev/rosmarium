import appRouter from './router.js';

export default {
  fetch(request: Request, env: any, ctx: any) {
    return appRouter.fetch(request, env, ctx);
  }
};
