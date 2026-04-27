import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import { AppRouter } from '@/router';
import '@/styles/global.less';

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: '#ff8400',
          colorBgLayout: '#f2f3f0',
          colorText: '#111111',
          colorTextSecondary: '#666666',
          borderRadius: 12,
          fontFamily: '"Geist", "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif',
        },
      }}
    >
      <BrowserRouter>
        <AppRouter />
      </BrowserRouter>
    </ConfigProvider>
  </React.StrictMode>,
);
