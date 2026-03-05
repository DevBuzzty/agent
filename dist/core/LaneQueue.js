"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LaneQueue = void 0;
/**
 * Ensures strict, serial FIFO execution of tasks *per session*.
 * This prevents race conditions and file system corruption by concurrent writes on the same context.
 */
class LaneQueue {
    queues = new Map();
    processing = new Set();
    /**
     * Enqueue a task for a specific session lane.
     */
    enqueue(sessionId, task) {
        if (!this.queues.has(sessionId)) {
            this.queues.set(sessionId, []);
        }
        this.queues.get(sessionId).push(task);
        // If this lane isn't currently processing, start it
        if (!this.processing.has(sessionId)) {
            this.processLane(sessionId);
        }
    }
    /**
     * Process tasks in a specific lane sequentially.
     */
    async processLane(sessionId) {
        this.processing.add(sessionId);
        const queue = this.queues.get(sessionId);
        try {
            while (queue && queue.length > 0) {
                const currentTask = queue.shift();
                if (currentTask) {
                    try {
                        await currentTask();
                    }
                    catch (error) {
                        console.error(`[LaneQueue] Task execution failed in session ${sessionId}:`, error);
                        // Prevents a single failing task from silently stopping the queue loop execution
                    }
                }
            }
        }
        finally {
            // Guaranteed cleanup even if an unexpected synchronous exception breaks the loop
            this.processing.delete(sessionId);
        }
        // Clean up empty queue map
        if (queue && queue.length === 0) {
            this.queues.delete(sessionId);
        }
    }
}
exports.LaneQueue = LaneQueue;
