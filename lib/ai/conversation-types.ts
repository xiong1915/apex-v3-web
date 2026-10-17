import type { AISource, AIFactCard } from './types';
export interface ChatTurn {
 id: string;
 role: 'user' | 'assistant';
 content: string;
 sources?: AISource[];
 factCard?: AIFactCard;
 status?: 'completed' | 'streaming' | 'error' | 'aborted';
}
export interface Conversation {
 id: string;
 title: string;
 revision: number;
 createdAt: string;
 updatedAt: string;
 messages: ChatTurn[];
}
export type ConversationSummary = Omit<Conversation, 'messages'> & { messageCount: number };
