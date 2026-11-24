import { Link } from 'react-router-dom';
export default function Brand({ light = false }: { light?: boolean }) {
  return <Link to="/" className={'brand ' + (light ? 'brand-light' : '')} aria-label="问途 AskWay 首页">
    <svg viewBox="0 0 36 40" aria-hidden="true"><path d="M8 30 18 8l10 22M12 22h13" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"/><circle cx="8" cy="30" r="3" fill="currentColor"/><circle cx="28" cy="30" r="3" fill="currentColor"/></svg>
    <span className="brand-name">问途<span>ASKWAY</span></span>
  </Link>;
}
