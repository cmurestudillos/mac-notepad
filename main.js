// main.js - Archivo principal de Electron
const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 768,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true
    },
    // Configurar para no mostrar el menú nativo
    autoHideMenuBar: true
  });

  mainWindow.loadFile('index.html');
  
  // mainWindow.webContents.openDevTools();

  // Podemos desactivar completamente el menú nativo
  mainWindow.setMenu(null);
}

// Funciones para manejar archivos
function openFile() {
  dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [
      { name: 'Archivos de texto', extensions: ['txt', 'js', 'html', 'css', 'json', 'md'] },
      { name: 'Todos los archivos', extensions: ['*'] }
    ]
  }).then(result => {
    if (!result.canceled && result.filePaths.length > 0) {
      const filePath = result.filePaths[0];
      fs.readFile(filePath, 'utf8', (err, data) => {
        if (err) {
          dialog.showErrorBox('Error', `No se pudo abrir el archivo: ${err.message}`);
          return;
        }
        mainWindow.webContents.send('file-opened', { path: filePath, content: data });
      });
    }
  });
}

function saveFileAs() {
  dialog.showSaveDialog(mainWindow, {
    filters: [
      { name: 'Archivos de texto', extensions: ['txt'] },
      { name: 'Todos los archivos', extensions: ['*'] }
    ]
  }).then(result => {
    if (!result.canceled && result.filePath) {
      mainWindow.webContents.send('get-content', result.filePath);
    }
  });
}

// Escuchar evento para guardar contenido en archivo
ipcMain.on('save-content', (event, { filePath, content }) => {
  fs.writeFile(filePath, content, 'utf8', err => {
    if (err) {
      dialog.showErrorBox('Error', `No se pudo guardar el archivo: ${err.message}`);
      return;
    }
    mainWindow.webContents.send('file-saved', filePath);
  });
});

// Escuchar eventos de la interfaz
ipcMain.on('open-file-dialog', () => {
  openFile();
});

ipcMain.on('save-file-as', () => {
  saveFileAs();
});

ipcMain.on('exit-app', () => {
  // Verificar si hay archivos sin guardar antes de salir
  mainWindow.webContents.send('check-unsaved-tabs');
});

// Recibir confirmación para cerrar la aplicación
ipcMain.on('confirm-exit', () => {
  app.quit();
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});