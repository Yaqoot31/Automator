import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import type { AutomationProject, ProjectFile } from '@/types';

export async function downloadCompleteProjectZip(project: AutomationProject): Promise<void> {
  const zip = new JSZip();
  const folderName =
    project.name
      .replace(/[^a-zA-Z0-9_-]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'WebsiteAutomationProject';

  const root = zip.folder(folderName);
  if (!root) return;

  for (const file of project.files) {
    root.file(file.path, file.content);
  }

  const blob = await zip.generateAsync({ type: 'blob' });
  saveAs(blob, `${folderName}.zip`);
}

export function downloadSingleProjectFile(file: ProjectFile): void {
  const blob = new Blob([file.content], { type: 'text/plain;charset=utf-8' });
  saveAs(blob, file.name);
}
