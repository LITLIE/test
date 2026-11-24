export default function RouteArt({ active = 0, decorative = false, included = [0,1,2] }: { active?: number; decorative?: boolean; included?: number[] }) {
  const nodes=[{x:145,y:363,label:'海滨公园',lx:92,ly:407},{x:362,y:224,label:'香炉湾',lx:370,ly:273},{x:518,y:109,label:'日月贝',lx:548,ly:110}];
  const chosen=nodes.map((node,i)=>({...node,i})).filter(node=>included.includes(node.i));
  const routePaths:Record<string,string>={'0,1,2':'M145 363C215 333 218 346 279 301S305 243 362 224 396 246 445 180 475 162 518 109','0,1':'M145 363C215 333 218 346 279 301S305 243 362 224','1,2':'M362 224C396 246 445 180S475 162 518 109','0,2':'M145 363C244 310 311 174 518 109'};
  const route=routePaths[chosen.map(node=>node.i).join(',')];
  return <svg className={'route-art route-active-' + active} viewBox="0 0 680 500" fill="none" role={decorative ? undefined : 'img'} aria-hidden={decorative || undefined} aria-label={decorative ? undefined : '珠海路线示意：'+chosen.map(node=>node.label).join(' → ')}>
    <path className="coast-outline" d="M-15 460C95 430 58 326 175 298S281 315 323 223 402 210 441 145 556 161 559 81 648 40 702-5"/>
    <path className="coast-outline second" d="M-20 490C110 450 80 350 198 330S310 324 349 241 421 227 463 160 580 179 582 95 669 63 720 16"/>
    {route&&<><path className="route-base" d={route}/><path className="route-line" d={route} pathLength="100"/></>}
    {chosen.map(({x,y,i})=><g key={i} className={'map-node ' + (i === Math.min(active,2) ? 'selected' : '')}><circle className="node-halo" cx={x} cy={y} r="25"/><circle className="node-ring" cx={x} cy={y} r="10"/><circle cx={x} cy={y} r="3" fill="currentColor"/></g>)}
    {!decorative && <g className="map-labels">{chosen.map(node=><text key={node.i} x={node.lx} y={node.ly}>{node.label}</text>)}</g>}
    <g className="map-compass" transform="translate(68 84)" aria-hidden="true"><path d="M0-14V14M-14 0H14"/><text x="-4" y="-26">N</text></g>
  </svg>;
}
