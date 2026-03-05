"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TokenOptimizer = void 0;
/**
 * Utility for optimizing text length to preserve token budgets.
 * Uses a "middle-out" truncation strategy to keep the beginning (context)
 * and the end (often containing errors, conclusions, or final states) of large texts.
 */
class TokenOptimizer {
    /**
     * Truncates a string by removing the middle portion if it exceeds maxChars.
     */
    static truncateMiddle(text, maxChars = 4000) {
        if (!text || text.length <= maxChars) {
            return text;
        }
        const keepHead = Math.floor(maxChars * 0.4); // Keep first 40%
        const keepTail = Math.floor(maxChars * 0.4); // Keep last 40%
        const removedCount = text.length - (keepHead + keepTail);
        const head = text.substring(0, keepHead);
        const tail = text.substring(text.length - keepTail);
        return `${head}\n\n... [TOKEN OPTIMIZER: Removed ${removedCount} characters to save context] ...\n\n${tail}`;
    }
    /**
     * Helper to summarize deeply nested or massive JSON objects.
     * Converts to string and applies middle truncation.
     */
    static optimizeJson(obj, maxChars = 2000) {
        try {
            const str = JSON.stringify(obj, null, 2);
            return this.truncateMiddle(str, maxChars);
        }
        catch {
            return "[Unserializable Object]";
        }
    }
}
exports.TokenOptimizer = TokenOptimizer;
