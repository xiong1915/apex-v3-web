// lib/f1/profiles.ts
// APEX V3 车手生平与车队底蕴专业资料库
// 严格杜绝虚浮营销词汇，基于真实赛事工程与职业生涯事实

export interface DriverBioProfile {
  name: string;
  nameEn: string;
  code: string;
  permanentNumber: string;
  nationality: string;
  team: string;
  teamId: string;
  summary: string;
  racingStyle: string;
  careerHighlights: string[];
  technicalNotes: string;
  tags: string[];
}

export interface TeamBioProfile {
  teamId: string;
  name: string;
  nameEn: string;
  fullZh: string;
  headquarters: string;
  powerUnit: string;
  teamPrincipal: string;
  heritage: string;
  technicalFocus: string;
  championships: string;
  tags: string[];
}

export const DRIVER_PROFILES: Record<string, DriverBioProfile> = {
  'antonelli': {
    name: '基米·安东内利',
    nameEn: 'Kimi Antonelli',
    code: 'ANT',
    permanentNumber: '12',
    nationality: '意大利',
    team: '梅赛德斯车队',
    teamId: 'mercedes',
    summary: '意大利年轻车手，梅赛德斯青训培养的顶尖新星。在卡丁车与低级别方程式锦标赛中展现出统治级速度，迅速跨入顶级大奖赛行列，成为梅赛德斯主力车手阵容的重要组成部分。',
    racingStyle: '入弯动作果断迅捷，拥有敏锐的弯心循迹极限感知力。在高速连续弯道中展现极高控制上限，制动释放平滑，能够充分调动赛车前桥指向性。',
    careerHighlights: [
      '卡丁车世界锦标赛多次夺冠',
      '欧洲区域方程式锦标赛年度总冠军',
      '梅赛德斯青年车手计划重点晋升车手'
    ],
    technicalNotes: '对赛车转向过度的容忍度极高，善于利用车身轻微滑移建立敏捷的入弯角度，对轮胎升温窗口的捕捉敏锐。',
    tags: ['高速弯道操控', '入弯果断', '单圈爆发力', '青年军旗舰']
  },
  'russell': {
    name: '乔治·拉塞尔',
    nameEn: 'George Russell',
    code: 'RUS',
    permanentNumber: '63',
    nationality: '英国',
    team: '梅赛德斯车队',
    teamId: 'mercedes',
    summary: '英国实力派中坚车手，梅赛德斯车队领军人物之一。在初级方程式斩获 GP3 与 F2 双料冠军，经过威廉姆斯车队多年磨砺后正式代表银箭征战，多次斩获分站冠军与杆位。',
    racingStyle: '排位赛单圈极限榨取能力处于围场顶尖水平，赛道防守选线严密，长距离正赛输出稳定，具备极强的战术执行力与正赛节奏管理能力。',
    careerHighlights: [
      '国际汽联二级方程式年度总冠军',
      '巴西圣保罗大奖赛分站冠军与冲刺赛冠军',
      '多次代表梅赛德斯夺得杆位与领奖台'
    ],
    technicalNotes: '制动重刹区脚感细腻，偏好前桥反馈清晰的赛车机械调校，在低速弯与慢速组合弯中能精准锁死弯心路线。',
    tags: ['排位极限榨取', '防守选线严密', '长距离稳定', '战术执行力']
  },
  'hamilton': {
    name: '刘易斯·汉密尔顿',
    nameEn: 'Lewis Hamilton',
    code: 'HAM',
    permanentNumber: '44',
    nationality: '英国',
    team: '法拉利车队',
    teamId: 'ferrari',
    summary: '七届一级方程式世界冠军，大奖赛分站胜场与杆位历史纪录保持者。2025年宣布历史性加盟法拉利车队，携手跃马追逐职业生涯全新篇章与第八座世界冠军荣耀。',
    racingStyle: '技术极其全面的历史级传奇车手。拥有登峰造极的晚刹车操控技巧、举世闻名的雨战控车能力，以及在漫长正赛中游刃有余的轮胎磨损管理技巧。',
    careerHighlights: [
      '7 次一级方程式车手世界冠军',
      '超过 100 场大奖赛分站胜利与杆位纪录',
      '代表不同豪门车队均斩获分站胜利与锦标赛冠军'
    ],
    technicalNotes: '独特的晚进弯深切走线方式，极大缩短入弯滑行时间并提前回正方向盘开油，雨天对非抓地线的感知极其敏锐。',
    tags: ['七届世界冠军', '雨战大师', '晚刹车操控', '轮胎管理大师']
  },
  'leclerc': {
    name: '夏尔·勒克莱尔',
    nameEn: 'Charles Leclerc',
    code: 'LEC',
    permanentNumber: '16',
    nationality: '摩纳哥',
    team: '法拉利车队',
    teamId: 'ferrari',
    summary: '摩纳哥顶尖赛车手，法拉利车队核心支柱。自法拉利青训学院走出，在斯帕、蒙扎以及主场摩纳哥等经典赛道多次书写辉煌胜利，是现代 F1 纯粹速度的代表人物。',
    racingStyle: '以极致的排位赛飞驰圈爆发力著称，擅长在赛道抓地力变化的极限边缘榨取单圈时间。在街道赛道贴墙飞驰拥有独树一帜的掌控力与勇气。',
    careerHighlights: [
      '国际汽联二级方程式年度总冠军',
      '多次夺得摩纳哥与蒙扎大奖赛冠军',
      '法拉利车队多次杆位与分站胜利核心'
    ],
    technicalNotes: '偏好极度敏捷的前轮指向与活跃的尾部动态，通过极高频率的微操修正平衡，在排位飞驰圈中将抓地力发挥至极致。',
    tags: ['排位飞驰专家', '街道赛掌控', '弯心微操', '纯粹速度']
  },
  'norris': {
    name: '兰多·诺里斯',
    nameEn: 'Lando Norris',
    code: 'NOR',
    permanentNumber: '4',
    nationality: '英国',
    team: '迈凯伦车队',
    teamId: 'mclaren',
    summary: '迈凯伦车队当家车手，英国赛车中生代领军人物。从迈凯伦青训一路晋升，陪伴车队经历复兴重返争冠行列，凭借出色表现斩获迈阿密等多个分站冠军并常年领跑争冠榜单。',
    racingStyle: '走线极其平顺流畅，在中高速弯道中保持极高的携带速度。正赛长距离输出稳定，攻防决断清醒，对赛车气动平衡的变化适应能力强。',
    careerHighlights: [
      '迈阿密大奖赛与荷兰大奖赛分站冠军',
      '迈凯伦车队重返世界冠军竞争行列主力车手',
      '多次代表迈凯伦登上最高领奖台与杆位'
    ],
    technicalNotes: '入弯阶段制动渐进线性，避免破坏车身底板下压力气动结构，能将轮胎胎温牢牢控制在最佳工作窗口内。',
    tags: ['中高速弯节奏', '正赛输出平稳', '低破坏性制动', '争冠核心']
  },
  'piastri': {
    name: '奥斯卡·皮亚斯特里',
    nameEn: 'Oscar Piastri',
    code: 'PIA',
    permanentNumber: '81',
    nationality: '澳大利亚',
    team: '迈凯伦车队',
    teamId: 'mclaren',
    summary: '澳大利亚赛车天才，初入顶级大奖赛舞台即连续展现老将般的成熟度。初级单座方程式连续三年夺得雷诺方程式、F3、F2 年度总冠军，进入 F1 后迅速斩获冲刺赛与正赛分站胜利。',
    racingStyle: '以冷峻沉着的心态闻名围场。轮对轮近距离攻防极其严谨，空间判断感精妙，鲜少在激烈缠斗中出现非受迫性失误。',
    careerHighlights: [
      '新秀赛季连夺 F3 与 F2 年度总冠军',
      '阿塞拜疆大奖赛与匈牙利大奖赛分站胜利',
      '卡塔尔冲刺赛夺冠与多次领奖台'
    ],
    technicalNotes: '车内无线电沟通极度克制清晰，转向输入精准无多余晃动，在高速重载弯中具备优异的侧向力支撑感知。',
    tags: ['冷静沉着', '轮对轮空间感', '低失误率', '攻防清醒']
  },
  'verstappen': {
    name: '马克斯·维斯塔潘',
    nameEn: 'Max Verstappen',
    code: 'VER',
    permanentNumber: '1',
    nationality: '荷兰',
    team: '红牛车队',
    teamId: 'red_bull',
    summary: '四届一级方程式车手世界冠军，红牛车队领航核心。以创纪录的统治力打破多项历史胜率与连续夺冠纪录，是现代赛车运动最强统治力与稳定性的代名词。',
    racingStyle: '全天候无短板的顶级赛车手。无论赛车平衡与机械调校如何波动均能榨取极限速度，弯角进攻极具威慑力，雨战驾驶如履平地，长距离圈速波动极小。',
    careerHighlights: [
      '4 次一级方程式车手世界冠军',
      '单赛季 19 胜历史纪录保持者',
      '最年轻的大奖赛分站冠军与红牛绝对基石'
    ],
    technicalNotes: '能驾驭极其敏锐甚至神经质的前轮响应，将赛车推向侧滑边缘依然能通过细腻油门开度稳定车身重心转移。',
    tags: ['四届世界冠军', '全天候统治力', '极限平衡掌控', '进攻威慑']
  },
  'hadjar': {
    name: '伊萨克·哈贾尔',
    nameEn: 'Isack Hadjar',
    code: 'HAD',
    permanentNumber: '6',
    nationality: '法国',
    team: '小红牛车队',
    teamId: 'rb',
    summary: '法国年轻新星，红牛青年车手培养体系核心成员。在 F3 与 F2 赛事中展现出令人瞩目的攻坚能力与追击速度，成功跻身顶级围场正式席位。',
    racingStyle: '驾驶作风充满侵略性与活力，擅长在弯道入弯点发起果断突击，面对前方慢车超车坚决，具备鲜明的进攻型车手烙印。',
    careerHighlights: [
      '国际汽联二级方程式多场正赛胜利与争冠主角',
      '红牛青年车手发展计划重点成员',
      '代表红牛体系晋升顶级大奖赛正式席位'
    ],
    technicalNotes: '善于利用快速重心转移压迫前轮抓地力，刹车点探寻大胆，在干燥与湿滑混合路面具备出色的嗅觉。',
    tags: ['进攻侵略性', '弯角突击', '超车果断', '年轻锐气']
  },
  'lawson': {
    name: '利亚姆·罗森',
    nameEn: 'Liam Lawson',
    code: 'LAW',
    permanentNumber: '30',
    nationality: '新西兰',
    team: '红牛车队',
    teamId: 'red_bull',
    summary: '新西兰实力派车手，历经 DTM、日本超级方程式锦标赛与多次 F1 临危受命替补考验。以强大的即战力与抗压能力赢得围场广泛认可。',
    racingStyle: '适应新赛车与不同赛道条件的速度极快，防守卡位极为强硬顽强，在车阵混乱缠斗中能够准确找到脱身线路并完成抢分。',
    careerHighlights: [
      '日本超级方程式年度亚军与多胜纪录',
      '多次临危替补参赛并斩获世界锦标赛宝贵积分',
      '红牛赛车体系高强度即战力主力'
    ],
    technicalNotes: '对不同抓地力与温度环境的自适应能力强，制动踏板行程掌控线性，能有效减少突发轮胎抱死。',
    tags: ['强硬防守', '快速自适应', '抗压即战力', '混乱突围']
  },
  'gasly': {
    name: '皮埃尔·加斯利',
    nameEn: 'Pierre Gasly',
    code: 'GAS',
    permanentNumber: '10',
    nationality: '法国',
    team: 'Alpine 车队',
    teamId: 'alpine',
    summary: '法国分站冠军车手，Alpine 车队的中流砥柱。在 2020 年蒙扎大奖赛代表小红牛斩获震撼世界的历史性胜利，比赛阅历丰富，在多项重大挑战中展现出坚韧韧劲。',
    racingStyle: '正赛长距离节奏稳定，对赛道事故与安全车窗口的把握极其敏锐，超车动作利落干脆，擅长帮助车队最大化利用中游战略机会。',
    careerHighlights: [
      '2020 年意大利大奖赛（蒙扎）分站冠军',
      'GP2 系列赛年度总冠军',
      '多次代表不同中游车队登上领奖台'
    ],
    technicalNotes: '对于转向过度的宽容度高，在慢速技术弯中善于通过提早开油压制赛车尾部，保持出弯牵引力输出。',
    tags: ['分站冠军', '正赛节奏稳定', '中游抢分核心', '坚韧韧性']
  },
  'lindblad': {
    name: '阿尔维德·林德布拉德',
    nameEn: 'Arvid Lindblad',
    code: 'LIN',
    permanentNumber: '40',
    nationality: '英国',
    team: '小红牛车队',
    teamId: 'rb',
    summary: '英国赛车超级新秀，红牛青年车手体系近年最令人瞩目的跨越级选手。以惊人的学习曲线在单座方程式各个梯队快速突围，早早赢得顶级大奖赛登场机会。',
    racingStyle: '拥有初生牛犊不怕虎的进攻锐气，晚刹车点判断果敢，在排位赛中能够毫无畏缩地逼近赛道边界，展现强悍的单圈爆发力。',
    careerHighlights: [
      '澳门格兰披治大赛关键优异战绩',
      '国际汽联三级方程式锦标赛分站多胜',
      '红牛青训体系近年晋升最快的新星之一'
    ],
    technicalNotes: '转向动作干脆直接，偏好硬朗的避震设定以获得最直接的路感回馈，高速变向灵活性极佳。',
    tags: ['晚刹车果敢', '单圈爆发力', '年轻冲劲', '路感敏锐']
  },
  'colapinto': {
    name: '弗兰科·科拉平托',
    nameEn: 'Franco Colapinto',
    code: 'COL',
    permanentNumber: '43',
    nationality: '阿根廷',
    team: 'Alpine 车队',
    teamId: 'alpine',
    summary: '阿根廷新生代车手，为南美赛车运动重新注入激情。中途替补亮相 F1 舞台即在蒙扎、巴库等高难度赛道展现惊人适应力，迅速赢得正赛积分与正式席位。',
    racingStyle: '入弯速度极快，在高速连续弯道充满信心。超车时敢于在外侧争夺路线，展现出南美车手特有的激情与强硬心态。',
    careerHighlights: [
      '阿根廷时隔多年重返 F1 的正赛得分车手',
      '蒙扎与巴库街道赛首秀连续抢分',
      '西班牙 F4 锦标赛年度总冠军'
    ],
    technicalNotes: '对赛车后桥滑动能够快速实施纠偏，具备出色的油门微调手感，高速下压力释放感知精准。',
    tags: ['高速弯信心', '即战抢分', '外线超车决断', '南美竞速力量']
  },
  'bearman': {
    name: '奥利弗·贝尔曼',
    nameEn: 'Oliver Bearman',
    code: 'BEA',
    permanentNumber: '87',
    nationality: '英国',
    team: '哈斯车队',
    teamId: 'haas',
    summary: '英国新秀才俊，法拉利车手学院成员。在 2024 年沙特大奖赛替补塞恩斯出战正赛一役成名，在难度极高的高速街道赛道稳稳带回积分，随后正式签约哈斯车队。',
    racingStyle: '在复杂的街道赛道中展现出超常的成熟与精准，贴墙飞驰控制严密，正赛长距离不急不躁，具有很高的驾驶容错率。',
    careerHighlights: [
      '沙特吉达超高速街道赛首秀即斩获积分',
      '意大利与德国 F4 双料年度总冠军',
      '法拉利车手学院重点培养正赛车手'
    ],
    technicalNotes: '转向输入细腻平顺，对轮胎衰减周期的热量分布敏感，能在长距离巡航中保护前轮胎肩抓地力。',
    tags: ['街道赛精准度', '沉稳成熟', '轮胎寿命管理', '高容错率']
  },
  'bortoleto': {
    name: '加布里埃尔·博托莱托',
    nameEn: 'Gabriel Bortoleto',
    code: 'BOR',
    permanentNumber: '5',
    nationality: '巴西',
    team: '奥迪车队',
    teamId: 'audi',
    summary: '巴西顶尖赛车新秀，费尔南多·阿隆索旗下 A14 管理公司门徒。以新秀身份连夺 F3 与 F2 年度世界锦标赛总冠军，成为奥迪索伯进军 F1 项目的基石青年车手。',
    racingStyle: '兼具速度与智慧的现代型车手。比赛阅读能力极强，极少发生冲动型事故，善于在长距离正赛后半段通过精准保胎完成战术超越。',
    careerHighlights: [
      '新秀赛季连续斩获国际汽联 F3 与 F2 年度双料总冠军',
      '奥迪厂队项目签约主力车手',
      '巴西赛车重返 F1 正赛核心旗帜'
    ],
    technicalNotes: '路线选择极具空间创造力，善于利用交叉线出弯建立牵引力优势，制动热衰减管理成熟。',
    tags: ['双料新秀总冠军', '大局观成熟', '交叉线反击', '奥迪厂队基石']
  },
  'hulkenberg': {
    name: '尼科·霍肯伯格',
    nameEn: 'Nico Hülkenberg',
    code: 'HUL',
    permanentNumber: '27',
    nationality: '德国',
    team: '奥迪车队',
    teamId: 'audi',
    summary: '德国经验丰富的老牌车手，勒芒24小时耐力赛全场总冠军。以老辣精准的排位赛单圈速度和卓越的赛车工程技术反馈著称，被奥迪厂队委以赛车研发与正赛领军重任。',
    racingStyle: '排位赛单圈榨取大师，经常能在单圈中驾驶中下游赛车跑出超越理论极限的惊艳成绩。防守经验极其丰富，选位老练。',
    careerHighlights: [
      '勒芒24小时耐力赛最高组别全场总冠军',
      '多次在中游车队斩获排位赛杆位与前列起步',
      '奥迪 F1 厂队工程研发领航车手'
    ],
    technicalNotes: '对赛车悬挂设定与气动平衡的反馈极其精准，是工程师高度依赖的技术型车手，重刹进弯稳定性首屈一指。',
    tags: ['勒芒冠军', '排位单圈大师', '工程反馈老练', '防守经验丰富']
  },
  'ocon': {
    name: '埃斯特班·奥康',
    nameEn: 'Esteban Ocon',
    code: 'OCO',
    permanentNumber: '31',
    nationality: '法国',
    team: '哈斯车队',
    teamId: 'haas',
    summary: '法国分站冠军车手，在 2021 年匈牙利大奖赛顶住巨大压力斩获职业生涯首胜。征战围场多年，先后效力印度力量、雷诺/Alpine，现加盟哈斯车队开启新征程。',
    racingStyle: '防守坚韧如钢，在近距离轮对轮缠斗中极其强硬。面对复杂雨地与突发战况具有很强的临场执行力，不放弃任何一个进分机会。',
    careerHighlights: [
      '2021 年匈牙利大奖赛分站冠军',
      'GP3 系列赛年度总冠军',
      '多次代表中游车队登上大奖赛领奖台'
    ],
    technicalNotes: '刹车风格直截了当，善于利用晚进弯防守守住内线，对赛车中速弯横向机械抓地力利用充分。',
    tags: ['分站冠军', '防守强硬', '轮对轮缠斗', '雨地战术执行']
  },
  'alonso': {
    name: '费尔南多·阿隆索',
    nameEn: 'Fernando Alonso',
    code: 'ALO',
    permanentNumber: '14',
    nationality: '西班牙',
    team: '阿斯顿·马丁车队',
    teamId: 'aston_martin',
    summary: '两届一级方程式车手世界冠军，两届勒芒24小时耐力赛冠军，世界耐力锦标赛总冠军。现代赛车活化石，职业生涯跨越超过二十年，依然保持着无与伦比的竞技状态与争胜斗志。',
    racingStyle: '赛道阅读大师。发车起跑与一号弯路线选择冠绝围场，能够在整场比赛中时刻推演全局对手的战术与轮胎寿命，超车时机把握出神入化。',
    careerHighlights: [
      '2 次一级方程式车手世界冠军',
      '超过 400 场大奖赛出赛历史纪录',
      '2 次勒芒 24 小时全场冠军与 WEC 世界冠军'
    ],
    technicalNotes: '拥有独特的入弯微拉扯动作强制建立前轮抓地力，即使在赛车平衡失调时也能调动全部性能。',
    tags: ['双料世界冠军', '发车大师', '赛局推演', '传奇常青树']
  },
  'sainz': {
    name: '卡洛斯·塞恩斯',
    nameEn: 'Carlos Sainz',
    code: 'SAI',
    permanentNumber: '55',
    nationality: '西班牙',
    team: '威廉姆斯车队',
    teamId: 'williams',
    summary: '西班牙分站冠军名将，以冷静清醒的战术头脑被称为“赛道战略家”。曾在银石、新加坡、墨尔本等地多次为法拉利夺得分站胜利，加盟威廉姆斯车队承担复兴重任。',
    racingStyle: '大局观与战术洞察力极强，在驾驶舱内能一边以极限速度巡航一边分析无线电策略。驾驶风格稳扎稳打，长距离正赛轮胎磨损极度均匀。',
    careerHighlights: [
      '新加坡、银石、澳大利亚等多个大奖赛分站冠军',
      '多次打破对手连胜纪录的关键冠军得主',
      '威廉姆斯车队长期复兴计划核心车手'
    ],
    technicalNotes: '对赛车转向不足与前悬挂阻尼调校有深刻理解，入弯路线严谨，正赛节奏极少受到意外干扰。',
    tags: ['赛道战略家', '分站冠军', '长距离节奏均匀', '工程思维']
  },
  'albon': {
    name: '亚历山大·阿尔本',
    nameEn: 'Alexander Albon',
    code: 'ALB',
    permanentNumber: '23',
    nationality: '泰国',
    team: '威廉姆斯车队',
    teamId: 'williams',
    summary: '泰国车手，威廉姆斯车队中流砥柱。经历红牛时期的沉淀后在威廉姆斯浴火重生，多次凭借一己之力驾驶赛车杀入排位前十并屡屡带回宝贵积分。',
    racingStyle: '防守坚韧顽强，极擅长驾驶直道低阻赛车构筑防线。对赛车极限边缘的掌控自如，在轮胎磨损严重阶段仍能保持坚挺圈速。',
    careerHighlights: [
      '多次代表红牛与威廉姆斯登上大奖赛领奖台',
      '威廉姆斯车队多年得分支柱与复兴基石',
      '中游混战突围抢分专家'
    ],
    technicalNotes: '能够在低抓地力下保持良好的车头指向，出弯油门细腻，善于利用直线尾速优势抵御追击。',
    tags: ['坚韧防线', '中游抢分支柱', '低抓地力掌控', '复兴核心']
  },
  'tsunoda': {
    name: '角田裕毅',
    nameEn: 'Yuki Tsunoda',
    code: 'TSU',
    permanentNumber: '22',
    nationality: '日本',
    team: '小红牛车队',
    teamId: 'rb',
    summary: '日本速度名将，红牛与本田青训联合培养的顶尖车手。经过多年 F1 赛场的严酷磨砺，已从初出茅庐的火爆新秀蜕变成为经验丰富、发挥稳定的核心得分点。',
    racingStyle: '重制动区控车能力突出，弯心通过速度极快。在技术型中低速弯道中具备很高的敏捷度，超车动作迅猛果断。',
    careerHighlights: [
      '首秀即斩获 F1 正赛积分',
      '红牛小红牛车队主力得分担当',
      '多次在技术型赛道跑出惊艳排位圈速'
    ],
    technicalNotes: '入弯重刹减速效率极高，善于利用短促的制动距离占据内线，对赛车侧向载荷转移感知灵敏。',
    tags: ['重刹减速效率', '弯心通过速度', '技术型赛道专家', '稳定得分手']
  },
  'stroll': {
    name: '兰斯·斯托尔',
    nameEn: 'Lance Stroll',
    code: 'STR',
    permanentNumber: '18',
    nationality: '加拿大',
    team: '阿斯顿·马丁车队',
    teamId: 'aston_martin',
    summary: '加拿大实力派车手，阿斯顿·马丁车队常驻主力。在初入 F1 阶段便在巴库登上领奖台并斩获土耳其站湿地杆位，在多变气象条件下屡有亮眼发挥。',
    racingStyle: '起步发车反应与第一圈位置争夺极具侵略性，在雨地与低抓地力潮湿路面上表现尤为突出，直道缠斗中防守果断。',
    careerHighlights: [
      '土耳其大奖赛湿地排位赛杆位',
      '巴库与蒙扎多次大奖赛领奖台',
      '欧洲三级方程式锦标赛年度总冠军'
    ],
    technicalNotes: '在低附着力路面下依靠迅速的油门开度感知抓地极限，湿滑发车抢位效率处于围场前列。',
    tags: ['湿地抢跑专家', '首圈位置争夺', '雨地杆位得主', '直道防守']
  },
  'bottas': {
    name: '瓦尔特利·博塔斯',
    nameEn: 'Valtteri Bottas',
    code: 'BOT',
    permanentNumber: '77',
    nationality: '芬兰',
    team: '凯迪拉克车队',
    teamId: 'cadillac',
    summary: '芬兰十冠名将，曾作为梅赛德斯车队主力连续五年斩获车队世界冠军。以极其精准纯粹的排位单圈速度和老练的研发调校经验备受围场尊崇。',
    racingStyle: '排位单圈如精密钟表般严谨无误，刹车点与弯心触碰分毫不差。比赛节奏稳定，极少给对手可乘之机。',
    careerHighlights: [
      '10 次一级方程式分站冠军与 20 次排位赛杆位',
      '帮助梅赛德斯实现五连冠霸业功勋车手',
      '两次获得车手年度锦标赛亚军'
    ],
    technicalNotes: '平滑的转向输入使赛车在高速弯道中拥有出色的姿态维持能力，调校反馈客观准确。',
    tags: ['十次分站冠军', '排位精准钟表', '调校工程经验', '冷静冰人']
  },
  'perez': {
    name: '塞尔吉奥·佩雷兹',
    nameEn: 'Sergio Pérez',
    code: 'PER',
    permanentNumber: '11',
    nationality: '墨西哥',
    team: '凯迪拉克车队',
    teamId: 'cadillac',
    summary: '墨西哥传奇名将，以保胎与街道赛实力享誉围场。在萨基尔、摩纳哥、巴库、新加坡等多条高难度赛道斩获分站胜利，为红牛车队夺得车队总冠军立下汗马功劳。',
    racingStyle: '出弯牵引力控制出神入化，长距离正赛保胎能力极其强悍，在狭窄的街道赛道贴墙飞行时兼具速度与坚韧。',
    careerHighlights: [
      '6 次一级方程式大奖赛分站冠军',
      '阿塞拜疆巴库大奖赛双冠王与街道赛专家',
      '帮助红牛车队问鼎年度车队世界冠军'
    ],
    technicalNotes: '独特的柔顺油门开度控制极大减少后轮空转滑移，正赛一停策略的经典执行者。',
    tags: ['街道赛实力', '轮胎管理专家', '出弯牵引力', '六冠名将']
  },
  'zhou': {
    name: '周冠宇',
    nameEn: 'Guanyu Zhou',
    code: 'ZHO',
    permanentNumber: '24',
    nationality: '中国',
    team: '法拉利车队',
    teamId: 'ferrari',
    summary: '中国赛车历史第一人，首位征战一级方程式正赛并斩获积分的中国车手。在 F1 首秀巴林站即斩获积分，以出色的轮胎管理、干净的攻防风格与稳定的职业素养书写中国赛车新篇章。',
    racingStyle: '正赛长距离发挥极其沉稳，攻防遵循干净赛车准则，失误率低。在轮胎寿命进入衰退期时仍能维持平顺稳定的圈速节奏。',
    careerHighlights: [
      '中国首位一级方程式正式车手与正赛得分车手',
      'F1 首秀即在巴林大奖赛抢下积分',
      '亚洲 F3 锦标赛年度总冠军与 F2 多场正赛冠军'
    ],
    technicalNotes: '转向风格平滑细腻，有效保护轮胎胎壁免受多余侧向剪切力，对赛车电子系统与能量回收配比理解透彻。',
    tags: ['中国历史第一人', '沉稳长距离', '低失误率', '干净攻防']
  },
  'doohan': {
    name: '杰克·杜汉',
    nameEn: 'Jack Doohan',
    code: 'DOO',
    permanentNumber: '7',
    nationality: '澳大利亚',
    team: 'Alpine 车队',
    teamId: 'alpine',
    summary: '澳大利亚新锐车手，两轮名宿米克·杜汉之子。在初级方程式中凭借多场极具统治力的排位赛杆位与正赛胜利崭露头角，晋升 Alpine 车队正式出战。',
    racingStyle: '排位单圈爆发力强，高速弯中敢打敢拼，进攻意识强烈，展现出澳大利亚车手特有的坚决与韧性。',
    careerHighlights: [
      '国际汽联二级方程式锦标赛年度季军与多座分站冠军',
      '国际汽联三级方程式年度亚军',
      'Alpine 青年学院领航晋升车手'
    ],
    technicalNotes: '偏好硬朗前桥设定以获得敏锐指向，善于在干地飞驰圈中快速将轮胎提升至峰值抓地温度。',
    tags: ['单圈爆发力', '高速弯冲劲', '积极进攻', '澳洲速度']
  },
  'ricciardo': {
    name: '丹尼尔·里卡多',
    nameEn: 'Daniel Ricciardo',
    code: 'RIC',
    permanentNumber: '3',
    nationality: '澳大利亚',
    team: '小红牛车队',
    teamId: 'rb',
    summary: '八届一级方程式分站冠军，摩纳哥与蒙扎荣耀征服者。以标志性的晚制动超车技巧与感染力极强的笑容闻名赛车界。',
    racingStyle: '围场历史上极具代表性的晚制动超车大师。在重刹入弯阶段拥有出色的赛车控制力，敢于在狭小空间的弯道内线发起突袭。',
    careerHighlights: [
      '8 次一级方程式大奖赛分站冠军',
      '摩纳哥大奖赛与意大利蒙扎大奖赛冠军',
      '多次位列车手年度锦标赛季军'
    ],
    technicalNotes: '刹车压力瞬间释放与弯心循迹配合炉火纯青，偏好稳定性极强的刹车线控系统设定。',
    tags: ['晚刹车大师', '八座分站冠军', '重刹区掌控', '摩纳哥征服者']
  },
  'magnussen': {
    name: '凯文·马格努森',
    nameEn: 'Kevin Magnussen',
    code: 'MAG',
    permanentNumber: '20',
    nationality: '丹麦',
    team: '哈斯车队',
    teamId: 'haas',
    summary: '丹麦硬汉车手，F1 首秀即登上领奖台的硬派代表。长期担任哈斯车队领航车手，并在巴西圣保罗大奖赛排位赛中为哈斯斩获震撼历史的传奇杆位。',
    racingStyle: '轮对轮防守坚如磐石，作风强硬凶悍，从不给对手轻易留出超车余地。雨天和混乱起跑反应极度敏锐。',
    careerHighlights: [
      'F1 生涯首秀澳大利亚站即登上领奖台',
      '2022 年巴西大奖赛为哈斯夺得历史首个杆位',
      '雷诺方程式3.5系列赛年度总冠军'
    ],
    technicalNotes: '入弯防守卡位极其精准，善于利用车身宽度阻挡对手跟车下压力气流，起步油门衔接迅速。',
    tags: ['强硬防守', '首秀登台', '历史性杆位', '硬汉本色']
  },
  'sargeant': {
    name: '罗根·萨金特',
    nameEn: 'Logan Sargeant',
    code: 'SAR',
    permanentNumber: '2',
    nationality: '美国',
    team: '威廉姆斯车队',
    teamId: 'williams',
    summary: '美国年轻赛车手，威廉姆斯车手学院成员。在奥斯汀美国大奖赛上为主场车迷斩获宝贵世锦赛积分，成为现代 F1 少数获得正赛积分的美国车手。',
    racingStyle: '中高速弯道具备扎实的基本功底，高速直道尾速利用充分，在顺境中能够展现出优异的节奏控制。',
    careerHighlights: [
      '美国大奖赛主场斩获世界锦标赛积分',
      '国际汽联二级方程式锦标赛年度最佳新秀',
      '国际汽联三级方程式争冠主力'
    ],
    technicalNotes: '转向动作稳健，在高速下压力重载赛道中循迹稳定性良好，直道出弯牵引力控制扎实。',
    tags: ['主场抢分', '中高速弯底子', '直道尾速利用', '新秀历练']
  }
};

