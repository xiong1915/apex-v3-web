// lib/admin/user-persona.ts
// APEX Control 终端用户画像与硬件规格信号解析引擎

export interface DeviceSignals {
  screen?: string;           // e.g. "1920x1080"
  viewport?: string;         // e.g. "1440x820"
  dpr?: number;              // e.g. 1.25, 2
  cores?: number;            // e.g. 8, 16
  memory?: number;           // e.g. 8 (GB)
  touch?: boolean;           // e.g. true / false
  language?: string;         // e.g. "zh-CN"
  colorScheme?: 'dark' | 'light';
  country?: string;          // e.g. "CN" (from CF-IPCountry)
}

export interface UserPersona {
  os: {
    name: string;
    version?: string;
    architecture?: string;
    icon: string;
  };
  browser: {
    name: string;
    version?: string;
    engine?: string;
    icon: string;
  };
  device: {
    type: 'desktop' | 'mobile' | 'tablet';
    typeLabel: string;
    model?: string;
  };
  hardware: {
    cores?: number;
    memoryGb?: number;
    touch: boolean;
    touchLabel: string;
  };
  display: {
    screenResolution?: string;
    viewport?: string;
    pixelRatio?: number;
    colorScheme?: 'dark' | 'light';
  };
  environment: {
    language?: string;
    ip?: string;
    country?: string;
  };
  rawUserAgent?: string;
}

