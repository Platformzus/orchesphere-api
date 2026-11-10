import {createWorker} from './worker-core.mjs';
import {apiRoutes,publicPaths} from './generated.mjs';
export default createWorker({routes:apiRoutes,publicPaths});
