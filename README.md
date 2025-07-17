# Postodo - Sticky Notes Plugin for Obsidian

A powerful sticky notes plugin for Obsidian that allows you to create, organize, and manage sticky notes on a canvas with seamless file synchronization.

## Features

### Phase 1 MVP (Current)
- ✅ Create sticky notes on canvas
- ✅ Drag and drop notes 
- ✅ Edit notes inline
- ✅ Delete notes
- ✅ File synchronization with Obsidian vault
- ✅ Customizable settings
- ✅ Modular architecture with DI container
- ✅ Real-time persistence

### Planned Features
- Advanced theming system
- Animation effects
- Mobile touch support
- Canvas zooming and panning
- Note linking and tagging
- Search functionality
- Extension system

## Architecture

Postodo follows a modular, loosely-coupled architecture:

- **DI Container**: Dependency injection for service management
- **Event Bus**: Decoupled component communication
- **Storage Adapters**: Pluggable storage backends
- **Data Management**: Centralized note operations
- **UI Components**: Modular interface elements

## Installation

1. Clone this repository
2. Run `npm install` to install dependencies
3. Run `npm run build` to build the plugin
4. Copy the built files to your Obsidian plugins folder

## Development

```bash
# Install dependencies
npm install

# Start development build
npm run dev

# Build for production
npm run build
```

## Usage

1. Open Obsidian
2. Enable the Postodo plugin
3. Click the sticky note icon in the ribbon or use the command palette
4. Create notes by typing in the input field or clicking on the canvas
5. Drag notes to reposition them
6. Double-click to edit note content
7. Use the × button to delete notes

## Settings

Access settings through Obsidian's settings panel under "Postodo":

- **Notes folder**: Where notes are stored
- **Auto save**: Enable/disable automatic saving
- **Save interval**: How often to save changes
- **Sync strategy**: How notes are synchronized
- **UI options**: Grid display, theming, etc.

## File Structure

Notes are stored as individual markdown files in the configured folder (default: `Postodo/`). Each note contains:

- YAML frontmatter with position, dimensions, and metadata
- Note content as markdown

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License - see LICENSE file for details

## Support

For bugs and feature requests, please create an issue on GitHub.