// 兼容别名映射
const DRIVER_ALIASES: Record<string, string> = {
  'max_verstappen': 'verstappen',
  'arvid_lindblad': 'lindblad'
};

export const TEAM_PROFILES: Record<string, TeamBioProfile> = {
  'ferrari': {
    teamId: 'ferrari',
    name: '法拉利车队',
    nameEn: 'Scuderia Ferrari',
    fullZh: '法拉利车队 (Scuderia Ferrari)',
    headquarters: '意大利马拉内罗 (Maranello, Italy)',
    powerUnit: 'Ferrari 066 系列混动动力单元',
    teamPrincipal: '弗雷德里克·瓦塞尔 (Frédéric Vasseur)',
    heritage: '一级方程式历史上最古老、最辉煌的传奇车队。自 1950 年世界锦标赛初创起全勤参赛至今，象征着纯粹的赛车精神与跃马红色图腾。',
    technicalFocus: '追求内燃机与能量回收系统在全转速区间的无缝协同输出，底盘悬挂调校兼顾机械抓地力与弯心支撑，注重高速直道减阻与下压力的高效平衡。',
    championships: '16 次车队世界冠军 · 15 次车手世界冠军',
    tags: ['全勤传奇豪门', '16座车队世界冠军', '自研动力单元', '马拉内罗红色图腾']
  },
  'mclaren': {
    teamId: 'mclaren',
    name: '迈凯伦车队',
    nameEn: 'McLaren Formula 1 Team',
    fullZh: '迈凯伦车队 (McLaren)',
    headquarters: '英国沃金 (Woking, UK)',
    powerUnit: 'Mercedes-AMG',
    teamPrincipal: '安德雷亚·斯泰拉 (Andrea Stella)',
    heritage: '由传奇车手布鲁斯·迈凯伦于 1963 年创立，以标志性的木瓜橙涂装与先锋技术创新享誉全球，是围场最具声望的常胜之师之一。',
    technicalFocus: '现代地面效应气动设计的代表车队，专注于文丘里底板下压力产生效率与宽工作窗口调校，赛车在全工况弯道中具备卓越的抓地宽容度。',
    championships: '8 次车队世界冠军 · 12 次车手世界冠军',
    tags: ['木瓜橙先锋', '顶尖气动效率', '宽工作窗口', '沃金技术中心']
  },
  'mercedes': {
    teamId: 'mercedes',
    name: '梅赛德斯车队',
    nameEn: 'Mercedes-AMG PETRONAS F1 Team',
    fullZh: '梅赛德斯车队 (Mercedes-AMG)',
    headquarters: '英国布拉克利 (Brackley, UK)',
    powerUnit: 'Mercedes-AMG High Performance Powertrains',
    teamPrincipal: '托托·沃尔夫 (Toto Wolff)',
    heritage: '现代混合动力时代创下史无前例车队八连冠伟业的银箭王朝，代表着德国工业制造水准与尖端赛车工程哲学的深度融合。',
    technicalFocus: '动力单元热效率与电池充放电释放控制处于行业领先，底盘工程注重抗扭刚度与悬挂几何调校，致力于消解地面效应海豚跳并释放纯粹机械抓地力。',
    championships: '8 次车队世界冠军 · 9 次车手世界冠军',
    tags: ['银箭八冠王朝', '自研动力单元', '布拉克利工程基地', '高热效率先驱']
  },
  'red_bull': {
    teamId: 'red_bull',
    name: '红牛车队',
    nameEn: 'Oracle Red Bull Racing',
    fullZh: '红牛车队 (Red Bull Racing)',
    headquarters: '英国米尔顿凯恩斯 (Milton Keynes, UK)',
    powerUnit: 'Red Bull Ford Powertrains',
    teamPrincipal: '克里斯蒂安·霍纳 (Christian Horner)',
    heritage: '2005 年进军 F1 以来迅速打破传统汽车制造商垄断，以先锋姿态斩获多座双料世界冠军，是现代赛车空气动力学的重要引领者。',
    technicalFocus: '精妙复杂的底板文丘里通道与侧箱下切设计，下压力套件与悬挂抗俯仰几何深度匹配，配合极具攻击性的正赛战术决策。',
    championships: '6 次车队世界冠军 · 7 次车手世界冠军',
    tags: ['多届双料冠军', '空力设计标杆', '两秒进站技术', '米尔顿凯恩斯']
  },
  'aston_martin': {
    teamId: 'aston_martin',
    name: '阿斯顿·马丁车队',
    nameEn: 'Aston Martin Aramco F1 Team',
    fullZh: '阿斯顿·马丁车队 (Aston Martin)',
    headquarters: '英国银石 (Silverstone, UK)',
    powerUnit: 'Honda',
    teamPrincipal: '迈克·克拉克 (Mike Krack)',
    heritage: '英国超豪华跑车传奇品牌，身披标志性英国赛车绿涂装。在银石主场投资兴建包含全新风洞的顶尖技术园区，全力打造争冠阵容。',
    technicalFocus: '与本田携手建立专属厂队级动力单元深度整合，强化高速转向指向灵敏度与侧箱紧凑布局，追求高效下压力巡航表现。',
    championships: '大奖赛多次分站领奖台 · 争冠阵容布局',
    tags: ['英国赛车绿', '银石技术园区', '本田专属动力', '雄心争冠']
  },
  'alpine': {
    teamId: 'alpine',
    name: 'Alpine 车队',
    nameEn: 'BWT Alpine F1 Team',
    fullZh: 'Alpine 车队 (BWT Alpine F1 Team)',
    headquarters: '英国恩斯通 (Enstone, UK) & 法国维里',
    powerUnit: 'Mercedes-AMG',
    teamPrincipal: '奥利弗·奥克斯 (Oliver Oakes)',
    heritage: '承载雷诺体育历史与法兰西跑车竞速底蕴，其恩斯通基地曾诞生贝纳通与雷诺世界冠军战车，在蓝色与粉色涂装下持续奋战。',
    technicalFocus: '底盘轻量化与机械抓地力研发，优化中速弯道平衡，动力系统过渡整合后全面专注于底盘空力与机械系统的协同提升。',
    championships: '2 次车队世界冠军（前身雷诺） · 多个大奖赛分站胜利',
    tags: ['恩斯通冠军基因', '法兰西竞速火种', '轻量化底盘', '中游突围']
  },
  'haas': {
    teamId: 'haas',
    name: '哈斯车队',
    nameEn: 'MoneyGram Haas F1 Team',
    fullZh: '哈斯车队 (Haas F1)',
    headquarters: '美国坎纳波利斯 (USA) & 英国班伯里',
    powerUnit: 'Ferrari',
    teamPrincipal: '小松礼雄 (Ayao Komatsu)',
    heritage: '由吉恩·哈斯创立的美国独资车队，自 2016 年进入 F1 以来凭借精干小巧的工程组织和出色的资源使用效率在中游顽强立足。',
    technicalFocus: '与法拉利技术深度协同，聚焦于排位单圈轮胎快速升温与低速刹车稳定性，推崇务实高效的工程迭代节奏。',
    championships: '大奖赛杆位得主 · 车队年度排名前列常客',
    tags: ['美国赛车血统', '精干敏捷组织', '法拉利技术协同', '排位爆发力']
  },
  'rb': {
    teamId: 'rb',
    name: '小红牛车队',
    nameEn: 'Visa Cash App RB F1 Team',
    fullZh: '小红牛车队 (Racing Bulls)',
    headquarters: '意大利法恩扎 (Faenza, Italy) & 英国比斯特',
    powerUnit: 'Red Bull Ford Powertrains',
    teamPrincipal: '劳伦特·梅基斯 (Laurent Mekies)',
    heritage: '继承米纳尔迪车队意式赛车血统，作为红牛青年车手人才摇篮，为围场培育出维特尔、维斯塔潘、里卡多等多位世界冠军和分站胜者。',
    technicalFocus: '依托法恩扎与比斯特双研发中心，强化机械悬挂的灵活性与响应性，针对中慢速技术弯道具备极强的攻坚潜能。',
    championships: '2 次大奖赛分站胜利（蒙扎双冠传奇）',
    tags: ['冠军车手摇篮', '意式竞速激情', '法恩扎基地', '敏捷悬挂调校']
  },
  'williams': {
    teamId: 'williams',
    name: '威廉姆斯车队',
    nameEn: 'Williams Racing',
    fullZh: '威廉姆斯车队 (Williams)',
    headquarters: '英国格罗夫 (Grove, UK)',
    powerUnit: 'Mercedes-AMG',
    teamPrincipal: '詹姆斯·沃夫尔斯 (James Vowles)',
    heritage: '由弗兰克·威廉姆斯爵士创立的英国独立赛车图腾。斩获 9 座车队世界冠军与 114 场分站胜利，如今在全新资本注入下全力推进现代化复兴。',
    technicalFocus: '以卓越的高速直道低风阻设计闻名，当前正全面升级底盘制造与系统仿真设施，力求在全类型赛道实现均衡竞争力。',
    championships: '9 次车队世界冠军 · 7 次车手世界冠军',
    tags: ['九冠独立豪门', '格罗夫基地', '直道低风阻', '伟大复兴计划']
  },
  'audi': {
    teamId: 'audi',
    name: '奥迪车队',
    nameEn: 'Audi Revolut F1 Team',
    fullZh: '奥迪车队 (Audi Revolut F1 Team)',
    headquarters: '瑞士欣维尔 (Hinwil) & 德国诺伊堡',
    powerUnit: 'Audi',
    teamPrincipal: '马蒂亚·比诺托 (Mattia Binotto)',
    heritage: '德国豪华汽车巨头奥迪全面接管索伯车队，以百分之百厂队规格正式挺进 F1。携勒芒与拉力多重霸主荣耀，开启四环传奇的顶级方程式篇章。',
    technicalFocus: '德国诺伊堡动力总成研发中心与瑞士欣维尔顶尖风洞实现端到端一体化协同开发，严谨的德系工程学与前瞻电驱动力结合。',
    championships: '勒芒 13 冠工程传承 · F1 全厂队规格',
    tags: ['奥迪全厂队', '自研动力总成', '四环竞速传奇', '欣维尔顶级风洞']
  },
  'sauber': {
    teamId: 'sauber',
    name: '索伯车队',
    nameEn: 'Kick Sauber',
    fullZh: '索伯车队 (Kick Sauber)',
    headquarters: '瑞士欣维尔 (Hinwil, Switzerland)',
    powerUnit: 'Ferrari',
    teamPrincipal: '马蒂亚·比诺托 (Mattia Binotto)',
    heritage: '彼得·索伯于 1970 年创立的瑞士独立赛车机构，三十余年坚守一级方程式赛场，以扎实的空气动力学风洞设施与中游韧劲立足。',
    technicalFocus: '欣维尔全尺寸风洞与碳纤维底盘制造工艺处于欧洲顶尖行列，专注于赛车气动与轻量化底盘的持续调校优化。',
    championships: '大奖赛分站胜利与多次领奖台纪录',
    tags: ['瑞士独立名门', '欣维尔风洞', '坚守三十载', '底盘精工制造']
  },
  'cadillac': {
    teamId: 'cadillac',
    name: '凯迪拉克车队',
    nameEn: 'Cadillac Formula 1 Team',
    fullZh: '凯迪拉克车队 (Cadillac Formula 1 Team)',
    headquarters: '美国印第安纳波利斯 (USA) & 英国银石',
    powerUnit: 'Ferrari',
    teamPrincipal: '丹·鲍斯 (Dan Binks)',
    heritage: '通用汽车携手安德雷蒂全球赛车打造的第十一支 F1 全新正式车队，代表着美国汽车工业百年底蕴对世界顶级赛车运动的重磅进驻。',
    technicalFocus: '依托跨大西洋双研发基地，将北美顶级耐力赛与印地赛车工程积累与现代 F1 计算流体力学技术相融汇，搭建稳健的技术架构。',
    championships: '美系赛车工业全新力量 · 2026 崭新征程',
    tags: ['第11支新车队', '美系百年品牌', '通用汽车工程', '跨大西洋协同']
  }
};

