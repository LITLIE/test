const places = [
  { name: '海滨公园', description: '从绿意里出发', className: 'park' },
  { name: '香炉湾', description: '沿海岸慢慢走', className: 'bay' },
  { name: '日月贝', description: '城市与海之间', className: 'theatre' },
];
export const routeDiagramPath = 'M84 257.4 C138 250.8 228 125.4 300 145.2 C360 158.4 450 85.8 516 59.4';

export default function RouteDiagram({ className = '', flowing = true }: { className?: string; flowing?: boolean }) {
  return <div className={`route-diagram ${className}`}>
    <svg className="route-diagram-drawing" viewBox="0 0 600 330" preserveAspectRatio="none" aria-hidden="true">
      <path className="diagram-land" d="M0 330V280C76 275 110 233 153 216S223 97 302 115 406 84 458 38 545 30 600 0V330Z"/>
      <path className="diagram-contour" d="M0 310C84 305 127 258 166 246S237 128 308 144 421 113 480 61 548 58 600 35"/>
      <path className="diagram-contour diagram-contour--outer" d="M0 329C93 331 152 290 189 272S253 159 317 174 436 143 500 88 564 83 600 63"/>
      <path className="diagram-connection" d={routeDiagramPath}/>
      {flowing && <path className="diagram-current" d={routeDiagramPath} pathLength="100"/>}
      <g className="diagram-nodes"><circle cx="84" cy="257.4" r="5"/><circle cx="300" cy="145.2" r="5"/><circle cx="516" cy="59.4" r="6"/></g>
      <g className="diagram-shell" transform="translate(479 2)"><path d="M0 34C-4 8 9-4 17 0 34 8 30 29 30 34ZM34 34C30 19 36 7 44 9 57 13 54 30 54 34Z"/><path d="M-8 37H62"/></g>
    </svg>
    <ol className="route-places" aria-label="珠海三站路线示意">{places.map((place, index) => <li key={place.name} className={`route-place route-place--${place.className}`}>
      <span className="route-place-number">0{index + 1}</span><h3>{place.name}</h3><p>{place.description}</p>
    </li>)}</ol>
    <p className="route-diagram-caption"><span>路线示意</span><span>ZHUHAI · COAST</span></p>
  </div>;
}
