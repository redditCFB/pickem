import './index.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ModSlatePicker } from './components/ModSlatePicker';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ModSlatePicker />
  </StrictMode>
);