export function parseUserPersona(
  userAgent?: string,
  signals?: DeviceSignals,
  ip?: string
): UserPersona {
  const ua = userAgent || '';

  // 1. 操作系统 (OS) 解析
  let osName = '未知系统';
  let osVersion: string | undefined = undefined;
  let osArch: string | undefined = undefined;
  let osIcon = '💻';

  if (/Windows NT 10\.0/i.test(ua)) {
    osName = 'Windows 10 / 11';
    osIcon = '🪟';
  } else if (/Windows NT 6\.3/i.test(ua)) {
    osName = 'Windows 8.1';
    osIcon = '🪟';
  } else if (/Windows NT 6\.1/i.test(ua)) {
    osName = 'Windows 7';
    osIcon = '🪟';
  } else if (/Windows NT/i.test(ua)) {
    osName = 'Windows';
    osIcon = '🪟';
  } else if (/iPhone/i.test(ua)) {
    osName = 'iOS (iPhone)';
    osIcon = '🍎';
    const match = ua.match(/OS (\d+[_.]\d+([_.]\d+)?)/i);
    if (match) osVersion = match[1].replace(/_/g, '.');
  } else if (/iPad/i.test(ua)) {
    osName = 'iPadOS';
    osIcon = '🍎';
    const match = ua.match(/OS (\d+[_.]\d+([_.]\d+)?)/i);
    if (match) osVersion = match[1].replace(/_/g, '.');
  } else if (/Macintosh|Mac OS X/i.test(ua)) {
    osName = 'macOS';
    osIcon = '🍎';
    const match = ua.match(/Mac OS X (\d+[_.]\d+([_.]\d+)?)/i);
    if (match) osVersion = match[1].replace(/_/g, '.');
  } else if (/Android/i.test(ua)) {
    osName = 'Android';
    osIcon = '🤖';
    const match = ua.match(/Android (\d+(\.\d+)?)/i);
    if (match) osVersion = match[1];
  } else if (/Linux/i.test(ua)) {
    osName = 'Linux';
    osIcon = '🐧';
  }

  // 架构识别
  if (/Win64|x64|x86_64|amd64/i.test(ua)) {
    osArch = '64位 (x64)';
  } else if (/arm64|aarch64/i.test(ua)) {
    osArch = 'ARM 64位';
  } else if (/WOW64/i.test(ua)) {
    osArch = '32位 (x86 on 64)';
  } else if (/i686|i386|x86/i.test(ua)) {
    osArch = '32位 (x86)';
  }

  // 2. 浏览器 (Browser) 与排版引擎解析
  let browserName = '未知浏览器';
  let browserVersion: string | undefined = undefined;
  let browserEngine = '其他引擎';
  let browserIcon = '🌐';

  if (/MicroMessenger\/(\d+(\.\d+)+)/i.test(ua)) {
    browserName = '微信内置浏览器';
    browserIcon = '💬';
    const m = ua.match(/MicroMessenger\/(\d+(\.\d+)+)/i);
    if (m) browserVersion = m[1];
    browserEngine = 'WeChat WebView';
  } else if (/QQBrowser\/(\d+(\.\d+)+)/i.test(ua) || /MQQBrowser\/(\d+(\.\d+)+)/i.test(ua)) {
    browserName = 'QQ 浏览器';
    browserIcon = '🐧';
    const m = ua.match(/(QQBrowser|MQQBrowser)\/(\d+(\.\d+)+)/i);
    if (m) browserVersion = m[2];
    browserEngine = 'Blink / X5';
  } else if (/Edg\/(\d+(\.\d+)+)/i.test(ua)) {
    browserName = 'Microsoft Edge';
    browserIcon = '🌊';
    const m = ua.match(/Edg\/(\d+(\.\d+)+)/i);
    if (m) browserVersion = m[1];
    browserEngine = 'Blink (Chromium)';
  } else if (/Chrome\/(\d+(\.\d+)+)/i.test(ua)) {
    browserName = 'Google Chrome';
    browserIcon = '🌐';
    const m = ua.match(/Chrome\/(\d+(\.\d+)+)/i);
    if (m) browserVersion = m[1];
    browserEngine = 'Blink (Chromium)';
  } else if (/Firefox\/(\d+(\.\d+)+)/i.test(ua)) {
    browserName = 'Mozilla Firefox';
    browserIcon = '🦊';
    const m = ua.match(/Firefox\/(\d+(\.\d+)+)/i);
    if (m) browserVersion = m[1];
    browserEngine = 'Gecko';
  } else if (/Safari\/(\d+(\.\d+)+)/i.test(ua) && !/Chrome/i.test(ua)) {
    browserName = 'Apple Safari';
    browserIcon = '🧭';
    const m = ua.match(/Version\/(\d+(\.\d+)+)/i);
    if (m) browserVersion = m[1];
    browserEngine = 'WebKit';
  }

  // 3. 设备形态 (Device Form Factor)
  let deviceType: 'desktop' | 'mobile' | 'tablet' = 'desktop';
  let deviceTypeLabel = '💻 桌面端 (PC / 笔记本)';
  let deviceModel: string | undefined = undefined;

  if (/iPad|Tablet/i.test(ua)) {
    deviceType = 'tablet';
    deviceTypeLabel = '📟 平板电脑 (Tablet)';
  } else if (/iPhone|Android.*Mobile|Mobile/i.test(ua)) {
    deviceType = 'mobile';
    deviceTypeLabel = '📱 移动手机 (Mobile)';
    // 尝试提取安卓型号 (例如 SM-S928B, Pixel 8, Xiaomi 14)
    if (/Android/i.test(ua)) {
      const androidModelMatch = ua.match(/;\s*([A-Za-z0-9\s_-]+)\s+Build/i);
      if (androidModelMatch) {
        deviceModel = androidModelMatch[1].trim();
      }
    } else if (/iPhone/i.test(ua)) {
      deviceModel = 'Apple iPhone';
    }
  }

  // 4. 触控与硬件规格
  const hasTouch = signals?.touch !== undefined ? signals.touch : (deviceType === 'mobile' || deviceType === 'tablet');
  const touchLabel = hasTouch ? '支持多点触控' : '单指针 (鼠标/键盘交互)';

  // 5. 语言格式化
  let langDisplay = signals?.language;
  if (langDisplay) {
    if (langDisplay.toLowerCase().startsWith('zh')) langDisplay = `${langDisplay} (简体中文)`;
    else if (langDisplay.toLowerCase().startsWith('en')) langDisplay = `${langDisplay} (English)`;
  }

  return {
    os: {
      name: osName,
      version: osVersion,
      architecture: osArch,
      icon: osIcon
    },
    browser: {
      name: browserName,
      version: browserVersion ? browserVersion.split('.').slice(0, 2).join('.') : undefined,
      engine: browserEngine,
      icon: browserIcon
    },
    device: {
      type: deviceType,
      typeLabel: deviceTypeLabel,
      model: deviceModel
    },
    hardware: {
      cores: signals?.cores,
      memoryGb: signals?.memory,
      touch: hasTouch,
      touchLabel
    },
    display: {
      screenResolution: signals?.screen ? signals.screen.replace('x', ' × ') : undefined,
      viewport: signals?.viewport ? signals.viewport.replace('x', ' × ') : undefined,
      pixelRatio: signals?.dpr,
      colorScheme: signals?.colorScheme
    },
    environment: {
      language: langDisplay,
      ip: ip || 'unknown',
      country: signals?.country
    },
    rawUserAgent: ua
  };
}
