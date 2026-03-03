export interface NormalizedMessage {
  id: string;
  source: string;        // 'telegram', 'webhook', etc.
  channelId: string;     // The original chat ID / user ID
  authToken: string;     // E.g. token mapped to user ID for routing
  text: string;
  mediaAttachments: MediaAttachment[];
  timestamp: number;
}

export interface MediaAttachment {
  id: string;
  type: 'image' | 'document' | 'voice' | 'video';
  url?: string;
}

export interface IChannelAdapter {
  start(): void;
  stop(): void;
  onMessage(callback: (msg: NormalizedMessage) => Promise<void>): void;
  sendMessage(channelId: string, text: string): Promise<void>;
}
