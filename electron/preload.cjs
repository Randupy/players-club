const { contextBridge, ipcRenderer } = require('electron');

const call = (name, ...args) => ipcRenderer.invoke('pc:' + name, ...args);
const on = (channel, cb) => {
  const fn = (_e, payload) => cb(payload);
  ipcRenderer.on('pc:' + channel, fn);
  return () => ipcRenderer.removeListener('pc:' + channel, fn);
};

contextBridge.exposeInMainWorld('pc', {
  call,
  on
});
