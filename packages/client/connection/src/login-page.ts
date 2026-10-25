/** Localized, script-free login page served before the browser application starts. @module */
import { createHash } from 'node:crypto'

const en = {
  title: 'Sign in to DSH', label: 'Access key', submit: 'Sign in',
  hint: 'Use the key supplied by the server operator. This browser login is bound to your IP and ends when the server restarts.',
  required: 'Enter the access key to continue.', invalid: 'The key is incorrect. Check it and try again.',
  limited: 'Too many attempts. Wait before trying again.', unavailable: 'The server cannot read its login key. Ask the operator to check the key file.',
  'bad-request': 'This login form has expired or is invalid. Reload the page and try again.',
}
const zh: typeof en = {
  title: '登录 DSH', label: '访问密钥', submit: '登录',
  hint: '请输入服务器管理员提供的密钥。此浏览器的登录绑定当前 IP，服务器重启后需要重新验证。',
  required: '输入访问密钥后继续', invalid: '密钥不正确，请核对后重试',
  limited: '尝试次数过多，请稍后重试', unavailable: '服务器无法读取登录密钥，请联系管理员检查密钥文件',
  'bad-request': '登录表单已失效或格式无效，请刷新页面后重试',
}
/** Safe login outcome; no credential text is rendered. */
export type LoginNotice = 'required' | 'invalid' | 'limited' | 'unavailable' | 'bad-request'
const style = ':root{color-scheme:light dark}*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px;font:16px/1.6 system-ui;background:Canvas;color:CanvasText}main{width:min(100%,440px);padding:24px;border:1px solid GrayText;border-radius:12px}h1{font-size:24px;font-weight:500;margin:0 0 16px}p{margin:0 0 16px;overflow-wrap:anywhere}form{display:grid;gap:12px}input,button{font:inherit;color:inherit;background:Canvas;border:1px solid GrayText;border-radius:8px;padding:8px 12px;min-width:0;width:100%}input:focus-visible,button:focus-visible{outline:2px solid Highlight;outline-offset:2px}button{cursor:pointer}output{display:block;margin-bottom:16px}'

/**
 * Render a localized login form with no external resources or script execution.
 * @param chinese - Whether the request prefers Chinese.
 * @param csrf - Process-, authority- and address-bound token; never the access key.
 * @param notice - Safe outcome of the preceding attempt.
 * @param atLogin - Select the relative action beneath a mounted login endpoint.
 * @returns HTML and its restrictive Content Security Policy.
 */
export function loginPage(chinese: boolean, csrf: string, notice: LoginNotice, atLogin: boolean): { html: string; policy: string } {
  const t = chinese ? zh : en
  const styleHash = createHash('sha256').update(style).digest('base64')
  return {
    policy: `default-src 'none'; style-src 'sha256-${styleHash}'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'`,
    html: `<!doctype html><html lang="${chinese ? 'zh' : 'en'}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${t.title}</title><style>${style}</style></head><body><main><h1>${t.title}</h1><p>${t.hint}</p><output role="status">${t[notice]}</output><form method="post" action="${atLogin ? './login' : './auth/login'}"><input type="hidden" name="csrf" value="${csrf}"><label for="access-key">${t.label}</label><input id="access-key" name="key" type="password" required autocomplete="current-password" maxlength="1024"><button type="submit">${t.submit}</button></form></main></body></html>`,
  }
}
