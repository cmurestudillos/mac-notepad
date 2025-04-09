# MAC Notepad ++

MAC Notepad es un editor de texto moderno y liviano, desarrollado con Electron y JavaScript. Combina la simplicidad de un bloc de notas tradicional con funcionalidades avanzadas inspiradas en editores como Notepad++, creando una experiencia de edición potente y multiplataforma.

## Características

- **Sistema de pestañas avanzado**:
  - Múltiples documentos en una sola ventana
  - Reordenamiento de pestañas mediante arrastrar y soltar
  - Indicador visual de archivos no guardados
  - Navegación rápida con atajos de teclado

- **Editor potente**:
  - Resaltado de sintaxis para múltiples lenguajes (JavaScript, HTML, CSS, Python, etc.)
  - Numeración de líneas e indicador de posición del cursor
  - Ajuste de línea configurable
  - Plegado de código
  - Auto-cierre de paréntesis y llaves

- **Persistencia de sesión**:
  - Restauración automática de documentos al iniciar
  - Recuerda los archivos abiertos entre sesiones
  - Mantiene el orden de las pestañas personalizado

- **Interfaz amigable**:
  - Menú personalizado integrado en la ventana
  - Atajos de teclado para todas las operaciones comunes
  - Control de zoom para mejor legibilidad
  - Diseño limpio y responsive

## Instalación

### Prerequisitos

- [Node.js](https://nodejs.org/) 
- [npm](https://www.npmjs.com/)

### Pasos de instalación

1. Clona este repositorio:
   ```bash
   git clone https://github.com/cmurestudillos/mac-notepad.git
   cd mac-notepad
   ```

2. Instala las dependencias:
   ```bash
   npm install
   ```

3. Ejecuta la aplicación:
   ```bash
   npm start
   ```

## Uso

### Operaciones básicas

- **Archivos**:
  - Crear nuevo archivo: `Ctrl+N`
  - Abrir archivo: `Ctrl+O`
  - Guardar archivo: `Ctrl+S`
  - Guardar como: `Ctrl+Shift+S`
  - Cerrar pestaña actual: `Ctrl+W`

- **Edición**:
  - Deshacer: `Ctrl+Z`
  - Rehacer: `Ctrl+Y`
  - Cortar: `Ctrl+X`
  - Copiar: `Ctrl+C`
  - Pegar: `Ctrl+V`
  - Seleccionar todo: `Ctrl+A`

- **Navegación**:
  - Cambiar a siguiente pestaña: `Ctrl+Tab`
  - Cambiar a pestaña anterior: `Ctrl+Shift+Tab`

- **Vista**:
  - Ampliar zoom: `Ctrl++`
  - Reducir zoom: `Ctrl+-`
  - Restablecer zoom: `Ctrl+0`

### Gestión de pestañas

- Para **reordenar pestañas**: Arrastra y suelta las pestañas en la posición deseada
- Para **cerrar una pestaña**: Haz clic en el botón "×" o usa `Ctrl+W`
- Para **abrir una nueva pestaña**: Haz clic en el botón "+" o usa `Ctrl+N`

## Personalización

MAC Notepad ++ se puede personalizar editando los siguientes archivos:

- `styles.css`: Para modificar la apariencia visual
- `renderer.js`: Para añadir o modificar funcionalidades del editor
- `main.js`: Para configurar el comportamiento de la aplicación Electron

## Desarrollo

### Estructura del proyecto

```
mac-notepad/
├── main.js            # Punto de entrada principal (proceso principal de Electron)
├── renderer.js        # Lógica del editor (proceso de renderizado)
├── index.html         # Estructura de la interfaz
├── styles.css         # Estilos de la aplicación
├── package.json       # Dependencias y scripts
└── README.md          # Documentación
```

### Tecnologías utilizadas

- [Electron](https://www.electronjs.org/) - Framework para crear aplicaciones de escritorio
- [CodeMirror](https://codemirror.net/) - Editor de código para el navegador
- JavaScript vanilla para la lógica de la aplicación
- HTML/CSS para la interfaz de usuario

## Contribuir

Las contribuciones son bienvenidas. Para contribuir:

1. Haz un fork del repositorio
2. Crea una rama para tu característica (`git checkout -b feature/amazing-feature`)
3. Realiza tus cambios y haz commit (`git commit -m 'Añadir característica increíble'`)
4. Sube tus cambios (`git push origin feature/amazing-feature`)
5. Abre un Pull Request

## Licencia

Este proyecto está licenciado bajo la licencia MIT - ver el archivo [LICENSE](LICENSE) para más detalles.

## Contacto

Enlace del proyecto: [https://github.com/cmurestudillos/mac-notepad](https://github.com/cmurestudillos/mac-notepad)