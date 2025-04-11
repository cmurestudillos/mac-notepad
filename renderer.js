const { ipcRenderer } = require('electron');
const path = require('path');
const fs = require('fs');
const CodeMirror = require('codemirror');

// Importar modos de lenguaje y addons de CodeMirror
require('codemirror/mode/javascript/javascript');
require('codemirror/mode/xml/xml');
require('codemirror/mode/css/css');
require('codemirror/mode/htmlmixed/htmlmixed');
require('codemirror/mode/markdown/markdown');
require('codemirror/mode/python/python');
require('codemirror/addon/edit/matchbrackets');
require('codemirror/addon/edit/closebrackets');
require('codemirror/addon/search/search');
require('codemirror/addon/search/searchcursor');
require('codemirror/addon/search/jump-to-line');
require('codemirror/addon/dialog/dialog');
require('codemirror/addon/fold/foldcode');
require('codemirror/addon/fold/foldgutter');
require('codemirror/addon/fold/brace-fold');

// Referencias a elementos del DOM
const tabsBar = document.getElementById('tabs-bar');
const editorsContainer = document.getElementById('editors-container');
const newTabButton = document.getElementById('new-tab-button');
const currentFileElement = document.getElementById('current-file');
const lineColumnElement = document.getElementById('line-column');

// Elementos del menú
const newFileBtn = document.getElementById('new-file');
const openFileBtn = document.getElementById('open-file');
const saveFileBtn = document.getElementById('save-file');
const saveAsFileBtn = document.getElementById('save-as-file');
const closeTabBtn = document.getElementById('close-tab');
const exitAppBtn = document.getElementById('exit-app');

const undoBtn = document.getElementById('undo');
const redoBtn = document.getElementById('redo');
const cutBtn = document.getElementById('cut');
const copyBtn = document.getElementById('copy');
const pasteBtn = document.getElementById('paste');
const selectAllBtn = document.getElementById('select-all');

const toggleWrapBtn = document.getElementById('toggle-wrap');
const zoomInBtn = document.getElementById('zoom-in');
const zoomOutBtn = document.getElementById('zoom-out');
const zoomResetBtn = document.getElementById('zoom-reset');

// Variables para el zoom
let currentZoom = 1;
const zoomStep = 0.1;

// Gestión de pestañas
let tabs = [];
let activeTabId = null;

// Variables para el drag and drop de pestañas
let draggedTab = null;
let draggedTabIndex = -1;

// Flag para controlar si ya se está restaurando la sesión
let isRestoringSession = false;

// Flag para saber si ya se creó la primera pestaña
let initialTabCreated = false;

// Debug flag
const DEBUG = true;

function debug(...args) {
  if (DEBUG) {
    console.log(...args);
  }
}

// Clase Tab para gestionar las pestañas
class Tab {
  constructor(id, title, filePath = null) {
    this.id = id;
    this.title = title;
    this.filePath = filePath;
    this.editor = null;
    this.mode = 'text/plain';
    this.isUnsaved = false;

    this.createTabElement();
    this.createEditorElement();
    this.initializeEditor();
  }

