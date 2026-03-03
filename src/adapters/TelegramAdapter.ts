import { Telegraf } from 'telegraf';
import { IChannelAdapter, NormalizedMessage } from './ChannelAdapter';

export class TelegramAdapter implements IChannelAdapter {
  private bot: Telegraf;
  private messageCallback?: (msg: NormalizedMessage) => Promise<void>;

  constructor(token: string) {
    this.bot = new Telegraf(token);

    this.bot.on('message', async (ctx) => {
      if (!this.messageCallback) return;

      const msg = ctx.message;
      let text = '';
      if ('text' in msg) {
        text = msg.text;
      } else if ('caption' in msg && msg.caption) {
        text = msg.caption;
      }

      // Simplification for the PoC, media extraction could be enhanced
      const mediaAttachments: any[] = [];
      if ('photo' in msg) {
        mediaAttachments.push({ id: msg.photo[msg.photo.length - 1].file_id, type: 'image' });
      }

      const normalized: NormalizedMessage = {
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
      } catch (err) {
        console.error("Error processing message:", err);
      }
    });
  }

  onMessage(callback: (msg: NormalizedMessage) => Promise<void>): void {
    this.messageCallback = callback;
  }

  async sendMessage(channelId: string, text: string): Promise<void> {
    await this.bot.telegram.sendMessage(channelId, text);
  }

  start(): void {
    this.bot.launch();
    console.log("Telegram Adapter started.");
  }

  stop(): void {
    this.bot.stop('SIGINT');
  }
}
