import React, { useEffect, type ReactNode } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

document.body.style.margin = '0';

const globalStyle = document.createElement('style');
globalStyle.textContent = `
  *::-webkit-scrollbar { display: none; }
`;
document.head.appendChild(globalStyle);

const markAppReady = () => {
    window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
            document.body.classList.add('wowo-app-ready');
        });
    });
};

class AppErrorBoundary extends React.Component<{ children: ReactNode }, { hasError: boolean }> {
    state = { hasError: false };

    static getDerivedStateFromError() {
        return { hasError: true };
    }

    componentDidCatch(error: unknown) {
        console.error('Wowo app failed to render', error);
        document.body.classList.add('wowo-app-ready');
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

const AppBoot = () => {
    useEffect(() => {
        markAppReady();
    }, []);

    return <App />;
};

ReactDOM.createRoot(document.getElementById('app-root') ?? document.getElementById('root')!).render(
    <React.StrictMode>
        <AppErrorBoundary>
            <AppBoot />
        </AppErrorBoundary>
    </React.StrictMode>
);