const TEAM_ALIASES: Record<string, string> = {
  'kick_sauber': 'sauber',
  'racing_bulls': 'rb',
  'vcarb': 'rb'
};

/**
 * 安全检索车手生平与竞技特点
 * 内置全量现役车手档案与针对未知车手的安全动态兜底
 */
export function getDriverBiography(driver: {
  driverId?: string;
  code?: string;
  name?: string;
  nameEn?: string;
  number?: string;
  team?: string;
  teamId?: string;
}): DriverBioProfile {
  const rawId = (driver.driverId || '').toLowerCase().trim();
  const canonicalId = DRIVER_ALIASES[rawId] || rawId;

  // 1. 根据 driverId 查找
  if (canonicalId && DRIVER_PROFILES[canonicalId]) {
    return DRIVER_PROFILES[canonicalId];
  }

  // 2. 根据 code 查找
  const code = (driver.code || '').toUpperCase().trim();
  for (const p of Object.values(DRIVER_PROFILES)) {
    if (p.code === code) return p;
  }

  // 3. 根据英文名模糊查找
  const nameEn = (driver.nameEn || '').toLowerCase();
  if (nameEn) {
    for (const p of Object.values(DRIVER_PROFILES)) {
      if (nameEn.includes(p.nameEn.toLowerCase()) || p.nameEn.toLowerCase().includes(nameEn)) {
        return p;
      }
    }
  }

  // 4. 安全保底
  const fallbackName = driver.name || 'F1 赛车手';
  const fallbackTeam = driver.team || '一级方程式车队';
  const fallbackNum = driver.number || '—';

  return {
    name: fallbackName,
    nameEn: driver.nameEn || (code ? `Driver ${code}` : 'Formula 1 Driver'),
    code: code || 'DRV',
    permanentNumber: fallbackNum,
    nationality: '国际汽联注册车手',
    team: fallbackTeam,
    teamId: driver.teamId || '',
    summary: `${fallbackName}是一级方程式锦标赛正式注册车手，代表 ${fallbackTeam} 征战世界顶级大奖赛，在各条赛道上持续展现职业竞速水准与竞技风采。`,
    racingStyle: '注重弯中走线保持与抓地力调控，能够在多变赛况下稳健推进正赛圈速，在攻防转换中保持高度专注与纪律性。',
    careerHighlights: [
      '征战国际汽联一级方程式世界锦标赛',
      `代表 ${fallbackTeam} 参加正式大奖赛`
    ],
    technicalNotes: '根据赛车特性与赛道抓地力变化灵活微调驾驶线路，与工程团队紧密协同优化长距离正赛设定。',
    tags: ['职业素养', '正赛专注', '线路把控', '赛车工程协同']
  };
}