  createTabElement() {
    const tabElement = document.createElement('div');
    tabElement.className = 'tab';
    tabElement.setAttribute('data-tab-id', this.id);
    tabElement.setAttribute('draggable', 'true');

    const titleElement = document.createElement('div');
    titleElement.className = 'tab-title';
    titleElement.textContent = this.title;

    const closeElement = document.createElement('div');
    closeElement.className = 'tab-close';
    closeElement.innerHTML = '&times;';
    closeElement.addEventListener('click', e => {
      e.stopPropagation();
      closeTab(this.id);
    });

    tabElement.appendChild(titleElement);
    tabElement.appendChild(closeElement);

    tabElement.addEventListener('click', () => {
      activateTab(this.id);
    });

    // Eventos para drag and drop
    tabElement.addEventListener('dragstart', e => {
      draggedTab = this;
      draggedTabIndex = tabs.indexOf(this);
      e.dataTransfer.setData('text/plain', this.id);
      tabElement.classList.add('dragging');

      // Establecer una imagen personalizada para arrastrar (opcional)
      const dragImage = tabElement.cloneNode(true);
      dragImage.style.position = 'absolute';
      dragImage.style.top = '-1000px';
      document.body.appendChild(dragImage);
      e.dataTransfer.setDragImage(dragImage, 0, 0);
      setTimeout(() => {
        document.body.removeChild(dragImage);
      }, 0);
    });

    tabElement.addEventListener('dragover', e => {
      e.preventDefault();
      tabElement.classList.add('drag-over');
    });

    tabElement.addEventListener('dragleave', () => {
      tabElement.classList.remove('drag-over');
    });

    tabElement.addEventListener('drop', e => {
      e.preventDefault();
      tabElement.classList.remove('drag-over');

      if (draggedTab && draggedTab.id !== this.id) {
        const targetIndex = tabs.indexOf(this);
        reorderTabs(draggedTabIndex, targetIndex);
      }
    });

    tabElement.addEventListener('dragend', () => {
      tabElement.classList.remove('dragging');
      draggedTab = null;
      draggedTabIndex = -1;

      // Limpiar clases de drag-over de todas las pestañas
      document.querySelectorAll('.tab').forEach(tab => {
        tab.classList.remove('drag-over');
      });
    });

    tabsBar.appendChild(tabElement);
    this.tabElement = tabElement;
  }

  createEditorElement() {
    const editorWrapper = document.createElement('div');
    editorWrapper.className = 'editor-wrapper';
    editorWrapper.setAttribute('data-editor-id', this.id);

    editorsContainer.appendChild(editorWrapper);
    this.editorElement = editorWrapper;
  }

  initializeEditor() {
    this.editor = CodeMirror(this.editorElement, {
      value: '',
      mode: this.mode,
      theme: 'default',
      lineNumbers: true,
      lineWrapping: true,
      autoCloseBrackets: true,
      matchBrackets: true,
      indentUnit: 2,
      tabSize: 2,
      foldGutter: true,
      gutters: ['CodeMirror-linenumbers', 'CodeMirror-foldgutter'],
    });

    this.editor.setSize('100%', '100%');

    // Escuchar cambios para marcar como no guardado
    this.editor.on('change', () => {
      // No marcar como no guardado durante la restauración de sesión
      if (!isRestoringSession && !this.isUnsaved) {
        this.isUnsaved = true;
        this.updateTabElement();
      }
    });

    // Actualizar posición del cursor cuando esta pestaña está activa
    this.editor.on('cursorActivity', () => {
      if (activeTabId === this.id) {
        updateCursorPosition(this.editor);
      }
    });

    // Aplicar el zoom actual
    const cmElement = this.editorElement.querySelector('.CodeMirror');
    if (cmElement && currentZoom !== 1) {
      cmElement.style.fontSize = `${14 * currentZoom}px`;
    }
  }

  setContent(content) {
    if (this.editor) {
      this.editor.setValue(content || '');
      this.isUnsaved = false;
      this.updateTabElement();

      // Forzar un refresco del editor
      setTimeout(() => {
        this.editor.refresh();
      }, 50);
    }
  }

  getContent() {
    return this.editor ? this.editor.getValue() : '';
  }

  setFilePath(filePath) {
    this.filePath = filePath;
    this.title = filePath ? path.basename(filePath) : 'Sin título';
    this.isUnsaved = false;
    this.updateTabElement();

    if (filePath) {
      const extension = path.extname(filePath).toLowerCase().substring(1);
      this.setMode(detectMode(extension));
    }
  }

  setMode(mode) {
    this.mode = mode;
    if (this.editor) {
      this.editor.setOption('mode', mode);
    }
  }

  updateTabElement() {
    const titleElement = this.tabElement.querySelector('.tab-title');
    titleElement.textContent = this.title;

    if (this.isUnsaved) {
      this.tabElement.classList.add('unsaved');
    } else {
      this.tabElement.classList.remove('unsaved');
    }
  }

  markAsSaved() {
    this.isUnsaved = false;
    this.updateTabElement();
  }

  refresh() {
    if (this.editor) {
      this.editor.refresh();
    }
  }

  // Método para exportar la información del tab para guardar la sesión
  toSessionData() {
    return {
      filePath: this.filePath,
      mode: this.mode,
      title: this.title,
    };
  }
}

