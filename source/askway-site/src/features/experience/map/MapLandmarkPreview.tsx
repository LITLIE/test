import type { Place } from '../contracts';
import { asset } from '../../../site';
export default function MapLandmarkPreview({ place }: { place: Place }) {
  const theatre = place.id === 'ZS-004';
  return <figure className="map-scene-thumbnail">
    <img src={asset('realism/' + (theatre ? 'theatre-dusk.webp' : 'coastal-overview.webp'))} alt={theatre ? '日月贝写实风格三维场景渲染' : '城市海岸写实风格三维场景渲染'} width="1920" height="1080" loading="lazy"/>
    <figcaption><strong>{theatre ? '靠近日月贝，看见光影。' : '把地点放回海岸与城市里。'}</strong><span>同源三维插图 · 场景示意，非地点入口实拍</span></figcaption>
  </figure>;
}
