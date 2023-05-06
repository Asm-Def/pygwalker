import { getNewComm, getNewWS } from "../utils/comm";
import { getConfig } from "../utils/userConfig";

export class Tunnel {
    private _opened_promise: Promise<boolean>;
    private _message_handlers: Array<(msg: any) => any> = [];
    private _close_handlers: Array<(reason?: any) => any> = [];
    private _unhandled: Array<any> = [];
    private comm: any;
    private ws?: WebSocket;
    private _on_message = async (msg: any) => {
        if (process.env.NODE_ENV === 'develop') {
            console.log("tunnel message:", msg);
        }
        await this._opened_promise;
        if (this._message_handlers) await Promise.all(this._message_handlers.map(handler => handler(msg)));
        else {
            this._unhandled.push(msg);
        }
    }
    private _on_close = async (reason: any) => {
        if (process.env.NODE_ENV === 'develop') {
            console.log("tunnel close:", this, reason);
        }
        await Promise.all(this._close_handlers.map(handler => handler(reason)));
    }
    private async _open (tunnelId: string, window: Window) {
        let comm = getNewComm(window, tunnelId, this._on_message, this._on_close), ws: Promise<WebSocket> | undefined;
        let disableWS = ['offline', 'get-only'].includes(getConfig().privacy);
        if (!disableWS) {
            const onMsg = (msg: MessageEvent) => {
                if (process.env.NODE_ENV === 'develop') console.log("ws message:", msg)
                this._on_message(JSON.parse(msg.data));
            }
            const onClose = (msg: CloseEvent) => {
                if (process.env.NODE_ENV === 'develop') console.log("ws message:", msg)
                this._on_close(msg.reason);
            }
            ws = getNewWS(tunnelId, onMsg, onClose);
        }
        try {
            this.comm = await comm;
        } catch(err) {
            console.log("comm:", err);
        }
        if (ws) {
            try {
                this.ws = await ws!;
            } catch(err) {
                console.log("ws:", err);
            }
        }
    }

    constructor(tunnelId: string, _window: Window = window) {
        this._opened_promise = new Promise((resolve, reject) => {
            this._open(tunnelId, _window).then(() => {
                resolve(true);
            }).catch(err => {
                reject(err);
            });
        });
    }
    public get opened(): Promise<boolean> {
        return this._opened_promise;
    }
    public async send(msg: any) {
        await this._opened_promise;
        const promises = new Array<any>();
        if (this.comm) {
            promises.push(this.comm.send(msg));
        }
        if (this.ws) {
            const code = JSON.stringify({
                action: "sendmessage",
                data: msg,
            });
            promises.push(this.ws.send(code));
        }
        return Promise.all(promises);
    }
    public onMessage(handler: (msg: any) => any) {
        this._message_handlers.push(handler);
        if (this._unhandled.length) {
            for (let msg of this._unhandled) {
                handler(msg);
            }
        }
    }
    public onClose(handler: (reason?: any) => any) {
        this._close_handlers.push(handler);
    }
    public close() {
        if (this.comm) this.comm.close();
        if (this.ws) this.ws.close();
    }
}