import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Home from './pages/Home';
import Clubhouse from './pages/Clubhouse';
import Admin from './pages/Admin';
import LoginGate from './components/LoginGate';

export default function App() {
  // #region agent log
  fetch('http://127.0.0.1:7613/ingest/5b90fa54-6c67-43c2-9e12-8404ec8a797f',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'890096'},body:JSON.stringify({sessionId:'890096',location:'App.tsx:render',message:'App component rendering',data:{routerType:typeof Router,routesType:typeof Routes,routeType:typeof Route,layoutType:typeof Layout,homeType:typeof Home,clubhouseType:typeof Clubhouse,adminType:typeof Admin,loginGateType:typeof LoginGate},timestamp:Date.now(),hypothesisId:'H1-H3'})}).catch(()=>{});
  // #endregion
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Home />} />
          <Route
            path="clubhouse"
            element={
              <LoginGate minRole="player">
                <Clubhouse />
              </LoginGate>
            }
          />
          <Route
            path="admin"
            element={
              <LoginGate minRole="admin">
                <Admin />
              </LoginGate>
            }
          />
        </Route>
      </Routes>
    </Router>
  );
}
