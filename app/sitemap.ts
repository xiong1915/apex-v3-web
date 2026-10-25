import type { MetadataRoute } from 'next';
export default function sitemap(): MetadataRoute.Sitemap {
 return ['','/races','/standings','/drivers','/teams','/live'].map(path=>({url:'https://f1.tike69.cc.cd'+path,changeFrequency:path==='/live'?'daily':'weekly',priority:path===''?1:0.8}));
}
