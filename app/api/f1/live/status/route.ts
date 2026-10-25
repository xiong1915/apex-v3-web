// Status and snapshot share exactly the same data cache and authorization policy.
import {GET as snapshotGET} from '../snapshot/route';
export const dynamic='force-dynamic';
export const GET=snapshotGET;
