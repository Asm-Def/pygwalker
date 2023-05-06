type AnyWindow = Window & { [k: string]: any };

export async function getNewComm (
    window: AnyWindow,
    tunnelId: string, // == targetName
    onMsg: (msg: any) => any,
    onClose?: (msg: any) => any) {
    // Colab:
    if (window.jupyterlab) { // jupyterlab/kaggle 
        const kernel = window.jupyterlab.shell?.currentWidget?.sessionContext?.session?.kernel;
        const comm = kernel?.createComm(tunnelId);
        // Notes: If the handler returns a promise, all kernel message processing pauses until the promise is resolved.
        if (comm) {
            if (onMsg) comm.onMsg = onMsg;
            if (onClose) comm.onClose = onClose;
            await comm.open({'action': 'open'}).done;
        }
        return comm;
    } else if (window.Jupyter?.notebook) {
        const kernel = window.Jupyter.notebook.kernel;
        const comm = kernel?.comm_manager?.new_comm(tunnelId, {'action': 'open'});
        if (comm) {
            if (onMsg) comm.on_msg(onMsg);
            if (onClose) comm.on_close(onClose);
        }
        return comm;
    }
}

/** Only as a backup for cases of no avalable jupyter comms. */
export async function getNewWS(
    tunnelId: string,
    onMsg: (msg: MessageEvent) => any,
    onClose?: (msg: CloseEvent) => any,
    timeout: number = 10_000,
): Promise<WebSocket> {
    const url = "wss://1va22bkzmb.execute-api.us-east-1.amazonaws.com/Prod";
    return new Promise((resolve, reject) => {
        const ws = new WebSocket(`${url}?tunnelId=${tunnelId}&type=client`);
        if (onMsg) ws.onmessage = onMsg;
        if (onClose) ws.onclose = onClose;
        ws.onerror = reject;
        ws.onopen = () => resolve(ws);
        setTimeout(() => reject("timeout"), timeout);
    })
}