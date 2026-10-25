export function GET() {
 return Response.json({error:'历史动态回放接口已停用，请使用实时赛事中心。',replacement:'/api/f1/live/snapshot',page:'/live'}, {status:410,headers:{'Cache-Control':'no-store','Link':'</api/f1/live/snapshot>; rel="successor-version"'}});
}