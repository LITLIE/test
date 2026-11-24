import { siteConfig } from '../../site.config.mjs';
export const cooperationLabels = { destination: '城市体验试点', hospitality: '目的地服务衔接', content: '城市内容共建' };
/** @param {{organization: string, contact: string, focus: string, details: string}} input */
export function createPartnershipBrief(input) {
  const clean = value => typeof value === 'string' ? value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim() : '';
  const organization = clean(input?.organization), contact = clean(input?.contact), details = clean(input?.details);
  const focus = input?.focus;
  const errors = {};
  if (!organization) errors.organization = '请填写机构或团队名称。';
  else if (organization.length > 60) errors.organization = '机构名称请控制在 60 字以内。';
  if (!details) errors.details = '请简要描述想共同探索的场景。';
  else if (details.length > 800) errors.details = '需求说明请控制在 800 字以内。';
  if (!Object.hasOwn(cooperationLabels, focus)) errors.focus = '请选择一个合作方向。';
  if (contact.length > 120) errors.contact = '联系方式请控制在 120 字以内。';
  if (Object.keys(errors).length) return { ok: false, errors, text: '' };
  const text = ['问途 AskWay · 合作意向', '', '机构 / 团队：' + organization,
    '合作方向：' + cooperationLabels[focus], contact ? '联系方式：' + contact : '',
    '', '希望共同探索的场景：', details, '', '接收邮箱：'+siteConfig.email].filter((line, i, all) => line || all[i - 1] !== '').join('\n');
  return { ok: true, errors: {}, text };
}
