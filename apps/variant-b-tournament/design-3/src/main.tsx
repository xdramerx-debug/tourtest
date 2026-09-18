// @generated scripts/gen-apps.mjs
import React from 'react';
import { createRoot } from 'react-dom/client';
import '@csl/tokens/dist/base.css';
import '@csl/tokens/dist/theme-3.css';
import '@csl/design-system/ds.css';
import { AppRoot, registerSW } from '@csl/app-ui';


createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppRoot config={{ variant: 'b', design: '3' }} />
  </React.StrictMode>,
);
