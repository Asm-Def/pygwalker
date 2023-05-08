import React, { IframeHTMLAttributes, useRef, useEffect, useState, useMemo } from "react";
import ReactDOM, { createPortal } from "react-dom";

export const CustomIFrame: React.FC<IframeHTMLAttributes<any>> = ({ children, ...props }) => {
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const [iframeContentLoaded, setIframeContentLoaded] = useState(false);
    const [iframeHeight, setIframeHeight] = useState<number>(0);
    const iframeDocument = iframeRef.current?.contentDocument || iframeRef.current?.contentWindow?.document;
    const mountNode = iframeDocument?.body;

    const onLoad = () => {
        setIframeContentLoaded(true);
    };
    useEffect(() => {
        console.log("resize observable setting", iframeContentLoaded, iframeRef.current);
        if (iframeContentLoaded && iframeDocument) {
            let clearObserver: () => void;
            let targetHeight: number;
            const resizeHandler = () => {
                const e = iframeDocument.documentElement;
                const body = iframeDocument.body;
                const newHeight = Math.ceil(e.getBoundingClientRect().height) + 1;
                // offsetHeight, scrollHeight, clientHeight
                if (targetHeight !== newHeight && body.scrollHeight > body.clientHeight) {
                    targetHeight = newHeight;
                    setIframeHeight(newHeight);
                }
            }
            if (ResizeObserver) {
                const resizeObserver = new ResizeObserver(resizeHandler);
                resizeObserver.observe(iframeDocument.body);
                clearObserver = () => resizeObserver.disconnect();
            } else {
                resizeHandler();
                const timer = setInterval(resizeHandler, 2_000);
                clearObserver = () => clearInterval(timer);
            }
            return () => {
                if (iframeDocument) {
                    clearObserver();
                    // Clean up the rendered content inside the iframe
                    ReactDOM.unmountComponentAtNode(iframeDocument.body);
                }
            };
        }
    }, [iframeContentLoaded]);
  
    const style = useMemo(() => {
        return {
            width: '100%',
            border: 'none',
            overflow: 'auto',
            height: iframeHeight,
            ...props.style,
        } as React.CSSProperties;
    }, [props.style, iframeHeight]);

    return (
        <iframe style={style} ref={iframeRef} {...props} onLoad={onLoad}>
            {iframeContentLoaded && mountNode && ReactDOM.createPortal(children, mountNode)}
        </iframe>
    );
};