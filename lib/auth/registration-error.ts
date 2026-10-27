// lib/auth/registration-error.ts
/** Preserve authentication failures without exposing raw provider errors to the form. */
export function registrationError(error:{message?:string;code?:string;status?:number}){
 const code=error.code||'',message=error.message||'';
 if(code==='over_email_send_rate_limit'||/email.*rate limit|rate limit.*email/i.test(message))return {status:429,code:'over_email_send_rate_limit',retryAfterSeconds:60,message:'验证邮件发送已触发限流，请稍后再试。若已收到验证邮件，请先使用原邮件完成验证，无需重复注册。'};
 if(error.status===429||code==='over_request_rate_limit')return {status:429,code:'over_request_rate_limit',retryAfterSeconds:60,message:'注册请求过于频繁，请稍后再试。'};
 if(code==='email_address_not_authorized')return {status:503,code,message:'当前邮件服务无法向此邮箱发送验证邮件，请联系管理员处理。'};
 if(code==='weak_password')return {status:400,code,message:'密码强度不足，请使用更长的密码，并组合字母、数字和符号。'};
 if(code==='email_address_invalid'||code==='validation_failed')return {status:400,code,message:'注册信息无效，请检查邮箱地址和密码。'};
 if(code==='user_already_exists'||/already.*(registered|exists|use)|registered.*already/i.test(message))return {status:400,code:'user_already_exists',message:'此账号无法重复注册，请尝试登录或找回密码。'};
 return {status:error.status&&error.status>=400&&error.status<500?error.status:503,code:'registration_unavailable',message:'注册暂未完成，请稍后重试。若持续失败，请联系管理员。'};
}