/**
 * 安全检索车队底蕴与工程理念
 * 内置全量 2026 赛季车队档案与针对历史/外卡车队的安全动态兜底
 */
export function getTeamBiography(team: {
  teamId?: string;
  name?: string;
  nameEn?: string;
}): TeamBioProfile {
  const rawId = (team.teamId || '').toLowerCase().trim();
  const canonicalId = TEAM_ALIASES[rawId] || rawId;

  // 1. 根据 teamId 查找
  if (canonicalId && TEAM_PROFILES[canonicalId]) {
    return TEAM_PROFILES[canonicalId];
  }

  // 2. 根据 nameEn 模糊查找
  const nameEn = (team.nameEn || '').toLowerCase();
  if (nameEn) {
    for (const p of Object.values(TEAM_PROFILES)) {
      if (nameEn.includes(p.teamId) || p.nameEn.toLowerCase().includes(nameEn)) {
        return p;
      }
    }
  }

  // 3. 安全保底
  const fallbackName = team.name ? team.name.replace(/\s*[（(][^）)]*[）)]\s*$/, '') : 'F1 车队';

  return {
    teamId: canonicalId || 'unknown_team',
    name: fallbackName,
    nameEn: team.nameEn || 'Formula 1 Team',
    fullZh: team.name || fallbackName,
    headquarters: '国际赛车工程基地',
    powerUnit: '一级方程式混合动力单元',
    teamPrincipal: '车队管理团队',
    heritage: `${fallbackName} 是征战一级方程式世界锦标赛的正式参赛车队，汇聚顶尖赛车工程专家与车手，在赛道上不断追求工程与竞技极限。`,
    technicalFocus: '专注于空气动力学套件效率、底盘机械抓地力以及动力单元能量回收系统的综合性能调优。',
    championships: '征战一级方程式世界锦标赛',
    tags: ['技术研发', '赛事竞技', '工程协同', '极速挑战']
  };
}
