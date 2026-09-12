import type { WebRoute } from '@deepseek-ai/dsh-host-webserver';
/**
 * Build the three route handlers.
 */
export declare function makeRoutes(): {
    infoRoute: WebRoute;
    startRoute: WebRoute;
    checkRoute: WebRoute;
};
