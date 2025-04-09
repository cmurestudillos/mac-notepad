// main.js - Archivo principal de Electron
const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow;
const sessionFile = path.join(app.getPath('userData'), 'session.json');

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1800,
    height: 1169,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true,
    },
    // Configurar para no mostrar el menú nativo
    autoHideMenuBar: true,
  });

  mainWindow.loadFile('index.html');

  // Podemos desactivar completamente el menú nativo
  mainWindow.setMenu(null);

  // Cuando la aplicación esté lista para mostrar la ventana, cargar la sesión anterior
  mainWindow.webContents.on('did-finish-load', () => {
    loadSession();
  });

  // Guardar la sesión cuando la ventana se cierra
  mainWindow.on('close', e => {
    // Primero verificar si hay archivos sin guardar
    mainWindow.webContents.send('check-unsaved-tabs-for-close', e.sender);
  });
}

// Función para cargar la sesión anterior
function loadSession() {
  try {
    if (fs.existsSync(sessionFile)) {
      const sessionData = fs.readFileSync(sessionFile, 'utf8');
      const openFiles = JSON.parse(sessionData);

      if (openFiles && openFiles.length > 0) {
        // Enviar la lista de archivos para que el renderer los abra
        mainWindow.webContents.send('restore-session', openFiles);
      }
    }
  } catch (error) {
    console.error('Error al cargar la sesión:', error);
    // Si hay un error, continuar normalmente con un nuevo documento
  }
}

// Función para guardar la sesión actual
function saveSession(openFiles) {
  try {
    fs.writeFileSync(sessionFile, JSON.stringify(openFiles), 'utf8');
  } catch (error) {
    console.error('Error al guardar la sesión:', error);
  }
}

// Funciones para manejar archivos
function openFile() {
  dialog
    .showOpenDialog(mainWindow, {
      properties: ['openFile'],
      filters: [
        { name: 'Archivos de texto', extensions: ['txt', 'js', 'html', 'css', 'json', 'md'] },
        { name: 'Todos los archivos', extensions: ['*'] },
      ],
    })
    .then(result => {
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
  dialog
    .showSaveDialog(mainWindow, {
      filters: [
        { name: 'Archivos de texto', extensions: ['txt'] },
        { name: 'Todos los archivos', extensions: ['*'] },
      ],
    })
    .then(result => {
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

// Recibir la lista de archivos abiertos para guardar la sesión
ipcMain.on('save-session', (event, openFiles) => {
  saveSession(openFiles);
});

// Confirmar el cierre de la aplicación después de guardar la sesión
ipcMain.on('confirm-close', () => {
  // La ventana ya ha guardado la sesión, ahora podemos cerrar
  app.exit(0);
});

// Recibir confirmación para cerrar la aplicación
ipcMain.on('confirm-exit', () => {
  // Primero pedir al renderer que guarde la sesión
  mainWindow.webContents.send('prepare-to-exit');
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
