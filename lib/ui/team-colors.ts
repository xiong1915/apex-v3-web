import type {CSSProperties} from 'react';

// APEX interface accents inspired by team identities; not licensed team artwork.
const teams = [
  {keys:['ferrari','法拉利'],color:'#E8002D',ink:'#B60024'},
  {keys:['mercedes','梅赛德斯'],color:'#00A99D',ink:'#006C64'},
  {keys:['red_bull','red bull','红牛车队'],color:'#3671C6',ink:'#22559C'},
  {keys:['mclaren','迈凯伦'],color:'#FF8000',ink:'#A14D00'},
  {keys:['aston_martin','aston martin','阿斯顿'],color:'#229971',ink:'#146C4D'},
  {keys:['alpine','阿尔派'],color:'#0093CC',ink:'#006891'},
  {keys:['williams','威廉姆斯'],color:'#1868DB',ink:'#174DA0'},
  {keys:['racing_bulls','racing bulls','rb f1','小红牛'],color:'#6692FF',ink:'#3655A5'},
  {keys:['haas','哈斯'],color:'#9A9DA1',ink:'#53565C'},
  {keys:['audi','奥迪'],color:'#EB4526',ink:'#AD301B'},
  {keys:['cadillac','凯迪拉克'],color:'#8B8B91',ink:'#505057'},
] as const;
export function teamTheme(label:string){
 const name=label.toLowerCase();
 return teams.find(team=>team.keys.some(key=>key==='红牛车队'?name.includes(key)&&!name.includes('小红牛'):name===key||name.includes(key)))||{color:'#747A84',ink:'#535B65'};
}
export function teamStyle(label:string):CSSProperties{
 const {color,ink}=teamTheme(label);
 return {'--team-color':color,'--team-ink':ink} as CSSProperties;
}
