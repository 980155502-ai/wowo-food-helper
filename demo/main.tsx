import React, { type ReactNode } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

document.body.style.margin = '0';

const globalStyle = document.createElement('style');
globalStyle.textContent = `
  *::-webkit-scrollbar { display: none; }
  .wowo-static-stage {
    height: 746px !important;
    height: calc(100vh - 36px) !important;
    max-height: 746px !important;
    background: #efc55b url('/assets/nanchang-flat-end-mobile-BL7LjZzU.jpg') center / contain no-repeat !important;
  }
  .wowo-static-action {
    width: 230px !important;
    max-width: calc(100% - 58px) !important;
  }
`;
document.head.appendChild(globalStyle);

class AppErrorBoundary extends React.Component<{ children: ReactNode }, { hasError: boolean }> {
    state = { hasError: false };

    static getDerivedStateFromError() {
        return { hasError: true };
    }

    componentDidCatch(error: unknown) {
        console.error('Wowo app failed to render', error);
        document.body.classList.add('wowo-app-entered');
    }

    render() {
        if (this.state.hasError) {
            return (
                <section className="wowo-static-intro">
                    <div className="wowo-static-error">
                        窝窝吃饭小助手加载时开了小差。
                        <br />
                        请刷新一次页面，或重新扫码进入。
                    </div>
                </section>
            );
        }

        return this.props.children;
    }
}

ReactDOM.createRoot(document.getElementById('app-root') ?? document.getElementById('root')!).render(
    <React.StrictMode>
        <AppErrorBoundary>
            <App />
        </AppErrorBoundary>
    </React.StrictMode>
);
