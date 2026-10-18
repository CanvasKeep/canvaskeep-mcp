#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { CanvasKeepClient } from "./client.js";

const DEFAULT_API_URL = "https://canvaskeep.com";

const apiKey = process.env.CANVASKEEP_API_KEY;
const apiUrl = process.env.CANVASKEEP_API_URL || DEFAULT_API_URL;
const masterKey = process.env.CANVASKEEP_MASTER_KEY;

if (!apiKey) {
  console.error(
    "CANVASKEEP_API_KEY is required. Generate one at your CanvasKeep dashboard under API Keys.",
  );
  process.exit(1);
}

if (!masterKey) {
  console.error(
    "Warning: CANVASKEEP_MASTER_KEY is not set. Encrypted diagrams will not be readable. Export your master key from CanvasKeep settings.",
  );
}

const client = new CanvasKeepClient(apiUrl, apiKey, masterKey);

const server = new McpServer({
  name: "canvaskeep",
  version: "0.6.0",
});

server.tool(
  "list_workspaces",
  "List all workspaces in your CanvasKeep account. Returns each workspace's id and name. Use this first to find the workspace_id needed by other tools.",
  {},
  async () => {
    try {
      const workspaces = await client.listWorkspaces();
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(workspaces, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  },
);

server.tool(
  "create_workspace",
  "Create a new workspace. Returns the new workspace's id and name.",
  {
    name: z
      .string()
      .min(1)
      .max(100)
      .describe("Name for the new workspace"),
  },
  async ({ name }) => {
    try {
      const workspace = await client.createWorkspace(name);
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(workspace, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  },
);

server.tool(
  "list_folders",
  "List all folders in a workspace. Returns each folder's id, name, and parent_folder_id. Use folder ids when creating diagrams inside a specific folder.",
  {
    workspace_id: z
      .string()
      .uuid()
      .describe("The workspace UUID to list folders from"),
  },
  async ({ workspace_id }) => {
    try {
      const folders = await client.listFolders(workspace_id);
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(folders, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  },
);

server.tool(
  "create_folder",
  "Create a new folder in a workspace. Returns the new folder's id and name. Optionally nest it inside an existing folder.",
  {
    workspace_id: z
      .string()
      .uuid()
      .describe("The workspace UUID to create the folder in"),
    name: z
      .string()
      .min(1)
      .max(100)
      .describe("Name for the new folder"),
    parent_folder_id: z
      .string()
      .uuid()
      .optional()
      .describe("Optional parent folder UUID to nest this folder inside"),
  },
  async ({ workspace_id, name, parent_folder_id }) => {
    try {
      const folder = await client.createFolder(workspace_id, name, parent_folder_id);
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(folder, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  },
);

server.tool(
  "list_diagrams",
  "List all diagrams in a workspace. Returns each diagram's id, title, and last updated timestamp.",
  {
    workspace_id: z
      .string()
      .uuid()
      .describe("The workspace UUID to list diagrams from"),
  },
  async ({ workspace_id }) => {
    try {
      const diagrams = await client.listDiagrams(workspace_id);
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(diagrams, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  },
);

server.tool(
  "create_diagram",
  "Create a new empty diagram in a workspace, optionally inside a folder. Returns the new diagram's id. Use generate_diagram afterward to populate it with content. Use list_folders first to find the folder_id if you want to place it in a specific folder.",
  {
    workspace_id: z
      .string()
      .uuid()
      .describe("The workspace UUID to create the diagram in"),
    title: z
      .string()
      .min(1)
      .max(200)
      .describe(
        "A short, descriptive title for the diagram (e.g. 'Auth Flow', 'System Architecture')",
      ),
    folder_id: z
      .string()
      .uuid()
      .optional()
      .describe(
        "Optional folder UUID to place the diagram in. Use list_folders to find folder ids. Omit to create at workspace root.",
      ),
  },
  async ({ workspace_id, title, folder_id }) => {
    try {
      const diagram = await client.createDiagram(workspace_id, title, folder_id);
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(diagram, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  },
);

server.tool(
  "update_diagram",
  "Update a diagram's title (rename it).",
  {
    diagram_id: z.string().uuid().describe("The diagram UUID to update"),
    title: z
      .string()
      .min(1)
      .max(200)
      .describe("The new title for the diagram"),
  },
  async ({ diagram_id, title }) => {
    try {
      const result = await client.updateDiagram(diagram_id, title);
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  },
);

server.tool(
  "delete_diagram",
  "Permanently delete a diagram and its content. This cannot be undone.",
  {
    diagram_id: z.string().uuid().describe("The diagram UUID to delete"),
  },
  async ({ diagram_id }) => {
    try {
      await client.deleteDiagram(diagram_id);
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({ ok: true, message: "Diagram deleted" }),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  },
);

server.tool(
  "get_diagram_summary",
  "Get a summary of an existing diagram: its title, workspace, element count, and when it was last updated. Does NOT return the raw scene data.",
  {
    diagram_id: z.string().uuid().describe("The diagram UUID to look up"),
  },
  async ({ diagram_id }) => {
    try {
      const { diagram, scene } = await client.getDiagram(diagram_id);
      const summary = {
        id: diagram.id,
        workspace_id: diagram.workspace_id,
        title: diagram.title,
        updated_at: diagram.updated_at,
        element_count: scene?.elements?.length ?? 0,
        has_content: (scene?.elements?.length ?? 0) > 0,
      };
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(summary, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  },
);

server.tool(
  "get_diagram_scene",
  `Read the raw Excalidraw scene of a diagram: the full elements array (with ids, x/y, width/height, styles, text, arrow bindings) and appState.

Use this before save_diagram_scene to make precise edits: read the scene, modify the elements you need, then write the complete array back.

Embedded image data (files) is omitted by default because it can be very large; set include_files to true only if you need it.`,
  {
    diagram_id: z.string().uuid().describe("The diagram UUID to read"),
    include_files: z
      .boolean()
      .default(false)
      .describe(
        "Include embedded image data (base64). Defaults to false; only file ids are listed.",
      ),
  },
  async ({ diagram_id, include_files }) => {
    try {
      const { diagram, scene } = await client.getDiagram(diagram_id);
      const files = scene?.files ?? {};
      const result = {
        id: diagram.id,
        title: diagram.title,
        updated_at: diagram.updated_at,
        element_count: scene?.elements?.length ?? 0,
        elements: scene?.elements ?? [],
        appState: scene?.appState ?? {},
        ...(include_files
          ? { files }
          : { file_ids: Object.keys(files) }),
      };
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(result),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  },
);

server.tool(
  "save_diagram_scene",
  `Overwrite a diagram's scene with a full Excalidraw elements array. Use this for manual layout and precise edits (moving, restyling, relabeling, adding or removing specific elements).

IMPORTANT: this REPLACES the entire scene. Always call get_diagram_scene first, modify that array, and send back EVERY element you want to keep. Any element missing from the array is deleted. To remove an element you may also set "isDeleted": true on it.

When changing an element, bump its "version" and set a new random "versionNonce" so open editors pick up the change. Text inside a shape is a separate text element with "containerId" set to the shape id; arrows reference shapes via startBinding/endBinding and shapes list them in boundElements.

Existing embedded images (files) and appState are kept unless you pass new ones. If the diagram is open in a browser tab, unsaved edits there may overwrite this save.`,
  {
    diagram_id: z.string().uuid().describe("The diagram UUID to write"),
    elements: z
      .array(z.record(z.unknown()))
      .min(1)
      .describe(
        "The complete Excalidraw elements array for the diagram (not a partial patch).",
      ),
    appState: z
      .record(z.unknown())
      .optional()
      .describe(
        "Optional appState (e.g. viewBackgroundColor). Omit to keep the current one.",
      ),
    files: z
      .record(z.unknown())
      .optional()
      .describe(
        "Optional embedded files map. Omit to keep the current files.",
      ),
  },
  async ({ diagram_id, elements, appState, files }) => {
    try {
      const { diagram, scene: current } = await client.getDiagram(diagram_id);
      await client.saveDiagramScene(diagram_id, {
        type: current?.type ?? "excalidraw",
        version: current?.version ?? 2,
        elements,
        appState: appState ?? current?.appState ?? {},
        files: files ?? current?.files ?? {},
      });
      const previousCount = current?.elements?.length ?? 0;
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                ok: true,
                element_count: elements.length,
                previous_element_count: previousCount,
                diagram_url: `${apiUrl}/dashboard/${diagram.workspace_id}/${diagram_id}`,
              },
              null,
              2,
            ),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  },
);

const nodeSchema = z.object({
  id: z
    .string()
    .describe(
      "A unique identifier for this node, used to reference it in edges (e.g. 'api-gateway', 'user-db')",
    ),
  label: z
    .string()
    .describe(
      "A short human-readable label shown inside the box on the diagram (e.g. 'API Gateway', 'User Database'). Keep it under 30 characters for best readability.",
    ),
  type: z
    .enum(["process", "datastore", "external", "service"])
    .optional()
    .describe(
      "Visual style hint. 'process' (purple, default): internal logic or computation. 'service' (green): a running service or microservice. 'datastore' (blue): a database, cache, or storage system. 'external' (yellow, dashed border): an external system or third-party API outside your control.",
    ),
});

const edgeSchema = z.object({
  from: z
    .string()
    .describe("The id of the source node where this connection starts"),
  to: z
    .string()
    .describe("The id of the target node where this connection ends"),
  label: z
    .string()
    .optional()
    .describe(
      "A short label shown on the arrow describing the interaction (e.g. 'HTTP request', 'SQL query', 'publishes events'). Omit if the relationship is obvious from context.",
    ),
});

server.tool(
  "generate_diagram",
  `Generate a visual diagram from a structured graph of nodes and edges, and save it to an existing CanvasKeep diagram.

You provide the logical structure (what components exist and how they connect), and CanvasKeep handles all visual layout automatically - do NOT try to compute x/y positions.

NODES: Create one node for every distinct component, actor, system, service, or data store mentioned in the user's request. Give each a short, clear label (under 30 chars). Choose the right type for visual distinction.

EDGES: Create one edge for every meaningful interaction, data flow, API call, or dependency between nodes. Label edges with the nature of the interaction (e.g. 'REST API', 'SQL query', 'WebSocket', 'publishes'). Every important relationship should be an edge.

MODE: Use 'replace' (default) to create a fresh diagram. Use 'append' to add new elements alongside existing content in the diagram.`,
  {
    diagram_id: z
      .string()
      .uuid()
      .describe(
        "The diagram UUID to write the generated content into. Create one first with create_diagram if needed.",
      ),
    nodes: z
      .array(nodeSchema)
      .min(1)
      .describe(
        "Every distinct component, actor, system, or data store to show on the diagram. Each becomes a labeled box.",
      ),
    edges: z
      .array(edgeSchema)
      .describe(
        "Connections between nodes representing interactions, data flows, API calls, or dependencies. Each becomes a labeled arrow.",
      ),
    mode: z
      .enum(["replace", "append"])
      .default("replace")
      .describe(
        "'replace' clears existing content and draws only the new graph. 'append' adds the new graph alongside any existing diagram content.",
      ),
    direction: z
      .enum(["vertical", "horizontal", "auto"])
      .default("vertical")
      .describe(
        "Layout direction. 'vertical' (default): top-to-bottom flow, best for sequential processes. 'horizontal': left-to-right. 'auto': picks based on max fan-out from any single node.",
      ),
  },
  async ({ diagram_id, nodes, edges, mode, direction }) => {
    try {
      const result = await client.generateDiagram(
        diagram_id,
        nodes,
        edges,
        mode,
        direction,
      );
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                success: true,
                element_count: result.elementCount,
                diagram_url: result.diagramUrl,
                message: `Diagram generated with ${result.elementCount} elements. Open it at: ${result.diagramUrl}`,
              },
              null,
              2,
            ),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  },
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error("Fatal:", error);
  process.exit(1);
});
