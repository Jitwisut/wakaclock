interface StatusMessage {
  connected: boolean;
  connecting?: boolean;
  error?: null | string;
  lastSentAt?: number;
  type: 'status';
  userCode?: null | string;
}

const statusElement = document.querySelector<HTMLElement>('#status');
const detail = document.querySelector<HTMLElement>('#detail');
const connect = document.querySelector<HTMLButtonElement>('#connect');
const disconnect = document.querySelector<HTMLButtonElement>('#disconnect');
const closeButton = document.querySelector<HTMLButtonElement>('#close');

function send(type: 'close' | 'connect' | 'disconnect') {
  parent.postMessage({ pluginMessage: { type } }, '*');
}

connect?.addEventListener('click', () => send('connect'));
disconnect?.addEventListener('click', () => send('disconnect'));
closeButton?.addEventListener('click', () => send('close'));

window.onmessage = (event: MessageEvent<{ pluginMessage?: StatusMessage }>) => {
  const message = event.data.pluginMessage;
  if (!message || message.type !== 'status' || !statusElement || !detail || !connect || !disconnect) return;

  if (message.connected) {
    statusElement.textContent = 'Tracking this Figma session';
    detail.textContent = message.lastSentAt
      ? `Last activity sent ${new Date(message.lastSentAt).toLocaleTimeString()}`
      : 'Connected. Only document/page metadata and activity state are sent.';
    connect.hidden = true;
    disconnect.hidden = false;
    return;
  }

  statusElement.textContent = message.connecting ? 'Waiting for approval' : 'Not connected';
  detail.textContent = message.error
    ? message.error
    : message.userCode
      ? `Approve code ${message.userCode} in the browser window that opened.`
      : 'Connect with AtoAxis to start privacy-safe design activity tracking.';
  connect.hidden = Boolean(message.connecting);
  disconnect.hidden = !message.connecting;
};
