import { NextRequest } from 'next/server';
import { handleConversationRequest } from '@/lib/ai/conversation-handler';
export const dynamic = 'force-dynamic';
export const GET = (req: NextRequest) => handleConversationRequest(req, 'GET');
export const POST = (req: NextRequest) => handleConversationRequest(req, 'POST');
export const PUT = (req: NextRequest) => handleConversationRequest(req, 'PUT');
export const DELETE = (req: NextRequest) => handleConversationRequest(req, 'DELETE');
