// Local-only integration smoke test: synthetic devices, no account credentials.
const { createRequire } = require('node:module');
const { Buffer } = require('node:buffer');
const path = require('node:path');
const appRoot = path.resolve(__dirname, '..');
const requireApp = createRequire(path.join(appRoot, 'package.json'));
const { build } = requireApp('esbuild');
const { chromium } = requireApp('@playwright/test');
const { createServer } = require('node:http');
const { createHmac, randomUUID } = require('node:crypto');
const assert = require('node:assert/strict');
const secret = 'local-presence-development-secret-change-before-deploy';
function token(identity, room, admin = false) {
  const b = (v) => Buffer.from(JSON.stringify(v)).toString('base64url');
  const payload =
    b({ alg: 'HS256', typ: 'JWT' }) +
    '.' +
    b({
      iss: 'devkey',
      sub: identity,
      nbf: Math.floor(Date.now() / 1000) - 5,
      exp: Math.floor(Date.now() / 1000) + 60,
      video: admin
        ? { roomAdmin: true, room }
        : {
            roomJoin: true,
            room,
            canPublish: true,
            canSubscribe: true,
            canPublishData: false,
            canPublishSources: ['microphone', 'camera', 'screen_share', 'screen_share_audio'],
          },
    });
  return payload + '.' + createHmac('sha256', secret).update(payload).digest('base64url');
}
(async () => {
  const bundle = await build({
    stdin: {
      contents: `import {Room,RoomEvent} from 'livekit-client';window.received=[];window.muted=0;window.connect=async(token)=>{const room=new Room();window.room=room;room.on(RoomEvent.TrackSubscribed,track=>window.received.push(track.kind));room.on(RoomEvent.TrackMuted,()=>window.muted++);await room.connect('ws://localhost:7880',token);};`,
      resolveDir: appRoot,
    },
    bundle: true,
    write: false,
    format: 'iife',
  });
  const server = createServer((req, res) => {
    res.setHeader('Content-Type', 'text/html');
    res.end('<script>' + bundle.outputFiles[0].text + '</script>');
  }).listen(4189, '127.0.0.1');
  let browser;
  try {
    browser = await chromium.launch({
      executablePath: process.env.PRESENCE_TEST_CHROME_EXECUTABLE,
      headless: true,
      args: [
        '--use-fake-ui-for-media-stream',
        '--use-fake-device-for-media-stream',
        '--autoplay-policy=no-user-gesture-required',
      ],
    });
    const a = await browser.newPage();
    const b = await browser.newPage();
    const c = await browser.newPage();
    await Promise.all([a, b, c].map((p) => p.goto('http://127.0.0.1:4189')));
    const room = 'presence-' + randomUUID() + '-' + randomUUID();
    await a.evaluate((t) => window.connect(t), token('alice', room));
    await b.evaluate((t) => window.connect(t), token('bob', room));
    await c.evaluate((t) => window.connect(t), token('outsider', room + '-other'));
    await a.evaluate(async () => {
      await window.room.localParticipant.setMicrophoneEnabled(true);
      await window.room.localParticipant.setCameraEnabled(true);
    });
    await b.waitForFunction(
      () => window.received.includes('audio') && window.received.includes('video'),
      { timeout: 15000 }
    );
    assert.deepEqual(await c.evaluate(() => window.received), []);
    await a.evaluate(() => window.room.localParticipant.setMicrophoneEnabled(false));
    await b.waitForFunction(() => window.muted > 0);
    const response = await fetch(
      'http://localhost:7880/twirp/livekit.RoomService/RemoveParticipant',
      {
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + token('admin', room, true),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ room, identity: 'bob' }),
      }
    );
    assert.equal(response.status, 200);
    await b.waitForFunction(() => window.room.state === 'disconnected');
    console.log(
      'PASS: real LiveKit audio/video publication, remote mute, room isolation and server removal (two subscribers, fake devices).'
    );
  } finally {
    if (browser) await browser.close();
    server.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
