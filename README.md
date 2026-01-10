# Postodo - Sticky Notes Plugin for Obsidian

[日本語版はこちら](README_ja.md)

A visual sticky notes plugin for Obsidian that lets you organize your todos on a whiteboard-style canvas with seamless file synchronization.

![Obsidian](https://img.shields.io/badge/Obsidian-v1.0.0+-purple)
![License](https://img.shields.io/badge/license-MIT-blue)

## Features

- **Visual Canvas** - Organize sticky notes on a whiteboard-style background
- **Drag & Drop** - Freely position notes anywhere on the canvas
- **File Sync** - Notes are saved as markdown files in your vault
- **Bidirectional Sync** - Edit notes from Obsidian or the canvas
- **Customizable Appearance** - 6 colors and 3 sizes available
- **Display Filters** - Show incomplete, complete, or all notes
- **Conflict Resolution** - Automatic handling of sync conflicts
- **FAB Menu** - Quick access to common actions

## Installation

### From Obsidian Community Plugins (Recommended)

1. Open Obsidian Settings
2. Go to Community Plugins and disable Safe Mode
3. Click Browse and search for "Postodo"
4. Click Install, then Enable

### Manual Installation

1. Download `main.js`, `manifest.json`, and `styles.css` from the [latest release](https://github.com/your-username/postodo/releases)
2. Create a folder `postodo` in your vault's `.obsidian/plugins/` directory
3. Copy the downloaded files into the folder
4. Reload Obsidian and enable the plugin

## Usage

1. Click the sticky note icon in the ribbon or use command palette: "Postodo: Open"
2. Type in the input field and press Enter to create a note
3. Drag notes to reposition them
4. Double-click to edit note content
5. Use the color palette and size picker to customize appearance
6. Click the checkbox to mark notes as complete

## Settings

Access settings through Obsidian Settings → Postodo:

| Setting | Description | Default |
|---------|-------------|---------|
| Notes Folder | Where notes are stored | `Postodo` |
| Naming Strategy | File naming format | Timestamp |
| Default Filter | Initial display filter | Incomplete |
| Auto Save | Enable automatic saving | On |
| Save Interval | Debounce time for saves | 500ms |

## File Format

Notes are stored as markdown files with YAML frontmatter:

```markdown
---
id: "unique-id"
position:
  x: 100
  y: 200
  zIndex: 1
appearance:
  color: "yellow"
  size: "medium"
completed: false
---

# Note Title

Note content here...
```

## Development

```bash
# Install dependencies
npm install

# Development build with watch
npm run dev

# Production build
npm run build

# Run tests
npm test
```

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT License - see [LICENSE](LICENSE) for details.

## Support

- [Report a bug](https://github.com/your-username/postodo/issues)
- [Request a feature](https://github.com/your-username/postodo/issues)
