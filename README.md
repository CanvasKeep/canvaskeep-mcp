# CanvasKeep MCP Server

An MCP (Model Context Protocol) server that lets AI tools like Claude Code and Codex generate Excalidraw diagrams and save them directly into your [CanvasKeep](https://canvaskeep.com) workspace.

[![npm](https://img.shields.io/npm/v/canvaskeep-mcp)](https://www.npmjs.com/package/canvaskeep-mcp)
[![license](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

## Setup

### 1. Get an API key

1. Log in to [CanvasKeep](https://canvaskeep.com)
2. Click your profile menu (top right) and select **API Keys**
3. Generate a new key and copy it immediately (you won't see it again)

### 2. Install and register

**Claude Code:**

```bash
claude mcp add canvaskeep \
  -e CANVASKEEP_API_KEY=ck_your_key_here \
  -- npx canvaskeep-mcp
```

**Codex / other MCP clients:**

```json
{
  "mcpServers": {
    "canvaskeep": {
      "command": "npx",
      "args": ["canvaskeep-mcp"],
      "env": {
        "CANVASKEEP_API_KEY": "ck_your_key_here"
      }
    }
  }
}
```

### 3. Environment variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `CANVASKEEP_API_KEY` | Yes | - | Your API key from the CanvasKeep dashboard |
| `CANVASKEEP_MASTER_KEY` | No | - | Needed to read or edit encrypted diagrams. Copy it from [canvaskeep.com/dashboard/encryption](https://canvaskeep.com/dashboard/encryption) (Key for the MCP server) |
| `CANVASKEEP_API_URL` | No | `https://canvaskeep.com` | API base URL (override for local dev) |

## Available tools

| Tool | Description |
|---|---|
| `list_workspaces` | List all your workspaces |
| `create_workspace` | Create a new workspace |
| `list_folders` | List folders in a workspace |
| `create_folder` | Create a new folder, optionally nested |
| `list_diagrams` | List diagrams in a workspace |
| `create_diagram` | Create a diagram, optionally inside a folder |
| `update_diagram` | Rename a diagram |
| `delete_diagram` | Permanently delete a diagram |
| `get_diagram_summary` | Get diagram metadata and element count |
| `get_diagram_scene` | Read the full Excalidraw scene of a diagram |
| `save_diagram_scene` | Write a full Excalidraw scene back to a diagram |
| `generate_diagram` | Generate a diagram from nodes and edges with auto-layout |

## Encryption

Diagrams you encrypt in CanvasKeep stay encrypted when an AI tool works with them. When `get_diagram_scene` or `save_diagram_scene` touches an encrypted diagram, this server decrypts and re-encrypts it locally (AES-GCM, see [`src/encryption.ts`](src/encryption.ts)) using `CANVASKEEP_MASTER_KEY`. The master key never leaves your machine.

`generate_diagram` sends the nodes and edges you give it to CanvasKeep, which lays them out on the server, so diagrams generated this way are stored unencrypted.

## Example usage

Ask Claude Code something like:

> "Draw an architecture diagram of a web app with a React frontend, Node API, PostgreSQL database, and Redis cache"

Claude will use the MCP tools to create a diagram in your CanvasKeep workspace with properly laid-out boxes and labeled arrows.

## Development

```bash
git clone https://github.com/CanvasKeep/canvaskeep-mcp.git
cd canvaskeep-mcp
npm install
npm run build
CANVASKEEP_API_KEY=ck_... CANVASKEEP_API_URL=http://localhost:3000 node dist/index.js
```

To run your local build from Claude Code:

```bash
claude mcp add canvaskeep \
  -e CANVASKEEP_API_KEY=ck_your_key_here \
  -- node /path/to/canvaskeep-mcp/dist/index.js
```

## License

[MIT](LICENSE)
