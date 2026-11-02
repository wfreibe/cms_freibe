import {I18nProvider} from './context/I18nContext';
import {CMSDashboard} from './components/CMSDashboard';
import {AdminModal} from './components/AdminModal';
import {PublicWebsite} from './components/PublicWebsite';
const cms=window.location.pathname==='/cms';
if(cms){import('./styles/style.css');import('./styles/cms-workspace.css');}else{import('./styles/site.css');}
export function App(){return <I18nProvider cms={cms}>{cms?<><CMSDashboard onBackToWebsite={()=>window.location.assign('/')}/><AdminModal/></>:<PublicWebsite/>}</I18nProvider>;}
