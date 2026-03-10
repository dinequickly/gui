import { Routes, Route } from 'react-router-dom';
import Home from './pages/Home.jsx';
import ItemPage from './pages/ItemPage.jsx';
import SubPage from './pages/SubPage.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/page/:id" element={<ItemPage />} />
      <Route path="/subpage/:blockId" element={<SubPage />} />
    </Routes>
  );
}