// Función para reordenar las pestañas
function reorderTabs(fromIndex, toIndex) {
  // Guardar la pestaña que se mueve
  const tab = tabs[fromIndex];

  // Quitar la pestaña del array original
  tabs.splice(fromIndex, 1);

  // Insertar la pestaña en la nueva posición
  tabs.splice(toIndex, 0, tab);

  // Actualizar el DOM
  renderTabsOrder();

  // Activar la pestaña que fue movida
  activateTab(tab.id);
}

// Función para renderizar el orden actual de las pestañas
function renderTabsOrder() {
  // Eliminar todas las pestañas del DOM
  while (tabsBar.firstChild) {
    tabsBar.removeChild(tabsBar.firstChild);
  }

  // Volver a agregar las pestañas en el nuevo orden
  tabs.forEach(tab => {
    tabsBar.appendChild(tab.tabElement);
  });

  // Volver a establecer la pestaña activa
  if (activeTabId) {
    const activeTabElement = document.querySelector(`.tab[data-tab-id="${activeTabId}"]`);
    if (activeTabElement) {
      activeTabElement.classList.add('active');
    }
  }

  // Guardar el estado actual en la sesión
  saveSessionData();
}

// Guardar los datos de la sesión
function saveSessionData() {
  // No guardar la sesión durante la restauración
  if (isRestoringSession) return;

  // Recopilar información de pestañas abiertas con archivos guardados
  const openFiles = tabs
    .filter(tab => tab.filePath) // Solo guardar pestañas con archivos guardados
    .map(tab => tab.toSessionData());

  debug('Guardando sesión con archivos:', openFiles);

  // Enviar al proceso principal para guardar
  ipcRenderer.send('save-session', openFiles);
}

// Función para restaurar una sesión
function restoreSession(files) {
  debug('Restaurando sesión con archivos:', files);
  isRestoringSession = true;

  // Si hay pestañas abiertas (la pestaña de inicio) que no tienen contenido, cerrarlas
  if (tabs.length === 1 && !tabs[0].filePath && !tabs[0].isUnsaved && tabs[0].getContent() === '') {
    debug('Cerrando pestaña inicial vacía');
    // Cerrar la pestaña vacía inicial
    closeTab(tabs[0].id, true); // true indica que es una operación silenciosa
  }

  // Abrir cada archivo de la sesión anterior
  if (files && files.length > 0) {
    debug(`Intentando abrir ${files.length} archivos`);

    // Crear una promesa para cada archivo
    const openPromises = files.map(file => {
      return new Promise((resolve, reject) => {
        if (file.filePath && fs.existsSync(file.filePath)) {
          debug(`Leyendo archivo: ${file.filePath}`);
          fs.readFile(file.filePath, 'utf8', (err, data) => {
            if (err) {
              debug(`Error al leer el archivo ${file.filePath}:`, err);
              reject(err);
            } else {
              debug(`Archivo leído con éxito: ${file.filePath}`);
              const tab = createNewTab(file.title || path.basename(file.filePath), file.filePath, data);
              if (file.mode) {
                tab.setMode(file.mode);
              }
              resolve(tab);
            }
          });
        } else {
          debug(`Archivo no encontrado o ruta inválida: ${file.filePath}`);
          resolve(null); // Resolver con null si el archivo no existe
        }
      });
    });

    // Esperar a que todos los archivos se abran
    Promise.all(openPromises)
      .then(tabs => {
        const validTabs = tabs.filter(tab => tab !== null);
        debug(`Se han abierto ${validTabs.length} archivos de ${files.length}`);

        // Activar la primera pestaña si hay pestañas
        if (validTabs.length > 0) {
          activateTab(validTabs[0].id);
        } else {
          // Si no se pudo restaurar ningún archivo, crear una nueva pestaña
          debug('No se pudo restaurar ningún archivo, creando nueva pestaña');
          createNewTab();
        }
        isRestoringSession = false;
      })
      .catch(error => {
        debug('Error al restaurar la sesión:', error);
        isRestoringSession = false;
        createNewTab();
      });
  } else {
    // Si no hay archivos para restaurar, crear una nueva pestaña
    debug('No hay archivos en la sesión para restaurar');
    createNewTab();
    isRestoringSession = false;
  }
}

