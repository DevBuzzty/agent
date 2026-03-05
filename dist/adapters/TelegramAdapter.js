"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TelegramAdapter = void 0;
const telegraf_1 = require("telegraf");
class TelegramAdapter {
    bot;
    messageCallback;
    constructor(token) {
        this.bot = new telegraf_1.Telegraf(token);
        this.bot.on('message', async (ctx) => {
            if (!this.messageCallback)
                return;
            const msg = ctx.message;
            let text = '';
            if ('text' in msg) {
                text = msg.text;
            }
            else if ('caption' in msg && msg.caption) {
                text = msg.caption;
            }
            // Simplification for the PoC, media extraction could be enhanced
            const mediaAttachments = [];
            if ('photo' in msg) {
                mediaAttachments.push({ id: msg.photo[msg.photo.length - 1].file_id, type: 'image' });
            }
            const normalized = {
                id: String(msg.message_id),
                source: 'telegram',
                channelId: String(ctx.chat.id),
                authToken: String(ctx.from.id), // Using user ID as an auth token proxy for routing
                text: text,
                mediaAttachments,
                timestamp: msg.date * 1000
            };
            try {
                await this.messageCallback(normalized);
            }
            catch (err) {
                console.error("Error processing message:", err);
            }
        });
    }
    onMessage(callback) {
        this.messageCallback = callback;
    }
    async sendMessage(channelId, text) {
        await this.bot.telegram.sendMessage(channelId, text);
    }
    start() {
        this.bot.launch();
        console.log("Telegram Adapter started.");
    }
    stop() {
        this.bot.stop('SIGINT');
    }
}
exports.TelegramAdapter = TelegramAdapter;
