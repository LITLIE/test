import { renderToString } from 'react-dom/server';
import { StaticRouter } from 'react-router-dom/server';
import App from './App';
export function render(path:string,base='/'){
  return renderToString(<StaticRouter basename={base} location={base.replace(/\/$/,'')+path}><App/></StaticRouter>);
}