// Función para detectar el modo por la extensión del archivo
function detectMode(extension) {
  const modeMap = {
    js: 'javascript',
    json: 'javascript',
    html: 'htmlmixed',
    htm: 'htmlmixed',
    xml: 'xml',
    css: 'css',
    md: 'markdown',
    markdown: 'markdown',
    py: 'python',
    txt: 'text/plain',
  };

  return modeMap[extension] || 'text/plain';
}

// Actualizar la posición del cursor
function updateCursorPosition(editor) {
  if (editor) {
    const cursor = editor.getCursor();
    lineColumnElement.textContent = `Línea: ${cursor.line + 1}, Columna: ${cursor.ch + 1}`;
  }
}

// Crear una nueva pestaña
function createNewTab(title = 'Sin título', filePath = null, content = '') {
  const id = Date.now().toString();
  const tab = new Tab(id, title, filePath);

  if (content !== undefined) {
    tab.setContent(content);
  }

  tabs.push(tab);
  activateTab(id);

  // Guardar el estado de la sesión si no estamos restaurando
  if (!isRestoringSession) {
    saveSessionData();
  }

  // Marcar que ya se ha creado la primera pestaña
  initialTabCreated = true;

  return tab;
}

// Activar una pestaña
function activateTab(id) {
  // Desactivar todas las pestañas
  document.querySelectorAll('.tab').forEach(tab => {
    tab.classList.remove('active');
  });

  document.querySelectorAll('.editor-wrapper').forEach(editor => {
    editor.classList.remove('active');
  });

  // Activar la pestaña seleccionada
  const tabElement = document.querySelector(`.tab[data-tab-id="${id}"]`);
  const editorElement = document.querySelector(`.editor-wrapper[data-editor-id="${id}"]`);

  if (tabElement && editorElement) {
    tabElement.classList.add('active');
    editorElement.classList.add('active');
    activeTabId = id;

    const tab = getTabById(id);
    if (tab) {
      currentFileElement.textContent = tab.filePath || 'Nuevo documento';

      // Refrescar el editor para asegurar que se muestra correctamente
      setTimeout(() => {
        tab.refresh();
        updateCursorPosition(tab.editor);

        // Enfocar el editor
        if (tab.editor) {
          tab.editor.focus();
        }
      }, 50);
    }
  }
}

// Cerrar una pestaña
function closeTab(id, silent = false) {
  const tab = getTabById(id);

  if (!tab) return;

  if (tab.isUnsaved && !silent) {
    // Preguntar si se desea guardar antes de cerrar
    const shouldSave = confirm(`¿Desea guardar los cambios en "${tab.title}" antes de cerrar?`);
    if (shouldSave) {
      saveTab(tab);
      // La pestaña se cerrará después de guardar
      return;
    }
  }

  // Encontrar el índice de la pestaña
  const tabIndex = tabs.findIndex(t => t.id === id);

  // Eliminar elementos DOM
  const tabElement = document.querySelector(`.tab[data-tab-id="${id}"]`);
  const editorElement = document.querySelector(`.editor-wrapper[data-editor-id="${id}"]`);

  if (tabElement) tabElement.remove();
  if (editorElement) editorElement.remove();

  // Eliminar de la lista de pestañas
  tabs = tabs.filter(t => t.id !== id);

  // Si era la pestaña activa, activar otra
  if (activeTabId === id && !silent) {
    if (tabs.length > 0) {
      // Activar la pestaña que estaba a la derecha o izquierda
      const newIndex = Math.min(tabIndex, tabs.length - 1);
      activateTab(tabs[newIndex].id);
    } else {
      // Si no hay más pestañas, crear una nueva
      createNewTab();
    }
  }

  // Guardar el estado actual en la sesión si no es una operación silenciosa
  if (!silent && !isRestoringSession) {
    saveSessionData();
  }
}

// Obtener una pestaña por su ID
function getTabById(id) {
  return tabs.find(tab => tab.id === id);
}

// Obtener la pestaña activa
function getActiveTab() {
  return getTabById(activeTabId);
}

