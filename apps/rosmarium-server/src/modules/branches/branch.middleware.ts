import { FastifyRequest, FastifyReply } from "fastify";
import { branchStorage } from "../../db/index.js";

export function branchStorageHook(request: FastifyRequest, reply: FastifyReply, done: () => void) {
    const branchId = request.headers["x-branch-id"] as string;
    if (branchId) {
        branchStorage.run(branchId, done);
    } else {
        done();
    }
}
