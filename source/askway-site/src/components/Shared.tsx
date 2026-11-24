import { ArrowUpRight, ArrowRight, Mail } from 'lucide-react';
import { Link } from 'react-router-dom';
import { site } from '../site';
export function Action({ to, children, tone = 'primary', className = '' }: { to: string; children: React.ReactNode; tone?: string; className?: string }) {
  return <Link to={to} className={'action action-' + tone + ' ' + className}><span>{children}</span><ArrowUpRight size={18} aria-hidden="true"/></Link>;
}
export function Eyebrow({ children, number }: { children: React.ReactNode; number?: string }) {
  return <div className="eyebrow">{number && <span className="section-number">{number}</span>}<span>{children}</span></div>;
}
export function CooperationCallout() {
  return <section className="cooperation-callout">
    <div className="callout-orbit" aria-hidden="true"/>
    <div className="container callout-inner">
      <Eyebrow>THE NEXT WAY, TOGETHER</Eyebrow>
      <h2>下一段旅程，<br/>我们一起出发。</h2>
      <p>让城市内容、目的地服务与出游体验，<br className="desktop-only"/>在一条更连贯的旅程里相遇。</p>
      <Action to="/cooperation/" tone="gold">探讨合作</Action>
      <a href={'mailto:' + site.email} className="callout-mail"><Mail size={16} aria-hidden="true"/>{site.email}<ArrowRight size={16} aria-hidden="true"/></a>
    </div>
  </section>;
}