// Guardar una pestaña
function saveTab(tab) {
  if (!tab.filePath) {
    // Si no tiene ruta de archivo, usar "Guardar como"
    ipcRenderer.send('save-file-as');
  } else {
    // Si ya tiene ruta de archivo, guardar directamente
    const content = tab.getContent();
    ipcRenderer.send('save-content', { filePath: tab.filePath, content });
  }
}

// Abrir un archivo en una nueva pestaña
function openFileInNewTab(filePath, content) {
  // Verificar si el archivo ya está abierto
  const existingTab = tabs.find(tab => tab.filePath === filePath);
  if (existingTab) {
    // Si ya está abierto, simplemente activarlo
    activateTab(existingTab.id);
    return;
  }

  const title = path.basename(filePath);
  const tab = createNewTab(title, filePath, content);

  // Detectar el modo basado en la extensión
  const extension = path.extname(filePath).toLowerCase().substring(1);
  tab.setMode(detectMode(extension));

  // Guardar la sesión después de abrir el archivo
  saveSessionData();
}

// Funciones para el zoom
function zoomIn() {
  currentZoom += zoomStep;
  applyZoom();
}

function zoomOut() {
  currentZoom = Math.max(0.5, currentZoom - zoomStep);
  applyZoom();
}

function resetZoom() {
  currentZoom = 1;
  applyZoom();
}

function applyZoom() {
  const fontSize = 14 * currentZoom;
  document.querySelectorAll('.CodeMirror').forEach(cm => {
    cm.style.fontSize = `${fontSize}px`;
  });
}

// Eventos para el menú Archivo
newFileBtn.addEventListener('click', () => {
  createNewTab();
});

openFileBtn.addEventListener('click', () => {
  ipcRenderer.send('open-file-dialog');
});

saveFileBtn.addEventListener('click', () => {
  const activeTab = getActiveTab();
  if (activeTab) {
    saveTab(activeTab);
  }
});

saveAsFileBtn.addEventListener('click', () => {
  ipcRenderer.send('save-file-as');
});

closeTabBtn.addEventListener('click', () => {
  if (activeTabId) {
    closeTab(activeTabId);
  }
});

exitAppBtn.addEventListener('click', () => {
  // Verificar si hay pestañas sin guardar antes de salir
  const unsavedTabs = tabs.filter(tab => tab.isUnsaved);
  if (unsavedTabs.length > 0) {
    const message = `Hay ${unsavedTabs.length} archivo(s) sin guardar. ¿Desea salir sin guardar?`;
    if (confirm(message)) {
      ipcRenderer.send('confirm-close');
    }
  } else {
    ipcRenderer.send('confirm-close');
  }
});

// Eventos del menú Editar
undoBtn.addEventListener('click', () => {
  const activeTab = getActiveTab();
  if (activeTab && activeTab.editor) {
    activeTab.editor.undo();
  }
});

redoBtn.addEventListener('click', () => {
  const activeTab = getActiveTab();
  if (activeTab && activeTab.editor) {
    activeTab.editor.redo();
  }
});

cutBtn.addEventListener('click', () => {
  document.execCommand('cut');
});

copyBtn.addEventListener('click', () => {
  document.execCommand('copy');
});

pasteBtn.addEventListener('click', () => {
  document.execCommand('paste');
});

selectAllBtn.addEventListener('click', () => {
  const activeTab = getActiveTab();
  if (activeTab && activeTab.editor) {
    activeTab.editor.execCommand('selectAll');
  }
});

// Eventos del menú Ver
toggleWrapBtn.addEventListener('click', () => {
  const activeTab = getActiveTab();
  if (activeTab && activeTab.editor) {
    const lineWrapping = activeTab.editor.getOption('lineWrapping');
    activeTab.editor.setOption('lineWrapping', !lineWrapping);
  }
});

zoomInBtn.addEventListener('click', () => {
  zoomIn();
});

zoomOutBtn.addEventListener('click', () => {
  zoomOut();
});

zoomResetBtn.addEventListener('click', () => {
  resetZoom();
});

// Evento para el botón de nueva pestaña
newTabButton.addEventListener('click', () => {
  createNewTab();
});

// Gestionar mensajes IPC desde el proceso principal
ipcRenderer.on('file-opened', (event, { path, content }) => {
  openFileInNewTab(path, content);
});

