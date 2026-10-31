export const BUILD_SHA = process.env.NEXT_PUBLIC_GIT_SHA || '';
export const BUILD_REPOSITORY = process.env.NEXT_PUBLIC_REPOSITORY || 'xiong1915/apex-v3-web';
export const BUILD_ID = BUILD_SHA.slice(0,7) || '版本未提供';
export const BUILD_ENV = process.env.NODE_ENV || 'production';
export const BUILD_TIMESTAMP = process.env.NEXT_PUBLIC_BUILD_TIME || '';
export const BUILD_SUBJECT = process.env.NEXT_PUBLIC_RELEASE_SUBJECT || '';
