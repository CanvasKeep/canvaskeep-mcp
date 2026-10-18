import {
  decryptScene,
  encryptScene,
  unwrapDiagramKey,
} from "./encryption.js";

export type Workspace = { id: string; name: string };
export type DiagramSummary = {
  id: string;
  title: string;
  folder_id: string | null;
  created_at: string;
  updated_at: string;
};
export type DiagramDetail = {
  id: string;
  workspace_id: string;
  title: string;
  updated_at: string;
  encryption_version?: number | null;
  encrypted_key?: string | null;
};
export type DiagramScene = {
  type: string;
  version: number;
  elements: unknown[];
  appState: Record<string, unknown>;
  files: Record<string, unknown>;
};

export type DiagramNode = {
  id: string;
  label: string;
  type?: "process" | "datastore" | "external" | "service";
};

export type DiagramEdge = {
  from: string;
  to: string;
  label?: string;
};

export type FolderSummary = {
  id: string;
  name: string;
  parent_folder_id: string | null;
  created_at: string;
};

export type GenerateResult = {
  ok: boolean;
  elementCount: number;
  diagramUrl: string;
};

export class CanvasKeepClient {
  private baseUrl: string;
  private apiKey: string;
  private masterKey: string | null;

  constructor(baseUrl: string, apiKey: string, masterKey?: string) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.apiKey = apiKey;
    this.masterKey = masterKey ?? null;
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const text = await response.text();
      let message: string;
      try {
        const json = JSON.parse(text);
        message = json.error ?? text;
      } catch {
        message = text;
      }
      throw new Error(`API ${response.status}: ${message}`);
    }

    return response.json() as Promise<T>;
  }

  private async requestBinary(
    method: string,
    path: string,
    body: ArrayBuffer,
    extraHeaders: Record<string, string> = {},
  ): Promise<Response> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/octet-stream",
        ...extraHeaders,
      },
      body,
    });

    if (!response.ok) {
      const text = await response.text();
      let message: string;
      try {
        const json = JSON.parse(text);
        message = json.error ?? text;
      } catch {
        message = text;
      }
      throw new Error(`API ${response.status}: ${message}`);
    }

    return response;
  }

  private async resolveDiagramKey(
    encryptedKey: string | null | undefined,
  ): Promise<string | null> {
    if (!encryptedKey || !this.masterKey) return null;
    return unwrapDiagramKey(encryptedKey, this.masterKey);
  }

  async listWorkspaces(): Promise<Workspace[]> {
    const data = await this.request<{ workspaces: Workspace[] }>(
      "GET",
      "/api/workspaces",
    );
    return data.workspaces;
  }

  async createWorkspace(
    name: string,
  ): Promise<{ id: string; name: string }> {
    const data = await this.request<{
      workspace: { id: string; name: string };
    }>("POST", "/api/workspaces", { name });
    return data.workspace;
  }

  async listFolders(workspaceId: string): Promise<FolderSummary[]> {
    const data = await this.request<{ folders: FolderSummary[] }>(
      "GET",
      `/api/workspaces/${workspaceId}/folders`,
    );
    return data.folders;
  }

  async createFolder(
    workspaceId: string,
    name: string,
    parentFolderId?: string,
  ): Promise<FolderSummary> {
    const body: { name: string; parent_folder_id?: string } = { name };
    if (parentFolderId) body.parent_folder_id = parentFolderId;
    const data = await this.request<{ folder: FolderSummary }>(
      "POST",
      `/api/workspaces/${workspaceId}/folders`,
      body,
    );
    return data.folder;
  }

  async listDiagrams(workspaceId: string): Promise<DiagramSummary[]> {
    const data = await this.request<{ diagrams: DiagramSummary[] }>(
      "GET",
      `/api/workspaces/${workspaceId}/diagrams`,
    );
    return data.diagrams;
  }

  async createDiagram(
    workspaceId: string,
    title: string,
    folderId?: string,
  ): Promise<{ id: string; title: string }> {
    const body: { title: string; folder_id?: string } = { title };
    if (folderId) body.folder_id = folderId;
    const data = await this.request<{
      diagram: { id: string; title: string };
    }>("POST", `/api/workspaces/${workspaceId}/diagrams`, body);
    return data.diagram;
  }

  async getDiagram(
    diagramId: string,
  ): Promise<{ diagram: DiagramDetail; scene: DiagramScene | null }> {
    const data = await this.request<{
      diagram: DiagramDetail;
      scene: DiagramScene | null;
      encrypted_scene_base64?: string | null;
    }>("GET", `/api/diagrams/${diagramId}`);

    if (
      data.diagram.encryption_version === 1 &&
      data.encrypted_scene_base64
    ) {
      const diagramKey = await this.resolveDiagramKey(
        data.diagram.encrypted_key,
      );

      if (!diagramKey) {
        throw new Error(
          "Diagram is encrypted but CANVASKEEP_MASTER_KEY is not set. " +
            "Copy it from https://canvaskeep.com/dashboard/encryption (Key for the MCP server) and set it as CANVASKEEP_MASTER_KEY.",
        );
      }

      const buf = Buffer.from(data.encrypted_scene_base64, "base64");
      const arrayBuf = buf.buffer.slice(
        buf.byteOffset,
        buf.byteOffset + buf.byteLength,
      );
      const json = await decryptScene(arrayBuf, diagramKey);
      const scene = JSON.parse(json) as DiagramScene;

      return { diagram: data.diagram, scene };
    }

    return { diagram: data.diagram, scene: data.scene };
  }

  async updateDiagram(
    diagramId: string,
    title: string,
  ): Promise<{ ok: boolean; title: string }> {
    return this.request<{ ok: boolean; title: string }>(
      "PATCH",
      `/api/diagrams/${diagramId}`,
      { title },
    );
  }

  async deleteDiagram(diagramId: string): Promise<{ ok: boolean }> {
    return this.request<{ ok: boolean }>(
      "DELETE",
      `/api/diagrams/${diagramId}`,
    );
  }

  async saveDiagramScene(
    diagramId: string,
    scene: DiagramScene,
  ): Promise<{ ok: boolean }> {
    // Fetch the diagram's encryption info
    const keyData = await this.request<{
      encrypted_key: string | null;
      encryption_version: number | null;
    }>("GET", `/api/diagrams/${diagramId}/wrapped-key`);

    if (keyData.encryption_version === 1 && keyData.encrypted_key) {
      const diagramKey = await this.resolveDiagramKey(keyData.encrypted_key);
      if (!diagramKey) {
        throw new Error(
          "Diagram is encrypted but CANVASKEEP_MASTER_KEY is not set. " +
            "Copy it from https://canvaskeep.com/dashboard/encryption (Key for the MCP server) and set it as CANVASKEEP_MASTER_KEY.",
        );
      }

      const jsonString = JSON.stringify(scene);
      const encrypted = await encryptScene(jsonString, diagramKey);

      await this.requestBinary(
        "PUT",
        `/api/diagrams/${diagramId}`,
        encrypted,
        { "X-Encrypted-Key": keyData.encrypted_key },
      );

      return { ok: true };
    }

    return this.request<{ ok: boolean }>("PUT", `/api/diagrams/${diagramId}`, {
      elements: scene.elements,
      appState: scene.appState,
      files: scene.files,
    });
  }

  async generateDiagram(
    diagramId: string,
    nodes: DiagramNode[],
    edges: DiagramEdge[],
    mode: "replace" | "append",
    direction: "vertical" | "horizontal" | "auto",
  ): Promise<GenerateResult> {
    return this.request<GenerateResult>(
      "POST",
      `/api/diagrams/${diagramId}/generate`,
      { nodes, edges, mode, direction },
    );
  }
}