ipcRenderer.on('get-content', (event, filePath) => {
  const activeTab = getActiveTab();
  if (activeTab) {
    const content = activeTab.getContent();
    ipcRenderer.send('save-content', { filePath, content });
  }
});

ipcRenderer.on('file-saved', (event, filePath) => {
  const activeTab = getActiveTab();
  if (activeTab) {
    activeTab.setFilePath(filePath);
    activeTab.markAsSaved();
    // Guardar la sesión después de guardar un archivo
    saveSessionData();
  }
});

// Restaurar la sesión anterior cuando se recibe el evento desde el proceso principal
ipcRenderer.on('restore-session', (event, files) => {
  debug('Evento restore-session recibido con:', files);
  restoreSession(files);
});

// Preparar para cerrar - guardar sesión y luego confirmar cierre
ipcRenderer.on('prepare-for-close', () => {
  debug('Preparando para cerrar la aplicación');

  // Verificar si hay pestañas sin guardar
  const unsavedTabs = tabs.filter(tab => tab.isUnsaved);
  if (unsavedTabs.length > 0) {
    const message = `Hay ${unsavedTabs.length} archivo(s) sin guardar. ¿Desea salir sin guardar?`;
    if (!confirm(message)) {
      return; // Cancelar cierre
    }
  }

  // Guardar sesión y confirmar cierre
  saveSessionData();
  setTimeout(() => {
    ipcRenderer.send('confirm-close');
  }, 100); // Pequeño retraso para asegurar que la sesión se guarde
});

// Atajos de teclado
document.addEventListener('keydown', e => {
  // Ctrl+N: Nueva pestaña
  if (e.ctrlKey && e.key === 'n') {
    e.preventDefault();
    createNewTab();
  }

  // Ctrl+O: Abrir archivo
  if (e.ctrlKey && e.key === 'o') {
    e.preventDefault();
    ipcRenderer.send('open-file-dialog');
  }

  // Ctrl+S: Guardar archivo
  if (e.ctrlKey && e.key === 's' && !e.shiftKey) {
    e.preventDefault();
    const activeTab = getActiveTab();
    if (activeTab) {
      saveTab(activeTab);
    }
  }

  // Ctrl+Shift+S: Guardar como
  if (e.ctrlKey && e.shiftKey && (e.key === 'S' || e.key === 's')) {
    e.preventDefault();
    ipcRenderer.send('save-file-as');
  }

  // Ctrl+W: Cerrar pestaña
  if (e.ctrlKey && e.key === 'w') {
    e.preventDefault();
    if (activeTabId) {
      closeTab(activeTabId);
    }
  }

  // Ctrl++: Ampliar zoom
  if (e.ctrlKey && (e.key === '+' || e.key === '=')) {
    e.preventDefault();
    zoomIn();
  }

  // Ctrl+-: Reducir zoom
  if (e.ctrlKey && e.key === '-') {
    e.preventDefault();
    zoomOut();
  }

  // Ctrl+0: Restablecer zoom
  if (e.ctrlKey && e.key === '0') {
    e.preventDefault();
    resetZoom();
  }

  // Ctrl+Tab: Cambiar a la siguiente pestaña
  if (e.ctrlKey && e.key === 'Tab') {
    e.preventDefault();
    if (tabs.length > 1) {
      const currentIndex = tabs.findIndex(tab => tab.id === activeTabId);
      const nextIndex = (currentIndex + 1) % tabs.length;
      activateTab(tabs[nextIndex].id);
    }
  }

  // Ctrl+Shift+Tab: Cambiar a la pestaña anterior
  if (e.ctrlKey && e.shiftKey && e.key === 'Tab') {
    e.preventDefault();
    if (tabs.length > 1) {
      const currentIndex = tabs.findIndex(tab => tab.id === activeTabId);
      const prevIndex = (currentIndex - 1 + tabs.length) % tabs.length;
      activateTab(tabs[prevIndex].id);
    }
  }
});

// No crear una pestaña inicial automáticamente
// La primera pestaña se creará solo si no hay sesión para restaurar
// o cuando la restauración de la sesión haya finalizado sin éxito
debug('Inicializando la aplicación, esperando eventos de sesión...');
