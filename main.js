const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow;
// Asegurarnos de que el directorio de usuario exista
const userDataPath = app.getPath('userData');
const sessionFile = path.join(userDataPath, 'session.json');

console.log('Archivo de sesión ubicado en:', sessionFile);

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

  // Desactivar completamente el menú nativo
  mainWindow.setMenu(null);

  // Abrir herramientas de desarrollo para depuración
  // mainWindow.webContents.openDevTools();

  // Cuando la ventana esté lista, cargar la sesión anterior
  mainWindow.webContents.on('did-finish-load', () => {
    console.log('Ventana cargada, intentando restaurar sesión...');
    loadSession();
  });

  // Guardar sesión antes de cerrar
  mainWindow.on('close', e => {
    console.log('Ventana cerrándose, guardando sesión...');
    e.preventDefault(); // Prevenir cierre hasta confirmar
    mainWindow.webContents.send('prepare-for-close');
  });
}

// Función para cargar la sesión anterior
function loadSession() {
  try {
    if (fs.existsSync(sessionFile)) {
      console.log('Archivo de sesión encontrado, leyendo...');
      const sessionData = fs.readFileSync(sessionFile, 'utf8');
      const openFiles = JSON.parse(sessionData);

      console.log('Sesión cargada con éxito:', openFiles);

      if (openFiles && openFiles.length > 0) {
        console.log('Enviando datos de sesión al renderer...');
        // Enviar la lista de archivos para que el renderer los abra
        mainWindow.webContents.send('restore-session', openFiles);
        return true;
      } else {
        console.log('No hay archivos guardados en la sesión');
      }
    } else {
      console.log('No se encontró archivo de sesión');
    }
  } catch (error) {
    console.error('Error al cargar la sesión:', error);
  }

  return false;
}

// Función para guardar la sesión actual
function saveSession(openFiles) {
  try {
    console.log('Guardando sesión:', openFiles);
    // Asegurarse de que el directorio exista
    if (!fs.existsSync(path.dirname(sessionFile))) {
      fs.mkdirSync(path.dirname(sessionFile), { recursive: true });
    }
    fs.writeFileSync(sessionFile, JSON.stringify(openFiles), 'utf8');
    console.log('Sesión guardada con éxito');
    return true;
  } catch (error) {
    console.error('Error al guardar la sesión:', error);
    return false;
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

// Escuchar eventos del renderer
ipcMain.on('save-content', (event, { filePath, content }) => {
  fs.writeFile(filePath, content, 'utf8', err => {
    if (err) {
      dialog.showErrorBox('Error', `No se pudo guardar el archivo: ${err.message}`);
      return;
    }
    mainWindow.webContents.send('file-saved', filePath);
  });
});

ipcMain.on('open-file-dialog', () => {
  openFile();
});

ipcMain.on('save-file-as', () => {
  saveFileAs();
});

ipcMain.on('exit-app', () => {
  // Verificar si hay archivos sin guardar antes de salir
  mainWindow.webContents.send('prepare-for-close');
});

// Recibir la lista de archivos abiertos para guardar la sesión
ipcMain.on('save-session', (event, openFiles) => {
  const success = saveSession(openFiles);
  if (success) {
    event.reply('session-saved', true);
  }
});

// Recibir confirmación de cierre y guardar la sesión
ipcMain.on('confirm-close', () => {
  console.log('Recibida confirmación de cierre, cerrando aplicación');
  app.exit(0);
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
