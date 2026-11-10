import {createWorker} from './worker-core.mjs';
import {apiRoutes,publicPaths,apiEnabled} from './generated.mjs';
export default createWorker({routes:apiRoutes,publicPaths,apiEnabled});
