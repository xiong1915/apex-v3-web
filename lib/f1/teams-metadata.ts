// lib/f1/teams-metadata.ts
// APEX V3 2026 赛季 F1 车队规范化元数据与离线保底系统
// 严禁凭空编造假赛果，提供授权合规的视觉标识、主色与车队全称

export interface F1TeamMetadata {
  id: string; // 规范化 teamId (如 mclaren, ferrari, red_bull)
  name: string; // 中文官方全称
  nameEn: string; // 英文官方名称
  code: string; // 官方简称代码
  primaryColor: string; // 车队代表色 (Hex)
  accentColor: string; // 辅助强调色 (Hex)
  engine: string; // 动力单元
  base: string; // 总部所在地
  description?: string; // 简要介绍
}

export const F1_TEAMS_2026: F1TeamMetadata[] = [
  {
    id: 'mclaren',
    name: '迈凯伦车队',
    nameEn: 'McLaren Formula 1 Team',
    code: 'MCL',
    primaryColor: '#FF8000',
    accentColor: '#1A1A1A',
    engine: 'Mercedes-AMG',
    base: '英国沃金 (Woking, UK)',
    description: '历史悠久的英国传统豪门，以极具攻击性的木瓜橙涂装与年轻顶尖阵容著称。'
  },
  {
    id: 'ferrari',
    name: '法拉利车队',
    nameEn: 'Scuderia Ferrari',
    code: 'FER',
    primaryColor: '#E8002D',
    accentColor: '#FFF200',
    engine: 'Ferrari',
    base: '意大利马拉内罗 (Maranello, Italy)',
    description: 'F1 历史上最负盛名的常青车队，象征着跃马血统与无限竞速激情。'
  },
  {
    id: 'red_bull',
    name: '红牛车队',
    nameEn: 'Oracle Red Bull Racing',
    code: 'RBR',
    primaryColor: '#3671C6',
    accentColor: '#EA1D2D',
    engine: 'Red Bull Ford',
    base: '英国米尔顿凯恩斯 (Milton Keynes, UK)',
    description: '凭借极致空力设计与大师级战术运营统治现代 F1 赛场的极限先锋。'
  },
  {
    id: 'mercedes',
    name: '梅赛德斯车队',
    nameEn: 'Mercedes-AMG PETRONAS F1 Team',
    code: 'MER',
    primaryColor: '#27F4D2',
    accentColor: '#00A19B',
    engine: 'Mercedes-AMG',
    base: '英国布拉克利 (Brackley, UK)',
    description: '拥有八冠王霸业底蕴的银箭车队，代表德国精密工程与科技极致。'
  },
  {
    id: 'aston_martin',
    name: '阿斯顿·马丁车队',
    nameEn: 'Aston Martin Aramco F1 Team',
    code: 'AMR',
    primaryColor: '#229971',
    accentColor: '#CEDC00',
    engine: 'Honda',
    base: '英国银石 (Silverstone, UK)',
    description: '身披标志性赛车绿涂装的英国传奇超跑品牌，注入尖端设施蓄势争冠。'
  },
  {
    id: 'alpine',
    name: 'Alpine 车队',
    nameEn: 'BWT Alpine F1 Team',
    code: 'ALP',
    primaryColor: '#FF87BC',
    accentColor: '#0093CC',
    engine: 'Mercedes-AMG',
    base: '英国恩斯通 (Enstone, UK)',
    description: '雷诺旗下的法兰西蓝色火焰，融合粉蓝活力与坚毅拼搏精神。'
  },
  {
    id: 'haas',
    name: '哈斯车队',
    nameEn: 'MoneyGram Haas F1 Team',
    code: 'HAA',
    primaryColor: '#B6BABD',
    accentColor: '#E6002B',
    engine: 'Ferrari',
    base: '美国坎纳波利斯 (Kannapolis, USA)',
    description: '纯正美国资本血统的高效精干之师，在强敌林立的中游争夺每一寸赛道。'
  },
  {
    id: 'rb',
    name: '小红牛车队',
    nameEn: 'Visa Cash App RB F1 Team',
    code: 'RBF',
    primaryColor: '#6692FF',
    accentColor: '#E63946',
    engine: 'Red Bull Ford',
    base: '意大利法恩扎 (Faenza, Italy)',
    description: '意式年轻风暴与顶尖人才摇篮，兼具年轻车手锐气与极速战斗力。'
  },
  {
    id: 'williams',
    name: '威廉姆斯车队',
    nameEn: 'Williams Racing',
    code: 'WIL',
    primaryColor: '#64C4FF',
    accentColor: '#041E42',
    engine: 'Mercedes-AMG',
    base: '英国格罗夫 (Grove, UK)',
    description: '拥有深厚独立造车底蕴的英国独立元老车队，正在全力实现伟大复兴。'
  },
  {
    id: 'audi',
    name: '奥迪车队',
    nameEn: 'Audi Revolut F1 Team',
    code: 'AUD',
    primaryColor: '#52E252',
    accentColor: '#C0C0C0',
    engine: 'Audi',
    base: '瑞士欣维尔 (Hinwil, Switzerland)',
    description: '德国豪华汽车工业巨头全面接管索伯，开启四环传奇进军 F1 的崭新篇章。'
  },
  {
    id: 'cadillac',
    name: '凯迪拉克车队',
    nameEn: 'Cadillac Formula 1 Team',
    code: 'CAD',
    primaryColor: '#D4AF37',
    accentColor: '#1A1A1A',
    engine: 'Ferrari',
    base: '美国印第安纳波利斯 (Fishers, USA)',
    description: '通用汽车与安德雷蒂联手打造的第十一支全新 F1 正式入场车队。'
  }
];

export const VALID_TEAM_IDS = new Set(F1_TEAMS_2026.map(t => t.id));

// 兼容别名映射 (例如 sauber -> audi, racing_bulls -> rb)
export const TEAM_ID_ALIASES: Record<string, string> = {
  'sauber': 'audi',
  'kick_sauber': 'audi',
  'racing_bulls': 'rb',
  'vcarb': 'rb'
};

export function canonicalTeamId(id: string): string {
  const normalized = id.toLowerCase().trim();
  return TEAM_ID_ALIASES[normalized] || normalized;
}

export function isValidTeamId(id: string): boolean {
  return VALID_TEAM_IDS.has(canonicalTeamId(id));
}

export function getTeamMetadata(id: string): F1TeamMetadata | undefined {
  const cId = canonicalTeamId(id);
  return F1_TEAMS_2026.find(t => t.id === cId);
}
