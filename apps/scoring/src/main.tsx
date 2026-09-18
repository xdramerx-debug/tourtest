import React from 'react';
import { createRoot } from 'react-dom/client';
// Один бандл — пять тем: CSS всех дизайнов включается сразу (NFR §0 v2),
// переключение — flip data-атрибутов <html>, мгновенно, шрифты тем грузятся лениво.
import '@csl/tokens/dist/base.css';
import '@csl/tokens/dist/theme-1.css';
import '@csl/tokens/dist/theme-2.css';
import '@csl/tokens/dist/theme-3.css';
import '@csl/tokens/dist/theme-4.css';
import '@csl/tokens/dist/theme-5.css';
import '@csl/design-system/ds.css';
import { AppRoot, registerSW } from '@csl/app-ui';

registerSW();
createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppRoot config={{ variant: 'c', design: '1', themeSwitch: true, clubName: 'ГК «Дубровка»' }} />
  </React.StrictMode>,
);
