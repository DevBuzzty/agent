"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentRunner = void 0;
const openai_1 = __importDefault(require("openai"));
const sdk_1 = __importDefault(require("@anthropic-ai/sdk"));
const generative_ai_1 = require("@google/generative-ai");
class AgentRunner {
    config;
    lastCallTime = 0;
    registeredTools = [];
    knowledgeManager;
    constructor(config) {
        this.config = config;
    }
    registerTools(tools) {
        this.registeredTools = tools;
    }
    setKnowledgeManager(km) {
        this.knowledgeManager = km;
    }
    async applyCooling() {
        const now = Date.now();
        const elapsed = now - this.lastCallTime;
        if (elapsed < this.config.coolingRateMs) {
            const waitTime = this.config.coolingRateMs - elapsed;
            console.log(`[AgentRunner] Rate limit cooling for ${waitTime}ms...`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
        }
        this.lastCallTime = Date.now();
    }
    applyContextWindowManagement(messages) {
        const maxChars = this.config.maxTokens * 4;
        let currentChars = 0;
        const truncatedMessages = [];
        const systemMessage = messages.find(m => m.role === 'system');
        if (systemMessage) {
            currentChars += systemMessage.content.length;
            truncatedMessages.push(systemMessage);
        }
        for (let i = messages.length - 1; i >= 0; i--) {
            const msg = messages[i];
            if (msg.role === 'system')
                continue;
            const len = msg.content ? msg.content.length : 100; // rough estimate for tool calls
            if (currentChars + len <= maxChars) {
                currentChars += len;
                truncatedMessages.unshift(msg);
            }
            else {
                console.warn(`[AgentRunner] Context window full. Truncating history.`);
                break;
            }
        }
        return truncatedMessages;
    }
    buildSystemPrompt() {
        let prompt = "You are a highly capable AI agent.\n\nHere are the First-Class Tools available to you. You MUST strictly use their exact JSON Schema for arguments.\n";
        for (const tool of this.registeredTools) {
            prompt += `---\n${tool.getSystemPromptText()}\n`;
        }
        // Phase 4: Dynamic Knowledge Injection
        if (this.knowledgeManager) {
            const modules = this.knowledgeManager.getLoadedModules();
            if (modules.length > 0) {
                prompt += `\n\n--- DOMAIN KNOWLEDGE ---\n`;
                for (const mod of modules) {
                    prompt += `\n[Module: ${mod.name}]\nDescription: ${mod.description}\nInstructions:\n${mod.instructions}\n`;
                }
                const overhead = this.knowledgeManager.calculateTokenOverhead();
                console.log(`[AgentRunner] Injected ${modules.length} knowledge modules. Calculated Overhead: ${overhead} characters.`);
            }
        }
        return prompt;
    }
    async run(messages) {
        await this.applyCooling();
        const systemPromptText = this.buildSystemPrompt();
        let injectedMessages = [...messages];
        const systemMsgIndex = injectedMessages.findIndex(m => m.role === 'system');
        if (systemMsgIndex > -1) {
            injectedMessages[systemMsgIndex].content = `${systemPromptText}\n\nUser Context:\n${injectedMessages[systemMsgIndex].content}`;
        }
        else {
            injectedMessages.unshift({ role: 'system', content: systemPromptText });
        }
        const contextMessages = this.applyContextWindowManagement(injectedMessages);
        console.log(`[AgentRunner] Running model ${this.config.provider}:${this.config.modelName}`);
        if (this.config.provider === 'openai' || this.config.provider === 'moonshot' || this.config.provider === 'openrouter' || this.config.provider === 'ollama') {
            return this.runOpenAICompatible(contextMessages);
        }
        else if (this.config.provider === 'anthropic') {
            return this.runAnthropic(contextMessages);
        }
        else if (this.config.provider === 'gemini') {
            return this.runGemini(contextMessages);
        }
        throw new Error(`Unsupported provider: ${this.config.provider}`);
    }
    buildOpenAITools() {
        return this.registeredTools.map(t => ({
            type: "function",
            function: {
                name: t.name,
                description: t.description,
                parameters: t.parameters
            }
        }));
    }
    async runOpenAICompatible(messages) {
        const baseURLs = {
            'openai': 'https://api.openai.com/v1',
            'moonshot': 'https://api.moonshot.cn/v1',
            'openrouter': 'https://openrouter.ai/api/v1',
            'ollama': 'http://localhost:11434/v1'
        };
        const baseURL = baseURLs[this.config.provider];
        if (this.config.apiKey === 'mock') {
            return {
                text: "I am a mock LLM. I received your message and executed.",
                toolCalls: [],
                finishReason: 'stop'
            };
        }
        const openai = new openai_1.default({
            apiKey: this.config.apiKey,
            baseURL: baseURL
        });
        const openAITools = this.buildOpenAITools();
        try {
            const apiMessages = messages.map(m => {
                const apiMsg = { role: m.role, content: m.content || null };
                if (m.tool_call_id)
                    apiMsg.tool_call_id = m.tool_call_id;
                if (m.tool_calls && m.tool_calls.length > 0) {
                    apiMsg.tool_calls = m.tool_calls.map(tc => ({
                        id: tc.id,
                        type: 'function',
                        function: { name: tc.name, arguments: JSON.stringify(tc.args) }
                    }));
                }
                return apiMsg;
            });
            const response = await openai.chat.completions.create({
                model: this.config.modelName,
                messages: apiMessages,
                tools: openAITools.length > 0 ? openAITools : undefined
            });
            const choice = response.choices[0];
            const toolCalls = choice.message.tool_calls?.map(tc => {
                const tcall = tc;
                return {
                    id: tc.id,
                    name: tcall.function.name,
                    args: JSON.parse(tcall.function.arguments)
                };
            }) || [];
            return {
                text: choice.message.content || '',
                toolCalls: toolCalls,
                finishReason: choice.finish_reason === 'tool_calls' ? 'tool_calls' : (choice.finish_reason === 'length' ? 'length' : 'stop')
            };
        }
        catch (e) {
            console.error("LLM Error:", e.message);
            return { text: `Error calling LLM: ${e.message}`, toolCalls: [], finishReason: 'stop' };
        }
    }
    async runAnthropic(messages) {
        if (this.config.apiKey === 'mock') {
            return { text: "I am a mock Anthropic LLM.", toolCalls: [], finishReason: 'stop' };
        }
        const anthropic = new sdk_1.default({ apiKey: this.config.apiKey });
        const system = messages.filter(m => m.role === 'system').map(m => m.content).join('\n');
        const userMsgs = messages.filter(m => m.role !== 'system').map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content }));
        try {
            const response = await anthropic.messages.create({
                model: this.config.modelName,
                max_tokens: 1024,
                system: system,
                messages: userMsgs,
            });
            return {
                text: response.content.map(c => c.type === 'text' ? c.text : '').join(''),
                toolCalls: [],
                finishReason: 'stop'
            };
        }
        catch (e) {
            return { text: `Error calling LLM: ${e.message}`, toolCalls: [], finishReason: 'stop' };
        }
    }
    async runGemini(messages) {
        if (this.config.apiKey === 'mock') {
            return { text: "I am a mock Gemini LLM.", toolCalls: [], finishReason: 'stop' };
        }
        const genAI = new generative_ai_1.GoogleGenerativeAI(this.config.apiKey);
        const model = genAI.getGenerativeModel({ model: this.config.modelName });
        const history = messages.map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content || '' }] }));
        try {
            const chat = model.startChat({ history: history.slice(0, -1) });
            const lastMsg = history[history.length - 1];
            const result = await chat.sendMessage(lastMsg.parts[0].text);
            return {
                text: result.response.text(),
                toolCalls: [],
                finishReason: 'stop'
            };
        }
        catch (e) {
            return { text: `Error calling LLM: ${e.message}`, toolCalls: [], finishReason: 'stop' };
        }
    }
}
exports.AgentRunner = AgentRunner;
