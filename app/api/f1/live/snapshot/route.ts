import {NextRequest,NextResponse} from 'next/server';
import {getPublicLiveService,LiveRequestError,parseLiveQuery} from '@/lib/f1/live/service';
export const dynamic='force-dynamic';
export async function GET(req:NextRequest){
 try{
  const query=parseLiveQuery(req.nextUrl.searchParams),data=await getPublicLiveService().getSnapshot(query);
  return NextResponse.json(data,{headers:{'Cache-Control':'no-store','X-APEX-Live-Mode':data.availability.timingPublic?'authorized-snapshot':'schedule-results','X-Content-Type-Options':'nosniff'}});
 }catch(error){const status=error instanceof LiveRequestError?error.status:503;return NextResponse.json({error:error instanceof LiveRequestError?error.message:'赛事数据暂不可用，请稍后重试'},{status,headers:{'Cache-Control':'no-store',...(status===503?{'Retry-After':'10'}:{})}});}
}
