import { ModelMessage } from './AgentRunner';

export type LoopPattern = 'genericRepeat' | 'knownPollNoProgress' | 'pingPong';

export class LoopDetector {
  private history: ModelMessage[] = [];

  public evaluate(newToolCalls: Array<{name: string, args: any}>): string | null {
    if (this.history.length < 4 || newToolCalls.length === 0) return null;

    const lastCalls = this.extractRecentToolCalls(6);

    if (this.isGenericRepeat(lastCalls, newToolCalls)) {
      return `HARD ERROR [LoopDetector: genericRepeat]: You are repeating the exact same tool call sequentially without new information. STRATEGY CHANGE REQUIRED.`;
    }

    if (this.isKnownPollNoProgress(lastCalls, newToolCalls)) {
       return `HARD ERROR [LoopDetector: knownPollNoProgress]: You are repeatedly polling for state that is not changing. STRATEGY CHANGE REQUIRED.`;
    }

    if (this.isPingPong(lastCalls, newToolCalls)) {
        return `HARD ERROR [LoopDetector: pingPong]: Endless alternating delegation detected. STRATEGY CHANGE REQUIRED.`;
    }

    return null;
  }

  public recordMessage(msg: ModelMessage) {
    this.history.push(msg);
  }

  private extractRecentToolCalls(count: number): Array<{name: string, args: any}> {
     const calls: Array<{name: string, args: any}> = [];
     for(let i = this.history.length - 1; i >= 0 && calls.length < count; i--) {
         const msg = this.history[i];
         if (msg.role === 'assistant' && msg.tool_calls) {
             for (const tc of msg.tool_calls.reverse()) { // keep order recent
                 calls.push(tc);
             }
         }
     }
     return calls;
  }

  private isGenericRepeat(lastCalls: any[], current: any[]): boolean {
    if (lastCalls.length === 0) return false;
    const last = lastCalls[0];
    const curr = current[0];

    // Check if the current call is exactly the same as the immediately preceding call
    if (last.name === curr.name && JSON.stringify(last.args) === JSON.stringify(curr.args)) {
        // Only trigger if the tool response was also identical or unhelpful,
        // for PoC we just aggressively block exact consecutive identical calls.
        return true;
    }
    return false;
  }

  private isKnownPollNoProgress(lastCalls: any[], current: any[]): boolean {
    // Detect if we've made the same call 3 times recently with no state change
    let matches = 0;
    const curr = current[0];
    for (const call of lastCalls) {
        if (call.name === curr.name && JSON.stringify(call.args) === JSON.stringify(curr.args)) {
            matches++;
        }
    }
    return matches >= 3;
  }

  private isPingPong(lastCalls: any[], current: any[]): boolean {
    if (lastCalls.length < 3) return false;
    const curr = current[0];
    const prev1 = lastCalls[0];
    const prev2 = lastCalls[1];
    const prev3 = lastCalls[2];

    // Detect A -> B -> A -> B
    if (curr.name === prev2.name && prev1.name === prev3.name && curr.name !== prev1.name) {
        return true;
    }
    return false;
  }
}
