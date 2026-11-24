import { ArrowUpRight, Download, Github } from 'lucide-react';
import { site } from '../site';
import { Eyebrow } from './Shared';
export default function SoftwareDownload(){
  const software=site.software;
  return <section className="software-section container" id="download">
    <div className="software-intro"><Eyebrow>TAKE THE JOURNEY WITH YOU</Eyebrow><h2>把旅程，<br/>带到手机。</h2><p>通过 GitHub 获取问途软件与安装说明，<br/>继续体验规划、保存与现场执行。</p></div>
    <div className="software-card">
      <div className="software-card-top"><span className="software-mark"><Download size={25} strokeWidth={1.4} aria-hidden="true"/></span><span className="software-status">{software.publicDownloadAvailable?'GitHub 软件获取':'下载入口预留'}</span></div>
      <h3>问途 {software.platform}</h3><p className="software-version">当前验收版本 {software.version} · {software.packageLabel}</p>
      <dl><div><dt>适用系统</dt><dd>Android {software.minimumAndroid} 及以上</dd></div><div><dt>获取方式</dt><dd>GitHub 软件仓库</dd></div></dl>
      {software.publicDownloadAvailable ? <a className="action action-primary" data-public-download href={software.downloadUrl} target="_blank" rel="noopener noreferrer"><span>前往 GitHub 获取</span><ArrowUpRight size={18} aria-hidden="true"/></a> : <button type="button" className="action action-pending" disabled><span>公开下载尚未开放</span><Download size={17} aria-hidden="true"/></button>}
      <a className="software-repository" href={software.repositoryUrl} target="_blank" rel="noopener noreferrer"><Github size={16} aria-hidden="true"/><span>GitHub 仓库</span><ArrowUpRight size={15} aria-hidden="true"/></a>
      <p className="software-note">{software.publicDownloadAvailable?'安装包、版本与后端配置以仓库说明为准。当前为验收试用版，安装后需配置可访问的 AskWay 后端地址。':'仓库目前仅授权账号可访问。仓库公开并核实下载地址后，此处将开放软件获取。'}</p>
    </div>
  </section>;
}
